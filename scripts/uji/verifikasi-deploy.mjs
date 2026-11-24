/**
 * Verifikasi deployment Cloudflare untuk Nabawi Cafe.
 *
 * KENAPA ADA SKRIP INI
 * Setelah pindah runtime, "halaman terbuka" bukan bukti cukup. Tiga hal
 * yang biasa lolos dari pemeriksaan mata:
 *   1. Halaman tampil, tapi isinya salinan lokal (MENU_CONTOH) karena
 *      environment Supabase belum terpasang → menu basi, diam-diam.
 *   2. Gambar tampil, tapi tidak lewat optimasi → 723 KB per gambar.
 *   3. API menjawab 200, tapi dengan bentuk data yang salah.
 *
 * Skrip ini memeriksa ketiganya secara eksplisit dan memberi tahu mana
 * yang BELUM BISA dinilai, alih-alih menulis "lulus" untuk hal yang
 * tidak diperiksa.
 *
 * PAKAI
 *   npm run verifikasi -- https://nabawi-cafe.xxx.workers.dev
 *   npm run verifikasi -- http://localhost:8788          # wrangler dev
 *
 * Tanpa argumen, dipakai http://localhost:3000 (next start di lokal).
 */

const dasar = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

let lulus = 0;
let gagal = 0;
const belum = [];
const catatan = [];

function ok(nama, syarat, detail = "") {
  if (syarat) {
    lulus++;
    console.log(`  LULUS  ${nama}${detail ? " — " + detail : ""}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}${detail ? " — " + detail : ""}`);
  }
}

function belumBisa(nama, alasan) {
  belum.push(`${nama}: ${alasan}`);
  console.log(`  LEWAT  ${nama} — ${alasan}`);
}

/** Ambil sekali, kembalikan {status, teks, header, ms} atau null bila jaringan gagal. */
async function ambil(path, opsi = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(dasar + path, {
      redirect: "follow",
      signal: AbortSignal.timeout(opsi.timeout ?? 30000),
      headers: opsi.headers,
    });
    const teks = await res.text();
    return { status: res.status, teks, header: res.headers, ms: Date.now() - t0 };
  } catch (e) {
    console.log(`  GAGAL  jaringan: ${path} — ${e.message}`);
    gagal++;
    return null;
  }
}

console.log(`\n── Verifikasi ${dasar} ──`);

/* ── 1. Halaman utama ──────────────────────────────────────────────── */
console.log("\n== Halaman ==");

const HALAMAN = [
  ["/", "beranda"],
  ["/fitur", "fitur"],
  ["/menu", "menu"],
  ["/tour", "virtual tour"],
  ["/order?meja=1", "pesan dari meja"],
  ["/order/masuk", "masuk staf"],
  ["/order/admin", "portal admin"],
  ["/order/kasir", "portal kasir"],
  ["/order/dapur", "portal dapur"],
  ["/order/pelayan", "portal pelayan"],
];

const isiHalaman = new Map();
for (const [path, nama] of HALAMAN) {
  const r = await ambil(path);
  if (!r) continue;
  isiHalaman.set(path, r.teks);
  ok(`${nama} (${path})`, r.status === 200, `${r.status} · ${(r.teks.length / 1024).toFixed(0)} KB · ${r.ms} ms`);
}

