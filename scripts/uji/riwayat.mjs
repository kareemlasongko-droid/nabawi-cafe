/**
 * Uji RIWAYAT & RANGKUMAN PENJUALAN — terhadap PostgREST tiruan.
 *
 * ── YANG DIJAGA UJI INI ─────────────────────────────────────────────
 *
 * Rangkuman penjualan adalah angka yang dipakai pemilik untuk memutuskan.
 * Kesalahannya tidak pernah terlihat seperti galat — ia terlihat sebagai
 * angka yang "masuk akal tapi salah", dan baru ketahuan saat tutup buku.
 * Karena itu uji ini menyerang empat titik yang paling mudah salah:
 *
 *   1. BUKAN uang diterima. Tamu menyerahkan 300.000 untuk tagihan
 *      279.700. Kalau `diterima` dijumlahkan, omzet naik 20.300.
 *   2. BUKAN satu status pembayaran. Di produksi ada `lunas` DAN
 *      `settlement`; menyaring satu nilai saja menghilangkan separuh
 *      transaksi non-tunai.
 *   3. BATAS HARI memakai WIB, bukan zona perangkat. Tablet kasir di
 *      Jakarta dan ponsel pemilik di UTC harus menghitung "hari ini"
 *      yang sama.
 *   4. Pesanan tanpa tagihan (data lama) harus tahan, bukan melempar.
 *
 * Jalankan:
 *   node --experimental-strip-types --no-warnings \
 *        --import ./scripts/uji/ts-hook.mjs scripts/uji/riwayat.mjs
 */
import { createServer } from "node:http";

// ── Tiruan PostgREST ─────────────────────────────────────────────────────
// Isinya sengaja meniru DATA PRODUKSI, termasuk hal-hal janggal yang
// benar-benar ada di sana. Menghapus kejanggalan itu membuat uji ini lulus
// untuk alasan yang salah.
const TABEL = {
  meja: [
    { id: 1, nomor: "1", area: "Dalam", aktif: true },
    { id: 2, nomor: "12", area: "Taman", aktif: true },
  ],
  tagihan: [
    // Tagihan yang dibayar hari ini.
    { id: 8, meja_id: 1, total: 351900, status: "lunas", ditutup_at: "2026-11-02T03:00:00.000Z" },
    { id: 9, meja_id: 2, total: 279700, status: "lunas", ditutup_at: "2026-11-02T04:30:00.000Z" },
    // Masih terbuka: TIDAK boleh masuk omzet.
    { id: 10, meja_id: 1, total: 99000, status: "menunggu", ditutup_at: null },
    // Ditutup KEMARIN (03.00 WIB tgl 1) — di luar jendela "hari ini".
    { id: 7, meja_id: 2, total: 500000, status: "lunas", ditutup_at: "2026-11-01T03:00:00.000Z" },
  ],
  pesanan: [
    {
      id: 5, nomor: "M1-0004-30", meja_id: 1, nama_pemesan: "Budi", status: "diproses",
      status_bayar: "lunas", tagihan_id: 8, total: 351900,
      created_at: "2026-11-02T02:55:00.000Z", dibayar_at: "2026-11-02T03:00:00.000Z",
    },
    {
      id: 6, nomor: "M1-1924-25", meja_id: 2, nama_pemesan: "Sari", status: "diterima",
      status_bayar: "lunas", tagihan_id: 9, total: 279700,
      created_at: "2026-11-02T04:25:00.000Z", dibayar_at: "2026-11-02T04:30:00.000Z",
    },
    // Belum dibayar → pekerjaan yang menunggu kasir.
    {
      id: 8, nomor: "M1-2100-11", meja_id: 1, nama_pemesan: null, status: "menunggu_konfirmasi",
      status_bayar: "menunggu", tagihan_id: 10, total: 99000,
      created_at: "2026-11-02T05:00:00.000Z", dibayar_at: null,
    },
    // Ditolak — tidak boleh dihitung "belum dibayar" (tidak ada yang perlu
    // ditagih), tetapi HARUS tetap muncul di riwayat.
    {
      id: 9, nomor: "M1-2200-77", meja_id: 2, nama_pemesan: "Dewi", status: "ditolak",
      status_bayar: "menunggu", tagihan_id: null, total: null,
      created_at: "2026-11-02T05:30:00.000Z", dibayar_at: null,
    },
    // Kejanggalan produksi: "lunas" tanpa tagihan, total null.
    {
      id: 1, nomor: "M1-1249-63", meja_id: 1, nama_pemesan: null, status: "diproses",
      status_bayar: "lunas", tagihan_id: null, total: null,
      created_at: "2026-11-01T09:00:00.000Z", dibayar_at: null,
    },
  ],
  pembayaran: [
    // Tunai: tamu menyerahkan 400.000 untuk 351.900 → kembali 48.100.
    { id: 1, tagihan_id: 8, metode: "tunai", diterima: 400000, kembalian: 48100, status: "lunas", dibuat_at: "2026-11-02T03:00:00.000Z" },
    // QRIS: diterima tepat, status `settlement` (BUKAN `lunas`).
    { id: 2, tagihan_id: 9, metode: "qris_kasir", diterima: 279700, kembalian: 0, status: "settlement", dibuat_at: "2026-11-02T04:30:00.000Z" },
  ],
};

