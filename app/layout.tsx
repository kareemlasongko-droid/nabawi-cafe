import type { Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./globals.css";

export const metadata = {
  title: "Nabawi Cafe and Resto — Nature escape riverside view & play",
  description:
    "Cafe and Resto berkonsep Maroko. Nature escape riverside view & play. Buka setiap hari 09.00 – 21.00.",
  applicationName: "Nabawi Cafe and Resto",
  openGraph: {
    title: "Nabawi Cafe and Resto",
    description:
      "Cafe and Resto berkonsep Maroko — Nature escape riverside view & play.",
    type: "website",
    locale: "id_ID",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14231a",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
