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
  type BarisStruk,
} from "@/app/lib/order/data";
import { db, PUNYA_KUNCI_SERVER } from "@/app/lib/order/db";
import {
  demoMeja,
  demoPanggilanSemua,
  demoTagihan,
  demoAmbilPesanan,
  demoItemPesanan,
  demoItemTagihan,
  demoMenuDenganStatus,
  demoReset,
  demoSetTersedia,
  MENU_CONTOH,
} from "@/app/lib/order/demo";
import { ATURAN_BAWAAN } from "@/app/lib/order/aturan";
import type { Meja, Panggilan, Tagihan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!PUNYA_KUNCI_SERVER) {
    /*
      Menu dibaca dari database walau sedang mode demo. Menu memang publik
      (policy SELECT terbuka), jadi tidak butuh kunci server. Yang tidak
      bisa dilakukan tanpa kunci adalah MENYIMPAN pesanan.

      Ini penting: kalau di sini dipakai MENU_CONTOH, kasir melihat 14 menu
      karangan sementara tamu melihat 126 menu asli — dan tombol "tandai
      habis" akan menandai menu yang tidak pernah ada.
    */
    const menuAsli = await ambilMenu();
    const meja = demoMeja().map((m) => ({
      ...m,
      tagihan: demoTagihan().find((t) => t.meja_id === m.id && t.status !== "lunas") ?? null,
    }));
    const pesanan = demoAmbilPesanan().filter((p) =>
      ["menunggu_konfirmasi", "diterima", "diproses", "siap"].includes(p.status)
    );
    const panggilan = demoPanggilanSemua().filter((g) => !g.ditangani_at);

    return NextResponse.json({
      pesanan: pesanan.map((p) => ({
        ...p,
        meja_nomor: meja.find((m) => m.id === p.meja_id)?.nomor ?? String(p.meja_id),
        items: demoItemPesanan(p.id),
      })),
      // Item tiap tagihan dikirim bersama data meja: struk (K-10) butuh
      // daftar item SETELAH lunas, saat pesanannya sudah tidak aktif lagi.
      meja: meja.map((m) => ({
        ...m,
        items_tagihan: m.tagihan ? demoItemTagihan(m.id) : [],
      })),
      panggilan: panggilan.map((g) => ({
        ...g,
        meja_nomor: meja.find((m) => m.id === g.meja_id)?.nomor ?? "",
      })),
      // Tarif ikut dikirim: struk mencetak "PPN 11%" dan "Layanan 2.000".
      // Angka ini tidak boleh ditulis di komponen, karena pemilik bisa
      // mengubahnya di pengaturan tanpa menyentuh kode.
      // Menu ikut dikirim: kasir harus bisa menandai habis tanpa membuka
      // halaman lain (K-08). Membaca menu memang publik; yang dibatasi
      // hanya penulisannya.
      menu: demoMenuDenganStatus(menuAsli.ok ? menuAsli.data.menu : MENU_CONTOH.menu),
      aturan: ATURAN_BAWAAN,
      demo: true,
    });
  }

  const [pesananRes, mejaRes, tagihanRes, panggilanRes, aturan, menuRes] = await Promise.all([
    ambilPesananAktif(),
    db<Meja[]>("meja", { q: "select=*&order=nomor.asc" }),
    db<Tagihan[]>("tagihan", { q: "select=*&status=neq.lunas&order=dibuka_at.asc" }),
    db<Panggilan[]>("panggilan", { q: "select=*&ditangani_at=is.null&order=dibuat_at.asc" }),
    ambilAturan(),
    ambilMenu(),
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

  return NextResponse.json({
    pesanan: pesananRes.data,
    meja: mejaRes.data.map((m) => ({
      ...m,
      tagihan: petaTagihan.get(m.id) ?? null,
      items_tagihan: petaItem.get(m.id) ?? [],
    })),
    panggilan: (panggilanRes.ok ? panggilanRes.data : []).map((g) => ({
      ...g,
      meja_nomor: petaNomor.get(g.meja_id) ?? "",
    })),
    menu: menuRes.ok ? menuRes.data.menu : [],
    aturan,
    demo: false,
  });
}

export async function POST(req: Request) {
  let badan: {
    aksi?: string;
    id?: number;
    menu_id?: number;
    tersedia?: boolean;
    oleh?: string;
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

    if (!PUNYA_KUNCI_SERVER) {
      const daftar = await ambilMenu();
      const menuSah = daftar.ok ? daftar.data.menu : MENU_CONTOH.menu;
      if (!menuSah.some((m) => m.id === id)) {
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
  if (badan.aksi === "reset_demo") {
    if (PUNYA_KUNCI_SERVER) {
      return NextResponse.json({ pesan: "Aksi tidak dikenal." }, { status: 400 });
    }
    demoReset();
    return NextResponse.json({ ok: true, demo: true });
  }

  if (badan.aksi === "tangani_panggilan") {
    const id = Number(badan.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ pesan: "Panggilan tidak sah." }, { status: 400 });
    }

    if (!PUNYA_KUNCI_SERVER) {
      const g = demoPanggilanSemua().find((x) => x.id === id);
      if (g) g.ditangani_at = new Date().toISOString();
      return NextResponse.json({ ok: true, demo: true });
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
