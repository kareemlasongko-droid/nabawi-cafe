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
 */

const URL_PROYEK = process.env.SUPABASE_URL ?? "https://mvuqdakfzffhrnzxnmke.supabase.co";
const KUNCI_PUBLIK =
  process.env.SUPABASE_ANON_KEY ??
  "sb_publishable_gBDLdz_xr_2zGA85dWaAvg_8k0pXMVz";

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
  const res = await fetch(`${URL_PROYEK}/rest/v1/${tabel}?${query}`, {
    headers: {
      apikey: KUNCI_PUBLIK,
      Authorization: `Bearer ${KUNCI_PUBLIK}`,
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
