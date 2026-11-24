import type { Metadata } from "next";
import { PortalPelanggan } from "../components/order/PortalPelanggan";
import { cekBuka } from "../lib/order/aturan";
import { ambilJamBuka } from "../lib/order/jam-buka";
import { ambilAturan, ambilMenu, ambilMeja } from "../lib/order/data";
import { PESAN_ENV_KOSONG, punyaEnvBaca, punyaKunciServer } from "../lib/order/db";
import { pesanModeContoh, statusModeContoh } from "../lib/order/mode-contoh";
import type { Meja } from "../lib/order/tipe";

export const metadata: Metadata = {
  title: "Pesan dari meja — Nabawi Cafe & Resto",
  description: "Pesan makanan dan minuman langsung dari meja Anda.",
  // Portal pelanggan tidak perlu diindeks; QR yang membagikannya.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /order?meja=12 — portal pelanggan.
 *
 * Nomor meja diambil dari query QR. Nomor yang tidak ada di database
 * DITOLAK dengan pesan yang jelas (PRD bagian 5), bukan diam-diam
 * dianggap meja 1 — salah meja berarti salah antar dan salah tagihan.
 */
export default async function HalamanOrder({
  searchParams,
}: {
  searchParams: Promise<{ meja?: string }>;
}) {
  const { meja: mejaParam } = await searchParams;
  const nomor = (mejaParam ?? "").trim();

  /*
    Jam buka DIBACA DARI DATABASE, bukan dipakai bawaan `cekBuka()`.

    Sebelum ini halaman tamu memanggil `cekBuka()` tanpa argumen, sehingga
    yang berlaku selalu JAM_BAWAAN di kode — dan pemilik yang mengubah jam
    (termasuk memasang 24 jam) tidak melihat efek apa pun di halaman yang
    justru paling penting. Perubahannya sudah ada di `pengaturan`, hanya
    belum dibaca di sini.
  */
  const [menuRes, aturan, jamAktif] = await Promise.all([
    ambilMenu(),
    ambilAturan(),
    ambilJamBuka(),
  ]);
  const buka = cekBuka(new Date(), jamAktif.jam);

  // Tanpa nomor meja: tampilkan petunjuk scan, bukan menu tanpa konteks.
  if (!nomor) {
    return (
      <LayarPesan
        judul="Scan QR di meja Anda"
        isi="Portal ini dibuka lewat QR yang tertempel di meja. Arahkan kamera ke QR tersebut, lalu menu akan terbuka dengan nomor meja Anda."
      />
    );
  }

  /*
    MEJA SELALU DARI DATABASE.

    Dulu, tanpa kunci server, nomor meja dicocokkan ke 20 meja karangan di
    `demo.ts` — meja yang tidak ada di restoran ini. QR di meja sungguhan
    bisa "dikenali" padahal nomornya tidak pernah terdaftar, dan pesanannya
    (kalau bisa disimpan) akan mendarat di meja yang salah.
  */
  const hasilMeja = await ambilMeja(nomor);

  /*
    DUA SEBAB, DUA PESAN — jangan disamakan.

    `ambilMeja` mengembalikan pesan berbeda untuk "nomor meja memang tidak
    ada" dan "database tidak bisa dibaca". Dulu keduanya ditampilkan
    sebagai "Meja 1 tidak dikenali", sehingga tamu yang QR-nya benar
    disuruh memeriksa QR-nya sendiri — padahal yang bermasalah server.
    Pesan yang menyalahkan tamu untuk kesalahan kita adalah kegagalan
    tersendiri.
  */
  if (!hasilMeja.ok) {
    const mejaTakAda = hasilMeja.pesan.includes("tidak dikenali");
    return (
      <LayarPesan
        judul={mejaTakAda ? `Meja ${nomor} tidak dikenali` : "Meja belum bisa dibuka"}
        isi={
          mejaTakAda
            ? `${hasilMeja.pesan} Periksa lagi QR di meja Anda, atau panggil pelayan untuk dibantu.`
            : "Sistem sedang tidak bisa memeriksa nomor meja. Panggil pelayan untuk dibantu mencatat pesanan Anda."
        }
        teknis={mejaTakAda ? undefined : hasilMeja.pesan}
      />
    );
  }

  const meja = hasilMeja.data as Meja;

  /*
    BEDAKAN dua sebab kegagalan, jangan digabung.

    Sebelumnya keduanya jatuh ke "koneksi sedang bermasalah", padahal
    memperbaikinya sama sekali berbeda:
      · env kosong      -> isi SUPABASE_URL / SUPABASE_ANON_KEY, tidak ada
                           yang perlu ditunggu.
      · database gagal  -> benar-benar gangguan; tunggu dan muat ulang.

    Menyuruh orang "coba sebentar lagi" untuk env yang kosong berarti
    menyuruhnya menunggu selamanya.
  */
  if (!menuRes.ok && !punyaEnvBaca()) {
    return (
      <LayarPesan
        judul="Menu belum bisa dimuat"
        isi={`${PESAN_ENV_KOSONG} Ini urusan pemasangan environment di server, bukan gangguan sementara — silakan panggil pelayan untuk dibantu memesan.`}
      />
    );
  }

  if (!menuRes.ok) {
    return (
      <LayarPesan
        judul="Menu belum bisa dimuat"
        isi="Koneksi ke menu sedang bermasalah. Coba muat ulang halaman ini sebentar lagi, atau panggil pelayan untuk dibantu memesan."
      />
    );
  }

  /*
    Sampai di sini menuRes SELALU ok — dua kegagalan di atas sudah
    mengembalikan layar. Tidak ada salinan menu di kode lagi, jadi tidak ada
    yang bisa dipakai sebagai cadangan; kalau aturan di atas diubah kelak,
    TypeScript akan menolak, bukan diam-diam menampilkan menu lama.
  */
  const data = menuRes.data;

  /*
    Saklar mode contoh dibaca dari DATABASE (tabel pengaturan), bukan dari
    ada/tidaknya env. Dua sebab tetap dibedakan supaya pesan di layar tamu
    mengatakan hal yang benar: admin mematikannya, atau kunci server belum
    dipasang.
  */
  const mode = await statusModeContoh(punyaKunciServer());

  return (
    <PortalPelanggan
      mejaNomor={meja.nomor}
      mejaArea={meja.area}
      kategori={data.kategori}
      menu={data.menu}
      aturan={aturan}
      jamHariIni={buka.jamHariIni}
      bukaSekarang={buka.buka}
      alasanTutup={buka.alasan}
      demo={mode.aktif}
      pesanDemo={pesanModeContoh(mode)}
    />
  );
}

/** Layar pesan sederhana untuk keadaan yang tidak bisa dilanjutkan. */
function LayarPesan({
  judul,
  isi,
  teknis,
}: {
  judul: string;
  isi: string;
  /** Keterangan untuk pemilik/staf; tidak ditampilkan ke tamu biasa. */
  teknis?: string;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream-200 px-6">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-ink-900/10 bg-cream-50 p-5">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-ink-500">
            Nabawi Cafe &amp; Resto
          </p>
          <h1 className="mt-1 text-[1.125rem] font-extrabold leading-tight text-ink-900">
            {judul}
          </h1>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-700">{isi}</p>
          {teknis && (
            /* Kecil dan redup: gunanya untuk staf yang melapor ke pemilik,
               bukan untuk tamu. Menaruhnya besar akan mengalihkan perhatian
               dari satu-satunya hal yang perlu dilakukan tamu: panggil pelayan. */
            <p className="mt-3 rounded-lg bg-ink-900/5 px-2.5 py-2 text-[0.6875rem] leading-snug text-ink-500">
              {teknis}
            </p>
          )}
          <a
            href="/"
            className="mt-4 flex h-11 items-center justify-center rounded-xl border border-ink-900/15 text-[0.8125rem] font-bold text-ink-900"
          >
            Kembali ke beranda
          </a>
        </div>
      </div>
    </main>
  );
}
