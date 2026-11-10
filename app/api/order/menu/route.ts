/**
 * /api/order/menu — kelola menu (admin).
 *
 * POST  : tambah menu
 * PATCH : ubah nama/harga/ketersediaan/kategori/pilihan
 *
 * Catatan penting: perubahan harga TIDAK mengubah tagihan yang sudah
 * terbuka, karena item_pesanan menyimpan harga_satuan saat dipesan
 * (PRD bagian 11: "harga satuan dicatat ulang pada setiap item").
 *
 * Endpoint ini menolak semua penulisan kalau kunci server belum dipasang.
 * Halaman admin tetap terbuka untuk dilihat, tetapi tidak bisa menyimpan.
 */
import { NextResponse } from "next/server";
import { PUNYA_KUNCI_SERVER } from "@/app/lib/order/db";
import { simpanMenu, tambahMenu } from "@/app/lib/order/menu-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!PUNYA_KUNCI_SERVER) {
    return NextResponse.json(
      { pesan: "Kunci server database belum dipasang, jadi menu tidak bisa disimpan." },
      { status: 503 }
    );
  }
  let b: unknown;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }
  const hasil = await tambahMenu(b);
  if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: 400 });
  return NextResponse.json({ ok: true, data: hasil.data });
}

export async function PATCH(req: Request) {
  if (!PUNYA_KUNCI_SERVER) {
    return NextResponse.json(
      { pesan: "Kunci server database belum dipasang, jadi menu tidak bisa diubah." },
      { status: 503 }
    );
  }
  let b: unknown;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }
  const id = Number((b as { id?: unknown })?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ pesan: "Menu tidak sah." }, { status: 400 });
  }
  const hasil = await simpanMenu(id, b);
  if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: 400 });
  return NextResponse.json({ ok: true, data: hasil.data });
}
