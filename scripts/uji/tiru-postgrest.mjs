/**
 * PostgREST TIRUAN untuk uji HTTP di sandbox.
 *
 * ── MENGAPA ADA ────────────────────────────────────────────────────────
 *
 * Sandbox ini tidak bisa menjangkau Supabase (lihat docs/PINDAH-CLOUDFLARE.md
 * bagian 6). Uji HTTP seperti `uji:alur`, `uji:ui`, `uji:hpp:http` butuh
 * server Next yang benar-benar membaca & menulis sesuatu. Tiruan ini
 * menyediakan subset PostgREST yang dipakai `app/lib/order/*.ts`:
 *
 *   GET    /rest/v1/<tabel>?select=…&<kolom>=eq.<nilai>&order=…
 *   POST   /rest/v1/<tabel>            (insert, Prefer: return=representation)
 *   PATCH  /rest/v1/<tabel>?<filter>   (update, dengan semua operator filter)
 *
 * Yang TIDAK ditiru (dan tidak diuji karenanya): RLS, tipe kolom sungguhan,
 * constraint, trigger. Jadi lulus di sini berarti "kode aplikasi benar",
 * bukan "database sungguhan benar".
 *
 * Jalankan (dua terminal):
 *
 *   node scripts/uji/tiru-postgrest.mjs 3999
 *   SUPABASE_URL=http://127.0.0.1:3999 \
 *   SUPABASE_ANON_KEY=uji SUPABASE_SERVICE_KEY=uji \
 *   npx next start -p 3000 -H 0.0.0.0
 *
 * Lalu `BASE=http://127.0.0.1:3000 npm run uji:alur` dan seterusnya.
 *
 * ── PENTING: SATU TIRUAN PER SATU PUTARAN UJI ──────────────────────────
 *
 * Keadaan tiruan bertahan selama prosesnya hidup, dan beberapa suite
 * menulis pesanan/pembelian. Menjalankan suite yang sama DUA KALI pada
 * tiruan yang sama membuat angkanya bergeser (mis. stok berkurang lagi)
 * sehingga uji gagal tanpa ada kode yang berubah. Mulai ulang tiruan
 * sebelum setiap putaran penuh — itu yang dilakukan saat memverifikasi.
 *
 * Suite yang memang menuntut isi database produksi (126 menu, 6 kategori,
 * pembayaran DOKU hari ini, pesanan ditolak tanpa tagihan) mendapat
 * datanya dari sini: menu & kategori DIBACA dari `supabase/migrations/`,
 * sedangkan seed hari ini ditulis di bawah.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.argv[2] ?? 3999);

/* ── Data awal ────────────────────────────────────────────────────────── */

/*
  ── DATA DIAMBIL DARI MIGRASI, BUKAN DITULIS ULANG ──────────────────

  Tiruan ini membaca `supabase/migrations/*.sql` yang SAMA dengan yang
  dipakai memasang database sungguhan. Alasannya bukan kerapian:

  · uji `saring-admin` memeriksa janji di layar — "126 menu", "6
    kategori", "Kopi 24" — dan janji itu ditentukan oleh isi migrasi.
    Salinan tulisan tangan akan menyimpang begitu pemilik menambah menu,
    dan uji akan gagal pada aplikasi yang benar (atau lebih buruk:
    lulus pada data yang tidak pernah ada).
  · menu dengan pilihan (Sambal Matah, Salted Egg, …) harus punya
    bentuk `pilihan` yang sah, kalau tidak setiap pesanan ditolak.

  Yang dibaca hanya bagian VALUES — bukan menjalankan SQL.
*/
const bacaMigrasi = (nama) =>
  readFileSync(new URL(`../../supabase/migrations/${nama}`, import.meta.url), "utf8");

const migMenu = bacaMigrasi("20261102000000_menu_nabawi.sql");
const migKategori = bacaMigrasi("20261103000000_ringkas_kategori.sql");

/* 6 kategori ringkas (18 kategori lama digabung oleh migrasi ini). */
const blokKategori = migKategori.slice(migKategori.indexOf("INSERT INTO public.kategori_menu"));
const kategori_menu = [...blokKategori.matchAll(/^  \('([^']+)',\s*(\d+)\)/gm)].map(
  ([, nama, urutan], i) => ({ id: i + 1, nama, urutan: Number(urutan) })
);
const idKategori = new Map(kategori_menu.map((k) => [k.nama, k.id]));

