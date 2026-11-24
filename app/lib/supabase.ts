/**
 * Klien Supabase minimal — tanpa dependency tambahan.
 *
 * Kenapa tidak memakai `@supabase/supabase-js`? Halaman ini Server Component
 * yang hanya butuh satu operasi SELECT. Menambah SDK (~50 kB) untuk satu
 * request tidak sepadan, dan proyek ini sejak awal dijaga tanpa dependency
 * runtime tambahan.
 *
 * Kunci yang dipakai adalah PUBLISHABLE key, yang memang dirancang untuk
 * dikirim ke browser. Tabelnya dilindungi RLS: anon hanya boleh SELECT
 * baris dengan is_published = true, tanpa akses tulis sama sekali.
 *
 * ── KENAPA TIDAK ADA NILAI CADANGAN DI SINI ──────────────────────────
 *
 * Dulu ada:
 *
 *     const URL_PROYEK = process.env.SUPABASE_URL ?? "https://....supabase.co";
 *     const KUNCI_PUBLIK = process.env.SUPABASE_ANON_KEY ?? "sb_publishable_...";
 *
 * Kunci publik itu memang tidak berbahaya, jadi alasan menghapusnya BUKAN
 * keamanan. Alasannya: selama nilai itu ada, "environment sudah diisi" dan
 * "environment kosong" menghasilkan aplikasi yang sama persis. Dashboard
 * Cloudflare tidak bisa lagi dipercaya sebagai sumber kebenaran, dan uji
 * "apakah env terpasang?" menjadi mustahil dijawab dari luar.
 *
 * Itu bukan dugaan — pernah terjadi di repo ini: halaman tampil normal
 * dengan data database sungguhan sementara env di dashboard kosong, dan
 * baru ketahuan setelah membandingkan rentang id. Env yang salah ketik juga
 * akan diam-diam menunjuk proyek Supabase yang lama.
 *
 * Sejak sekarang: env kosong = aplikasi BERHENTI dengan pesan jelas
 * (`envKurangDari`), bukan diam-diam tersambung ke tempat lain.
 */

/**
 * Dibaca saat dipanggil, bukan saat modul dimuat.
 *
 * Alasannya bukan gaya: `next build` mengevaluasi modul ini untuk
 * mengumpulkan metadata halaman. Kalau dibaca di tingkat modul dan env
 * sedang kosong, build gagal total — padahal kegagalan itu seharusnya
 * muncul sebagai pesan di halaman, bukan sebagai build merah yang tidak
 * menjelaskan apa pun.
 */
function bacaEnv(): { url: string; kunci: string } {
  return {
    url: (process.env.SUPABASE_URL ?? "").trim(),
    kunci: (process.env.SUPABASE_ANON_KEY ?? "").trim(),
  };
}

export const PESAN_ENV_SUPABASE =
  "SUPABASE_URL dan SUPABASE_ANON_KEY belum diisi di environment.";

/** true bila kedua env ada. Dipakai halaman untuk memilih tampilan. */
export function envSupabaseSiap(): boolean {
  const { url, kunci } = bacaEnv();
  return url.length > 0 && kunci.length > 0;
}

/**
 * Ambil baris dari tabel lewat REST Supabase.
 *
 * `revalidate` 300 detik: isi katalog jarang berubah, tapi kalau pemilik
 * menambah tempat baru di Supabase, halaman ikut segar tanpa perlu deploy.
 * Kalau jaringan gagal, pemanggil yang memutuskan fallback-nya — fungsi ini
 * tidak menelan error supaya kegagalan tidak tersamar jadi "data kosong".
 */
export async function supabaseSelect<T>(
  tabel: string,
  query: string,
): Promise<T[]> {
  const { url, kunci } = bacaEnv();

  // Gagal CEPAT dan JELAS. Tanpa ini, `${undefined}/rest/v1/...` akan
  // menghasilkan galat jaringan yang menyesatkan ("fetch failed"),
  // seolah Supabase yang bermasalah padahal env yang kosong.
  if (!url || !kunci) {
    throw new Error(`${PESAN_ENV_SUPABASE} Tabel ${tabel} tidak dibaca.`);
  }
  const res = await fetch(`${url}/rest/v1/${tabel}?${query}`, {
    headers: {
      apikey: kunci,
      Authorization: `Bearer ${kunci}`,
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(
      `Supabase ${tabel} gagal: ${res.status} ${res.statusText}`,
    );
  }

  return (await res.json()) as T[];
}
