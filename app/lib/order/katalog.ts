/**
 * Katalog: menu, kategori, meja, pengaturan biaya.
 *
 * ── ATURAN BERKAS INI ────────────────────────────────────────────────
 *
 * SATU pintu, SATU sumber: Supabase. Tidak ada salinan data di dalam kode.
 *
 * Sampai sesi ini, `app/lib/order/demo.ts` (535 baris) dan
 * `VENUES_LOKAL` di `app/lib/venues.ts` menyimpan salinan lengkap menu,
 * meja, dan venue. Salinan itu dipakai sebagai cadangan ketika database
 * tidak terbaca — dan justru itulah masalahnya: situs tampil normal dengan
 * 126 menu sementara environment sama sekali belum diisi. Pemilik
 * menyimpulkan semuanya berjalan; kenyataannya tidak ada satu pun data yang
 * datang dari database.
 *
 * Keputusan pemilik: "data contoh tidak perlu, dan data yang menempel di
 * kode juga tidak perlu, harus masuk ke database."
 *
 * Karena itu berkas ini TIDAK punya cadangan data. Kalau database tidak
 * bisa dibaca, hasilnya `ok: false` dengan pesan yang jelas, dan halaman
 * menampilkannya. Kegagalan harus terlihat, bukan ditutupi.
 *
 * Pemilik tetap punya "mode contoh" — tetapi dalam bentuk yang benar:
 * satu baris di tabel `pengaturan` di DATABASE, bisa dinyalakan/dimatikan
 * dari /order/admin tanpa deploy. Lihat `app/lib/order/mode-contoh.ts`.
 */

import { db, PESAN_ENV_KOSONG, punyaEnvBaca } from "./db";
import { ATURAN_BAWAAN, type AturanBiaya } from "./aturan";
import { urutNomorMeja, type KategoriMenu, type Meja, type Menu } from "./tipe";

export type Hasil<T> = { ok: true; data: T } | { ok: false; pesan: string };

// ─────────────────────────────────────────────────────────────
// Menu
// ─────────────────────────────────────────────────────────────

export type MenuLengkap = {
  kategori: KategoriMenu[];
  menu: Menu[];
};

export async function ambilMenu(): Promise<Hasil<MenuLengkap>> {
  if (!punyaEnvBaca()) return { ok: false, pesan: PESAN_ENV_KOSONG };

  const [kat, mn] = await Promise.all([
    db<KategoriMenu[]>("kategori_menu", { q: "select=*&order=urutan.asc" }),
    db<Menu[]>("menu", { q: "select=*&order=urutan.asc" }),
  ]);

  if (!kat.ok) return { ok: false, pesan: kat.pesan };
  if (!mn.ok) return { ok: false, pesan: mn.pesan };

  /*
    Kosong DIPERLAKUKAN SEBAGAI GAGAL, bukan "menu kosong".

    Bedanya penting: "menu kosong" akan tampil sebagai halaman tanpa
    hidangan, dan orang akan mengira kafe tidak menjual apa pun. Yang
    sebenarnya terjadi adalah migrasi belum dijalankan — pesan di bawah
    langsung menunjuk ke situ.
  */
  if (kat.data.length === 0 || mn.data.length === 0) {
    return {
      ok: false,
      pesan:
        "Tabel menu di database masih kosong. Jalankan migrasi di " +
        "supabase/migrations lebih dulu, lalu muat ulang halaman ini.",
    };
  }

  return { ok: true, data: { kategori: kat.data, menu: mn.data } };
}

// ─────────────────────────────────────────────────────────────
// Meja
// ─────────────────────────────────────────────────────────────

