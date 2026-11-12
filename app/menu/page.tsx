import type { Metadata } from "next";
import Image from "next/image";
import { BackLink } from "../../components/back-link";
import { Navbar } from "../components/Navbar";
import { ambilMenu } from "../lib/order/data";
import { MENU_CONTOH } from "../lib/order/demo";
import { bacaPilihan, urutkanMenu } from "../lib/order/aturan";
import type { KategoriMenu, Menu } from "../lib/order/tipe";

/**
 * /menu — daftar menu lengkap, TANPA halaman detail.
 *
 * Diminta: "tampilannya tidak jauh dari tampilan virtual tour, hanya saja
 * tidak ada halaman detail menunya, tapi di daftar menu sudah mencakup
 * informasi detailnya."
 *
 * Yang diambil dari /tour, dan yang sengaja TIDAK:
 *   diambil  : kanvas 440px di tengah, latar hijau + gambar tetap,
 *              Navbar gradient, kepala berlabel kecil, kartu hias
 *              `forest-900` bergaris krem tipis.
 *   dibuang  : peta mini (10 titik tidak punya arti untuk menu),
 *              chevron ">" (tidak ada halaman tujuan), penomoran urut
 *              01–10 (menunya 126; nomornya jadi derau, bukan penunjuk),
 *              dan badge durasi "12m" (tidak relevan).
 *
 * KENAPA SATU KARTU PER MENU, BUKAN GRID
 * Kartu tour berbentuk baris: keping visual di kiri, teks di kanan.
 * Bentuk yang sama dipakai di sini — kepingnya berisi HARGA, bukan foto,
 * karena 126 menu ini belum punya satu pun foto di database. Harga adalah
 * informasi yang paling dicari tamu, jadi ia mendapat tempat yang di tour
 * dipakai panorama.
 *
 * KENAPA TANPA JS KLIEN
 * Tidak ada pencarian, saringan, atau akordeon. Halaman ini untuk dibaca
 * dan dibagikan lewat tautan/QR. Menambah interaksi berarti menambah
 * hidrasi untuk 126 kartu — persis biaya yang sedang kita hindari di
 * portal pelanggan.
 */

export const metadata: Metadata = {
  title: "Menu Kami — Nabawi Cafe & Resto",
  description:
    "Daftar lengkap menu Nabawi Cafe & Resto: makanan utama, camilan & pastry, kopi, non-kopi, cheese & milkshake, serta jus & dessert — lengkap dengan harga dan pilihan rasanya.",
};

/*
  Halaman ini DINAMIS — dan itu bukan kelalaian.

  Saya sempat menulis `export const revalidate = 60` di sini, lalu
  membuangnya setelah `next build` menunjukkan rutenya tetap `ƒ`
  (dynamic). Penyebabnya `db()` di lib/order/db.ts memakai
  `cache: "no-store"` pada SEMUA permintaan — termasuk menu. Ekspor
  revalidate jadi hiasan yang tidak berefek; menyisakannya hanya
  menipu orang berikutnya yang membaca berkas ini.

  Kenapa tidak dipaksa statis:
  satu-satunya cara adalah memberi jalur cache khusus menu
  (`unstable_cache`) yang memotong `no-store` untuk dua kueri menu saja.
  Belum dikerjakan karena untungnya kecil dan risikonya nyata: menu yang
  tertinggal di cache akan menampilkan hidangan yang sudah HABIS sebagai
  masih bisa dipesan — tamu memesan, dapur menolak. Untuk sebuah kafe,
  "Daftar menu selalu benar" lebih berharga daripada ~150 ms.

  Kalau nanti halaman ini jadi jalur masuk utama (QR di tiap meja), yang
  perlu diukur dulu: berapa permintaan/menit, dan berapa lama dua kueri
  menu ke Supabase. Baru setelah itu layak mempertimbangkan cache.
*/

