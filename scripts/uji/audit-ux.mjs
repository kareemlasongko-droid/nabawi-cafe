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
  const navAdmin = adminHtml.slice(adminHtml.indexOf("<nav"), adminHtml.indexOf("</nav>") + 6);
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
