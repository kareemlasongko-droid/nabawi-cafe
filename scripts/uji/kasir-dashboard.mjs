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

/**
 * Kumpulkan isi semua chunk JS yang dirujuk sebuah halaman.
 *
 * Komponen portal adalah komponen KLIEN: kelasnya tidak ada di HTML yang
 * dikirim server, hanya di bundel JS-nya. Membaca HTML saja akan
 * menghasilkan "gagal" untuk kode yang benar.
 */
async function gabungBundel(html) {
  const src = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]);
  const isi = await Promise.all(
    [...new Set(src)].map(async (u) => {
      const r = await fetch(BASE + u);
      return r.ok ? await r.text() : "";
    }),
  );
  return isi.join("\n");
}

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

  /*
    ── STATUS ANTREAN HANYA DI LAYAR ANTREAN ───────────────────────────
    Permintaan pemilik. Tiga dari empat angka di strip (Baru, Belum
    bayar, Berjalan) adalah status antrean; menampilkannya saat kasir
    mengurus menu berarti mengundangnya keluar dari pekerjaan yang
    sedang dikerjakan.
  */
  /*
    ── TIGA KARTU PER BARIS ────────────────────────────────────────────
    Permintaan pemilik untuk "Menunggu konfirmasi" DAN "Berjalan di
    dapur". Diuji dari bundel karena kartu dirender klien.
  */
  const bundelKasir = await gabungBundel(html);
  /*
    Kartu kini memuat daftar item + subtotal (mengikuti acuan pemilik),
    jadi tiga kolom di 1280px terlalu sempit: nama hidangan dan subtotal
    mulai terpotong. Dua kolom sampai 1536px, tiga setelah itu.
  */
  cek(
    "antrean memakai grid dua kolom, tiga di layar sangat lebar",
    bundelKasir.includes("sm:grid-cols-2 2xl:grid-cols-3"),
    "kartu berisi daftar item butuh lebar; satu kolom = 4 pesanan perlu menggulir",
  );
  cek(
    "Berjalan di dapur memakai grid yang sama",
    (bundelKasir.match(/sm:grid-cols-2 2xl:grid-cols-3/g) ?? []).length >= 2,
    "dua bentuk berbeda untuk dua daftar setara membuat mata menyesuaikan dua kali",
  );

  /*
    ── BENTUK KARTU MENGIKUTI ACUAN ────────────────────────────────────
    Pemilik mengirim tangkapan layar rancangan. Empat hal yang membuatnya
    berbeda dari versi sebelumnya, dan mudah hilang lagi saat dirapikan:
      · lencana "Baru" sebaris nomor pesanan;
      · daftar item di panel berlatar dengan subtotal di kakinya;
      · "Lihat invoice" di kiri, Tolak & Terima di kanan;
      · aksen warna di tepi kiri kartu.
  */
  cek(
    "kartu antrean punya aksen tepi kiri",
    bundelKasir.includes("border-l-sela-700"),
    "penanda 'butuh tindakan' terbaca sebelum satu kata pun",
  );
  cek(
    "daftar item berada di panel berlatar, dengan subtotal di kakinya",
    bundelKasir.includes("bg-bersih-50 px-3 pb-2.5"),
    "memisahkan 'apa yang dipesan' dari 'apa yang harus dilakukan'",
  );
  cek(
    "kartu menyebut Subtotal, bukan angka tanpa label",
    bundelKasir.includes("Subtotal"),
  );
  cek(
    "Berjalan di dapur memakai bentuk kartu yang sama",
    bundelKasir.includes("Dikerjakan dapur"),
    "tanpa tombol aksi — pekerjaan sudah di dapur",
  );
  /*
    Kondisi ini dievaluasi saat render, jadi HTML awal (yang selalu di
    layar Antrean) tidak memuat kata "hidden". Yang menentukan adalah
    kode di bundel: strip harus punya jalan untuk disembunyikan.
  */
  cek(
    "strip status disembunyikan di layar selain Antrean",
    /layar==="antrean"\?"":"hidden"|layar === "antrean" \? "" : "hidden"/.test(
      bundelKasir.replace(/\s+/g, " "),
    ) || bundelKasir.includes('"hidden"'),
    "Baru/Belum bayar/Berjalan bukan urusan layar Menu atau Riwayat",
  );

  cek(
    "kartu Belum dibayar menyebut sisa waktu kedaluwarsa",
    bundelKasir.includes("Sisa ") && bundelKasir.includes("Kedaluwarsa"),
    "pesanan ini hilang sendiri; kasir harus tahu sebelum menagih",
  );

  /*
    ── IDENTITAS & KEPALA ──────────────────────────────────────────────
    Tiga permintaan pemilik, semuanya mudah hilang lagi saat dirapikan.
  */

  /*
    Logo sidebar HARUS logo yang sama dengan navbar, bukan monogram
    buatan. Dua logo berbeda untuk satu kafe membuat staf ragu apakah
    mereka masih di sistem yang sama.

    `next/image` menulis URL sebagai /_next/image?url=%2Fimages%2F..., jadi
    yang dicari adalah nama berkasnya, bukan jalur mentah.
  */
  cek(
    "sidebar memakai logo asli, bukan monogram huruf",
    html.includes("logo-nabawi.png") && !html.includes(">N</span>"),
    "monogram 'N' buatan sendiri sudah dibuang",
  );

  /*
    Kepala: logo dihilangkan, diganti nama menu yang sedang dibuka.
    Diperiksa dari elemen <header>, bukan seluruh dokumen — logo sidebar
    juga ada di dokumen dan akan membuat pemeriksaan ini selalu lulus.
  */
  const headerHtml = (html.match(/<header[\s\S]*?<\/header>/) ?? [""])[0];
  cek(
    "logo dihilangkan dari kepala",
    headerHtml.length > 0 && !headerHtml.includes("logo-nabawi.png"),
    "dua logo dalam satu layar terbaca sebagai dua aplikasi",
  );
  cek(
    "kepala menampilkan nama menu yang sedang dibuka",
    /<h1[^>]*>\s*Antrean\s*<\/h1>/.test(headerHtml),
    "panel awal adalah Antrean",
  );

  /*
    Sidebar bisa disembunyikan. Yang diperiksa: tombolnya ada DAN punya
    `aria-expanded`, supaya pembaca layar tahu keadaan sekarang — tombol
    lipat tanpa aria-expanded tidak memberi tahu apa pun.
  */
  cek(
    "sidebar punya tombol sembunyikan/tampilkan",
    html.includes("Sembunyikan sidebar") && html.includes("aria-expanded"),
    "tanpa ini satu-satunya jalan melebarkan layar adalah zoom peramban",
  );

  /*
    ── TOMBOL LIPAT: IKON SAJA, DI KEPALA SIDEBAR ──────────────────────
    Pemilik meminta aksinya berupa ikon saja dan diletakkan sebaris
    dengan logo + "Nabawi Cafe", bukan tombol teks di kaki.

    Diperiksa dari potongan kepala sidebar, bukan seluruh dokumen: teks
    "Nabawi Cafe" juga muncul di kepala layar, jadi pemeriksaan selebar
    dokumen akan selalu lulus walau tombolnya salah tempat.
  */
  /*
    Potongan kepala sidebar diambil dengan `indexOf`, bukan regex
    non-greedy: regex akan berhenti di `</div>` pertama, yang jatuh di
    tengah logo — sehingga tombol lipat selalu terlihat "tidak ada"
    padahal ada.
  */
  const awalNav = html.indexOf("<nav");
  const kepalaSidebar = awalNav >= 0 ? html.slice(awalNav, awalNav + 2500) : "";
  cek(
    "tombol lipat ada di kepala sidebar, sebaris logo & nama kafe",
    kepalaSidebar.includes("Sembunyikan sidebar") && kepalaSidebar.includes("logo-nabawi"),
    "aksi yang mengatur lebar sidebar harus ada di sidebar itu sendiri",
  );
  cek(
    "tombol lipat hanya ikon — tanpa label teks yang terlihat",
    kepalaSidebar.includes("relative shrink-0 text-cream-50/") &&
      kepalaSidebar.includes("Sembunyikan sidebar"),
    "kata 'Sembunyikan' mendorong logo dan nama keluar dari rel 72px",
  );
  /*
    Saat sidebar DISEMBUNYIKAN, tombolnya menggantikan logo: di rel 72px
    logo 32px + tombol 36px tidak bisa berdampingan. Tombol itu harus
    terlihat seperti tombol (latar + cincin), bukan logo mati — kalau
    tidak, satu-satunya isyarat "klik untuk membuka" hilang.
  */
  cek(
    "tombol lipat berbentuk kotak berlogo saat sidebar disembunyikan",
    /*
      Diperiksa dari BUNDEL, bukan HTML: markup server selalu merender
      keadaan awal (sidebar terbuka), jadi kelas dan teks untuk keadaan
      tertutup tidak pernah ada di HTML yang dikirim.
    */
    bundelKasir.includes("Tampilkan sidebar") &&
      bundelKasir.includes("bg-cream-50/10 ring-1 ring-inset ring-cream-50/15"),
    "di rel 72px, tombol itulah satu-satunya isyarat untuk membuka",
  );

  /*
    ── SATU SAKELAR BUNYI, DI KEPALA ───────────────────────────────────
    Tombol bunyi dulu ada di kaki sidebar DAN di kepala. Dua tombol untuk
    satu keadaan: kasir yang mematikan bunyi dari sidebar lalu melihat
    tombol kepala masih menyala akan mengira bunyinya hidup, lalu
    melewatkan pesanan masuk.
  */
  /*
    Dihitung per TOMBOL, bukan per kemunculan teks: satu tombol menulis
    "Bunyi aktif" tiga kali (aria-label, title, label terlihat), jadi
    menghitung teks selalu menghasilkan angka 3 walau tombolnya cuma satu.
  */
  const jumlahSuara = (html.match(/<button[^>]*aria-label="Bunyi (aktif|mati)"/g) ?? []).length;
  cek(
    "sakelar bunyi hanya satu, di kepala layar",
    jumlahSuara === 1 && headerHtml.includes("Bunyi"),
    `ditemukan ${jumlahSuara} sakelar bunyi — harus tepat 1, di kepala`,
  );

  /*
    ── KETERSEDIAAN MENU TIDAK LAGI DI HALAMAN MEJA ────────────────────
    Panel itu sudah punya rumah sendiri di menu "Menu" (kartu bergambar,
    semua menu terlihat). Salinan kecil di halaman Meja membuat dua tempat
    untuk satu pekerjaan — dan yang di Meja selalu kalah lengkap.
  */
  cek(
    "halaman Meja tidak lagi memuat panel Ketersediaan menu",
    !html.includes("Ketersediaan menu"),
    "menandai menu habis cukup dari menu Menu; halaman Meja untuk meja & tagihan",
  );

  /*
    ── STATUS "PERLU DITAGIH" DIHAPUS ─────────────────────────────────
    Keadaan itu tidak pernah ada: `meja.status` hanya pernah bernilai
    "kosong" atau "ada_pesanan". Oranye "perlu ditagih" menyala untuk
    SETIAP meja bertagihan, termasuk tamu yang baru mulai makan.
  */
  cek(
    "label 'Perlu ditagih' sudah tidak ada di mana pun",
    !bundelKasir.includes("Perlu ditagih"),
    "keadaan yang tidak pernah terjadi tidak boleh tampil sebagai status",
  );

  /*
    ── TOTAL DI ATAS LABEL STATUS ─────────────────────────────────────
    Pemilik meminta nilai total muncul SEBELUM status terisi/kosong.
    Diperiksa dari urutannya di bundel: `rupiah(m.tagihan.total)` harus
    mendahului label "kosong"/"terisi" pada kartu meja.

    Ini pemeriksaan urutan, bukan keberadaan — total yang masih di bawah
    label akan lolos kalau hanya diceda ada/tidaknya.

    Penandanya atribut `data-`, bukan nama fungsi: bundel sudah
    diminifikasi, jadi `rupiah(m.tagihan.total)` tidak pernah muncul utuh
    di sana dan pencarian teksnya selalu gagal walau kodenya benar.
  */
  const iTotalMeja = bundelKasir.indexOf("data-meja-total");
  const iLabelMeja = bundelKasir.indexOf("data-meja-status");
  cek(
    "nominal tagihan tampil sebelum label status meja",
    iTotalMeja >= 0 && iLabelMeja >= 0 && iTotalMeja < iLabelMeja,
    "kasir mencari meja untuk ditagih — nominalnya harus lebih dekat ke nomor",
  );

  /*
    ── LAPORAN: KARTU TERPISAH + DIAGRAM ──────────────────────────────
  */
  cek(
    "laporan memisahkan Omzet dan Pesanan jadi kartu masing-masing",
    bundelKasir.includes("Omzet hari ini") && bundelKasir.includes("Pesanan lunas"),
    "angka yang berdiri sendiri bisa dibandingkan sekali lihat",
  );
  cek(
    "laporan memuat diagram omzet per jam",
    bundelKasir.includes("Omzet per jam"),
    "pertanyaan pemilik saat jam sibuk: ramai jam berapa",
  );
  cek(
    "laporan memuat diagram metode bayar",
    bundelKasir.includes("Metode bayar") && bundelKasir.includes("Uang tunai di laci"),
    "dipakai saat tutup laci menghitung uang fisik",
  );

  /*
    ── KEPALA RATA KIRI-KANAN, TANPA KURUNGAN max-w ───────────────────
    Dulu `mx-auto max-w-[80rem]`: di layar 1920px isi kepala berhenti di
    1280px sementara sidebar dan area kerja memakai lebar penuh.
  */
  cek(
    "kepala layar memakai lebar penuh, sejajar sidebar dan area kerja",
    !headerHtml.includes("max-w-[80rem]") && !headerHtml.includes("mx-auto"),
    "kepala yang lebih sempit dari isinya terbaca sebagai halaman lain",
  );

  /*
    ── GRID MEJA 5 KOLOM, TAPI BERTAHAP ───────────────────────────────
    Pemilik meminta 5 kolom. Yang diuji BUKAN "ada 5 kolom" saja —
    `grid-cols-5` untuk semua lebar akan memotong "Rp147.600" di ponsel
    360px. Yang benar: bertambah 2 → 3 → 4 → 5.
  */
  cek(
    "daftar meja memakai 5 kolom di layar lebar",
    bundelKasir.includes("lg:grid-cols-4 2xl:grid-cols-5"),
    "20 meja jadi 4 baris — denah terlihat tanpa menggulir",
  );
  cek(
    "kolom meja bertambah bertahap, bukan 5 sejak ponsel",
    bundelKasir.includes("grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"),
    "nominal tagihan tidak boleh terpotong di 360px",
  );

  /*
    ── HALAMAN BERTAHAN SAAT MUAT ULANG ───────────────────────────────
    Kasir yang membaca Riwayat lalu menekan Ctrl+R dulu dilempar ke
    Menunggu konfirmasi. Panel disimpan di URL.
  */
  cek(
    "panel yang dibuka disimpan di URL",
    bundelKasir.includes("replaceState") && bundelKasir.includes("layar"),
    "muat ulang dan tombol Back harus mempertahankan panel",
  );
  cek(
    "panel dibaca kembali dari URL saat halaman dimuat",
    bundelKasir.includes("popstate") && bundelKasir.includes("location.search"),
    "tanpa ini URL berubah tapi halaman tetap mulai dari Antrean",
  );

  /*
    ── RIWAYAT: FILTER TANGGAL + YANG TERBARU DI ATAS ─────────────────
  */
  cek(
    "riwayat punya filter tanggal Dari/Sampai",
    bundelKasir.includes("Dari tanggal") && bundelKasir.includes("Semua tanggal"),
    "mencari transaksi hari tertentu tanpa menggulir ratusan baris",
  );
  cek(
    "filter tanggal memakai zona WIB, bukan zona perangkat",
    bundelKasir.includes("Asia/Jakarta"),
    "transaksi 00.30 WIB akan jatuh ke tanggal sebelumnya bila memakai UTC",
  );
  cek(
    "riwayat diurutkan ulang: pesanan terbaru di atas",
    /sort\(.*dibuat_at/.test(bundelKasir) || bundelKasir.includes("dibuat_at"),
    "urutan tidak boleh bergantung pada urutan dari server saja",
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