/* Peta kategori lama → baru, dari blok `FROM (VALUES …) AS peta(lama, baru)`. */
const petaKategori = new Map(
  [...migKategori.matchAll(/^  \('([^']+)',\s*'([^']+)'\)/gm)].map(([, lama, baru]) => [
    lama.trim(),
    baru.trim(),
  ])
);

/* Menu: nama, deskripsi, harga, kategori (lama), urutan. */
const blokMenu = migMenu.slice(migMenu.indexOf("FROM (VALUES"), migMenu.indexOf(") AS v(nama"));

/* Satu baris VALUES = satu menu. Bentuknya: ('nama', 'deskripsi', harga, 'kategori', urutan) */
const barisMenu = [
  ...blokMenu.matchAll(/'([^']+)',\s*'([^']*)',\s*(\d+),\s*'([^']+)',\s*(\d+)/g),
].map(([, nama, deskripsi, harga, kategoriLama, urutan]) => ({
  nama,
  deskripsi,
  harga: Number(harga),
  kategoriLama: kategoriLama.trim(),
  urutan: Number(urutan),
}));

const PILIHAN_SAUS = [
  { nama: "Sambal Matah", tambah: 0 },
  { nama: "BBQ", tambah: 4000 },
  { nama: "Gravy", tambah: 4000 },
  { nama: "Salted Egg", tambah: 5000 },
  { nama: "Caramel", tambah: 3000 },
  { nama: "Mushroom", tambah: 4000 },
];

/*
  Beberapa skrip uji merujuk id menu tertentu (3, 23, 59, 100) karena id
  itulah yang ada di database sungguhan. Id tidak boleh diubah di skrip uji,
  jadi tiruan memastikan menu pada id tersebut benar-benar punya pilihan —
  sama seperti produksi, di mana keempatnya adalah menu ber-opsi.
*/
const ID_BERPILIHAN = new Set([3, 23, 59, 100]);

const menu_ = barisMenu.map((m, i) => ({
  id: i + 1,
  nama: m.nama,
  deskripsi: m.deskripsi,
  harga: m.harga,
  kategori_id: idKategori.get(petaKategori.get(m.kategoriLama) ?? m.kategoriLama) ?? 1,
  foto_url: null,
  tersedia: true,
  urutan: m.urutan,
  rekomendasi: i < 3,
  /*
    Di produksi, menu yang deskripsinya menyebut "Pilihan rasa/saus" memang
    punya kolom `pilihan` terisi (migrasi 20261103000100). Opsi di sini
    memuat SELURUH nama yang dirujuk skrip uji (Sambal Matah, Salted Egg,
    Caramel, Mushroom, BBQ) plus tambahan harga yang wajar — bukan nol,
    supaya uji yang memeriksa "harga ikut naik karena add-on" tetap berarti.
  */
  pilihan:
    ID_BERPILIHAN.has(i + 1) || /pilihan|rasa|saus/i.test(m.deskripsi) ? PILIHAN_SAUS : null,
}));

const meja = Array.from({ length: 12 }, (_, i) => String(i + 1)).map((nomor, i) => ({
  id: i + 1,
  nomor,
  area: i < 10 ? "Dalam" : "Teras",
  aktif: true,
  status: "kosong",
  kapasitas: 4,
}));

const bahan = [
  ["Biji Kopi Arabika", "gram", 8000, 1000, 20000],
  ["Susu UHT", "ml", 1800, 5000, 25000],
  ["Beras", "gram", 1500, 20000, 50000],
  ["Gurame", "gram", 15000, 0, 10000],
  ["Matcha", "gram", 12000, 500, 3000],
].map(([nama, satuan, harga_satuan, stok, stok_minimum], i) => ({
  id: i + 1,
  nama,
  satuan,
  harga_satuan,
  stok,
  stok_minimum,
}));

const pesanan = [];
const item_pesanan = [];
const tagihan = [];

const tabel = {
  kategori_menu,
  menu: menu_,
  meja,
  bahan,
  pesanan,
  item_pesanan,
  tagihan,
};

