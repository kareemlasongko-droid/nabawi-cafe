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

/*
  Dua keadaan uang, dua warna — bukan tiga. Lunas memakai hijau daun (uang
  sudah masuk), menunggu memakai oranye kafe (uang belum masuk). Oranye di
  sini SENGAJA bukan merah: pesanan yang belum dibayar bukan kegagalan.
*/
const WARNA_BAYAR: Record<string, string> = {
  lunas: "bg-daun-100 text-forest-700",
  menunggu: "bg-sela-100 text-sela-800",
};

/**
 * Lima nomor halaman di sekitar halaman aktif.
 *
 * Selalu memuat halaman pertama dan terakhir, karena keduanya yang dicari
 * saat ingin melompat ("saya mau lihat transaksi paling awal"). Jendela di
 * tengah bergeser supaya halaman aktif tidak pernah jatuh di luar layar.
 */
function geserJendela(semua: number[], aktif: number): number[] {
  if (semua.length <= 5) return semua;
  let mulai = Math.max(0, aktif - 3);
  if (mulai + 5 > semua.length) mulai = semua.length - 5;
  return semua.slice(mulai, mulai + 5);
}

export function DaftarRiwayat({
  riwayat,
  galat,
  /** Jumlah baris per halaman. */
  awal = 12,
}: {
  riwayat: BarisRiwayat[];
  galat?: string;
  awal?: number;
}) {
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [halaman, setHalaman] = useState(1);
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

  /*
    ── HALAMAN, BUKAN "LIHAT SEMUA" ────────────────────────────────────

    Dulu tombol "Lihat semua (60)" menggulung SELURUH riwayat jadi satu
    kolom tak berujung. Di ponsel itu berarti menggulir ratusan baris untuk
    menemukan transaksi pagi, dan kasir kehilangan tempatnya begitu daftar
    dimuat ulang.

    Acuan desain admin memakai pola yang lebih lazim untuk tabel: sejumlah
    baris per halaman, keterangan "Menampilkan 1–10 dari 60", dan tombol
    nomor halaman. Pola itu yang dipakai sekarang, dan jarak antarhalaman
    tetap terlihat — sesuatu yang tidak bisa dilakukan oleh daftar panjang.

    Pindah halaman dikerjakan di memori: riwayat sudah termuat seluruhnya,
    jadi tidak ada permintaan jaringan dan tidak ada kedipan.
  */
  const jumlahHalaman = Math.max(1, Math.ceil(tersaring.length / awal));
  const halamanAman = Math.min(halaman, jumlahHalaman);
  const mulai = (halamanAman - 1) * awal;
  const tampil = tersaring.slice(mulai, mulai + awal);
  const nomorHalaman = Array.from({ length: jumlahHalaman }, (_, i) => i + 1);

  if (galat) {
    return (
      <div className="rounded-[0.625rem] border border-sela-200 bg-sela-50 px-3 py-2">
        <p className="text-[0.8125rem] leading-snug text-sela-800">{galat}</p>
      </div>
    );
  }

  if (riwayat.length === 0) {
    return (
      <div className="rounded-[0.875rem] border border-dashed border-bersih-300 bg-cream-100/50 px-4 py-8 text-center">
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
          onChange={(e) => {
              setCari(e.target.value);
              // Pencarian baru selalu mulai dari halaman 1: halaman 4 dari
              // hasil yang tinggal 2 baris adalah layar kosong.
              setHalaman(1);
            }}
          placeholder="Cari nomor pesanan atau nama tamu"
          inputMode="search"
          className="w-full bg-transparent text-[0.8125rem] text-tinta-900 outline-none placeholder:text-tinta-500/70"
        />
        {cari && (
          <button
            type="button"
            onClick={() => {
              setCari("");
              setHalaman(1);
            }}
            className="shrink-0 text-[0.6875rem] font-bold text-tinta-500"
          >
            Hapus
          </button>
        )}
      </label>

      {tersaring.length === 0 ? (
        <div className="rounded-[0.625rem] border border-dashed border-bersih-300 bg-cream-100/50 px-3 py-6 text-center">
          <p className="text-[0.8125rem] text-tinta-500">
            Tidak ada pesanan yang cocok dengan &ldquo;{cari}&rdquo;.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-bersih-200 overflow-hidden rounded-[0.875rem] border border-bersih-200 bg-bersih-0 shadow-[0_1px_2px_rgb(22_19_15/0.04),0_10px_24px_-18px_rgb(22_19_15/0.25)]">
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
                    <span className="shrink-0 text-[0.8125rem] font-bold tabular-nums text-forest-900">
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
                  className="tombol-tenang h-9 shrink-0 px-2.5 text-[0.75rem]"
                >
                  Invoice
                </button>
              </li>
            ))}
          </ul>

          {/*
            Keterangan jangkauan ditaruh SEBELUM tombol: mata membaca
            "Menampilkan 11–20 dari 37" lalu mencari tombol yang arahnya
            cocok. Tanpa keterangan itu, nomor halaman tidak berarti apa-apa
            saat hasil pencarian menyusut menjadi satu halaman.
          */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.75rem] tabular-nums text-tinta-500">
              Menampilkan{" "}
              <span className="font-bold text-tinta-900">
                {tersaring.length === 0 ? 0 : mulai + 1}–{Math.min(mulai + awal, tersaring.length)}
              </span>{" "}
              dari <span className="font-bold text-tinta-900">{tersaring.length}</span> data
            </p>

            {jumlahHalaman > 1 && (
              <nav aria-label="Halaman riwayat" className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHalaman(halamanAman - 1)}
                  disabled={halamanAman === 1}
                  aria-label="Halaman sebelumnya"
                  className="tombol-tenang size-9 p-0 text-[0.8125rem] disabled:opacity-35"
                >
                  ‹
                </button>

                {/*
                  Maksimal 5 nomor ditampilkan; selebihnya jendela ikut
                  halaman aktif. Puluhan tombol sekaligus lebih sulit
                  ditekan di ponsel daripada bergeser beberapa kali.
                */}
                {nomorHalaman.length <= 5
                  ? nomorHalaman.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setHalaman(n)}
                        aria-current={n === halamanAman ? "page" : undefined}
                        className={[
                          "size-9 rounded-[0.5rem] text-[0.8125rem] font-bold tabular-nums transition",
                          n === halamanAman
                            ? "bg-forest-900 text-cream-50"
                            : "bg-cream-100 text-tinta-700 hover:bg-cream-200",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    ))
                  : geserJendela(nomorHalaman, halamanAman).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setHalaman(n)}
                        aria-current={n === halamanAman ? "page" : undefined}
                        className={[
                          "size-9 rounded-[0.5rem] text-[0.8125rem] font-bold tabular-nums transition",
                          n === halamanAman
                            ? "bg-forest-900 text-cream-50"
                            : "bg-cream-100 text-tinta-700 hover:bg-cream-200",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    ))}

                <button
                  type="button"
                  onClick={() => setHalaman(halamanAman + 1)}
                  disabled={halamanAman === jumlahHalaman}
                  aria-label="Halaman berikutnya"
                  className="tombol-tenang size-9 p-0 text-[0.8125rem] disabled:opacity-35"
                >
                  ›
                </button>
              </nav>
            )}
          </div>
        </>
      )}

      {invoiceId !== null && (
        <BukaInvoice pesananId={invoiceId} onTutup={() => setInvoiceId(null)} />
      )}
    </div>
  );
}
