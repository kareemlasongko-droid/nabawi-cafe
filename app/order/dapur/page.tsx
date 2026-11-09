import type { Metadata } from "next";
import { PortalDapur } from "../../components/order/PortalDapur";

export const metadata: Metadata = {
  title: "Dapur & Bar — Nabawi Cafe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function HalamanDapur() {
  return <PortalDapur />;
}
