/**
 * Akses database untuk sistem order.
 *
 * KENAPA SERVER, BUKAN LANGSUNG DARI BROWSER
 * Pelanggan tidak punya akun. Kalau browser pelanggan diberi hak menulis
 * ke tabel pesanan secara langsung, siapa pun bisa mengubah status pesanan
 * orang lain atau mengubah harga. Karena itu semua penulisan lewat server
 * (route handler Next.js) yang memakai kunci server Supabase, dan browser
 * hanya berbicara dengan route kita.
 *
 * Kunci yang dipakai: SUPABASE_SERVICE_KEY bila tersedia. Kalau tidak ada,
 * sistem jatuh ke mode DEMO (lihat demo.ts) supaya halaman tetap bisa
 * dibuka tanpa database — penting untuk uji tampilan dan untuk kasus
 * database mati (PRD bagian 13: "bila sistem bermasalah, pelayan mencatat
 * di kertas").
 */

export const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://mvuqdakfzffhrnzxnmke.supabase.co";

/** Kunci publishable: hanya untuk membaca menu publik dari server. */
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "sb_publishable_gBDLdz_xr_2zGA85dWaAvg_8k0pXMVz";

/** Kunci server. Tidak pernah dikirim ke browser. */
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * true bila kunci server tersedia.
 *
 * Catatan penting: tanpa kunci server, kita TIDAK bisa menulis pesanan.
 * Mode demo dipakai supaya alur tetap bisa diperagakan, tetapi datanya
 * tidak bertahan dan TIDAK boleh dipakai di produksi. Halaman menampilkan
 * pemberitahuan jelas saat mode ini aktif, bukan diam-diam.
 */
export const PUNYA_KUNCI_SERVER = SERVICE_KEY.length > 0;

function authHeader(): string {
  const key = PUNYA_KUNCI_SERVER ? SERVICE_KEY : SUPABASE_ANON_KEY;
  return `Bearer ${key}`;
}

type Opsi = {
  /** Query string PostgREST, mis. "select=*&order=urutan.asc" */
  q?: string;
  /**
   * Header tambahan untuk PostgREST.
   *
   * Dipakai untuk `x-sesi-order`: policy RLS `pesanan_baca_sesi` mencocokkan
   * kolom sesi_id dengan header ini, sehingga satu perangkat hanya bisa
   * membaca pesanannya sendiri. Tanpa header ini, tamu tidak akan pernah
   * melihat status pesanannya saat mode sungguhan aktif — dan itu tidak
   * terlihat sama sekali di mode demo, karena demo memfilter di memori.
   */
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Prefer header, mis. "return=representation" atau "resolution=merge-duplicates" */
  prefer?: string;
};

export type HasilDb<T> =
  | { ok: true; data: T }
  | { ok: false; pesan: string };

/**
 * Panggil PostgREST. Semua pemanggil wajib memeriksa `ok` — jangan
 * menganggap data selalu ada. Kesalahan jaringan di area terbuka adalah
 * hal biasa (PRD bagian 4), jadi error harus jadi nilai, bukan exception.
 */
export async function db<T>(
  tabel: string,
  opsi: Opsi = {}
): Promise<HasilDb<T>> {
  const { q = "select=*", method = "GET", body, prefer, headers: tambahan } = opsi;
  const url = `${SUPABASE_URL}/rest/v1/${tabel}${q ? `?${q}` : ""}`;

  const headers: Record<string, string> = {
    apikey: PUNYA_KUNCI_SERVER ? SERVICE_KEY : SUPABASE_ANON_KEY,
    Authorization: authHeader(),
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  if (tambahan) Object.assign(headers, tambahan);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // Data pesanan tidak boleh di-cache: status harus segar.
      cache: "no-store",
    });

    if (!res.ok) {
      const teks = await res.text();
      let pesan = `Database menolak permintaan (${res.status})`;
      try {
        const j = JSON.parse(teks);
        if (j.message) pesan = j.message;
        else if (j.hint) pesan = j.hint;
      } catch {
        if (teks) pesan = teks.slice(0, 200);
      }
      return { ok: false, pesan };
    }

    if (method === "GET" || prefer?.includes("return=representation")) {
      const data = (await res.json()) as T;
      return { ok: true, data };
    }
    return { ok: true, data: undefined as T };
  } catch (e) {
    const pesan =
      e instanceof Error
        ? `Tidak bisa menghubungi database: ${e.message}`
        : "Tidak bisa menghubungi database";
    return { ok: false, pesan };
  }
}
