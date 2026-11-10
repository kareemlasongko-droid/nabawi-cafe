/**
 * Uji aturan pilihan/add-on — memakai fungsi ASLI.
 *
 * Berkas ini mengimpor langsung `app/lib/order/aturan.ts` dan
 * `app/lib/order/saring.ts`, bukan menyalin logikanya. Uji salinan pernah
 * dibuat untuk saringan admin, dan itu punya cacat bawaan: logika di
 * komponen bisa diubah tanpa uji ikut berubah. Node 22 bisa menjalankan
 * TypeScript langsung (--experimental-strip-types), jadi tidak ada alasan
 * memakai salinan lagi.
 *
 * Jalankan: node scripts/uji/aturan-pilihan.mjs
 * Tidak perlu server menyala — semuanya fungsi murni.
 */
import { bacaPilihan, periksaPilihan, BATAS_PILIHAN } from "../../app/lib/order/aturan.ts";
import { normal, saringMenu, hitungPerKategori } from "../../app/lib/order/saring.ts";

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

// ═══ bacaPilihan: merapikan data dari database ═══════════════════════════
console.log("\n── Membaca pilihan dari database ──");
cek(
  "tambah berupa teks jadi angka",
  bacaPilihan([{ nama: "Salted Egg", tambah: "5000" }])[0]?.tambah === 5000
);
cek(
  "tambah negatif dijepit ke 0",
  bacaPilihan([{ nama: "Diskon", tambah: -20000 }])[0]?.tambah === 0
);
cek(
  "tambah bukan angka jadi 0",
  bacaPilihan([{ nama: "Aneh", tambah: "gratis" }])[0]?.tambah === 0
);
cek("nama kosong dibuang", bacaPilihan([{ nama: "  ", tambah: 0 }]).length === 0);
cek(
  "nama ganda dibuang (tanpa peduli huruf besar)",
  bacaPilihan([
    { nama: "BBQ", tambah: 0 },
    { nama: "bbq", tambah: 5000 },
  ]).length === 1
);
cek("bukan array → kosong", bacaPilihan({ nama: "X" }).length === 0);
cek("null → kosong", bacaPilihan(null).length === 0);
cek(
  `dibatasi ${BATAS_PILIHAN} opsi`,
  bacaPilihan(Array.from({ length: 30 }, (_, i) => ({ nama: "Opsi" + i, tambah: 0 }))).length ===
    BATAS_PILIHAN
);
cek(
  "spasi di tepi nama dipangkas",
  bacaPilihan([{ nama: "  Sambal Matah  ", tambah: 0 }])[0]?.nama === "Sambal Matah"
);

// ═══ periksaPilihan: kiriman pelanggan ══════════════════════════════════
console.log("\n── Memeriksa pilihan yang dikirim pelanggan ──");
const saus = bacaPilihan([
  { nama: "Mushroom", tambah: 0 },
  { nama: "Salted Egg", tambah: 8000 },
]);

const sah = periksaPilihan(saus, ["Salted Egg"]);
cek("pilihan sah diterima", sah.ok === true);
cek("tambahan harga diambil dari database", sah.ok && sah.tambah === 8000, `+Rp${sah.ok ? sah.tambah : "-"}`);
cek("harga dari browser diabaikan", sah.ok && sah.pilihan[0].tambah === 8000);

cek("kosong ditolak bila menu punya pilihan", periksaPilihan(saus, []).ok === false);
cek("dua pilihan ditolak", periksaPilihan(saus, ["Mushroom", "BBQ"]).ok === false);
cek("nama asing ditolak", periksaPilihan(saus, ["Sambal Nuklir"]).ok === false);
cek("huruf besar/kecil diterima", periksaPilihan(saus, ["mushroom"]).ok === true);
cek("bentuk string tunggal diterima", periksaPilihan(saus, "Mushroom").ok === true);
cek("bentuk objek ditolak", periksaPilihan(saus, [{ nama: "Mushroom" }]).ok === false);
cek("menu tanpa pilihan mengabaikan kiriman", periksaPilihan([], ["apa saja"]).ok === true);
cek(
  "pesan galat menyebut pilihan yang tersedia",
  (() => {
    const r = periksaPilihan(saus, []);
    return !r.ok && r.pesan.includes("Mushroom");
  })()
);

