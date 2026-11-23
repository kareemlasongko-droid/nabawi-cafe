import type { Metadata } from "next";
import Image from "next/image";
import { BackLink } from "../../components/back-link";
import {
  IkonBiskuit,
  IkonCangkir,
  IkonEsKrim,
  IkonGelas,
  IkonMangkuk,
  IkonMilkshake,
} from "../components/menu/IkonKategori";
import { SaringanKategori } from "../components/menu/SaringanKategori";
import { Navbar } from "../components/Navbar";
import { ambilMenu } from "../lib/order/data";
import { MENU_CONTOH } from "../lib/order/demo";
import { bacaPilihan, urutkanMenu } from "../lib/order/aturan";
import { aturanSaring, kelompokkanMenu } from "../lib/order/saring";
import type { KategoriMenu, Menu } from "../lib/order/tipe";

/**
 * /menu — daftar menu lengkap, TANPA halaman detail.
 *
 * Diminta: "tampilannya tidak jauh dari tampilan virtual tour, hanya saja
 * tidak ada halaman detail menunya, tapi di daftar menu sudah mencakup
 * informasi detailnya."
 *
 * TIGA PERUBAHAN DARI VERSI PERTAMA (permintaan pemilik)
 *
 *   1. Warna mengikuti tombol "Menu Kami" di /fitur — terracotta
 *      `clay-600`, bukan hijau `forest-900` seperti /tour. Alasannya bukan
 *      selera: tombol itulah pintu masuk halaman ini, jadi halaman yang
 *      dibukanya harus terasa satu benda dengan tombolnya.
 *   2. Ada saringan kategori, bentuknya mengikuti /order: satu baris pil
 *      yang menempel saat digulir.
 *   3. slot gambar di kiri kartu berisi GAMBAR (foto bila ada, ikon garis
 *      bila tidak) — bukan lagi keping harga.
 *
 * Yang tetap dibuang dari /tour: peta mini, chevron ">" (tak ada halaman
 * detail), nomor urut 01–126, badge durasi, dan footer.
 */

export const metadata: Metadata = {
  title: "Menu Kami — Nabawi Cafe & Resto",
  description:
    "Daftar lengkap menu Nabawi Cafe & Resto: makanan utama, camilan & pastry, kopi, non-kopi, cheese & milkshake, serta jus & dessert — lengkap dengan harga dan pilihan rasanya.",
};

/*
  Halaman ini DINAMIS, dan itu disengaja.

  Ekspor `revalidate` sempat ditulis lalu dibuang setelah `next build`
  tetap menandai rutenya ƒ: db() di lib/order/db.ts memakai
  `cache: "no-store"` untuk SEMUA permintaan. Menu yang tertinggal di
  cache berarti tamu memesan hidangan yang sudah habis dan dapur
  menolaknya — untuk kafe, "daftar selalu benar" lebih berharga daripada
  ~150 ms.
*/

/*
  Foto latar dilebur ke WARNA clay-600, bukan diganti gambar lain.

  Tombol "Menu Kami" di /fitur memakai `bg-clay-600` polos — di sana
  terracotta itu tidak punya tekstur. Kalau halaman ini memakai bidang
  clay polos juga, 126 kartu akan mengambang di atas oranye rata dan
  terasa seperti templat. Foto yang dilebur memberi tekstur tanpa
  mengubah warnanya: `mix-blend-luminosity` mengambil TERANG-GELAP foto
  dan membuang warnanya, jadi hue tetap clay-600, hanya bergradasi.
  Opasitas 0.22 pada lapisan blend + gradasi clay di atas-bawah.
*/
const LATAR = "/images/fitur-bg.jpg";

/**
 * Palet halaman — SEMUA diturunkan dari clay-600 #b4502c (warna tombol).
 *
 * Latar halaman sekarang HIJAU, sama dengan /tour (foto 100% + forest-950/45
 * + gradasi 55→0→80). Yang terrakota adalah KARTUNYA. Dua konteks kontras:
 *
 * (1) DI ATAS KARTU clay-600 #b4502c:
 *       cream-50         5.01 : 1  ← L O L O S
 *       cream-50/95      4.67 : 1  ← L O L O S (dipakai teks sekunder)
 *       cream-100        4.61 : 1  ← L O L O S
 *       cream-50/90      4.39 : 1  ← GAGAL
 *       cream-50/80      3.79 : 1  ← GAGAL
 *       cream-50/70      3.27 : 1  ← GAGAL
 *     Artinya: di atas terrakota hanya boleh ada SATU tingkat peredupan,
 *     dan itu pun cuma 5%. Hierarki di kartu dibawa ukuran huruf.
 *
 * (2) DI ATAS LATAR HIJAU (foto median 206 → setelah dua lapisan ≈ 66,77,71):
 *       white/80         6.33 : 1  ← ringkasan kepala
 *       white/85         6.91 : 1  ← label kepala
 *     Lebih lega daripada terrakota, dan itu sebabnya kepala memakai
 *     putih seperti /tour tanpa perlu dinaikkan opasitasnya.
 *
 * Kartu terrakota di atas hijau gelap hanya berdiri sendiri lewat RING-nya
 * (cream-50/45 = 2.62:1 terhadap latar); bayangan nyaris tak terlihat di
 * latar gelap. Itu bukan pilihan estetis, itu satu-satunya cara tepi kartu
 * tetap terbaca.
 */
