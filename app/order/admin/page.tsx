import type { Metadata } from "next";
import { PortalAdmin } from "../../components/order/PortalAdmin";
import { ambilAturan, ambilMenu } from "../../lib/order/data";
import { PUNYA_KUNCI_SERVER } from "../../lib/order/db";
import { MENU_CONTOH } from "../../lib/order/demo";

export const metadata: Metadata = {
  title: "Admin menu — Nabawi Cafe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Admin: kelola menu, harga, ketersediaan, dan pajak (PRD bagian 2).
 *
 * Halaman ini SENGAJA server-rendered: data menu dibaca di server, lalu
 * diserahkan ke komponen klien untuk diedit. Kalau admin membaca menu
 * langsung dari browser, kunci database harus ada di klien — dan itu
 * berarti siapa pun bisa mengubah harga.
 */
export default async function HalamanAdmin() {
  const [menuRes, aturan] = await Promise.all([ambilMenu(), ambilAturan()]);
  // Sumber menu disamakan dengan halaman pelanggan: database bila terbaca,
  // MENU_CONTOH hanya sebagai cadangan di mode demo.
  const data = menuRes.ok ? menuRes.data : MENU_CONTOH;

  return (
    <PortalAdmin
      awal={data}
      aturanAwal={aturan}
      bisaUbah={PUNYA_KUNCI_SERVER}
      galatAwal={menuRes.ok ? "" : menuRes.pesan}
    />
  );
}
