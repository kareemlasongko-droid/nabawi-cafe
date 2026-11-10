/**
 * Aturan bisnis yang HARUS bisa diuji tanpa browser.
 *
 * Semua fungsi di sini murni (tanpa akses database), supaya bisa diperiksa
 * sekali dan dipakai di mana saja: server saat menyimpan, dan layar saat
 * menampilkan perkiraan total.
 */
import type { MetodeBayar, PilihanMenu } from "./tipe";

// ─────────────────────────────────────────────────────────────
// Pilihan menu (sambal / saus / rasa)
// ─────────────────────────────────────────────────────────────

/** Batas jumlah opsi per menu. Empat menu saat ini maksimal 7. */
export const BATAS_PILIHAN = 12;

/**
 * Merapikan data pilihan dari database menjadi bentuk yang bisa dipercaya.
 *
 * Data jsonb bisa berbentuk apa saja kalau salah tulis di SQL Editor —
 * `{}`, `null`, `[{"nama":123}]`, `tambah` berupa teks. Semua pembacaan
 * menu lewat sini supaya satu baris rusak tidak membuat seluruh halaman
 * gagal, dan supaya `tambah` dijamin angka (NaN di tengah perhitungan
 * tagihan akan menghasilkan total NaN yang lolos ke struk).
 */
export function bacaPilihan(mentah: unknown): PilihanMenu[] {
  if (!Array.isArray(mentah)) return [];
  const hasil: PilihanMenu[] = [];
  for (const x of mentah) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const nama = typeof o.nama === "string" ? o.nama.trim().slice(0, 80) : "";
    if (!nama) continue;
    const angka = Number(o.tambah);
    // Tambahan harga negatif tidak masuk akal (menurunkan harga jual) dan
    // akan disalahgunakan. Dibulatkan ke rupiah utuh, dibatasi wajar.
    const tambah = Number.isFinite(angka) ? Math.max(0, Math.round(angka)) : 0;
    if (hasil.some((p) => p.nama.toLowerCase() === nama.toLowerCase())) continue;
    hasil.push({ nama, tambah });
    if (hasil.length >= BATAS_PILIHAN) break;
  }
  return hasil;
}

/**
 * Memeriksa pilihan yang dikirim pelanggan terhadap pilihan menu di database.
 *
 * ATURAN: satu rasa/saus per item (permintaan pemilik). Kosong diperbolehkan
 * bila menu memang tidak punya pilihan; bila menu punya pilihan, pelanggan
 * WAJIB memilih satu — kalau tidak, dapur tetap harus menebak, dan itulah
 * masalah yang sedang diperbaiki.
 *
 * Harga TIDAK diambil dari kiriman browser. Nama opsi dicocokkan ke menu,
 * lalu `tambah` diambil dari database. Browser hanya boleh menyebut NAMA.
 */
export function periksaPilihan(
  tersedia: PilihanMenu[],
  diminta: unknown
): { ok: true; pilihan: PilihanMenu[]; tambah: number } | { ok: false; pesan: string } {
  if (tersedia.length === 0) {
    // Menu tanpa pilihan: kiriman apa pun diabaikan, bukan ditolak. Menu bisa
    // saja baru dihapus pilihannya saat pelanggan masih memegang layar lama.
    return { ok: true, pilihan: [], tambah: 0 };
  }

  const daftar = Array.isArray(diminta)
    ? diminta.filter((x): x is string => typeof x === "string").map((x) => x.trim())
    : typeof diminta === "string"
      ? [diminta.trim()]
      : [];

  const dipilih = daftar.filter(Boolean);
  if (dipilih.length === 0) {
    return { ok: false, pesan: `Pilih dulu: ${tersedia.map((p) => p.nama).join(", ")}.` };
  }
  if (dipilih.length > 1) {
    return { ok: false, pesan: "Pilih satu saja, tidak bisa lebih dari satu." };
  }

  const cari = tersedia.find((p) => p.nama.toLowerCase() === dipilih[0].toLowerCase());
  if (!cari) {
    return {
      ok: false,
      pesan: `Pilihan "${dipilih[0]}" tidak tersedia untuk menu ini.`,
    };
  }
  return { ok: true, pilihan: [cari], tambah: cari.tambah };
}