let urut = 9000;

function cocok(baris, q) {
  for (const bagian of q.split("&")) {
    /*
      `not.` adalah awalan PostgREST, bukan bagian nama kolom:
      `status=not.in.(ditolak,dibatalkan)`. Tiruan yang mengabaikannya akan
      membuat uji "pesanan ditolak tidak dihitung" LULUS secara palsu —
      bukan karena kodenya benar, melainkan karena filternya dibuang.
    */
    // `select`, `order`, dan `limit` bukan filter — lewati.
    if (/^(select|order|limit)=/.test(bagian)) continue;
    const m = /^([a-z_]+)=(not\.)?(eq|neq|gte|lt|lte|in|is)\.(.+)$/.exec(bagian);
    if (!m) throw new Error(`tiruan PostgREST tidak mengenal filter: ${bagian}`);
    const [, kolom, negasi, op, mentah] = m;
    const nilai = decodeURIComponent(mentah);
    const kini = baris[kolom];
    const hasil = cocokSatu(kini, op, nilai);
    if (negasi && hasil) return false;
    if (!negasi && !hasil) return false;
  }
  return true;
}

function cocokSatu(kini, op, nilai) {
  {
    if (op === "eq") return String(kini) === nilai;
    if (op === "neq") return String(kini) !== nilai;
    if (op === "gte") return kini != null && String(kini) >= nilai;
    if (op === "lt") return kini != null && String(kini) < nilai;
    if (op === "lte") return kini != null && String(kini) <= nilai;
    if (op === "in") {
      const daftar = nilai.replace(/^\(|\)$/g, "").split(",");
      return daftar.includes(String(kini));
    }
    if (op === "is") return nilai === "null" ? kini == null : String(kini) === nilai;
    return true;
  }
}

const ambilQ = (url) => new URL(url, "http://x").searchParams.toString();

/** Urutan `order=` ala PostgREST, secukupnya untuk `kolom.desc`. */
function urutkan(baris, q) {
  const p = new URLSearchParams(q);
  const order = p.get("order");
  if (!order) return baris;
  const [kolom, arah] = order.split(".");
  const tanda = arah === "desc" ? -1 : 1;
  return [...baris].sort((a, b) => {
    const x = a[kolom];
    const y = b[kolom];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return x < y ? -tanda : x > y ? tanda : 0;
  });
}

let permintaanGagal = null;

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
  // Simulasi tabel yang sedang bermasalah.
  if (permintaanGagal === nama) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ message: "gagal tiruan" }));
  }
  if (req.method === "GET") {
    const p = new URLSearchParams(q);
    let hasil = tabel.filter((b) => cocok(b, q));
    hasil = urutkan(hasil, q);
    const limit = Number(p.get("limit"));
    if (Number.isFinite(limit) && limit > 0) hasil = hasil.slice(0, limit);
    return res.end(JSON.stringify(hasil));
  }
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

const { awalHariIni, ringkasanHariIni, riwayatPesanan } = await import(
  "../../app/lib/order/riwayat.ts"
);

/** `awalHariIni` mengembalikan Date; uji membandingkan ISO agar terbaca. */
const awalHariIniIso = (d) => awalHariIni(d).toISOString();

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

// ═══ Batas hari ═════════════════════════════════════════════════════════
console.log("\n── Batas hari (WIB, bukan zona perangkat) ──");

