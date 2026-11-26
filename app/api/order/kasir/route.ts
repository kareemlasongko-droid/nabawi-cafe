/**
 * /api/order/kasir — data untuk portal kasir.
 *
 * GET  : pesanan aktif + meja + tagihan terbuka.
 *        Semuanya dalam SATU permintaan. Kalau dipecah, tablet kasir
 *        melakukan 4 permintaan tiap 4 detik dan itu pemborosan di
 *        jaringan cafe yang tidak selalu kuat.
 * POST : aksi kecil (bayar tunai, ketersediaan menu).
 */
import { NextResponse } from "next/server";
import {
  ambilAturan,
  ambilItemTagihan,
  ambilMenu,
  ambilPesananAktif,
  bayarTunaiKasir,
  sapuKedaluwarsa,
  type BarisStruk,
} from "@/app/lib/order/data";
import { db, PESAN_ENV_KOSONG, punyaEnvBaca, punyaKunciServer } from "@/app/lib/order/db";
import {
  demoReset,
  demoMenuDenganStatus,
  demoSetTersedia,
} from "@/app/lib/order/demo";
import { bolehBayarTunai } from "@/app/lib/order/katalog";
import { pesanModeContoh, statusModeContoh } from "@/app/lib/order/mode-contoh";
import { urutNomorMeja, type Meja, type Pesanan, type Tagihan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = await statusModeContoh(punyaKunciServer());

  /*
    MEJA, MENU, TAGIHAN, PESANAN — SEMUA DARI DATABASE.

    Dulu, tanpa kunci server blok ini mengembalikan meja, tagihan, dan
    pesanan karangan dari `demo.ts`, bercampur dengan menu ASLI dari
    database. Hasilnya: kasir melihat meja dan pesanan yang tidak pernah
    ada, di sebelah menu yang benar — campuran yang paling menyesatkan
    karena tampak masuk akal.

    Sekarang tidak ada campuran. Yang tidak bisa dibaca dilaporkan gagal.

    Kunci server hanya dibutuhkan untuk MENULIS. Membaca tetap mungkin
    dengan kunci publik, jadi jangan menolak lebih awal dari seharusnya.
  */
  if (!punyaEnvBaca()) {
    return NextResponse.json(
      { pesan: PESAN_ENV_KOSONG, demo: mode.aktif, kode: "env" },
      { status: 503 }
    );
  }

  /*
    Penyapu dijalankan saat kasir membuka layarnya.

    Cron Cloudflare bisa mati tanpa ada yang melihat; kasir membuka layar
    ini sepanjang jam buka, jadi ini titik yang paling pasti untuk
    membersihkan pesanan yang tak pernah dibayar. Dijalankan sebelum
    membaca pesanan supaya daftar yang tampil sudah bersih — kalau
    sesudahnya, kasir masih melihat pesanan kedaluwarsa satu kali lagi.
  */
  if (punyaKunciServer()) await sapuKedaluwarsa();

  const [pesananRes, mejaRes, tagihanRes, aturan, menuRes, menungguRes] =
    await Promise.all([
    ambilPesananAktif(),
    db<Meja[]>("meja", { q: "select=*&order=nomor.asc" }),
    db<Tagihan[]>("tagihan", { q: "select=*&status=neq.lunas&order=dibuka_at.asc" }),
    ambilAturan(),
    ambilMenu(),
    /*
      Pesanan yang BELUM dibayar. Kasir perlu melihatnya untuk dua hal:
      menagih tunai di meja, dan menjawab tamu yang bertanya "pesanan saya
      masuk belum?". Dapur TIDAK menerima daftar ini — hanya yang lunas.
    */
    db<Pesanan[]>("pesanan", {
      q:
        "select=*&status_bayar=eq.menunggu" +
        "&status=neq.dibatalkan&order=created_at.asc&limit=50",
    }),
  ]);

  if (!pesananRes.ok) return NextResponse.json({ pesan: pesananRes.pesan }, { status: 500 });
  if (!mejaRes.ok) return NextResponse.json({ pesan: mejaRes.pesan }, { status: 500 });
  if (!tagihanRes.ok) return NextResponse.json({ pesan: tagihanRes.pesan }, { status: 500 });

  /*
    ── TAGIHAN DIPETAKAN PER PESANAN, BUKAN PER MEJA ──────────────────

    Sebelumnya: `new Map(tagihan.map(t => [t.meja_id, t]))`. Satu meja
    hanya bisa menyimpan SATU tagihan, sehingga tagihan kedua di meja yang
    sama menimpa yang pertama. Dengan tagihan per-pesanan itu salah dua
    kali: kasir melihat struk pesanan yang keliru, dan pesanan yang
    tagihannya tertimpa tampil TANPA total — tidak bisa ditagih dari layar.

    Sekarang dikunci dengan `pesanan.tagihan_id`, yang memang satu-satunya
    tautan yang benar. Pesanan tanpa tagihan_id (mis. dibuat sebelum
    migrasi, atau gagal ditautkan) tetap bisa tampil; tagihannya dicari
    lewat pesanan yang menunjuk ke meja yang sama, bukan lewat meja saja.
  */
  const petaTagihan = new Map(tagihanRes.data.map((t) => [t.id, t]));
  const petaNomor = new Map(mejaRes.data.map((m) => [m.id, m.nomor]));

  /*
    Item untuk tiap tagihan terbuka. Diambil paralel dan hanya untuk meja
    yang punya tagihan — biasanya 2–5 meja, bukan 20. Tanpa ini struk
    kosong: setelah lunas pesanan keluar dari daftar aktif, jadi itemnya
    tidak bisa lagi dicari dari /api/order/kasir.
  */
  const mejaTagihan = mejaRes.data.filter((m) =>
    tagihanRes.data.some((t) => t.meja_id === m.id)
  );
  const itemPerMeja = await Promise.all(
    mejaTagihan.map((m) => ambilItemTagihan(m.id))
  );
  // BarisStruk diimpor sebagai tipe saja; Map butuh tipe hasil yang konkret.
  const petaItem = new Map<number, BarisStruk[]>();
  mejaTagihan.forEach((m, i) => {
    const r = itemPerMeja[i];
    petaItem.set(m.id, r.ok ? r.data : []);
  });

  /*
    Pesanan menunggu bayar disertai nomor meja, supaya kasir bisa
    mendatangi meja yang benar tanpa mencari id meja secara manual.
  */
  const petaNomorMeja = new Map(mejaRes.data.map((m) => [m.id, m.nomor]));
  const menunggu = (menungguRes.ok ? menungguRes.data : []).map((p) => {
    /*
      ── BERAPA YANG HARUS DITAGIH, BUKAN HANYA "BELUM DIBAYAR" ────────

      Kartu "Belum dibayar" memberi tahu kasir bahwa ADA yang belum
      dibayar, tetapi tidak berapa. Kasir lalu menekan "Uang pas" tanpa
      tahu nominal yang akan diterima tamu — dan pada tagihan Rp146.600
      itu perbedaan yang membuat kasir salah menyebut angka di depan tamu.

      Tagihannya sudah ada di memori (`petaTagihan`, dipakai untuk denah
      meja di bawah), jadi ini tidak menambah satu pun permintaan ke
      database. Pesanan tanpa tagihan (data lama) mendapat null, bukan 0:
      nol akan terbaca sebagai "tidak perlu dibayar".
    */
    const t = p.tagihan_id != null ? petaTagihan.get(p.tagihan_id) : undefined;
    return {
      ...p,
      meja_nomor: petaNomorMeja.get(p.meja_id) ?? String(p.meja_id),
      total: t?.total ?? null,
    };
  });

  return NextResponse.json({
    pesanan: pesananRes.data,
    menunggu_bayar: menunggu,
    /*
      Meja diurutkan di sini, bukan diserahkan pada `order=nomor.asc` dari
      database: kolomnya TEXT, jadi PostgREST memberi 1, 10, 11, 2, 20, 3.
      Denah kasir yang "acak" menghabiskan waktu kasir yang sedang berdiri.
    */
    meja: [...mejaRes.data]
      .sort((a, b) => urutNomorMeja(a.nomor, b.nomor))
      .map((m) => {
      /*
        Tagihan yang ditampilkan di kartu meja: yang masih TERBUKA.
        Kalau tidak ada (semua sudah lunas), kembalikan null — jangan
        tagihan lunas, karena kartu akan menawarkan "Terima pembayaran"
        untuk sesuatu yang sudah dibayar.
      */
      /*
        Diurutkan menurut WAKTU, bukan teks. `localeCompare` pada string
        tanggal menghasilkan 500 seluruh endpoint kalau salah satu baris
        tidak punya `dibuka_at` — dan kegagalan satu baris tidak boleh
        menjatuhkan seluruh layar kasir.
      */
      const waktu = (t: { dibuka_at?: string | null }) => {
        const n = t.dibuka_at ? new Date(t.dibuka_at).getTime() : 0;
        return Number.isFinite(n) ? n : 0;
      };
      const terbuka = tagihanRes.data
        .filter((t) => t.meja_id === m.id && t.status !== "lunas")
        .sort((a, b) => waktu(a) - waktu(b));
      return {
        ...m,
        tagihan: terbuka[0] ?? null,
        // Semua tagihan terbuka di meja ini, untuk denah yang menampilkan
        // lebih dari satu pesanan pada satu meja.
        tagihan_terbuka: terbuka,
        items_tagihan: petaItem.get(m.id) ?? [],
      };
    }),
    menu: menuRes.ok ? demoMenuDenganStatus(menuRes.data.menu) : [],
    aturan,
    /*
      `demo` tetap dikirim supaya portal tidak perlu tahu cara menentukan
      sendiri. Artinya: "yang Anda lakukan di sesi ini tidak tersimpan".
      Menu/meja tetap sungguhan — hanya aksi tulis yang tidak mendarat.
    */
    demo: mode.aktif,
    pesanDemo: pesanModeContoh(mode),
  });
}

