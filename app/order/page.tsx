import type { Metadata } from "next";
import { PortalPelanggan } from "../components/order/PortalPelanggan";
import { cekBuka } from "../lib/order/aturan";
import { ambilAturan, ambilMenu, ambilMeja } from "../lib/order/data";
import { PUNYA_KUNCI_SERVER } from "../lib/order/db";
import { MENU_CONTOH, demoMeja } from "../lib/order/demo";
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
  const hasilMeja = PUNYA_KUNCI_SERVER
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

  // Menu dari database; kalau database tidak terbaca, pakai salinan lokal
  // supaya halaman tetap bisa dipakai (PRD bagian 14: kembali ke cara manual
  // bila sistem bermasalah — di sini minimal pelanggan tetap bisa melihat harga).
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
      demo={!PUNYA_KUNCI_SERVER || !menuRes.ok}
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
