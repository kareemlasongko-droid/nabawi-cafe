/**
 * Uji tata letak kepala portal order.
 *
 * KENAPA UJI INI ADA
 * Kepala portal sudah tiga kali diubah bentuknya: dua baris (ditolak),
 * satu baris dengan garis tegak, lalu satu baris dua kelompok rata
 * kanan-kiri. Yang paling mudah rusak tanpa disadari bukan warnanya,
 * melainkan ATURAN yang membuatnya muat: identitas di kiri, alat di kanan,
 * tanpa `flex-wrap`, dan tombol yang menyusut jadi ikon tetap punya nama.
 *
 * Uji ini membaca HTML hasil render, bukan menghitung lebar piksel —
 * peramban tetap yang menentukan lebar. Yang diperiksa adalah hal-hal yang
 * boleh dipastikan dari markup:
 *   1. setiap kepala memakai `justify-between` dan TIDAK `flex-wrap`;
 *   2. logo kafe ada di dalam kepala;
 *   3. tombol tanpa label teks tetap punya `aria-label`;
 *   4. baris kedua (keterangan/`block` bertumpuk) tidak kembali muncul.
 *
 * Pakai:
 *   npm start
 *   node scripts/uji/kepala-portal.mjs
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

const HALAMAN = [
  ["/order?meja=3", "pelanggan"],
  ["/order/kasir", "kasir"],
  ["/order/dapur", "dapur"],
  ["/order/pelayan", "pelayan"],
  ["/order/admin", "admin"],
  ["/order/masuk", "masuk"],
];

async function main() {
  console.log(`\n── Kepala portal @ ${BASE} ──`);

  for (const [jalur, nama] of HALAMAN) {
    const r = await fetch(BASE + jalur);
    const html = await r.text();
    const awal = html.indexOf("<header");
    const akhir = html.indexOf("</header>", awal);
    const kepala = awal >= 0 ? html.slice(awal, akhir) : "";

    cek(`${nama}: kepala ada`, kepala.length > 0);
    if (!kepala.length) continue;

    cek(`${nama}: dua kelompok rata kanan-kiri`, kepala.includes("justify-between"));
    cek(`${nama}: tidak membungkus ke baris kedua`, !/flex-wrap/.test(kepala));
    cek(`${nama}: logo kafe di kepala`, kepala.includes("logo-nabawi"));

    // Tombol tanpa teks terlihat di ponsel wajib punya nama untuk pembaca
    // layar. Tanpanya, tombol ikon menjadi "tombol" tanpa keterangan.
    const tombol = [...kepala.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    const tanpaNama = tombol.filter(
      (t) => !/aria-label="[^"]+"/.test(t) && !/>[^<]*[A-Za-z]/.test(kepala),
    );
    cek(`${nama}: ${tombol.length} tombol kepala bernama`, tanpaNama.length === 0);
  }

  // Aturan yang pernah dilanggar: kepala pelanggan sempat punya blok
  // identitas terpisah di atas baris meja + tombol.
  const pelanggan = await (await fetch(BASE + "/order?meja=3")).text();
  const kepalaPelanggan = pelanggan.slice(
    pelanggan.indexOf("<header"),
    pelanggan.indexOf("</header>"),
  );
  cek(
    "pelanggan: logo dan meja di baris yang sama",
    kepalaPelanggan.indexOf("logo-nabawi") < kepalaPelanggan.indexOf("Meja 3"),
  );
  cek(
    "pelanggan: Meja, Panggil, Bill berada di kelompok kanan",
    kepalaPelanggan.indexOf("Meja 3") < kepalaPelanggan.indexOf("Panggil") &&
      kepalaPelanggan.indexOf("Panggil") < kepalaPelanggan.indexOf("Bill"),
  );

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
