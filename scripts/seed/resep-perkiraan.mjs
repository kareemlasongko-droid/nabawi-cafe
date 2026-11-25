/**
 * Isi bahan + resep PERKIRAAN untuk seluruh menu.
 *
 * ── INI BUKAN RESEP DAPUR ────────────────────────────────────────────
 *
 * Setiap baris yang ditulis di sini diberi `perkiraan = true`. Angkanya
 * disusun dari takaran warung nasi/kafe Indonesia yang umum, bukan dari
 * dapur Nabawi. Layar admin menandainya sebagai "perkiraan" dan HPP dari
 * resep ini tidak boleh dipakai menaikkan harga sebelum dicocokkan.
 *
 * Kenapa tetap diisi: HPP kosong untuk 126 menu membuat fitur ini tidak
 * bisa dipakai sama sekali. Angka perkiraan yang DITANDAI jauh lebih
 * berguna daripada layar kosong — asalkan tanda itu tidak hilang.
 *
 * ── CARA MEMBACANYA ──────────────────────────────────────────────────
 *
 * Resep di bawah dibangun dari dua lapis:
 *   1. PROFIL hidangan — "ini hidangan APA" (pasta? nasi? kopi susu?),
 *      dipilih berurutan, yang pertama cocok dipakai;
 *   2. KATA_KUNCI — tambahan dari nama menu (gurame, udang, wagyu, matcha…).
 *
 * Kategori TIDAK dipakai sebagai dasar. Percobaan pertama memakai kategori
 * dan hasilnya salah: "Spaghetti Carbonara" dapat 150 g BERAS karena
 * kategorinya "Makanan Utama", "Mineral Bottle" dapat GULA karena
 * kategorinya "Jus & Dessert", dan "Mix Platter" dapat HPP susu karena
 * mengandung "pLATTE".
 *
 * Jalankan: node scripts/seed/resep-perkiraan.mjs
 * Butuh SUPABASE_URL + SUPABASE_SERVICE_KEY (tulis ke .env lokal dulu).
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_KEY kosong. Isi .env dulu.");
  process.exit(1);
}

const rest = async (tabel, { method = "GET", q = "", body } = {}) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabel}${q ? `?${q}` : ""}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const teks = await r.text();
  if (!r.ok) throw new Error(`${tabel}: ${r.status} ${teks.slice(0, 300)}`);
  return teks ? JSON.parse(teks) : null;
};

// ── Daftar bahan ─────────────────────────────────────────────────────
//
// `harga` adalah harga PER SATUAN DASAR (per gram / ml / pcs), bukan per
// kilo. Dibulatkan ke bawah dari harga pasar Jakarta 2026 supaya angka
// HPP tidak terlalu optimistis.
const BAHAN = [
  ["Beras", "gram", 14, 20000],
  ["Beras Ketan", "gram", 18, 2000],
  ["Ayam Fillet", "gram", 42, 5000],
  ["Ayam Potong", "gram", 38, 5000],
  ["Daging Sapi", "gram", 135, 3000],
  ["Iga Sapi", "gram", 145, 2000],
  ["Wagyu Meltique", "gram", 210, 1000],
  ["Udang", "gram", 95, 1500],
  ["Gurame", "gram", 55, 1000],
  ["Ikan Tuna", "gram", 90, 500],
  ["Telur", "pcs", 2400, 60],
  ["Tahu", "gram", 12, 2000],
  ["Tempe", "gram", 15, 2000],
  ["Mie Spaghetti", "gram", 22, 3000],
  ["Bihun", "gram", 20, 1000],
  ["Tepung Terigu", "gram", 12, 5000],
  ["Tepung Bumbu", "gram", 18, 2000],
  ["Tepung Roti", "gram", 20, 2000],
  ["Minyak Goreng", "ml", 18, 10000],
  ["Margarin", "gram", 32, 2000],
  ["Mentega", "gram", 95, 1000],
  ["Bawang Merah", "gram", 38, 3000],
  ["Bawang Putih", "gram", 42, 2000],
  ["Bawang Bombay", "gram", 30, 2000],
  ["Cabai Merah", "gram", 55, 2000],
  ["Cabai Rawit", "gram", 65, 1000],
  ["Saus Tomat", "ml", 25, 2000],
  ["Saus Sambal", "ml", 25, 2000],
  ["Kecap Manis", "ml", 22, 2000],
  ["Saus Tiram", "ml", 35, 1000],
  ["Saus Teriyaki", "ml", 45, 1000],
  ["Santan", "ml", 28, 3000],
  ["Gula Pasir", "gram", 16, 5000],
  ["Garam", "gram", 5, 2000],
  ["Kaldu Bubuk", "gram", 60, 500],
  ["Daun Bawang", "gram", 25, 1000],
  ["Tomat", "gram", 18, 2000],
  ["Timun", "gram", 12, 1500],
  ["Kangkung", "gram", 14, 2000],
  ["Kentang", "gram", 18, 4000],
  ["Wortel", "gram", 14, 1500],
  ["Kacang Panjang", "gram", 20, 1000],
  ["Kol", "gram", 10, 2000],
  ["Selada", "gram", 28, 1000],
  ["Keju Cheddar", "gram", 95, 2000],
  ["Keju Mozarella", "gram", 120, 1500],
  ["Keju Cream", "gram", 85, 1000],
  ["Susu UHT", "ml", 18, 8000],
  ["Susu Kental Manis", "ml", 28, 3000],
  ["Krim Kental", "ml", 60, 2000],
  ["Bubuk Kopi", "gram", 240, 2000],
  ["Espresso Shot", "ml", 90, 1000],
  ["Bubuk Matcha", "gram", 320, 500],
  ["Bubuk Taro", "gram", 210, 500],
  ["Bubuk Red Velvet", "gram", 190, 500],
  ["Bubuk Coklat", "gram", 105, 2000],
  ["Sirup Karamel", "ml", 65, 1000],
  ["Sirup Vanila", "ml", 55, 1000],
  ["Sirup Hazelnut", "ml", 65, 1000],
  ["Sirup Lychee", "ml", 45, 1500],
  ["Sirup Stroberi", "ml", 45, 1500 ],
  ["Sirup Leci", "ml", 45, 1000],
  ["Teh Celup", "pcs", 450, 300],
  ["Teh Bubuk", "gram", 85, 500],
  ["Jahe", "gram", 30, 500],
  ["Jeruk Lemon", "pcs", 3200, 60],
  ["Alpukat", "gram", 42, 1000],
  ["Pisang", "gram", 16, 2000],
  ["Stroberi", "gram", 95, 1000],
  ["Mangga", "gram", 30, 1500],
  ["Sirsak", "gram", 28, 1000],
  ["Buah Naga", "gram", 32, 1000],
  ["Jeruk", "gram", 22, 1500],
  ["Singkong", "gram", 12, 2000],
  ["Cireng", "pcs", 900, 200],
  ["Tepung Bumbu Instan", "gram", 22, 1000 ],
  ["Es Batu", "gram", 1, 2000],
  ["Air Mineral", "ml", 0.6, 0 ],
  ["Sosis", "gram", 75, 1000],
  ["Onion Ring", "gram", 48, 1000],
  ["Roti Burger", "pcs", 4200, 100],
  ["Roti Croissant", "pcs", 6800, 60],
  ["Cinnamon Roll", "pcs", 6500, 60],
  ["Croffle", "pcs", 4200, 80],
  ["Cookies", "pcs", 5200, 50],
  ["Brownies", "pcs", 5800, 40],
  ["Es Krim", "gram", 42, 2000],
  ["Kacang Tanah", "gram", 32, 1000],
  ["Kerupuk", "gram", 22, 1000],
  ["Bumbu Balado", "gram", 55, 500],
  ["Bumbu Kacang", "gram", 45, 1000],
  ["Daun Jeruk", "gram", 35, 300],
  ["Serai", "gram", 18, 300],
  ["Lengkuas", "gram", 20, 300],
  ["Kunyit", "gram", 22, 300],
  ["Mie Telur", "gram", 18, 1000],
  ["Bawang Goreng", "gram", 85, 500],
  ["Keripik Kentang", "gram", 55, 1000],
  ["Sirup Gula Aren", "ml", 40, 1000],
  ["Jagung", "gram", 12, 1000],
];

// Nama bahan → [satuan, harga, stok minimum]
const idBahan = new Map();

// ── Profil hidangan ──────────────────────────────────────────────────
//
// ── KENAPA BUKAN PER KATEGORI ───────────────────────────────────────
//
// Percobaan pertama memakai kategori sebagai dasar. Hasilnya salah dengan
// cara yang memalukan: "Spaghetti Carbonara" mendapat 150 g BERAS karena
// kategorinya "Makanan Utama", dan "Mineral Bottle" mendapat GULA karena
// kategorinya "Jus & Dessert". HPP-nya jadi karangan, bukan perkiraan.
//
// Profil di bawah menanyakan "ini hidangan APA", bukan "masuk kategori
// mana". Profil dipilih berurutan; yang pertama cocok dipakai, jadi
// urutannya penting: `/espresso/` harus diperiksa sebelum `/latte/`.
//
// [pola nama, pengali porsi]
const PORS1 = [
  [/\b2 pax/i, 2],
  [/\b4 pax/i, 4],
  [/\b2 orang/i, 2],
  [/\b4 orang/i, 4],
];

// [pola nama, label profil, bahan dasar]
const PROFIL = [
  // ── 1. HIDANGAN DULU ──────────────────────────────────────────────
  // Urutan ini bukan selera. "Pisang Goreng Keju / Coklat" pernah dibaca
  // sebagai minuman "coklat", dan "Mix Platter" sebagai "pLATTE" — HPP
  // keduanya jadi HPP susu. Makanan diperiksa lebih dulu, lalu penjaga di
  // resepMenu() menolak kalau ada makanan yang tetap lolos ke profil minuman.
  [/croissant|cinnamon roll|croffle|cookie|brownies/i, "pastry", [["Mentega", 15], ["Gula Pasir", 12]]],
  [/pisang goreng/i, "gorengan", [["Minyak Goreng", 50], ["Tepung Bumbu", 40], ["Pisang", 180], ["Garam", 2]]],
  [/french fries|onion ring|chicken bite|mix platter/i, "kentang", [["Minyak Goreng", 40], ["Garam", 2]]],
  [/cireng|bakwan|tahu isi|tempe mendoan|singkong/i,
    "gorengan", [["Minyak Goreng", 60], ["Tepung Bumbu", 40], ["Garam", 2]]],
  [/karedok|lotek|sayur asem|tumis|kangkung/i, "sayur",
    [["Bawang Merah", 20], ["Bawang Putih", 10], ["Cabai Merah", 15], ["Minyak Goreng", 20], ["Garam", 3]]],
  [/spaghetti|carbonara|aglio|bolognese/i, "pasta",
    [["Mie Spaghetti", 180], ["Bawang Putih", 15], ["Minyak Goreng", 20], ["Garam", 3]]],
  [/burger/i, "burger",
    [["Roti Burger", 1], ["Selada", 20], ["Tomat", 30], ["Keju Cheddar", 20], ["Kentang", 150], ["Minyak Goreng", 20]]],
  [/paket nasi liwet/i, "paket",
    [["Beras", 150], ["Ayam Potong", 150], ["Santan", 60], ["Serai", 10], ["Daun Jeruk", 5],
     ["Kangkung", 100], ["Kerupuk", 1], ["Bawang Goreng", 5], ["Garam", 3], ["Minyak Goreng", 15]]],
  [/sop|soto|liwet/i, "berkuah",
    [["Beras", 150], ["Bawang Merah", 20], ["Bawang Putih", 12], ["Santan", 60], ["Serai", 10],
     ["Daun Jeruk", 5], ["Garam", 3], ["Minyak Goreng", 15]]],
  [/nasi|rice bowl|kebuli/i, "nasi",
    [["Beras", 150], ["Bawang Merah", 15], ["Bawang Putih", 10], ["Cabai Merah", 10],
     ["Minyak Goreng", 20], ["Kecap Manis", 10], ["Garam", 3], ["Kaldu Bubuk", 3]]],
  // Lauk berat tanpa kata kunci lain: anggap lauk utama + nasi.
  [/ayam|gurame|udang|sapi|daging|iga|wagyu|steak|telor|jagung|jengkol|pete/i, "lauk",
    [["Beras", 150], ["Bawang Merah", 20], ["Bawang Putih", 12], ["Cabai Merah", 15],
     ["Minyak Goreng", 25], ["Garam", 3]]],
  [/sundae|banana split|scoop/i, "es", [["Es Krim", 120]]],

  // ── 2. MINUMAN ────────────────────────────────────────────────────
  // Kata pendek memakai \b. Tanpa itu "sTEAK" dan "pLATTE" ikut cocok.
  [/air mineral|mineral bottle/i, "air", [["Air Mineral", 600]]],
  [/espresso/i, "espresso", [["Espresso Shot", 30]]],
  [/americano|long black|manual brew|cold brew/i, "hitam", [["Bubuk Kopi", 18], ["Es Batu", 120]]],
  [/piccolo/i, "piccolo", [["Espresso Shot", 30], ["Susu UHT", 60]]],
  [/milkshake/i, "milkshake", [["Susu UHT", 180], ["Es Krim", 80], ["Es Batu", 60]]],
  [/matcha|taro|red velvet|chocolate|choco|coklat|mocca|mocha|jamaican|cheese|klepon/i, "bubuk-susu",
    [["Susu UHT", 150], ["Gula Pasir", 15], ["Es Batu", 120]]],
  [/\blatte\b|cappuccino|coffee|\bkopi\b|irish|tiramisu|banana|flavoured|tropical|avocado|martini|happy|mojito|pororo|hime|candy|paradise|breeze|verde/i, "susu",
    [["Susu UHT", 120], ["Espresso Shot", 30], ["Gula Pasir", 15], ["Es Batu", 120]]],
  [/\btea\b|\bteh\b|ginger|jahe/i, "teh", [["Teh Celup", 1], ["Gula Pasir", 15], ["Es Batu", 100]]],
  [/\bjuice\b|\bjus\b/i, "jus", [["Gula Pasir", 15], ["Es Batu", 100]]],
];

// ── Tambahan dari kata kunci ─────────────────────────────────────────
//
// Diperiksa berurutan; semua yang cocok ditambahkan. Urutan penting:
// "Gurame Bakar Kecap" cocok dengan `gurame` DAN `bakar`, dan itu memang
// yang diinginkan (ikan + kecap).
const KATA_KUNCI = [
  // ── protein: menambah berat, bukan menggantikan profilnya ──
  [/gurame/i, [["Gurame", 350]]],
  [/udang/i, [["Udang", 200], ["Tepung Bumbu", 40]]],
  [/wagyu/i, [["Wagyu Meltique", 220], ["Mentega", 15]]],
  [/\biga\b/i, [["Iga Sapi", 250]]],
  [/sapi|daging|mercon|teriyaki|bolognese/i, [["Daging Sapi", 130]]],
  [/ayam|chicken/i, [["Ayam Potong", 200]]],
  [/tuna|aglio/i, [["Ikan Tuna", 100]]],
  [/telor|\btelur\b|barendo/i, [["Telur", 1]]],
  [/\btahu\b/i, [["Tahu", 150]]],
  [/tempe|mendoan/i, [["Tempe", 180]]],
  [/sosis|mix platter/i, [["Sosis", 80]]],
  [/kentang|fries|steak/i, [["Kentang", 200]]],
  // ── perasa khas ──
  [/carbonara/i, [["Krim Kental", 60], ["Keju Cheddar", 20]]],
  [/bakar|kecap/i, [["Kecap Manis", 25]]],
  [/balado|mercon/i, [["Bumbu Balado", 25], ["Cabai Rawit", 15]]],
  [/matah/i, [["Cabai Rawit", 15], ["Bawang Merah", 20], ["Serai", 10]]],
  [/\brica\b|woku|bumbu/i, [["Cabai Merah", 20], ["Bawang Merah", 20]]],
  [/mentega/i, [["Mentega", 30]]],
  [/\bbawang putih\b/i, [["Bawang Putih", 20]]],
  [/teriyaki/i, [["Saus Teriyaki", 40]]],
  [/asam manis/i, [["Saus Tomat", 40], ["Bawang Bombay", 30]]],
  [/karedok|lotek/i, [["Kol", 100], ["Timun", 80], ["Kacang Tanah", 50]]],
  [/\bkeju|mozarella|cheese/i, [["Keju Cheddar", 25]]],
  [/\bmatcha\b/i, [["Bubuk Matcha", 12]]],
  [/\btaro\b/i, [["Bubuk Taro", 15]]],
  [/red velvet/i, [["Bubuk Red Velvet", 15]]],
  [/jamaican|mocca|mocha|tiramisu|chocolate|choco|coklat|oreo/i, [["Bubuk Coklat", 18]]],
  [/caramel|irish|banana/i, [["Sirup Karamel", 20]]],
  [/hazelnut/i, [["Sirup Hazelnut", 20]]],
  [/vanilla/i, [["Sirup Vanila", 20]]],
  [/mojito/i, [["Sirup Leci", 30], ["Jeruk Lemon", 1]]],
  [/lychee|leci/i, [["Sirup Lychee", 30]]],
  [/strawberry|stroberi/i, [["Sirup Stroberi", 30], ["Stroberi", 50]]],
  [/lemon/i, [["Jeruk Lemon", 1]]],
  [/ginger|jahe/i, [["Jahe", 20]]],
  [/alpukat|avocado/i, [["Alpukat", 180]]],
  [/mango/i, [["Mangga", 200]]],
  [/sirsak/i, [["Sirsak", 200]]],
  [/dragon fruit|\bnaga\b/i, [["Buah Naga", 200]]],
  [/orange|jeruk/i, [["Jeruk", 250]]],
  [/\btea\b|\bteh\b/i, [["Teh Celup", 1]]],
  [/\bes\b|sundae|split|scoop/i, [["Es Krim", 80]]],
  [/cireng/i, [["Cireng", 6]]],
  [/singkong/i, [["Singkong", 250]]],
  [/pisang/i, [["Pisang", 180]]],
  [/jagung/i, [["Jagung", 150]]],
  [/onion ring/i, [["Onion Ring", 120]]],
  [/croffle/i, [["Croffle", 1]]],
  [/cinnamon roll/i, [["Cinnamon Roll", 1]]],
  [/croissant/i, [["Roti Croissant", 1]]],
  [/cookie/i, [["Cookies", 1]]],
  [/brownies/i, [["Brownies", 1]]],
  [/kangkung/i, [["Kangkung", 200], ["Saus Tiram", 15]]],
  [/sayur asem/i, [["Kacang Panjang", 80], ["Wortel", 60], ["Tomat", 50]]],
  [/jengkol|pete/i, [["Cabai Merah", 30]]],
];

/** Susun resep satu menu dari kategori + kata kunci namanya. */
function resepMenu(menu) {
  const kumpul = new Map();
  const tambah = (nama, jumlah) => {
    // Nama bahan dari kata kunci harus ada di daftar; kalau tidak, lewati
    // dan laporkan — lebih baik resep kurang satu bahan daripada gagal.
    if (!idBahan.has(nama)) {
      tidakDikenal.add(nama);
      return;
    }
    kumpul.set(nama, (kumpul.get(nama) ?? 0) + jumlah);
  };

  // Satu porsi adalah satuan dasar; menu paket/kastrol mengalikan porsinya.
  const porsi = (PORS1.find(([pola]) => pola.test(menu.nama)) ?? [null, 1])[1];

  const profil = PROFIL.find(([pola]) => pola.test(menu.nama));
  for (const [b, j] of profil ? profil[2] : [["Garam", 2]]) tambah(b, j);
  for (const [pola, daftar] of KATA_KUNCI) {
    if (pola.test(menu.nama)) for (const [b, j] of daftar) tambah(b, j);
  }

  /*
    Menu tanpa satu pun protein/gizi utama akan punya HPP yang tidak
    masuk akal (mis. "Black Tea" hanya 450 rupiah). Itu memang benar
    untuk teh, jadi tidak dipaksa. Tetapi kalau hasilnya 0 sama sekali,
    menu itu tidak akan pernah terpotong stoknya — dan itu bug diam-diam.
  */
  if (kumpul.size === 0) tambah("Garam", 1);

  /*
    Penjaga terhadap jebakan substring. "Mix Platter" pernah terbaca
    sebagai minuman karena mengandung "pLATTE", dan "Crispy Chicken
    Steak" pernah dapat TEH karena mengandung "sTEAK". Kalau profil
    minuman muncul di menu makanan, resepnya salah sejak awal — lebih
    baik gagal berisik sekarang daripada HPP karangan di laporan.
  */
  const MINUMAN = new Set(["susu", "bubuk-susu", "teh", "jus", "milkshake", "hitam", "piccolo", "espresso", "air"]);
  if (menu.kategori !== "Kopi" && menu.kategori !== "Non-Kopi" && menu.kategori !== "Cheese & Milkshake" && menu.kategori !== "Jus & Dessert") {
    if (profil && MINUMAN.has(profil[1])) {
      throw new Error(`Profil minuman "${profil[1]}" terpakai untuk menu makanan "${menu.nama}" — pola terlalu longgar.`);
    }
  }

  return [...kumpul.entries()].map(([nama, jumlah]) => ({
    bahan: nama,
    jumlah: Math.round(jumlah * porsi * 100) / 100,
  }));
}

