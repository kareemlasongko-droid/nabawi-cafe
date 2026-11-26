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
import { KomponenCari } from "../components/menu/KomponenCari";
import { SaringanKategori } from "../components/menu/SaringanKategori";
import { Navbar } from "../components/Navbar";
import { LayarMasalah } from "../components/LayarMasalah";
import { ambilMenu } from "../lib/order/data";
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
 * ── PEMBACA: ORANG YANG SEDANG MEMUTUSKAN ────────────────────────────
 *
 * Halaman ini bukan katalog untuk dilihat; ia satu-satunya tempat calon
 * tamu memutuskan mau datang atau tidak, dan mau makan apa. Karena itu
 * tiga hal di bawah ini BUKAN tambahan opsional — semuanya bekas temuan
 * audit, dan yang pertama adalah kebocoran pendapatan:
 *
 *   1. JALAN KELUAR. Versi sebelumnya tidak punya satu pun tautan ke
 *      /order. Satu-satunya tautan ke sana di seluruh aplikasi ada di
 *      halaman invoice — artinya tamu yang sudah tertarik harus MENGETIK
 *      alamat untuk memesan. Sekarang ada tombol tetap di bawah layar
 *      dan satu tombol per kartu menu.
 *   2. PENCARIAN. 126 menu dalam 6 kategori, tanpa kotak cari. Tamu yang
 *      datang dengan satu tujuan ("ada matcha?") harus menggulir 126
 *      kartu. Kotak cari juga MENUTUP pembayaran kalau nol hasil.
 *   3. HARGA YANG TERBACA. Kartu memakai teks 13px nama + 14px harga di
 *      atas bidang terracotta, dan 126 menu dibagi rata 2 kolom. Tamu
 *      membandingkan harga sebagai angka, bukan sebagai kalimat.
 *
 * Yang tetap dipertahankan dari versi sebelumnya: warna terracotta
 * `clay-600` (satu benda dengan tombol "Menu Kami" di /fitur), saringan
 * kategori yang menempel, dan kartu tanpa halaman detail.
 */

/* Halaman ini dibaca saat DIMINTA, bukan saat build: harga dan
   ketersediaan berubah dari /order/admin, dan env dibaca saat runtime. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu Kami — Nabawi Cafe & Resto",
  description:
    "Daftar lengkap menu Nabawi Cafe & Resto: makanan utama, camilan & pastry, kopi, non-kopi, cheese & milkshake, serta jus & dessert — lengkap dengan harga dan pilihan rasanya.",
};

const LATAR = "/images/fitur-bg.jpg";

/**
 * Palet halaman — SEMUA diturunkan dari clay-600 #b4502c (warna tombol).
 *
 * Kontras yang sudah diukur dan TIDAK boleh diturunkan tanpa mengukur
 * ulang:
 *
 *   DI ATAS KARTU clay-600 #b4502c:
 *     cream-50        5.01 : 1  ← lolos
 *     cream-50/95     4.67 : 1  ← lolos (teks sekunder)
 *     cream-50/90     4.39 : 1  ← GAGAL
 *
 *   Artinya di atas terrakota hanya boleh ada SATU tingkat peredupan (95%).
 *   Hierarki dibawa ukuran dan ketebalan huruf, bukan opasitas.
 *
 *   DI ATAS LATAR HIJAU (foto + forest-950/45 + gradasi):
 *     white/80        6.33 : 1  ← ringkasan kepala
 *     white/75        4.26 : 1  ← GAGAL untuk 10px
 *     white/85        5.00 : 1  ← label kepala
 */
const GAYA = {
  /** Kartu terrakota + ring krem: kartu di latar hijau hanya terbaca
      tepinya lewat ring, karena bayangan nyaris tak terlihat di latar gelap. */
  kartu: "bg-clay-600 ring-1 ring-cream-50/45",
  teks: "text-cream-50",
  redup: "text-cream-50/95",
};

const angka = new Intl.NumberFormat("id-ID");

function ikonKategori(id: number | null | undefined) {
  switch (id) {
    case 1:
      return IkonMangkuk;
    case 2:
      return IkonBiskuit;
    case 3:
      return IkonCangkir;
    case 4:
      return IkonGelas;
    case 5:
      return IkonEsKrim;
    case 6:
      return IkonMilkshake;
    default:
      return IkonMangkuk;
  }
}

