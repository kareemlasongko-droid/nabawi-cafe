/**
 * Uji ALUR LUNAS ujung ke ujung terhadap PostgREST TIRUAN.
 *
 * ── KENAPA UJI INI ADA ──────────────────────────────────────────────
 *
 * Pemilik melaporkan: pesanan dibayar di kasir, lalu tidak tersimpan dan
 * tidak muncul di dapur. Bug seperti ini tidak pernah tertangkap oleh uji
 * yang memakai fungsi murni — karena rantai yang rusak justru
 * SAMBUNGANNYA:
 *
 *     buatPesanan → bayarTunaiKasir → ambilPesananAktif
 *
 * Uji ini menempuh rantai itu dengan fungsi ASLI, dan memeriksa hasilnya
 * di setiap sambungan. Yang dicari bukan "tidak ada galat", melainkan:
 * apakah pesanan benar-benar TERLIHAT oleh kasir dan dapur.
 *
 * ── YANG TIDAK TERCAKUP ─────────────────────────────────────────────
 *
 * SQL PostgREST sungguhan, tipe kolom, constraint, dan RLS. Itu sudah
 * diperiksa terpisah terhadap database asli. Uji ini menjaga LOGIKA alur.
 *
 * Jalankan:
 *   node --experimental-strip-types --import ./scripts/uji/ts-hook.mjs \
 *        scripts/uji/alur-lunas.mjs
 */
import { createServer } from "node:http";

// ── Tiruan PostgREST ─────────────────────────────────────────────────────
const TABEL = {
  meja: [
    { id: 1, nomor: "5", area: "Teras", aktif: true, kapasitas: 4, status: "kosong" },
  ],
  menu: [
    {
      id: 100,
      nama: "Nasi Goreng Kebuli",
      deskripsi: null,
      harga: 40000,
      kategori_id: 1,
      foto_url: null,
      tersedia: true,
      urutan: 1,
      rekomendasi: false,
      pilihan: null,
    },
  ],
  kategori_menu: [{ id: 1, nama: "Nasi", urutan: 1, ikon: null }],
  tagihan: [],
  pesanan: [],
  item_pesanan: [],
  pembayaran: [],
  log_perubahan: [],
  pengaturan: [
    { kunci: "pajak_persen", nilai: "11" },
    { kunci: "layanan_rp", nilai: "2000" },
    { kunci: "pembulatan", nilai: "100" },
    { kunci: "batas_bayar_menit", nilai: "15" },
  ],
};

let urut = 1000;

/**
 * Dukungan query PostgREST yang DIPAKAI kode ini saja.
 * Sengaja sempit: tiruan yang terlalu pintar menyembunyikan bug.
 */
function cocok(baris, q) {
  for (const bagian of q.split("&")) {
    const m = /^([a-z_]+)=(eq|neq|lt|in|is)\.(.+)$/.exec(bagian);
    if (!m) continue;
    const [, kolom, op, mentah] = m;
    const nilai = decodeURIComponent(mentah);
    const kini = String(baris[kolom]);

    if (op === "eq" && kini !== nilai) return false;
    if (op === "neq" && kini === nilai) return false;
    if (op === "lt" && !(baris[kolom] != null && new Date(baris[kolom]) < new Date(nilai))) {
      return false;
    }
    if (op === "is" && nilai === "null" && baris[kolom] != null) return false;
    if (op === "in") {
      const daftar = nilai.replace(/^\(|\)$/g, "").split(",");
      if (!daftar.includes(kini)) return false;
    }
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
      const b = { id: urut++, ...x, created_at: new Date().toISOString() };
      // Default kolom yang meniru skema sungguhan.
      if (nama === "pesanan" && b.status === undefined) b.status = "menunggu_konfirmasi";
      tabel.push(b);
      return b;
    });
    res.statusCode = 201;
    return res.end(JSON.stringify(dibuat));
  }

  if (req.method === "PATCH") {
    const isi = JSON.parse(badan || "{}");
    const kena = tabel.filter((b) => cocok(b, q));
    for (const b of kena) Object.assign(b, isi);
    return res.end(JSON.stringify(kena));
  }

  if (req.method === "DELETE") {
    const kena = tabel.filter((b) => cocok(b, q));
    for (const b of kena) tabel.splice(tabel.indexOf(b), 1);
    return res.end(JSON.stringify(kena));
  }

  res.statusCode = 405;
  res.end("{}");
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

// Env HARUS disetel sebelum impor: `db()` membacanya lewat fungsi, tetapi
// lebih aman tidak bergantung pada urutan.
process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
process.env.SUPABASE_SERVICE_KEY = "kunci-uji-lokal";

