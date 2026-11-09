import type { Metadata } from "next";
import { PortalPelayan } from "../../components/order/PortalPelayan";

export const metadata: Metadata = {
  title: "Pelayan — Nabawi Cafe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function HalamanPelayan() {
  return <PortalPelayan />;
}