/*
  Tabel lain yang dipanggil aplikasi. Isinya sengaja KOSONG: uji HTTP
  yang menulis lewat aplikasi sendiri akan mengisinya, dan uji struktur
  (mis. `uji:hpp:http` yang membaca daftar bahan) hanya butuh tabelnya
  ADA — bukan berisi. Tabel yang hilang membuat route menjawab 404/500
  dan uji gagal karena alasan yang salah.
*/
for (const nama of [
  "gerakan_stok",
  "resep_menu",
  "hpp_pesanan",
  "pembelian",
  "pembelian_item",
  "pembayaran",
  "pengaturan",
  "log_perubahan",
]) {
  tabel[nama] = [];
}

/*
  `pengaturan` berbentuk KUNCI–NILAI (bukan satu baris berkolom), sesuai
  `ambilAturan()` di katalog.ts. Nilainya sengaja sama dengan ATURAN_BAWAAN
  supaya uji yang menghitung tagihan tidak bergantung pada isi tiruan.
*/
tabel.pengaturan.push(
  { id: 1, kunci: "pajak_persen", nilai: "11" },
  { id: 2, kunci: "layanan_persen", nilai: "0" },
  { id: 3, kunci: "layanan_rp", nilai: "2000" },
  { id: 4, kunci: "pembulatan", nilai: "100" },
);

/*
  DEFAULT KOLOM. Database sungguhan mengisi ini sendiri; tiruan harus
  menirunya, karena aplikasi memang TIDAK mengirimnya saat INSERT
  (`status` diisi 'menunggu_konfirmasi' oleh DEFAULT, begitu pula jam).
  Tanpa ini, pesanan lahir tanpa `status` dan seluruh alur status gagal
  dengan pesan yang menyesatkan ("dari undefined ke diterima").
*/
const sekarang = () => new Date().toISOString();
const bawaan = {
  pesanan: (b) => ({
    status: "menunggu_konfirmasi",
    status_bayar: "menunggu",
    created_at: sekarang(),
    alasan_tolak: null,
    alasan_batal: null,
    diterima_at: null,
    diproses_at: null,
    siap_at: null,
    diantar_at: null,
    dibayar_at: null,
    tagihan_id: null,
    ...b,
  }),
  tagihan: (b) => ({
    status: "terbuka",
    subtotal: 0,
    layanan: 0,
    pajak: 0,
    pembulatan: 0,
    total: 0,
    dibuka_at: sekarang(),
    ditutup_at: null,
    kasir: null,
    ...b,
  }),
  item_pesanan: (b) => ({ catatan: null, pilihan: [], ...b }),
  menu: (b) => ({ deskripsi: "", foto_url: null, tersedia: true, rekomendasi: false, pilihan: null, ...b }),
  meja: (b) => ({ aktif: true, status: "kosong", kapasitas: 4, ...b }),
  pembayaran: (b) => ({ kembalian: 0, diterima: 0, metode: "tunai", ...b }),
  hpp_pesanan: (b) => ({ dibuat_at: sekarang(), lengkap: true, ...b }),
  pembelian: (b) => ({ no_nota: "", total: 0, dibayar: true, catatan: "", oleh: "sistem", dibeli_at: sekarang(), ...b }),
  bahan: (b) => ({ aktif: true, catatan: "", stok_minimum: 0, ...b }),
  gerakan_stok: (b) => ({ created_at: sekarang(), ...b }),
};

/*
  INDEKS UNIK. Aplikasi SENGAJA bersandar pada database untuk menolak
  duplikat (nama bahan kembar, nota supplier ganda, dua catatan HPP untuk
  satu baris pesanan). Tiruan tanpa indeks ini akan meloloskan data yang
  di produksi ditolak — dan uji yang seharusnya menangkap duplikasi justru
  hijau.

  Bentuk: [tabel, daftar kolom]. `null` dianggap tidak ikut (seperti
  indeks parsial `WHERE no_nota <> ''`).
*/
const UNIK = [
  ["bahan", ["nama"]],
  ["pembelian", ["supplier", "no_nota"]],
  ["hpp_pesanan", ["item_id"]],
];

const kunciUnik = (nama, baris, kolom) => {
  const bagian = kolom.map((k) => String(baris[k] ?? "").trim().toLowerCase());
  // Indeks parsial: kalau SEMUA kolom kosong, baris tidak ikut indeks.
  if (bagian.every((x) => x === "")) return null;
  return bagian.join("\u0000");
};

