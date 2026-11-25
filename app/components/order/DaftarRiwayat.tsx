"use client";

/**
 * Riwayat pesanan — dipakai KASIR dan ADMIN.
 *
 * Satu komponen untuk dua portal, karena yang berubah antar keduanya hanya
 * lebar kolom, bukan isinya. Kalau ditulis dua kali, salah satunya akan
 * lupa tombol invoice atau lupa menandai pesanan yang belum lunas.
 *
 * ── SETIAP BARIS PUNYA INVOICE ────────────────────────────────────────
 *
 * Termasuk pesanan yang sudah lama. Invoice menempel pada pesanannya, bukan
 * pada momen pembayaran — tamu yang kembali dua hari kemudian dengan
 * keluhan tetap bisa ditunjukkan dokumennya.
 *
 * Tombol invoice TIDAK dinonaktifkan untuk pesanan yang belum lunas:
 * justru di situ kasir butuh rinciannya untuk menagih.
 */

import { useMemo, useState } from "react";
import { rupiah } from "@/app/lib/order/tipe";
import { waktuInvoice } from "@/app/lib/order/invoice";
import type { BarisRiwayat } from "@/app/lib/order/riwayat";
import { BukaInvoice } from "./LembarInvoice";

/** Label singkat untuk status pembayaran. */
const LABEL_BAYAR: Record<string, string> = {
  lunas: "Lunas",
  menunggu: "Belum dibayar",
  kedaluwarsa: "Kedaluwarsa",
  gagal: "Gagal",
  dikembalikan: "Dikembalikan",
};

const LABEL_STATUS: Record<string, string> = {
  menunggu_konfirmasi: "Menunggu kasir",
  diterima: "Diterima",
  diproses: "Diproses",
  siap: "Siap",
  diantar: "Diantar",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
};

const WARNA_BAYAR: Record<string, string> = {
  lunas: "bg-daun-100 text-forest-700",
  menunggu: "bg-tanah-100 text-clay-800",
};

export function DaftarRiwayat({
  riwayat,
  galat,
  /** Batas baris yang ditampilkan sebelum "lihat semua" ditekan. */
  awal = 12,
}: {
  riwayat: BarisRiwayat[];
  galat?: string;
  awal?: number;
}) {
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [semua, setSemua] = useState(false);
  const [cari, setCari] = useState("");

  /*
    Pencarian mencocokkan NOMOR pesanan dan NAMA tamu. Dua hal itu yang
    disebut tamu di depan kasir ("pesanan saya yang tadi, atas nama Budi"
    atau "nomor saya M1-1924-25") — mencari berdasarkan menu tidak pernah
    dilakukan sesiapa pun di meja kasir.
  */
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return riwayat;
    return riwayat.filter(
      (r) => r.nomor.toLowerCase().includes(q) || (r.nama_pemesan ?? "").toLowerCase().includes(q),
    );
  }, [riwayat, cari]);

  const tampil = semua ? tersaring : tersaring.slice(0, awal);

  if (galat) {
    return (
      <div className="rounded-[0.625rem] border border-clay-700/25 bg-tanah-100 px-3 py-2">
        <p className="text-[0.8125rem] leading-snug text-clay-800">{galat}</p>
      </div>
    );
  }

  if (riwayat.length === 0) {
    return (
      <div className="rounded-[0.875rem] border border-dashed border-bersih-200 bg-bersih-100 px-4 py-8 text-center">
        <p className="text-[0.9375rem] font-semibold text-tinta-500">Belum ada pesanan.</p>
        <p className="mt-1 text-[0.8125rem] text-tinta-500">
          Pesanan yang masuk akan muncul di sini, termasuk yang belum dibayar.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 flex h-10 items-center gap-2 rounded-[0.625rem] border border-bersih-200 bg-bersih-0 px-3">
        <span className="sr-only">Cari nomor pesanan atau nama tamu</span>
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nomor pesanan atau nama tamu"
          inputMode="search"
          className="w-full bg-transparent text-[0.8125rem] text-tinta-900 outline-none placeholder:text-tinta-500/70"
        />
        {cari && (
          <button
            type="button"
            onClick={() => setCari("")}
            className="shrink-0 text-[0.6875rem] font-bold text-tinta-500"
          >
            Hapus
          </button>
        )}
      </label>

      {tersaring.length === 0 ? (
        <div className="rounded-[0.625rem] border border-dashed border-bersih-200 bg-bersih-100 px-3 py-6 text-center">
          <p className="text-[0.8125rem] text-tinta-500">
            Tidak ada pesanan yang cocok dengan &ldquo;{cari}&rdquo;.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-bersih-200 overflow-hidden rounded-[0.875rem] border border-bersih-200 bg-bersih-0">
            {tampil.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate text-[0.8125rem] font-extrabold text-tinta-900">
                      Meja {r.meja}
                      {r.nama_pemesan ? ` · ${r.nama_pemesan}` : ""}
                    </p>
                    {/*
                      Pesanan tanpa tagihan (data lama) diberi tanda pisah,
                      bukan "Rp0". Rp0 terbaca seperti pesanan gratis.
                    */}
                    <span className="shrink-0 text-[0.8125rem] font-bold tabular-nums text-tinta-900">
                      {r.total > 0 ? rupiah(r.total) : "—"}
                    </span>
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-[0.6875rem] text-tinta-500">{r.nomor}</span>
                    <span className="text-[0.6875rem] text-tinta-500">
                      {waktuInvoice(r.dibayar_at ?? r.dibuat_at)}
                    </span>
                    <span className="text-[0.6875rem] text-tinta-500">{r.total_item} item</span>
                    <span
                      className={[
                        "rounded-[0.25rem] px-1 py-px text-[0.5625rem] font-extrabold uppercase tracking-wider",
                        WARNA_BAYAR[r.status_bayar] ?? "bg-bersih-100 text-tinta-700",
                      ].join(" ")}
                    >
                      {LABEL_BAYAR[r.status_bayar] ?? r.status_bayar}
                    </span>
                    <span className="text-[0.6875rem] text-tinta-500">
                      {LABEL_STATUS[r.status] ?? r.status}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInvoiceId(r.id)}
                  className="h-9 shrink-0 rounded-[0.5rem] border border-forest-700/40 px-2.5 text-[0.75rem] font-bold text-forest-700"
                >
                  Invoice
                </button>
              </li>
            ))}
          </ul>

          {!semua && tersaring.length > awal && (
            <button
              type="button"
              onClick={() => setSemua(true)}
              className="mt-2 h-10 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-0 text-[0.8125rem] font-bold text-tinta-900"
            >
              Lihat semua ({tersaring.length})
            </button>
          )}
        </>
      )}

      {invoiceId !== null && (
        <BukaInvoice pesananId={invoiceId} onTutup={() => setInvoiceId(null)} />
      )}
    </div>
  );
}
