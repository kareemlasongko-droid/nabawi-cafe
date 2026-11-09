/**
 * GET /api/order/dapur — tiket untuk papan dapur.
 *
 * Hanya pesanan yang SUDAH diterima kasir yang muncul di sini. Ini aturan
 * penting: setiap pesanan wajib lolos konfirmasi kasir dulu (PRD bagian 3)
 * supaya pesanan iseng dari QR tidak pernah sampai ke dapur.
 */
import { NextResponse } from "next/server";
import { ambilPesananAktif, ambilAturan } from "@/app/lib/order/data";
import { db, PUNYA_KUNCI_SERVER } from "@/app/lib/order/db";
import { demoAmbilPesanan, demoItemPesanan, demoMeja } from "@/app/lib/order/demo";

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
    return NextResponse.json({ tiket, ambang: { kuning, merah }, demo: true });
  }

  const [res, aturan] = await Promise.all([ambilPesananAktif(), ambilAturan()]);
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
    pajak: aturan.pajakPersen,
    demo: false,
  });
}
