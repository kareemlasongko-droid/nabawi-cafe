/**
 * Uji bug yang ditemukan saat audit menyeluruh (2026-11-11).
 *
 * KENAPA BERKAS INI ADA
 * Tiga cacat di bawah ini lolos dari seluruh uji sebelumnya karena uji lama
 * memeriksa alur yang BENAR, bukan masukan yang salah. Ketiganya baru
 * ketahuan setelah dicoba langsung ke server dengan data yang tidak wajar.
 * Uji yang tinggal di repo membuatnya tidak bisa kembali diam-diam.
 *
 * Pakai:
 *   npm start
 *   node scripts/uji/bug-audit.mjs
 */

const BASE = process.env.BASE ?? "http://localhost:3000";
let lulus = 0;
let gagal = 0;
const kegagalan = [];

function cek(nama, syarat, detail = "") {
  if (syarat) {
    lulus++;
    console.log(`  LULUS  ${nama}${detail ? " — " + detail : ""}`);
  } else {
    gagal++;
    kegagalan.push(nama);
    console.log(`  GAGAL  ${nama}${detail ? " — " + detail : ""}`);
  }
}

const json = (p, opsi) => fetch(BASE + p, opsi).then(async (r) => ({ status: r.status, data: await r.json() }));
const kirim = (body) =>
  json("/api/order/pesanan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function main() {
  console.log(`\n── Bug audit @ ${BASE} ──`);

  const menuRes = await fetch(BASE + "/api/order/menu/tersedia").then((r) => r.json());
  const menu = menuRes.menu ?? menuRes;
  const contoh = menu[0];

  // ── 1. menu_id palsu ────────────────────────────────────────────
  // Dulu mode demo menerimanya dan membuat item bernama "Menu 999999"
  // seharga Rp0. Jalur database menolaknya, jadi perilaku demo berbeda.
  const palsu = await kirim({
    meja: "1",
    sesi: "audit-palsu-" + Date.now(),
    items: [{ menu_id: 999999, jumlah: 1 }],
  });
  cek("menu_id tidak dikenal ditolak", palsu.status === 400, palsu.data.pesan);

  // ── 2. jumlah desimal ───────────────────────────────────────────
  // Math.floor diam-diam mengubah 1,9 menjadi 2 porsi.
  const desimal = await kirim({
    meja: "1",
    sesi: "audit-desimal-" + Date.now(),
    items: [{ menu_id: contoh.id, jumlah: 1.9 }],
  });
  cek("jumlah desimal ditolak", desimal.status === 400, desimal.data.pesan);

  const bulat = await kirim({
    meja: "1",
    sesi: "audit-bulat-" + Date.now(),
    items: [{ menu_id: contoh.id, jumlah: 2 }],
  });
  cek("jumlah bulat tetap diterima", bulat.status === 200);

  // ── 3. tagihan setelah pesanan dibatalkan ───────────────────────
  // Dulu total tetap Rp91.000 dengan daftar item kosong.
  const mejaUji = "8";
  const sesi = "audit-batal-" + Date.now();
  const buat = await kirim({ meja: mejaUji, sesi, items: [{ menu_id: contoh.id, jumlah: 2 }] });
  if (buat.status !== 200) {
    cek("pesanan uji untuk pembatalan dibuat", false, buat.data.pesan);
  } else {
    const idPesanan = buat.data.pesanan.id;
    const sebelum = await fetch(BASE + "/api/order/kasir").then((r) => r.json());
    const tagA = sebelum.meja.find((m) => m.nomor === mejaUji)?.tagihan;
    cek("tagihan terbentuk sebelum pembatalan", Boolean(tagA) && tagA.total > 0, `Rp${tagA?.total}`);

    await json("/api/order/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idPesanan, ke: "dibatalkan", alasan: "uji audit" }),
    });

    const sesudah = await fetch(BASE + "/api/order/kasir").then((r) => r.json());
    const m = sesudah.meja.find((x) => x.nomor === mejaUji);
    cek(
      "tagihan ikut nol setelah pesanan dibatalkan",
      m?.tagihan?.total === 0 && m?.items_tagihan?.length === 0,
      `total Rp${m?.tagihan?.total ?? "?"}, ${m?.items_tagihan?.length ?? "?"} item`,
    );
    cek(
      "biaya layanan tidak muncul di tagihan kosong",
      m?.tagihan?.layanan === 0 && m?.tagihan?.pajak === 0,
      `layanan ${m?.tagihan?.layanan}, pajak ${m?.tagihan?.pajak}`,
    );
  }

  // ── 4. masukan tidak wajar lain (jaring pengaman) ───────────────
  for (const [nama, body] of [
    ["tanpa body", undefined],
    ["items bukan array", { meja: "1", sesi: "x", items: "dua" }],
    ["jumlah negatif", { meja: "1", sesi: "x", items: [{ menu_id: contoh.id, jumlah: -3 }] }],
    ["jumlah nol", { meja: "1", sesi: "x", items: [{ menu_id: contoh.id, jumlah: 0 }] }],
    ["sesi kosong", { meja: "1", sesi: "", items: [{ menu_id: contoh.id, jumlah: 1 }] }],
  ]) {
    const r =
      body === undefined
        ? await json("/api/order/pesanan", { method: "POST" })
        : await kirim(body);
    cek(`masukan ditolak: ${nama}`, r.status === 400, r.data.pesan ?? "");
  }

  console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
  if (gagal > 0) {
    console.log("Yang gagal: " + kegagalan.join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Uji berhenti karena kesalahan:", e.message);
  process.exit(1);
});
