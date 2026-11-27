import { saringMenuKasir } from "../../app/lib/order/filter-kasir.ts";

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

// ID mengikuti hasil query katalog produksi: Kopi=19, Non-Kopi=46.
const menu = [
  { id: 1, nama: "Americano Panas", kategori_id: 19, kategori: "Kopi" },
  { id: 2, nama: "Kopi Susu Nabawi", kategori_id: 19, kategori: "Kopi" },
  { id: 3, nama: "Matcha Latte Panas", kategori_id: 46, kategori: "Non-Kopi" },
  { id: 4, nama: "Chocolate Dingin", kategori_id: 46, kategori: "Non-Kopi" },
];

console.log("\n── Filter kategori menu kasir ──");
const kopi = saringMenuKasir(menu, { cari: "", kategoriId: 19 });
cek("chip Kopi hanya mengembalikan item kategori Kopi", kopi.map((m) => m.id).join(",") === "1,2");
cek("chip Kopi tidak ikut menampilkan Non-Kopi", kopi.every((m) => m.kategori_id === 19));
const nonKopi = saringMenuKasir(menu, { cari: "", kategoriId: 46 });
cek("chip Non-Kopi tetap mengembalikan item non-kopi", nonKopi.map((m) => m.id).join(",") === "3,4");
const cariKopi = saringMenuKasir(menu, { cari: "kopi", kategoriId: "semua" });
cek("kolom cari mencari nama item, bukan substring kategori", cariKopi.map((m) => m.id).join(",") === "2");
const gabung = saringMenuKasir(menu, { cari: "latte", kategoriId: 19 });
cek("kolom cari dan kategori terpilih diterapkan bersamaan", gabung.length === 0);
const semua = saringMenuKasir(menu, { cari: " ", kategoriId: "semua" });
cek("chip Semua menampilkan semua item saat pencarian kosong", semua.length === menu.length);

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
if (gagal) process.exit(1);
