"use client";

/**
 * Tab "Meja" di portal admin — daftar meja beserta QR-nya.
 *
 * ── KENAPA DI ADMIN, BUKAN DI KASIR ───────────────────────────────────
 *
 * Ini pekerjaan penyiapan, bukan pekerjaan jam sibuk: cetak QR sekali,
 * tempel di meja, selesai. Menaruhnya di portal kasir berarti kasir harus
 * melewati satu tab yang tidak ia pakai saat antrean panjang.
 *
 * ── ISI QR ────────────────────────────────────────────────────────────
 *
 * `…/order?meja=<nomor>` — tamu memindai, langsung mendarat di halaman
 * pesan untuk meja itu. Tanpa parameter, tamu harus memilih mejanya
 * sendiri, dan salah pilih berarti makanan diantar ke meja orang.
 *
 * ── ALAMAT DASAR ──────────────────────────────────────────────────────
 *
 * Diambil dari `window.location.origin` saat komponen berjalan, bukan dari
 * variabel lingkungan yang ditulis tangan. Alasannya praktis: alamat
 * production sudah pernah berubah (Vercel → Workers), dan QR yang
 * tercetak dengan alamat lama adalah kertas mati yang baru ketahuan
 * setelah ditempel di 20 meja.
 */

import { useEffect, useMemo, useState } from "react";
import type { Meja } from "@/app/lib/order/tipe";
import { GambarQr } from "./GambarQr";

export function TabMeja({ meja }: { meja: Meja[] }) {
  /**
   * Alamat dasar baru diketahui di browser.
   *
   * `null` pada render pertama (server tidak punya `window`), lalu diisi
   * efek. QR tidak digambar sebelum alamatnya ada — lebih baik kartu kosong
   * sekejap daripada QR yang isinya `undefined`.
   */
  const [dasar, setDasar] = useState<string | null>(null);

  useEffect(() => {
    setDasar(window.location.origin);
  }, []);

  const jumlah = meja.length;
  const perArea = useMemo(() => {
    const peta = new Map<string, Meja[]>();
    for (const m of meja) {
      const kunci = m.area?.trim() || "Tanpa area";
      peta.set(kunci, [...(peta.get(kunci) ?? []), m]);
    }
    return [...peta.entries()];
  }, [meja]);

  return (
    <section className="mx-auto max-w-[64rem] px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[1.0625rem] font-extrabold text-tinta-900">Meja &amp; QR</h2>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-tinta-500">
            {jumlah} meja. Tempel QR di meja — tamu memindai, lalu langsung memesan untuk meja itu.
          </p>
        </div>

        {/*
          Tombol cetak menyembunyikan dirinya sendiri saat dicetak
          (`print:hidden`) — kalau tidak, tombolnya ikut tercetak di setiap
          lembar dan tampak seperti bagian dari kartu meja.
        */}
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!dasar}
          className="tombol-utama h-10 px-4 text-[0.8125rem] disabled:opacity-40 print:hidden"
        >
          Cetak semua QR
        </button>
      </div>

      {/*
        Petunjuk cetak, bukan hiasan: tanpa `print-color-adjust`, latar
        kartu tidak tercetak dan QR tetap terbaca — tetapi tanpa penjelasan
        ini, admin akan mengira hasil cetaknya rusak.
      */}
      <p className="mb-4 rounded-[0.625rem] border border-bersih-200 bg-cream-50 px-3 py-2 text-[0.6875rem] leading-snug text-tinta-500 print:hidden">
        Menekan &ldquo;Cetak semua QR&rdquo; membuka dialog cetak. Pilih <strong>Save as PDF</strong>{" "}
        untuk menyimpan, atau cetak langsung ke kertas label. Satu meja satu kartu.
      </p>

      {jumlah === 0 ? (
        <div className="rounded-[0.875rem] border border-dashed border-bersih-300 bg-cream-100/60 px-4 py-10 text-center">
          <p className="text-[0.9375rem] font-semibold text-tinta-500">Belum ada meja.</p>
          <p className="mt-1 text-[0.8125rem] text-tinta-500">
            Tambahkan meja di database, lalu muat ulang halaman ini.
          </p>
        </div>
      ) : (
        perArea.map(([area, daftar]) => (
          <div key={area} className="mb-5">
            <h3 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-tinta-500">
              {area}
            </h3>

            {/*
              Grid 2 kolom di ponsel, 3–4 di layar lebar. Kartu berisi QR
              butuh lebar minimal ~150px agar QR tetap bisa dipindai dari
              kertas; kartu yang lebih sempit menghasilkan QR 21mm yang
              gagal dibaca kamera ponsel murah.
            */}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {daftar.map((m) => {
                const teks = dasar ? `${dasar}/order?meja=${encodeURIComponent(m.nomor)}` : "";
                return (
                  <li
                    key={m.id}
                    /* `break-inside-avoid`: kartu tidak boleh terpotong dua halaman. */
                    className="flex flex-col items-center rounded-[0.875rem] border border-bersih-200 bg-bersih-0 px-3 py-3 text-center shadow-[0_1px_2px_rgb(22_19_15/0.04)] break-inside-avoid print:border-bersih-300 print:shadow-none"
                  >
                    <p className="text-[1.0625rem] font-extrabold leading-none text-forest-900">
                      Meja {m.nomor}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-tinta-500">{m.area}</p>

                    <div className="my-2">
                      {dasar ? (
                        <GambarQr teks={teks} ukuran={132} label={`QR untuk meja ${m.nomor}`} />
                      ) : (
                        <div className="size-[132px] rounded-[0.5rem] bg-bersih-100" />
                      )}
                    </div>

                    <p className="text-[0.625rem] leading-tight text-tinta-500">
                      Pindai untuk memesan
                    </p>
                    <p className="mt-1 text-[0.625rem] text-tinta-500">
                      {m.kapasitas} kursi · {m.aktif ? "aktif" : "nonaktif"}
                    </p>

                    {/*
                      URL lengkap ditampilkan supaya admin bisa memeriksa
                      alamatnya SEBELUM mencetak 20 lembar. Kalau alamat
                      dasarnya salah, ini satu-satunya tempat yang
                      menunjukkannya.
                    */}
                    {teks && (
                      <p className="mt-1 w-full break-all font-mono text-[0.5625rem] leading-tight text-tinta-500/80 print:hidden">
                        {teks}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