/** Pesan galat meniru Postgres: kode 23505 + kata "duplicate". */
const galatDuplikat = (tabel, kolom) => ({
  code: "23505",
  message: `duplicate key value violates unique constraint "${tabel}_${kolom.join("_")}_key"`,
});

function bentrok(nama, calon, daftar, lewati) {
  const aturan = UNIK.filter(([t]) => t === nama);
  for (const [, kolom] of aturan) {
    const k = kunciUnik(nama, calon, kolom);
    if (k === null) continue;
    for (const b of daftar) {
      if (b === lewati) continue;
      if (kunciUnik(nama, b, kolom) === k) return galatDuplikat(nama, kolom);
    }
  }
  return null;
}

/*
  SEED HARI INI. Beberapa uji membaca keadaan yang di database sungguhan
  memang sudah ada sejak lama — bukan yang dibuat uji itu sendiri:

    · satu pembayaran DOKU (non-tunai) senilai Rp279.700;
    · satu pesanan DITOLAK yang tidak pernah punya tagihan, sehingga
      tampil di riwayat dengan total 0 (bukan null).

  Tanpa seed, ketiga cek itu gagal karena datanya memang tidak ada — bukan
  karena kode salah. Tanggalnya "sekarang" supaya masuk hitungan hari ini.
*/
tabel.tagihan.push({
  id: 9001,
  meja_id: 2,
  status: "lunas",
  subtotal: 250000,
  layanan: 2000,
  pajak: 27700,
  pembulatan: 0,
  total: 279700,
  dibuka_at: sekarang(),
  ditutup_at: sekarang(),
  kasir: null,
});
tabel.pembayaran.push({
  id: 9002,
  tagihan_id: 9001,
  metode: "doku",
  diterima: 279700,
  kembalian: 0,
  dibuat_at: sekarang(),
});

/*
  PESANAN YANG DILUNASI TAGIHAN INI.

  Seed lama punya tagihan lunas Rp279.700 tetapi TIDAK punya pesanan lunas
  yang menopangnya. Akibatnya `riwayat.ts` — yang menghitung "item terjual"
  dan "rata-rata per pesanan" dari baris pesanan berstatus_bayar lunas —
  selalu menghasilkan 0 dan 0/N.

  Uji `riwayat:http` menuntut `item > 0`. Ia hanya lulus bila suite LAIN
  sudah lebih dulu membuat pesanan lunas di database yang sama. Artinya uji
  itu bergantung pada urutan, dan gagal bila dijalankan pada tiruan yang
  baru dinyalakan — persis mode yang dipakai saat memeriksa hasil kerja.

  Satu baris pesanan lunas di sini membuat seed-nya utuh: setiap tagihan
  punya pesanan, setiap angka ringkasan punya sumbernya.
*/
tabel.pesanan.push({
  id: 9002,
  nomor: "M2-SEED-00",
  meja_id: 2,
  status: "diantar",
  status_bayar: "lunas",
  nama_pemesan: "Tamu Lunas",
  sesi_id: "seed-lunas",
  alasan_tolak: null,
  alasan_batal: null,
  total_item: 4,
  created_at: sekarang(),
  diterima_at: sekarang(),
  diproses_at: sekarang(),
  siap_at: sekarang(),
  diantar_at: sekarang(),
  no_wa: null,
  tagihan_id: 9001,
  dibayar_at: sekarang(),
  kedaluwarsa_at: null,
  metode_bayar: "doku",
});
tabel.pesanan.push({
  id: 9003,
  nomor: "M2-SEED-01",
  meja_id: 2,
  status: "ditolak",
  status_bayar: "menunggu",
  nama_pemesan: "Tamu Ditolak",
  sesi_id: "seed-tolak",
  alasan_tolak: "salah input",
  alasan_batal: null,
  total_item: 0,
  created_at: sekarang(),
  diterima_at: null,
  diproses_at: null,
  siap_at: null,
  diantar_at: null,
  no_wa: null,
  tagihan_id: null,
  dibayar_at: null,
  kedaluwarsa_at: null,
  metode_bayar: "kasir",
});