/** Tambahan harga dari pilihan yang sudah diperiksa. */
export function tambahanPilihan(pilihan: PilihanMenu[] | null | undefined): number {
  if (!Array.isArray(pilihan)) return 0;
  return pilihan.reduce((n, p) => n + (Number.isFinite(p?.tambah) ? p.tambah : 0), 0);
}

// ─────────────────────────────────────────────────────────────
// Pajak, biaya layanan, pembulatan (PRD bagian 11)
// ─────────────────────────────────────────────────────────────

export type AturanBiaya = {
  /** Persen pajak dari (subtotal + layanan). */
  pajakPersen: number;
  /** Persen biaya layanan dari subtotal. */
  layananPersen: number;
  /** Biaya layanan tetap per tagihan, dipakai bila layananPersen = 0. */
  layananRp: number;
  /** Pembulatan total ke rupiah terdekat (100 = ke ratusan). */
  pembulatan: number;
};

export const ATURAN_BAWAAN: AturanBiaya = {
  pajakPersen: 11,
  layananPersen: 0,
  layananRp: 2000,
  pembulatan: 100,
};

export type Rincian = {
  subtotal: number;
  layanan: number;
  pajak: number;
  pembulatan: number;
  total: number;
};

/**
 * Hitung satu tagihan.
 *
 * Urutan mengikuti PRD bagian 11 dan sengaja dipertahankan apa adanya:
 *   layanan = subtotal × p_layanan     (atau biaya tetap bila persen = 0)
 *   pajak   = (subtotal + layanan) × p_pajak
 *   total   = subtotal + layanan + pajak, lalu dibulatkan SEKALI per tagihan
 *
 * Pembulatan dilakukan di akhir, bukan per item, karena pembulatan per item
 * membuat jumlah baris tidak sama dengan total dan kasir akan menyelisihkan
 * struk (PRD: "pembulatan: hitung per tagihan, bukan per item").
 */
export function hitungTagihan(subtotal: number, a: AturanBiaya = ATURAN_BAWAAN): Rincian {
  const dasar = Math.max(0, Math.round(subtotal));

  const layanan =
    a.layananPersen > 0
      ? Math.round((dasar * a.layananPersen) / 100)
      : Math.max(0, Math.round(a.layananRp));

  const pajak = Math.round(((dasar + layanan) * a.pajakPersen) / 100);
  const mentah = dasar + layanan + pajak;

  // Pembulatan ke kelipatan `pembulatan` terdekat.
  const langkah = a.pembulatan > 0 ? a.pembulatan : 1;
  const total = Math.round(mentah / langkah) * langkah;

  return { subtotal: dasar, layanan, pajak, pembulatan: total - mentah, total };
}

// ─────────────────────────────────────────────────────────────
// Jam buka (PRD P-12)
// ─────────────────────────────────────────────────────────────

/**
 * Jam buka berbeda weekday vs weekend/hari libur.
 * Waktu dihitung pada zona Asia/Jakarta, BUKAN zona server — server Vercel
 * berjalan di UTC, jadi tanpa konversi ini jam buka akan meleset 7 jam.
 */
export const ZONA = "Asia/Jakarta";

export type JamBuka = { weekday: [string, string]; weekend: [string, string] };

export const JAM_BAWAAN: JamBuka = {
  weekday: ["09.00", "20.00"],
  weekend: ["08.00", "21.00"],
};

/** Pecah "HH.MM" menjadi menit sejak tengah malam. */
function keMenit(jam: string): number {
  const [h, m] = jam.replace(":", ".").split(".");
  return Number(h) * 60 + Number(m ?? 0);
}

export type StatusBuka = {
  buka: boolean;
  /** Contoh: "09.00 – 20.00" untuk hari ini. */
  jamHariIni: string;
  /** Alasannya, untuk pesan ke pelanggan. */
  alasan: string;
};

