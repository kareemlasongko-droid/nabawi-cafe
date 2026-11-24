/**
 * GET /api/order/kategori — daftar kategori menu (publik, baca saja).
 *
 * Kenapa endpoint terpisah: portal kasir hanya mengirim `menu` (id, nama,
 * harga, kategori_id), bukan nama kategorinya. Uji `uji:saring` perlu nama
 * kategori, dan sesudah salinan menu di kode dihapus, tidak ada lagi sumber
 * lokal untuk mengambilnya.
 *
 * Satu-satunya sumber yang benar adalah database — sama seperti halaman
 * admin membacanya lewat `ambilMenu()`.
 */
import { NextResponse } from "next/server";
import { ambilMenu } from "@/app/lib/order/data";
import { PESAN_ENV_KOSONG, punyaEnvBaca } from "@/app/lib/order/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!punyaEnvBaca()) {
    return NextResponse.json({ pesan: PESAN_ENV_KOSONG, kategori: [] }, { status: 503 });
  }

  const res = await ambilMenu();
  if (!res.ok) {
    return NextResponse.json({ pesan: res.pesan, kategori: [] }, { status: 503 });
  }

  return NextResponse.json(
    res.data.kategori.map((k) => ({ id: k.id, nama: k.nama, urutan: k.urutan })),
  );
}
