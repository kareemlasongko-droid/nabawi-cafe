/**
 * Uji INVOICE — terhadap PostgREST TIRUAN.
 *
 * ── YANG DIJAGA UJI INI ─────────────────────────────────────────────
 *
 * Invoice adalah dokumen yang dipegang tamu. Kesalahan di sini tidak
 * terlihat sebagai "galat" — ia terlihat sebagai angka yang berbeda dari
 * yang diingat tamu, atau nomor WhatsApp tamu lain yang terbaca orang.
 * Karena itu yang diuji bukan hanya "berhasil", melainkan:
 *
 *   · nomor invoice sama dengan nomor pesanan (bisa disebutkan tamu);
 *   · angka diambil dari baris tagihan, BUKAN dihitung ulang;
 *   · pesanan tanpa tagihan tetap menghasilkan total masuk akal, bukan Rp0;
 *   · sesi perangkat lain DITOLAK (403), bukan diberi invoice;
 *   · item yang sama digabung, yang berbeda tidak;
 *   · label metode & waktu memakai bahasa dan zona yang benar.
 *
 * Jalankan:
 *   node --experimental-strip-types --no-warnings \
 *        --import ./scripts/uji/ts-hook.mjs scripts/uji/invoice.mjs
 */
import { createServer } from "node:http";

// ── Tiruan PostgREST ─────────────────────────────────────────────────────
const TABEL = {
  meja: [{ id: 7, nomor: "12", area: "Taman", aktif: true, kapasitas: 4, status: "ada_pesanan" }],
  pesanan: [],
  tagihan: [],
  item_pesanan: [],
  pembayaran: [],
};

let urut = 5000;

function cocok(baris, q) {
  for (const bagian of q.split("&")) {
    const m = /^([a-z_]+)=(eq|neq|lt|in|is)\.(.+)$/.exec(bagian);
    if (!m) continue;
    const [, kolom, op, mentah] = m;
    const nilai = decodeURIComponent(mentah);
    const kini = String(baris[kolom]);
    if (op === "eq" && kini !== nilai) return false;
    if (op === "neq" && kini === nilai) return false;
    if (op === "in") {
      const daftar = nilai.replace(/^\(|\)$/g, "").split(",");
      if (!daftar.includes(kini)) return false;
    }
    if (op === "is" && nilai === "null" && baris[kolom] != null) return false;
  }
  return true;
}

const ambilQ = (url) => new URL(url, "http://x").searchParams.toString();

const server = createServer(async (req, res) => {
  let badan = "";
  for await (const keping of req) badan += keping;

  const q = ambilQ(req.url);
  const nama = req.url.split("/rest/v1/")[1]?.split("?")[0];
  const tabel = TABEL[nama];

  res.setHeader("Content-Type", "application/json");
  if (!tabel) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ message: `tabel ${nama} tidak ada` }));
  }
  if (req.method === "GET") return res.end(JSON.stringify(tabel.filter((b) => cocok(b, q))));
  if (req.method === "POST") {
    const isi = JSON.parse(badan || "{}");
    const masuk = Array.isArray(isi) ? isi : [isi];
    const dibuat = masuk.map((x) => {
      const b = { id: urut++, ...x };
      tabel.push(b);
      return b;
    });
    res.statusCode = 201;
    return res.end(JSON.stringify(dibuat));
  }
  res.statusCode = 405;
  res.end("{}");
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
process.env.SUPABASE_SERVICE_KEY = "kunci-uji-lokal";

const { ambilInvoice, labelMetode, waktuInvoice } = await import(
  "../../app/lib/order/invoice.ts"
);

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

/**
 * Invoice dengan angka tagihan yang SENGAJA berbeda dari jumlah item.
 *
 * Subtotal item memang 40.000 sedangkan tagihan.subtotal 99.000. Kalau
 * kode menghitung ulang dari item, invoice menampilkan 40.000 dan uji ini
 * gagal — itulah gunanya: angka yang tercetak harus angka yang ditagihkan.
 */
console.log("\n── Invoice pesanan lunas ──");

