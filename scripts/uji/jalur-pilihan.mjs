/**
 * Uji jalur add-on dari ADMIN sampai ke PESANAN PELANGGAN.
 *
 * Kenapa perlu server tiruan: sandbox kerja tidak punya akses internet, jadi
 * Supabase asli tidak bisa dipakai. Tanpa uji ini, seluruh keyakinan bahwa
 * "admin menambah add-on lalu pelanggan bisa memesan" hanyalah pembacaan
 * kode. Di sini yang diuji adalah fungsi asli `simpanMenu`/`buatPesanan`
 * terhadap tiruan PostgREST — jalurnya nyata, hanya databasenya tiruan.
 *
 * Yang TIDAK tercakup, dan harus jujur disebut: SQL PostgREST sungguhan,
 * tipe kolom `jsonb`, dan RLS. Itu tetap perlu dicoba sekali di production.
 *
 * Jalankan: node --experimental-strip-types scripts/uji/jalur-pilihan.mjs
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

// ── Tiruan PostgREST ─────────────────────────────────────────────────────
// Menyimpan tabel di memori. Cukup untuk 6 endpoint yang dipakai alur ini.
const TABEL = {
  meja: [{ id: 1, nomor: "5", area: "Teras", aktif: true, kapasitas: 4 }],
  menu: [
    {
      id: 100,
      nama: "Nasi Goreng Kebuli",
      deskripsi: "Kambing",
      harga: 40000,
      kategori_id: 1,
      foto_url: null,
      tersedia: true,
      urutan: 1,
      pilihan: [], // akan diubah oleh uji ini
    },
  ],
  tagihan: [],
  pesanan: [],
  item_pesanan: [],
  panggilan: [],
  meja_status: [],
};
let urut = 1;
const logTulis = [];

function cocok(baris, q) {
  // Dukungan minimal: id=eq.N , status=neq.lunas , meja_id=eq.N
  for (const bagian of q.split("&")) {
    const m = /^([a-z_]+)=(eq|neq)\.(.+)$/.exec(bagian);
    if (!m) continue;
    const [, kolom, op, nilai] = m;
    const sama = String(baris[kolom]) === decodeURIComponent(nilai);
    if (op === "eq" && !sama) return false;
    if (op === "neq" && sama) return false;
  }
  return true;
}
function ambilQ(url) {
  const u = new URL(url, "http://x");
  return u.searchParams.toString();
}

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

  if (req.method === "GET") {
    const baris = tabel.filter((b) => cocok(b, q));
    return res.end(JSON.stringify(baris));
  }
  if (req.method === "POST") {
    const isi = JSON.parse(badan || "{}");
    const masuk = Array.isArray(isi) ? isi : [isi];
    const dibuat = masuk.map((x) => {
      const b = { id: urut++, ...x, created_at: new Date().toISOString() };
      tabel.push(b);
      return b;
    });
    logTulis.push({ tabel: nama, metode: "POST", dibuat: dibuat[0] });
    res.statusCode = 201;
    return res.end(JSON.stringify(dibuat));
  }
  if (req.method === "PATCH") {
    const isi = JSON.parse(badan || "{}");
    const kena = tabel.filter((b) => cocok(b, q));
    for (const b of kena) Object.assign(b, isi);
    logTulis.push({ tabel: nama, metode: "PATCH", isi, jumlah: kena.length });
    return res.end(JSON.stringify(kena));
  }
  res.statusCode = 405;
  res.end("{}");
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

// Konfigurasi dibaca SAAT IMPOR, jadi env harus disetel sebelum import.
process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
process.env.SUPABASE_SERVICE_KEY = "kunci-uji-lokal";

const { simpanMenu } = await import("../../app/lib/order/menu-admin.ts");
const { buatPesanan } = await import("../../app/lib/order/data.ts");

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

console.log("── Admin menambah add-on ──");
const r1 = await simpanMenu(100, {
  pilihan: [
    { nama: "Sambal Matah", tambah: 0 },
    { nama: "Salted Egg", tambah: 8000 },
  ],
});
cek("PATCH add-on berhasil", r1.ok === true, r1.ok ? "" : r1.pesan);
const tersimpan = TABEL.menu[0].pilihan;
cek("tersimpan 2 opsi", tersimpan.length === 2, JSON.stringify(tersimpan));
cek("tambahan harga tersimpan", tersimpan[1].tambah === 8000);

console.log("\n── PATCH lain tidak menghapus add-on ──");
// Ini kesalahan klasik: kasir menandai menu habis, add-on ikut lenyap.
await simpanMenu(100, { tersedia: true });
cek("add-on masih ada setelah ubah status", TABEL.menu[0].pilihan.length === 2);

console.log("\n── Menghapus semua add-on ──");
await simpanMenu(100, { pilihan: null });
cek("pilihan null mengosongkan", TABEL.menu[0].pilihan.length === 0);

// Kembalikan add-on untuk uji pemesanan
await simpanMenu(100, {
  pilihan: [
    { nama: "Sambal Matah", tambah: 0 },
    { nama: "Salted Egg", tambah: 8000 },
  ],
});

console.log("\n── Pelanggan memesan add-on ──");
const pesan = (pilihan) =>
  buatPesanan({
    meja: "5",
    sesi: "uji-" + Math.random(),
    nama: "Tamu",
    items: [{ menu_id: 100, jumlah: 1, catatan: null, pilihan }],
  });

const tanpa = await pesan([]);
cek("tanpa pilih add-on ditolak", tanpa.ok === false, tanpa.ok ? "" : tanpa.pesan);

const asing = await pesan(["Sambal Nuklir"]);
cek("add-on asing ditolak", asing.ok === false);

const dengan = await pesan(["Salted Egg"]);
cek("pesan dengan add-on berhasil", dengan.ok === true, dengan.ok ? "" : dengan.pesan);
cek("harga satuan = 40.000 + 8.000", dengan.ok && dengan.data.items[0].harga_satuan === 48000, dengan.ok ? `Rp${dengan.data.items[0].harga_satuan}` : "");
cek("add-on tercatat di pesanan", dengan.ok && dengan.data.items[0].pilihan[0]?.nama === "Salted Egg");

const gratis = await pesan(["Sambal Matah"]);
cek("add-on tanpa tambahan harga tetap bisa", gratis.ok === true);
cek("harga satuan tetap 40.000", gratis.ok && gratis.data.items[0].harga_satuan === 40000);

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
server.close();
if (gagal > 0) process.exit(1);
