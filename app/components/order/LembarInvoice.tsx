"use client";

/**
 * Tampilan invoice — dipakai kasir DAN pelanggan.
 *
 * ── SATU KOMPONEN, BUKAN DUA ───────────────────────────────────────────
 *
 * Dua salinan tampilan invoice akan menyimpang: kasir menambah baris
 * "kasir: Rani", pelanggan tidak; lalu tamu membawa pulang invoice yang
 * tidak cocok dengan yang dipegang kasir saat mempersoalkan tagihan.
 *
 * ── CETAK ─────────────────────────────────────────────────────────────
 *
 * `window.print()` pada modal biasa akan mencetak SELURUH halaman kasir —
 * antrean, denah meja, tombol — di atas kertas struk 8 cm. Yang dipakai di
 * sini: saat tombol cetak ditekan, `body` diberi kelas `mencetak-invoice`,
 * dan `app/globals.css` menyembunyikan segalanya kecuali elemen
 * `data-invoice`. Kelasnya dilepas setelah dialog cetak ditutup.
 *
 * Pendekatan ini dipilih daripada membuka jendela baru (`window.open` +
 * `document.write`) karena:
 *   · pemblokir popup mematikan jendela baru tanpa gejala;
 *   · jendela baru kehilangan CSS Tailwind, jadi hasil cetaknya berbeda
 *     dari yang dilihat di layar;
 *   · di portal pelanggan, jendela baru membuka jalan bagi tab nyasar di
 *     ponsel tamu.
 */

import { useCallback, useEffect, useState } from "react";
import { rupiah } from "@/app/lib/order/tipe";
import { labelMetode, waktuInvoice, type Invoice } from "@/app/lib/order/invoice";
import { LogoNabawi } from "./LogoNabawi";

/**
 * Alamat yang tercetak di invoice.
 *
 * Sengaja hanya wilayah: alamat lengkap Nabawi belum ada di repo maupun
 * PRD. JANGAN mengarang nomor rumah pada dokumen yang diserahkan ke tamu —
 * alamat salah di invoice lebih buruk daripada alamat umum.
 */
const ALAMAT = "Jakarta · Nabawi Cafe & Resto";

/**
 * Buka invoice untuk satu pesanan, lalu tampilkan sebagai modal.
 *
 * ── KENAPA PENGAMBILANNYA DI SINI ─────────────────────────────────────
 *
 * Kasir dan admin sama-sama perlu membuka invoice dari daftar riwayat.
 * Kalau masing-masing menulis `fetch` sendiri, dua hal akan menyimpang:
 * penanganan galat, dan cara menutup modalnya. Lebih buruk lagi, salah
 * satunya akan lupa bahwa `/api/order/invoice/:id` memakai `?kunci=1` dan
 * mengirim `?sesi=` yang tidak ada — invoice lalu menjawab 400 dan
 * tampak seperti "invoice hilang".
 *
 * `galat` ditampilkan sebagai modal terpisah, bukan diabaikan: invoice
 * yang gagal dibuka TIDAK boleh terlihat seperti "tidak ada invoice".
 */
export function BukaInvoice({
  pesananId,
  onTutup,
}: {
  pesananId: number;
  onTutup: () => void;
}) {
  const [isi, setIsi] = useState<{ invoice: Invoice } | { galat: string } | null>(null);

  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const res = await fetch(`/api/order/invoice/${pesananId}?kunci=1`, { cache: "no-store" });
        const j = (await res.json()) as { invoice?: Invoice; pesan?: string };
        if (!hidup) return;
        if (!res.ok || !j.invoice) {
          setIsi({ galat: j.pesan ?? "Invoice tidak bisa dibuka." });
          return;
        }
        setIsi({ invoice: j.invoice });
      } catch {
        if (hidup) setIsi({ galat: "Koneksi terputus. Invoice belum bisa dibuka." });
      }
    })();
    return () => {
      hidup = false;
    };
  }, [pesananId]);

  if (!isi) return <ModalTunggu />;
  if ("galat" in isi) return <ModalGalat pesan={isi.galat} onTutup={onTutup} />;
  return <LembarInvoice invoice={isi.invoice} onTutup={onTutup} />;
}

function ModalTunggu() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta-900/50 p-4 print:hidden">
      <div className="w-full max-w-xs rounded-[0.875rem] bg-bersih-0 p-5 text-center">
        <p className="text-[0.875rem] font-semibold text-tinta-500">Memuat invoice…</p>
      </div>
    </div>
  );
}

