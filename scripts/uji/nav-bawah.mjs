/**
 * Uji NAV BAWAH di portal staf (kasir & admin).
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
    jalur: "/order/kasir",
    label: "kasir",
    // Tujuan yang harus terlihat bersamaan — tanpa digeser.
    tab: ["Antrean", "Meja", "Laporan", "Riwayat"],
  },
  {
    jalur: "/order/admin",
    label: "admin",
    tab: ["Penjualan", "Menu", "Biaya", "Meja", "Stok", "Jam"],
  },
];

async function main() {
  console.log(`\n── Nav bawah portal staf @ ${BASE} ──`);

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
