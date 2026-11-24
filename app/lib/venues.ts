/**
 * Sumber data Virtual Tour 360.
 *
 * Alur: Supabase (tabel `tour_venues`) -> kalau gagal -> salinan lokal.
 *
 * Kenapa ada salinan lokal? Supabase bisa di-pause (proyek ini pernah
 * berstatus INACTIVE saat dicek) atau jaringan sedang putus. Tanpa
 * fallback, seluruh halaman tour akan kosong hanya karena satu request
 * gagal.
 *
 * TAPI: salinan lokal TIDAK dipakai saat env kosong. Bedanya penting —
 * lihat `ambilVenues()`. Dulu baris terakhir paragraf ini berbunyi "supaya
 * build tetap berhasil walau env belum diisi", dan itu justru masalahnya:
 * env kosong jadi tidak terlihat sama sekali.
 *
 * Saat Supabase hidup, SELALU data Supabase yang dipakai — termasuk kalau
 * pemilik menambah atau mengubah tempat lewat dashboard.
 */

import { envSupabaseSiap, PESAN_ENV_SUPABASE, supabaseSelect } from "./supabase";

export type Aksen = "forest" | "clay" | "cream";

export type Venue = {
  slug: string;
  urutan: number;
  nama: string;
  kategori: string;
  ringkasan: string;
  deskripsi: string;
  panoramaUrl: string;
  petaX: number;
  petaY: number;
  aksen: Aksen;
  fasilitas: string[];
  jamBuka: string | null;
  durasiMenit: number;
};

/** Bentuk baris apa adanya dari PostgREST (snake_case, numeric sebagai string). */
type BarisSupabase = {
  slug: string;
  urutan: number;
  nama: string;
  kategori: string;
  ringkasan: string;
  deskripsi: string;
  panorama_url: string;
  peta_x: string | number;
  peta_y: string | number;
  aksen: string;
  fasilitas: string[] | null;
  jam_buka: string | null;
  durasi_menit: number;
};

const AKSEN_SAH: Aksen[] = ["forest", "clay", "cream"];

function rapikanAksen(nilai: string): Aksen {
  return (AKSEN_SAH as string[]).includes(nilai) ? (nilai as Aksen) : "forest";
}

function dariBaris(b: BarisSupabase): Venue {
  return {
    slug: b.slug,
    urutan: b.urutan,
    nama: b.nama,
    kategori: b.kategori,
    ringkasan: b.ringkasan,
    deskripsi: b.deskripsi,
    panoramaUrl: b.panorama_url,
    petaX: Number(b.peta_x),
    petaY: Number(b.peta_y),
    aksen: rapikanAksen(b.aksen),
    fasilitas: b.fasilitas ?? [],
    jamBuka: b.jam_buka,
    durasiMenit: b.durasi_menit,
  };
}

/**
 * Salinan lokal — isinya SAMA dengan yang ada di Supabase saat ini.
 * Dipakai hanya kalau Supabase tidak bisa dihubungi.
 */

/* ── VENUES_LOKAL DIHAPUS ──────────────────────────────────────────────
 *
 * Di sini dulu tinggal salinan 10 tempat (nama, deskripsi, fasilitas,
 * panorama) sebagai cadangan bila Supabase tidak terjangkau. Pemilik
 * meminta data yang menempel di kode dihapus dan semuanya masuk database.
 * Isinya sudah ada di tabel `tour_venues` — 10 baris, slug dan teks yang
 * sama persis, diperiksa sebelum penghapusan ini.
 *
 * Halaman /tour sekarang menampilkan masalah bila database tidak terbaca.
 */

/**
 * Ambil semua tempat, urut sesuai `urutan`.
 *
 * Tiga keadaan, dibedakan dengan sengaja karena akibatnya berbeda:
 *
 *   "supabase"  — data sungguhan dari database.
 *   "lokal"     — database DIHUBUNGI tapi menjawab kosong. Salinan lokal
 *                 dipakai supaya halaman tidak kosong.
 *   "tanpa-env" — env tidak diisi, jadi database TIDAK dihubungi sama
 *                 sekali. Ini BUKAN kegagalan jaringan, dan menyamakannya
 *                 dengan "lokal" akan menyembunyikan salah konfigurasi
 *                 yang paling mudah diperbaiki.
 *
 * Tidak pernah melempar error: halaman tour harus tetap terbuka.
 */
export async function ambilVenues(): Promise<{
  venues: Venue[];
  sumber: "supabase" | "gagal";
  pesan: string;
}> {
  if (!envSupabaseSiap()) {
    return { venues: [], sumber: "gagal", pesan: PESAN_ENV_SUPABASE };
  }

  try {
    const baris = await supabaseSelect<BarisSupabase>(
      "tour_venues",
      "select=slug,urutan,nama,kategori,ringkasan,deskripsi,panorama_url,peta_x,peta_y,aksen,fasilitas,jam_buka,durasi_menit&is_published=eq.true&order=urutan.asc",
    );

    /*
      Kosong diperlakukan sebagai MASALAH, bukan "belum ada tempat".

      Kalau tabel kosong, halaman akan tampil sebagai tur tanpa tempat —
      yang terlihat seperti fitur belum diisi, padahal biasanya berarti
      migrasi belum dijalankan atau `is_published` belum disetel.
    */
    if (baris.length === 0) {
      return {
        venues: [],
        sumber: "gagal",
        pesan:
          "Belum ada tempat yang terbit di database. Periksa tabel " +
          "tour_venues: pastikan is_published = true.",
      };
    }

    return { venues: baris.map(dariBaris), sumber: "supabase", pesan: "" };
  } catch (e) {
    /*
      Pesan dibedakan supaya saat membaca log tidak tertukar:
        - 401/403  -> kunci ditolak (salah kunci)
        - 42501    -> kunci benar tapi role anon belum diberi GRANT SELECT
        - ECONN*   -> memang gangguan jaringan

      Tidak ada lagi fallback ke salinan lokal: itulah yang dulu membuat
      halaman tampak sehat padahal database tidak pernah dibaca.
    */
    const pesan = String(e);
    const sebab = /\b401\b|\b403\b/.test(pesan)
      ? "kunci ditolak"
      : /42501|permission denied/.test(pesan)
        ? "role anon belum diberi GRANT SELECT"
        : /ECONN|ENOTFOUND|fetch failed|timeout/i.test(pesan)
          ? "jaringan tidak terjangkau"
          : "kesalahan lain";

    console.warn(`[venues] Supabase gagal (${sebab}):`, e);
    return {
      venues: [],
      sumber: "gagal",
      pesan: `Data tempat tidak bisa dibaca dari database (${sebab}).`,
    };
  }
}

export async function ambilVenue(slug: string): Promise<Venue | undefined> {
  const { venues } = await ambilVenues();
  return venues.find((v) => v.slug === slug);
}
