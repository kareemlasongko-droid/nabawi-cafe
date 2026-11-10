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
  /**
   * Keterangan kecil. Dengan `sebaris`, ia diletakkan SETELAH nama dalam
   * baris yang sama (dipisah titik tengah), bukan di bawahnya.
   */
  keterangan,
  /** Sembunyikan teks, hanya logo. */
  hanyaLogo = false,
  /**
   * Semua isi dalam satu baris.
   *
   * Dipakai seluruh portal order: kepala dua baris memakan ~20px ruang
   * yang di dapur dipakai untuk satu tiket lagi, dan di portal pelanggan
   * memaksa kepala setinggi 96px. Dengan satu baris, nama kafe dan
   * keterangannya sejajar — bukan bertumpuk.
   */
  sebaris = false,
  /**
   * Sembunyikan keterangan di bawah 640px.
   * Hanya dipakai kepala portal pelanggan: di sana tombol Panggil + Bill
   * berebut ruang dengan identitas, dan keterangannya cuma mengulang angka
   * yang sudah ada di judul bagian. Portal staf TIDAK memakai ini — angka
   * antrean kasir adalah alasan layar itu dibuka.
   */
  ringkas = false,
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
  sebaris?: boolean;
  ringkas?: boolean;
  label?: string;
}) {
  const nama = tema === "gelap" ? "text-gelap-isi" : "text-tinta-900";
  const sub = tema === "gelap" ? "text-gelap-samar" : "text-tinta-500";

  return (
    <span className="flex min-w-0 items-center gap-1.5" aria-label={label}>
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
        <span className={`min-w-0 ${sebaris ? "flex items-baseline gap-1.5 whitespace-nowrap" : ""}`}>
          <span
            className={`min-w-0 truncate text-[0.9375rem] font-extrabold leading-none ${nama} ${
              sebaris ? "" : "block"
            }`}
          >
            Nabawi Cafe{" "}
            {/*
              "& Resto" dan keterangan hanya tampil mulai 640px.
              Di ponsel 390px kepala portal pelanggan hanya punya 358px dan
              tombol Panggil + Bill sudah memakan ~145px. Memaksa semuanya
              muat berarti ellipsis di tengah merek ("Nabawi Cafe & Res…")
              dan angka status yang terpotong ("0 pesanan menu…") — keduanya
              terbaca sebagai kerusakan, bukan sebagai penyesuaian.
              Yang disembunyikan pun bukan informasi hilang: jumlah antrean,
              tiket, dan menu sudah tercetak di judul bagian dan chip tepat
              di bawah kepala ini, dengan angka yang lebih besar. Nama inti
              "Nabawi Cafe" tetap utuh di semua lebar.
            */}
            <span className="hidden font-semibold opacity-60 sm:inline">&amp; Resto</span>
          </span>
          {keterangan && (
            <span
              title={keterangan}
              className={`min-w-0 truncate text-[0.6875rem] leading-none ${sub} ${
                sebaris ? (ringkas ? "hidden sm:block" : "") : "mt-0.5 block"
              }`}
            >
              {sebaris && (
                <span aria-hidden="true" className="mr-1.5 opacity-50">
                  ·
                </span>
              )}
              {keterangan}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
