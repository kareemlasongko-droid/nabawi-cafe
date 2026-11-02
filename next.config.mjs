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
  },
};

export default nextConfig;
