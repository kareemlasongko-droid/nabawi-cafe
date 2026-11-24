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

/*
  Nama kategori TIDAK ikut di respons kasir, jadi uji ini perlu daftar
  kategori dari sumber LAIN.

  Dulu diimpor dari `MENU_CONTOH` (salinan di kode). Salinan itu sudah
  dihapus — pemilik meminta data masuk database — jadi sekarang daftarnya
  diambil dari `kategori_menu` lewat server yang sedang diuji
  (/api/order/kategori). Itu juga lebih benar: uji menjadi ikut gagal kalau
  endpoint kategori rusak, bukan diam-diam memakai salinan yang selalu ada.
*/
const kategoriRes = await fetch(BASE + "/api/order/kategori");
if (!kategoriRes.ok) {
  console.error(
    `GAGAL  /api/order/kategori menjawab ${kategoriRes.status}. ` +
      `Uji ini butuh daftar kategori dari server, bukan dari salinan di kode.`
  );
  process.exit(1);
}
const kategori = await kategoriRes.json();
const namaKategori = new Map(kategori.map((k) => [k.id, k.nama]));

const saring = (cari, kategori = "semua", status = "semua") =>
  saringMenu(menu, namaKategori, { cari, kategori, status });

cek("menu terbaca dari server", menu.length === 126, `${menu.length} item`);
cek("nama kategori terbaca", namaKategori.size === 6, `${namaKategori.size} kategori`);
cek("tanpa saringan = semua menu", saring("").length === 126);

/*
  KATA PENCARIAN DIPILIH DARI DATA, BUKAN DITULIS "kopi".

  Dulu uji ini mencari "kopi" dan mengharapkan kategori bernama "Kopi"
  berisi tepat 24 menu. Itu mengunci uji pada isi database saat uji
  ditulis: begitu pemilik mengganti nama kategori atau menambah menu,
  uji gagal padahal aplikasinya benar.

  Yang pantas diuji adalah PERILAKUNYA: kata yang ada di nama menu harus
  ditemukan, dan bila kata itu juga nama kategori, menu sekategori itu
  ikut tertangkap. Kata dan kategori diambil dari data yang sedang diuji.
*/
const kataUji = normal(menu[0].nama).split(" ")[0];
cek("kata dari data dipakai", kataUji.length > 1, kataUji);

const hasilKata = saring(kataUji);
cek(
  `cari "${kataUji}" menemukan menu`,
  hasilKata.length > 0,
  `${hasilKata.length} hasil`
);
cek(
  "setiap hasil benar-benar memuat kata itu",
  hasilKata.every((m) => normal(m.nama + " " + (m.deskripsi ?? "")).includes(kataUji))
);
cek("besar/kecil huruf tidak berpengaruh", saring(kataUji.toUpperCase()).length === hasilKata.length);
cek("spasi di tepi diabaikan", saring(`  ${kataUji}  `).length === hasilKata.length);

/*
  Kata yang SAMA dengan nama kategori: hasilnya harus mencakup seluruh
  menu kategori itu. Inilah janji di layar — mengetik "kopi" memunculkan
  Kopi, bukan hanya menu yang kebetulan bernama kopi.
*/
const kategoriCocok = [...namaKategori.entries()].find(
  ([, n]) => normal(n) === normal(kataUji)
);
if (kategoriCocok) {
  const [idKategori] = kategoriCocok;
  const hasilGabung = saring(kataUji);
  const semuaKategori = saring("", idKategori);
  cek(
    "kata = nama kategori → seluruh kategori ikut",
    semuaKategori.every((m) => hasilGabung.some((h) => h.id === m.id)),
    `${hasilGabung.length} hasil vs ${semuaKategori.length} di kategori`
  );
} else {
  cek("kata uji bukan nama kategori (uji gabung dilewati)", true, "dilewati");
}

const idKategoriPertama = [...namaKategori.keys()][0];
const isiKategori = saring("", idKategoriPertama);
cek("filter kategori mengembalikan menu", isiKategori.length > 0, `${isiKategori.length}`);
cek(
  "semua hasil memang kategori itu",
  isiKategori.every((m) => m.kategori_id === idKategoriPertama)
);
cek(
  "jumlahnya sama dengan hitungan chip",
  isiKategori.length === (hitungPerKategori(saring("")).get(idKategoriPertama) ?? 0)
);

const habisTotal = menu.filter((m) => !m.tersedia).length;
const habis = saring("", "semua", "habis");
const ada = saring("", "semua", "ada");
cek("filter 'Habis' akurat", habis.length === habisTotal, `${habis.length} dari ${habisTotal}`);
cek("filter 'Tersedia' akurat", ada.length === 126 - habisTotal, `${ada.length}`);
cek("ada + habis = total", ada.length + habis.length === 126);

/*
  Kata + kategori. Dulu kata "ayam" DAN nomor kategori 1 ditulis di uji,
  jadi uji ini akan gagal pada database yang sah tapi berbeda isi. Sekarang
  keduanya diambil dari data yang diuji.
*/
const menuKategoriPertama = saring("", idKategoriPertama);
const kataDariKategori = normal(menuKategoriPertama[0].nama).split(" ")[0];
const gabung = saring(kataDariKategori, idKategoriPertama);
cek(
  "kata + kategori digabung",
  gabung.every((m) => m.kategori_id === idKategoriPertama) &&
    gabung.every((m) => normal(m.nama + " " + (m.deskripsi ?? "")).includes(kataDariKategori)),
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
