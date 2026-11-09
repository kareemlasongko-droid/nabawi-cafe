/**
 * PATCH /api/order/status — memindahkan status pesanan.
 *
 * Dipakai kasir (terima/tolak), dapur (proses/siap), pelayan (diantar).
 * Aturan transisi ada di data.ts (transisiSah): status hanya boleh maju
 * satu langkah, dan pesanan yang sudah selesai tidak bisa diubah lagi.
 */
import { NextResponse } from "next/server";
import { ubahStatus } from "@/app/lib/order/data";
import { PUNYA_KUNCI_SERVER } from "@/app/lib/order/db";
import { demoUbahStatus } from "@/app/lib/order/demo";
import type { StatusPesanan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

const SAH: StatusPesanan[] = [
  "menunggu_konfirmasi",
  "diterima",
  "diproses",
  "siap",
  "diantar",
  "ditolak",
  "dibatalkan",
];

export async function PATCH(req: Request) {
  let badan: { id?: number; ke?: string; alasan?: string; oleh?: string };
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  const id = Number(badan.id);
  const ke = badan.ke as StatusPesanan;

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ pesan: "Nomor pesanan tidak sah." }, { status: 400 });
  }
  if (!SAH.includes(ke)) {
    return NextResponse.json({ pesan: "Status tujuan tidak dikenal." }, { status: 400 });
  }
  // Menolak WAJIB beralasan (K-02).
  if (ke === "ditolak" && !String(badan.alasan ?? "").trim()) {
    return NextResponse.json(
      { pesan: "Penolakan wajib memilih alasan." },
      { status: 400 }
    );
  }

  if (!PUNYA_KUNCI_SERVER) {
    const hasil = demoUbahStatus(id, ke, badan.alasan);
    if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: 400 });
    return NextResponse.json({ ok: true, pesanan: hasil.pesanan, demo: true });
  }

  const hasil = await ubahStatus(id, ke, {
    alasan: badan.alasan,
    oleh: badan.oleh ?? "internal",
  });
  if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: 400 });

  return NextResponse.json({ ok: true, pesanan: hasil.data });
}
