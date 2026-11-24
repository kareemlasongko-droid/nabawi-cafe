/**
 * POST /api/order/doku/invoice — buat halaman pembayaran DOKU.
 *
 * Dipanggil portal pelanggan SETELAH pesanan tersimpan, bukan sebelumnya.
 * Urutannya penting:
 *
 *   1. pesanan disimpan (status_bayar = 'menunggu', ada kedaluwarsa_at)
 *   2. invoice dibuat atas tagihan pesanan itu
 *   3. tamu diarahkan ke halaman DOKU
 *
 * Kebalikannya — minta URL bayar dulu, baru simpan pesanan — berarti tamu
 * bisa membayar pesanan yang tidak pernah tercatat kalau langkah 1 gagal.
 *
 * Nominal TIDAK diterima dari browser. Diambil dari tagihan di database
 * lewat `buatInvoice()`.
 */
import { NextResponse } from "next/server";
import { db, punyaEnvBaca, punyaKunciServer, PESAN_ENV_KOSONG } from "@/app/lib/order/db";
import { buatInvoice, dokuSiap, PESAN_DOKU_KOSONG } from "@/app/lib/order/doku";
import type { Pesanan, Tagihan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!punyaEnvBaca() || !punyaKunciServer()) {
    return NextResponse.json({ pesan: PESAN_ENV_KOSONG }, { status: 503 });
  }

  let badan: { pesanan_id?: number; sesi?: string };
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  const id = Number(badan.pesanan_id);
  const sesi = String(badan.sesi ?? "").trim();
  if (!Number.isFinite(id) || id <= 0 || !sesi) {
    return NextResponse.json({ pesan: "Pesanan tidak sah." }, { status: 400 });
  }

  const res = await db<Pesanan[]>("pesanan", {
    q: `select=*&id=eq.${id}&limit=1`,
  });
  if (!res.ok) return NextResponse.json({ pesan: res.pesan }, { status: 503 });
  if (res.data.length === 0) {
    return NextResponse.json({ pesan: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  const pesanan = res.data[0];

  /*
    Sesi diperiksa, bukan sekedar dikirim.
    Tanpa ini, siapa pun yang menebak id pesanan bisa membuat tautan bayar
    untuk pesanan orang lain — dan melihat nominalnya.
  */
  if (pesanan.sesi_id !== sesi) {
    return NextResponse.json({ pesan: "Pesanan ini bukan milik perangkat Anda." }, { status: 403 });
  }

  if (pesanan.status_bayar === "lunas") {
    return NextResponse.json(
      { pesan: "Pesanan ini sudah dibayar.", sudahLunas: true },
      { status: 409 }
    );
  }
  if (pesanan.status_bayar !== "menunggu") {
    return NextResponse.json(
      { pesan: `Pesanan ini sudah ${pesanan.status_bayar} dan tidak bisa dibayar lagi.` },
      { status: 409 }
    );
  }
  if (pesanan.kedaluwarsa_at && new Date(pesanan.kedaluwarsa_at) < new Date()) {
    return NextResponse.json(
      { pesan: "Waktu pembayaran sudah habis. Silakan pesan ulang." },
      { status: 409 }
    );
  }
  if (!pesanan.tagihan_id) {
    return NextResponse.json({ pesan: "Pesanan ini tidak punya tagihan." }, { status: 409 });
  }

  if (!dokuSiap()) {
    return NextResponse.json(
      { pesan: PESAN_DOKU_KOSONG, bisaTunai: true },
      { status: 503 }
    );
  }

  const t = await db<Tagihan[]>("tagihan", {
    q: `select=*&id=eq.${pesanan.tagihan_id}&limit=1`,
  });
  if (!t.ok || t.data.length === 0) {
    return NextResponse.json({ pesan: "Tagihan tidak ditemukan." }, { status: 503 });
  }

  const origin = new URL(req.url).origin;
  const meja = await db<{ nomor: string }[]>("meja", {
    q: `select=nomor&id=eq.${pesanan.meja_id}&limit=1`,
  });

  const invoice = await buatInvoice({
    pesanan,
    tagihan: t.data[0],
    noWa: pesanan.no_wa ?? "",
    nama: pesanan.nama_pemesan ?? "Tamu Nabawi",
    kembaliKe: `/order?meja=${meja.ok && meja.data[0] ? meja.data[0].nomor : ""}`,
    origin,
  });

  if (!invoice.ok) {
    /*
      Gagal membuat invoice TIDAK menghapus pesanan. Pesanan tetap ada
      dengan status_bayar 'menunggu' dan akan kedaluwarsa sendiri; tamu
      masih bisa membayar tunai di kasir. Menghapusnya akan membuat tamu
      yang sudah mengisi data kehilangan pesanannya karena gangguan DOKU.
    */
    return NextResponse.json(
      { pesan: invoice.pesan, bisaTunai: true },
      { status: 502 }
    );
  }

  return NextResponse.json({
    url: invoice.url,
    invoice: invoice.invoice,
    total: t.data[0].total,
  });
}
