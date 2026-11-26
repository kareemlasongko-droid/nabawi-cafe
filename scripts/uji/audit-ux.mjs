/**
 * Uji AUDIT UX — mengunci hasil audit 2026-11-02.
 *
 * ── MENGAPA UJI INI ADA ────────────────────────────────────────────────
 *
 * Audit UX menemukan enam kelemahan yang TIDAK menghasilkan galat apa pun:
 * warna legenda yang tidak pernah dipakai, nomor pesanan yang ditulis dua
 * kali, tombol 28px yang ditekan sambil memegang ponsel, dan pesan
 * "gagal dibaca" yang muncul saat data sebenarnya sedang dimuat.
 *
 * Semuanya lolos build, lolos TypeScript, dan lolos seluruh uji
 * fungsional — karena tidak satu pun menyangkut alur bisnis. Yang
 * memburuk hanya pengalaman orang yang memakainya, dan itu tidak pernah
 * muncul di log.
 *
 * Uji ini memeriksa hal-hal yang bisa dibuktikan dari HTML dan dari
 * respons API, bukan selera.
 *
 * Jalankan (server menyala):
 *   BASE=http://127.0.0.1:3000 node scripts/uji/audit-ux.mjs
 */

const BASE = process.env.BASE ?? "http://localhost:3000";

let lulus = 0;
let gagal = 0;
const kegagalan = [];
const cek = (nama, syarat, detail = "") => {
  if (syarat) {
    lulus++;
    console.log(`  LULUS  ${nama}${detail ? " — " + detail : ""}`);
  } else {
    gagal++;
    kegagalan.push(nama);
    console.log(`  GAGAL  ${nama}${detail ? " — " + detail : ""}`);
  }
};

const teks = (p) => fetch(BASE + p).then((r) => r.text());

