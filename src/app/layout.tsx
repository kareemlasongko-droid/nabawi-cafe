import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Senja Rimba Cafe & Resort — Tur Virtual 360° & Reservasi Online",
    template: "%s · Senja Rimba",
  },
  description:
    "Jelajahi Senja Rimba Cafe & Resort lewat tur virtual 360°, lalu reservasi kamar, villa, meja cafe, dan aula secara online dengan konfirmasi pembayaran manual.",
};

export const viewport: Viewport = {
  themeColor: "#1a352c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
