/** @type {import('next').NextConfig} */
const nextConfig = {
  // Origin yang diizinkan mengakses resource dev (HMR, dev overlay).
  // Tanpa ini dev server memblokir request lintas-origin dan browser
  // memakai bundle basi (penyebab halaman tidak ikut berubah).
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.e2b.app",
    "*.e2b.dev",
    "*.arena.ai",
    "*.arena.app",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    /*
      Foto menu akan diunggah ke Supabase Storage, bukan ke /public.
      next/image MENOLAK host yang tidak terdaftar (dan sebelumnya
      halaman /menu memakai <img> mentah supaya tidak perlu ini).
      Pola `*.supabase.co` mencakup URL project sekarang maupun project
      baru bila Supabase dipindah — tanpa membuka host sembarang.
    */
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/**" },
    ],
  },
};

export default nextConfig;

/*
  Integrasi adapter Cloudflare untuk `next dev` saja.

  Kenapa di sini, bukan di berkas terpisah: adapter butuh titik masuk
  yang dieksekusi SETIAP kali Next membaca konfigurasi. Utilitas ini
  membuat `next dev` bisa menyediakan binding Cloudflare (termasuk
  `IMAGES`) secara lokal dan menyamakan perilakunya dengan Workers.

  Kenapa `.then()` dengan catch, bukan `await` di tingkat atas:
  `next dev`, `next build`, dan `next start` semuanya memuat berkas ini.
  Kalau adapter gagal dimuat (mis. paket belum terpasang di mesin
  seseorang), yang boleh terjadi hanyalah "tidak ada binding lokal" —
  BUKAN "aplikasi tidak bisa dijalankan". Kegagalan itu tidak boleh
  menjatuhkan dev server, apalagi build produksi.

  Catatan: `opennextjs-cloudflare build` TIDAK memakai jalur ini; ia
  menjalankan `next build` lalu membungkus keluarannya sendiri.
*/
import("@opennextjs/cloudflare")
  .then((m) => m.initOpenNextCloudflareForDev())
  .catch(() => {
    /* Adapter tidak tersedia — next dev/start tetap jalan tanpa binding. */
  });
