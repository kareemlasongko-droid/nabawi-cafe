/**
 * Uji: env kosong harus GAGAL JELAS.
 *
 * ── KENAPA UJI INI ADA ────────────────────────────────────────────────
 *
 * Dulu `app/lib/supabase.ts` dan `app/lib/order/db.ts` menyimpan alamat
 * database dan kunci publik sebagai nilai cadangan:
 *
 *     process.env.SUPABASE_URL ?? "https://xxxx.supabase.co"
 *
 * Akibatnya aplikasi tetap tersambung walau dashboard kosong. Selama
 * berbulan-bulan itu terasa "aman"; kenyataannya ia menyembunyikan
 * kesalahan konfigurasi. Di sesi ini hal itu benar-benar menimbulkan
 * diagnosis yang salah: halaman tampil normal dengan data sungguhan,
 * jadi disimpulkan "env sudah terpasang" — padahal env kosong dan yang
 * dipakai adalah cadangan di kode.
 *
 * Uji ini mengunci perilaku yang menggantikannya:
 *   · env kosong  -> gagal cepat, dengan pesan yang menyebut nama env
 *   · BUKAN       -> diam-diam tersambung ke proyek Supabase tertentu
 *   · BUKAN       -> "tidak bisa menghubungi database" (pesan itu
 *                    mengirim orang memeriksa koneksi, bukan env)
 *   · halaman     -> tetap tampil dengan penanda "data contoh",
 *                    bukan 500
 *
 * Jalankan: npm run uji:env
 */
process.env.SUPABASE_URL = "";
process.env.SUPABASE_ANON_KEY = "";
delete process.env.SUPABASE_SERVICE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const db = await import("../../app/lib/order/db.ts");
const venues = await import("../../app/lib/venues.ts");
const supabase = await import("../../app/lib/supabase.ts");

let lulus = 0;
let gagal = 0;
const cek = (nama, syarat, detail = "") => {
  if (syarat) {
    lulus++;
    console.log(`  LULUS  ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}${detail ? " — " + detail : ""}`);
  }
};

console.log("\n── Env kosong: deteksi ──");
cek("punyaEnvBaca() false", db.punyaEnvBaca() === false);
cek("punyaKunciServer() false", db.punyaKunciServer() === false);
cek("envSupabaseSiap() false", supabase.envSupabaseSiap() === false);

console.log("\n── Env kosong: db() menolak dengan pesan yang benar ──");
const r = await db.db("menu");
cek("ok:false", r.ok === false);
cek(
  "pesan menyebut SUPABASE_URL (bukan 'tidak bisa menghubungi database')",
  r.ok === false && r.pesan.includes("SUPABASE_URL"),
  r.ok ? "(ok:true — berbahaya, berarti cadangan masih ada)" : r.pesan,
);
cek(
  "pesan TIDAK menyalahkan jaringan",
  r.ok === false && !/tidak bisa menghubungi database/i.test(r.pesan),
);

console.log("\n── Env kosong: TOUR TIDAK LAGI MENAMPILKAN SALINAN LOKAL ──");
/*
  Perilaku ini SENGAJA diubah. Dulu `ambilVenues()` mengembalikan
  VENUES_LOKAL (10 tempat yang menempel di kode) sehingga halaman tour
  tampak normal walau database tidak pernah dibaca. Pemilik meminta data
  yang menempel di kode dihapus, jadi sekarang hasilnya kosong + pesan,
  dan halaman menampilkan "Tur belum bisa dimuat".
*/
const v = await venues.ambilVenues();
cek('sumber "gagal", bukan data palsu', v.sumber === "gagal", v.sumber);
cek("TIDAK ada venue karangan", v.venues.length === 0, String(v.venues.length));
cek("ada pesan untuk pengguna", v.pesan.length > 0, v.pesan);

console.log("\n── Env kosong: supabaseSelect melempar, tidak menembak URL kosong ──");
let pesanLembar = "";
try {
  await supabase.supabaseSelect("tour_venues", "select=slug");
} catch (e) {
  pesanLembar = e.message;
}
cek("melempar error", pesanLembar !== "");
cek("errornya menyebut env, bukan jaringan", pesanLembar.includes("SUPABASE_URL"), pesanLembar);

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal === 0 ? 0 : 1);
