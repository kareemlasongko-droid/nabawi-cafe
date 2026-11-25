/**
 * Uji RUMUS STOK & HPP — tanpa server, tanpa database.
 *
 * ── YANG DIJAGA ─────────────────────────────────────────────────────
 *
 * HPP adalah angka yang dipakai untuk MENENTUKAN HARGA JUAL. Salahnya
 * tidak muncul sebagai galat; ia muncul sebagai keputusan bisnis yang
 * buruk — menu yang dijual di bawah biaya bahan, atau harga dinaikkan
 * padahal marginnya sudah sehat.
 *
 * Titik yang paling mudah salah dan diuji di sini:
 *
 *   · uang kembalian / pembulatan yang membuat HPP beda 1 rupiah;
 *   · rata-rata harga saat stok MINUS (bisa terjadi sungguhan);
 *   · bahan tanpa harga yang diam-diam dianggap gratis;
 *   · tanda negatif pemakaian yang terbalik sehingga stok bertambah;
 *   · satu pesanan memakai bahan yang sama dari dua menu berbeda.
 *
 * Jalankan:
 *   node --experimental-strip-types --no-warnings \
 *        --import ./scripts/uji/ts-hook.mjs scripts/uji/hpp.mjs
 */
import {
  hargaRataRataBaru,
  kebutuhanBahan,
  totalHpp,
  nilaiPakai,
  nilaiOpname,
  selisihOpname,
  statusStok,
  statusBahan,
  marginKotor,
} from "../../app/lib/order/hpp.ts";

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

// ═══ Harga rata-rata bergerak ══════════════════════════════════════════
console.log("\n── Harga rata-rata bergerak ──");

/*
  Contoh nyata: stok 1.000 g cabai @ Rp120 (nilai Rp120.000), beli
  1.000 g @ Rp180. Rata-rata = (120.000 + 180.000) / 2.000 = Rp150.
  Harga lama TIDAK boleh hilang, dan harga baru tidak boleh menang
  sekaligus.
*/
cek(
  "dua pembelian seimbang → rata-rata tengah",
  hargaRataRataBaru(1000, 120, 1000, 180) === 150,
  String(hargaRataRataBaru(1000, 120, 1000, 180)),
);

/*
  Bobot harus mengikuti JUMLAH, bukan jumlah pembelian. Beli 100 g @
  Rp1.000 saat stok 900 g @ Rp100 → (90.000 + 100.000)/1.000 = Rp190.
  Kalau bobotnya salah (dibagi rata dua pembelian), hasilnya Rp550 —
  tiga kali lipat, dan seluruh HPP menu ikut melonjak.
*/
cek(
  "pembelian kecil tidak mendominasi rata-rata",
  hargaRataRataBaru(900, 100, 100, 1000) === 190,
  String(hargaRataRataBaru(900, 100, 100, 1000)),
);

cek(
  "stok 0 → harga mengikuti pembelian terakhir",
  hargaRataRataBaru(0, 999, 500, 250) === 250,
  String(hargaRataRataBaru(0, 999, 500, 250)),
);

/*
  STOK NEGATIF adalah keadaan nyata: dapur memasak sebelum pembelian
  dicatat. Harga lama dari periode itu tidak mewakili apa pun, jadi
  dibuang. Kalau tetap ditimbang, rata-ratanya bisa turun jauh dan HPP
  semua menu ikut turun — laba terlihat lebih besar dari kenyataan.
*/
cek(
  "stok negatif → harga lama dibuang, tidak ditimbang",
  hargaRataRataBaru(-200, 50, 1000, 300) === 300,
  String(hargaRataRataBaru(-200, 50, 1000, 300)),
);

cek("pembelian 0 tidak mengubah harga", hargaRataRataBaru(500, 200, 0, 900) === 200);
cek("pembelian negatif tidak mengubah harga", hargaRataRataBaru(500, 200, -100, 900) === 200);

// Hasil harus bilangan bulat rupiah — tidak ada pecahan sen di sistem ini.
const pecahan = hargaRataRataBaru(3, 100, 1, 101);
cek("hasil dibulatkan ke rupiah bulat", Number.isInteger(pecahan), String(pecahan));

// ═══ Kebutuhan bahan ═══════════════════════════════════════════════════
console.log("\n── Kebutuhan bahan satu pesanan ──");

const harga = new Map([
  [1, 120], // cabai per gram
  [2, 15], // beras per gram
  [3, 0], // keju — BELUM ADA HARGA
]);
const resep = new Map([
  [10, [{ bahan_id: 1, jumlah: 5 }, { bahan_id: 2, jumlah: 200 }]],
  [11, [{ bahan_id: 1, jumlah: 3 }, { bahan_id: 3, jumlah: 20 }]],
]);

