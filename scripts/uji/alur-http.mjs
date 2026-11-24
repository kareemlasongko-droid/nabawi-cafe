/**
 * Uji ALUR LENGKAP lewat HTTP — route handler yang SUNGGUHAN.
 *
 * ── KENAPA BERKAS INI BERBEDA DARI `alur-lunas.mjs` ─────────────────
 *
 * `alur-lunas.mjs` memanggil fungsi lib langsung. Berkas ini menempuh
 * jalur yang benar-benar dipakai tamu, kasir, dapur, dan pelayan:
 *
 *     POST /api/order/pesanan      ← tamu checkout
 *     GET  /api/order/kasir        ← kasir melihat pesanan belum dibayar
 *     POST /api/order/kasir        ← kasir menerima tunai
 *     GET  /api/order/kasir        ← pesanan harus muncul di antrean
 *     GET  /api/order/dapur        ← tiket harus muncul di dapur
 *     PATCH /api/order/status      ← dapur memproses sampai siap
 *     GET  /api/order/pelayan      ← pelayan menerima yang siap
 *
 * Tiga bug di sesi ini hanya tertangkap di lapisan ini, bukan di uji
 * fungsi: (1) filter `in.` yang salah membuat kasir menjawab 500,
 * (2) `localeCompare` pada tanggal kosong menjatuhkan seluruh endpoint,
 * dan (3) dapur menyaring `menunggu_konfirmasi` sehingga pesanan yang
 * SUDAH DIBAYAR tidak pernah muncul di sana.
 *
 * ── BUTUH SERVER ────────────────────────────────────────────────────
 *
 * Skrip ini TIDAK menjalankan servernya sendiri: ia menguji server yang
 * sedang menyala. Pemilik memakai data sungguhan, jadi jangan arahkan ke
 * production — pakai server lokal dengan PostgREST tiruan (lihat
 * `npm run uji:http-lokal`).
 *
 * Jalankan:
 *   BASE=http://localhost:3000 node scripts/uji/alur-http.mjs
 */
const B = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");

const j = (p, o) => fetch(B + p, o).then(async (r) => ({ s: r.status, d: await r.json() }));
const post = (p, b) =>
  j(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const patch = (p, b) =>
  j(p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });

let L = 0;
let G = 0;
const cek = (n, s, d = "") => {
  if (s) {
    L++;
    console.log(`  LULUS  ${n}${d ? " — " + d : ""}`);
  } else {
    G++;
    console.log(`  GAGAL  ${n}${d ? " — " + d : ""}`);
  }
};

// Menu pertama yang tersedia diambil dari server — bukan nomor yang
// ditulis di sini, karena id menu berbeda di database sungguhan.
const menuRes = await j("/api/order/menu/tersedia");
const menuId = menuRes.d?.menu?.[0]?.id;
const mejaRes = await j("/api/order/kasir");
const mejaNomor = mejaRes.d?.meja?.[0]?.nomor;

if (!menuId || !mejaNomor) {
  console.error(
    "Tidak bisa memulai: server tidak mengembalikan menu/meja. " +
      "Pastikan server menyala dan database (atau tiruannya) terisi.",
  );
  process.exit(2);
}

console.log(`\n── 1. Tamu checkout: pilih BAYAR DI KASIR ──`);

const pesan = await post("/api/order/pesanan", {
  meja: mejaNomor,
  sesi: "uji-http-" + Date.now(),
  nama: "Tamu HTTP",
  no_wa: "081234567890",
  metode_bayar: "kasir",
  items: [{ menu_id: menuId, jumlah: 2, catatan: null, pilihan: [] }],
});

cek("POST pesanan diterima", pesan.s === 200, `status ${pesan.s}`);
if (pesan.s !== 200) {
  console.log("  ", JSON.stringify(pesan.d).slice(0, 300));
  console.log(`\n═══ ${L} lulus, ${G} gagal ═══`);
  process.exit(1);
}