const GAYA = {
  /**
   * Kartu: TERRAKOTA `clay-600` — warna yang sama dengan tombol "Menu Kami"
   * di /fitur, diminta pemilik.
   *
   * Ring krem 45% bukan hiasan: kartu terrakota di atas latar hijau hanya
   * berdiri sendiri lewat tepinya. Terukur terhadap latar (100,100,76):
   *   ring cream-50/25 → 1.85:1  (terlalu tipis, tepi menghilang)
   *   ring cream-50/45 → 2.62:1  (dipakai)
   * Bayangan tetap ada, tetapi di atas latar gelap ia nyaris tak terlihat —
   * ring-lah yang menyatakan batas kartu.
   */
  kartu:
    "bg-clay-600 ring-1 ring-inset ring-cream-50/45 shadow-[0_12px_24px_-14px_rgba(20,35,26,0.75)]",
  /** Judul menu: cream-50 di clay-600 — 5.01:1. */
  teks: "text-cream-50",
  /**
   * Teks sekunder: `cream-50/95` = 4.67:1.
   *
   * Opasitas lain SEMUA gagal di atas clay-600 (cream-50/90 = 4.39,
   * /80 = 3.79, /70 = 3.27). Jadi teks sekunder di sini hanya boleh
   * diredupkan 5% — pengurangan yang nyaris tak terlihat. Hierarki
   * dibawa ukuran huruf, bukan transparansi; itu batas keras terrakota.
   */
  redup: "text-cream-50/95",
} as const;

const angka = new Intl.NumberFormat("id-ID");

/**
 * Gambar untuk menu yang belum punya foto: ikon GARIS per kategori.
 *
 * Kenapa ikon garis dan bukan blob/gradasi/ilustrasi berwarna: seluruh
 * ikon di situs ini bergaya garis 1.6px bersudut membulat. Ilustrasi
 * makanan berwarna akan jadi satu-satunya benda di halaman yang tidak
 * mengikuti bahasa visual itu — dan itulah bentuk AI slop yang paling
 * mudah dikenali.
 *
 * Pemetaan mengikuti nama kategori yang ADA di database, bukan karangan:
 *   1 Makanan Utama       → mangkuk
 *   2 Camilan & Pastry    → biskuit
 *   3 Kopi                → cangkir
 *   4 Non-Kopi            → gelas bersedotan
 *   5 Cheese & Milkshake  → milkshake
 *   6 Jus & Dessert       → es krim
 * Nilai lain (kategori baru, atau menu yatim ber-id -1) jatuh ke mangkuk
 * — ikon paling umum, bukan kotak kosong.
 */
function ikonKategori(kategoriId: number | null) {
  switch (kategoriId) {
    case 2:
      return IkonBiskuit;
    case 3:
      return IkonCangkir;
    case 4:
      return IkonGelas;
    case 5:
      return IkonMilkshake;
    case 6:
      return IkonEsKrim;
    default:
      return IkonMangkuk;
  }
}

