/**
 * Uji RANGKUMAN PENJUALAN + RIWAYAT lewat HTTP sungguhan.
 *
 * ── MENGAPA UJI INI ADA, PADAHAL SUDAH ADA UJI UNIT ────────────────────
 *
 * Uji unit memanggil fungsi `riwayat.ts` langsung. Itu membuktikan
 * ARITMETIKANYA benar, bukan bahwa angkanya pernah sampai ke layar:
 *
 *   · rute `/api/order/riwayat` bisa lupa didaftarkan, atau menolak
 *     permintaan karena env;
 *   · komponen bisa ditulis tetapi tidak pernah dipasang di salah satu
 *     portal — dan permintaannya justru "di kasir DAN admin";
 *   · tombol invoice bisa hilang dari daftar riwayat.
 *
 * Ketiganya tidak menghasilkan galat di mana pun. Yang diuji di sini
 * adalah respons server dan bundel yang benar-benar dikirim ke browser.
 *
 * Jalankan (server menyala):
 *   BASE=http://127.0.0.1:3000 node scripts/uji/riwayat-http.mjs
 */
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

const ambil = (j, opsi) => fetch(BASE + j, opsi);

/** Semua bundel JS yang dirujuk satu halaman. */
async function bundelHalaman(jalur) {
  const html = await (await ambil(jalur)).text();
  const src = [...html.matchAll(/\/_next\/static\/[^"']+?\.js/g)].map((m) => m[0]);
  const unik = [...new Set(src)];
  const isi = await Promise.all(
    unik.map(async (u) => {
      const r = await ambil(u);
      return r.ok ? await r.text() : "";
    }),
  );
  return isi.join("\n");
}

// ═══ 1. Rute ════════════════════════════════════════════════════════════
console.log("\n── 1. Rute /api/order/riwayat ──");

const res = await ambil("/api/order/riwayat");
cek("rute ada (bukan 404)", res.status !== 404, `status ${res.status}`);
cek("rute menjawab 200", res.status === 200, `status ${res.status}`);

const j = await res.json();
cek("membawa `ringkasan`", j.ringkasan != null, Object.keys(j).join(","));
cek("membawa `riwayat` berupa array", Array.isArray(j.riwayat), String(j.riwayat?.length));

const r = j.ringkasan ?? {};
cek("omzet berupa angka", typeof r.omzet === "number", String(r.omzet));
cek("omzet BUKAN jumlah uang diterima", r.omzet !== 679700, `omzet ${r.omzet}`);
cek("pembayaran `settlement` terhitung non-tunai", r.nontunai === 279700, String(r.nontunai));
cek("tunai + non-tunai = omzet", r.tunai + r.nontunai === r.omzet, `${r.tunai}+${r.nontunai} vs ${r.omzet}`);
cek("belum dibayar TIDAK menghitung pesanan ditolak", r.belum_bayar === 1, String(r.belum_bayar));

/*
  ── SOAL ANGKA YANG TEPAT ────────────────────────────────────────────

  Uji HTTP ini berjalan SETELAH uji lain yang menulis pesanan ke tiruan
  yang sama. Menuntut `omzet === 631600` di sini membuat hasilnya
  bergantung pada urutan suite — uji yang lulus pagi ini bisa gagal sore
  ini tanpa ada kode yang berubah. Yang diuji di sini karena itu
  HUBUNGAN antar angka, bukan nominal mutlaknya:

    · tunai + non-tunai = omzet, apa pun isinya;
    · omzet tidak sama dengan jumlah uang yang diserahkan tamu
      (itu bukti kembalian tidak ikut);
    · item > 0 dan berupa bilangan bulat.

  Nominal mutlaknya diuji di `riwayat.mjs`, terhadap data yang tidak
  pernah ditulis uji lain.
*/
const totalDiterima = 400000 + 279700;
cek(
  "omzet bukan jumlah uang diserahkan (kembalian tidak ikut)",
  r.omzet !== totalDiterima,
  `omzet ${r.omzet}, uang diserahkan ${totalDiterima}`,
);
cek("tunai berupa angka wajar", Number.isFinite(r.tunai) && r.tunai >= 0, String(r.tunai));
cek("tunai tidak melebihi omzet", r.tunai <= r.omzet, `${r.tunai} vs ${r.omzet}`);
cek("item terjual bilangan bulat > 0", Number.isInteger(r.item) && r.item > 0, String(r.item));
cek("jumlah pesanan bilangan bulat ≥ 0", Number.isInteger(r.jumlah_pesanan) && r.jumlah_pesanan >= 0, String(r.jumlah_pesanan));

// ═══ 2. Bentuk riwayat ══════════════════════════════════════════════════
console.log("\n── 2. Isi riwayat ──");

cek("riwayat memuat pesanan yang DITOLAK", j.riwayat.some((x) => x.status === "ditolak"));
cek("riwayat memuat pesanan yang belum dibayar", j.riwayat.some((x) => x.status_bayar === "menunggu"));
cek("pesanan tanpa tagihan tetap punya total angka", j.riwayat.filter((x) => x.total == null).length === 0);
cek("total 0, bukan null, untuk pesanan tanpa tagihan", j.riwayat.some((x) => x.total === 0));
cek("setiap baris punya id untuk membuka invoice", j.riwayat.every((x) => Number.isInteger(x.id)));
cek("setiap baris punya nomor", j.riwayat.every((x) => typeof x.nomor === "string" && x.nomor));
/*
  Urutan diuji sebagai INVARIAN, bukan nomor tertentu: uji lain yang jalan
  lebih dulu menambah pesanan baru, dan pesanan baru itu memang HARUS
  berada di atas. Yang penting kolom waktunya menurun.
*/
const waktu = j.riwayat.map((x) => new Date(x.dibuat_at).getTime());
cek(
  "riwayat terurut dari yang terbaru",
  waktu.every((t, i) => i === 0 || Number.isNaN(t) || Number.isNaN(waktu[i - 1]) || t <= waktu[i - 1]),
  j.riwayat.slice(0, 3).map((x) => x.nomor).join(" > "),
);
cek("baris teratas dibuat paling akhir", waktu[0] >= waktu[waktu.length - 1], new Date(waktu[0]).toISOString());

const batasKecil = await (await ambil("/api/order/riwayat?batas=2")).json();
cek("parameter `batas` dihormati", batasKecil.riwayat.length === 2, String(batasKecil.riwayat.length));

const batasRaksasa = await (await ambil("/api/order/riwayat?batas=99999")).json();
cek("`batas` terlalu besar dibatasi (≤200)", batasRaksasa.riwayat.length <= 200, String(batasRaksasa.riwayat.length));

const batasRusak = await ambil("/api/order/riwayat?batas=abc");
cek("`batas` rusak tidak membuat 500", batasRusak.status === 200, `status ${batasRusak.status}`);

// ═══ 3. Invoice dari riwayat ════════════════════════════════════════════
console.log("\n── 3. Invoice bisa dibuka dari riwayat ──");

/*
  Inilah yang membuat riwayat berguna: setiap barisnya bisa dicetak.
  `kunci=1` adalah jalur staf — tanpa itu, endpoint menuntut sesi
  pelanggan dan menolak.
*/
for (const baris of j.riwayat.slice(0, 3)) {
  const inv = await ambil(`/api/order/invoice/${baris.id}?kunci=1`);
  const isi = await inv.json();
  cek(
    `invoice pesanan ${baris.nomor} terbuka`,
    inv.status === 200 && isi.invoice?.nomor === baris.nomor,
    `status ${inv.status}`,
  );
}

const tanpaKunci = await ambil(`/api/order/invoice/${j.riwayat[0].id}`);
cek("tanpa `kunci=1` invoice tidak diberikan cuma-cuma", tanpaKunci.status !== 200, `status ${tanpaKunci.status}`);

// ═══ 4. Terpasang di KEDUA portal ═══════════════════════════════════════
console.log("\n── 4. Ringkasan & riwayat ada di kasir DAN admin ──");

const bundelKasir = await bundelHalaman("/order/kasir");
const bundelAdmin = await bundelHalaman("/order/admin");

cek("bundel kasir terbaca", bundelKasir.length > 0);
cek("bundel admin terbaca", bundelAdmin.length > 0);

/*
  Yang dicari adalah POTONGAN TEKS yang hanya bisa muncul bila komponennya
  ikut dibundel. Mencari kata "Penjualan" saja tidak cukup: kata itu bisa
  berasal dari mana saja.
*/
for (const [nama, bundel] of [
  ["kasir", bundelKasir],
  ["admin", bundelAdmin],
]) {
  cek(
    `${nama}: memanggil /api/order/riwayat`,
    bundel.includes("/api/order/riwayat"),
  );
  cek(
    `${nama}: rangkuman penjualan ikut terbundel`,
    /Penjualan hari ini/.test(bundel) || /Rangkuman penjualan belum bisa dibaca/.test(bundel),
  );
  cek(
    `${nama}: daftar riwayat ikut terbundel`,
    /Riwayat pesanan/.test(bundel),
  );
  cek(
    `${nama}: tombol invoice ada di baris riwayat`,
    /Mulai invoice|Invoice<\/?|invoice tidak bisa dibuka/i.test(bundel) ||
      bundel.includes("Invoice gagal dibuka"),
  );
  cek(
    `${nama}: pencarian riwayat tersedia`,
    /Cari nomor pesanan atau nama tamu/.test(bundel),
  );
}

// Sebutan khas masing-masing portal — memastikan keduanya benar-benar
// memakai komponen bersama, bukan satu portal saja.
cek("kasir: ringkasan versi ringkas", bundelKasir.includes("Omzet hari ini"));
cek("admin: ringkasan versi penuh", bundelAdmin.includes("Rata-rata / pesanan"));
cek("admin: tab Penjualan ada", bundelAdmin.includes("Penjualan"));

// ═══ 5. Halaman tidak rusak ═════════════════════════════════════════════
console.log("\n── 5. Halaman tetap terbuka ──");

for (const jalur of ["/order/kasir", "/order/admin"]) {
  const h = await ambil(jalur);
  const html = await h.text();
  cek(`${jalur} menjawab 200`, h.status === 200, `status ${h.status}`);
  cek(`${jalur} bukan halaman galat`, !/Application error|Internal Server Error/.test(html));
}

const adminHtml = await (await ambil("/order/admin")).text();
cek("admin: tidak lagi menautkan panggilan kasir", !/panggilan/i.test(adminHtml));
cek("admin: tidak lagi punya tab bill", !/>\s*Bill\s*</.test(adminHtml));

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal > 0 ? 1 : 0);