/**
 * Yang dikirim ke komponen pencarian: HANYA daftar id.
 *
 * ── TIGA PERCOBAAN, DUA GAGAL — dicatat supaya tidak diulang ─────────
 *
 *   1. Kirim `{id, nama, deskripsi, cari}` sebagai props. Next
 *      menyerialkan props ke payload RSC, jadi teks pencarian 126 menu
 *      tertulis dua kali dalam satu halaman: HTML naik 157 KB.
 *   2. Kirim id saja, taruh teksnya di atribut `data-cari`. Ternyata
 *      atribut pada elemen server JUGA ikut diserialkan ke payload RSC —
 *      masih 141 KB lebih besar.
 *   3. (dipakai sekarang) Kirim id saja, dan komponen pencarian membaca
 *      teks yang SUDAH TAMPIL di kartu. Tidak ada byte tambahan sama
 *      sekali: nama, deskripsi, dan pilihan sudah ada di layar, tinggal
 *      dibaca.
 *
 * Konsekuensi kecil yang disengaja: yang bisa dicari adalah teks yang
 * benar-benar terlihat (deskripsi yang dipotong `line-clamp` tetap ikut
 * terbaca dari DOM, jadi tidak ada yang hilang).
 */
type Ringkas = { id: number };

export default async function HalamanMenu() {
  const res = await ambilMenu();
  if (!res.ok) {
    return (
      <LayarMasalah
        judul="Menu belum bisa dimuat"
        pesan={res.pesan}
        kembaliKe="/fitur"
        labelKembali="Kembali ke Fitur"
      />
    );
  }

  const data = res.data;
  const kelompok = kelompokkanMenu(data.kategori, data.menu);

  /*
    Bentuk ringkas dikirim ke komponen pencarian.

    Yang dikirim hanya yang dipakai layar: tanpa deskripsi, tanpa pilihan,
    tanpa foto. 126 menu × ~120 byte, bukan 126 × objek penuh — dan
    deskripsi tetap dirender di kartu server di bawah, jadi tidak ada teks
    yang hilang dari halaman.
  */
  const ringkas: Ringkas[] = data.menu.map((m) => ({ id: m.id }));

  const total = data.menu.filter((m) => m.tersedia).length;
  const totalKategori = kelompok.length;
  const habis = data.menu.length - total;

  return (
    <main className="flex min-h-dvh justify-center bg-forest-950">
      {/* Kanvas 440px di tengah.

          `overflow-clip` SENGAJA tidak dipakai: `overflow` apa pun pada
          leluhur mematikan `position: sticky`, dan baris pil kategori WAJIB
          menempel. Latar sudah dibatasi max-w + mx-auto. */}
      <div className="relative isolate w-full max-w-[27.5rem] bg-forest-900 shadow-[0_0_100px_-30px_rgba(0,0,0,0.9)]">
        {/* Latar bertekstur, `fixed` = jendela yang diam saat isi bergeser. */}
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
            <p className="text-[0.625rem] font-medium leading-none tracking-[0.16em] text-white/85">
              DAFTAR LENGKAP
            </p>
            <h1 className="mt-[0.25rem] text-[1.375rem] font-extrabold leading-[1.1] tracking-[-0.01em] text-[#ffffff] [text-shadow:0_1px_10px_rgba(20,35,26,0.55)]">
              Menu Kami
            </h1>
            {/* Satu paragraf, dipisah titik tengah seperti /tour.
                white/80 = 4.64:1 di latar kepala — lolos, tidak boleh
                diredupkan lagi. */}
            <p className="mx-auto mt-[0.375rem] max-w-[19rem] text-[0.6875rem] leading-[1.5] text-white/80">
              {total} pilihan dari {totalKategori} kategori
              {habis > 0 && ` · ${habis} sedang habis`}
            </p>
          </header>

          {/* Aturan tampil-per-kategori ditulis dari DATA, bukan disalin ke
              globals.css: kalau pemilik menambah kategori ke-7, pilnya dan
              aturannya lahir bersamaan. */}
          <style id="menu-aturan-saring">{aturanSaring(kelompok.map((g) => g.kategori))}</style>

          {/*
            ── PENCARIAN + SARINGAN: SATU BLOK YANG MENEMPEL ────────────

            Kotak cari dan baris pil kategori ditaruh dalam SATU pembungkus
            sticky. Sebelumnya hanya pilnya yang menempel, jadi begitu tamu
            menggulir 126 kartu ia kehilangan kotak cari — tepat saat ia
            paling membutuhkannya (sudah jauh, belum menemukan).

            `-mx-5 px-5` membuat latar blur menutup tepi kanvas; tanpa itu
            kartu terlihat menyelip di sela 20px kiri-kanan saat digulir.
          */}
          <div className="sticky top-[3.5rem] z-20 -mx-5 bg-forest-950/55 px-5 py-2 backdrop-blur-md">
            <KomponenCari
              ringkas={ringkas}
              kelompok={kelompok.map((g) => ({ id: g.kategori.id, nama: g.kategori.nama }))}
            />
            <SaringanKategori kategori={data.kategori as KategoriMenu[]} />
          </div>

          {/*
            DAFTAR KARTU — dirender server.

            Komponen pencarian di atas HANYA menyembunyikan/menampilkan
            kartu lewat `hidden`, bukan merender ulang daftar. Dua alasan:
              · 126 kartu tetap ada di HTML, jadi halaman tetap berguna
                kalau JavaScript gagal dimuat (Safari iOS lama);
              · menyaring tidak membuang foto yang sudah terunduh.
          */}
          <div id="daftar-menu">
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
                        data-menu={m.id}
                        className="flex flex-col overflow-hidden rounded-[1rem] [contain-intrinsic-size:auto_210px] [content-visibility:auto]"
                      >
                        <article className={["flex h-full flex-col rounded-[1rem]", GAYA.kartu, m.tersedia ? "" : "opacity-75"].join(" ")}>
                          <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-[1rem] bg-forest-950/10">
                            {m.foto_url ? (
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

                            {/*
                              HARGA + SATU-SATUNYA AKSI DI KARTU.

                              Versi sebelumnya berhenti di harga: kartu tidak
                              bisa ditekan, tidak ada tombol, dan tidak ada
                              jalan ke pemesanan di seluruh halaman. Tamu
                              yang sudah memilih hidangan lalu menemui jalan
                              buntu — dan jalan buntu di halaman katalog
                              adalah kehilangan pesanan, bukan sekadar
                              ketidaknyamanan.

                              Tombolnya tetap 44px dan tetap di sebelah harga
                              (satu baris), jadi 126 kartu tidak bertambah
                              tinggi dan pemindaian harga tidak terganggu.
                            */}
                            <div className="mt-auto flex items-end justify-between gap-1 pt-[0.5rem]">
                              <p className="min-w-0 text-[0.875rem] font-extrabold leading-none tabular-nums text-cream-50">
                                {angka.format(m.harga)}
                              </p>
                              {m.tersedia ? (
                                <a
                                  href={`/order?meja=&menu=${m.id}`}
                                  aria-label={`Pesan ${m.nama}`}
                                  className="-my-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-full bg-cream-50 text-clay-700 transition active:scale-95"
                                >
                                  <IkonTambahMenu />
                                </a>
                              ) : (
                                <span className="pb-1 text-[0.625rem] font-bold text-cream-50/80">
                                  habis
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {/*
            ── JALAN KELUAR YANG SELALU TERLIHAT ────────────────────────

            Tombol tetap di bawah. `bottom-0` + `pb-safe` supaya tidak
            tertimpa bilah gestur iPhone, dan `max-w` mengikuti kanvas.

            Kalimatnya menyebut CARA membuka menu dari meja, bukan sekadar
            "Pesan sekarang": tamu yang belum duduk butuh tahu bahwa pesanan
            dibuat dengan memindai QR di meja. Tanpa penjelasan itu, tombol
            "Pesan" yang membuka halaman "Scan QR di meja Anda" terasa
            seperti tautan rusak.
          */}
          <div className="sticky bottom-0 z-20 mt-auto -mx-5 border-t border-cream-50/15 bg-forest-950/80 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
            <a
              href="/order"
              className="flex h-12 items-center justify-center gap-2 rounded-[0.875rem] bg-cream-50 text-[0.9375rem] font-extrabold text-forest-900 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] transition active:scale-[0.99]"
            >
              Pesan dari meja Anda
              <IkonPanah />
            </a>
            <p className="mt-1.5 text-center text-[0.625rem] leading-snug text-white/80">
              Pindai QR di meja, atau tunjukkan halaman ini ke pelayan.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Panah kecil di tombol pesan — digambar, bukan karakter, supaya tidak
 *  berubah bentuk saat font gagal dimuat. */
function IkonPanah() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
      <path d="M4 10h11M11 5.5 15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Plus di kartu menu, ukuran 44px bersamanya. */
function IkonTambahMenu() {
  return (
    <svg viewBox="0 0 20 20" className="size-[1.125rem]" fill="none" aria-hidden="true">
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