/*
  Satu pesanan yang SUDAH diterima tetapi belum dibayar — inilah yang
  dihitung `belum_bayar` di ringkasan kasir. Pesanan yang DITOLAK di atas
  sengaja tidak dihitung (lihat komentar `not.in.` di riwayat.ts), jadi
  keduanya harus ada agar uji bisa membedakan keduanya.
*/
tabel.tagihan.push({
  id: 9005,
  meja_id: 3,
  status: "terbuka",
  subtotal: 38000,
  layanan: 2000,
  pajak: 4400,
  pembulatan: 0,
  total: 44400,
  dibuka_at: sekarang(),
  ditutup_at: null,
  kasir: null,
});
tabel.pesanan.push({
  id: 9004,
  nomor: "M3-SEED-02",
  meja_id: 3,
  status: "diterima",
  status_bayar: "menunggu",
  nama_pemesan: "Tamu Belum Bayar",
  sesi_id: "seed-belum-bayar",
  alasan_tolak: null,
  alasan_batal: null,
  total_item: 1,
  created_at: sekarang(),
  diterima_at: sekarang(),
  diproses_at: null,
  siap_at: null,
  diantar_at: null,
  no_wa: null,
  tagihan_id: 9005,
  dibayar_at: null,
  kedaluwarsa_at: null,
  metode_bayar: "kasir",
});

/* ── Pencocokan filter PostgREST ─────────────────────────────────────── */

/** Nilai kolom jadi teks, agar perbandingan `eq.` konsisten. */
const teks = (v) => (v === null || v === undefined ? "" : String(v));

/**
 * Operator yang dipakai aplikasi ini. `in.(a,b)` berisi koma, jadi
 * pemisahan pertamanya harus pada "." — nilai boleh mengandung koma.
 */
function cocok(baris, key, val) {
  const titik = val.indexOf(".");
  const op = val.slice(0, titik);
  const arg = val.slice(titik + 1);
  const kol = teks(baris[key]);

  switch (op) {
    case "eq":
      return kol === arg;
    case "neq":
      return kol !== arg;
    case "in": {
      const isi = arg.replace(/^\(/, "").replace(/\)$/, "").split(",");
      return isi.some((x) => x.replace(/^"|"$/g, "") === kol);
    }
    case "not":
      // PostgREST menegasikan dengan membungkus operator: not.in.(a,b)
      return !cocok(baris, key, arg);
    case "gte":
      return baris[key] !== null && baris[key] !== undefined && (baris[key] >= nilaiAsli(baris[key], arg));
    case "lte":
      return baris[key] !== null && baris[key] !== undefined && (baris[key] <= nilaiAsli(baris[key], arg));
    case "gt":
      return baris[key] !== null && baris[key] !== undefined && (baris[key] > nilaiAsli(baris[key], arg));
    case "lt":
      return baris[key] !== null && baris[key] !== undefined && (baris[key] < nilaiAsli(baris[key], arg));
    case "is":
      if (arg === "null") return baris[key] === null || baris[key] === undefined;
      if (arg === "true") return baris[key] === true;
      if (arg === "false") return baris[key] === false;
      return false;
    case "like":
    case "ilike": {
      const pola = arg.replace(/\*/g, ".*").replace(/%/g, ".*");
      const re = new RegExp("^" + pola + "$", op === "ilike" ? "i" : "");
      return re.test(kol);
    }
    default:
      // Operator tak dikenal: anggap cocok, supaya tidak diam-diam
      // memfilter semua baris (yang akan tampak seperti data kosong).
      return true;
  }
}

const nilaiAsli = (asli, s) =>
  typeof asli === "number" ? Number(s) : typeof asli === "boolean" ? s === "true" : s;

/** Urutkan sesuai `order=kolom.asc,kolom2.desc`. */
function urutkan(daftar, order) {
  if (!order) return daftar;
  const kunci = order
    .split(",")
    .map((x) => {
      const [k, arah] = x.split(".");
      return { k, naik: arah !== "desc" };
    })
    // Urutan PostgREST: `nullsfirst`/`nullslast` default = null terakhir untuk asc.
    .reverse();

  const out = [...daftar];
  for (const { k, naik } of kunci) {
    out.sort((a, b) => {
      const x = a[k];
      const y = b[k];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const hasil = x < y ? -1 : 1;
      return naik ? hasil : -hasil;
    });
  }
  return out;
}

