/**
 * /order/invoice/:id?sesi=… — invoice untuk PELANGGAN.
 *
 * ── KENAPA HALAMAN SENDIRI, BUKAN MODAL ───────────────────────────────
 *
 * Invoice adalah dokumen yang disimpan orang. Modal di dalam portal
 * pelanggan hilang saat halaman dimuat ulang, tidak bisa di-bookmark, dan
 * tidak bisa dikirim ke WhatsApp — padahal justru itu yang dilakukan tamu
 * yang mempersoalkan tagihan.
 *
 * Halaman ini juga satu-satunya tempat yang bisa dicetak dari ponsel
 * tanpa ikut mencetak menu dan keranjang.
 *
 * `sesi` WAJIB. Ia datang dari tautan yang dibuat portal pelanggan, dan
 * tanpa itu route menolak (lihat app/api/order/invoice/[id]/route.ts).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ambilInvoice } from "@/app/lib/order/invoice";
import { LembarInvoice } from "@/app/components/order/LembarInvoice";

export const metadata: Metadata = {
  title: "Invoice — Nabawi Cafe & Resto",
  // Invoice memuat nomor WhatsApp. Jangan pernah diindeks.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HalamanInvoice({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sesi?: string }>;
}) {
  const { id: idMentah } = await params;
  const { sesi } = await searchParams;

  const id = Number(idMentah);
  if (!Number.isFinite(id) || id <= 0) {
    return <LayarPesan judul="Invoice tidak ditemukan" isi="Alamat invoice tidak sah." />;
  }

  if (!sesi) {
    return (
      <LayarPesan
        judul="Buka invoice dari halaman pesanan"
        isi={
          "Invoice memuat nomor WhatsApp Anda, jadi tautannya memakai sesi perangkat " +
          "yang memesan. Buka dari halaman pesanan Anda, lalu tekan \"Lihat invoice\"."
        }
      />
    );
  }

  const hasil = await ambilInvoice(id, { sesi });

  if (!hasil.ok) {
    return (
      <LayarPesan
        judul={hasil.status === 403 ? "Invoice ini bukan milik Anda" : "Invoice tidak bisa dibuka"}
        isi={hasil.pesan}
      />
    );
  }

  return (
    <main className="min-h-dvh bg-bersih-100 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-sm">
        <div className="mb-3 flex items-center justify-between print:hidden">
          <Link
            href={`/order?meja=${encodeURIComponent(hasil.data.meja)}`}
            className="text-[0.8125rem] font-bold text-forest-700 underline"
          >
            ← Kembali ke pesanan
          </Link>
        </div>

        <div className="rounded-[0.875rem] bg-bersih-0 shadow-[0_1px_2px_rgba(22,19,15,0.04),0_6px_16px_-10px_rgba(22,19,15,0.16)] print:shadow-none">
          <LembarInvoice invoice={hasil.data} dalamModal={false} />
        </div>

        <p className="mt-3 pb-2 text-center text-[0.6875rem] leading-snug text-tinta-500 print:hidden">
          Simpan halaman ini atau tekan &ldquo;Cetak / PDF&rdquo; untuk arsip Anda.
        </p>
      </div>
    </main>
  );
}

function LayarPesan({ judul, isi }: { judul: string; isi: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bersih-100 px-4">
      <div className="w-full max-w-sm rounded-[0.875rem] bg-bersih-0 p-5 text-center">
        <h1 className="text-[1.0625rem] font-extrabold text-tinta-900">{judul}</h1>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-tinta-500">{isi}</p>
        <Link
          href="/order"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-[0.625rem] bg-tinta-900 px-4 text-[0.875rem] font-extrabold text-bersih-0"
        >
          Ke halaman pesanan
        </Link>
      </div>
    </main>
  );
}
