/**
 * Jam buka cafe — DIBACA DARI DATABASE, bukan dari konstanta di kode.
 *
 * ── KENAPA BERKAS TERPISAH ───────────────────────────────────────────
 *
 * `aturan.ts` berisi perhitungan murni (harga, pajak, transisi status) dan
 * diuji tanpa jaringan. Jam buka butuh database, jadi menaruhnya di sana
 * akan mencampur dua hal yang berbeda tingkat kepercayaannya.
 *
 * ── MASALAH YANG DIPERBAIKI ──────────────────────────────────────────
 *
 * Sebelum ini `cekBuka()` memakai konstanta `JAM_BAWAAN` di kode,
 * sementara tabel `pengaturan` sudah menyimpan `jam_weekday` dan
 * `jam_weekend` yang TIDAK PERNAH DIBACA. Pemilik yang mengubah jam di
 * dashboard Supabase tidak melihat efek apa pun — dan menyimpulkan
 * aplikasinya rusak. Itu bukan salah pemilik; itu salah kita yang
 * menyimpan dua kebenaran.
 *
 * Sekarang hanya ada satu sumber: baris `jam_mingguan` di tabel
 * `pengaturan`. Mengubah jam = mengubah satu baris, tanpa deploy.
 */
import { db, punyaEnvBaca } from "./db";
import type { JamBuka } from "./aturan";

/**
 * Format nilai `jam_mingguan`:
 *
 *     "HH.MM-HH.MM,HH.MM-HH.MM"
 *      └ Senin–Kamis  └ Jumat–Minggu
 *
 * `"24.00-24.00"` berarti BUKA 24 JAM. Dipakai apa adanya, bukan diubah
 * jadi "00.00-23.59": pada tengah malam `Intl` kadang mengembalikan jam
 * `"24"`, sehingga menit menjadi 1440 dan `1440 < 1439` bernilai SALAH —
 * kafe tertutup satu menit setiap tengah malam. Kecil, tapi nyata.
 */
export const CONTOH_24_JAM = "00.00-24.00,00.00-24.00";

/** Nilai yang dipakai bila baris database belum ada / tidak terbaca. */
export const JAM_CADANGAN = "09.00-20.00,08.00-21.00";

/** "HH.MM" → menit sejak tengah malam. "24.00" → 1440 (bukan 0). */
export function keMenit(jam: string): number {
  const [j, m] = jam.trim().split(".");
  const hh = Number(j);
  const mm = Number(m ?? 0);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
  return hh * 60 + mm;
}

export type Rentang = { mulai: number; selesai: number; teks: string };

/**
 * Baca satu sisi ("HH.MM-HH.MM") menjadi rentang menit.
 * Mengembalikan null bila bentuknya tidak sah — pemanggil memutuskan
 * apakah jatuh ke cadangan.
 */
export function bacaRentang(sisi: string): Rentang | null {
  const teks = sisi.trim();
  const pisah = teks.split("-");
  if (pisah.length !== 2) return null;

  const mulai = keMenit(pisah[0]);
  const selesai = keMenit(pisah[1]);
  if (!Number.isFinite(mulai) || !Number.isFinite(selesai)) return null;
  if (mulai < 0 || mulai > 1440 || selesai < 0 || selesai > 1440) return null;

  // Mulai == selesai berarti sepanjang hari (bukan nol menit). Ini yang
  // membuat "24.00-24.00" dan "00.00-00.00" sama-sama berarti buka terus.
  // Menafsirkannya sebagai "tutup" akan menghasilkan kafe yang tidak pernah
  // buka — kesalahan yang mahal dan sulit dilacak.
  if (mulai === selesai) return { mulai: 0, selesai: 1440, teks };

  return { mulai, selesai, teks };
}

/**
 * Pecah nilai `jam_mingguan`. Mengembalikan null bila tidak sah, supaya
 * pemanggil bisa membedakan "belum diatur" dari "diatur tapi salah tulis".
 */
export function bacaJamMingguan(nilai: string): JamBuka | null {
  const bagian = nilai.split(",");
  if (bagian.length !== 2) return null;

  const weekday = bacaRentang(bagian[0]);
  const weekend = bacaRentang(bagian[1]);
  if (!weekday || !weekend) return null;

  return {
    weekday: [weekday.teks.split("-")[0], weekday.teks.split("-")[1]],
    weekend: [weekend.teks.split("-")[0], weekend.teks.split("-")[1]],
  };
}

export type JamBukaAktif = {
  jam: JamBuka;
  /** true bila kedua sisi berarti buka sepanjang hari. */
  buka24Jam: boolean;
  /** Nilai mentah dari database (atau cadangan). */
  mentah: string;
  /** Alasan bila nilai database tidak sah dan cadangan yang dipakai. */
  catatan: string;
};

/**
 * Ambil jam buka yang berlaku.
 *
 * TIDAK pernah melempar dan tidak pernah mengembalikan "tutup" hanya karena
 * database tidak terbaca. Alasannya praktis: kalau database bermasalah,
 * pesanan toh sudah ditolak lebih dulu dengan pesan yang lebih jelas. Kafe
 * yang tiba-tiba "tutup" karena satu query gagal adalah kegagalan kedua di
 * atas kegagalan pertama.
 */
export async function ambilJamBuka(): Promise<JamBukaAktif> {
  const cadangan = bacaJamMingguan(JAM_CADANGAN)!;
  const hasil: JamBukaAktif = {
    jam: cadangan,
    buka24Jam: false,
    mentah: JAM_CADANGAN,
    catatan: "",
  };

  if (!punyaEnvBaca()) return hasil;

  const r = await db<{ nilai: string }[]>("pengaturan", {
    q: "select=nilai&kunci=eq.jam_mingguan&limit=1",
  });
  if (!r.ok || r.data.length === 0) return hasil;

  const mentah = (r.data[0].nilai ?? "").trim();
  if (!mentah) return hasil;

  const jam = bacaJamMingguan(mentah);
  if (!jam) {
    /*
      Nilai ADA tapi tidak sah. Jangan diam-diam memakai cadangan tanpa
      memberi tahu: pemilik mengira sudah memasang 24 jam, tapi yang
      berlaku jam lama. Catatan ini ikut dikirim ke layar supaya terlihat.
    */
    return {
      jam: cadangan,
      buka24Jam: false,
      mentah,
      catatan: `Nilai jam_mingguan tidak terbaca ("${mentah.slice(0, 40)}"). Yang dipakai jam bawaan.`,
    };
  }

  const wd = bacaRentang(jam.weekday.join("-"))!;
  const we = bacaRentang(jam.weekend.join("-"))!;

  return {
    jam,
    buka24Jam: wd.mulai === 0 && wd.selesai === 1440 && we.mulai === 0 && we.selesai === 1440,
    mentah,
    catatan: "",
  };
}
