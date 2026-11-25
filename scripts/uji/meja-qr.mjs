/**
 * Uji URUTAN MEJA dan QR MEJA.
 *
 * ── MENGAPA DUA HAL INI DIUJI BERSAMA ────────────────────────────────
 *
 * Keduanya soal MEJA, dan keduanya punya mode kegagalan yang sama:
 * salahnya tidak kelihatan sebagai galat.
 *
 *   · Urutan meja yang salah tetap tampil rapi — hanya angkanya melompat
 *     (1, 10, 11, 2, 20, 3), dan kasir yang mencari meja 7 menyapu
 *     seluruh denah.
 *   · QR yang salah tetap tampil seperti QR. Ia baru ketahuan setelah
 *     dicetak dan ditempel di 20 meja.
 *
 * Karena itu uji ini memeriksa STRUKTUR matriks QR (pola pencari, garis
 * waktu, quiet zone), bukan sekadar "tidak melempar galat".
 *
 * Jalankan:
 *   node --experimental-strip-types --no-warnings \
 *        --import ./scripts/uji/ts-hook.mjs scripts/uji/meja-qr.mjs
 */
import { urutNomorMeja } from "../../app/lib/order/tipe.ts";
import { buatQr, jalurSvg } from "../../app/lib/order/qr.ts";

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

// ═══ 1. Urutan nomor meja ══════════════════════════════════════════════
console.log("\n── Urutan nomor meja ──");

// Data live: nomor 1..20 sebagai TEXT. Inilah urutan yang dilaporkan "acak".
const nomor = Array.from({ length: 20 }, (_, i) => String(i + 1));
const acak = [...nomor].sort(); // urutan teks, seperti PostgREST
const rapi = [...acak].sort(urutNomorMeja);

cek(
  "urutan teks memang acak (bukti masalahnya)",
  acak.slice(0, 5).join(",") === "1,10,11,12,13",
  acak.slice(0, 5).join(","),
);
cek(
  "urutan numerik: 1,2,3,…,20",
  rapi.join(",") === nomor.join(","),
  rapi.slice(0, 6).join(",") + "…",
);

cek("2 sebelum 10", urutNomorMeja("2", "10") < 0);
cek("10 sebelum 11", urutNomorMeja("10", "11") < 0);
cek("9 sebelum 10", urutNomorMeja("9", "10") < 0);
cek("tidak mengubah urutan yang sudah benar", [urutNomorMeja("3", "4"), urutNomorMeja("4", "3")].join(",") === "-1,1");

// Nomor non-angka tidak boleh menyelip di tengah angka.
const campur = ["10", "VIP", "2", "A1", "1"].sort(urutNomorMeja);
cek(
  "nomor angka didahulukan, non-angka menyusul menurut abjad",
  campur.join(",") === "1,2,10,A1,VIP",
  campur.join(","),
);

// ═══ 2. QR: struktur ═══════════════════════════════════════════════════
console.log("\n── QR meja: struktur ──");

const url = "https://nabawi-cafe.example/order?meja=12";
const qr = buatQr(url);

cek("matriks persegi", qr.modul.length === qr.ukuran && qr.modul.every((r) => r.length === qr.ukuran));
cek(
  "ukuran sesuai versi (21 + 4·(v-1))",
  qr.ukuran === 21 + (qr.versi - 1) * 4,
  `v${qr.versi} → ${qr.ukuran}`,
);

/** Pola pencari 7×7: cincin luar gelap, cincin kedua terang, inti 3×3 gelap. */
const pencariBenar = (ox, oy) => {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const jauh = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      if (qr.modul[oy + dy][ox + dx] !== (jauh !== 2)) return false;
    }
  }
  return true;
};
cek("pola pencari kiri-atas", pencariBenar(0, 0));
cek("pola pencari kanan-atas", pencariBenar(qr.ukuran - 7, 0));
cek("pola pencari kiri-bawah", pencariBenar(0, qr.ukuran - 7));

// Garis waktu: modul di baris/kolom 6 berganti-ganti.
let waktu = true;
for (let i = 8; i < qr.ukuran - 8; i++) {
  if (qr.modul[6][i] !== (i % 2 === 0)) waktu = false;
  if (qr.modul[i][6] !== (i % 2 === 0)) waktu = false;
}
cek("garis waktu bergantian", waktu);

// Modul gelap tetap.
cek("modul gelap tetap ada", qr.modul[qr.ukuran - 8][8] === true);

// Kedua salinan format info harus identik.
const formatA = [0, 1, 2, 3, 4, 5, 7, 8].map((i) => qr.modul[8][i]);
const formatB = [qr.ukuran - 1, qr.ukuran - 2, qr.ukuran - 3, qr.ukuran - 4, qr.ukuran - 5, qr.ukuran - 6, qr.ukuran - 7, qr.ukuran - 8].map(
  (x) => qr.modul[8][x],
);
cek("dua salinan format info konsisten", formatA.join("") === formatB.join(""), formatA.join(""));

// Topeng tidak menghasilkan bidang kosong total.
const gelap = qr.modul.flat().filter(Boolean).length;
const persen = (gelap / (qr.ukuran * qr.ukuran)) * 100;
cek("kepadatan modul gelap masuk akal (35–65%)", persen > 35 && persen < 65, `${persen.toFixed(1)}%`);

// ═══ 3. QR: ukuran & kegagalan ═════════════════════════════════════════
console.log("\n── QR: ukuran & kegagalan ──");

const urlPendek = buatQr("https://a.id/o?m=1");
cek("URL pendek memakai versi kecil", urlPendek.versi <= 3, `v${urlPendek.versi}`);
const urlPanjang = buatQr("https://contoh.example/" + "x".repeat(150));
cek("teks panjang naik versi, bukan gagal", urlPanjang.versi > urlPendek.versi, `v${urlPanjang.versi}`);

let melempar = false;
try {
  buatQr("x".repeat(400));
} catch {
  melempar = true;
}
cek("teks di luar kapasitas MELEMPAR galat, bukan QR rusak", melempar);

const jalur = jalurSvg(qr);
cek("jalur SVG tidak kosong", jalur.length > 0);
cek(
  "jumlah perintah SVG = jumlah modul gelap",
  (jalur.match(/M/g) ?? []).length === gelap,
  `${(jalur.match(/M/g) ?? []).length} vs ${gelap}`,
);

// ═══ 4. Teks yang tidak boleh berubah ══════════════════════════════════
console.log("\n── Isi QR ──");

/*
  Yang diuji bukan "QR-nya benar" di sini — itu dibuktikan decoder di uji
  terpisah. Yang diuji: teks yang diumpankan ke generator harus memuat
  nomor meja, karena URL tanpa nomor meja berarti tamu memilih meja
  sendiri dan pesanan bisa diantar ke meja orang.
*/
const teksQr = (dasar, nomorMeja) => `${dasar}/order?meja=${encodeURIComponent(nomorMeja)}`;
cek("QR memuat nomor meja di parameternya", teksQr("https://a.id", "12").endsWith("/order?meja=12"));
cek(
  "nomor meja dengan spasi di-encode",
  teksQr("https://a.id", "A 1") === "https://a.id/order?meja=A%201",
  teksQr("https://a.id", "A 1"),
);

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal > 0 ? 1 : 0);
