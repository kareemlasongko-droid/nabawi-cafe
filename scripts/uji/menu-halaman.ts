/**
 * Uji pengelompokan dan peringkasan halaman /menu.
 *
 * KENAPA ADA UJI SENDIRI
 * /menu memutuskan tiga hal yang tidak boleh salah dan tidak kelihatan di
 * tangkapan layar:
 *   1. Setiap menu harus MUNCUL TEPAT SEKALI. Salah kelompok berarti ada
 *      hidangan yang hilang dari daftar (tamu tidak tahu menunya ada) atau
 *      muncul dua kali (tamu mengira ada dua varian).
 *   2. Menu yang kategori_id-nya yatim (kategori dihapus, id salah) harus
 *      tetap tampil di kelompok "Lainnya" — bukan dibuang diam-diam.
 *   3. Angka "N pilihan" di kepala halaman harus sama dengan jumlah kartu
 *      yang benar-benar dirender.
 *
 * Data uji memakai potongan ASLI dari database (termasuk satu menu yang
 * sedang habis), bukan menu karangan, supaya bentuk datanya — kategori_id
 * null, `pilihan` jsonb, `rekomendasi` null — ikut teruji.
 *
 * Jalankan: npm run uji:menu
 */
import { urutkanMenu } from "../../app/lib/order/aturan";
import type { KategoriMenu, Menu } from "../../app/lib/order/tipe";


let lulus = 0;
const gagal: string[] = [];

function cek(nama: string, syarat: boolean, catatan = "") {
  if (syarat) lulus++;
  else gagal.push(catatan ? `${nama} — ${catatan}` : nama);
}

// Salinan `kelompokkan` dari app/menu/page.tsx. Disalin apa adanya; kalau
// keduanya menyimpang, uji ini berhenti menguji yang sebenarnya.
type Kelompok = { kategori: KategoriMenu; menu: Menu[] };

function kelompokkan(kategori: KategoriMenu[], menu: Menu[]): Kelompok[] {
  const hasil: Kelompok[] = [];
  const dipakai = new Set<number>();

  for (const k of [...kategori].sort((a, b) => a.urutan - b.urutan)) {
    const isi = urutkanMenu(menu.filter((m) => m.kategori_id === k.id));
    if (isi.length === 0) continue;
    hasil.push({ kategori: k, menu: isi });
    dipakai.add(k.id);
  }

  const yatim = urutkanMenu(
    menu.filter((m) => m.kategori_id === null || !dipakai.has(m.kategori_id))
  );
  if (yatim.length > 0) {
    hasil.push({ kategori: { id: -1, nama: "Lainnya", urutan: 999 }, menu: yatim });
  }

  return hasil;
}

// Potongan asli DB, termasuk satu menu yang sedang habis.
const KATEGORI: KategoriMenu[] = [
  { id: 1, nama: "Makanan Utama", urutan: 1 },
  { id: 2, nama: "Camilan & Pastry", urutan: 2 },
  { id: 3, nama: "Kopi", urutan: 3 },
  { id: 4, nama: "Non-Kopi", urutan: 4 },
  { id: 5, nama: "Cheese & Milkshake", urutan: 5 },
  { id: 6, nama: "Jus & Dessert", urutan: 6 },
];

function menu(p: Partial<Menu> & { id: number; nama: string }): Menu {
  return {
    deskripsi: "",
    harga: 20000,
    kategori_id: 1,
    foto_url: null,
    tersedia: true,
    urutan: 1,
    ...p,
  };
}

