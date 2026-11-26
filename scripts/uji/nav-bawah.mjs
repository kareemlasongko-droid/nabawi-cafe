/**
 * Uji NAVIGASI portal staf — admin memakai nav bawah, kasir memakai sidebar.
 *
 * ── KASIR PINDAH KE SIDEBAR (2026-11-02) ───────────────────────────────
 *
 * Kasir dulu memakai nav bawah yang sama dengan admin. Ia diganti sidebar
 * karena nav bawah menyembunyikan empat tujuan di balik ikon kecil sambil
 * membuang 72px tinggi layar yang justru paling sempit di tablet — dan
 * karena kasir bekerja sambil berdiri: tujuan yang selalu terlihat di
 * samping lebih cepat dijangkau daripada bilah yang harus dicari di kaki
 * layar.
 *
 * Uji ini TIDAK dihapus, hanya dibelah: bagian admin tetap mengunci nav
 * bawah, bagian kasir mengunci sifat-sifat sidebar yang membuatnya layak
 * dipakai (menempel, tidak mencetak, tujuan lengkap, satu aktif, tidak
 * memicu gulir horizontal). Kalau sidebar diperbaiki dengan menghapus
 * salah satu sifat itu, uji ini gagal.
 *
 * ── MENGAPA UJI INI ADA ────────────────────────────────────────────────
 *
 * Navigasi kasir dan admin pernah dua kali pindah bentuk: tab di kepala,
 * lalu panel kiri (admin) / baris geser (ponsel), sekarang bilah bawah.
 * Setiap perpindahan punya cara gagal yang berbeda dan tidak satu pun
 * menghasilkan galat:
 *
 *   · nav ada tetapi TERTUTUP isi halaman (z-index / posisi salah);
 *   · nav ada tetapi isi halaman tertutup nav karena tidak ada padding
 *     bawah — kartu terakhir, biasanya tombol bayar, tidak bisa ditekan;
 *   · tab tidak menandai dirinya aktif, jadi staf tidak tahu di mana ia;
 *   · nav ikut tercetak di struk.
 *
 * Semuanya hanya terlihat kalau ada yang memeriksa HTML yang dikirim
 * server. Uji ini melakukan itu — murah, dan gagal dengan pesan yang
 * menunjuk langsung ke penyebabnya.
 *
 * Jalankan (server menyala):
 *   BASE=http://127.0.0.1:3000 node scripts/uji/nav-bawah.mjs
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

const HARAPAN = [
  {
    jalur: "/order/admin",
    label: "admin",
    tab: ["Penjualan", "Menu", "Biaya", "Meja", "Stok", "Jam"],
  },
];

/** Tujuan sidebar kasir, dalam urutan tampil. */
const TAB_KASIR = ["Antrean", "Meja", "Menu", "Laporan", "Riwayat"];