/*
  2026-11-02T18:30:00Z = 01.30 WIB tanggal 3 November.
  "Hari ini" di Jakarta baru saja berganti, sedangkan jam UTC masih
  tanggal 2. Kalau kode memakai UTC, seluruh penjualan malam hari akan
  terhitung ke hari yang salah.
*/
cek(
  "01.30 WIB tgl 3 → tengah malam WIB tgl 3 (bukan tgl 2)",
  awalHariIniIso(new Date("2026-11-02T18:30:00.000Z")) === "2026-11-02T17:00:00.000Z",
  awalHariIniIso(new Date("2026-11-02T18:30:00.000Z")),
);

// 2026-11-02T03:41:00Z = 10.41 WIB tgl 2 → tengah malam WIB tgl 2.
cek(
  "10.41 WIB tgl 2 → tengah malam WIB tgl 2",
  awalHariIniIso(new Date("2026-11-02T03:41:00.000Z")) === "2026-11-01T17:00:00.000Z",
  awalHariIniIso(new Date("2026-11-02T03:41:00.000Z")),
);

// 2026-11-02T17:00:00Z = TEPAT 00.00 WIB tgl 3 → tengah malam tgl 3.
cek(
  "tepat 00.00 WIB masuk hari baru",
  awalHariIniIso(new Date("2026-11-02T17:00:00.000Z")) === "2026-11-02T17:00:00.000Z",
  awalHariIniIso(new Date("2026-11-02T17:00:00.000Z")),
);

// Satu detik sebelumnya masih hari lama.
cek(
  "23.59.59 WIB masih hari sebelumnya",
  awalHariIniIso(new Date("2026-11-02T16:59:59.000Z")) === "2026-11-01T17:00:00.000Z",
  awalHariIniIso(new Date("2026-11-02T16:59:59.000Z")),
);

// Zona perangkat tidak boleh berpengaruh: hasil sama dari jam berapa pun
// perangkatnya, selama tanggal acuannya sama.
const jamAsli = process.env.TZ;
process.env.TZ = "UTC";
const dariUtc = awalHariIniIso(new Date("2026-11-02T03:41:00.000Z"));
process.env.TZ = "Pacific/Kiritimati"; // UTC+14
const dariTimurJauh = awalHariIniIso(new Date("2026-11-02T03:41:00.000Z"));
process.env.TZ = jamAsli ?? "";
cek(
  "perangkat UTC vs UTC+14 menghasilkan batas hari yang sama",
  dariUtc === dariTimurJauh && dariUtc === "2026-11-01T17:00:00.000Z",
  `${dariUtc} vs ${dariTimurJauh}`,
);

// ═══ Ringkasan ══════════════════════════════════════════════════════════
console.log("\n── Rangkuman hari ini ──");

const r = await ringkasanHariIni(new Date("2026-11-02T05:00:00.000Z"));
cek("ringkasan berhasil dibaca", r.ok === true, r.ok ? "" : r.pesan);

if (r.ok) {
  /*
    Omzet = 351.900 (tagihan 8) + 279.700 (tagihan 9) = 631.600.
    Tagihan 10 belum lunas, tagihan 7 ditutup kemarin.
    Kalau kode menjumlahkan `pembayaran.diterima`, hasilnya 679.700 —
    selisih 48.100, tepat sebesar uang kembalian.
  */
  cek("omzet hanya dari tagihan lunas hari ini", r.data.omzet === 631600, String(r.data.omzet));
  cek(
    "omzet BUKAN jumlah uang diterima (kembalian tidak ikut)",
    r.data.omzet !== 679700,
    `diterima akan menghasilkan 679700`,
  );
  cek("tagihan belum lunas tidak masuk omzet", r.data.omzet < 730600);

  cek("jumlah pesanan lunas hari ini", r.data.jumlah_pesanan === 2, String(r.data.jumlah_pesanan));
  cek(
    "pesanan 'lunas' tanpa tagihan tidak menambah omzet",
    r.data.omzet === 631600,
  );

  /*
    Tunai 351.900 (masuk = diterima 400.000 − kembalian 48.100).
    Non-tunai 279.700 — barisnya berstatus `settlement`, bukan `lunas`;
    menyaring satu status saja akan membuat angka ini 0.
  */
  cek("tunai memakai uang bersih, bukan yang diserahkan", r.data.tunai === 351900, String(r.data.tunai));
  cek("non-tunai mengenali status `settlement`", r.data.nontunai === 279700, String(r.data.nontunai));
  cek(
    "tunai + non-tunai = omzet",
    r.data.tunai + r.data.nontunai === r.data.omzet,
    `${r.data.tunai} + ${r.data.nontunai} vs ${r.data.omzet}`,
  );

  cek("belum dibayar menghitung pesanan yang menunggu", r.data.belum_bayar === 1, String(r.data.belum_bayar));
  cek("nilai belum dibayar dari tagihannya", r.data.nilai_belum_bayar === 99000, String(r.data.nilai_belum_bayar));
  cek(
    "pesanan DITOLAK tidak masuk 'belum dibayar'",
    r.data.belum_bayar === 1,
    "kalau ditolak ikut terhitung, hasilnya 2",
  );

  cek(
    "rata-rata = omzet / jumlah pesanan",
    r.data.rata_rata === Math.round(631600 / 2),
    String(r.data.rata_rata),
  );
}