function ModalGalat({ pesan, onTutup }: { pesan: string; onTutup: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta-900/50 p-4">
      <div className="w-full max-w-xs rounded-[0.875rem] bg-bersih-0 p-4 text-center">
        <p className="text-[0.9375rem] font-extrabold text-tinta-900">Invoice gagal dibuka</p>
        <p className="mt-1 text-[0.8125rem] leading-snug text-tinta-500">{pesan}</p>
        <button
          type="button"
          onClick={onTutup}
          className="mt-3 h-10 w-full rounded-[0.625rem] bg-tinta-900 text-[0.8125rem] font-bold text-bersih-0"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

export function LembarInvoice({
  invoice,
  /** `true` untuk pratinjau di layar kasir; `false` untuk halaman pelanggan. */
  dalamModal = true,
  onTutup,
}: {
  invoice: Invoice;
  dalamModal?: boolean;
  onTutup?: () => void;
}) {
  /*
    Kelas `mencetak-invoice` harus DILEPAS setelah cetak, termasuk bila
    pengguna membatalkan dialog cetak. Tanpa `afterprint`, seluruh aplikasi
    tetap tersembunyi setelah satu kali menekan "Cetak" — dan gejalanya
    terlihat seperti aplikasi rusak.
  */
  const cetak = useCallback(() => {
    document.body.classList.add("mencetak-invoice");
    const lepas = () => {
      document.body.classList.remove("mencetak-invoice");
      window.removeEventListener("afterprint", lepas);
    };
    window.addEventListener("afterprint", lepas);
    window.print();
    // Safari tidak selalu mengirim `afterprint`; timer ini jaring pengaman.
    setTimeout(lepas, 3000);
  }, []);

  useEffect(() => {
    return () => document.body.classList.remove("mencetak-invoice");
  }, []);

  const lunas = invoice.status_bayar === "lunas";

  const isi = (
    <div
      data-invoice
      className="w-full max-w-sm bg-bersih-0 p-4 text-tinta-900 print:max-w-none print:p-0"
    >
      {/* ── Kepala ── */}
      <div className="border-b border-dashed border-bersih-200 pb-2.5 text-center">
        <div className="mb-1 flex justify-center">
          <LogoNabawi />
        </div>
        <p className="text-[0.9375rem] font-extrabold">Nabawi Cafe &amp; Resto</p>
        <p className="text-[0.6875rem] leading-tight text-tinta-500">{ALAMAT}</p>
      </div>

      {/* ── Identitas invoice ── */}
      <div className="mt-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-tinta-500">
            Invoice
          </p>
          <p className="font-mono text-[0.875rem] font-extrabold">{invoice.nomor}</p>
        </div>
        {/*
          Status ditulis sebagai STEMPEL, bukan baris teks. Invoice yang
          belum lunas harus langsung terbaca "BELUM DIBAYAR" saat
          dipegang — bukan sesuatu yang baru ketahuan setelah dibaca dua
          kali.
        */}
        <span
          className={[
            "rounded-[0.25rem] border px-2 py-1 text-[0.625rem] font-extrabold uppercase tracking-wider",
            lunas
              ? "border-forest-700/40 bg-daun-100 text-forest-700"
              : "border-clay-700/40 bg-tanah-100 text-clay-800",
          ].join(" ")}
        >
          {lunas ? "Lunas" : "Belum dibayar"}
        </span>
      </div>

      <div className="mt-2 space-y-0.5 font-mono text-[0.6875rem] text-tinta-700">
        <div className="flex justify-between gap-2">
          <span className="text-tinta-500">Waktu</span>
          <span className="text-right">{waktuInvoice(invoice.dibayar_at ?? invoice.dibuat_at)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-tinta-500">Meja</span>
          <span className="font-bold">{invoice.meja}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-tinta-500">Nama</span>
          <span className="text-right">{invoice.nama_pemesan || "—"}</span>
        </div>
        {invoice.no_wa && (
          <div className="flex justify-between gap-2">
            <span className="text-tinta-500">WhatsApp</span>
            <span className="text-right">{invoice.no_wa}</span>
          </div>
        )}
        {invoice.referensi_gerbang && (
          <div className="flex justify-between gap-2">
            <span className="text-tinta-500">Ref. DOKU</span>
            <span className="break-all text-right">{invoice.referensi_gerbang}</span>
          </div>
        )}
      </div>

      <div className="my-2 border-t border-dashed border-bersih-200" />

      {/* ── Item ── */}
      <ul className="space-y-1 font-mono text-[0.6875rem]">
        {invoice.items.length === 0 ? (
          <li className="text-tinta-500">Tidak ada item tercatat.</li>
        ) : (
          invoice.items.map((i, n) => (
            <li key={`${i.nama}-${i.harga_satuan}-${n}`}>
              <div className="flex justify-between gap-2">
                <span className="min-w-0 flex-1 break-words">
                  {i.jumlah}× {i.nama}
                </span>
                <span className="shrink-0 tabular-nums">{rupiah(i.harga_baris)}</span>
              </div>
              {i.pilihan.length > 0 && (
                <div className="pl-3 text-[0.625rem] font-bold uppercase tracking-wide text-tinta-700">
                  {i.pilihan.map((p) => p.nama).join(" · ")}
                </div>
              )}
              {/*
                Harga satuan hanya dicetak bila jumlahnya lebih dari satu —
                untuk satu item angkanya sama dengan harga baris dan hanya
                menambah baris yang harus dibaca.
              */}
              {i.jumlah > 1 && (
                <div className="pl-3 text-[0.625rem] text-tinta-500">@ {rupiah(i.harga_satuan)}</div>
              )}
            </li>
          ))
        )}
      </ul>

      <div className="my-2 border-t border-dashed border-bersih-200" />

      {/* ── Rincian biaya ── */}
      <dl className="space-y-1 font-mono text-[0.6875rem]">
        <div className="flex justify-between">
          <dt className="text-tinta-500">Subtotal</dt>
          <dd className="tabular-nums">{rupiah(invoice.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-tinta-500">Biaya layanan</dt>
          <dd className="tabular-nums">{rupiah(invoice.layanan)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-tinta-500">Pajak</dt>
          <dd className="tabular-nums">{rupiah(invoice.pajak)}</dd>
        </div>
        {invoice.pembulatan !== 0 && (
          <div className="flex justify-between">
            <dt className="text-tinta-500">Pembulatan</dt>
            {/*
              `rupiah(-20)` menghasilkan "Rp-20" — di dokumen yang dipegang
              tamu itu terbaca seperti salah ketik. Tanda minus ditaruh di
              depan "Rp" supaya jelas ini pengurangan, bukan nominal aneh.
            */}
            <dd className="tabular-nums">
              {invoice.pembulatan < 0
                ? `-${rupiah(Math.abs(invoice.pembulatan))}`
                : rupiah(invoice.pembulatan)}
            </dd>
          </div>
        )}
        <div className="flex items-end justify-between border-t border-bersih-200 pt-1">
          <dt className="font-bold">TOTAL</dt>
          <dd className="text-[0.9375rem] font-extrabold tabular-nums">{rupiah(invoice.total)}</dd>
        </div>
      </dl>

      <div className="my-2 border-t border-dashed border-bersih-200" />

      {/* ── Pembayaran ── */}
      <dl className="space-y-1 font-mono text-[0.6875rem]">
        <div className="flex justify-between gap-2">
          <dt className="text-tinta-500">Metode</dt>
          <dd className="text-right">{labelMetode(invoice.metode)}</dd>
        </div>
        {invoice.diterima !== null && (
          <div className="flex justify-between">
            <dt className="text-tinta-500">Diterima</dt>
            <dd className="tabular-nums">{rupiah(invoice.diterima)}</dd>
          </div>
        )}
        {invoice.kembalian !== null && invoice.kembalian > 0 && (
          <div className="flex justify-between">
            <dt className="text-tinta-500">Kembalian</dt>
            <dd className="tabular-nums">{rupiah(invoice.kembalian)}</dd>
          </div>
        )}
        {invoice.kasir && (
          <div className="flex justify-between gap-2">
            <dt className="text-tinta-500">Kasir</dt>
            <dd className="text-right">{invoice.kasir}</dd>
          </div>
        )}
      </dl>

      <p className="mt-3 border-t border-dashed border-bersih-200 pt-2 text-center text-[0.625rem] leading-snug text-tinta-500">
        {lunas
          ? "Terima kasih. Invoice ini bukti pembayaran yang sah."
          : "Invoice ini belum lunas. Pesanan diproses setelah pembayaran diterima."}
      </p>

      {/* ── Tombol (tidak ikut tercetak) ── */}
      <div className="mt-3 flex gap-2 print:hidden">
        <button
          type="button"
          onClick={cetak}
          className="h-10 flex-1 rounded-[0.625rem] border border-bersih-200 text-[0.8125rem] font-bold text-tinta-900"
        >
          Cetak / PDF
        </button>
        {onTutup && (
          <button
            type="button"
            onClick={onTutup}
            className="h-10 flex-1 rounded-[0.625rem] bg-tinta-900 text-[0.8125rem] font-bold text-bersih-0"
          >
            Tutup
          </button>
        )}
      </div>
    </div>
  );

  if (!dalamModal) return isi;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-tinta-900/50 p-4">
      <div className="my-auto w-full max-w-sm">{isi}</div>
    </div>
  );
}
