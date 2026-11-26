/**
 * Uji DASHBOARD KASIR — mengunci perbaikan audit 2026-11-02.
 *
 * ── MENGAPA UJI INI ADA ────────────────────────────────────────────────
 *
 * Audit kasir menemukan dua kerusakan yang tidak menghasilkan galat dan
 * tidak tertangkap uji mana pun:
 *
 *   K1  Pesanan bisa diterima DAPUR tanpa dibayar. `PATCH /status`
 *       memeriksa transisi status saja, tidak pernah memeriksa
 *       `status_bayar`. Akibatnya pesanan `menunggu_bayar` bisa masuk
 *       dapur, tidak pernah muncul di papan mana pun, dan makanannya
 *       dimasak tanpa ada yang menagih.
 *
 *   K2  Respons PATCH hanya mengembalikan `{id, status, created_at}`.
 *       Kasir yang baru menerima pesanan tidak tahu status bayarnya dari
 *       jawaban itu, lalu memperbarui seluruh layar — dan pesanan yang
 *       baru ia terima menghilang dari daftar selama satu putaran polling.
 *
 * Keduanya hanya terlihat kalau ada yang mencoba MEMBAYAR SALAH URUTAN.
 * Uji ini melakukan tepat itu, pada server yang menyala.
 *
 * Jalankan (server + tiruan PostgREST menyala):
 *   BASE=http://127.0.0.1:3000 node scripts/uji/kasir-dashboard.mjs
 *
 * ── SATU TIRUAN PER SATU PUTARAN ───────────────────────────────────────
 * Uji ini MEMBUAT pesanan. Menjalankannya dua kali pada tiruan yang sama
 * menumpuk data; mulai ulang tiruan sebelum putaran penuh.
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

const json = async (jalur, opsi) => {
  const r = await fetch(BASE + jalur, opsi);
  return { status: r.status, badan: await r.json().catch(() => null) };
};

/** Buat satu pesanan baru yang belum dibayar. */
async function pesananBaru(meja, sesi) {
  const { badan } = await json("/api/order/pesanan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      meja,
      sesi,
      nama: "Uji Dashboard",
      no_wa: "081234567890",
      items: [{ menu_id: 33, jumlah: 1 }],
    }),
  });
  return badan?.pesanan ?? null;
}

