import type { Metadata } from "next";
import { PortalPelanggan } from "../components/order/PortalPelanggan";
import { cekBuka } from "../lib/order/aturan";
import { ambilAturan, ambilMenu, ambilMeja } from "../lib/order/data";
import { PESAN_ENV_KOSONG, punyaEnvBaca, punyaKunciServer } from "../lib/order/db";
import { demoMeja, MENU_CONTOH } from "../lib/order/demo";
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

  const [menuRes, aturan, buka] = await Promise.all([
    ambilMenu(),
    ambilAturan(),
    Promise.resolve(cekBuka()),
  ]);

  // Tanpa nomor meja: tampilkan petunjuk scan, bukan menu tanpa konteks.
  if (!nomor) {
    return (
      <LayarPesan
        judul="Scan QR di meja Anda"
        isi="Portal ini dibuka lewat QR yang tertempel di meja. Arahkan kamera ke QR tersebut, lalu menu akan terbuka dengan nomor meja Anda."
      />
    );
  }

  // Validasi meja
  const hasilMeja = punyaKunciServer()
    ? await ambilMeja(nomor)
    : (() => {
        const m = demoMeja().find((x) => x.nomor === nomor);
        return m ? ({ ok: true, data: m } as const) : ({ ok: false, pesan: "Nomor meja tidak dikenali." } as const);
      })();

  if (!hasilMeja.ok) {
    return (
      <LayarPesan
        judul={`Meja ${nomor} tidak dikenali`}
        isi={`${hasilMeja.pesan} Periksa lagi QR di meja Anda, atau panggil pelayan untuk dibantu.`}
      />
    );
  }

  const meja = hasilMeja.data as Meja;

  /*
    Menu mana yang ditampilkan?

    PRODUKSI (kunci server ada): WAJIB dari database. Kalau database tidak
    terbaca, tampilkan layar "menu belum bisa dimuat" — jangan menu contoh.

    Dulu halaman ini jatuh ke MENU_CONTOH (Harira, Tajine, Couscous dengan
    harga karangan) saat database gagal. Sekarang menu asli sudah terisi,
    perilaku itu berbahaya: tamu memesan makanan yang tidak dijual Nabawi
    dengan harga yang tidak berlaku, lalu kecewa saat kasir menolak.

    MODE DEMO (belum ada kunci server): MENU_CONTOH tetap dipakai sebagai
    cadangan terakhir supaya halaman bisa dicoba tanpa database. Pita
    "Mode demo" sudah memberi tahu bahwa menu ini bukan menu sungguhan,
    dan kasir/dapur membaca sumber yang sama sehingga tidak ada selisih.
  */
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

  /* Sampai di sini menuRes SELALU ok (dua kegagalan sudah ditangani di
     atas). MENU_CONTOH dipertahankan sebagai cadangan tipe saja, supaya
     perubahan aturan di atas tidak diam-diam menelan halaman ini. */
  const data = menuRes.ok ? menuRes.data : MENU_CONTOH;

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
      demo={!punyaKunciServer()}
    />
  );
}

/** Layar pesan sederhana untuk keadaan yang tidak bisa dilanjutkan. */
function LayarPesan({ judul, isi }: { judul: string; isi: string }) {
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
