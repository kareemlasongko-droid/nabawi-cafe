/**
 * Uji INVOICE lewat HTTP sungguhan (server harus menyala).
 *
 * ── APA YANG DIBUKTIKAN UJI INI YANG TIDAK DIBUKTIKAN UJI UNIT ───────
 *
 * `scripts/uji/invoice.mjs` menguji `ambilInvoice()` dengan PostgREST
 * tiruan di dalam proses. Itu tidak membuktikan bahwa ROUTE-nya benar:
 * apakah `sesi` dibaca, apakah 403 benar-benar dikirim, apakah halaman
 * cetak memuat nomor invoice.
 *
 * Yang diuji di sini adalah RANTAI yang benar-benar dilalui pengguna:
 *
 *     buat pesanan → bayar di kasir → GET invoice (kasir)
 *                                    → GET invoice (pelanggan, sesi benar)
 *                                    → GET invoice (pelanggan, sesi salah)
 *                                    → GET halaman /order/invoice/:id
 *
 * Yang terakhir penting: invoice yang API-nya benar tetapi halamannya
 * kosong tetap tidak berguna bagi tamu.
 *
 * Jalankan (server menyala):
 *   BASE=http://127.0.0.1:3000 node scripts/uji/invoice-http.mjs
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

const json = (j, o, metode = "POST") =>
  fetch(BASE + j, {
    method: metode,
    headers: { "Content-Type": "application/json" },
    body: o === undefined ? undefined : JSON.stringify(o),
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

const sesi = "invoice-http-" + Date.now();

// ═══ 1. Pesanan baru ═══════════════════════════════════════════════════
console.log("\n── 1. Pesanan baru (belum dibayar) ──");

const dibuat = await json("/api/order/pesanan", {
  meja: "9",
  sesi,
  nama: "Tamu Invoice",
  no_wa: "081298765432",
  lewatiJamBuka: true,
  metode_bayar: "kasir",
  items: [{ menu_id: 3, jumlah: 2, catatan: null, pilihan: ["Salted Egg"] }],
});
cek("pesanan dibuat", dibuat.status === 200, `status ${dibuat.status}`);
if (dibuat.status !== 200) {
  console.log(`\nBerhenti: ${JSON.stringify(dibuat.data)}`);
  console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
  process.exit(1);
}

const id = dibuat.data.pesanan.id;
const nomor = dibuat.data.pesanan.nomor;
const total = dibuat.data.tagihan.total;
console.log(`  (pesanan ${id} · ${nomor} · total ${total})`);

/*
  Sebelum lunas pun invoice harus bisa dibuka lewat jalur pelanggan —
  tamu yang memilih "bayar di kasir" justru butuh rinciannya lebih dulu.
*/
const sebelum = await fetch(`${BASE}/api/order/invoice/${id}?sesi=${encodeURIComponent(sesi)}`);
const isiSebelum = await sebelum.json();
cek("invoice bisa dibuka sebelum lunas", sebelum.status === 200, `status ${sebelum.status}`);
cek("status terbaca belum lunas", /menunggu/i.test(isiSebelum.invoice?.status_bayar ?? ""), isiSebelum.invoice?.status_bayar);
cek("nomor invoice = nomor pesanan", isiSebelum.invoice?.nomor === nomor, isiSebelum.invoice?.nomor);
cek("total invoice = total tagihan", isiSebelum.invoice?.total === total, `${isiSebelum.invoice?.total} vs ${total}`);
cek("item & add-on terbawa", isiSebelum.invoice?.items?.[0]?.pilihan?.[0]?.nama === "Salted Egg");
cek("uang diterima belum ada", isiSebelum.invoice?.diterima === null);

// ═══ 2. Kasir melunasi ═════════════════════════════════════════════════
console.log("\n── 2. Kasir melunasi (uang pas) ──");

const bayar = await json("/api/order/kasir", {
  aksi: "bayar_tunai",
  pesanan_id: id,
  uang_pas: true,
  oleh: "kasir-uji",
});
cek("pembayaran tercatat", bayar.status === 200, `status ${bayar.status}`);

// ═══ 3. Invoice jalur kasir ════════════════════════════════════════════
console.log("\n── 3. Invoice jalur kasir (?kunci=1) ──");