// ═══ Saringan admin: satu fungsi, dipakai komponen DAN uji ══════════════
console.log("\n── Saringan admin (fungsi asli) ──");
const namaKategori = new Map([
  [1, "Makanan Utama"],
  [3, "Kopi"],
  [6, "Jus & Dessert"],
]);
const menu = [
  { id: 1, nama: "Nasi Goreng Kebuli", deskripsi: "Kambing", harga: 40000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 1 },
  { id: 2, nama: "Crème Brûlée", deskripsi: "", harga: 35000, kategori_id: 6, foto_url: null, tersedia: false, urutan: 2 },
  { id: 3, nama: "Es Kopi Susu", deskripsi: "", harga: 25000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 3 },
];
const saring = (cari, kategori = "semua", status = "semua") =>
  saringMenu(menu, namaKategori, { cari, kategori, status });

cek("tanpa saringan → semua", saring("").length === 3);
cek("cari 'kopi' menemukan nama menu", saring("kopi").length === 1);
cek("cari nama kategori ('jus') menemukan anggotanya", saring("jus").length === 1, saring("jus").map((m) => m.nama).join(","));
cek("'creme' menemukan 'Crème'", saring("creme").length === 1);
cek("'brulee' menemukan 'Brûlée'", saring("brulee").length === 1);
cek("besar/kecil huruf sama", saring("KOPI").length === saring("kopi").length);
cek("spasi tepi diabaikan", saring("  kopi  ").length === 1);
cek("filter kategori", saring("", 1).length === 1);
cek("filter habis", saring("", "semua", "habis").length === 1);
cek("filter tersedia", saring("", "semua", "ada").length === 2);
cek("ada + habis = total", saring("", "semua", "ada").length + saring("", "semua", "habis").length === 3);
cek("kata + kategori digabung", saring("nasi", 1).length === 1 && saring("nasi", 3).length === 0);
cek("kata tak dikenal → kosong", saring("zzz").length === 0);
cek("normal() membuang aksen", normal("Crème Brûlée") === "creme brulee");
const perKategori = hitungPerKategori(saring("", "semua", "semua"));
cek("hitungPerKategori benar", perKategori.get(1) === 1 && perKategori.get(3) === 1 && perKategori.get(6) === 1);
cek(
  "angka chip = isi tabel per kategori",
  [1, 3, 6].every((id) => (perKategori.get(id) ?? 0) === saring("", id).length)
);

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
if (gagal > 0) process.exit(1);

// ═══ Urutan menu: rekomendasi dulu, sisanya tidak berubah ═══════════════
console.log("\n── Urutan menu di kategori pelanggan ──");
const { urutkanMenu } = await import("../../app/lib/order/aturan.ts");

const m = (nama, urutan, rekomendasi = false) => ({ nama, urutan, rekomendasi });
const dasar = [m("A", 1), m("B", 2), m("C", 3), m("D", 4)];
const hasilUrut = urutkanMenu([...dasar, { ...m("Z", 9), rekomendasi: true }]);

cek("rekomendasi naik ke atas", hasilUrut[0].nama === "Z", hasilUrut.map((x) => x.nama).join(","));
cek(
  "sisanya tetap urut seperti semula",
  hasilUrut.slice(1).map((x) => x.nama).join(",") === "A,B,C,D",
  hasilUrut.slice(1).map((x) => x.nama).join(",")
);
cek("tidak ada menu hilang", hasilUrut.length === 5);
cek("tidak mengubah array asli", dasar.map((x) => x.nama).join(",") === "A,B,C,D");

const duaRek = urutkanMenu([m("A", 1), m("B", 2, true), m("C", 3, true)]);
cek("dua rekomendasi urut menurut urutan", duaRek.map((x) => x.nama).join(",") === "B,C,A", duaRek.map((x) => x.nama).join(","));

const rekomendasiHabis = urutkanMenu([{ ...m("Habis", 1), rekomendasi: true, tersedia: false }, m("Ada", 2)]);
cek("rekomendasi tetap di atas walau habis", rekomendasiHabis[0].nama === "Habis", "urutan tidak berubah karena status");

const tanpaUrutan = urutkanMenu([m("Beta", undefined), m("Alpha", undefined)]);
cek("urutan kosong jatuh ke nama", tanpaUrutan.map((x) => x.nama).join(",") === "Alpha,Beta", tanpaUrutan.map((x) => x.nama).join(","));

const seri = urutkanMenu([m("B", 1), m("A", 1)]);
cek("urutan sama diurutkan stabil menurut nama", seri.map((x) => x.nama).join(",") === "A,B");

// Urutan harus sama setiap kali dipanggil (tidak acak).
const sekali = urutkanMenu([...dasar, m("E", 2, true)]).map((x) => x.nama).join(",");
const duakali = urutkanMenu([...dasar, m("E", 2, true)]).map((x) => x.nama).join(",");
cek("urutan deterministik", sekali === duakali, sekali);

console.log(`\n═══ tambahan: ${lulus} lulus, ${gagal} gagal ═══`);
if (gagal > 0) process.exit(1);