/**
 * Apakah cafe sedang buka.
 * `sekarang` bisa diisi agar mudah diuji. Tanpa argumen memakai waktu nyata.
 */
/**
 * Apakah cafe sedang buka, menurut jam di zona Asia/Jakarta.
 *
 * `sekarang` bisa diisi untuk pengujian dan untuk pratinjau. Tanpa itu,
 * seluruh alat uji alur hanya bisa berjalan pada jam operasional — uji
 * yang dijalankan pukul 20.05 akan gagal di langkah "kirim pesanan"
 * dengan 409 dan menutupi hasil sebenarnya.
 */
export function cekBuka(sekarang: Date = new Date(), jam: JamBuka = JAM_BAWAAN): StatusBuka {
  const bagian = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(sekarang);

  const ambil = (t: string) => bagian.find((p) => p.type === t)?.value ?? "";
  const hari = ambil("weekday"); // Mon, Tue, ...
  const menitSekarang = Number(ambil("hour")) * 60 + Number(ambil("minute"));

  const akhirPekan = hari === "Sat" || hari === "Sun";
  const [mulai, selesai] = akhirPekan ? jam.weekend : jam.weekday;
  const menitMulai = keMenit(mulai);
  const menitSelesai = keMenit(selesai);

  const buka = menitSekarang >= menitMulai && menitSekarang < menitSelesai;

  return {
    buka,
    jamHariIni: `${mulai} – ${selesai}`,
    alasan: buka
      ? ""
      : menitSekarang < menitMulai
        ? `Cafe belum buka. Hari ini buka pukul ${mulai}.`
        : `Cafe sudah tutup. Hari ini buka pukul ${mulai} – ${selesai}.`,
  };
}

// ─────────────────────────────────────────────────────────────
// Validasi pesanan
// ─────────────────────────────────────────────────────────────

export const BATAS_ITEM_PER_PESANAN = 20;
export const BATAS_JUMLAH_PER_ITEM = 20;
export const BATAS_CATATAN = 200;
export const BATAS_NAMA = 40;

export type ItemMasuk = {
  menu_id: number;
  jumlah: number;
  /** Selalu dinormalkan: string kosong menjadi null oleh validasi. */
  catatan: string | null;
  /**
   * NAMA opsi yang dipilih pelanggan, mis. ["Black Pepper"].
   * Hanya nama — harga tidak pernah diterima dari browser. Dicocokkan ke
   * database oleh `periksaPilihan()` saat pesanan disimpan.
   */
  pilihan: string[];
};

export type PesananMasuk = {
  meja: string;
  /** Nama pemesan opsional; null berarti tidak diisi. */
  nama: string | null;
  sesi: string;
  items: ItemMasuk[];
};

export type HasilValidasi = { ok: true; bersih: PesananMasuk } | { ok: false; pesan: string };

/**
 * Bersihkan dan periksa kiriman pelanggan.
 *
 * Yang TIDAK diambil dari klien: harga, nama menu, total. Semuanya diambil
 * ulang dari tabel menu di server. Kalau harga ikut dikirim dari browser,
 * siapa pun bisa memesan tajine Rp1.
 */
