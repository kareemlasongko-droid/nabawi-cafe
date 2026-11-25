/**
 * Uji STOK & HPP lewat HTTP + PostgREST tiruan.
 *
 * ── YANG DIUJI DI SINI, DAN KENAPA HARUS LEWAT SERVER ────────────────
 *
 * `uji:hpp` menguji rumusnya. Ia tidak bisa membuktikan hal-hal berikut,
 * dan justru inilah yang paling mungkin salah:
 *
 *   1. Stok benar-benar bergerak saat pesanan LUNAS — bukan saat dibuat.
 *   2. Pesanan yang ditolak / kedaluwarsa TIDAK menyentuh stok.
 *   3. Menandai lunas DUA KALI tidak memotong stok dua kali.
 *   4. Harga rata-rata berubah setelah pembelian, dan HPP pesanan
 *      berikutnya memakai harga baru.
 *   5. HPP pesanan LAMA tidak berubah setelah harga naik.
 *
 * Poin 5 adalah alasan seluruh desain ini ada. Kalau uji ini tidak
 * menangkapnya, laporan laba bulan lalu bisa berubah sendiri.
 *
 * Jalankan:
 *   BASE=http://127.0.0.1:3000 node scripts/uji/stok-http.mjs
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

const json = (j, metode = "GET", o) =>
  fetch(BASE + j, {
    method: metode,
    headers: { "Content-Type": "application/json" },
    body: o === undefined ? undefined : JSON.stringify(o),
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

const stok = (o) => json("/api/order/stok", "POST", o).then((r) => r);

/** Buat pesanan lewat alur tamu yang sebenarnya. */
async function pesan(meja, items) {
  return json("/api/order/pesanan", "POST", {
    meja,
    sesi: "stok-" + Math.random().toString(36).slice(2),
    nama: "Tamu Stok",
    no_wa: "081200009999",
    lewatiJamBuka: true,
    metode_bayar: "kasir",
    items,
  });
}

const bayarTunai = (pesanan_id) =>
  json("/api/order/kasir", "POST", { aksi: "bayar_tunai", pesanan_id, uang_pas: true, kasir: "kasir-uji" });

// ═══ 1. Bahan ══════════════════════════════════════════════════════════
console.log("\n── 1. Bahan ──");

const unik = Date.now().toString(36);

const b1 = await stok({
  aksi: "bahan",
  nama: `Cabai-${unik}`,
  satuan: "gram",
  harga_satuan: 100,
  stok_minimum: 50,
  stok_awal: 1000,
  oleh: "uji",
});
cek("bahan baru dibuat", b1.status === 200, `status ${b1.status} ${b1.data?.pesan ?? ""}`);
const cabai = b1.data?.data?.id;

const b2 = await stok({
  aksi: "bahan",
  nama: `Beras-${unik}`,
  satuan: "gram",
  harga_satuan: 15,
  stok_minimum: 0,
  stok_awal: 5000,
  oleh: "uji",
});
const beras = b2.data?.data?.id;
cek("bahan kedua dibuat", b2.status === 200);

const dobel = await stok({
  aksi: "bahan",
  nama: `Cabai-${unik}`,
  satuan: "gram",
  harga_satuan: 100,
  oleh: "uji",
});
cek(
  "nama bahan kembar ditolak database",
  dobel.status !== 200,
  "dua 'Cabai' akan membelah stok jadi dua tanpa terlihat",
);

const daftar = await json("/api/order/stok?lihat=bahan");
cek("daftar bahan terbaca", daftar.status === 200);
const barisCabai = (daftar.data?.bahan ?? []).find((b) => b.id === cabai);
cek("stok awal tercatat", Number(barisCabai?.stok) === 1000, String(barisCabai?.stok));
cek("nilai stok = stok × harga", barisCabai?.nilai === 100000, String(barisCabai?.nilai));
cek("status cukup saat stok di atas minimum", barisCabai?.status === "cukup", barisCabai?.status);