// ═══ Riwayat ════════════════════════════════════════════════════════════
console.log("\n── Riwayat pesanan ──");

const h = await riwayatPesanan(40);
cek("riwayat berhasil dibaca", h.ok === true, h.ok ? "" : h.pesan);

if (h.ok) {
  cek("riwayat memuat SEMUA pesanan, bukan hanya yang lunas", h.data.length === 5, String(h.data.length));

  const ditolak = h.data.find((x) => x.nomor === "M1-2200-77");
  cek("pesanan ditolak tetap muncul di riwayat", !!ditolak);

  const tanpaTagihan = h.data.find((x) => x.nomor === "M1-1249-63");
  cek("pesanan tanpa tagihan tetap muncul", !!tanpaTagihan);
  cek("tanpa tagihan → total 0, bukan null/NaN", tanpaTagihan?.total === 0, String(tanpaTagihan?.total));
  cek(
    "tanpa tagihan → total_item 0, bukan NaN",
    tanpaTagihan?.total_item === 0,
    String(tanpaTagihan?.total_item),
  );

  const terbaru = h.data[0];
  cek("baris teratas = pesanan terbaru", terbaru?.nomor === "M1-2200-77", terbaru?.nomor);

  const budi = h.data.find((x) => x.nomor === "M1-0004-30");
  cek("nama meja ikut terbaca", budi?.meja === "1", String(budi?.meja));
  cek("nomor meja teks tidak diubah jadi angka", typeof budi?.meja === "string");
  cek("total dari tagihan", budi?.total === 351900, String(budi?.total));
  cek("nama pemesan terbaca", budi?.nama_pemesan === "Budi");
  cek("nama pemesan kosong tetap null, bukan 'null'", h.data.find((x) => x.nomor === "M1-2100-11")?.nama_pemesan === null);

  // Batas baris dihormati — dipakai admin (60) dan kasir (40).
  const sedikit = await riwayatPesanan(2);
  cek("batas baris dihormati", sedikit.ok && sedikit.data.length === 2, sedikit.ok ? String(sedikit.data.length) : "");
}

// ═══ Ketahanan ══════════════════════════════════════════════════════════
console.log("\n── Ketahanan ──");

/*
  Kalau tabel `pembayaran` bermasalah, omzet tetap harus keluar. Kasir
  yang kehilangan seluruh rangkuman karena rincian metode gagal akan
  mengira tidak ada penjualan sama sekali.
*/
permintaanGagal = "pembayaran";
const tanpaPembayaran = await ringkasanHariIni(new Date("2026-11-02T05:00:00.000Z"));
cek("pembayaran gagal → ringkasan tetap ada", tanpaPembayaran.ok === true);
if (tanpaPembayaran.ok) {
  cek("omzet tetap benar tanpa tabel pembayaran", tanpaPembayaran.data.omzet === 631600, String(tanpaPembayaran.data.omzet));
  cek(
    "tunai + non-tunai tetap = omzet (jatuh ke tunai)",
    tanpaPembayaran.data.tunai + tanpaPembayaran.data.nontunai === tanpaPembayaran.data.omzet,
    `${tanpaPembayaran.data.tunai} + ${tanpaPembayaran.data.nontunai}`,
  );
}
permintaanGagal = null;

permintaanGagal = "tagihan";
const tanpaTagihanTabel = await ringkasanHariIni(new Date("2026-11-02T05:00:00.000Z"));
cek("tagihan gagal → hasil galat, bukan angka palsu", tanpaTagihanTabel.ok === false);
cek("galat membawa pesan untuk ditampilkan", !!tanpaTagihanTabel.pesan);
permintaanGagal = null;

server.close();
console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal > 0 ? 1 : 0);
