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
  // Tiga elemen di satu garis harus setinggi kontrol (40px = h-10).
  // Tiga tinggi berbeda (20/28/40) pernah terbaca sebagai elemen yang
  // kebetulan berdekatan, bukan satu bilah.
  cek(
    "pelanggan: logo setinggi kontrol (40px)",
    kepalaPelanggan.includes("flex h-10 shrink-0 items-center") &&
      kepalaPelanggan.includes("width:28px;height:28px"),
  );
  // Kotak meja harus BERBENTUK SAMA dengan tombol: ikon + huruf 13px,
  // padding px-2, tinggi 40px. Kotak 40x40 berisi angka 17px adalah bentuk
  // lama — satu-satunya elemen tanpa ikon, jadi terbaca bukan satu bilah.
  cek(
    "pelanggan: kotak meja setinggi kontrol dan berikon",
    /<span[^>]*(?:class="[^"]*flex h-10[^"]*items-center[^"]*gap-1[^"]*px-[23][^"]*"[^>]*title="Meja|title="Meja[^>]*class="[^"]*flex h-10[^"]*items-center)/.test(
      kepalaPelanggan,
    ),
  );
  /*
    Ukuran huruf kotak meja harus SAMA dengan tombol di sebelahnya (13px),
    apa pun nama warna latarnya. Sempat ditulis `text-bersih-0`, lalu gagal
    ketika kotak meja memakai `text-cream-50` — padahal maksud uji ini
    "hurufnya seukuran tombol", bukan "token warnanya bernama bersih-0".
  */
  cek(
    "pelanggan: angka meja memakai ukuran huruf tombol (13px)",
    /text-\[0\.8125rem\][^"]*"(?:[^>]*)>\s*<span>Meja/.test(kepalaPelanggan) ||
      (kepalaPelanggan.includes("text-[0.8125rem]") &&
        !kepalaPelanggan.includes("text-[1.0625rem] font-extrabold")),
  );
  // "Meja" harus tertulis: angka tanpa satuan tidak berarti apa pun bagi tamu.
  // Warnanya harus mewarisi warna kotak — "Meja" yang diredupkan terbaca
  // sebagai informasi berbeda, padahal "Meja 3" adalah satu hal.
  cek(
    "pelanggan: kotak meja menulis \"Meja\" sebelum angka",
    /<span>Meja<\/span>\s*<span class="[^"]*tabular-nums"[^>]*>/.test(kepalaPelanggan) &&
      !kepalaPelanggan.includes("text-bersih-0/70"),
  );
  /*
    Fitur panggil/bill sudah dihapus, jadi kepala pelanggan hanya memuat
    identitas dan kotak meja. Dulu uji ini menghitung DUA tombol 40px di
    dalam kepala; sekarang yang benar justru NOL — dan uji yang tidak
    diperbarui akan terus "lulus" untuk tombol yang sudah tidak ada.
  */
  const tinggiTombol = [...kepalaPelanggan.matchAll(/<button[^>]*class="[^"]*h-10/g)];
  cek("pelanggan: kepala tidak lagi memuat tombol panggil/bill", tinggiTombol.length === 0);

  cek(
    "pelanggan: tidak ada tombol Panggil/Bill di mana pun",
    !pelanggan.includes(">Panggil<") && !/>\s*Bill\s*</.test(pelanggan),
  );

  cek("pelanggan: nomor meja tetap tampil di kepala", kepalaPelanggan.includes("Meja 3"));


  // Kepala pelayan harus benar-benar hanya identitas + satu tombol ikon.
  // Tab "Siap diantar"/"Panggilan" pernah tinggal di dalamnya dan membuat
  // bilah atas setinggi 88px yang menutupi kartu pertama saat digulir.
  const pelayanHtml = await (await fetch(BASE + "/order/pelayan")).text();
  const kepalaPelayan = pelayanHtml.slice(
    pelayanHtml.indexOf("<header"),
    pelayanHtml.indexOf("</header>"),
  );
  const setelahPelayan = pelayanHtml.slice(pelayanHtml.indexOf("</header>"), pelayanHtml.indexOf("</header>") + 2000);
  /*
    ── TAB PELAYAN SUDAH TIDAK ADA, DAN UJI INI DIPERBARUI ──────────────

    Dulu ada dua tab di bawah kepala ("Siap diantar" / "Panggilan"). Fitur
    panggilan dihapus, lalu tabnya ikut hilang — tersisa satu daftar saja,
    sehingga tidak ada yang perlu dipilih.

    Uji lama masih menuntut "Siap diantar" muncul tepat setelah kepala.
    Itu menuntut fitur yang sengaja dihapus, jadi ia gagal selamanya pada
    kode yang benar. Yang masih berharga dari uji itu adalah larangannya:
    kepala pelayan TIDAK BOLEH kembali memuat tab (dulu 88px dan menutupi
    kartu pertama saat digulir). Larangan itu dipertahankan di bawah.
  */
  cek(
    "pelayan: kepala tidak memuat tab apa pun",
    !kepalaPelayan.includes("Siap diantar") && !kepalaPelayan.includes("Panggilan"),
  );
  cek(
    "pelayan: daftar memakai lebar yang sama dengan kepala",
    pelayanHtml.includes('<main class="mx-auto max-w-[34rem]'),
  );
  void setelahPelayan;
  cek(
    "pelayan: tombol bunyi hanya ikon (tanpa label teks)",
    !/>Bunyi</.test(kepalaPelayan),
  );
  cek(
    "pelayan: tombol bunyi tetap bernama untuk pembaca layar",
    /<button[^>]*aria-label="(Matikan|Nyalakan) bunyi"/.test(kepalaPelayan),
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