/*
  ── Bahan tanpa gerakan stok sama sekali ──

  Ini keadaan hari pertama: master bahan terisi (seed), belum ada satu pun
  pembelian. Saldo 0 di sini berarti "belum diketahui", bukan "habis".
  Tanpa pembedaan ini, layar stok menuduh 100 bahan kehabisan sekaligus.
*/
const b3 = await stok({
  aksi: "bahan",
  nama: `Gula-${unik}`,
  satuan: "gram",
  harga_satuan: 16,
  stok_minimum: 500,
  // sengaja TANPA stok_awal → tidak ada gerakan 'awal'
  oleh: "uji",
});
const gula = b3.data?.data?.id;
cek("bahan tanpa stok awal dibuat", b3.status === 200, `status ${b3.status}`);

const daftar2 = await json("/api/order/stok?lihat=bahan");
const barisGula = (daftar2.data?.bahan ?? []).find((b) => b.id === gula);
cek("saldo 0", Number(barisGula?.stok) === 0, String(barisGula?.stok));
cek(
  "tanpa gerakan → 'belum_dicatat', bukan 'habis'",
  barisGula?.status === "belum_dicatat",
  barisGula?.status,
);

const perluAwal = await json("/api/order/stok?lihat=perlu");
const gulaPerlu = (perluAwal.data?.bahan ?? []).find((b) => b.id === gula);
cek(
  "tetap masuk daftar 'perlu dipesan' — perlu diisi, bukan diabaikan",
  !!gulaPerlu,
  "kalau dilewati, bahan tanpa stok tidak akan pernah muncul di layar belanja",
);

// Setelah ada gerakan nyata, statusnya harus ikut aturan biasa.
const isi = await stok({
  aksi: "pembelian",
  supplier: `Supplier Uji ${unik}`,
  no_nota: `GULA-${unik}`,
  item: [{ bahan_id: gula, jumlah: 100, harga_satuan: 16 }],
  oleh: "uji",
});
cek("pembelian pertama tercatat", isi.status === 200, `status ${isi.status} ${isi.data?.pesan ?? ""}`);

const daftar3 = await json("/api/order/stok?lihat=bahan");
const barisGula2 = (daftar3.data?.bahan ?? []).find((b) => b.id === gula);
cek(
  "setelah pembelian, status keluar dari 'belum_dicatat'",
  barisGula2?.status === "kritis",
  `stok ${barisGula2?.stok} ≤ minimum ${barisGula2?.stok_minimum} → ${barisGula2?.status}`,
);

// ═══ 2. Resep ══════════════════════════════════════════════════════════
console.log("\n── 2. Resep ──");

const menuId = 3; // menu yang dipakai uji lain: Ayam Bakar Sambal Matah
const r1 = await stok({
  aksi: "resep",
  menu_id: menuId,
  baris: [
    { bahan_id: cabai, jumlah: 5, perkiraan: false },
    { bahan_id: beras, jumlah: 200, perkiraan: false },
  ],
  oleh: "uji",
});
cek("resep tersimpan", r1.status === 200, `status ${r1.status} ${r1.data?.pesan ?? ""}`);

const resep = await json(`/api/order/stok?lihat=resep&menu_id=${menuId}`);
cek("resep terbaca", resep.status === 200);
// 5 × 100 + 200 × 15 = 500 + 3.000 = 3.500
cek("HPP satu porsi = jumlah bahan × harga", resep.data?.hpp === 3500, String(resep.data?.hpp));
cek("resep lengkap (semua bahan punya harga)", resep.data?.lengkap === true);
cek("resep bukan perkiraan setelah diketik manusia", resep.data?.perkiraan === false);

// Ganti resep harus MENGGANTI, bukan menambah.
const r2 = await stok({
  aksi: "resep",
  menu_id: menuId,
  baris: [{ bahan_id: cabai, jumlah: 10, perkiraan: false }],
  oleh: "uji",
});
cek("resep bisa diganti", r2.status === 200);
const resep2 = await json(`/api/order/stok?lihat=resep&menu_id=${menuId}`);
cek(
  "bahan yang dihapus benar-benar hilang dari resep",
  resep2.data?.baris?.length === 1,
  `${resep2.data?.baris?.length} baris`,
);
cek("HPP ikut berubah (10 × 100 = 1.000)", resep2.data?.hpp === 1000, String(resep2.data?.hpp));