/* ── 2. Isi /menu — pembeda paling jelas antara data asli dan salinan ─ */
console.log("\n== Isi /menu ==");
const menu = isiHalaman.get("/menu") ?? "";
if (!menu) {
  belumBisa("isi /menu", "halaman tidak terambil");
} else {
  const kartu = (menu.match(/<article/g) ?? []).length;
  const kategori = (menu.match(/<section/g) ?? []).length;
  const pil = (menu.match(/aria-pressed/g) ?? []).length;
  const ikon = (menu.match(/<svg/g) ?? []).length;

  ok("jumlah kartu 126", kartu === 126, String(kartu));
  ok("jumlah kategori 6", kategori === 6, String(kategori));
  ok("pil saringan 7", pil === 7, String(pil));
  ok("ikon per kategori terkirim", ikon >= 126, String(ikon));
  ok("aturan saring ikut terkirim", (menu.match(/body\[data-saring=/g) ?? []).length === 12);

  // Indikator data basi: kalau Supabase tidak terpasang, /menu memakai
  // MENU_CONTOH. Keduanya bertanda harga yang sama, jadi jumlah kartu
  // tidak bisa membedakan. Yang bisa: tabel `menu` live punya kolom
  // tersedia yang bisa berubah. Kita tidak memaksa, hanya mengingatkan.
  belumBisa(
    "menu dari database (bukan salinan lokal)",
    "butuh perbandingan dengan Supabase; periksa apakah harga sama dengan dashboard"
  );
}

/* ── 3. Optimasi gambar ───────────────────────────────────────────── */
console.log("\n== Optimasi gambar ==");
{
  const url = "/_next/image?url=%2Fimages%2Ffitur-bg.jpg&w=640&q=75";
  const r = await ambil(url, { headers: { Accept: "image/avif,image/webp,*/*" } });
  if (!r) {
    /* sudah dihitung gagal */
  } else if (r.status === 200) {
    const tipe = r.header.get("content-type") ?? "?";
    const kb = r.teks.length / 1024;
    ok("gambar lewat optimizer", true, `${tipe} · ${kb.toFixed(0)} KB`);
    // Asli 723 KB. Kalau balik > 400 KB, kemungkinan besar gambar asli
    // dikirim apa adanya (optimizer tidak aktif / binding IMAGES mati).
    ok("gambar benar-benar mengecil", kb < 400, `${kb.toFixed(0)} KB dari 723 KB`);
    ok("format modern", /avif|webp/i.test(tipe), tipe);
  } else {
    ok("gambar lewat optimizer", false, `status ${r.status}`);
    catatan.push(
      "Kalau status 404/500: binding IMAGES belum aktif. Untuk Worker, ini berarti deploy belum memakai wrangler.jsonc terbaru."
    );
  }
}

/* ── 4. API ───────────────────────────────────────────────────────── */
console.log("\n== API ==");
{
  const r = await ambil("/api/order/menu/tersedia");
  if (r) {
    let bentuk = null;
    try {
      bentuk = JSON.parse(r.teks);
    } catch {
      /* bukan JSON */
    }
    ok("GET menu/tersedia 200", r.status === 200, String(r.status));
    ok("bentuk {menu:[...]}", Array.isArray(bentuk?.menu), bentuk?.menu ? `${bentuk.menu.length} entri` : "bukan JSON");
    ok("entri punya id & tersedia", Boolean(bentuk?.menu?.[0]?.id) && typeof bentuk?.menu?.[0]?.tersedia === "boolean");
  }

  const p = await fetch(dasar + "/api/order/pesanan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meja: "1", sesi: "verifikasi", items: [] }),
    signal: AbortSignal.timeout(30000),
  }).then(async (res) => ({ status: res.status, teks: await res.text() })).catch(() => null);

  if (p) {
    // Keranjang kosong HARUS ditolak. Kalau diterima, ada masalah validasi.
    ok("POST pesanan kosong ditolak 400", p.status === 400, String(p.status));
    ok("penolakan punya pesan", /"pesan"/.test(p.teks), p.teks.slice(0, 60));
  }
}

/* ── 5. Aset statis ───────────────────────────────────────────────── */
console.log("\n== Aset statis ==");
{
  const m = isiHalaman.get("/menu") ?? "";
  const css = m.match(/\/_next\/static\/css\/[a-z0-9]+\.css/)?.[0];
  if (!css) {
    belumBisa("CSS terkirim", "tautan CSS tidak ditemukan di HTML");
  } else {
    const r = await ambil(css);
    if (r) {
      ok("CSS terkirim", r.status === 200, `${(r.teks.length / 1024).toFixed(0)} KB`);
      const cc = r.header.get("cache-control") ?? "";
      // public/_headers hanya berlaku di Cloudflare, bukan next start.
      if (/immutable/.test(cc)) catatan.push("Cache-Control immutable aktif — public/_headers bekerja.");
      else catatan.push(`Cache-Control CSS: "${cc || "(kosong)"}" — di next start ini normal; di Cloudflare seharusnya immutable.`);
    }
  }
}

/* ── Ringkasan ────────────────────────────────────────────────────── */
console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
if (belum.length) {
  console.log("\nBelum bisa dinilai dari sini:");
  for (const b of belum) console.log("  · " + b);
}
if (catatan.length) {
  console.log("\nCatatan:");
  for (const c of catatan) console.log("  · " + c);
}
if (gagal > 0) {
  console.log("\nAda yang gagal — periksa pesan di atas sebelum menyentuh domain.");
  process.exit(1);
}
