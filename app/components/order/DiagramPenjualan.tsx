"use client";

/**
 * Diagram penjualan hari ini untuk panel Laporan kasir.
 *
 * ── KENAPA TANPA PUSTAKA GRAFIK ───────────────────────────────────────
 *
 * Dua diagram ini batang dan donat sederhana. Pustaka grafik menambah
 * 40–90 KB JavaScript yang harus diunduh tablet kasir setiap muat
 * halaman — untuk menggambar persegi panjang dan satu lingkaran.
 * Semuanya di sini CSS dan SVG biasa.
 *
 * ── YANG DIGAMBAR, DAN KENAPA HANYA ITU ───────────────────────────────
 *
 * 1. Omzet per jam. Pertanyaan yang benar-benar ditanyakan pemilik saat
 *    jam sibuk: "ramai jam berapa?" — untuk mengatur staf shift
 *    berikutnya. Sumbu Y-nya sengaja TIDAK berlabel: yang dibaca adalah
 *    bentuk lengkungnya, bukan angka per jam (angka itu ada di ujung
 *    batang, dan di tooltip).
 *
 * 2. Tunai vs non-tunai. Dipakai saat tutup laci: berapa uang fisik yang
 *    seharusnya ada. Tanpa diagram, kasir harus menjumlahkan sendiri
 *    baris-baris riwayat.
 *
 * ── SATU WARNA PER MAKNA ──────────────────────────────────────────────
 * Omzet selalu hutan (forest-800), tunai sela (oranye), non-tunai daun
 * (hijau muda). Warna yang berganti-ganti antar diagram membuat dua
 * gambar yang berbeda harus dipelajari ulang setiap kali.
 */

import { rupiah } from "@/app/lib/order/tipe";
import type { BarisRiwayat, RingkasanPenjualan } from "@/app/lib/order/riwayat";

/** Jam buka yang digambar. Di luar ini batangnya memang kosong. */
const JAM_AWAL = 8;
const JAM_AKHIR = 23;

/**
 * Jam WIB dari sebuah waktu ISO.
 *
 * Memakai `Intl` dengan zona tetap, BUKAN `getHours()`: itu memakai zona
 * perangkat. Tablet kasir yang jamnya masih UTC akan menggeser semua
 * batang tujuh jam — diagram yang salah lebih buruk daripada tidak ada
 * diagram, karena tetap terlihat meyakinkan.
 */
function jamWib(iso: string): number {
  const bagian = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return Number(bagian) % 24;
}