const id = pesan.d.pesanan.id;
cek("pesanan punya id", Boolean(id), String(id));
cek("punya tagihan", Boolean(pesan.d.pesanan.tagihan_id), String(pesan.d.pesanan.tagihan_id));
cek(
  "metode tersimpan 'kasir'",
  pesan.d.pesanan.metode_bayar === "kasir",
  String(pesan.d.pesanan.metode_bayar),
);
cek("total > 0", pesan.d.tagihan.total > 0, "Rp" + pesan.d.tagihan.total);

console.log("\n── 2. Kasir melihat pesanan sebagai BELUM DIBAYAR ──");
const k1 = await j("/api/order/kasir");
cek("kasir terbaca", k1.s === 200);

const mb = (k1.d.menunggu_bayar || []).find((x) => x.id === id);
cek("muncul di menunggu_bayar", Boolean(mb));
cek("membawa nomor meja", Boolean(mb?.meja_nomor), mb?.meja_nomor);
cek(
  "belum muncul di antrean aktif (dapur tidak memasak yang belum dibayar)",
  !(k1.d.pesanan || []).some((x) => x.id === id),
);

console.log("\n── 3. Kasir menerima tunai ──");
const bayar = await post("/api/order/kasir", {
  aksi: "bayar_tunai",
  pesanan_id: id,
  uang_pas: true,
  oleh: "kasir-uji",
});

cek("bayar_tunai berhasil", bayar.s === 200, `status ${bayar.s} ${bayar.d.pesan ?? ""}`);
cek("status jadi lunas", bayar.d?.pesanan?.status_bayar === "lunas", String(bayar.d?.pesanan?.status_bayar));

console.log("\n── 4. Pesanan LUNAS harus terlihat di kasir & dapur ──");
const k2 = await j("/api/order/kasir");

const aktif = (k2.d.pesanan || []).find((x) => x.id === id);
cek("muncul di antrean kasir", Boolean(aktif));
cek("membawa nomor meja", Boolean(aktif?.meja_nomor), aktif?.meja_nomor);
cek("membawa item", (aktif?.items?.length ?? 0) > 0, `${aktif?.items?.length ?? 0} item`);
cek(
  "hilang dari menunggu_bayar",
  !(k2.d.menunggu_bayar || []).some((x) => x.id === id),
);

const dapur = await j("/api/order/dapur");
cek("dapur terbaca", dapur.s === 200);

const tiket = (dapur.d.tiket || []).find((x) => x.id === id);
cek("muncul di DAPUR", Boolean(tiket));
cek("tiket membawa nomor meja", Boolean(tiket?.meja_nomor), tiket?.meja_nomor);

console.log("\n── 5. Pelayan: hanya pesanan yang sudah siap ──");
const pelayan1 = await j("/api/order/pelayan");
cek("pelayan terbaca", pelayan1.s === 200);
cek(
  "pesanan yang belum dimasak TIDAK ada di daftar antar",
  !(pelayan1.d.siap || []).some((x) => x.id === id),
);

console.log("\n── 6. Naikkan status sampai siap → pelayan melihatnya ──");
for (const ke of ["diterima", "diproses", "siap"]) {
  const r = await patch("/api/order/status", { id, ke, oleh: "uji" });
  cek(`status → ${ke}`, r.s === 200, `status ${r.s} ${r.d.pesan ?? ""}`);
}

const pelayan2 = await j("/api/order/pelayan");
const siap = (pelayan2.d.siap || []).find((x) => x.id === id);
cek("pesanan SIAP muncul di pelayan", Boolean(siap));
cek("membawa nomor meja", Boolean(siap?.meja_nomor), siap?.meja_nomor);
cek("membawa item", (siap?.items?.length ?? 0) > 0);

console.log(`\n═══ ${L} lulus, ${G} gagal ═══`);
process.exit(G ? 1 : 0);
