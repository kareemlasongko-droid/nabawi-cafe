"use client";

/**
 * Bilah peringatan saat data portal staf tidak bisa diperbarui.
 *
 * ── MASALAH YANG DIPERBAIKI ───────────────────────────────────────────
 *
 * Dapur dan pelayan sebelumnya menyimpan pesan kegagalan di sebuah state
 * dan menampilkannya HANYA sebagai keterangan kecil di samping logo —
 * di ponsel bahkan disingkat jadi satu karakter "!".
 *
 * Dua akibatnya, dan keduanya nyata di ruang operasional:
 *
 *   1. STAF TIDAK TAHU LAYARNYA BEKU. Papan tiket yang berhenti
 *      memperbarui diri terlihat persis seperti papan yang tidak ada
 *      pesanan baru. Dapur terus memasak dari papan usang; pesanan baru
 *      tidak pernah muncul, dan tamu menunggu hidangan yang tidak pernah
 *      mulai dimasak. Ini kegagalan yang tidak berbunyi.
 *   2. TIDAK ADA YANG BISA DIKERJAKAN. Pesannya menjelaskan keadaan tapi
 *      tidak menawarkan tindakan. Satu-satunya cara memulihkan adalah
 *      menunggu — sementara polling 3 detik terus menembak server yang
 *      sedang bermasalah.
 *
 * ── BENTUKNYA ────────────────────────────────────────────────────────
 *
 * Bilah penuh di bawah kepala, warna sela (oranye) dengan teks gelap —
 * lolos kontras AA, dan berbeda dari merah "habis" supaya tidak tertukar
 * dengan status bahan. Isinya: apa yang terjadi, umur data terakhir, dan
 * tombol "Muat ulang" 44px.
 *
 * `role="status"` + `aria-live="polite"`: pembaca layar menyebutkannya
 * tanpa memotong apa pun yang sedang dibacakan.
 */
export function BilahKoneksi({
  galat,
  tema,
  sejakBerhasil,
  onMuatUlang,
  sibuk,
}: {
  /** Pesan kegagalan; string kosong berarti tidak ada masalah. */
  galat: string;
  /** "gelap" untuk dapur (latar forest-950), "terang" untuk pelayan. */
  tema: "gelap" | "terang";
  /**
   * Detik sejak pembaruan terakhir yang berhasil. `null` bila belum
   * pernah berhasil sejak halaman dibuka.
   *
   * Angka ini yang membuat peringatan terasa mendesak: "data 40 detik
   * lalu" jauh lebih menggerakkan daripada "koneksi terputus".
   */
  sejakBerhasil: number | null;
  onMuatUlang: () => void;
  sibuk: boolean;
}) {
  if (!galat) return null;

  const umur =
    sejakBerhasil === null
      ? "Belum pernah berhasil memuat sejak halaman dibuka."
      : sejakBerhasil < 5
        ? "Data terakhir baru saja diperbarui."
        : sejakBerhasil < 60
          ? `Data terakhir ${sejakBerhasil} detik lalu.`
          : `Data terakhir ${Math.floor(sejakBerhasil / 60)} menit lalu.`;

  const gelap = tema === "gelap";

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "border-b",
        gelap
          ? "border-sela-500/40 bg-sela-500/15 text-cream-50"
          : "border-sela-200 bg-sela-50 text-sela-800",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-[100rem] items-center gap-2 px-2 py-2 sm:px-6">
        <IkonPutus className={gelap ? "size-4 shrink-0 text-sela-500" : "size-4 shrink-0 text-sela-700"} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-extrabold leading-snug">
            Layar ini berhenti diperbarui
          </p>
          {/*
            Pesan asli dari server + umur data. Pesan asli tetap
            ditampilkan karena ia membedakan "koneksi terputus" dari "env
            belum dipasang" — dua hal yang perbaikannya berbeda jauh.
          */}
          <p
            className={[
              "text-[0.6875rem] leading-snug",
              gelap ? "text-cream-50/90" : "text-sela-800/90",
            ].join(" ")}
          >
            {galat} {umur} Jangan andalkan isi layar sampai pulih.
          </p>
        </div>
        <button
          type="button"
          onClick={onMuatUlang}
          disabled={sibuk}
          className={[
            "h-11 shrink-0 rounded-[0.5rem] px-3 text-[0.8125rem] font-extrabold transition disabled:opacity-60",
            gelap
              ? "bg-sela-500 text-forest-950 active:bg-sela-600"
              : "bg-sela-700 text-cream-50 active:bg-sela-800",
          ].join(" ")}
        >
          {sibuk ? "Memuat…" : "Muat ulang"}
        </button>
      </div>
    </div>
  );
}

function IkonPutus({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 8.5a15 15 0 0 1 6.2-3.2M15.8 5.3A15 15 0 0 1 22 8.5" />
      <path d="M5.5 12.2a10 10 0 0 1 3.2-1.6M15.3 10.6a10 10 0 0 1 3.2 1.6" />
      <path d="M9 15.6a5 5 0 0 1 6 0" />
      <circle cx="12" cy="19" r="0.9" fill="currentColor" stroke="none" />
      <path d="m3 3 18 18" />
    </svg>
  );
}