export async function ambilMeja(nomor?: string): Promise<Hasil<Meja | Meja[]>> {
  if (!punyaEnvBaca()) return { ok: false, pesan: PESAN_ENV_KOSONG };

  if (nomor !== undefined) {
    const r = await db<Meja[]>("meja", {
      q: `select=*&nomor=eq.${encodeURIComponent(nomor)}&aktif=eq.true&limit=1`,
    });
    if (!r.ok) return { ok: false, pesan: r.pesan };
    if (r.data.length === 0) return { ok: false, pesan: "Nomor meja tidak dikenali." };
    return { ok: true, data: r.data[0] };
  }

  const r = await db<Meja[]>("meja", { q: "select=*&order=nomor.asc" });
  if (!r.ok) return { ok: false, pesan: r.pesan };
  /*
    `order=nomor.asc` di PostgREST mengurutkan TEXT: 1, 10, 11, …, 2, 20, 3.
    Pengurutan yang benar dilakukan di sini — lihat `urutNomorMeja`.
  */
  return { ok: true, data: [...r.data].sort((a, b) => urutNomorMeja(a.nomor, b.nomor)) };
}

// ─────────────────────────────────────────────────────────────
// Pengaturan biaya
// ─────────────────────────────────────────────────────────────

/**
 * Biaya layanan & pajak.
 *
 * `ATURAN_BAWAAN` (dari aturan.ts) BUKAN data contoh. Ia nilai yang dipakai
 * kalau tabel `pengaturan` belum berisi kunci itu — setara kolom dengan
 * nilai bawaan di database. Angkanya harus tetap ada di kode supaya tagihan
 * tidak pernah menjadi 0 hanya karena satu baris tabel hilang.
 *
 * Yang dihapus dari kode adalah DATA (menu, meja, venue), bukan nilai
 * bawaan perhitungan.
 */
export async function ambilAturan(): Promise<AturanBiaya> {
  if (!punyaEnvBaca()) return ATURAN_BAWAAN;

  const r = await db<{ kunci: string; nilai: string }[]>("pengaturan", {
    q: "select=kunci,nilai",
  });
  if (!r.ok) return ATURAN_BAWAAN;

  // Jangan mencampur dua tabel: `mode_contoh` tinggal di tabel yang sama,
  // tetapi bukan angka biaya.
  return bacaAturan(r.data.filter((x) => x.kunci !== "mode_contoh"));
}

/**
 * Batas waktu bayar (menit) — bisa diubah pemilik dari dashboard Supabase.
 *
 * Kenapa di database dan bukan konstanta: batas ini keputusan operasional
 * yang bisa berubah (jam ramai vs sepi), dan mengubahnya tidak seharusnya
 * menuntut deploy. Nilai 0 atau tidak sah jatuh ke 15 menit — batas 0 akan
 * membatalkan pesanan sebelum tamu sempat membuka halaman pembayaran.
 */
export async function ambilBatasBayarMenit(): Promise<number> {
  if (!punyaEnvBaca()) return 15;
  const r = await db<{ nilai: string }[]>("pengaturan", {
    q: "select=nilai&kunci=eq.batas_bayar_menit&limit=1",
  });
  if (!r.ok || r.data.length === 0) return 15;
  const n = Number(r.data[0].nilai);
  return Number.isFinite(n) && n >= 1 && n <= 120 ? Math.round(n) : 15;
}

/** Apakah bayar tunai di kasir diizinkan. Default: ya (keputusan pemilik). */
export async function bolehBayarTunai(): Promise<boolean> {
  if (!punyaEnvBaca()) return true;
  const r = await db<{ nilai: string }[]>("pengaturan", {
    q: "select=nilai&kunci=eq.bayar_tunai_kasir&limit=1",
  });
  if (!r.ok || r.data.length === 0) return true;
  return (r.data[0].nilai ?? "").trim().toLowerCase() !== "off";
}

/** Dipisah supaya bisa diuji tanpa jaringan. */
export function bacaAturan(baris: { kunci: string; nilai: string }[]): AturanBiaya {
  const peta = new Map(baris.map((x) => [x.kunci, x.nilai]));
  const angka = (k: string, cadangan: number) => {
    const v = Number(peta.get(k));
    return Number.isFinite(v) ? v : cadangan;
  };

  return {
    pajakPersen: angka("pajak_persen", ATURAN_BAWAAN.pajakPersen),
    layananPersen: angka("layanan_persen", ATURAN_BAWAAN.layananPersen),
    layananRp: angka("layanan_rp", ATURAN_BAWAAN.layananRp),
    pembulatan: angka("pembulatan", ATURAN_BAWAAN.pembulatan),
  };
}