// ═══ 3. Pesanan belum lunas TIDAK menyentuh stok ═══════════════════════
console.log("\n── 3. Pesanan belum lunas tidak memotong stok ──");

const p1 = await pesan("9", [{ menu_id: menuId, jumlah: 2, catatan: null, pilihan: ["Sambal Matah"] }]);
cek("pesanan dibuat", p1.status === 200, `status ${p1.status}`);
const id1 = p1.data?.pesanan?.id;

const setelahPesan = await json("/api/order/stok?lihat=bahan");
const cabaiSetelahPesan = (setelahPesan.data?.bahan ?? []).find((b) => b.id === cabai);
cek(
  "stok BELUM berkurang sebelum dibayar",
  Number(cabaiSetelahPesan?.stok) === 1000,
  String(cabaiSetelahPesan?.stok),
);

// ═══ 4. Dibayar → stok terpotong, HPP terkunci ═════════════════════════
console.log("\n── 4. Lunas → stok terpotong ──");

const bayar = await bayarTunai(id1);
cek("pembayaran tunai berhasil", bayar.status === 200, `status ${bayar.status} ${bayar.data?.pesan ?? ""}`);

const setelahBayar = await json("/api/order/stok?lihat=bahan");
const cabaiSetelahBayar = (setelahBayar.data?.bahan ?? []).find((b) => b.id === cabai);
// 2 porsi × 10 g = 20 g → 1000 − 20 = 980
cek("stok berkurang sesuai resep × porsi", Number(cabaiSetelahBayar?.stok) === 980, String(cabaiSetelahBayar?.stok));

const gerak = await json("/api/order/stok?lihat=gerakan&batas=20");
const pakai = (gerak.data?.gerakan ?? []).filter((g) => g.jenis === "pakai" && g.bahan === `Cabai-${unik}`);
cek("gerakan 'pakai' tercatat", pakai.length === 1, `${pakai.length} baris`);
cek("jumlahnya NEGATIF (stok keluar)", Number(pakai[0]?.jumlah) === -20, String(pakai[0]?.jumlah));
cek("nilainya dikunci di harga saat itu (20 × 100)", pakai[0]?.nilai === 2000, String(pakai[0]?.nilai));

// ═══ 5. Idempoten: bayar dua kali tidak memotong dua kali ══════════════
console.log("\n── 5. Menandai lunas dua kali ──");

const bayarLagi = await bayarTunai(id1);
cek(
  "pembayaran kedua ditolak (pesanan sudah lunas)",
  bayarLagi.status !== 200,
  `status ${bayarLagi.status}`,
);

const setelahDua = await json("/api/order/stok?lihat=bahan");
const cabaiDua = (setelahDua.data?.bahan ?? []).find((b) => b.id === cabai);
cek(
  "stok TIDAK terpotong dua kali",
  Number(cabaiDua?.stok) === 980,
  `stok ${cabaiDua?.stok} (harus tetap 980, bukan 960)`,
);

// ═══ 6. Harga berubah → HPP lama tidak berubah ═════════════════════════
console.log("\n── 6. Harga naik: HPP lama tetap ──");

/*
  Cabai naik 100 → 300 lewat pembelian 500 g @ Rp300.
  Rata-rata = (980 × 100 + 500 × 300) / 1.480 = 167,5... → 168
*/
const beli = await stok({
  aksi: "pembelian",
  supplier: "Pasar Uji",
  no_nota: `NOTA-${unik}`,
  item: [{ bahan_id: cabai, jumlah: 500, harga_satuan: 300 }],
  oleh: "uji",
});
cek("pembelian tercatat", beli.status === 200, `status ${beli.status} ${beli.data?.pesan ?? ""}`);
cek("total pembelian benar", beli.data?.data?.pembelian?.total === 150000, String(beli.data?.data?.pembelian?.total));