// Dua porsi menu 10: cabai 10 g, beras 400 g.
const satu = kebutuhanBahan([{ menu_id: 10, jumlah: 2 }], resep, harga);
cek("bahan dihitung dari resep × porsi", satu.pakai.length === 2, String(satu.pakai.length));
cek(
  "cabai 5 g × 2 porsi = 10 g",
  satu.pakai.find((p) => p.bahan_id === 1)?.jumlah === 10,
  String(satu.pakai.find((p) => p.bahan_id === 1)?.jumlah),
);
cek("resep lengkap → lengkap true", satu.lengkap === true, JSON.stringify(satu.hargaKosong));

/*
  DUA MENU BERBEDA DALAM SATU PESANAN yang sama-sama memakai cabai
  (menu 10 pakai 5 g, menu 11 pakai 3 g). Harus menjadi SATU baris
  gerakan stok berisi 8 g — bukan dua baris. Kalau tidak digabung, buku
  besar stok berisi puluhan baris bahan yang sama dan selisih opname
  tidak bisa ditelusuri.
*/
const gabung = kebutuhanBahan(
  [{ menu_id: 10, jumlah: 1 }, { menu_id: 11, jumlah: 1 }],
  resep,
  harga,
);
const cabai = gabung.pakai.filter((p) => p.bahan_id === 1);
cek("bahan sama dari dua menu digabung jadi satu baris", cabai.length === 1, String(cabai.length));
cek("jumlahnya dijumlahkan (5 + 3 = 8)", cabai[0]?.jumlah === 8, String(cabai[0]?.jumlah));

/*
  BAHAN TANPA HARGA tidak boleh hilang diam-diam. Kalau ia dibuang,
  HPP menu 11 akan tampak lebih murah dan labanya terlihat lebih besar.
*/
cek("bahan tanpa harga dilaporkan", gabung.hargaKosong.includes(3), JSON.stringify(gabung.hargaKosong));
cek("ada bahan tanpa harga → lengkap false", gabung.lengkap === false);
cek(
  "bahan tanpa harga tetap dipotong stoknya",
  gabung.pakai.some((p) => p.bahan_id === 3),
  "stok fisik tetap berkurang walau harganya belum ada",
);

// Menu tanpa resep: bukan galat, tapi harus dilaporkan.
const tanpa = kebutuhanBahan([{ menu_id: 99, jumlah: 1 }], resep, harga);
cek("menu tanpa resep dilaporkan", tanpa.tanpaResep.includes(99), JSON.stringify(tanpa.tanpaResep));
cek("menu tanpa resep tidak menghasilkan pemakaian", tanpa.pakai.length === 0);
cek("menu tanpa resep → lengkap false", tanpa.lengkap === false);

// Item tanpa menu_id (data lama) tidak boleh melempar.
const tanpaMenu = kebutuhanBahan([{ menu_id: null, jumlah: 1 }], resep, harga);
cek("item tanpa menu_id dilewati, tidak melempar", tanpaMenu.pakai.length === 0);

// Pembulatan 3 desimal: 0,333 g tidak boleh hilang jadi 0.
const kecil = kebutuhanBahan(
  [{ menu_id: 20, jumlah: 1 }],
  new Map([[20, [{ bahan_id: 5, jumlah: 0.3333 }]]]),
  new Map([[5, 1000]]),
);
cek(
  "jumlah kecil tidak dibulatkan menjadi 0",
  kecil.pakai[0]?.jumlah === 0.333,
  String(kecil.pakai[0]?.jumlah),
);

// ═══ Nilai & total HPP ═════════════════════════════════════════════════
console.log("\n── Nilai HPP ──");

cek("nilai = jumlah × harga", nilaiPakai({ bahan_id: 1, jumlah: 10, harga_satuan: 120 }) === 1200);
cek("nilai dibulatkan ke rupiah", Number.isInteger(nilaiPakai({ bahan_id: 1, jumlah: 0.333, harga_satuan: 121 })));

const total = totalHpp([
  { bahan_id: 1, jumlah: 10, harga_satuan: 120 }, // 1.200
  { bahan_id: 2, jumlah: 250, harga_satuan: 15 }, // 3.750
]);
cek("total HPP = jumlah nilai baris", total === 4950, String(total));
cek("tanpa bahan → total 0", totalHpp([]) === 0);

/*
  Total dijumlah dari NILAI PER BARIS yang sudah dibulatkan, bukan dari
  total mentah. Bedanya bisa 1 rupiah, dan yang benar adalah yang cocok
  dengan buku besar — karena setiap baris di buku besar punya `nilai`
  yang sudah dibulatkan.
*/
const a = nilaiPakai({ bahan_id: 1, jumlah: 0.5, harga_satuan: 3 }); // 1,5 → 2
const b = nilaiPakai({ bahan_id: 2, jumlah: 0.5, harga_satuan: 3 }); // 1,5 → 2
cek(
  "total = jumlah baris terbulat, cocok dengan buku besar",
  totalHpp([
    { bahan_id: 1, jumlah: 0.5, harga_satuan: 3 },
    { bahan_id: 2, jumlah: 0.5, harga_satuan: 3 },
  ]) === a + b,
  `${a}+${b}`,
);