async function main() {
  console.log(`\n── Dashboard kasir @ ${BASE} ──`);

  // ═══ 1. K1 — tidak bisa ke dapur tanpa bayar ══════════════════════
  console.log("\n── 1. Uang dulu, baru dapur ──");

  const p = await pesananBaru("7", `uji-dash-${Date.now()}`);
  cek("pesanan uji berhasil dibuat", p !== null && typeof p.id === "number", p ? `#${p.id}` : "gagal dibuat");
  if (!p) {
    console.log("\nTidak bisa melanjutkan tanpa pesanan uji.");
    process.exit(1);
  }

  const terima = await json("/api/order/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: p.id, ke: "diterima", oleh: "uji" }),
  });
  cek(
    "menerima pesanan yang BELUM dibayar ditolak",
    terima.badan?.ok !== true,
    terima.badan?.pesan ?? `ok=${terima.badan?.ok}`,
  );
  cek(
    "pesan penolakan menyebut sebabnya (belum dibayar)",
    /belum dibayar/i.test(terima.badan?.pesan ?? ""),
    "kasir harus tahu APA yang kurang, bukan sekadar 'gagal'",
  );

  /*
    Pesanan yang ditolak tidak boleh berubah status di database. Kalau
    tidak diperiksa, kode yang menolak di lapisan HTTP tetapi sudah
    menulis lebih dulu akan lolos.
  */
  const kasir1 = await json("/api/order/kasir");
  const masih = (kasir1.badan?.menunggu_bayar ?? []).find((x) => x.id === p.id);
  cek(
    "status pesanan tidak berubah setelah ditolak",
    masih?.status === "menunggu_konfirmasi" && masih?.status_bayar === "menunggu",
    masih ? `${masih.status}/${masih.status_bayar}` : "tidak ditemukan",
  );

  // ═══ 2. Setelah dibayar, boleh ke dapur ═══════════════════════════
  console.log("\n── 2. Setelah lunas, alur berjalan ──");

  const bayar = await json("/api/order/bayar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tagihan_id: p.tagihan_id, metode: "tunai", diterima: 100000, kasir: "Uji" }),
  });
  cek("pembayaran tunai diterima", bayar.badan?.ok === true, bayar.badan?.pesan ?? "");

  const terima2 = await json("/api/order/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: p.id, ke: "diterima", oleh: "uji" }),
  });
  cek("pesanan lunas boleh diterima", terima2.badan?.ok === true, terima2.badan?.pesan ?? "");

  // ═══ 3. K2 — respons membawa status bayar & nomor ═════════════════
  console.log("\n── 3. Jawaban PATCH cukup untuk memperbarui layar ──");

  const isi = terima2.badan?.pesanan ?? terima2.badan ?? {};
  cek("respons PATCH membawa `status_bayar`", isi.status_bayar === "lunas", String(isi.status_bayar));
  cek("respons PATCH membawa `nomor`", typeof isi.nomor === "string" && isi.nomor.length > 0, isi.nomor ?? "");

  // ═══ 4. Pesanan yang ditolak hilang dari SEMUA papan ═════════════
  console.log("\n── 4. Ditolak berarti keluar dari daftar ──");

  const q = await pesananBaru("8", `uji-dash-tolak-${Date.now()}`);
  if (q) {
    await json("/api/order/status", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: q.id, ke: "ditolak", alasan: "Uji", oleh: "uji" }),
    });
    const kasir2 = await json("/api/order/kasir");
    const diAntrean = (kasir2.badan?.pesanan ?? []).some((x) => x.id === q.id);
    const diBelumBayar = (kasir2.badan?.menunggu_bayar ?? []).some((x) => x.id === q.id);
    cek("pesanan ditolak tidak di antrean", !diAntrean);
    cek(
      "pesanan ditolak tidak di 'Belum dibayar'",
      !diBelumBayar,
      "sebelumnya tetap muncul dengan total null",
    );
  }

  // ═══ 5. /api/order/kasir membawa kategori untuk kartu produk ═════
  console.log("\n── 5. Data untuk kartu produk ──");

  const kasir3 = await json("/api/order/kasir");
  cek(
    "respons kasir membawa daftar `kategori`",
    Array.isArray(kasir3.badan?.kategori) && kasir3.badan.kategori.length > 0,
    `${kasir3.badan?.kategori?.length ?? 0} kategori`,
  );

  // ═══ 6. Halaman kasir: sidebar + kartu produk ════════════════════
  console.log("\n── 6. Bentuk dashboard ──");

  const html = await (await fetch(BASE + "/order/kasir")).text();
  const nav = html.slice(
    html.search(/<nav[^>]*aria-label="Navigasi Kasir"/i),
    html.indexOf("</nav>", html.search(/<nav[^>]*aria-label="Navigasi Kasir"/i)),
  );
  /*
    ── SATU LAYAR, SATU PANEL ──────────────────────────────────────────
    Permintaan pemilik: "jangan ditumpuk jadi 1 halaman, buat sesuai
    fungsi pada umumnya". Dashboard POS normal menampilkan satu pekerjaan
    per layar; sidebar memindahkannya.

    Yang diperiksa: HTML awal hanya memuat panel Antrean, dan panel lain
    TIDAK ada di DOM (bukan sekadar disembunyikan dengan CSS). Kalau
    disembunyikan, tingginya tetap dihitung dan halaman bisa digulir ke
    ruang kosong.
  */
  const adaPanel = (id) => new RegExp(`id="${id}"`).test(html);

  cek("panel awal yang dirender adalah Antrean", adaPanel("antrean"));
  cek(
    "panel lain tidak ikut ditumpuk di halaman yang sama",
    !adaPanel("menu") && !adaPanel("riwayat"),
    "halaman sepanjang ribuan piksel menyulitkan pencarian pekerjaan",
  );
  cek(
    "sidebar menjadi pemilih layar (tombol, bukan tautan anchor)",
    nav.includes('type="button"') && !nav.includes('href="#antrean"'),
    "mengubah keadaan = tombol; tautan anchor hanya menggulir halaman",
  );
  cek(
    "sidebar menandai tepat satu tujuan aktif",
    (nav.match(/aria-current="page"/g) ?? []).length === 1,
  );
  cek(
    "strip status memindahkan layar, bukan menggulir",
    html.includes("Meja terisi") && !/href="#meja"/.test(html),
  );

  cek(
    "navigasi kasir tidak lagi memakai bilah bawah",
    !/fixed[^"]{0,80}bottom-0/.test(html),
    "sidebar menggantikan nav bawah",
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