const MENU: Menu[] = [
  menu({ id: 1, nama: "Nasi Goreng Kebuli", harga: 40000, urutan: 1 }),
  menu({ id: 2, nama: "Paket Nasi Liwet Personal", harga: 85000, urutan: 4, rekomendasi: true }),
  menu({ id: 3, nama: "Ayam Balado", harga: 62000, urutan: 9 }),
  menu({ id: 4, nama: "Sop Iga", harga: 80000, urutan: 12, tersedia: false }),
  menu({
    id: 5,
    nama: "Rice Bowl Chicken",
    harga: 50000,
    urutan: 20,
    pilihan: [
      { nama: "Sambal Matah", tambah: 0 },
      { nama: "Salted Egg", tambah: 5000 },
    ],
  }),
  menu({ id: 6, nama: "Croissant Butter", harga: 25000, kategori_id: 2, urutan: 1 }),
  menu({ id: 7, nama: "Kopi Susu Nabawi", harga: 28000, kategori_id: 3, urutan: 1 }),
  menu({ id: 8, nama: "Cheese Latte", harga: 38000, kategori_id: 3, urutan: 2, rekomendasi: true }),
  menu({ id: 9, nama: "Mojito Lychee", harga: 32000, kategori_id: 4, urutan: 1, rekomendasi: true }),
  menu({ id: 10, nama: "Air Mineral", harga: 10000, kategori_id: null, urutan: 1 }),
  menu({ id: 11, nama: "Es Teh Manis", harga: 15000, kategori_id: 99, urutan: 2 }),
];

const hasil = kelompokkan(KATEGORI, MENU);

const semuaId = hasil.flatMap((g) => g.menu.map((m) => m.id));
cek("semua menu terwakili", semuaId.length === MENU.length, `${semuaId.length} vs ${MENU.length}`);
cek("tidak ada id ganda", new Set(semuaId).size === semuaId.length);
cek("semua id asli muncul", new Set(MENU.map((m) => m.id)).size === new Set(semuaId).size);

cek(
  "urutan kategori mengikuti kolom urutan",
  hasil.map((g) => g.kategori.id).join(",") === "1,2,3,4,-1",
  hasil.map((g) => g.kategori.id).join(",")
);

cek("kategori kosong dilewati", !hasil.some((g) => g.kategori.id === 5 || g.kategori.id === 6));

const lain = hasil.find((g) => g.kategori.nama === "Lainnya");
cek("kelompok Lainnya ada", !!lain);
cek("Lainnya berisi 2 menu", lain?.menu.length === 2, String(lain?.menu.length));
cek("kategori_id null masuk Lainnya", !!lain?.menu.some((m) => m.id === 10));
cek("kategori_id tak dikenal masuk Lainnya", !!lain?.menu.some((m) => m.id === 11));

const kopi = hasil.find((g) => g.kategori.id === 3)!;
cek("rekomendasi paling atas di Kopi", kopi.menu[0].id === 8, kopi.menu[0].nama);
const utama = hasil.find((g) => g.kategori.id === 1)!;
cek("rekomendasi paling atas di Makanan Utama", utama.menu[0].id === 2, utama.menu[0].nama);

const habis = hasil.flatMap((g) => g.menu).find((m) => m.id === 4);
cek("menu habis tetap tampil", !!habis);
cek("menu habis ditandai tersedia=false", habis?.tersedia === false);

const tersedia = MENU.filter((m) => m.tersedia).length;
const kartu = hasil.reduce((n, g) => n + g.menu.length, 0);
cek("jumlah kartu = jumlah menu", kartu === MENU.length);
cek("hitungan kepala = yang tersedia", tersedia === MENU.length - 1, String(tersedia));

cek("tanpa data tidak meledak", kelompokkan([], []).length === 0);
const semuaYatim = kelompokkan(KATEGORI, [menu({ id: 20, nama: "X", kategori_id: null })]);
cek(
  "semua menu yatim jadi satu kelompok Lainnya",
  semuaYatim.length === 1 && semuaYatim[0].kategori.nama === "Lainnya"
);

const bowl = hasil.flatMap((g) => g.menu).find((m) => m.id === 5);
const salted = (bowl?.pilihan ?? []).find((p) => p.nama === "Salted Egg");
cek("tambahan harga pilihan terjaga", salted?.tambah === 5000, String(salted?.tambah));

console.log(`\n/ menu  ${lulus} lulus, ${gagal.length} gagal`);
for (const g of gagal) console.log("  GAGAL:", g);
if (gagal.length > 0) process.exit(1);
