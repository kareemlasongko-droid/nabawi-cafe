/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["*.e2b.app"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
