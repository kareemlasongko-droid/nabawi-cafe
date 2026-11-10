/**
 * Uji regresi alur order Nabawi Cafe.
 *
 * Kenapa berkas ini ada di dalam repo, bukan di /tmp:
 * sandbox kerja bisa di-reset, dan skrip uji di /tmp ikut terhapus. Saat itu
 * terjadi, "regresi hijau" berubah jadi asumsi — dua kali saya hampir
 * melaporkan uji lulus padahal skripnya sudah tidak ada. Skrip yang tinggal
 * di repo bisa dijalankan ulang siapa pun, kapan pun.
 *
 * Pakai:
 *   npm start                     # di terminal lain
 *   node scripts/uji/regresi.mjs  # default http://localhost:3000
 *   BASE=https://... node scripts/uji/regresi.mjs
 *
 * Skrip ini MENULIS data contoh (pesanan, panggilan, pembayaran) ke server
 * yang diuji. Jangan arahkan ke database produksi.
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

async function api(jalur, opsi = {}) {
  const r = await fetch(BASE + jalur, {
    ...opsi,
    headers: { "Content-Type": "application/json", ...(opsi.headers ?? {}) },
  });
  const teks = await r.text();
  let data;
  try {
    data = JSON.parse(teks);
  } catch {
    data = teks;
  }
  return { status: r.status, data };
}

const post = (jalur, isi) => api(jalur, { method: "POST", body: JSON.stringify(isi) });
const patch = (jalur, isi) => api(jalur, { method: "PATCH", body: JSON.stringify(isi) });

async function main() {
  console.log(`Menguji ${BASE}\n`);
  await post("/api/order/kasir", { aksi: "reset_demo" });

  const sesi = "reg-" + Date.now();
  const kirim = (meja, menu_id, jumlah, s = sesi) =>
    post("/api/order/pesanan", {
      meja,
      sesi: s,
      nama: "Uji",
      lewatiJamBuka: true,
      items: [{ menu_id, jumlah, catatan: null, pilihan: [] }],
    });

  const awal = await api("/api/order/kasir");
  cek("menu terbaca 126", awal.data.menu.length === 126, `${awal.data.menu.length} item`);
  cek(
    "kategori tinggal 6",
    new Set(awal.data.menu.map((m) => m.kategori_id)).size === 6,
    `${new Set(awal.data.menu.map((m) => m.kategori_id)).size} kategori`
  );

  const nasi = awal.data.menu.find((m) => m.nama === "Nasi Goreng Kebuli");
  if (!nasi) {
    cek("menu acuan ada", false, "Nasi Goreng Kebuli tidak ditemukan");
    return rangkum();
  }

  const r1 = await kirim("12", nasi.id, 2);
  cek("pesanan diterima", r1.status === 200, `status ${r1.status}`);
  cek("harga diambil dari server", r1.data?.items?.[0]?.harga_satuan === 40000, `Rp${r1.data?.items?.[0]?.harga_satuan}`);
  cek("tagihan terbentuk", Boolean(r1.data?.tagihan), `Rp${r1.data?.tagihan?.total}`);

  const id = r1.data?.pesanan?.id;
  const kasir1 = await api("/api/order/kasir");
  const meja12 = (kasir1.data.meja ?? []).find((m) => m.nomor === "12");
  cek("meja jadi TERISI", meja12?.status === "ada_pesanan", meja12?.status);

  await patch("/api/order/status", { id, ke: "diterima" });
  const dapur = await api("/api/order/dapur");
  cek("tiket muncul di dapur", (dapur.data.tiket ?? []).some((t) => t.id === id));
  cek("ambang waktu 10/15 menit", dapur.data.ambang?.kuning === 10 && dapur.data.ambang?.merah === 15);

  await patch("/api/order/status", { id, ke: "diproses" });
  await patch("/api/order/status", { id, ke: "siap" });
  const pelayan = await api("/api/order/pelayan");
  cek("pesanan siap muncul di pelayan", (pelayan.data.siap ?? []).some((p) => p.id === id));

  await patch("/api/order/status", { id, ke: "diantar" });
  const tambah = await kirim("12", nasi.id, 1, sesi + "-2");
  cek("pesanan tambahan masuk tagihan yang sama", tambah.data?.tagihan?.id === r1.data?.tagihan?.id);

  const pang = await post("/api/order/panggilan", { meja: "12", jenis: "bill" });
  cek("panggilan bill tercatat", pang.status === 200);
  const pang2 = await post("/api/order/panggilan", { meja: "12", jenis: "bill" });
  cek("panggilan ganda tidak menumpuk", pang2.data?.sudahAda === true);

  const sekarang = await api("/api/order/kasir");
  const m12 = (sekarang.data.meja ?? []).find((m) => m.nomor === "12");
  const kurang = await post("/api/order/bayar", {
    tagihan_id: m12.tagihan.id,
    metode: "tunai",
    diterima: 1000,
    kasir: "Uji",
  });
  cek("bayar kurang ditolak", kurang.status === 400, `status ${kurang.status}`);

  const lunas = await post("/api/order/bayar", {
    tagihan_id: m12.tagihan.id,
    metode: "tunai",
    diterima: m12.tagihan.total + 50000,
    kasir: "Uji",
  });
  cek("bayar lunas diterima", lunas.status === 200, `status ${lunas.status}`);
  // Kembalian sengaja TIDAK diuji di sini: dihitung di browser
  // (PortalKasir: Math.max(0, diterima - total)) supaya angka di layar kasir
  // dan angka di struk berasal dari sumber yang sama. Yang diuji di server
  // adalah akibatnya — tagihan tidak lagi terbuka.
  cek(
    "tagihan tertutup setelah lunas",
    lunas.data?.tagihan?.status === "lunas" || lunas.data?.tagihan?.status === "dibayar",
    `status ${lunas.data?.tagihan?.status}`
  );

  await post("/api/order/kasir", { aksi: "set_tersedia", menu_id: nasi.id, tersedia: false });
  const habis = await kirim("12", nasi.id, 1, sesi + "-3");
  cek("menu habis ditolak pelanggan", habis.status === 400, `status ${habis.status}`);
  await post("/api/order/kasir", { aksi: "set_tersedia", menu_id: nasi.id, tersedia: true });

  for (const [jalur, nama] of [
    ["/order?meja=3", "portal pelanggan"],
    ["/order/kasir", "portal kasir"],
    ["/order/dapur", "portal dapur"],
    ["/order/pelayan", "portal pelayan"],
    ["/order/admin", "portal admin"],
    ["/order/masuk", "halaman masuk"],
  ]) {
    const r = await fetch(BASE + jalur);
    cek(`${nama} memuat`, r.status === 200, `status ${r.status}`);
  }

  rangkum();
}

function rangkum() {
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
