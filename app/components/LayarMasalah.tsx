import Link from "next/link";

/**
 * Layar saat data tidak bisa dibaca.
 *
 * ── KENAPA ADA ───────────────────────────────────────────────────────
 *
 * Sejak salinan data dihapus dari kode, ada keadaan baru yang HARUS punya
 * tampilan: database tidak terbaca. Sebelumnya keadaan itu ditutupi oleh
 * salinan di `demo.ts` / `MENU_CONTOH`, dan justru itu masalahnya — situs
 * tampak sehat saat environment kosong.
 *
 * ── KENAPA MEMBEDAKAN "ENV KOSONG" DAN "DATABASE GAGAL" ──────────────
 *
 * Keduanya terlihat sama dari kursi tamu, tetapi yang harus dilakukan
 * pemilik berbeda jauh:
 *
 *   env kosong     -> isi environment. Tidak ada yang perlu ditunggu.
 *   database gagal -> benar-benar gangguan. Tunggu, lalu muat ulang.
 *
 * Menyuruh orang "coba lagi nanti" untuk env yang kosong berarti menyuruh
 * menunggu selamanya. Karena itu pesannya datang dari pemanggil, bukan
 * ditulis di sini.
 *
 * ── NADA ─────────────────────────────────────────────────────────────
 *
 * Tanpa kata "error", "500", atau nama env yang panjang lebar kalau yang
 * membaca adalah tamu. Pesan teknis hanya muncul saat memang untuk pemilik.
 * Tautan kembali selalu ada supaya tidak ada jalan buntu.
 */

export function LayarMasalah({
  judul,
  pesan,
  kembaliKe = "/",
  labelKembali = "Kembali ke beranda",
  teknis,
}: {
  judul: string;
  pesan: string;
  kembaliKe?: string;
  labelKembali?: string;
  /** Baris kecil di bawah, untuk hal yang hanya berguna bagi pemilik. */
  teknis?: string;
}) {
  return (
    <main className="flex min-h-dvh justify-center bg-forest-950">
      <div className="relative isolate flex w-full max-w-[27.5rem] flex-col items-center justify-center bg-forest-900 px-6 text-center shadow-[0_0_100px_-30px_rgba(0,0,0,0.9)]">
        <div
          aria-hidden="true"
          className="mb-5 grid size-14 place-items-center rounded-full bg-cream-50/10"
        >
          {/* Ikon garis: tutup berisi tanda seru — sama bahasanya dengan
              ikon kategori di /menu, bukan emoji. */}
          <svg viewBox="0 0 24 24" className="size-6 text-cream-100" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 7.5v5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="16.2" r="1" fill="currentColor" />
          </svg>
        </div>

        <h1 className="text-[1.25rem] leading-[1.15] font-extrabold tracking-[-0.01em] text-cream-50">
          {judul}
        </h1>

        <p className="mt-3 max-w-[20rem] text-[0.8125rem] leading-[1.6] text-cream-100/85">
          {pesan}
        </p>

        {teknis && (
          <p className="mt-4 max-w-[21rem] rounded-[0.625rem] bg-forest-950/60 px-3 py-2 text-left text-[0.6875rem] leading-[1.5] text-cream-100/60">
            {teknis}
          </p>
        )}

        <Link
          href={kembaliKe}
          className="mt-7 rounded-full bg-clay-600 px-5 py-2.5 text-[0.8125rem] font-bold text-cream-50 transition active:scale-95"
        >
          {labelKembali}
        </Link>
      </div>
    </main>
  );
}
