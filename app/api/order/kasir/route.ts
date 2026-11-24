/**
 * /api/order/kasir — data untuk portal kasir.
 *
 * GET  : pesanan aktif + meja + tagihan terbuka + panggilan.
 *        Semuanya dalam SATU permintaan. Kalau dipecah, tablet kasir
 *        melakukan 4 permintaan tiap 4 detik dan itu pemborosan di
 *        jaringan cafe yang tidak selalu kuat.
 * POST : aksi kecil (menangani panggilan).
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
import type { Meja, Panggilan, Pesanan, Tagihan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = await statusModeContoh(punyaKunciServer());

  /*
    MEJA, MENU, TAGIHAN, PESANAN — SEMUA DARI DATABASE.

    Dulu, tanpa kunci server blok ini mengembalikan meja, tagihan, pesanan,
    dan panggilan karangan dari `demo.ts`, bercampur dengan menu ASLI dari
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

  const [pesananRes, mejaRes, tagihanRes, panggilanRes, aturan, menuRes, menungguRes] =
    await Promise.all([
    ambilPesananAktif(),
    db<Meja[]>("meja", { q: "select=*&order=nomor.asc" }),
    db<Tagihan[]>("tagihan", { q: "select=*&status=neq.lunas&order=dibuka_at.asc" }),
    db<Panggilan[]>("panggilan", { q: "select=*&ditangani_at=is.null&order=dibuat_at.asc" }),
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

  const petaTagihan = new Map(tagihanRes.data.map((t) => [t.meja_id, t]));
  const petaNomor = new Map(mejaRes.data.map((m) => [m.id, m.nomor]));

  /*
    Item untuk tiap tagihan terbuka. Diambil paralel dan hanya untuk meja
    yang punya tagihan — biasanya 2–5 meja, bukan 20. Tanpa ini struk
    kosong: setelah lunas pesanan keluar dari daftar aktif, jadi itemnya
    tidak bisa lagi dicari dari /api/order/kasir.
  */
  const mejaTagihan = mejaRes.data.filter((m) => petaTagihan.has(m.id));
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
  const menunggu = (menungguRes.ok ? menungguRes.data : []).map((p) => ({
    ...p,
    meja_nomor: petaNomorMeja.get(p.meja_id) ?? String(p.meja_id),
  }));

  return NextResponse.json({
    pesanan: pesananRes.data,
    menunggu_bayar: menunggu,
    meja: mejaRes.data.map((m) => ({
      ...m,
      tagihan: petaTagihan.get(m.id) ?? null,
      items_tagihan: petaItem.get(m.id) ?? [],
    })),
    panggilan: (panggilanRes.ok ? panggilanRes.data : []).map((g) => ({
      ...g,
      meja_nomor: petaNomor.get(g.meja_id) ?? "",
    })),
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

  if (badan.aksi === "tangani_panggilan") {
    const id = Number(badan.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ pesan: "Panggilan tidak sah." }, { status: 400 });
    }

    if (!punyaKunciServer()) {
      /*
        Menandai panggilan "ditangani" HARUS mengubah database, karena
        panggilan itu sendiri dibaca dari database. Dulu di sini statusnya
        diubah di memori: pelayan melihat kartu panggilan hilang dari
        layarnya, padahal panggilan sungguhan masih terbuka untuk semua
        perangkat lain.
      */
      return NextResponse.json(
        { pesan: "Kunci server belum dipasang, panggilan tidak bisa ditandai ditangani." },
        { status: 503 }
      );
    }

    const res = await db("panggilan", {
      method: "PATCH",
      q: `id=eq.${id}`,
      body: { ditangani_at: new Date().toISOString() },
    });
    if (!res.ok) return NextResponse.json({ pesan: res.pesan }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ pesan: "Aksi tidak dikenal." }, { status: 400 });
}
