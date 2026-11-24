import type { Metadata } from "next";
import { PortalAdmin } from "../../components/order/PortalAdmin";
import { ambilAturan, ambilMenu } from "../../lib/order/data";
import { punyaKunciServer } from "../../lib/order/db";

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

  /*
    Admin TIDAK punya salinan menu sebagai cadangan.

    Dulu di sini dipakai MENU_CONTOH bila database gagal — dan itu paling
    berbahaya justru di halaman ini: admin akan mengubah harga di layar
    yang penuh menu karangan, menekan simpan, dan tidak ada yang berubah
    (karena yang disimpan tetap ke database yang sedang gagal).

    Halaman tetap terbuka; `galatAwal` membuat portal menampilkan masalahnya
    alih-alih deretan menu yang bisa "diedit" tanpa akibat.
  */
  const data = menuRes.ok ? menuRes.data : { kategori: [], menu: [] };

  return (
    <PortalAdmin
      awal={data}
      aturanAwal={aturan}
      bisaUbah={punyaKunciServer()}
      galatAwal={menuRes.ok ? "" : menuRes.pesan}
    />
  );
}