/**
 * Latar halaman memakai foto yang SAMA dengan /tour.
 *
 * Bukan pilihan malas: memakai gambar berbeda untuk dua halaman yang
 * bersebelahan membuat keduanya terasa dari situs yang berbeda. Yang
 * membedakan halaman ini adalah isinya, bukan latarnya.
 *
 * Gambar diunduh sekali dan dipakai ulang dari cache peramban, karena
 * URL-nya identik dengan yang ada di /tour.
 */
const LATAR = "/images/fitur-bg.jpg";

/**
 * SATU warna untuk semua kartu — sama dengan /tour (`forest-900`).
 *
 * Kontras terukur pada #1b3325 (bukan dikira-kira):
 *   teks cream-50        13.35 : 1
 *   harga cream-100      12.1  : 1
 *   pil cream-100/15      6.78 : 1
 *   label samar /60       4.9  : 1
 * Semua lolos ambang 4.5:1 untuk teks kecil.
 *
 * Keping harga memakai `cream-100` dengan teks `forest-900` — kebalikan
 * dari kartunya, jadi ia terbaca sebagai "label harga", bukan sebagai
 * blok gelap kedua.
 */
const GAYA = {
  kartu: "bg-forest-900 ring-1 ring-inset ring-cream-100/15",
  teks: "text-cream-50",
  pil: "bg-cream-100/15 text-cream-100",
  keping: "bg-cream-100 text-forest-900",
} as const;

/*
  Satu formatter untuk seluruh halaman. `toLocaleString` dipanggil 126 kali
  per render (satu per kartu); membuat objek Intl baru tiap panggilan
  menambah kerja yang tidak terlihat tapi terukur pada render server.
*/
const angka = new Intl.NumberFormat("id-ID");

type Kelompok = {
  kategori: KategoriMenu;
  menu: Menu[];
};

/**
 * Kelompokkan per kategori, urutan kategori mengikuti kolom `urutan`.
 *
 * `kategori_id` yang tidak cocok dengan kategori mana pun TIDAK dibuang:
 * ia masuk kelompok "Lainnya". Menu yatim (mis. kategori dihapus) harus
 * tetap terlihat di menu publik — menyembunyikannya berarti tamu tidak
 * bisa memesan hidangan yang sebenarnya masih dijual.
 */
function kelompokkan(kategori: KategoriMenu[], menu: Menu[]): Kelompok[] {
  const hasil: Kelompok[] = [];
  const dipakai = new Set<number>();

  for (const k of [...kategori].sort((a, b) => a.urutan - b.urutan)) {
    const isi = urutkanMenu(menu.filter((m) => m.kategori_id === k.id));
    if (isi.length === 0) continue;
    hasil.push({ kategori: k, menu: isi });
    dipakai.add(k.id);
  }

  const yatim = urutkanMenu(menu.filter((m) => m.kategori_id === null || !dipakai.has(m.kategori_id)));
  if (yatim.length > 0) {
    hasil.push({
      kategori: { id: -1, nama: "Lainnya", urutan: 999 },
      menu: yatim,
    });
  }

  return hasil;
}

