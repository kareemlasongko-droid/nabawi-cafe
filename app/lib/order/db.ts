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

const bersih = (v: string | undefined) => (v ?? "").trim();

/**
 * Dibaca lewat fungsi, bukan `export const`.
 *
 * Alasannya konkret, bukan gaya: `scripts/uji/jalur-pilihan.mjs` menyetel
 * `process.env.SUPABASE_URL` ke server PostgREST tiruan SETELAH modul ini
 * diimpor. Dengan `export const`, nilai itu terkurung pada "" selamanya
 * dan seluruh uji gagal — bukan karena kode salah, tapi karena urutan impor.
 */
export const ambilSupabaseUrl = () => bersih(process.env.SUPABASE_URL);
export const ambilAnonKey = () => bersih(process.env.SUPABASE_ANON_KEY);
/** Kunci server. Tidak pernah dikirim ke browser. */
export const ambilServiceKey = () =>
  bersih(process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * true bila kunci server tersedia.
 *
 * Catatan penting: tanpa kunci server, kita TIDAK bisa menulis pesanan.
 * Mode demo dipakai supaya alur tetap bisa diperagakan, tetapi datanya
 * tidak bertahan dan TIDAK boleh dipakai di produksi. Halaman menampilkan
 * pemberitahuan jelas saat mode ini aktif, bukan diam-diam.
 */
/**
 * true bila kunci server tersedia.
 *
 * FUNGSI, bukan `export const`. Alasannya urutan impor: berkas uji
 * `jalur-pilihan.mjs` menyetel `process.env.SUPABASE_URL` dan
 * `SUPABASE_SERVICE_KEY` SETELAH modul ini diimpor. Konstanta yang dihitung
 * saat impor akan membekukan nilai kosong dan menggagalkan seluruh uji —
 * bukan karena kode salah.
 *
 * Ini sengaja TIDAK dibuat objek dengan `valueOf`, yang sempat terlintas:
 * objek selalu truthy, jadi `if (!PUNYA_KUNCI_SERVER)` tidak akan pernah
 * bernilai benar dan mode demo diam-diam mati. Fungsi memaksa setiap
 * pemakaian ditulis `PUNYA_KUNCI_SERVER()` — tidak bisa salah tanpa
 * ketahuan.
 */
export const punyaKunciServer = () => ambilServiceKey().length > 0;

/**
 * true bila env baca (URL + kunci publik) tersedia.
 *
 * Dipisah dari `punyaKunciServer()` dengan sengaja: keduanya menjawab
 * pertanyaan berbeda, dan menggabungkannya pernah membuat diagnosis salah.
 *   · Tanpa env baca     -> tidak ada yang bisa dibaca sama sekali.
 *   · Hanya env baca     -> menu terbaca, pesanan DITOLAK (mode demo).
 *   · Env baca + server  -> semua jalan.
 *
 * Kunci server ikut diterima sebagai pengganti kunci publik: kalau kunci
 * server ada, `db()` memakainya untuk SEMUA permintaan dan kunci publik
 * tidak pernah dikirim. Mensyaratkan kunci publik dalam keadaan itu akan
 * menolak konfigurasi yang sebenarnya lengkap.
 */
export const punyaEnvBaca = () =>
  ambilSupabaseUrl().length > 0 &&
  (ambilAnonKey().length > 0 || ambilServiceKey().length > 0);

/**
 * Pesan tunggal untuk "env baca belum diisi".
 *
 * Dulu kedua env ini punya nilai cadangan di dalam kode (`?? "https://..."`),
 * jadi aplikasi tetap tersambung walau dashboard kosong. Akibatnya "env
 * kosong" dan "env terisi" tidak bisa dibedakan dari luar — dan itu memang
 * pernah menyesatkan. Nilai cadangan sudah dihapus; pesan ini menggantikannya
 * supaya kegagalan terbaca, bukan tersamar.
 */
export const PESAN_ENV_KOSONG =
  "SUPABASE_URL dan SUPABASE_ANON_KEY belum diisi di environment. " +
  "Halaman tidak bisa membaca database sampai keduanya dipasang.";

function authHeader(): string {
  const key = punyaKunciServer() ? ambilServiceKey() : ambilAnonKey();
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
  // Gagal CEPAT: env kosong bukan kesalahan jaringan, dan tidak boleh
  // dilaporkan sebagai "tidak bisa menghubungi database" — pesan itu
  // mengirim orang memeriksa koneksi padahal yang kurang adalah env.
  if (!punyaEnvBaca()) {
    return { ok: false, pesan: PESAN_ENV_KOSONG };
  }

  const { q = "select=*", method = "GET", body, prefer, headers: tambahan } = opsi;
  const url = `${ambilSupabaseUrl()}/rest/v1/${tabel}${q ? `?${q}` : ""}`;

  const headers: Record<string, string> = {
    apikey: punyaKunciServer() ? ambilServiceKey() : ambilAnonKey(),
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