export function validasiPesananMasuk(masuk: unknown): HasilValidasi {
  if (!masuk || typeof masuk !== "object") {
    return { ok: false, pesan: "Isi pesanan tidak terbaca." };
  }
  const m = masuk as Record<string, unknown>;

  const meja = typeof m.meja === "string" ? m.meja.trim() : "";
  if (!meja) return { ok: false, pesan: "Nomor meja tidak ada. Scan ulang QR di meja." };

  const sesi = typeof m.sesi === "string" ? m.sesi.trim().slice(0, 64) : "";
  if (!sesi) return { ok: false, pesan: "Sesi perangkat tidak dikenali. Muat ulang halaman." };

  const nama = typeof m.nama === "string" ? m.nama.trim().slice(0, BATAS_NAMA) : "";

  if (!Array.isArray(m.items) || m.items.length === 0) {
    return { ok: false, pesan: "Keranjang masih kosong." };
  }
  if (m.items.length > BATAS_ITEM_PER_PESANAN) {
    return {
      ok: false,
      pesan: `Maksimal ${BATAS_ITEM_PER_PESANAN} jenis menu per pesanan. Kirim dua kali.`,
    };
  }

  const items: ItemMasuk[] = [];
  const terpakai = new Map<number, number>();

  for (const mentah of m.items) {
    if (!mentah || typeof mentah !== "object") {
      return { ok: false, pesan: "Ada item yang tidak terbaca." };
    }
    const it = mentah as Record<string, unknown>;
    const menuId = Number(it.menu_id);
    const jumlah = Math.floor(Number(it.jumlah));

    if (!Number.isFinite(menuId) || menuId <= 0) {
      return { ok: false, pesan: "Ada item tanpa menu yang sah." };
    }
    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      return { ok: false, pesan: "Jumlah item harus lebih dari nol." };
    }

    const total = (terpakai.get(menuId) ?? 0) + jumlah;
    if (total > BATAS_JUMLAH_PER_ITEM) {
      return {
        ok: false,
        pesan: `Jumlah per menu maksimal ${BATAS_JUMLAH_PER_ITEM}.`,
      };
    }
    terpakai.set(menuId, total);

    const catatan =
      typeof it.catatan === "string" ? it.catatan.trim().slice(0, BATAS_CATATAN) : "";

    /*
      Pilihan dibaca sebagai daftar NAMA saja. Isinya belum divalidasi di
      sini karena validasi butuh data menu dari database (lihat data.ts).
      Yang dijaga di sini: bentuknya tidak aneh dan panjangnya terbatas,
      supaya tidak ada kiriman raksasa yang membebani database.
    */
    const pilihanMentah = Array.isArray(it.pilihan)
      ? it.pilihan
      : typeof it.pilihan === "string"
        ? [it.pilihan]
        : [];
    const pilihan = pilihanMentah
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 3);

    items.push({ menu_id: menuId, jumlah, catatan: catatan || null, pilihan });
  }

  return { ok: true, bersih: { meja, nama: nama || null, sesi, items } };
}

// ─────────────────────────────────────────────────────────────
// Pembayaran
// ─────────────────────────────────────────────────────────────

/** Kembalian untuk tunai; metode lain tidak menghasilkan kembalian. */
export function hitungKembalian(metode: MetodeBayar, total: number, diterima: number): number {
  if (metode !== "tunai") return 0;
  return Math.max(0, Math.round(diterima - total));
}

/** Uang tunai kurang dari total tidak boleh dianggap lunas. */
export function pembayaranCukup(metode: MetodeBayar, total: number, diterima: number): boolean {
  if (!Number.isFinite(diterima)) return false;
  if (metode === "tunai") return diterima >= total;
  // QRIS di kasir dan kartu: nominal harus sama dengan total (uang pas).
  return diterima >= total;
}

// ─────────────────────────────────────────────────────────────
// Nomor pesanan
// ─────────────────────────────────────────────────────────────

/**
 * Nomor pendek untuk diteriakkan di dapur: "M12-0417".
 * Meja + jam-menit, supaya unik dalam satu jam dan mudah dibaca dari jauh.
 */
/**
 * Nomor pesanan yang dilihat pelayan di tiket: M12-2030-47.
 *
 * Bagian jam-menit saja TIDAK cukup. Kolom `nomor` punya unique index, dan
 * satu meja bisa mengirim dua pesanan dalam menit yang sama (dua orang
 * memesan bersamaan, atau tamu menambah minuman saat pesanan pertama baru
 * dikirim). Dengan M12-2030 saja, pesanan kedua ditolak database dan tamu
 * hanya melihat kegagalan tanpa sebab.
 *
 * Dua digit acak di belakang membuat bentrok praktis tidak terjadi; data.ts
 * tetap mencoba ulang sekali bila toh bentrok.
 */
export function nomorPesanan(meja: string, sekarang: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(sekarang);
  const acak = Math.floor(Math.random() * 90) + 10; // 10–99, selalu 2 digit
  return `M${meja}-${fmt.replace(":", "")}-${acak}`;
}