/** Satu baris pilihan: "Sambal Matah · BBQ · Gravy · Salted Egg +5.000". */
function BarisPilihan({ pilihan }: { pilihan: { nama: string; tambah: number }[] }) {
  if (pilihan.length === 0) return null;
  return (
    <p className="mt-[0.25rem] flex flex-wrap items-baseline gap-x-[0.375rem] gap-y-[0.125rem] text-[0.625rem] leading-[1.45] text-cream-100/75">
      <span className="font-bold uppercase tracking-[0.1em] text-cream-100/70">Pilihan</span>
      {pilihan.map((p, i) => (
        <span key={p.nama} className="whitespace-nowrap">
          {i > 0 && (
            <span aria-hidden="true" className="mr-[0.375rem] text-cream-100/60">
              ·
            </span>
          )}
          {p.nama}
          {p.tambah > 0 && (
            <span className="ml-[0.1875rem] font-bold tabular-nums text-cream-100/90">
              +{angka.format(p.tambah)}
            </span>
          )}
        </span>
      ))}
    </p>
  );
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
    harga lama. Itu kerugian yang jauh lebih kecil daripada halaman
    kosong, tapi bukan nol — jadi kalau nanti /menu jadi jalur masuk
    utama, demo.ts wajib disegarkan setiap kali menu berubah.
    /order mengambil sikap yang sama (`menuRes.ok ? ... : MENU_CONTOH`).
  */
  const data = res.ok ? res.data : MENU_CONTOH;
  const kelompok = kelompokkan(data.kategori as KategoriMenu[], data.menu as Menu[]);

  /* Jumlah HANYA menu yang tersedia. Menyebut "126 menu" padahal 8 sedang
     habis akan terasa seperti janji yang tidak ditepati. */
  const tersedia = data.menu.filter((m) => m.tersedia).length;
  const totalKategori = kelompok.length;

  return (
    <main className="flex min-h-dvh justify-center bg-forest-950">
      {/*
        Kanvas 440px di tengah — sama seperti /tour dan beranda. Halaman ini
        BOLEH digulir (126 menu memang panjang); justru menggulir di sini
        bagian dari pengalamannya.
      */}
      <div className="relative isolate w-full max-w-[27.5rem] bg-forest-900 shadow-[0_0_100px_-30px_rgba(0,0,0,0.9)]">
        {/*
          Latar dibuat `fixed` di dalam kanvas: saat menggulir, isi bergerak
          di atas satu "jendela" yang diam — bukan tumpukan kartu di atas
          gambar yang ikut bergeser. Sama seperti /tour.
        */}
        <div className="fixed inset-0 mx-auto w-full max-w-[27.5rem]">
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
          <Navbar sticky gradient />

          <header className="px-5 pb-[0.875rem] pt-[0.75rem] text-center">
            <div className="mb-[0.625rem] flex justify-start">
              <BackLink href="/fitur" label="Kembali" aria="Kembali ke halaman Fitur" />
            </div>
            <p className="text-[0.625rem] font-medium leading-none tracking-[0.16em] text-white/75">
              DAFTAR LENGKAP
            </p>
            <h1 className="mt-[0.25rem] text-[1.375rem] font-extrabold leading-[1.1] tracking-[-0.01em] text-white [text-shadow:0_1px_10px_rgba(20,35,26,0.55)]">
              Menu Kami
            </h1>
            {/* Angka ditulis apa adanya. "126 pilihan" akan jadi klaim yang
                salah begitu ada menu habis, jadi yang dihitung hanya yang
                benar-benar bisa dipesan hari ini. */}
            <p className="mx-auto mt-[0.375rem] max-w-[19rem] text-[0.6875rem] leading-[1.5] text-white/80">
              {tersedia} pilihan dari {totalKategori} kategori
            </p>
          </header>

          {/*
            Daftar per kategori. `<section>` + heading asli (bukan div)
            karena ini struktur dokumen, bukan hiasan: pembaca layar bisa
            melompat antar kategori.
          */}
          <div className="flex flex-col gap-[1.25rem] px-5 pb-[0.875rem]">
            {kelompok.map((g) => (
              <section key={g.kategori.id} aria-labelledby={`kat-${g.kategori.id}`}>
                <div className="mb-[0.5rem] flex items-baseline justify-between gap-3 px-[0.125rem]">
                  <h2
                    id={`kat-${g.kategori.id}`}
                    className="text-[0.8125rem] font-extrabold uppercase tracking-[0.14em] text-cream-50 [text-shadow:0_1px_8px_rgba(20,35,26,0.7)]"
                  >
                    {g.kategori.nama}
                  </h2>
                  <span className="shrink-0 text-[0.625rem] font-bold tabular-nums text-cream-100/70">
                    {g.menu.length}
                  </span>
                </div>

                {/*
                  Tiap <li> diberi `content-visibility:auto`: peramban
                  melewati render kartu yang masih jauh di bawah layar,
                  lalu mengerjakannya saat mendekat. Untuk 126 kartu
                  bershadow ini memangkas kerja tata letak awal.

                  `contain-intrinsic-size: auto 76px` WAJIB menyertainya.
                  Tanpa ukuran cadangan, baris yang belum dirender
                  dianggap setinggi 0 → tinggi halaman melompat dan posisi
                  scrollbar bergeser saat tamu menggulir. `auto` membuat
                  peramban memakai ukuran sebenarnya setelah baris itu
                  pernah dirender.

                  76px = tinggi kartu terpendek (nama satu baris +
                  padding). Kartu berisi deskripsi/pilihan lebih tinggi;
                  `auto` yang mengoreksinya setelah render pertama.
                */}
                <ul className="flex flex-col gap-[0.5rem]">
                  {g.menu.map((m) => {
                    const pilihan = bacaPilihan(m.pilihan);
                    return (
                      <li
                        key={m.id}
                        className="[contain-intrinsic-size:auto_76px] [content-visibility:auto]"
                      >
                        {/*
                          Kartu TIDAK bisa diklik: tidak ada halaman detail.
                          Karena itu ia <article>, bukan <a>. Elemen yang
                          bisa diklik tapi tidak ke mana-mana lebih buruk
                          daripada elemen yang jujur diam.
                        */}
                        <article
                          className={`flex min-h-[4.75rem] items-stretch gap-[0.625rem] rounded-[1.25rem] p-[0.5rem] shadow-[0_14px_28px_-12px_rgba(0,0,0,0.55)] ${GAYA.kartu} ${
                            m.tersedia ? "" : "opacity-75"
                          }`}
                        >
                          {/* Keping harga menggantikan foto panorama: belum
                              ada satu pun foto menu di database, dan harga
                              adalah hal pertama yang dicari tamu. */}
                          <div
                            className={`relative flex size-[5.25rem] shrink-0 flex-col items-center justify-center rounded-[0.875rem] px-[0.25rem] text-center ${GAYA.keping}`}
                          >
                            <span className="text-[0.5625rem] font-bold uppercase leading-none tracking-[0.12em] opacity-65">
                              Rp
                            </span>
                            <span className="mt-[0.125rem] text-[0.8125rem] font-extrabold leading-[1.05] tabular-nums">
                              {angka.format(m.harga)}
                            </span>
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col justify-center py-[0.125rem]">
                            {/*
                              Penanda rekomendasi: SATU bintang di depan nama,
                              bukan pil "★ Rekomendasi".

                              Alasannya terukur, bukan selera. Kartu 320px:
                              lebar dalam 264px, kotak harga 84px + jarak 10px
                              menyisakan 170px untuk teks. Pil teks memakan
                              ~74px dari itu → nama tinggal ~90px dan
                              "Paket Nasi Liwet Personal" pecah jadi 4 baris.
                              Bintang sebaris hanya ~12px dan, karena ia
                              bagian dari aliran teks, ia ikut turun bersama
                              baris nama alih-alih mendesak seluruh nama.

                              Untuk pembaca layar, "Rekomendasi" tetap
                              diucapkan lewat sr-only — bintangnya sendiri
                              disembunyikan supaya tidak dibaca "bintang
                              hitam".
                            */}
                            <h3
                              className={`text-[0.9375rem] font-extrabold leading-[1.15] ${GAYA.teks}`}
                            >
                              {m.rekomendasi === true && (
                                <>
                                  <span aria-hidden="true" className="mr-[0.25rem] text-cream-100">
                                    ★
                                  </span>
                                  <span className="sr-only">Rekomendasi: </span>
                                </>
                              )}
                              {m.nama}
                            </h3>

                            {m.deskripsi?.trim() && (
                              <p
                                className={`mt-[0.1875rem] text-[0.625rem] leading-[1.4] text-cream-100/80 ${
                                  pilihan.length > 0 ? "line-clamp-2" : "line-clamp-3"
                                }`}
                              >
                                {m.deskripsi.trim()}
                              </p>
                            )}

                            <BarisPilihan pilihan={pilihan} />

                            {!m.tersedia && (
                              <p className="mt-[0.25rem] text-[0.625rem] font-bold uppercase tracking-[0.1em] text-cream-100/90">
                                Sedang habis
                              </p>
                            )}
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
      </div>
    </main>
  );
}