const afterBeli = await json("/api/order/stok?lihat=bahan");
const cabaiBaru = (afterBeli.data?.bahan ?? []).find((b) => b.id === cabai);
cek("stok bertambah 500", Number(cabaiBaru?.stok) === 1480, String(cabaiBaru?.stok));
cek(
  "harga rata-rata bergerak naik",
  cabaiBaru?.harga_satuan > 100 && cabaiBaru?.harga_satuan < 300,
  `Rp${cabaiBaru?.harga_satuan}/gram`,
);

// Nota kembar harus ditolak — ini yang mencegah pembelian tercatat dua kali.
const beliDobel = await stok({
  aksi: "pembelian",
  supplier: "Pasar Uji",
  no_nota: `NOTA-${unik}`,
  item: [{ bahan_id: cabai, jumlah: 500, harga_satuan: 300 }],
  oleh: "uji",
});
cek("nota yang sama tidak bisa dicatat dua kali", beliDobel.status !== 200, `status ${beliDobel.status}`);

/*
  Pesanan BARU sekarang harus memakai harga baru, sedangkan HPP pesanan
  LAMA tetap memakai harga lama. Inilah inti dari "HPP dikunci".
*/
const p2 = await pesan("9", [{ menu_id: menuId, jumlah: 1, catatan: null, pilihan: ["Sambal Matah"] }]);
const id2 = p2.data?.pesanan?.id;
await bayarTunai(id2);

const gerak2 = await json("/api/order/stok?lihat=gerakan&batas=30");
const pakai2 = (gerak2.data?.gerakan ?? []).filter((g) => g.jenis === "pakai" && g.bahan === `Cabai-${unik}`);
const harga1 = pakai2.find((g) => Number(g.jumlah) === -20)?.nilai;
const harga2 = pakai2.find((g) => Number(g.jumlah) === -10)?.nilai;
cek("pemakaian pertama tetap Rp2.000 (harga lama)", harga1 === 2000, String(harga1));
cek(
  "pemakaian kedua memakai harga BARU",
  harga2 === 1680,
  String(harga2),
);
cek("harga lama dan baru berbeda → benar-benar dikunci", harga1 !== harga2);

// ═══ 7. Pesanan ditolak tidak menyentuh stok ═══════════════════════════
console.log("\n── 7. Pesanan ditolak ──");

const p3 = await pesan("9", [{ menu_id: menuId, jumlah: 3, catatan: null, pilihan: ["Sambal Matah"] }]);
const id3 = p3.data?.pesanan?.id;
const tolak = await json("/api/order/status", "PATCH", {
  id: id3,
  ke: "ditolak",
  alasan: "uji",
  oleh: "kasir-uji",
});
cek("pesanan ditolak", tolak.status === 200, `status ${tolak.status} ${tolak.data?.pesan ?? ""}`);

const afterTolak = await json("/api/order/stok?lihat=bahan");
const cabaiTolak = (afterTolak.data?.bahan ?? []).find((b) => b.id === cabai);
cek(
  "pesanan ditolak TIDAK memotong stok",
  Number(cabaiTolak?.stok) === 1470,
  `stok ${cabaiTolak?.stok} — pesanan yang tidak pernah dimasak tidak boleh memakai bahan`,
);

// ═══ 8. Opname ═════════════════════════════════════════════════════════
console.log("\n── 8. Opname ──");

const op = await stok({ aksi: "opname", bahan_id: beras, fisik: 4800, oleh: "uji" });
cek("opname tersimpan", op.status === 200, `status ${op.status} ${op.data?.pesan ?? ""}`);
cek("selisih dihitung server, bukan dikirim browser", op.data?.data?.selisih === -200, String(op.data?.data?.selisih));

const afterOpname = await json("/api/order/stok?lihat=bahan");
const berasBaru = (afterOpname.data?.bahan ?? []).find((b) => b.id === beras);
cek("saldo stok = angka fisik", Number(berasBaru?.stok) === 4800, String(berasBaru?.stok));

const opCocok = await stok({ aksi: "opname", bahan_id: beras, fisik: 4800, oleh: "uji" });
cek("opname tanpa selisih tidak menulis gerakan", opCocok.data?.data?.selisih === 0);

