/**
 * Tipe data bersama untuk sistem order.
 * Bentuknya mengikuti tabel di Supabase (lihat migrasi `sistem_order_tahap1`).
 */

export type StatusPesanan =
  | "menunggu_konfirmasi"
  | "diterima"
  | "diproses"
  | "siap"
  | "diantar"
  | "ditolak"
  | "dibatalkan";

export type StatusMeja = "kosong" | "ada_pesanan" | "minta_bill" | "menunggu_bayar";

export type StatusTagihan = "terbuka" | "minta_bill" | "lunas";

export type MetodeBayar = "tunai" | "qris_kasir" | "kartu";

export type Peran = "kasir" | "dapur" | "pelayan" | "pemilik";

/**
 * Satu opsi yang bisa dipilih pelanggan, mis. "Saus Black Pepper".
 *
 * `tambah` adalah tambahan harga dalam rupiah. Nol berarti gratis. Nilai ini
 * disimpan di database, bukan di kode, supaya pemilik cafe bisa mengubahnya
 * tanpa deploy — dan supaya server bisa menghitung ulang tanpa mempercayai
 * apa pun yang dikirim browser.
 */
export type PilihanMenu = {
  nama: string;
  tambah: number;
};

export type Menu = {
  id: number;
  nama: string;
  deskripsi: string;
  harga: number;
  kategori_id: number | null;
  foto_url: string | null;
  tersedia: boolean;
  urutan: number;
  /**
   * Opsi yang bisa dipilih. Kosong berarti menu ini tidak punya pilihan.
   * Bentuknya tidak dijamin benar di sini — data dari database selalu
   * dirapikan lewat `bacaPilihan()` sebelum dipakai.
   */
  pilihan?: PilihanMenu[] | null;
};

export type KategoriMenu = {
  id: number;
  nama: string;
  urutan: number;
};

export type Meja = {
  id: number;
  nomor: string;
  area: string;
  aktif: boolean;
  status: StatusMeja;
  kapasitas: number;
};

export type ItemPesanan = {
  id: number;
  pesanan_id: number;
  menu_id: number | null;
  nama_saat_pesan: string;
  jumlah: number;
  /** Harga satuan SUDAH termasuk tambahan pilihan yang dipilih. */
  harga_satuan: number;
  catatan: string | null;
  /** Opsi yang dipilih pelanggan; null bila menu tidak punya pilihan. */
  pilihan?: PilihanMenu[] | null;
};

export type Pesanan = {
  id: number;
  nomor: string;
  meja_id: number;
  status: StatusPesanan;
  nama_pemesan: string | null;
  sesi_id: string;
  alasan_tolak: string | null;
  alasan_batal: string | null;
  total_item: number;
  created_at: string;
  diterima_at: string | null;
  diproses_at: string | null;
  siap_at: string | null;
  diantar_at: string | null;
};

export type Tagihan = {
  id: number;
  meja_id: number;
  status: StatusTagihan;
  subtotal: number;
  layanan: number;
  pajak: number;
  pembulatan: number;
  total: number;
  dibuka_at: string;
  ditutup_at: string | null;
  kasir: string | null;
};

export type Panggilan = {
  id: number;
  meja_id: number;
  jenis: "pelayan" | "bill";
  dibuat_at: string;
  ditangani_at: string | null;
};

/** Label yang dilihat pelanggan. Sengaja bahasa sehari-hari, bukan istilah sistem. */
export const LABEL_PELANGGAN: Record<StatusPesanan, { judul: string; detail: string }> = {
  menunggu_konfirmasi: {
    judul: "Menunggu kasir",
    detail: "Pesanan sudah masuk. Kasir akan menerimanya sebentar lagi.",
  },
  diterima: {
    judul: "Pesanan diterima",
    detail: "Kasir sudah menerima. Pesanan diteruskan ke dapur.",
  },
  diproses: {
    judul: "Sedang disiapkan",
    detail: "Dapur mulai mengerjakan pesanan ini.",
  },
  siap: {
    judul: "Siap diantar",
    detail: "Sudah matang dan menunggu pelayan mengantarnya.",
  },
  diantar: {
    judul: "Sudah diantar",
    detail: "Pesanan sudah ada di meja. Selamat menikmati.",
  },
  ditolak: {
    judul: "Pesanan ditolak",
    detail: "Kasir menolak pesanan ini. Silakan panggil pelayan.",
  },
  dibatalkan: {
    judul: "Pesanan dibatalkan",
    detail: "Pesanan ini tidak diproses.",
  },
};

/** Label untuk layar kasir/dapur — lebih teknis, ini staf yang membaca. */
export const LABEL_INTERNAL: Record<StatusPesanan, string> = {
  menunggu_konfirmasi: "Menunggu konfirmasi",
  diterima: "Diterima",
  diproses: "Diproses",
  siap: "Siap",
  diantar: "Diantar",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
};

export const LABEL_MEJA: Record<StatusMeja, string> = {
  kosong: "Kosong",
  ada_pesanan: "Ada pesanan",
  minta_bill: "Minta bill",
  menunggu_bayar: "Menunggu bayar",
};

export const LABEL_TAGIHAN: Record<StatusTagihan, string> = {
  terbuka: "Terbuka",
  minta_bill: "Minta bill",
  lunas: "Lunas",
};

export const LABEL_METODE: Record<MetodeBayar, string> = {
  tunai: "Tunai",
  qris_kasir: "QRIS di kasir",
  kartu: "Kartu",
};

/** Rp1.234.000 — tanpa desimal, karena harga menu tidak pakai sen. */
export function rupiah(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

/** "3 menit lalu" — dipakai di tiket dapur dan daftar panggilan. */
export function sejak(iso: string, sekarang = Date.now()): string {
  const menit = Math.max(0, Math.floor((sekarang - new Date(iso).getTime()) / 60000));
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  return `${jam} jam ${menit % 60} menit lalu`;
}

/** Menit tunggu sebagai angka, untuk pewarnaan tiket dapur. */
export function menitTunggu(iso: string, sekarang = Date.now()): number {
  return Math.max(0, Math.floor((sekarang - new Date(iso).getTime()) / 60000));
}
