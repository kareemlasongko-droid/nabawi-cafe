/**
 * GET /api/order/riwayat — ringkasan penjualan hari ini + riwayat pesanan.
 *
 * Dipakai DUA portal: kasir dan admin. Satu endpoint, karena keduanya
 * menanyakan hal yang sama dan dua endpoint berarti dua tempat yang bisa
 * berbeda perilaku — laporan kasir dan laporan pemilik yang tidak cocok
 * adalah masalah yang jauh lebih mahal daripada satu endpoint bersama.
 *
 * ── KENAPA TANPA PAGINASI ─────────────────────────────────────────────
 *
 * Batasnya 40 pesanan terakhir, dan itu memang yang dibutuhkan kedua
 * portal: kasir menjawab "pesanan tadi bagaimana", admin memeriksa hari
 * ini. Untuk laporan bulanan, tabel `tagihan` adalah sumbernya — bukan
 * layar operasional. Menambahkan paginasi di sini berarti menambahkan
 * kontrol yang tidak dipakai siapa pun dan bisa salah ditekan.
 */
import { NextResponse } from "next/server";
import { PESAN_ENV_KOSONG, punyaEnvBaca } from "@/app/lib/order/db";
import { riwayatPesanan, ringkasanHariIni } from "@/app/lib/order/riwayat";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!punyaEnvBaca()) {
    return NextResponse.json({ pesan: PESAN_ENV_KOSONG, kode: "env" }, { status: 503 });
  }

  const url = new URL(req.url);
  const mentah = Number(url.searchParams.get("batas"));
  const batas = Number.isFinite(mentah) && mentah > 0 ? Math.min(mentah, 200) : 40;

  const [ringkasan, riwayat] = await Promise.all([ringkasanHariIni(), riwayatPesanan(batas)]);

  /*
    Ringkasan dan riwayat dibalas bersama meski salah satunya gagal.
    Menolak keduanya karena satu bagian rusak berarti kasir kehilangan
    daftar pesanan hanya karena angka omzet tidak bisa dihitung.
  */
  if (!ringkasan.ok && !riwayat.ok) {
    return NextResponse.json(
      { pesan: ringkasan.pesan || riwayat.pesan },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ringkasan: ringkasan.ok ? ringkasan.data : null,
    pesan_ringkasan: ringkasan.ok ? "" : ringkasan.pesan,
    riwayat: riwayat.ok ? riwayat.data : [],
    pesan_riwayat: riwayat.ok ? "" : riwayat.pesan,
  });
}
