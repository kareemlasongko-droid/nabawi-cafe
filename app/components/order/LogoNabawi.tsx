/**
 * Identitas Nabawi Cafe untuk kepala portal order.
 *
 * KENAPA SATU KOMPONEN, BUKAN DITULIS ULANG DI TIAP PORTAL
 * Kelima portal (pelanggan, kasir, dapur, pelayan, admin) punya kepala yang
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
 *
 * ATURAN SATU BARIS
 * Nama, kategori layar, dan keterangan tidak pernah bertumpuk dan tidak
 * pernah dipisah garis vertikal. Semuanya sebaris, dipisah titik tengah
 * yang sengaja tipis. Garis pemisah tegak dulu dipakai untuk memisahkan
 * "identitas" dari "peran"; hasilnya justru terbaca sebagai dua kolom yang
 * berebut tempat di ponsel — persis yang dikeluhkan.
 */
import Image from "next/image";
import type { ReactNode } from "react";

export function LogoNabawi({
  /** "terang" untuk latar putih/krem, "gelap" untuk kepala dapur. */
  tema = "terang",
  /** Ukuran kotak logo dalam px. Teks menyesuaikan sendiri. */
  ukuran = 30,
  /**
   * Samakan tinggi logo dengan kontrol di sebelahnya (tombol 40px).
   * Di kepala portal pelanggan logo, kotak meja, dan dua tombol berada di
   * satu garis; tiga tinggi berbeda (20, 28, 40) terbaca sebagai tiga
   * elemen yang tidak sengaja disejajarkan — bukan sebagai satu bilah.
   * Di portal staf tidak dipakai: kepala staf lebih tinggi dari isinya.
   */
  setinggiKontrol = false,
  /**
   * Keterangan kecil (jumlah antrean, tiket, menu). Selalu diletakkan
   * SETELAH nama layar dalam baris yang sama, dipisah titik tengah.
   */
  keterangan,
  /**
   * Nama layar: "Kasir", "Dapur & Bar", "Pelayan", "Admin menu".
   * Boleh berupa node bila labelnya perlu dipendekkan di ponsel.
   */
  layar,
  /**
   * Versi pendek `keterangan` untuk ponsel — satu angka, mis. "0" atau "12".
   * Bila kosong, keterangan disembunyikan di ponsel pada mode `ringkas`.
   */
  keteranganPonsel,
  /** Sembunyikan teks, hanya logo. */
  hanyaLogo = false,
  /**
   * Sembunyikan "& Resto" dan keterangan di bawah 640px; hanya
   * "Nabawi Cafe" + nama layar yang tersisa.
   *
   * Dipakai kepala portal pelanggan saja. Di sana satu baris harus memuat
   * kotak meja + identitas + dua tombol sekaligus; di 360px sisa untuk teks
   * cuma 129px, sedangkan "Nabawi Cafe" sendiri sudah 95px. Tombol Panggil
   * dan Bill tidak boleh terpotong — itu fitur, bukan hiasan.
   */
  ringkas = false,
  /**
   * Nama untuk pembaca layar saat teksnya disembunyikan.
   *
   * Hanya dipakai bila `hanyaLogo` aktif: teks "Nabawi Cafe" yang terlihat
   * sudah dibaca sendiri oleh pembaca layar, jadi memberi `aria-label` pada
   * pembungkus yang sama akan mengumumkan merek dua kali.
   */
  label,
}: {
  tema?: "terang" | "gelap";
  ukuran?: number;
  setinggiKontrol?: boolean;
  keterangan?: string;
  layar?: ReactNode;
  keteranganPonsel?: string;
  hanyaLogo?: boolean;
  ringkas?: boolean;
  label?: string;
}) {
  const nama = tema === "gelap" ? "text-gelap-isi" : "text-tinta-900";
  const sub = tema === "gelap" ? "text-gelap-samar" : "text-tinta-500";

  return (
    <span className="flex min-w-0 items-center gap-2" aria-label={hanyaLogo ? label : undefined}>
      {/*
        Cincin tipis di sekitar logo: logo adalah PNG persegi dengan latar
        putih. Di kepala dapur yang gelap, sudut putihnya akan terlihat
        sebagai kotak terang — cincin membuat bentuknya dibaca sebagai
        "logo bundar", bukan sebagai gambar yang salah tempat.
      */}
      {/*
        `setinggiKontrol`: logo dibungkus kotak setinggi tombol (40px) dan
        diratakan tengah. Yang bertambah tinggi adalah kotaknya, bukan
        gambarnya — logo 28px yang diperbesar sampai 40px kehilangan
        ketajaman cincinnya, sedangkan kotak kosong di sekelilingnya tidak
        mengubah apa pun selain garis dasar baris.
      */}
      <span
        className={setinggiKontrol ? "flex h-10 shrink-0 items-center" : "flex shrink-0"}
      >
        <Image
          src="/images/logo-nabawi.png"
          alt={hanyaLogo ? (label ?? "Nabawi Cafe & Resto") : ""}
          width={100}
          height={100}
          className="shrink-0 rounded-full ring-1 ring-black/5"
          style={{ width: ukuran, height: ukuran }}
        />
      </span>
      {!hanyaLogo && (
        <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
          <span
            className={`shrink-0 text-[0.9375rem] font-extrabold leading-none ${nama}`}
          >
            Nabawi Cafe{" "}
            {/*
              "& Resto" hanya mulai 640px. Di ponsel ia memakan 59px yang
              dibutuhkan tombol; memaksanya muat berarti "Nabawi Cafe & Res…"
              — ellipsis di tengah merek terbaca sebagai kerusakan.
            */}
            <span className="hidden font-semibold opacity-60 sm:inline">&amp; Resto</span>
          </span>

          {layar && (
            <>
              <span
                aria-hidden="true"
                className={`hidden text-[0.6875rem] leading-none opacity-40 sm:inline ${sub}`}
              >
                ·
              </span>
              {/*
                Nama layar SELALU tampil, di lebar apa pun. Ia yang
                membedakan tablet kasir dari tablet dapur, dan hanya butuh
                37-48px — jauh lebih murah daripada "Nabawi Cafe" yang
                perlu 95px. Yang mengalah di ponsel adalah keterangan.
              */}
              <span className={`shrink-0 text-[0.9375rem] font-extrabold leading-none ${nama}`}>
                {layar}
              </span>
            </>
          )}

          {keterangan && (
            <>
              <span
                aria-hidden="true"
                className={`hidden text-[0.6875rem] leading-none opacity-40 sm:inline ${sub}`}
              >
                ·
              </span>
              {/*
                Keterangan menyusut dalam dua langkah, bukan hilang sekaligus:
                  - ponsel (<640px): satu angka saja (`keteranganPonsel`),
                    karena tiga angka sekaligus butuh 241px di portal kasir;
                  - tablet ke atas: kalimat penuh.
                Di kedua lebar ia yang mengalah lebih dulu (`truncate`),
                bukan nama kafe: jumlah pesanan sudah tercetak besar di judul
                bagian, sedangkan merek hanya muncul di sini.
              */}
              <span
                title={keterangan}
                className={`min-w-0 truncate text-[0.6875rem] leading-none ${sub} ${
                  ringkas ? "hidden sm:inline" : ""
                }`}
              >
                <span className="sm:hidden">{keteranganPonsel ?? keterangan}</span>
                <span className="hidden sm:inline">{keterangan}</span>
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
