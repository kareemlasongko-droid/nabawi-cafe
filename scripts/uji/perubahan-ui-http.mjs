/**
 * Uji PERUBAHAN UI lewat HTTP sungguhan (server harus menyala).
 *
 * ── MENGAPA UJI INI ADA ───────────────────────────────────────────────
 *
 * Enam permintaan pemilik semuanya berbentuk "hilangkan" dan "urutkan".
 * Keduanya adalah perubahan yang TIDAK menghasilkan galat bila salah:
 *
 *   · fitur yang "dihapus" di satu tempat masih hidup di tempat lain;
 *   · urutan yang "diperbaiki" di API masih diacak ulang di komponen;
 *   · tombol riwayat yang tidak pernah muncul karena pembagiannya salah.
 *
 * Uji unit tidak melihat satu pun dari itu. Yang diuji di sini adalah
 * respons server yang benar-benar diterima browser.
 *
 * Jalankan (server menyala):
 *   BASE=http://127.0.0.1:3000 node scripts/uji/perubahan-ui-http.mjs
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
const teks = async (j) => (await ambil(j)).text();

// ═══ 1. Fitur panggilan hilang ═════════════════════════════════════════
console.log("\n── 1. Fitur panggilan/bill hilang ──");

const panggilGet = await ambil("/api/order/panggilan");
cek("endpoint panggilan (GET) tidak ada", panggilGet.status === 404, `status ${panggilGet.status}`);

const panggilPost = await ambil("/api/order/panggilan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ meja: "3", jenis: "bill" }),
});
cek("endpoint panggilan (POST) tidak ada", panggilPost.status === 404, `status ${panggilPost.status}`);

const pelayan = await (await ambil("/api/order/pelayan")).json();
cek("respons pelayan tidak lagi memuat `panggilan`", !("panggilan" in pelayan), Object.keys(pelayan).join(","));
cek("respons pelayan tetap memuat `siap`", Array.isArray(pelayan.siap));

const kasirJson = await (await ambil("/api/order/kasir")).json();
cek("respons kasir tidak lagi memuat `panggilan`", !("panggilan" in kasirJson), Object.keys(kasirJson).join(","));

const pelanggan = await teks("/order?meja=3");
cek("portal pelanggan: tidak ada tombol Panggil", !pelanggan.includes(">Panggil<"));
cek("portal pelanggan: tidak ada tombol Bill", !/>\s*Bill\s*</.test(pelanggan));
cek("portal pelanggan: tidak menyebut \"minta bill\"", !/minta bill/i.test(pelanggan));

const pelayanHtml = await teks("/order/pelayan");
cek("portal pelayan: tidak ada tab Panggilan", !pelayanHtml.includes(">Panggilan<"));

// ═══ 2. Urutan nomor meja ══════════════════════════════════════════════
console.log("\n── 2. Urutan nomor meja rapi ──");

const nomorKasir = kasirJson.meja.map((m) => m.nomor);
const numerik = [...nomorKasir].sort((a, b) => Number(a) - Number(b));
cek(
  "meja kasir urut 1,2,3,… bukan 1,10,11,2",
  nomorKasir.join(",") === numerik.join(","),
  nomorKasir.join(","),
);

// ═══ 3. Invoice menempel pada pesanan ══════════════════════════════════
console.log("\n── 3. Invoice bisa dibuka berkali-kali ──");

const sesi = "ui-" + Date.now();
const buat = await ambil("/api/order/pesanan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    meja: "3",
    sesi,
    nama: "Tamu UI",
    no_wa: "081200001111",
    lewatiJamBuka: true,
    metode_bayar: "kasir",
    /*
      Menu 3 mewajibkan satu pilihan. Mengirim `pilihan: []` akan ditolak
      server — dan itu benar: uji harus memesan seperti tamu sungguhan,
      bukan memintas aturan yang justru sedang diuji.
    */
    items: [{ menu_id: 3, jumlah: 1, catatan: null, pilihan: ["Sambal Matah"] }],
  }),
});
const dibuat = await buat.json();
cek("pesanan dibuat", buat.status === 200, `status ${buat.status}`);