const { buatPesanan, bayarTunaiKasir, ambilPesananAktif, sapuKedaluwarsa } = await import(
  "../../app/lib/order/data.ts"
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

// ═══ 1. Checkout memilih "bayar di kasir" ═══════════════════════════════
console.log("\n── Checkout: pilih bayar di kasir ──");

const hasil = await buatPesanan({
  meja: "5",
  sesi: "uji-lunas-1",
  nama: "Tamu Uji",
  no_wa: "+6281200000001",
  items: [{ menu_id: 100, jumlah: 2, catatan: null, pilihan: [] }],
  batasBayarMenit: 15,
  metode_bayar: "kasir",
});

cek("pesanan tersimpan", hasil.ok === true, hasil.ok ? "" : hasil.pesan);
if (!hasil.ok) {
  console.log("\nBerhenti: pesanan tidak bisa dibuat, sisa uji tidak bermakna.");
  console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
  server.close();
  process.exit(1);
}

const pesanan = hasil.data.pesanan;

/*
  BUG YANG PERNAH TERJADI: tagihan dibuat SEBELUM pesanan, sehingga
  kegagalan apa pun meninggalkan tagihan kosong tanpa pesanan. Sekarang
  urutannya dibalik — dan yang diuji di sini adalah AKIBATNYA: pesanan
  harus punya tagihan_id yang benar-benar ada di tabel tagihan.
*/
cek("pesanan punya tagihan_id", Boolean(pesanan.tagihan_id), String(pesanan.tagihan_id));

const tagihanTersimpan = TABEL.tagihan.find((t) => t.id === pesanan.tagihan_id);
cek("tagihan itu ADA di tabel", Boolean(tagihanTersimpan));

const tagihanYatim = TABEL.tagihan.filter(
  (t) => !TABEL.pesanan.some((p) => p.tagihan_id === t.id),
);
cek("tidak ada tagihan yatim tertinggal", tagihanYatim.length === 0, `${tagihanYatim.length} baris`);

cek("status_bayar awal menunggu", pesanan.status_bayar === "menunggu", pesanan.status_bayar);
cek("metode pilihan tamu tersimpan", pesanan.metode_bayar === "kasir", String(pesanan.metode_bayar));
cek("total tagihan dihitung", hasil.data.tagihan.total > 0, `Rp${hasil.data.tagihan.total}`);
cek("item tersimpan", hasil.data.items.length === 1);

// ═══ 2. Belum lunas → TIDAK boleh terlihat dapur ═══════════════════════
console.log("\n── Sebelum dibayar ──");
const sebelum = await ambilPesananAktif();
cek("daftar aktif terbaca", sebelum.ok === true);
cek(
  "pesanan BELUM lunas tidak muncul (dapur tidak memasak yang belum dibayar)",
  sebelum.ok && !sebelum.data.some((x) => x.id === pesanan.id),
);

// ═══ 3. Kasir menerima tunai (uang pas) ════════════════════════════════
console.log("\n── Kasir: terima tunai ──");
const bayar = await bayarTunaiKasir({
  pesanan_id: pesanan.id,
  diterima: 0,
  uang_pas: true,
  kasir: "uji",
});

cek("pembayaran tunai berhasil", bayar.ok === true, bayar.ok ? "" : bayar.pesan);
if (!bayar.ok) {
  console.log("\nBerhenti: pembayaran gagal — inilah keluhan pemilik.");
  console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
  server.close();
  process.exit(1);
}

cek("kembalian 0 untuk uang pas", bayar.data.kembalian === 0, String(bayar.data.kembalian));
cek("status_bayar jadi lunas", bayar.data.pesanan.status_bayar === "lunas");
cek("dibayar_at terisi", Boolean(bayar.data.pesanan.dibayar_at));
cek("metode tercatat 'tunai'", bayar.data.pesanan.metode_bayar === "tunai");

// ═══ 4. Sesudah lunas → WAJIB terlihat kasir & dapur ═══════════════════
console.log("\n── Setelah dibayar: terlihat di kasir & dapur? ──");
const sesudah = await ambilPesananAktif();
cek("daftar aktif terbaca", sesudah.ok === true);

const terlihat = sesudah.ok ? sesudah.data.find((x) => x.id === pesanan.id) : null;
cek("pesanan LUNAS muncul di daftar aktif", Boolean(terlihat));
cek("membawa nomor meja untuk dapur", Boolean(terlihat?.meja_nomor), terlihat?.meja_nomor);
cek("membawa item untuk tiket dapur", (terlihat?.items?.length ?? 0) === 1);
cek(
  "item membawa nama & jumlah",
  terlihat?.items?.[0]?.nama_saat_pesan === "Nasi Goreng Kebuli" &&
    terlihat?.items?.[0]?.jumlah === 2,
  `${terlihat?.items?.[0]?.nama_saat_pesan} x${terlihat?.items?.[0]?.jumlah}`,
);

const tagSetelah = TABEL.tagihan.find((t) => t.id === pesanan.tagihan_id);
cek("tagihan ikut lunas", tagSetelah?.status === "lunas", String(tagSetelah?.status));

const barisBayar = TABEL.pembayaran.filter((b) => b.tagihan_id === pesanan.tagihan_id);
cek("pembayaran tercatat", barisBayar.length === 1, `${barisBayar.length} baris`);
cek("nominal pembayaran = total tagihan", barisBayar[0]?.diterima === tagSetelah?.total);

const log = TABEL.log_perubahan.filter((l) => l.entitas_id === String(pesanan.id));
cek("perubahan tercatat di log", log.length > 0, `${log.length} baris`);

// ═══ 5. Penyapu tidak boleh menyentuh pesanan lunas ════════════════════
console.log("\n── Penyapu kedaluwarsa ──");
const disapu = await sapuKedaluwarsa();
cek("penyapu berjalan", typeof disapu === "number");
cek(
  "pesanan lunas TIDAK dibatalkan penyapu",
  TABEL.pesanan.find((p) => p.id === pesanan.id)?.status_bayar === "lunas",
);

// ═══ 6. Pesanan kedaluwarsa: dibatalkan benar, tagihan tidak "lunas" ═══
console.log("\n── Pesanan kedaluwarsa ──");
const basi = await buatPesanan({
  meja: "5",
  sesi: "uji-lunas-2",
  nama: "Tamu Basi",
  no_wa: "+6281200000002",
  items: [{ menu_id: 100, jumlah: 1, catatan: null, pilihan: [] }],
  batasBayarMenit: 15,
  metode_bayar: "kasir",
});

if (basi.ok) {
  // Mundurkan batas waktunya, seperti pesanan yang ditinggal 15 menit.
  const p = TABEL.pesanan.find((x) => x.id === basi.data.pesanan.id);
  p.kedaluwarsa_at = new Date(Date.now() - 60_000).toISOString();

  const jumlahSapu = await sapuKedaluwarsa();
  cek("penyapu membatalkan pesanan basi", jumlahSapu >= 1, `${jumlahSapu} pesanan`);

  const pSetelah = TABEL.pesanan.find((x) => x.id === basi.data.pesanan.id);
  cek("status jadi dibatalkan", pSetelah?.status === "dibatalkan", String(pSetelah?.status));
  cek("status_bayar jadi kedaluwarsa", pSetelah?.status_bayar === "kedaluwarsa");
  cek("dibatalkan_oleh = sistem", pSetelah?.dibatalkan_oleh === "sistem");

  /*
    Tagihan pesanan kedaluwarsa TIDAK boleh ditandai "lunas". Kalau
    ditandai lunas, laporan pendapatan menghitung uang yang tidak pernah
    masuk — selisih yang baru ketahuan saat tutup harian.
  */
  const t = TABEL.tagihan.find((x) => x.id === basi.data.pesanan.tagihan_id);
  cek("tagihan TIDAK ditandai lunas", t?.status !== "lunas", String(t?.status));

  const aktif = await ambilPesananAktif();
  cek(
    "pesanan kedaluwarsa tidak muncul di dapur",
    aktif.ok && !aktif.data.some((x) => x.id === basi.data.pesanan.id),
  );
} else {
  cek("pesanan basi bisa dibuat", false, basi.pesan);
}

// ═══ 7. Pesanan tanpa tagihan tetap bisa dibayar (pemulihan) ══════════
console.log("\n── Pesanan kehilangan tagihan (pemulihan) ──");
const tanpa = await buatPesanan({
  meja: "5",
  sesi: "uji-lunas-3",
  nama: "Tamu Tanpa Tagihan",
  no_wa: "+6281200000003",
  items: [{ menu_id: 100, jumlah: 1, catatan: null, pilihan: [] }],
  batasBayarMenit: 15,
  metode_bayar: "kasir",
});

if (tanpa.ok) {
  /*
    Tiru keadaan yang membuat kasir buntu: pesanan ada, tagihan_id null.
    Ini persis yang terjadi pada pesanan lama sebelum migrasi prabayar.
  */
  const p = TABEL.pesanan.find((x) => x.id === tanpa.data.pesanan.id);
  const tagihanLama = p.tagihan_id;
  p.tagihan_id = null;

  const pulih = await bayarTunaiKasir({
    pesanan_id: p.id,
    diterima: 0,
    uang_pas: true,
    kasir: "uji",
  });

  cek("pesanan tanpa tagihan TETAP bisa dibayar", pulih.ok === true, pulih.ok ? "" : pulih.pesan);
  cek("tagihan baru dibuat", p.tagihan_id != null && p.tagihan_id !== tagihanLama, String(p.tagihan_id));
  cek("status lunas", p.status_bayar === "lunas");

  const tBaru = TABEL.tagihan.find((x) => x.id === p.tagihan_id);
  cek("tagihan baru punya total", (tBaru?.total ?? 0) > 0, `Rp${tBaru?.total ?? 0}`);
  cek(
    "pemulihan tercatat di log",
    TABEL.log_perubahan.some((l) => l.aksi === "pulihkan_tagihan"),
  );
} else {
  cek("pesanan tanpa tagihan bisa dibuat", false, tanpa.pesan);
}

server.close();
console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal === 0 ? 0 : 1);
