/**
 * Uji saringan admin terhadap DATA SUNGGAHAN (126 menu dari server).
 *
 * Berbeda dengan `aturan-pilihan.mjs` yang memakai contoh kecil, berkas ini
 * memakai menu asli supaya angka yang dijanjikan di layar — "Kopi 24",
 * "126 dari 126" — ikut diperiksa. Fungsi yang dipakai adalah fungsi ASLI
 * dari `app/lib/order/saring.ts`, bukan salinan.
 *
 * Versi pertama berkas ini memuat salinan logika dari PortalAdmin.tsx. Itu
 * cacat: logika di komponen bisa berubah tanpa uji ikut berubah. Salinan
 * sudah dibuang setelah logikanya dipindah ke lib/order/saring.ts.
 *
 * Jalankan (server harus menyala):
 *   node --experimental-strip-types --import ./scripts/uji/ts-hook.mjs \
 *        scripts/uji/saring-admin.mjs
 */
import { normal, saringMenu, hitungPerKategori } from "../../app/lib/order/saring.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
let lulus = 0;
let gagal = 0;
const cek = (nama, syarat, detail = "") => {
  if (syarat) {
    lulus++;
    console.log(`  LULUS  ${nama}${detail ? " — " + detail : ""}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}${detail ? " — " + detail : ""}`);
  }
};

const data = await (await fetch(BASE + "/api/order/kasir")).json();
const menu = data.menu ?? [];

// Nama kategori TIDAK ikut di respons kasir — halaman admin membacanya dari
// server (ambilMenu). Sumber yang sama dipakai di sini: MENU_CONTOH, salinan
// menu asli yang sudah ada di app/lib/order/demo.ts.
//
// Versi pertama uji ini mengurutkan kategori berdasarkan JUMLAH menu. Itu
// salah: 28 dan 27 hampir sama, jadi Kopi (24) tertukar dengan Non-Kopi (27)
// dan uji melaporkan "Kopi 27". Kesalahan ujinya, bukan aplikasinya.
const { MENU_CONTOH } = await import("../../app/lib/order/demo.ts");
const namaKategori = new Map(MENU_CONTOH.kategori.map((k) => [k.id, k.nama]));

const saring = (cari, kategori = "semua", status = "semua") =>
  saringMenu(menu, namaKategori, { cari, kategori, status });

cek("menu terbaca dari server", menu.length === 126, `${menu.length} item`);
cek("nama kategori terbaca", namaKategori.size === 6, `${namaKategori.size} kategori`);
cek("tanpa saringan = semua menu", saring("").length === 126);

const kopi = saring("kopi");
cek("cari 'kopi' menemukan menu", kopi.length > 0, `${kopi.length} hasil`);
cek(
  "'kopi' juga menangkap kategori Kopi",
  kopi.some((m) => namaKategori.get(m.kategori_id) === "Kopi")
);
cek("besar/kecil huruf tidak berpengaruh", saring("KOPI").length === kopi.length);
cek("spasi di tepi diabaikan", saring("  kopi  ").length === kopi.length);

const idKopi = [...namaKategori.entries()].find(([, n]) => n === "Kopi")?.[0];
const kategoriKopi = saring("", idKopi);
cek("filter kategori Kopi = 24 menu", kategoriKopi.length === 24, `${kategoriKopi.length}`);
cek("semua hasil memang kategori Kopi", kategoriKopi.every((m) => m.kategori_id === idKopi));

const habisTotal = menu.filter((m) => !m.tersedia).length;
const habis = saring("", "semua", "habis");
const ada = saring("", "semua", "ada");
cek("filter 'Habis' akurat", habis.length === habisTotal, `${habis.length} dari ${habisTotal}`);
cek("filter 'Tersedia' akurat", ada.length === 126 - habisTotal, `${ada.length}`);
cek("ada + habis = total", ada.length + habis.length === 126);

const gabung = saring("ayam", 1);
cek(
  "kata + kategori digabung",
  gabung.every((m) => m.kategori_id === 1) && gabung.every((m) => normal(m.nama + m.deskripsi).includes("ayam")),
  `${gabung.length} hasil`
);
cek("kata tak ada → hasil kosong", saring("zzzz").length === 0);

// Janji di layar: angka chip harus sama dengan isi tabel bila chip diklik.
let cocok = 0;
for (const [id] of namaKategori) {
  const perKategori = hitungPerKategori(saring(""));
  if ((perKategori.get(id) ?? 0) === saring("", id).length) cocok++;
}
cek("angka chip = isi tabel untuk 6 kategori", cocok === 6, `${cocok}/6`);

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
if (gagal > 0) process.exit(1);