if (buat.status === 200) {
  const id = dibuat.pesanan.id;

  /*
    Sebelum dibayar: invoice sudah bisa dibuka. Sesudah dibayar: masih
    bisa dibuka, BERKALI-KALI, dan nomornya tidak berubah. Dulu invoice
    hanya muncul sekali di layar kasir.
  */
  const sebelum1 = await ambil(`/api/order/invoice/${id}?sesi=${encodeURIComponent(sesi)}`);
  const isi1 = await sebelum1.json();
  cek("invoice bisa dibuka SEBELUM dibayar", sebelum1.status === 200, `status ${sebelum1.status}`);

  await ambil("/api/order/kasir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aksi: "bayar_tunai", pesanan_id: id, uang_pas: true, oleh: "kasir-uji" }),
  });

  const sesudahA = await (await ambil(`/api/order/invoice/${id}?sesi=${encodeURIComponent(sesi)}`)).json();
  const sesudahB = await (await ambil(`/api/order/invoice/${id}?sesi=${encodeURIComponent(sesi)}`)).json();
  cek("invoice masih bisa dibuka SETELAH dibayar", sesudahA.invoice?.status_bayar === "lunas", sesudahA.invoice?.status_bayar);
  cek("dibuka kedua kali tetap sama (menempel, bukan sekali pakai)", JSON.stringify(sesudahA) === JSON.stringify(sesudahB));
  cek("nomor invoice tidak berubah", sesudahA.invoice?.nomor === isi1.invoice?.nomor, sesudahA.invoice?.nomor);

  // Daftar pesanan pelanggan tetap menyertakan pesanan yang sudah lunas,
  // supaya tautan invoicenya masih bisa dijangkau dari riwayat.
  const daftar = await (await ambil(`/api/order/pesanan?sesi=${encodeURIComponent(sesi)}`)).json();
  cek("pesanan lunas tetap ada di daftar pesanan tamu", (daftar.pesanan ?? []).some((p) => p.id === id));
}

// ═══ 4. Riwayat di portal pelanggan ════════════════════════════════════
console.log("\n── 4. Hanya pesanan baru di depan, riwayat di tombol ──");

/*
  ── KENAPA DIPERIKSA DI BUNDEL, BUKAN DI HTML ────────────────────────

  Daftar pesanan dimuat di browser (`fetch` setelah mount), jadi HTML awal
  tidak pernah memuat "Riwayat pesanan" — mencocokkannya di HTML akan
  selalu gagal meski fiturnya benar. Yang bisa dibuktikan dari server:
  komponen yang memuat teks itu benar-benar sampai ke browser.
*/
const htmlPelanggan = await teks(`/order?meja=3&sesi=${encodeURIComponent(sesi)}`);
const chunkPelanggan = (htmlPelanggan.match(/\/_next\/static\/chunks\/app\/order\/page-[a-z0-9]+\.js/) ?? [])[0];
let bundlePelanggan = "";
if (chunkPelanggan) bundlePelanggan = await teks(chunkPelanggan);

cek("bundel portal pelanggan terbaca", bundlePelanggan.length > 0, chunkPelanggan ?? "tidak ditemukan");
cek("ada tombol Riwayat pesanan", bundlePelanggan.includes("Riwayat pesanan"));
cek("masih ada bagian Pesanan Anda", bundlePelanggan.includes("Pesanan Anda"));
/*
  Riwayat harus TERTUTUP saat halaman pertama dibuka. Kalau tidak,
  "riwayat di balik tombol" hanya memindahkan daftar, bukan
  menyembunyikannya.

  Yang diperiksa: variabel yang dipakai `aria-expanded` harus berasal dari
  state boolean yang diawali `false`. Minifier menamainya ulang (`es`),
  jadi yang dicari adalah POLANYA, bukan nama aslinya.
*/
const pasangan = /aria-expanded":([a-zA-Z_$][\w$]*)/.exec(bundlePelanggan);
const namaState = pasangan?.[1];
const awalFalse = namaState
  ? new RegExp(`\\[${namaState},[a-zA-Z_$][\\w$]*\\]=\\(0,[a-zA-Z_$][\\w$]*\\.useState\\)\\(!1\\)`).test(
      bundlePelanggan,
    )
  : false;
cek(
  "riwayat tertutup secara bawaan (state awal false)",
  Boolean(namaState) && awalFalse,
  `aria-expanded ← ${namaState ?? "tidak ditemukan"}`,
);

// ═══ 5. QR meja di admin ═══════════════════════════════════════════════
console.log("\n── 5. Tab Meja + QR di admin ──");

const admin = await teks("/order/admin");
cek("halaman admin terbuka", admin.length > 0);
cek("ada tab Meja", /<button[^>]*>Meja<\/button>/.test(admin) || admin.includes(">Meja<"));

/*
  Tab Meja di-render di klien, jadi isinya tidak ada di HTML awal. Yang
  bisa dipastikan dari server: waktu admin membuka tab, data meja SUDAH
  dikirim — kalau tidak, tab itu akan menampilkan "belum ada meja" untuk
  kafe yang jelas punya 20 meja.
*/
cek(
  "data meja ikut dikirim ke portal admin (untuk QR)",
  /"nomor":\s*"3"|nomor\\":\\"3\\"/.test(admin),
  "mencari nomor meja di props",
);

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal > 0 ? 1 : 0);