const tidakDikenal = new Set();

// ── Jalankan ─────────────────────────────────────────────────────────
console.log("Membaca menu…");
const menu = await rest("menu", { q: "select=id,nama,harga,kategori_id&order=nama.asc" });
const kategori = await rest("kategori_menu", { q: "select=id,nama" });
const namaKategori = new Map(kategori.map((k) => [k.id, k.nama]));

for (const m of menu) m.kategori = namaKategori.get(m.kategori_id) ?? "(tanpa kategori)";

const jenisKategori = [...new Set(menu.map((m) => m.kategori))];
console.log(`  ${menu.length} menu, ${jenisKategori.length} kategori: ${jenisKategori.join(", ")}`);

// 1. Bahan
console.log("Menulis bahan…");
const bahanAda = await rest("bahan", { q: "select=id,nama" });
for (const b of bahanAda) idBahan.set(b.nama, b.id);

let bahanBaru = 0;
for (const [nama, satuan, harga, minimum] of BAHAN) {
  if (idBahan.has(nama)) continue;
  const [row] = await rest("bahan", {
    method: "POST",
    body: { nama, satuan, harga_satuan: harga, stok_minimum: minimum, catatan: "Seeded" },
  });
  idBahan.set(nama, row.id);
  bahanBaru += 1;
}
console.log(`  ${bahanBaru} bahan baru, ${idBahan.size} total`);

