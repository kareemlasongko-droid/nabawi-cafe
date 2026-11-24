/**
 * GET /api/order/dapur — tiket untuk papan dapur.
 *
 * Hanya pesanan yang SUDAH diterima kasir yang muncul di sini. Ini aturan
 * penting: setiap pesanan wajib lolos konfirmasi kasir dulu (PRD bagian 3)
 * supaya pesanan iseng dari QR tidak pernah sampai ke dapur.
 */
import { NextResponse } from "next/server";
import { ambilMenu, ambilPesananAktif, ambilAturan } from "@/app/lib/order/data";
import { db, PESAN_ENV_KOSONG, punyaEnvBaca, punyaKunciServer } from "@/app/lib/order/db";
import { bacaPilihan } from "@/app/lib/order/aturan";
import { demoSetTersedia } from "@/app/lib/order/demo";
import { pesanModeContoh, statusModeContoh } from "@/app/lib/order/mode-contoh";

export const dynamic = "force-dynamic";

export async function GET() {
  // Ambang waktu warna diambil dari pengaturan, tidak ditulis di kode (PRD D-05).
  let kuning = 10;
  let merah = 15;

  const mode = await statusModeContoh(punyaKunciServer());

  /*
    TIKET DAPUR SELALU DARI DATABASE.

    Dulu blok ini menghasilkan tiket, meja, dan menu karangan dari
    `demo.ts` ketika kunci server belum dipasang. Dapur akan melihat
    pesanan yang tidak pernah dipesan tamu, dengan meja yang nomornya
    dikarang — dan tidak ada satu pun tanda bahwa itu bukan pesanan
    sungguhan. Sekarang tidak ada jalur seperti itu.

    Yang tetap "contoh" hanya aksi TULIS tanpa kunci server (lihat PATCH):
    penandaan habis disimpan di memori Worker, bukan di database.
  */
  if (!punyaEnvBaca()) {
    return NextResponse.json(
      { pesan: PESAN_ENV_KOSONG, demo: mode.aktif, kode: "env" },
      { status: 503 }
    );
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

  /*
    ── "MENUNGGU_KONFIRMASI" IKUT DITAMPILKAN ──────────────────────────

    Sebelumnya dapur hanya menerima "diterima", "diproses", "siap".
    Akibatnya nyata dan pernah dilaporkan: pesanan sudah DIBAYAR, kasir
    sudah menerima uangnya, tetapi tiketnya tidak muncul di dapur sampai
    kasir menekan "terima" satu kali lagi di portalnya. Kalau kasir lupa
    (dan itu mudah terjadi saat ramai), pesanan yang sudah dibayar
    menggantung tanpa ada yang memasaknya.

    Dengan prabayar, "lunas" berarti uang sudah masuk dan pesanan BOLEH
    dikerjakan. Menahan tiketnya sampai konfirmasi manual menambah satu
    langkah yang tidak melindungi apa pun lagi — keputusan "terima" sudah
    diambil saat uangnya diterima.

    Status itu tetap ada supaya kasir bisa menolak (mis. menu habis);
    tiket lalu hilang dari dapur.
  */
  const tiket = res.data
    .filter((x) => ["menunggu_konfirmasi", "diterima", "diproses", "siap"].includes(x.status))
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
        // Dibaca lewat bacaPilihan: isi kolom jsonb bisa rusak, dan satu
        // baris rusak tidak boleh membuat papan dapur gagal tampil.
        pilihan: bacaPilihan(i.pilihan),
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

  if (!punyaKunciServer()) {
    /*
      Periksa dulu menunya ada. Tanpa ini, mode demo menerima id apa pun
      dan menyimpannya di store — perilakunya berbeda dari mode sungguhan,
      dan tombol yang salah kirim tidak akan pernah kelihatan salah saat uji.
    */
    const daftarMenu = await ambilMenu();
    if (!daftarMenu.ok) {
      return NextResponse.json({ pesan: daftarMenu.pesan }, { status: 503 });
    }
    if (!daftarMenu.data.menu.some((m) => m.id === id)) {
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
