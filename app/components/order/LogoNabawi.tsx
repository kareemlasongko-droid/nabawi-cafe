/**
 * Identitas Nabawi Cafe untuk kepala portal order.
 *
 * KENAPA SATU KOMPONEN, BUKAN DITULIS ULANG DI TIAP PORTAL
 * Keempat portal (pelanggan, kasir, pelayan, dapur) punya kepala yang
 * berbeda bentuknya karena dipakai dengan cara berbeda. Yang harus SAMA
 * adalah identitasnya: logo, nama, ukuran, dan jarak. Kalau masing-masing
 * menyalin tiga baris JSX, salah satunya pasti akan tertinggal saat logo
 * diganti — dan kejadian itu tidak akan ketahuan sampai ada yang menyadari
 * satu layar masih memakai logo lama.
 *
 * KENAPA next/image, BUKAN <img>
 * Logonya PNG 100x100 (16 KB). next/image mengubahnya ke WebP/AVIF dengan
 * ukuran yang diminta, jadi di layar 2x pun yang diunduh bukan 100x100
 * mentah untuk tiap portal. Dapur dibuka sepanjang hari di tablet — gambar
 * sekecil apa pun tetap diunduh ulang tiap muat.
 *
 * `priority` sengaja TIDAK dipakai di sini: logo bukan elemen terbesar
 * (LCP) di portal mana pun, dan mendahulukannya akan menunda teks tiket
 * dapur yang justru dibutuhkan lebih dulu.
 */
import Image from "next/image";

export function LogoNabawi({
  /** "terang" untuk latar putih/krem, "gelap" untuk kepala dapur. */
  tema = "terang",
  /** Ukuran kotak logo dalam px. Teks menyesuaikan sendiri. */
  ukuran = 36,
  /** Baris kedua kecil di bawah nama. Kosongkan bila tidak perlu. */
  keterangan,
  /** Sembunyikan teks, hanya logo (dipakai di layar sangat sempit). */
  hanyaLogo = false,
  /**
   * Keterangan dibaca pembaca layar saat `hanyaLogo` aktif. Tanpa ini,
   * logo tanpa teks menjadi elemen tanpa nama.
   */
  label,
}: {
  tema?: "terang" | "gelap";
  ukuran?: number;
  keterangan?: string;
  hanyaLogo?: boolean;
  label?: string;
}) {
  const nama = tema === "gelap" ? "text-gelap-isi" : "text-tinta-900";
  const sub = tema === "gelap" ? "text-gelap-samar" : "text-tinta-500";

  return (
    <span className="flex min-w-0 items-center gap-2" aria-label={label}>
      {/*
        Cincin tipis di sekitar logo: logo adalah PNG persegi dengan latar
        putih. Di kepala dapur yang gelap, sudut putihnya akan terlihat
        sebagai kotak terang — cincin membuat bentuknya dibaca sebagai
        "logo bundar", bukan sebagai gambar yang salah tempat.
      */}
      <Image
        src="/images/logo-nabawi.png"
        alt={hanyaLogo ? (label ?? "Nabawi Cafe & Resto") : ""}
        width={100}
        height={100}
        className="shrink-0 rounded-full ring-1 ring-black/5"
        style={{ width: ukuran, height: ukuran }}
      />
      {!hanyaLogo && (
        <span className="min-w-0">
          <span
            className={`block truncate text-[0.9375rem] font-extrabold leading-none ${nama}`}
          >
            Nabawi Cafe <span className="font-semibold opacity-60">&amp; Resto</span>
          </span>
          {keterangan && (
            <span className={`mt-0.5 block truncate text-[0.6875rem] leading-tight ${sub}`}>
              {keterangan}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