// 2. Resep
console.log("Menulis resep…");
const resepAda = await rest("resep_menu", { q: "select=menu_id" });
const sudah = new Set(resepAda.map((r) => r.menu_id));

let ditulis = 0;
let dilewati = 0;
let totalHpp = 0;
const perKategori = {};

for (const m of menu) {
  if (sudah.has(m.id)) {
    /*
      Menu yang sudah punya resep tetap ditulis ulang. Skrip ini sumber
      kebenaran untuk resep PERKIRAAN; kalau ia melewati menu yang ada,
      memperbaiki rumus lalu menjalankan ulang tidak mengubah apa pun —
      jebakan yang sudah sekali menggigit di sesi ini.
    */
    dilewati += 1;
  }
  const resep = resepMenu(m);
  const baris = resep.map((r) => ({
    menu_id: m.id,
    bahan_id: idBahan.get(r.bahan),
    jumlah: r.jumlah,
    // SELALU perkiraan. Ini angka sistem, bukan takaran dapur.
    perkiraan: true,
  }));
  await rest("resep_menu", {
    method: "POST",
    q: "on_conflict=menu_id,bahan_id",
    body: baris,
  });
  ditulis += baris.length;

  const hpp = resep.reduce((n, r) => {
    const b = BAHAN.find((x) => x[0] === r.bahan);
    return n + Math.round(r.jumlah * (b ? b[2] : 0));
  }, 0);
  totalHpp += hpp;
  const profilMenu = (PROFIL.find(([pola]) => pola.test(m.nama)) ?? ["", "lain"])[1];
  perKategori[profilMenu] = perKategori[profilMenu] ?? { n: 0, hpp: 0, harga: 0 };
  perKategori[profilMenu].n += 1;
  perKategori[profilMenu].hpp += hpp;
  perKategori[profilMenu].harga += m.harga;
}

