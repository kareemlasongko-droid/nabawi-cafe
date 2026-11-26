/**
 * Kerangka halaman order.
 *
 * KEPUTUSAN DESAIN — dan alasannya
 *
 * 1. TIDAK memakai ilustrasi latar seperti beranda. Alasannya bukan selera:
 *    portal pelanggan dibuka di meja dengan sinyal tidak selalu kuat (PRD
 *    bagian 4). Ilustrasi penuh layar 4,8 MB membuat halaman tidak muncul
 *    dalam 3 detik. Latar di sini warna solid + tekstur halus dari CSS.
 *
 * 2. Lebar maksimum 720px untuk portal pelanggan, 1280px untuk portal staf.
 *    Ini bukan "mobile-first" tanpa alasan: pelanggan memakai HP (≤430px),
 *    kasir dan dapur memakai tablet landscape. Memaksa kanvas 440px seperti
 *    beranda akan membuang separuh layar tablet dapur, padahal tiket harus
 *    terbaca dari 2 meter.
 *
 * 3. Palet tetap dari token situs (forest/cream/clay/ink) supaya terasa satu
 *    produk, tetapi bobotnya dibalik: di sini latar terang (cream) dan teks
 *    gelap, karena dibaca lama di bawah cahaya siang area terbuka. Beranda
 *    gelap karena hanya dilihat sekilas.
 */

import type { ReactNode } from "react";
import { LogoNabawi } from "./LogoNabawi";

export function Kerangka({
  children,
  lebar = "pelanggan",
  className = "",
}: {
  children: ReactNode;
  lebar?: "pelanggan" | "staf";
  className?: string;
}) {
  return (
    <div className="min-h-dvh bg-cream-50 text-tinta-900">
      <div
        className={[
          "mx-auto min-h-dvh w-full",
          lebar === "staf" ? "max-w-[80rem]" : "max-w-[45rem]",
          className,
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Bilah atas portal staf.
 *
 * Status koneksi ditempatkan di sini, bukan di pojok kecil, karena PRD
 * bagian 14 meminta tablet menampilkan penanda offline. Kasir harus tahu
 * saat pesanan tidak akan masuk SEBELUM pelanggan mengeluh.
 */
export function BilahStaf({
  judul,
  keterangan,
  kanan,
  demo,
  ringkasan,
  tanpaLogo = false,
}: {
  judul: string;
  keterangan?: string;
  kanan?: ReactNode;
  demo?: boolean;
  /**
   * Versi ringkas identitas untuk ponsel: nama layar yang lebih pendek
   * ("Admin menu" → "Admin") dan satu angka status ("126").
   *
   * Kenapa perlu: "Admin menu" (92px) + "Nabawi Cafe" (95px) + dua tab
   * (143px) = 330px dari 336px yang tersedia di layar 360px — tanpa sisa
   * untuk jarak, dan langsung meluber begitu ada satu tombol lagi.
   */
  ringkasan?: { layar?: string; keteranganPonsel?: string };
  /**
   * Sembunyikan logo, tampilkan hanya nama layar yang sedang dibuka.
   *
   * Dipakai portal yang SUDAH punya sidebar berlambang: dua logo dalam
   * satu layar terlihat seperti dua aplikasi yang ditempel, dan logo di
   * kepala mendorong judul layar keluar dari pandangan saat kasir
   * berpindah panel.
   *
   * Nama layar naik pangkat menggantikan merek: di portal bersidebar,
   * "di mana saya sekarang" lebih sering ditanyakan daripada "ini
   * aplikasi apa" — merek sudah terjawab oleh sidebar.
   */
  tanpaLogo?: boolean;
}) {
  return (
    /*
      Kepala staf berlatar hijau hutan, bukan putih.

      Portal ini dipakai bergantian dengan layar tamu di perangkat yang sama;
      sewaktu kasir membuka admin, satu-satunya penanda "ini layar staf"
      sebelumnya adalah judul kecil 13px. Bidang hijau selebar layar membuat
      pembeda itu terlihat dari sudut mata, tanpa membaca apa pun — dan itu
      yang mencegah admin mengedit menu dari layar yang dikira layar tamu.
    */
    <header className="sticky top-0 z-30 border-b border-forest-950/40 bg-forest-900 text-cream-50 shadow-[0_1px_0_rgb(255_255_255/0.06)_inset]">
      {/*
        DUA KELOMPOK, SATU BARIS: identitas menempel kiri, alat menempel
        kanan. `justify-between` yang mengatur jarak — bukan `flex-1` pada
        salah satu sisi, karena itu membuat kelompok kanan terdorong ke tepi
        hanya kalau sisi kiri kebetulan pendek.

        `flex-nowrap` disengaja: kepala yang membungkus ke baris kedua adalah
        persis hal yang diminta untuk dihindari.
      */}
      <div className="mx-auto flex max-w-[80rem] items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
        {/* ── KIRI: identitas kafe ── */}
        <div className="flex min-w-0 items-center">
          {tanpaLogo ? (
            /*
              Nama layar sebagai judul kepala, tanpa merek. Ukuran dan
              bobot disamakan dengan nama layar di `LogoNabawi` supaya
              kepala tidak berubah tinggi saat dipakai portal lain.
            */
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="cap min-w-0 truncate text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-cream-50/55">
                Nabawi Cafe
              </span>
              <span aria-hidden="true" className="text-cream-50/30">
                /
              </span>
              <h1 className="min-w-0 truncate text-[1.0625rem] font-extrabold leading-none text-gelap-isi">
                {judul}
              </h1>
              {keterangan && (
                <span className="hidden min-w-0 truncate text-[0.8125rem] font-semibold text-gelap-samar sm:inline">
                  {keterangan}
                </span>
              )}
            </div>
          ) : (
            <LogoNabawi
              tema="gelap"
              keterangan={keterangan}
              layar={ringkasan?.layar ?? judul}
              keteranganPonsel={ringkasan?.keteranganPonsel}
              ringkas={Boolean(ringkasan)}
            />
          )}
        </div>

        {/* ── KANAN: alat layar ── */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Mode demo dipindah ke sini dari baris kedua: pita penuh selebar
              layar dulu memakan 28px tinggi dan mendorong kepala jadi dua
              baris di ponsel. Di sini ia jadi chip kecil yang tetap terlihat
              tapi tidak lagi dihitung sebagai bagian kepala. */}
          {demo && (
            <span
              className="hidden rounded-full bg-sela-500/15 px-2.5 py-1 text-[0.6875rem] font-bold text-sela-200 sm:inline"
              title="Kunci server database belum dipasang, jadi pesanan dan pembayaran tidak bisa dicatat."
            >
              Mode demo
            </span>
          )}
          {kanan}
        </div>
      </div>
    </header>
  );
}

/*
  `PitaDemo` DIHAPUS.

  Komponen itu menjelaskan "pesanan tersimpan sementara lalu hilang saat
  server mulai ulang" — benar untuk penyimpanan di memori yang sekarang
  sudah tidak ada. Sesudah itu dibuang, tanpa kunci server tidak ada
  penyimpanan sama sekali: aksinya ditolak (503), bukan disimpan lalu
  hilang. Membiarkan kalimat lamanya berarti menjanjikan sesuatu yang
  tidak terjadi lagi.
*/