/* ── Server ──────────────────────────────────────────────────────────── */

let urutId = 1000;
const server = createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const jalur = u.pathname;

  if (jalur === "/__sehat") {
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const namaTabel = jalur.replace(/^\/rest\/v1\//, "").split("/")[0];
  const daftar = tabel[namaTabel];

  res.setHeader("Content-Type", "application/json");

  if (!daftar) {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: `tabel ${namaTabel} tidak ada`, code: "42P01" }));
    return;
  }

  let badan = "";
  req.on("data", (c) => (badan += c));
  req.on("end", () => {
    const params = [...u.searchParams.entries()].filter(
      ([k]) => !["select", "order", "limit", "offset", "on_conflict"].includes(k)
    );
    const pilih = (baris) => {
      const select = u.searchParams.get("select");
      if (!select || select === "*") return baris;
      if (/^\w+(,\w+)*$/.test(select)) {
        // Daftar kolom biasa: kembalikan hanya kolom itu.
        const out = {};
        for (const k of select.split(",")) out[k] = baris[k];
        return out;
      }
      // Ada embed/alias: kembalikan utuh. Aplikasi ini tidak bergantung
      // pada embed, jadi bentuk longgar lebih aman daripada salah bentuk.
      return baris;
    };

    const filter = (daftar) => daftar.filter((b) => params.every(([k, v]) => cocok(b, k, v)));

    if (req.method === "GET") {
      let hasil = urutkan(filter(daftar), u.searchParams.get("order"));
      // `Number(null)` = 0 — tanpa penjagaan ini, GET tanpa `limit` akan
      // mengembalikan array KOSONG dan tampak seperti database kosong.
      const limitMentah = u.searchParams.get("limit");
      const limit = limitMentah === null ? null : Number(limitMentah);
      if (limit !== null && Number.isFinite(limit) && limit >= 0) hasil = hasil.slice(0, limit);
      // head:true tidak dipakai aplikasi ini; kalau muncul, balas kosong.
      res.end(JSON.stringify(hasil.map(pilih)));
      return;
    }

    if (req.method === "HEAD") {
      res.setHeader("Content-Range", `0-0/${filter(daftar).length}`);
      res.end();
      return;
    }

    if (req.method === "POST") {
      let isi;
      try {
        isi = JSON.parse(badan || "{}");
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: "badan bukan JSON" }));
        return;
      }
      const masuk = Array.isArray(isi) ? isi : [isi];
      const isiBawaan = bawaan[namaTabel];
      const dibuat = [];
      for (const x of masuk) {
        const b = { id: urutId++, ...(isiBawaan ? isiBawaan({}) : {}), ...x };
        const dobel = bentrok(namaTabel, b, daftar, null);
        if (dobel) {
          res.statusCode = 409;
          res.end(JSON.stringify(dobel));
          return;
        }
        daftar.push(b);
        dibuat.push(b);
      }
      res.statusCode = 201;
      const prefer = req.headers.prefer ?? "";
      if (prefer.includes("return=representation")) {
        res.end(JSON.stringify(dibuat.map(pilih)));
      } else {
        res.end("");
      }
      return;
    }

    if (req.method === "PATCH") {
      let isi;
      try {
        isi = JSON.parse(badan || "{}");
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: "badan bukan JSON" }));
        return;
      }
      const kena = filter(daftar);
      for (const b of kena) {
        const sesudah = { ...b, ...isi };
        const dobel = bentrok(namaTabel, sesudah, daftar, b);
        if (dobel) {
          res.statusCode = 409;
          res.end(JSON.stringify(dobel));
          return;
        }
        Object.assign(b, isi);
      }
      const prefer = req.headers.prefer ?? "";
      res.statusCode = 200;
      res.end(prefer.includes("return=representation") ? JSON.stringify(kena.map(pilih)) : "");
      return;
    }

    if (req.method === "DELETE") {
      const kena = new Set(filter(daftar));
      for (let i = daftar.length - 1; i >= 0; i--) if (kena.has(daftar[i])) daftar.splice(i, 1);
      res.statusCode = 204;
      res.end();
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ message: "metode tidak didukung" }));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`PostgREST tiruan di http://127.0.0.1:${PORT}`);
});