export default async function MenuPage() {
  const res = await ambilMenu();

  /*
    CADANGAN SAAT DATABASE TIDAK TERBACA: MENU_CONTOH.

    Saya sempat menulis di sini bahwa MENU_CONTOH berisi "hidangan
    karangan", lalu memasang layar galat + pita "Mode demo" untuk
    menutupinya. Setelah menghitung isinya, anggapan itu SALAH:
    MENU_CONTOH adalah salinan menu Nabawi yang sebenarnya — 126 baris,
    nama dan harga yang sama dengan database, termasuk 4 menu berpilihan.
    Menu karangan (Harira, Tajine, Couscous) sudah lama dibuang dari
    berkas ini.

    Jadi yang benar: tampilkan salinan itu apa adanya, TANPA pita
    peringatan. Peringatan "ini bukan menu kami" justru bohong, dan
    menyembunyikan seluruh menu karena satu kueri gagal membuat tamu
    tidak bisa melihat apa pun padahal kami punya datanya.

    Yang perlu disadari: salinan ini bisa BASI. Kalau harga naik atau
    sebuah hidangan habis setelah demo.ts disalin, tamu bisa membaca
    harga lama. /order mengambil sikap yang sama.
  */
  const data = res.ok ? res.data : MENU_CONTOH;
  const kelompok = kelompokkanMenu(data.kategori as KategoriMenu[], data.menu as Menu[]);

  /* Jumlah HANYA menu yang tersedia. Menyebut "126 menu" padahal 8 sedang
     habis akan terasa seperti janji yang tidak ditepati. */
  const tersedia = data.menu.filter((m) => m.tersedia).length;
  const totalKategori = kelompok.length;

  return (
    <main className="flex min-h-dvh justify-center bg-forest-950">
      {/* Kanvas 440px di tengah — sama seperti /tour dan beranda. */}
      {/*
          `overflow-clip` SENGAJA TIDAK dipakai di sini.
          Ia memang rapi untuk memotong latar di tepi kanvas, tetapi
          `overflow` apa pun pada leluhur adalah salah satu penyebab
          paling sering `position: sticky` berhenti bekerja — dan baris
          pil kategori WAJIB menempel. Latar sudah dibatasi `max-w` +
          `mx-auto`, jadi tidak ada yang perlu dipotong.
        */}
        <div className="relative isolate w-full max-w-[27.5rem] bg-forest-900 shadow-[0_0_100px_-30px_rgba(0,0,0,0.9)]">
        {/* Latar: terracotta bertekstur. `fixed` = jendela yang diam saat
            isi bergeser, sama seperti /tour. */}
        <div className="fixed inset-0 mx-auto w-full max-w-[27.5rem]">
          {/*
            LATAR DISAMAKAN DENGAN /tour — nilai per nilai, diminta pemilik.
              foto             : 100% (tanpa opacity, tanpa mix-blend)
              lapisan rata     : forest-950/45
              gradasi          : forest-950/55 → transparan → forest-950/80
            Sebelumnya /menu memakai foto 22% + blend luminosity di atas
            terrakota; keduanya dibuang. Kalau ada satu angka yang berbeda,
            dua halaman ini akan terlihat dari dua situs berbeda.
          */}
          <Image
            src={LATAR}
            alt=""
            fill
            priority
            sizes="(max-width: 440px) 100vw, 440px"
            className="object-cover object-center"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-forest-950/45" />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-forest-950/55 via-transparent to-forest-950/80"
          />
        </div>

        <div className="relative z-10 flex min-h-dvh flex-col">
          {/*
            Navbar DENGAN `gradient` — disamakan dengan /tour (diminta).

            Riwayatnya berbelit dan perlu dicatat supaya tidak diulang:
              1. dimatikan — "gradasi hijau di atas terrakota jadi pita
                 kotor";
              2. dihidupkan dengan hijau bawaan /tour;
              3. diganti terrakota (prop `gelap`, karena latar halaman
                 saat itu terrakota);
              4. sekarang kembali ke hijau bawaan — karena latarnya SUDAH
                 disamakan dengan /tour. Prop `gelap` tidak dipakai lagi
                 di halaman ini, tetapi tetap ada di Navbar untuk halaman
                 lain yang mungkin memakai latar berbeda.
            Pelajarannya: warna gradasi ini bukan pilihan bebas — ia harus
            mengikuti warna latar yang ada di belakangnya.
          */}
          <Navbar sticky gradient />

          {/*
            Kepala halaman — DISAMAKAN dengan /tour, nilai per nilai:
              px-5 · pt-[0.75rem] · pb-[0.875rem] · text-center
              BackLink      : mb-[0.625rem], rata kiri sendirian
              label kecil   : 0.625rem / medium / tracking 0.16em / white-75
              h1            : mt-[0.25rem] / 1.375rem / 1.1 / -0.01em / shadow
              ringkasan     : mx-auto / mt-[0.375rem] / max-w 19rem /
                              0.6875rem / 1.5 / white-80
            Sebelumnya milik saya: ptlebih kecil, label lebih tebal, dan
            ringkasan DUA baris. Dua baris itu bukan pilihan gaya — ia
            akibat kontras: hijau tua hanya 3.21:1 di atas terrakota
            (gagal), jadi "{n} pilihan" dan "ketuk kategori" tidak bisa
            dibedakan dengan warna seperti di /tour.

            SEKARANG keduanya tetap satu paragraf, dipisah titik tengah
            seperti /tour, dan dibedakan dengan OPASITAS yang terukur
            lolos: white-90 di atas clay-700 (pita tempat kepala berada)
            = 5.81:1. Bagian petunjuk diturunkan ke white-70 → 3.85:1,
            cukup untuk teks 11px yang bukan informasi kritis, sementara
            angkanya tetap penuh.
          */}
          <header className="px-5 pb-[0.875rem] pt-[0.75rem] text-center">
            {/* Satu-satunya tombol kembali (diminta: "single back saja").
                Di luar navbar, rata kiri sendirian, jadi judul di bawahnya
                tetap simetris. Sama seperti /tour. */}
            <div className="mb-[0.625rem] flex justify-start">
              <BackLink href="/fitur" label="Kembali" aria="Kembali ke halaman Fitur" />
            </div>
            {/*
              /tour memakai white/75 di sini. Nilainya TIDAK disalin apa
              adanya karena diukur di latar halaman ini (159,69,35):
              white/75 = 4.26:1 — gagal untuk teks 10px. white/85 = 5.0:1.
              Selisih 10% opasitas tidak terlihat, tapi bedanya antara
              lolos dan tidak.
            */}
            <p className="text-[0.625rem] font-medium leading-none tracking-[0.16em] text-white/85">
              DAFTAR LENGKAP
            </p>
            <h1 className="mt-[0.25rem] text-[1.375rem] font-extrabold leading-[1.1] tracking-[-0.01em] text-[#ffffff] [text-shadow:0_1px_10px_rgba(20,35,26,0.55)]">
              Menu Kami
            </h1>
            {/*
              DUA paragraf dengan gaya yang SAMA PERSIS, bukan satu
              paragraf dengan dua warna.

              Diukur di latar kepala (159,69,35): white/80 = 4.64:1 (lolos),
              white/70 = 3.92:1 (gagal). Jadi petunjuk tidak boleh
              diredupkan — ia harus sekuat baris pertama. Dua <p> tanpa
              margin bawaan menumpuk persis seperti satu paragraf yang
              membungkus, jadi hasil matanya sama dengan /tour, sementara
              teksnya tetap dua baris terpisah seperti yang diminta.
            */}
            <p className="mx-auto mt-[0.375rem] max-w-[19rem] text-[0.6875rem] leading-[1.5] text-white/80">
              {tersedia} pilihan dari {totalKategori} kategori
            </p>
            <p className="mx-auto max-w-[19rem] text-[0.6875rem] leading-[1.5] text-white/80">
              Ketuk kategori untuk menyaring
            </p>
          </header>

          {/*
            Saringan di LUAR <header sejak awal: ia menempel sendiri saat
            digulir, dan menaruhnya di dalam kepala yang tidak sticky akan
            membuatnya ikut terangkat.
          */}
          {/*
            Aturan tampil-per-kategori ditulis dari DATA, bukan disalin ke
            globals.css. Kalau pemilik menambah kategori ke-7, pilnya dan
            aturannya lahir bersamaan — tidak ada kemungkinan pil yang
            menyembunyikan seluruh daftar.
          */}
          <style id="menu-aturan-saring">{aturanSaring(kelompok.map((g) => g.kategori))}</style>
          <SaringanKategori kategori={data.kategori as KategoriMenu[]} />

          {/*
            `data-kat` ada untuk saringan di app/globals.css: pil kategori
            menulis `data-saring` ke <body>, dan aturan CSS menyembunyikan
            setiap [data-kat] yang tidak cocok. Tidak ada kartu yang
            dirender ulang — React tidak menyentuh daftar ini sama sekali.
          */}
          {kelompok.map((g) => (
            <section
              key={g.kategori.id}
              id={`kategori-${g.kategori.id}`}
              data-kat={g.kategori.id}
              className="px-5 pb-[1.25rem]"
            >
              <div className="mb-[0.5rem] flex items-center gap-[0.375rem]">
                <h2 className="text-[0.8125rem] font-extrabold uppercase tracking-[0.14em] text-cream-50">
                  {g.kategori.nama}
                </h2>
                <span className="rounded-full bg-forest-950/25 px-[0.4375rem] py-[0.125rem] text-[0.5625rem] font-bold tabular-nums text-cream-50">
                  {g.menu.length}
                </span>
              </div>

              <ul className="grid grid-cols-2 gap-[0.5rem]">
                {g.menu.map((m) => {
                  const pilihan = bacaPilihan(m.pilihan);
                  const Ikon = ikonKategori(m.kategori_id);
                  return (
                    <li
                      key={m.id}
                      className="flex flex-col overflow-hidden rounded-[1rem] [contain-intrinsic-size:auto_210px] [content-visibility:auto]"
                    >
                      {/*
                        Kartu TIDAK bisa diklik: tidak ada halaman detail.
                        Karena itu <article>, bukan <a>.
                      */}
                      <article className={["flex h-full flex-col rounded-[1rem]", GAYA.kartu, m.tersedia ? "" : "opacity-75"].join(" ")}>
                        {/*
                          Bagian GAMBAR.
                          Sumber: `foto_url` bila ada. Hari ini 0 dari 126
                          menu punya foto, jadi praktisnya ikon garis
                          kategori — TAPI urutannya ditulis begini supaya
                          begitu pemilik mengunggah foto, foto langsung
                          terpakai tanpa mengubah kode.
                        */}
                        <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-[1rem] bg-forest-950/10">
                          {m.foto_url ? (
                            /*
                              Foto dari Supabase Storage lewat optimasi
                              Next, bukan <img> mentah. Kartu hanya 176px
                              lebar (2 kolom di kanvas 440px), jadi
                              `sizes` menyatakan itu dan Next mengirim
                              varian 1x/2x — bukan foto 1200px untuk
                              kotak sebesar prangko. Foto menu berasal
                              dari domain Supabase, jadi domainnya harus
                              terdaftar di next.config (lihat pencatatan
                              di komentar bawah).
                            */
                            <Image
                              src={m.foto_url}
                              alt=""
                              fill
                              sizes="(max-width: 440px) 45vw, 198px"
                              className="object-cover"
                            />
                          ) : (
                            <div aria-hidden="true" className="grid size-full place-items-center bg-cream-50/10">
                              <Ikon className="size-[1.75rem] text-cream-50/85" />
                            </div>
                          )}
                          {!m.tersedia && (
                            <p className="absolute bottom-[0.25rem] left-[0.25rem] rounded-full bg-forest-950/85 px-[0.4375rem] py-[0.1875rem] text-[0.5rem] font-bold uppercase tracking-[0.08em] text-cream-50">
                              Habis
                            </p>
                          )}
                        </div>

                        {/*
                          Padding teks 12px kiri-kanan (sebelumnya 8px).
                          Di layar 360px kartu hanya ~156px lebar, jadi 8px
                          membuat nama menu menempel ke tepi kartu —
                          terlihat seperti teks yang meluber, bukan teks
                          yang diletakkan. 12px menyisakan ~132px untuk
                          teks: cukup untuk harga terpanjang (Rp145.000
                          ≈ 70px pada 14px bold).
                        */}
                        <div className="flex min-w-0 flex-1 flex-col px-[0.75rem] pb-[0.625rem] pt-[0.625rem]">
                          <h3 className={`text-[0.8125rem] font-extrabold leading-[1.2] ${GAYA.teks}`}>
                            {m.rekomendasi === true && (
                              <>
                                <span aria-hidden="true" className="mr-[0.1875rem] text-cream-50">
                                  ★
                                </span>
                                <span className="sr-only">Rekomendasi: </span>
                              </>
                            )}
                            {m.nama}
                          </h3>

                          {m.deskripsi?.trim() && (
                            <p className={`mt-[0.25rem] text-[0.625rem] leading-[1.35] ${GAYA.redup} ${pilihan.length > 0 ? "line-clamp-2" : "line-clamp-3"}`}>
                              {m.deskripsi.trim()}
                            </p>
                          )}

                          <BarisPilihan pilihan={pilihan} />

                          <p className="mt-auto pt-[0.5rem] text-[0.875rem] font-extrabold leading-none tabular-nums text-cream-50">
                            {angka.format(m.harga)}
                          </p>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

/** Satu baris pilihan: "Sambal Matah · BBQ · Salted Egg +5.000". */
function BarisPilihan({
  pilihan,
}: {
  pilihan: { nama: string; tambah: number }[];
}) {
  if (pilihan.length === 0) return null;
  return (
    <p className={`mt-[0.25rem] flex flex-wrap items-baseline gap-x-[0.25rem] gap-y-[0.0625rem] text-[0.5625rem] leading-[1.4] ${GAYA.redup}`}>
      {pilihan.map((p, i) => (
        <span key={p.nama} className="whitespace-nowrap">
          {i > 0 && (
            <span aria-hidden="true" className="mr-[0.25rem] text-cream-50/60">
              ·
            </span>
          )}
          {p.nama}
          {p.tambah > 0 && (
            <span className="ml-[0.125rem] font-bold text-cream-50">+{angka.format(p.tambah)}</span>
          )}
        </span>
      ))}
    </p>
  );
}
