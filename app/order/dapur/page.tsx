import type { Metadata } from "next";
import { PortalDapur } from "../../components/order/PortalDapur";

export const metadata: Metadata = {
  title: "Dapur & Bar — Nabawi Cafe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HalamanDapur({
  searchParams,
}: {
  searchParams: Promise<{ layar?: string | string[] }>;
}) {
  const params = await searchParams;
  return <PortalDapur layarAwal={params.layar === "menu" ? "menu" : "antrean"} />;
}
