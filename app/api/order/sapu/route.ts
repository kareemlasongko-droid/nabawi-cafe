/**
 * POST /api/order/sapu — batalkan pesanan yang lewat batas bayar.
 *
 * ── KENAPA ENDPOINT, BUKAN CRON CLOUDFLARE ───────────────────────────
 *
 * Rencana awal memakai `triggers.crons` per menit. Itu dibatalkan karena
 * tiga hal:
 *
 *   1. Cron Cloudflare TIDAK memanggil `fetch()`; ia memanggil event
 *      `scheduled`. Adapter OpenNext tidak menanganinya, jadi cron akan
 *      terdaftar di konfigurasi tetapi tidak melakukan apa pun — kegagalan
 *      yang senyap.
 *   2. Menanganinya berarti menambah titik masuk Worker sendiri, yang
 *      membungkus SELURUH aplikasi demi satu tugas kecil.
 *   3. Sandbox ini tidak bisa menguji cron.
 *
 * Yang dipakai: endpoint biasa yang dipanggil dari luar (GitHub Actions
 * berjadwal, atau layanan ping gratis). Sama seperti penyapu yang sudah
 * berjalan saat kasir membuka layarnya — satu fungsi, dua pemicu.
 *
 * ── PENGAMAN ────────────────────────────────────────────────────────
 *
 * Wajib `x-sapu-kunci` yang cocok dengan `SAPU_KUNCI`. Tanpa ini, siapa pun
 * bisa membatalkan pesanan tamu dengan satu permintaan POST — dan itu
 * tindakan yang tidak bisa dibatalkan.
 *
 * Kalau `SAPU_KUNCI` belum diisi, endpoint MENOLAK (503), bukan terbuka.
 * Default-terbuka pada endpoint destruktif adalah cara paling umum sebuah
 * sistem dilubangi tanpa disadari.
 */
import { NextResponse } from "next/server";
import { punyaKunciServer, PESAN_ENV_KOSONG } from "@/app/lib/order/db";
import { sapuKedaluwarsa } from "@/app/lib/order/data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const kunci = (process.env.SAPU_KUNCI ?? "").trim();

  if (!kunci) {
    return NextResponse.json(
      {
        pesan:
          "SAPU_KUNCI belum diisi, endpoint penyapu dimatikan. " +
          "Penyapu tetap berjalan saat portal kasir dibuka.",
      },
      { status: 503 }
    );
  }

  const kiriman = (req.headers.get("x-sapu-kunci") ?? "").trim();
  if (kiriman !== kunci) {
    return NextResponse.json({ pesan: "Kunci penyapu tidak cocok." }, { status: 401 });
  }

  if (!punyaKunciServer()) {
    return NextResponse.json({ pesan: PESAN_ENV_KOSONG }, { status: 503 });
  }

  const jumlah = await sapuKedaluwarsa();
  return NextResponse.json({ ok: true, dibatalkan: jumlah });
}

export async function GET() {
  return NextResponse.json(
    { pesan: "Endpoint ini hanya menerima POST dengan kunci penyapu." },
    { status: 405 }
  );
}
