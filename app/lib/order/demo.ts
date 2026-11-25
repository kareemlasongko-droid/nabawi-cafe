/**
 * Pratinjau sementara — TANPA data di dalamnya.
 *
 * ── APA YANG TERSISA DI SINI, DAN KENAPA ─────────────────────────────
 *
 * Berkas ini dulu 535 baris: salinan 132 menu lengkap dengan harga dan
 * pilihan rasa, 20 meja, serta seluruh fungsi pesanan/tagihan
 * yang bekerja di memori.
 *
 * Pemilik memutuskan: "data contoh tidak perlu, dan data yang menempel di
 * kode juga tidak perlu, harus masuk ke database." Keputusan itu benar,
 * dan sebagian besar berkas ini sudah dihapus.
 *
 * Yang tersisa HANYA satu hal: penandaan "menu habis" yang dicoba dari
 * portal kasir/dapur ketika kunci server belum dipasang. Itu bukan data —
 * itu MAP KOSONG berisi id menu ASLI dari database, yang mencatat
 * "menu 62 sedang habis". Tidak ada nama, tidak ada harga, tidak ada meja,
 * tidak ada pesanan.
 *
 * Kenapa dipertahankan: tanpa itu, tombol "tandai habis" di portal kasir
 * akan selalu gagal di lingkungan tanpa kunci server, dan alur K-08 tidak
 * bisa dicoba sama sekali sebelum kunci dipasang. Isinya hilang saat
 * Worker restart, dan portal menampilkan pemberitahuan bahwa itu terjadi.
 *
 * Semua aksi lain — pesan, bayar, ubah status — DITOLAK dengan pesan jelas
 * bila kunci server belum ada. Lihat rute masing-masing: pesanan, bayar,
 * status.
 */

const g = globalThis as unknown as {
  __pratinjauHabis?: Map<number, boolean>;
};

function petaHabis(): Map<number, boolean> {
  g.__pratinjauHabis ??= new Map<number, boolean>();
  return g.__pratinjauHabis;
}

/**
 * Terapkan penandaan habis/tersedia yang tersimpan di memori ke daftar
 * menu yang SUDAH dibaca dari database.
 *
 * Fungsi ini tidak pernah menambah menu: kalau sebuah id tidak ada di
 * daftar, ia juga tidak muncul. Sumber daftarnya tetap database.
 */
export function demoMenuDenganStatus<T extends { id: number; tersedia: boolean }>(
  daftar: T[],
): T[] {
  const ubah = petaHabis();
  if (ubah.size === 0) return daftar;
  return daftar.map((m) => (ubah.has(m.id) ? { ...m, tersedia: ubah.get(m.id)! } : m));
}

export function demoSetTersedia(menuId: number, tersedia: boolean) {
  petaHabis().set(menuId, tersedia);
}

export function demoReset() {
  petaHabis().clear();
}