export async function POST(req: Request) {
  let badan: {
    aksi?: string;
    id?: number;
    menu_id?: number;
    tersedia?: boolean;
    oleh?: string;
    /** Untuk aksi `bayar_tunai`. */
    pesanan_id?: number;
    diterima?: number;
    /** Tamu membayar uang pas — nominal ditentukan server, bukan browser. */
    uang_pas?: boolean;
  };
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  /*
    K-08 / D-07 — tandai menu habis atau tersedia lagi.

    Satu endpoint untuk kasir dan dapur karena keduanya menandai hal yang
    sama (ketersediaan menu), dan dua endpoint berarti dua tempat yang bisa
    berbeda perilaku. Yang menandai dicatat di log: saat jam sibuk, "siapa
    yang menandai habis" adalah pertanyaan yang muncul ketika tamu
    komplain menunya masih tampil.
  */
  if (badan.aksi === "set_tersedia") {
    const id = Number(badan.menu_id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ pesan: "Menu tidak sah." }, { status: 400 });
    }
    if (typeof badan.tersedia !== "boolean") {
      return NextResponse.json({ pesan: "Status ketersediaan tidak sah." }, { status: 400 });
    }

    if (!punyaKunciServer()) {
      /*
        Tanpa kunci server tidak ada yang bisa DITULIS ke database, jadi
        penandaan habis hanya berlaku di memori Worker dan hilang saat
        Worker restart. Itu tetap berguna untuk mencoba alur, tetapi menu
        yang diperiksa harus tetap menu DATABASE — dulu di sini ada
        MENU_CONTOH, sehingga id menu yang tidak ada di database pun bisa
        "ditandai habis".
      */
      const daftar = await ambilMenu();
      if (!daftar.ok) {
        return NextResponse.json({ pesan: daftar.pesan }, { status: 503 });
      }
      if (!daftar.data.menu.some((m) => m.id === id)) {
        return NextResponse.json({ pesan: `Menu ${id} tidak dikenal.` }, { status: 400 });
      }
      demoSetTersedia(id, badan.tersedia);
      return NextResponse.json({ ok: true, demo: true });
    }

    const res = await db("menu", {
      method: "PATCH",
      q: `id=eq.${id}`,
      body: { tersedia: badan.tersedia },
    });
    if (!res.ok) return NextResponse.json({ pesan: res.pesan }, { status: 400 });

    await db("log_perubahan", {
      method: "POST",
      body: {
        siapa: badan.oleh ?? "internal",
        aksi: badan.tersedia ? "menu_tersedia" : "menu_habis",
        entitas: "menu",
        entitas_id: String(id),
        sebelum: { tersedia: !badan.tersedia },
        sesudah: { tersedia: badan.tersedia },
      },
    });

    return NextResponse.json({ ok: true });
  }

  /*
    Reset store demo. HANYA ada di mode demo dan hanya untuk pengujian:
    tanpa ini setiap jalankan uji mewarisi sisa keadaan (menu yang sudah
    ditandai habis, pesanan lama) sehingga kegagalan berikutnya tidak bisa
    dibaca — persis yang terjadi saat mengerjakan K-08/D-07.
    Tidak tersedia saat kunci server terpasang, jadi tidak bisa menghapus
    data sungguhan.
  */
  /*
    BAYAR TUNAI DI KASIR (keputusan pemilik: tetap diizinkan).

    Kasir dan dapur hanya menerima pesanan yang LUNAS. Karena itu tunai
    tidak "melewati" aturan — ia menandai lunas dengan cara lain. Setelah
    aksi ini, pesanan muncul di daftar aktif kasir dan tiket dapur.

    Bisa dimatikan pemilik lewat `pengaturan` → `bayar_tunai_kasir = off`.
  */
  if (badan.aksi === "bayar_tunai") {
    if (!punyaKunciServer()) {
      return NextResponse.json(
        {
          pesan:
            "Kunci server belum dipasang, pembayaran tunai tidak bisa dicatat.",
          demo: true,
        },
        { status: 503 }
      );
    }

    const pesananId = Number(badan.pesanan_id);
    if (!Number.isFinite(pesananId) || pesananId <= 0) {
      return NextResponse.json({ pesan: "Pesanan tidak sah." }, { status: 400 });
    }
    if (!(await bolehBayarTunai())) {
      return NextResponse.json(
        { pesan: "Bayar tunai sedang dimatikan. Aktifkan di pengaturan." },
        { status: 403 }
      );
    }

    const uangPas = badan.uang_pas === true;
    const diterima = uangPas ? 0 : Math.round(Number(badan.diterima));
    if (!uangPas && (!Number.isFinite(diterima) || diterima < 0)) {
      return NextResponse.json({ pesan: "Nominal tidak sah." }, { status: 400 });
    }

    const hasil = await bayarTunaiKasir({
      pesanan_id: pesananId,
      diterima,
      uang_pas: uangPas,
      kasir: String(badan.oleh ?? "kasir").slice(0, 40),
    });
    if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: 400 });

    return NextResponse.json({ ok: true, ...hasil.data });
  }

  if (badan.aksi === "reset_demo") {
    /*
      Menghapus penandaan "habis" yang tersimpan di memori Worker.
      Tidak menyentuh database sama sekali.
    */
    demoReset();
    return NextResponse.json({ ok: true, demo: true });
  }

  return NextResponse.json({ pesan: "Aksi tidak dikenal." }, { status: 400 });
}