console.log(`  ${ditulis} baris resep ditulis; ${dilewati} menu sudah punya resep dan ditimpa (upsert)`);

if (tidakDikenal.size > 0) {
  console.log(`  PERINGATAN: bahan dari kata kunci tidak terdaftar: ${[...tidakDikenal].join(", ")}`);
}

// 3. Ringkasan — supaya angka HPP bisa langsung diperiksa kewajarannya.
console.log("\nRata-rata HPP per profil hidangan (PERKIRAAN, bukan takaran dapur):");
for (const [k, v] of Object.entries(perKategori)) {
  const rata = Math.round(v.hpp / v.n);
  const hargaRata = Math.round(v.harga / v.n);
  const margin = hargaRata > 0 ? Math.round(((hargaRata - rata) / hargaRata) * 1000) / 10 : null;
  console.log(
    `  ${k.padEnd(14)} ${String(v.n).padStart(3)} menu · HPP ±Rp${String(rata).padStart(6)} · harga ±Rp${String(hargaRata).padStart(6)} · margin ${margin}%`,
  );
}

const semuaMenu = menu.length;
console.log(`\n${semuaMenu} menu, total ${ditulis} baris resep perkiraan.`);
console.log("Semua baris ditandai `perkiraan = true` — cocokkan dengan dapur sebelum dipakai.");