const pesananLunas = {
  id: 1,
  nomor: "M12-1042-77",
  meja_id: 7,
  tagihan_id: 11,
  status: "diproses",
  status_bayar: "lunas",
  nama_pemesan: "Rani",
  no_wa: "+6281234567890",
  sesi_id: "sesi-rani",
  metode_bayar: "kasir",
  total_item: 3,
  created_at: "2026-11-02T03:15:00.000Z",
  dibayar_at: "2026-11-02T03:41:00.000Z",
  kedaluwarsa_at: null,
};
TABEL.pesanan.push(pesananLunas);
TABEL.tagihan.push({
  id: 11,
  meja_id: 7,
  status: "lunas",
  subtotal: 99_000,
  layanan: 2_000,
  pajak: 10_890,
  pembulatan: 110,
  total: 112_000,
  dibuka_at: "2026-11-02T03:15:00.000Z",
  ditutup_at: "2026-11-02T03:41:00.000Z",
  kasir: "Rani",
});
TABEL.pembayaran.push({
  id: 1,
  tagihan_id: 11,
  metode: "tunai",
  diterima: 120_000,
  kembalian: 8_000,
  kasir: "Kasir 1",
  invoice_number: "DOKU-8891",
  gerbang: "kasir",
  status: "settlement",
});

// Dua baris identik (harus digabung) + satu baris pilihan berbeda.
const barisItem = (id, nama, jumlah, harga, pilihan) => ({
  id,
  pesanan_id: 1,
  menu_id: 100,
  nama_saat_pesan: nama,
  jumlah,
  harga_satuan: harga,
  catatan: null,
  pilihan,
});
TABEL.item_pesanan.push(
  barisItem(1, "Kopi Mint", 1, 20_000, [{ nama: "Dingin", tambah: 0 }]),
  barisItem(2, "Kopi Mint", 2, 20_000, [{ nama: "Dingin", tambah: 0 }]),
  barisItem(3, "Kopi Mint", 1, 20_000, [{ nama: "Panas", tambah: 0 }]),
);

const a = await ambilInvoice(1, { sesi: "sesi-rani" });
cek("invoice terbuka untuk sesi yang benar", a.ok === true, a.ok ? "" : a.pesan);

if (a.ok) {
  const inv = a.data;
  cek("nomor invoice = nomor pesanan", inv.nomor === "M12-1042-77", inv.nomor);
  cek("meja terbaca sebagai nomor, bukan id", inv.meja === "12", inv.meja);
  cek("nama & WA ikut tercetak", inv.nama_pemesan === "Rani" && inv.no_wa === "+6281234567890");
  cek(
    "subtotal diambil dari tagihan, bukan dihitung ulang dari item",
    inv.subtotal === 99_000,
    String(inv.subtotal),
  );
  cek("total = angka tagihan", inv.total === 112_000, String(inv.total));
  cek("layanan, pajak, pembulatan ikut", inv.layanan === 2_000 && inv.pajak === 10_890 && inv.pembulatan === 110);
  cek("status bayar terbaca lunas", inv.status_bayar === "lunas");
  cek("metode = kanal yang dipakai (tunai), bukan pilihan tamu (kasir)", inv.metode === "tunai", String(inv.metode));
  cek("uang diterima & kembalian tercatat", inv.diterima === 120_000 && inv.kembalian === 8_000);
  cek("kasir yang menerima tercatat", inv.kasir === "Kasir 1", String(inv.kasir));
  cek("ref DOKU tercatat terpisah dari nomor invoice", inv.referensi_gerbang === "DOKU-8891");

  // Item
  cek("3 baris item menjadi 2 baris invoice", inv.items.length === 2, `${inv.items.length} baris`);
  const dingin = inv.items.find((i) => i.pilihan.some((p) => p.nama === "Dingin"));
  cek("baris identik digabung jumlahnya", dingin?.jumlah === 3, `${dingin?.jumlah}×`);
  cek("harga baris ikut hasil gabung", dingin?.harga_baris === 60_000, String(dingin?.harga_baris));
  const panas = inv.items.find((i) => i.pilihan.some((p) => p.nama === "Panas"));
  cek("pilihan berbeda TIDAK digabung", panas?.jumlah === 1, `${panas?.jumlah}×`);
}

