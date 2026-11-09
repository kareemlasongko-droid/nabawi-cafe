import type { Metadata } from "next";
import { PortalKasir } from "../../components/order/PortalKasir";

export const metadata: Metadata = {
  title: "Kasir — Nabawi Cafe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function HalamanKasir() {
  return <PortalKasir />;
}
