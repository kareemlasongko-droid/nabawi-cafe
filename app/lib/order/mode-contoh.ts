/**
 * Mode contoh — SATU baris di tabel `pengaturan`, bukan data di kode.
 *
 * ── KENAPA ADA ───────────────────────────────────────────────────────
 *
 * Dulu "mode demo" berarti: kalau `SUPABASE_SERVICE_KEY` tidak ada, seluruh
 * sistem memakai salinan menu/meja/pesanan yang menempel di
 * `app/lib/order/demo.ts`. Itu punya dua cacat sekaligus:
 *
 *   1. Situs tampak normal walau database tidak dipakai sama sekali —
 *      pemilik mengira semuanya jalan.
 *   2. Tidak ada cara mematikan/menyalakannya; ia menyala sendiri hanya
 *      karena satu env kosong.
 *
 * Pemilik ingin semua data masuk database. Jadi "contoh" juga harus begitu:
 * satu baris `mode_contoh` = on/off, dibaca dari database, bisa diubah dari
 * /order/admin tanpa deploy.
 *
 * ── APA YANG DIBERIKAN MODE INI ──────────────────────────────────────
 *
 * Hanya `atribut bersifat mengajar` yang boleh tidak ada di database:
 * pesanan yang tidak tersimpan (tamu bisa mencoba alur tanpa mengotori
 * data sungguhan), dan tagihan/panggilan yang tidak pernah sampai ke kasir.
 *
 * Menu, meja, dan venue TETAP dari database. Mode contoh tidak pernah
 * mengarang menu.
 */

import { db, PESAN_ENV_KOSONG, punyaEnvBaca } from "./db";

/** Batas waktu: mode contoh yang lupa dimatikan tidak boleh jalan diam-diam. */
export type ModeContoh = {
  aktif: boolean;
  /**
   * true bila ADMIN sengaja menyalakannya. false bila aktif hanya karena
   * kunci server belum dipasang (keadaan darurat, bukan pilihan).
   */
  disengaja: boolean;
  /**
   * Apa yang terjadi pada data bila mode ini aktif:
   *   "perangkat" — disimpan di memori Worker, hilang saat Worker restart
   *   "database" — sungguhan
   */
  penyimpanan: "perangkat" | "database";
};

let singgahan: { nilai: boolean; pada: number } | null = null;
const UMUR_SINGGAHAN_MS = 5_000;

/**
 * Apakah mode contoh menyala?
 *
 * Dua sebab, dan keduanya HARUS dibedakan di layar:
 *
 *   a. `mode_contoh` = on  → admin memilihnya. Bisa dimatikan kapan saja.
 *   b. kunci server tidak ada → tidak ada cara menyimpan apa pun. Ini bukan
 *      pilihan; ini salah konfigurasi, dan halaman harus mengatakannya.
 *
 * Singgahan 5 detik: fungsi ini dipanggil setiap request halaman portal,
 * dan satu kueri kecil per request ke paket gratis adalah pemborosan yang
 * tidak perlu. 5 detik cukup cepat untuk tombol di /order/admin.
 */
export async function statusModeContoh(punyaKunciServer: boolean): Promise<ModeContoh> {
  const disengaja = await bacaSaklar();
  const aktif = disengaja || !punyaKunciServer;

  return {
    aktif,
    disengaja,
    penyimpanan: punyaKunciServer && !disengaja ? "database" : "perangkat",
  };
}

async function bacaSaklar(): Promise<boolean> {
  const kini = Date.now();
  if (singgahan && kini - singgahan.pada < UMUR_SINGGAHAN_MS) return singgahan.nilai;

  if (!punyaEnvBaca()) {
    // Tanpa env, saklar tidak bisa dibaca. Perlakukan sebagai menyala:
    // lebih baik jujur "data tidak tersimpan" daripada menjanjikan
    // penyimpanan yang tidak mungkin terjadi.
    singgahan = { nilai: true, pada: kini };
    return true;
  }

  const r = await db<{ kunci: string; nilai: string }[]>("pengaturan", {
    q: "select=kunci,nilai&kunci=eq.mode_contoh&limit=1",
  });

  const nilai = r.ok && r.data.length > 0 && r.data[0].nilai === "on";
  singgahan = { nilai, pada: kini };
  return nilai;
}

/** Dipakai /order/admin setelah menekan tombol, supaya tidak menunggu 5 detik. */
export function lupakanSinggahan() {
  singgahan = null;
}

/**
 * Pesan yang WAJIB tampil selama mode contoh menyala.
 *
 * Dibedakan menurut sebabnya: "disengaja" berarti tombol, "tidak disengaja"
 * berarti env kurang. Salah satunya bisa diperbaiki pemilik sendiri, yang
 * lain butuh memasang kunci server — menyamakan keduanya membuat orang
 * menekan tombol yang tidak berpengaruh apa-apa.
 */
export function pesanModeContoh(m: ModeContoh): string {
  if (!m.aktif) return "";
  if (m.disengaja) {
    return (
      "Mode contoh menyala. Pesanan, tagihan, dan panggilan dari sesi ini " +
      "TIDAK tersimpan dan tidak sampai ke kasir. Menu dan meja tetap dari " +
      "database."
    );
  }
  return (
    `Mode contoh karena ${PESAN_ENV_KOSONG.replace("SUPABASE_URL dan SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY")} ` +
    "Tanpa kunci server, tidak ada yang bisa disimpan. Halaman ini tetap bisa " +
    "dijelajahi; pesanan tidak akan sampai ke kasir."
  );
}