// ═══ Opname ════════════════════════════════════════════════════════════
console.log("\n── Opname ──");

cek("fisik lebih sedikit → selisih negatif", selisihOpname(10, 8) === -2, String(selisihOpname(10, 8)));
cek("fisik lebih banyak → selisih positif", selisihOpname(10, 12) === 2, String(selisihOpname(10, 12)));
cek("opname cocok → selisih 0", selisihOpname(10, 10) === 0);
cek("selisih desimal tidak hilang", selisihOpname(10.5, 8.25) === -2.25, String(selisihOpname(10.5, 8.25)));
cek("nilai susut dihitung dari harga berlaku", nilaiOpname(-2, 15000) === -30000, String(nilaiOpname(-2, 15000)));
cek("nilai kelebihan juga punya nilai", nilaiOpname(2, 15000) === 30000);

// ═══ Status stok ═══════════════════════════════════════════════════════
console.log("\n── Status stok ──");

cek("stok 0 → habis", statusStok(0, 5) === "habis");
cek("stok negatif → habis", statusStok(-3, 5) === "habis", "lebih mendesak daripada 'kritis'");
cek("di bawah minimum → kritis", statusStok(3, 5) === "kritis");
cek("tepat di minimum → kritis", statusStok(5, 5) === "kritis");
cek("di atas minimum → cukup", statusStok(6, 5) === "cukup");
cek("minimum 0 → tidak ada peringatan", statusStok(1, 0) === "cukup", "bahan tanpa batas tidak boleh dianggap kritis");

/*
  ── Saldo 0: "belum pernah dicatat" ≠ "habis" ──

  Hari pertama fitur ini dipakai, seratus bahan baru masuk lewat seed tanpa
  satu pun pembelian. Kalau semuanya tampil "habis", daftar belanja berisi
  100 baris dan peringatannya berhenti dipercaya. Dua keadaan ini harus
  dibedakan — dan dibedakannya dari GERAKAN stok, bukan dari saldo.
*/
cek(
  "saldo 0 tanpa gerakan → belum dicatat, bukan habis",
  statusBahan(0, 500, false) === "belum_dicatat",
  String(statusBahan(0, 500, false)),
);
cek(
  "saldo 0 SETELAH pernah dicatat → habis",
  statusBahan(0, 500, true) === "habis",
  "opname yang mencatat fisik 0 adalah pernyataan dapur, bukan ketiadaan data",
);
cek(
  "saldo 0 setelah dicatat, minimum 0 → tetap habis",
  statusBahan(0, 0, true) === "habis",
  "minimum 0 hanya mematikan peringatan 'kritis', bukan 'habis'",
);
/*
  Stok negatif MUSTAHIL berasal dari bahan yang belum pernah dicatat: angka
  negatif hanya lahir dari pemakaian, dan pemakaian adalah gerakan stok.
  Kombinasi (-3, belum pernah dicatat) karena itu tidak nyata; yang diuji
  adalah yang nyata — negatif selalu "habis", apa pun minimumnya.
*/
cek(
  "stok negatif selalu habis, minimum 0 pun",
  statusBahan(-3, 500, true) === "habis" && statusBahan(-3, 0, true) === "habis",
);
cek(
  "stok ada → status normal apa pun riwayatnya",
  statusBahan(600, 500, false) === "cukup" && statusBahan(400, 500, false) === "kritis",
);

// ═══ Margin ════════════════════════════════════════════════════════════
console.log("\n── Margin ──");

const m = marginKotor(100000, 40000);
cek("laba = omzet − HPP", m.laba === 60000, String(m.laba));
cek("persen laba dihitung dari omzet", m.persen === 60, String(m.persen));

const tipis = marginKotor(50000, 48000);
cek("margin tipis tidak dibulatkan jadi 100%", tipis.persen === 4, String(tipis.persen));

const rugi = marginKotor(50000, 60000);
cek("HPP di atas omzet → laba negatif", rugi.laba === -10000, String(rugi.laba));
cek("rugi menghasilkan persen negatif", rugi.persen === -20, String(rugi.persen));

/*
  Omzet 0: persentase tidak bermakna. Mengembalikan 0 akan terbaca
  "margin 0%" (buruk tapi wajar); mengembalikan 100 akan terbaca "sangat
  untung". Keduanya menyesatkan — jadi null, dan layar menampilkan "—".
*/
const nol = marginKotor(0, 0);
cek("omzet 0 → persen null, bukan 0 atau 100", nol.persen === null, String(nol.persen));

const tanpaOmzet = marginKotor(0, 5000);
cek("omzet 0 tapi ada HPP → laba negatif, persen tetap null", tanpaOmzet.laba === -5000 && tanpaOmzet.persen === null);

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal > 0 ? 1 : 0);
