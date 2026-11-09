/**
 * GET /api/order/dapur — tiket untuk papan dapur.
 *
 * Hanya pesanan yang SUDAH diterima kasir yang muncul di sini. Ini aturan
 * penting: setiap pesanan wajib lolos konfirmasi kasir dulu (PRD bagian 3)
 * supaya pesanan iseng dari QR tidak pernah sampai ke dapur.
 */
import { NextResponse } from "next/server";
import { ambilMenu, ambilPesananAktif, ambilAturan } from "@/app/lib/order/data";
import { db, PUNYA_KUNCI_SERVER } from "@/app/lib/order/db";
import {
  demoAmbilPesanan,
  demoItemPesanan,
  demoMeja,
  demoMenuDenganStatus,
  demoSetTersedia,
  MENU_CONTOH,
} from "@/app/lib/order/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  // Ambang waktu warna diambil dari pengaturan, tidak ditulis di kode (PRD D-05).
  let kuning = 10;
  let merah = 15;

  if (!PUNYA_KUNCI_SERVER) {
    const tiket = demoAmbilPesanan()
      .filter((p) => ["diterima", "diproses", "siap"].includes(p.status))
      .map((p) => ({
        ...p,
        meja_nomor: demoMeja().find((m) => m.id === p.meja_id)?.nomor ?? String(p.meja_id),
        items: demoItemPesanan(p.id).map((i) => ({
          id: i.id,
          nama_saat_pesan: i.nama_saat_pesan,
          jumlah: i.jumlah,
          catatan: i.catatan,
        })),
      }));
    return NextResponse.json({
      tiket,
      ambang: { kuning, merah },
      // D-07: dapur menandai bahan/menu habis langsung dari papan tiket.
      menu: demoMenuDenganStatus(MENU_CONTOH.menu),
      demo: true,
    });
  }

  const [res, aturan, menuRes] = await Promise.all([
    ambilPesananAktif(),
    ambilAturan(),
    ambilMenu(),
  ]);
  if (!res.ok) return NextResponse.json({ pesan: res.pesan }, { status: 500 });

  // Ambang dari tabel pengaturan.
  const p = await db<{ kunci: string; nilai: string }[]>("pengaturan", {
    q: "select=kunci,nilai&kunci=in.(tunggu_kuning_menit,tunggu_merah_menit)",
  });
  if (p.ok) {
    for (const x of p.data) {
      const v = Number(x.nilai);
      if (!Number.isFinite(v)) continue;
      if (x.kunci === "tunggu_kuning_menit") kuning = v;
      if (x.kunci === "tunggu_merah_menit") merah = v;
    }
  }

  const tiket = res.data
    .filter((x) => ["diterima", "diproses", "siap"].includes(x.status))
    .map((x) => ({
      id: x.id,
      nomor: x.nomor,
      meja_nomor: x.meja_nomor,
      nama_pemesan: x.nama_pemesan,
      status: x.status,
      created_at: x.created_at,
      items: x.items.map((i) => ({
        id: i.id,
        nama_saat_pesan: i.nama_saat_pesan,
        jumlah: i.jumlah,
        catatan: i.catatan,
      })),
    }));

  return NextResponse.json({
    tiket,
    ambang: { kuning, merah },
    menu: menuRes.ok ? menuRes.data.menu : [],
    pajak: aturan.pajakPersen,
    demo: false,
  });
}

/**
 * POST /api/order/dapur — D-07: dapur menandai menu/bahan habis.
 *
 * Kenapa dapur boleh, padahal PRD menaruh "tandai menu habis" di kasir
 * (K-08): yang tahu bahan habis lebih dulu adalah dapur, bukan kasir.
 * Kalau hanya kasir yang bisa menandai, dapur harus berteriak atau
 * berjalan ke depan — dan menu tetap tampil "ada" di portal pelanggan
 * selama jeda itu, sehingga tamu memesan sesuatu yang tidak bisa dibuat.
 *
 * Hasilnya langsung terlihat di portal pelanggan (lewat /api/order/menu/
 * tersedia) dan di portal kasir.
 */
export async function POST(req: Request) {
  let badan: { aksi?: string; menu_id?: number; tersedia?: boolean; oleh?: string };
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  if (badan.aksi !== "set_tersedia") {
    return NextResponse.json({ pesan: "Aksi tidak dikenal." }, { status: 400 });
  }

  const id = Number(badan.menu_id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ pesan: "Menu tidak sah." }, { status: 400 });
  }
  if (typeof badan.tersedia !== "boolean") {
    return NextResponse.json({ pesan: "Status ketersediaan tidak sah." }, { status: 400 });
  }

  if (!PUNYA_KUNCI_SERVER) {
    /*
      Periksa dulu menunya ada. Tanpa ini, mode demo menerima id apa pun
      dan menyimpannya di store — perilakunya berbeda dari mode sungguhan,
      dan tombol yang salah kirim tidak akan pernah kelihatan salah saat uji.
    */
    if (!MENU_CONTOH.menu.some((m) => m.id === id)) {
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

  // Log: saat tamu komplain menunya masih tampil, yang dicari adalah siapa
  // yang menandai dan kapan.
  await db("log_perubahan", {
    method: "POST",
    body: {
      siapa: badan.oleh ?? "dapur",
      aksi: badan.tersedia ? "menu_tersedia" : "menu_habis",
      entitas: "menu",
      entitas_id: String(id),
      sebelum: { tersedia: !badan.tersedia },
      sesudah: { tersedia: badan.tersedia },
    },
  });

  return NextResponse.json({ ok: true });
}