// ═══ Sesi ═══════════════════════════════════════════════════════════════
console.log("\n── Pemeriksaan sesi ──");

const salah = await ambilInvoice(1, { sesi: "sesi-orang-lain" });
cek("sesi perangkat lain DITOLAK", salah.ok === false && salah.status === 403, salah.ok ? "diberi invoice" : salah.pesan);

const tanpaSesi = await ambilInvoice(1);
cek("tanpa sesi (jalur kasir) boleh", tanpaSesi.ok === true, tanpaSesi.ok ? "" : tanpaSesi.pesan);

const takAda = await ambilInvoice(999_999, { sesi: "sesi-rani" });
cek("pesanan tidak ada → 404", takAda.ok === false && takAda.status === 404, takAda.ok ? "" : String(takAda.status));

// ═══ Pesanan tanpa tagihan (data lama) ═════════════════════════════════
console.log("\n── Pesanan tanpa tagihan ──");

TABEL.pesanan.push({
  id: 2,
  nomor: "M12-1043-78",
  meja_id: 7,
  tagihan_id: null,
  status: "menunggu_konfirmasi",
  status_bayar: "menunggu",
  nama_pemesan: null,
  no_wa: null,
  sesi_id: "sesi-budi",
  metode_bayar: "kasir",
  total_item: 2,
  created_at: "2026-11-02T04:00:00.000Z",
  dibayar_at: null,
  kedaluwarsa_at: null,
});
TABEL.item_pesanan.push(
  { id: 4, pesanan_id: 2, menu_id: 100, nama_saat_pesan: "Roti Bakar", jumlah: 2, harga_satuan: 25_000, catatan: null, pilihan: null },
);

const b = await ambilInvoice(2, { sesi: "sesi-budi" });
cek("tanpa tagihan tetap bisa dibuat", b.ok === true, b.ok ? "" : b.pesan);
if (b.ok) {
  cek("subtotal dihitung dari item", b.data.subtotal === 50_000, String(b.data.subtotal));
  cek("total tidak Rp0", b.data.total === 50_000, String(b.data.total));
  cek("metode menampilkan pilihan tamu, bukan kosong", b.data.metode === "kasir", String(b.data.metode));
  cek("belum lunas → tidak ada uang diterima", b.data.diterima === null && b.data.kembalian === null);
  cek("nama kosong tidak jadi teks 'null'", b.data.nama_pemesan === null);
  cek("tanpa pilihan → array kosong, bukan null", Array.isArray(b.data.items[0].pilihan) && b.data.items[0].pilihan.length === 0);
}

// ═══ Label & waktu ═════════════════════════════════════════════════════
console.log("\n── Label & waktu ──");

cek("tunai → Tunai", labelMetode("tunai") === "Tunai");
cek("doku → bahasa tamu, bukan istilah internal", labelMetode("doku") === "Bayar online (DOKU)");
cek("qris_kasir → jelas tempatnya", labelMetode("qris_kasir") === "QRIS di kasir");
cek("pilihan tamu yang belum dibayar tidak menyamar jadi metode", /Belum dibayar/.test(labelMetode("kasir")));
cek("null → tanda pisah, bukan 'null'", labelMetode(null) === "—");
cek("nilai asing dikembalikan apa adanya", labelMetode("voucher") === "voucher");

// 2026-11-02T03:41:00Z = 10.41 WIB (bukan 03.41).
cek(
  "waktu memakai Asia/Jakarta, bukan zona perangkat",
  waktuInvoice("2026-11-02T03:41:00.000Z") === "02 Nov 2026 · 10.41",
  waktuInvoice("2026-11-02T03:41:00.000Z"),
);
cek("waktu kosong → tanda pisah", waktuInvoice(null) === "—");
cek("tanggal rusak → tanda pisah, bukan 'Invalid Date'", waktuInvoice("bukan-tanggal") === "—");

server.close();
console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal > 0 ? 1 : 0);