async function main() {
  console.log(`\n── Navigasi portal staf @ ${BASE} ──`);

  // ═══ KASIR: SIDEBAR ══════════════════════════════════════════════
  const kasirHtml = await (await fetch(BASE + "/order/kasir")).text();
  cek("kasir: halaman terbuka", kasirHtml.length > 0, `${kasirHtml.length} byte`);

  const bukaNav = kasirHtml.search(/<nav[^>]*aria-label="Navigasi Kasir"/i);
  const navKasir = bukaNav === -1 ? "" : kasirHtml.slice(bukaNav, kasirHtml.indexOf("</nav>", bukaNav) + 6);

  cek("kasir: sidebar berlabel untuk pembaca layar", /aria-label="Navigasi Kasir"/i.test(navKasir));

  /*
    Menempel di samping, bukan mengambang. `sticky top-0 h-dvh` membuat
    sidebar tetap terlihat saat isi digulir — kalau `h-dvh` hilang,
    sidebar setinggi isi (ribuan piksel) dan tombol di kakinya tidak
    pernah terjangkau.
  */
  cek(
    "kasir: sidebar menempel setinggi layar",
    navKasir.includes("sticky") && navKasir.includes("h-dvh"),
    "tanpa h-dvh, tombol di kaki sidebar tidak terjangkau",
  );

  /*
    Rail 72px di ponsel: cukup untuk ikon 24px + sasaran sentuh 44px,
    tidak memakan lebar isi. Angka ini yang diuji karena kalau melebar,
    360px menyisakan <290px untuk kartu antrean.
  */
  cek(
    "kasir: rail 72px di ponsel, melebar di tablet",
    navKasir.includes("w-[4.5rem]") && navKasir.includes("md:w-[14.5rem]"),
    "72px < 768px, 232px ≥ 768px",
  );

  cek("kasir: sidebar tidak ikut tercetak", navKasir.includes("print:hidden"));

  cek(
    "kasir: sidebar tidak memakai baris geser horizontal",
    !navKasir.includes("overflow-x-auto"),
    "tujuan harus terlihat semua tanpa digeser",
  );

  const hilangKasir = TAB_KASIR.filter((t) => !navKasir.includes(">" + t + "<"));
  cek(
    `kasir: ${TAB_KASIR.length} tujuan semuanya ada (${TAB_KASIR.join(", ")})`,
    hilangKasir.length === 0,
    hilangKasir.length ? `tidak ada: ${hilangKasir.join(", ")}` : "",
  );

  cek(
    "kasir: tepat satu tujuan ditandai aktif",
    (navKasir.match(/aria-current="page"/g) ?? []).length === 1,
  );

  /*
    Isi tidak boleh dipaksa selebar layar + lebar sidebar. `min-w-0` pada
    kolom isi adalah satu-satunya hal yang mencegah flex item melebar
    mengikuti grid kartu — penyebab gulir horizontal paling sering saat
    sidebar dipasang.
  */
  cek(
    "kasir: kolom isi memakai min-w-0",
    kasirHtml.includes("min-w-0 flex-1") || /min-w-0[^"]{0,40}flex-1/.test(kasirHtml),
    "tanpa ini grid kartu melebar melewati layar",
  );

  cek(
    "kasir: nav bawah lama sudah tidak dipakai",
    !kasirHtml.includes('aria-label="Navigasi kasir" data-nav') &&
      !/fixed[^"]{0,60}inset-x-0[^"]{0,40}bottom-0/.test(kasirHtml),
    "kasir memakai sidebar, bukan bilah bawah",
  );

  for (const { jalur, label, tab } of HARAPAN) {
    const html = await (await fetch(BASE + jalur)).text();

    cek(`${label}: halaman terbuka`, html.length > 0, `${html.length} byte`);

    // ── 1. Nav-nya ada, di bawah, dan tetap ──────────────────────────
    /*
      Cari nav STAF, bukan nav pertama di dokumen.

      Sejak tabel menu admin memakai <nav aria-label="Halaman menu"> untuk
      paginasi, `indexOf("<nav")` mengambil nav paginasi itu — dan ujinya
      menuduh navbar bawah kehilangan semua atributnya. Navbar staf
      dikenali dari aria-label-nya, bukan dari urutan di dokumen.
    */
    const buka = html.search(/<nav[^>]*aria-label="Navigasi (kasir|admin)"/);
    const nav =
      buka === -1
        ? ""
        : html.slice(buka, html.indexOf("</nav>", buka) + 6);
    cek(
      `${label}: nav berlabel untuk pembaca layar`,
      /aria-label="Navigasi (kasir|admin)"/.test(nav),
    );
    cek(
      `${label}: nav menempel di bawah layar`,
      nav.includes("fixed") && nav.includes("inset-x-0") && nav.includes("bottom-0"),
    );
    cek(
      `${label}: nav di atas isi tetapi di bawah dialog`,
      /\bz-30\b/.test(nav),
      "z-30 (dialog memakai z-40/z-50)",
    );
    cek(
      `${label}: nav tidak ikut tercetak`,
      nav.includes("print:hidden"),
      "struk & invoice dicetak dari halaman yang sama",
    );
    cek(
      `${label}: menghormati safe-area iPhone`,
      nav.includes("env(safe-area-inset-bottom)"),
    );

    // ── 2. SEMUA tujuan terlihat, tanpa digeser ──────────────────────
    /*
      Inti permintaan pemilik: "biar tampil semuanya". Baris tab yang
      digeser horizontal (`overflow-x-auto`) gagal tepat di sini — tabnya
      ada di HTML, tetapi sebagian tidak terlihat sampai digeser.
    */
    cek(
      `${label}: nav tidak memakai baris geser horizontal`,
      !nav.includes("overflow-x-auto"),
      "semua tab harus terlihat bersamaan",
    );
    const hilang = tab.filter((t) => !nav.includes(">" + t + "<"));
    cek(
      `${label}: ${tab.length} tab semuanya ada (${tab.join(", ")})`,
      hilang.length === 0,
      hilang.length ? `tidak ada: ${hilang.join(", ")}` : "",
    );

    // ── 3. Keadaan aktif ditandai, bukan hanya diwarnai ──────────────
    cek(`${label}: tepat satu tab ditandai aktif`, (nav.match(/aria-current="page"/g) ?? []).length === 1);

    // ── 4. Isi tidak tertutup nav ────────────────────────────────────
    /*
      Padding bawah harus minimal setinggi nav (~4.5rem) + safe area.
      Tanpa itu, elemen terakhir halaman berada di bawah bilah dan tidak
      bisa ditekan — termasuk tombol "Bayar" di kasir.
    */
    const paddingBawah = html.match(/pb-\[calc\(([\d.]+)rem\+env\(safe-area-inset-bottom\)\)\]/);
    cek(
      `${label}: isi diberi ruang untuk nav di bawah`,
      Boolean(paddingBawah) && Number(paddingBawah[1]) >= 4.5,
      paddingBawah ? `${paddingBawah[1]}rem` : "tidak ditemukan",
    );

    // ── 5. Bentuk lama tidak kembali ─────────────────────────────────
    cek(
      `${label}: panel tab kiri lama sudah tidak dipakai`,
      !html.includes("lg:w-[13.5rem]"),
      "navigasi pindah ke bawah, bukan panel samping",
    );
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