const kasir = await fetch(`${BASE}/api/order/invoice/${id}?kunci=1`);
const isiKasir = await kasir.json();
cek("kasir bisa membuka invoice", kasir.status === 200, `status ${kasir.status}`);
cek("status lunas", isiKasir.invoice?.status_bayar === "lunas", isiKasir.invoice?.status_bayar);
cek("metode tunai", isiKasir.invoice?.metode === "tunai", isiKasir.invoice?.metode);
cek("uang diterima = total (uang pas)", isiKasir.invoice?.diterima === total, `${isiKasir.invoice?.diterima} vs ${total}`);
cek("kembalian 0", isiKasir.invoice?.kembalian === 0, String(isiKasir.invoice?.kembalian));
cek("kasir yang menerima tercatat", Boolean(isiKasir.invoice?.kasir), isiKasir.invoice?.kasir);
cek(
  "rincian lengkap: subtotal + layanan + pajak + pembulatan = total",
  isiKasir.invoice &&
    isiKasir.invoice.subtotal + isiKasir.invoice.layanan + isiKasir.invoice.pajak + isiKasir.invoice.pembulatan ===
      isiKasir.invoice.total,
  isiKasir.invoice &&
    `${isiKasir.invoice.subtotal}+${isiKasir.invoice.layanan}+${isiKasir.invoice.pajak}+${isiKasir.invoice.pembulatan}=${isiKasir.invoice.total}`,
);

// ═══ 4. Invoice jalur pelanggan ════════════════════════════════════════
console.log("\n── 4. Invoice jalur pelanggan ──");

const pelanggan = await fetch(`${BASE}/api/order/invoice/${id}?sesi=${encodeURIComponent(sesi)}`);
const isiPelanggan = await pelanggan.json();
cek("pelanggan bisa membuka invoice", pelanggan.status === 200, `status ${pelanggan.status}`);

/*
  INI YANG PALING PENTING: angka yang dilihat tamu harus SAMA dengan angka
  yang dilihat kasir. Dua jalur berbeda yang menghasilkan dua total
  berbeda adalah cara tercepat kehilangan kepercayaan tamu.
*/
cek(
  "angka pelanggan identik dengan kasir",
  JSON.stringify(isiPelanggan.invoice) === JSON.stringify(isiKasir.invoice),
);

const sesiSalah = await fetch(`${BASE}/api/order/invoice/${id}?sesi=orang-lain`);
const isiSalah = await sesiSalah.json();
cek("sesi lain ditolak 403", sesiSalah.status === 403, `status ${sesiSalah.status}`);
cek(
  "penolakan TIDAK membocorkan nama/nomor WA",
  !JSON.stringify(isiSalah).includes("6281298765432") && !JSON.stringify(isiSalah).includes("Tamu Invoice"),
  JSON.stringify(isiSalah).slice(0, 80),
);

const tanpaSesi = await fetch(`${BASE}/api/order/invoice/${id}`);
cek("tanpa sesi ditolak 400", tanpaSesi.status === 400, `status ${tanpaSesi.status}`);

// ═══ 5. Halaman cetak ══════════════════════════════════════════════════
console.log("\n── 5. Halaman /order/invoice/:id (yang dicetak) ──");

const halaman = await fetch(`${BASE}/order/invoice/${id}?sesi=${encodeURIComponent(sesi)}`);
const html = await halaman.text();
cek("halaman terbuka", halaman.status === 200, `status ${halaman.status}`);
cek("memuat nomor invoice", html.includes(nomor), nomor);
cek("memuat total", html.includes(total.toLocaleString("id-ID")), total.toLocaleString("id-ID"));
cek("memuat nama tamu", html.includes("Tamu Invoice"));
cek("memuat penanda cetak (data-invoice)", html.includes("data-invoice"));
cek("memuat tombol cetak", html.includes("Cetak / PDF"));
cek("status lunas tercetak", /Lunas/.test(html));
cek("tidak diindeks mesin pencari", /noindex/i.test(html));

const halamanSalah = await fetch(`${BASE}/order/invoice/${id}?sesi=orang-lain`);
const htmlSalah = await halamanSalah.text();
cek("halaman sesi salah tidak memuat invoice", !htmlSalah.includes(nomor));

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal > 0 ? 1 : 0);