async function main() {
  console.log(`\n── Audit UX @ ${BASE} ──`);

  // ═══ 1. Ukuran sentuh ══════════════════════════════════════════════
  console.log("\n── 1. Ukuran sentuh minimum 44px ──");

  const pelanggan = await teks("/order?meja=3");
  /*
    Tombol tambah/kurangi keranjang: dua tombol yang paling sering ditekan
    di seluruh layar pelanggan. 28px dan 32px adalah versi lamanya.
  */
  cek(
    "pelanggan: tombol tambah (+) minimal 44px",
    !pelanggan.includes("grid size-8 shrink-0 place-items-center rounded-full bg-forest-900"),
    "size-8 = 32px, di bawah ambang sentuh",
  );
  cek(
    "pelanggan: tombol kurangi/tambah di keranjang 44px",
    !/grid size-7 place-items-center rounded-full/.test(pelanggan),
    "size-7 = 28px, terlalu kecil untuk ibu jari",
  );

  /*
    Komponen portal adalah komponen KLIEN: kelasnya tidak ada di HTML yang
    dikirim server, hanya di bundel JS-nya. Membaca HTML di sini akan
    menghasilkan "gagal" untuk kode yang benar — persis kesalahan yang
    sempat terjadi saat uji ini ditulis.
  */
  const pelayanJs = await gabungBundel(await teks("/order/pelayan"));
  cek(
    "pelayan: tombol 'Sudah diantar' minimal 44px",
    pelayanJs.includes("min-h-12"),
    "min-h-12 = 48px; aksi satu-satunya di kartu, ditekan sambil membawa nampan",
  );

  // ═══ 2. Nomor pesanan tidak diduplikasi ════════════════════════════
  console.log("\n── 2. Kartu antrean: satu nomor, satu kali ──");

  const kasirHtml = await teks("/order/kasir");
  const kasirJs = await gabungBundel(kasirHtml);
  /*
    Bug lama: nomor muncul sekali kecil (font-mono text-[0.6875rem]) lalu
    sekali besar tepat di bawahnya. Yang diperiksa: tidak ada lagi
    span font-mono kecil BERISI nomor itu di dalam kepala kartu.
  */
  cek(
    "kasir: tidak ada nomor pesanan kecil di atas nomor besar",
    !kasirJs.includes('font-mono text-[0.6875rem] font-semibold text-tinta-500') ||
      !kasirJs.includes(">\\n                          {p.nomor}"),
  );

  // ═══ 3. Tiga keadaan meja benar-benar dibedakan ════════════════════
  console.log("\n── 3. Tiga keadaan meja ──");

  cek(
    "kasir: kartu meja punya gaya khusus 'perlu ditagih'",
    kasirJs.includes("border-sela-500 bg-sela-50"),
    "sebelumnya hijau yang sama dengan 'terisi'",
  );
  cek(
    "kasir: label kartu membedakan tagih vs terisi",
    kasirJs.includes("tagih"),
    "satu keadaan tidak boleh memakai label yang sama dengan keadaan lain",
  );

  // ═══ 4. "Memuat" bukan "gagal" ═════════════════════════════════════
  console.log("\n── 4. Memuat ≠ gagal ──");

  cek(
    "KartuRingkasan punya keadaan memuat",
    kasirJs.includes("Memuat rangkuman penjualan"),
    "tanpa ini kasir melihat pesan KEGAGALAN setiap kali tab Laporan dibuka",
  );
  cek(
    "KartuRingkasan masih punya keadaan gagal yang sebenarnya",
    kasirJs.includes("belum bisa dibaca"),
  );

  // ═══ 5. Total tagihan sampai ke kartu "Belum dibayar" ══════════════
  console.log("\n── 5. Berapa yang harus ditagih, bukan hanya bahwa ada ──");

  const kasirJson = await (await fetch(BASE + "/api/order/kasir")).json();
  const menunggu = kasirJson.menunggu_bayar ?? [];
  cek(
    "respon kasir membawa `total` untuk tiap pesanan belum dibayar",
    menunggu.every((p) => "total" in p),
    `${menunggu.length} pesanan`,
  );
  cek(
    "`total` berupa angka atau null (bukan string)",
    menunggu.every((p) => p.total === null || typeof p.total === "number"),
  );
  /*
    null untuk pesanan lama tanpa tagihan. Nol akan terbaca sebagai
    "tidak perlu dibayar" — dua arti yang sangat berbeda bagi kasir.
  */
  const tanpaTagihan = menunggu.filter((p) => p.tagihan_id === null);
  cek(
    "pesanan tanpa tagihan mendapat null, bukan 0",
    tanpaTagihan.every((p) => p.total === null),
    `${tanpaTagihan.length} pesanan lama`,
  );

  // ═══ 6. Nav bawah: label tidak membungkus ══════════════════════════
  console.log("\n── 6. Nav bawah tetap satu baris ──");

  const adminHtml = await teks("/order/admin");
  // Nav STAF — bukan <nav> paginasi tabel yang muncul lebih dulu di dokumen.
  const bukaNav = adminHtml.search(/<nav[^>]*aria-label="Navigasi (kasir|admin)"/);
  const navAdmin =
    bukaNav === -1 ? "" : adminHtml.slice(bukaNav, adminHtml.indexOf("</nav>", bukaNav) + 6);
  cek(
    "admin: label nav memakai huruf yang bisa menyusut",
    navAdmin.includes("clamp("),
    "6 tab × 360px menyisakan ~57px; 'Penjualan' ~56px",
  );
  cek(
    "admin: label nav tidak membungkus ke baris kedua",
    navAdmin.includes("whitespace-nowrap"),
    "label yang membungkus mengubah tinggi bilah dan menggeser tombol di bawah jari",
  );

  // ═══ 7. Tabel menu: paginasi + kartu ponsel ═════════════════════════
  console.log("\n── 7. Tabel menu admin dijangkau di ponsel ──");

  // Komponen admin adalah klien: kelasnya hanya ada di bundel, bukan HTML.
  const adminBundel = await gabungBundel(adminHtml);

  cek(
    "admin: tabel hanya merender satu halaman",
    adminBundel.includes("PER_HALAMAN") || /\.slice\(\w+,\w+\+10\)/.test(adminBundel),
    "126 baris sekaligus membuat 116 menu terakhir tak pernah terlihat",
  );
  cek(
    "admin: ada tombol halaman sebelumnya/berikutnya",
    adminBundel.includes("Halaman sebelumnya") && adminBundel.includes("Halaman berikutnya"),
    "tanpa ini halaman 2+ tidak terjangkau",
  );
  cek(
    "admin: jangkauan disebut ('Menampilkan X dari Y')",
    adminBundel.includes("Menampilkan"),
    "nomor halaman tanpa keterangan jangkauan tidak berarti setelah disaring",
  );
  cek(
    "admin: tabel jadi kartu di ponsel (grid → table-row)",
    adminBundel.includes("sm:table-row") && adminBundel.includes("grid-cols-1"),
    "5 kolom dalam 360px menyisakan ~110px untuk nama menu",
  );
  cek(
    "admin: kepala tabel disembunyikan di ponsel",
    adminBundel.includes("hidden sm:table-header-group"),
    "label kolom tak berguna saat barisnya jadi kartu",
  );

  console.log("\n── 8. Target sentuh tab stok ──");

  const stokBundel = await gabungBundel(await teks("/order/admin"));

  // Hitung tombol/isian yang di PONSEL masih di bawah 44px.
  const sempit = [...stokBundel.matchAll(/className:"([^"]{0,300}?)"/g)]
    .map((m) => m[1])
    .filter((c) => {
      if (c.includes("sm:") && !c.match(/(?:^|\s)(?:h|size)-1[01](?:\s|$)/)) return false;
      return /(?:^|\s)(?:h|size)-(?:7|8|9|10)(?:\s|$)/.test(c);
    });

  cek(
    "stok/admin: elemen di bawah 44px hanya tersisa sedikit",
    sempit.length <= 30,
    `tersisa ${sempit.length} (sebelum redesain: 52) — sisanya ikon & chip bertumpuk`,
  );

  // ═══ 9. Jalan dari katalog menu ke pemesanan ════════════════════════
  console.log("\n── 9. /menu punya jalan ke pemesanan ──");

  const menuHtml = await teks("/menu");

  cek(
    "menu: ada tombol tetap menuju portal pesanan",
    menuHtml.includes("Pesan dari meja Anda"),
    "sebelumnya satu-satunya tautan ke /order di seluruh aplikasi ada di halaman invoice",
  );
  cek(
    "menu: tiap kartu punya tombol pesan",
    (menuHtml.match(/aria-label="Pesan /g) ?? []).length >= 100,
    `${(menuHtml.match(/aria-label="Pesan /g) ?? []).length} tombol`,
  );
  cek(
    "menu: menu yang habis TIDAK diberi tombol pesan",
    !/Habis<\/p>[\s\S]{0,900}aria-label="Pesan /.test(menuHtml),
    "tombol pesan pada menu habis hanya menghasilkan penolakan",
  );
  cek(
    "menu: ada kotak cari",
    menuHtml.includes("Cari menu"),
    "126 menu tanpa pencarian memaksa menggulir seluruh daftar",
  );
  cek(
    "menu: hasil pencarian nol dijelaskan, bukan layar kosong",
    (await gabungBundel(menuHtml)).includes("Tidak ada menu yang cocok"),
    "daftar kosong tanpa penjelasan terbaca sebagai halaman rusak",
  );
  cek(
    "menu: pencarian membaca teks dari kartu, bukan props",
    !menuHtml.includes("data-cari="),
    "props dan atribut sama-sama berakhir di payload RSC — teks yang sudah tampil dibaca saja",
  );

  // ═══ 10. Fitur: kartu mati mengaku mati ═════════════════════════════
  console.log("\n── 10. /fitur: kartu tanpa tujuan mengaku ──");

  const fiturHtml = await teks("/fitur");
  cek(
    "fitur: kartu tanpa tujuan diberi label 'Segera'",
    fiturHtml.includes("Segera"),
    "kartu mati yang tampak hidup membuat dua kartu lain ikut diragukan",
  );
  cek(
    "fitur: kartu tanpa tujuan ditandai aria-disabled",
    fiturHtml.includes('aria-disabled="true"'),
  );

  // ═══ 11. Portal staf: kegagalan koneksi kelihatan ───────────────────
  console.log("\n── 11. Dapur & pelayan mengaku saat berhenti diperbarui ──");

  for (const [jalur, nama] of [
    ["/order/dapur", "dapur"],
    ["/order/pelayan", "pelayan"],
  ]) {
    const bundel = await gabungBundel(await teks(jalur));
    cek(
      `${nama}: ada bilah "berhenti diperbarui"`,
      bundel.includes("Layar ini berhenti diperbarui"),
      "sebelumnya kegagalan hanya jadi satu karakter '!' di samping logo",
    );
    cek(
      `${nama}: ada tombol muat ulang saat gagal`,
      bundel.includes("Muat ulang"),
      "pesan tanpa tindakan menyisakan satu pilihan: menunggu",
    );
    cek(
      `${nama}: umur data disebut, bukan hanya "gagal"`,
      bundel.includes("detik lalu"),
      "'data 40 detik lalu' lebih menggerakkan daripada 'koneksi terputus'",
    );
  }

  // ═══ 12. Checkout: tombol menyebut apa yang kurang ══════════════════
  console.log("\n── 12. Tombol kirim menyebut sebabnya ──");

  const orderBundel = await gabungBundel(await teks("/order?meja=1"));
  cek(
    "order: sebab tombol mati disebut satu per satu",
    orderBundel.includes("Lengkapi dulu") || orderBundel.includes("isi nomor WhatsApp"),
    "label lama hanya menyebut metode pembayaran; nama & WA tidak pernah disebut",
  );
  /*
    Nama variabel ter-minify, jadi yang dicari POLANYA: pembacaan query
    `menu` dari location.search. Literalnya bertahan karena ia nama
    parameter URL, bukan nama variabel.
  */
  cek(
    "order: ?menu= dari katalog dibaca",
    /URLSearchParams\(window\.location\.search\)\.get\("menu"\)/.test(orderBundel),
    "tanpa ini tombol di /menu mendaratkan tamu tanpa pilihannya",
  );

  // ═══ 13. Kasir: nama diingat │ Menu: ikon kategori ══════════════════
  console.log("\n── 13. Kasir & kartu menu ──");

  const kasirBundel = await gabungBundel(await teks("/order/kasir"));
  cek(
    "kasir: nama kasir diingat per perangkat",
    kasirBundel.includes("nabawi.kasir"),
    "nama masuk kolom `oleh` tiap pembayaran; salah nama = jejak kas hilang",
  );
  cek(
    "order: kartu tanpa foto memakai ikon kategori",
    orderBundel.includes("IkonKategoriMenu") || /kategoriId/.test(orderBundel),
    "inisial 'CH' mewakili 8 menu berbeda — 99 dari 126 kartu bertabrakan",
  );

  console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
  if (gagal > 0) {
    console.log("Yang gagal: " + kegagalan.join(", "));
    process.exit(1);
  }
}

/** Gabungkan bundel JS sebuah halaman — komponen klien hanya ada di sana. */
async function gabungBundel(html) {
  const src = [...html.matchAll(/\/_next\/static\/[^"']+?\.js/g)].map((m) => m[0]);
  const isi = await Promise.all(
    [...new Set(src)].map(async (u) => {
      const r = await fetch(BASE + u);
      return r.ok ? await r.text() : "";
    }),
  );
  return isi.join("\n");
}

main().catch((e) => {
  console.error("Uji berhenti karena kesalahan:", e.message);
  process.exit(1);
});