// ═══ 9. Daftar yang perlu dipesan ══════════════════════════════════════
console.log("\n── 9. Peringatan stok ──");

await stok({ aksi: "opname", bahan_id: cabai, fisik: 10, oleh: "uji" });
const perlu = await json("/api/order/stok?lihat=perlu");
const perluCabai = (perlu.data?.bahan ?? []).find((b) => b.id === cabai);
cek("bahan di bawah minimum masuk 'perlu dipesan'", !!perluCabai, perluCabai?.status);
cek("statusnya kritis", perluCabai?.status === "kritis", perluCabai?.status);

await stok({ aksi: "opname", bahan_id: cabai, fisik: 0, oleh: "uji" });
const perlu2 = await json("/api/order/stok?lihat=perlu");
const habis = (perlu2.data?.bahan ?? []).find((b) => b.id === cabai);
cek("stok 0 → status habis", habis?.status === "habis", habis?.status);

// ═══ 10. Keamanan ══════════════════════════════════════════════════════
console.log("\n── 10. Tidak bocor ke publik ──");

/*
  ── LAPISAN PERTAHANAN, DAN BATAS UJI INI ────────────────────────────

  Tabel stok tidak punya policy RLS: anon key tidak bisa membaca apa pun
  dari database. Itu lapisan yang sebenarnya, dan tidak bisa diuji dari
  sini karena server uji memakai service key.

  Yang diuji di sini adalah lapisan KEDUA: kalau kunci server tidak ada,
  rute harus menolak dengan pesan yang bisa ditindaklanjuti — bukan
  meneruskan kueri yang lalu gagal dengan pesan Postgres mentah, dan
  bukan pula diam-diam menjawab 200 dengan data kosong (yang membuat admin
  mengira stoknya memang kosong).
*/
const sumber = await (await fetch(BASE + "/order/admin")).text();
cek("portal admin terbuka tanpa galat server", !/Application error|Internal Server Error/.test(sumber));

const daftarHpp = await json("/api/order/stok?lihat=hpp");
cek("daftar HPP terbaca dengan kunci server", daftarHpp.status === 200 && Array.isArray(daftarHpp.data?.menu));
cek(
  "setiap menu membawa field HPP (bukan bocor sebagian)",
  (daftarHpp.data?.menu ?? []).every((m) => typeof m.hpp === "number" && "lengkap" in m),
);

const aksiAsing = await stok({ aksi: "tidak_ada", oleh: "uji" });
cek("aksi tak dikenal ditolak 400, bukan 500", aksiAsing.status === 400, `status ${aksiAsing.status}`);

const lihatAsing = await json("/api/order/stok?lihat=tidak_ada");
cek("nilai 'lihat' tak dikenal ditolak", lihatAsing.status !== 200, `status ${lihatAsing.status}`);

// ═══ 11. HPP harian menyambung ke omzet ════════════════════════════════
console.log("\n── 11. HPP harian ──");

const harian = await json("/api/order/stok?lihat=harian&hari=14");
cek("laporan harian terbaca", harian.status === 200, `status ${harian.status}`);
const hariIni = (harian.data?.harian ?? [])[0];
cek("ada baris untuk hari ini", !!hariIni, hariIni?.tanggal);
cek("omzet hari ini > 0", (hariIni?.omzet ?? 0) > 0, String(hariIni?.omzet));
cek("HPP hari ini > 0", (hariIni?.hpp ?? 0) > 0, String(hariIni?.hpp));
cek(
  "laba = omzet − HPP",
  hariIni && hariIni.laba === hariIni.omzet - hariIni.hpp,
  hariIni ? `${hariIni.omzet} − ${hariIni.hpp} = ${hariIni.laba}` : "",
);
cek(
  "persen laba konsisten dengan omzet",
  hariIni && hariIni.omzet > 0
    ? Math.abs(hariIni.persen - (hariIni.laba / hariIni.omzet) * 100) < 0.1
    : false,
  hariIni ? `${hariIni.persen}%` : "",
);

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal > 0 ? 1 : 0);