export function DiagramPenjualan({
  ringkasan,
  riwayat,
}: {
  ringkasan: RingkasanPenjualan | null;
  /** Baris hari ini; dipakai menghitung sebaran per jam dan per metode. */
  riwayat: BarisRiwayat[];
}) {
  /*
    Hanya pesanan LUNAS yang dihitung: pesanan yang belum dibayar bukan
    omzet. Baris tanpa `dibayar_at` dilewati — bukan dianggap jam 00.00,
    yang akan menumpuk semua batang di kolom pertama.
  */
  const lunas = riwayat.filter((b) => b.status_bayar === "lunas" && b.dibayar_at);

  const perJam = new Array(JAM_AKHIR - JAM_AWAL + 1).fill(0) as number[];
  for (const b of lunas) {
    const jam = jamWib(b.dibayar_at as string);
    if (jam >= JAM_AWAL && jam <= JAM_AKHIR) perJam[jam - JAM_AWAL] += b.total;
  }
  const puncak = Math.max(...perJam, 1);

  const tunai = ringkasan?.tunai ?? 0;
  const nontunai = ringkasan?.nontunai ?? 0;
  const totalMetode = tunai + nontunai;
  const persenTunai = totalMetode > 0 ? Math.round((tunai / totalMetode) * 100) : 0;

  const adaData = lunas.length > 0;

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
      {/* ── OMZET PER JAM ── */}
      <section
        aria-labelledby="diagram-jam"
        className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3 shadow-[0_1px_2px_rgb(22_19_15/0.04)]"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="diagram-jam" className="text-[0.8125rem] font-extrabold text-tinta-900">
            Omzet per jam
          </h3>
          <span className="text-[0.6875rem] font-semibold text-tinta-500">
            {JAM_AWAL}.00–{JAM_AKHIR}.00 WIB
          </span>
        </div>

        {!adaData ? (
          <p className="mt-3 rounded-[0.5rem] border border-dashed border-bersih-200 bg-bersih-100 px-3 py-6 text-center text-[0.75rem] text-tinta-500">
            Belum ada pembayaran hari ini. Diagram terisi begitu pesanan pertama lunas.
          </p>
        ) : (
          <>
            {/*
              Batang dibuat dengan `height: %` di dalam kolom flex setinggi
              120px. `min-height` 2px saat nol memberi garis dasar tipis —
              tanpa itu kolom kosong terlihat seperti ruang yang rusak,
              bukan seperti "jam ini belum ada penjualan".
            */}
            <div className="mt-3 flex h-[7.5rem] items-end gap-[3px]" role="img"
              aria-label={`Omzet per jam, puncak ${rupiah(puncak)}`}>
              {perJam.map((nilai, i) => {
                const tinggi = nilai > 0 ? Math.max(4, Math.round((nilai / puncak) * 100)) : 0;
                const jam = JAM_AWAL + i;
                return (
                  <div key={jam} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                    <div
                      title={`${String(jam).padStart(2, "0")}.00 · ${rupiah(nilai)}`}
                      style={{ height: `${tinggi}%` }}
                      className={[
                        "w-full rounded-t-[2px] transition-[height]",
                        nilai > 0 ? "bg-forest-800" : "min-h-[2px] bg-bersih-200",
                      ].join(" ")}
                    />
                  </div>
                );
              })}
            </div>

            {/* Sumbu X: hanya jam genap. 16 label di 300px akan bertumpuk. */}
            <div className="mt-1 flex justify-between text-[0.625rem] tabular-nums text-tinta-500">
              <span>{JAM_AWAL}.00</span>
              <span>12.00</span>
              <span>16.00</span>
              <span>20.00</span>
              <span>{JAM_AKHIR}.00</span>
            </div>

            <p className="mt-2 border-t border-bersih-200 pt-2 text-[0.6875rem] text-tinta-500">
              Puncak{" "}
              <strong className="font-extrabold tabular-nums text-forest-900">
                {rupiah(puncak)}
              </strong>{" "}
              pada pukul{" "}
              <strong className="font-extrabold tabular-nums text-forest-900">
                {String(JAM_AWAL + perJam.indexOf(puncak)).padStart(2, "0")}.00
              </strong>
            </p>
          </>
        )}
      </section>

      {/* ── TUNAI vs NON-TUNAI ── */}
      <section
        aria-labelledby="diagram-metode"
        className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3 shadow-[0_1px_2px_rgb(22_19_15/0.04)]"
      >
        <h3 id="diagram-metode" className="text-[0.8125rem] font-extrabold text-tinta-900">
          Metode bayar
        </h3>

        {totalMetode === 0 ? (
          <p className="mt-3 text-[0.75rem] leading-snug text-tinta-500">
            Belum ada pembayaran lunas hari ini.
          </p>
        ) : (
          <>
            {/*
              Batang bertumpuk, bukan donat. Alasannya sama seperti diagram
              jam: membedakan dua bagian dari satu batang lebih mudah
              daripada membandingkan dua potong lingkaran — dan batang ini
              tingginya 14px, tidak butuh ruang sebesar donat.
            */}
            <div
              className="mt-3 flex h-3.5 w-full overflow-hidden rounded-full bg-bersih-200"
              role="img"
              aria-label={`Tunai ${persenTunai}%, non-tunai ${100 - persenTunai}%`}
            >
              {tunai > 0 && (
                <div
                  className="h-full bg-sela-600"
                  style={{ width: `${(tunai / totalMetode) * 100}%` }}
                />
              )}
              {nontunai > 0 && (
                <div
                  className="h-full bg-forest-600"
                  style={{ width: `${(nontunai / totalMetode) * 100}%` }}
                />
              )}
            </div>

            <ul className="mt-3 space-y-2">
              <li className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-[0.1875rem] bg-sela-600" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[0.75rem] font-semibold text-tinta-700">Tunai</span>
                <span className="text-[0.8125rem] font-extrabold tabular-nums text-tinta-900">
                  {rupiah(tunai)}
                </span>
                <span className="w-9 text-right text-[0.6875rem] tabular-nums text-tinta-500">
                  {persenTunai}%
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-[0.1875rem] bg-forest-600" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[0.75rem] font-semibold text-tinta-700">Non-tunai</span>
                <span className="text-[0.8125rem] font-extrabold tabular-nums text-tinta-900">
                  {rupiah(nontunai)}
                </span>
                <span className="w-9 text-right text-[0.6875rem] tabular-nums text-tinta-500">
                  {100 - persenTunai}%
                </span>
              </li>
            </ul>

            <p className="mt-3 border-t border-bersih-200 pt-2 text-[0.6875rem] leading-snug text-tinta-500">
              Uang tunai di laci hari ini: <strong className="font-extrabold text-tinta-900">{rupiah(tunai)}</strong>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
