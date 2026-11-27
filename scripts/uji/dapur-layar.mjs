import { readFileSync } from "node:fs";
import { aksiTiketDapur, TAHAP_DAPUR, tiketPadaTahap } from "../../app/lib/order/tahap-dapur.ts";
import { saringMenuDapur } from "../../app/lib/order/filter-menu-dapur.ts";

let lulus = 0;
let gagal = 0;
const cek = (nama, kondisi, rincian = "") => {
  if (kondisi) {
    lulus++;
    console.log(`  LULUS  ${nama}${rincian ? ` — ${rincian}` : ""}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}${rincian ? ` — ${rincian}` : ""}`);
  }
};

const tiket = [
  { id: 1, status: "menunggu_konfirmasi" },
  { id: 2, status: "diterima" },
  { id: 3, status: "diproses" },
  { id: 4, status: "siap" },
  { id: 5, status: "diantar" },
];
const perTahap = TAHAP_DAPUR.map((tahap) => tiketPadaTahap(tiket, tahap));

console.log("\n── Papan dapur: tiga tahap pada satu layar ──");
cek("papan memiliki tepat tiga tahap", TAHAP_DAPUR.length === 3);
cek("pesanan lunas yang menunggu konfirmasi masuk tahap Baru", perTahap[0].some((t) => t.id === 1));
cek("pesanan diterima kasir masuk tahap Baru", perTahap[0].some((t) => t.id === 2));
cek("tahap Baru mengeluarkan tiket sekali saja", perTahap[0].length === 2);
cek(
  "status menunggu_konfirmasi maju satu langkah ke diterima",
  aksiTiketDapur("menunggu_konfirmasi", TAHAP_DAPUR[0]).ke === "diterima",
);
cek(
  "status menunggu_konfirmasi diberi aksi Terima",
  aksiTiketDapur("menunggu_konfirmasi", TAHAP_DAPUR[0]).label === "Terima",
);
cek("tahap Diproses menampilkan status diproses", perTahap[1].map((t) => t.id).join(",") === "3");
cek("tahap Siap menampilkan status siap", perTahap[2].map((t) => t.id).join(",") === "4");
cek("tiket yang sudah diantar tidak tampil lagi", perTahap.flat().every((t) => t.id !== 5));

const ui = readFileSync(new URL("../../app/components/order/PortalDapur.tsx", import.meta.url), "utf8");
cek("sidebar dapur memakai dua tujuan saja", /kunci: "antrean"[\s\S]*kunci: "menu"/.test(ui));
cek("tiga tahap dirender bersama sebagai grid, bukan tab", ui.includes("TAHAP_DAPUR.map") && !ui.includes("tabAktif"));
cek("halaman Menu punya aksi pulihkan ketersediaan", ui.includes("Aktifkan tersedia") && ui.includes("setTersedia(m.id, !m.tersedia)"));
cek("menu dapur punya pilihan filter kategori", ui.includes("Filter kategori menu") && ui.includes("kategoriTerpakai.map"));
cek("menu dapur punya thumbnail kategori persegi sementara", ui.includes("aspect-square size-16") && ui.includes("IkonKategoriMenu"));

const contohMenu = [
  { nama: "Kopi Susu", kategori_id: 3 },
  { nama: "Kopi Hitam", kategori_id: 3 },
  { nama: "Roti Bakar", kategori_id: 2 },
  { nama: "Menu Khusus", kategori_id: null },
  { nama: "Menu Kategori Baru", kategori_id: 8 },
];
const kategoriValid = new Set([2, 3]);
cek(
  "filter dapur memilih kategori berdasarkan ID tepat",
  saringMenuDapur(contohMenu, { cari: "", kategoriId: 3, kategoriValid }).map((m) => m.nama).join(",") === "Kopi Susu,Kopi Hitam",
);
cek(
  "filter dapur menggabungkan pencarian nama dengan kategori",
  saringMenuDapur(contohMenu, { cari: "HITAM", kategoriId: 3, kategoriValid }).map((m) => m.nama).join(",") === "Kopi Hitam",
);
cek(
  "filter dapur memasukkan menu tanpa kategori dan kategori yatim ke Lainnya",
  saringMenuDapur(contohMenu, { cari: "", kategoriId: "lainnya", kategoriValid }).length === 2,
);
cek("ikon antrean dapur berbeda dari ikon Menu", ui.includes("Ikon: IkonAntrian") && ui.includes("Ikon: IkonMenu"));

const api = readFileSync(new URL("../../app/api/order/dapur/route.ts", import.meta.url), "utf8");
cek("API dapur mengirim data kategori", api.includes("kategori: menuRes.ok ? menuRes.data.kategori : []"));

const sidebar = readFileSync(new URL("../../app/components/order/Sidebar.tsx", import.meta.url), "utf8");
cek(
  "ikon lipat sidebar tetap ikon, bukan logo saat tertutup",
  sidebar.includes("terbuka || !onToggle") &&
    !sidebar.includes('LogoNabawi tema="gelap" ukuran={26}') &&
    sidebar.includes("M17 8.5 20.5 12 17 15.5"),
);

const kartuProduk = readFileSync(new URL("../../app/components/order/KartuProduk.tsx", import.meta.url), "utf8");
const portalPelanggan = readFileSync(new URL("../../app/components/order/PortalPelanggan.tsx", import.meta.url), "utf8");
const halamanMenu = readFileSync(new URL("../../app/menu/page.tsx", import.meta.url), "utf8");
cek("gambar menu kasir memakai placeholder 1:1", kartuProduk.includes("aspect-square") && !kartuProduk.includes("foto_url ?"));
cek("gambar menu pelanggan memakai placeholder 1:1", portalPelanggan.includes("aspect-square") && !portalPelanggan.includes("m.foto_url ?"));
cek("gambar katalog memakai placeholder 1:1", halamanMenu.includes("aspect-square") && !halamanMenu.includes("m.foto_url ?"));

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
if (gagal) process.exit(1);
