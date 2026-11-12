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
