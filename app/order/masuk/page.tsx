import type { Metadata } from "next";
import { BilahStaf } from "../../components/order/Kerangka";
import { PUNYA_KUNCI_SERVER } from "../../lib/order/db";

export const metadata: Metadata = {
  title: "Masuk staf — Nabawi Cafe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Halaman masuk staf.
 *
 * JUJUR SOAL KEADAAN: PRD bagian 13 meminta login per peran (kasir,
 * dapur, pelayan, pemilik), dan pemilik bisa membatasi siapa yang boleh
 * membuka /order/admin. Itu memerlukan tabel pengguna internal + session,
 * yang belum dibuat — lihat catatan di README bagian order.
 *
 * Halaman ini TIDAK menampilkan formulir sandi palsu. Formulir yang
 * terlihat berfungsi tetapi tidak memeriksa apa pun lebih berbahaya
 * daripada tidak ada formulir sama sekali: pemilik akan mengira portal
 * internalnya sudah terlindungi.
 *
 * Yang ditampilkan: daftar portal + keadaan keamanan yang sebenarnya,
 * supaya keputusan pengamanan bisa diambil sebelum portal dipakai
 * operasional.
 */
export default function HalamanMasuk() {
  const portal = [
    { href: "/order/kasir", nama: "Kasir", ket: "Antrean pesanan, meja, tagihan, pembayaran." },
    { href: "/order/dapur", nama: "Dapur & Bar", ket: "Papan tiket Baru, Diproses, Siap." },
    { href: "/order/pelayan", nama: "Pelayan", ket: "Siap diantar dan panggilan meja." },
    { href: "/order/admin", nama: "Admin", ket: "Menu, harga, ketersediaan, pajak." },
  ];

  return (
    <div className="min-h-dvh bg-cream-200">
      <BilahStaf judul="Portal internal" keterangan="Nabawi Cafe & Resto" />

      <main className="mx-auto max-w-lg p-4 sm:p-6">
        <div className="rounded-xl border border-clay-600/30 bg-clay-600/8 p-4">
          <p className="text-[0.8125rem] font-extrabold text-clay-800">
            Portal ini belum dilindungi kata sandi
          </p>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-clay-800/90">
            Login per peran (kasir, dapur, pelayan, pemilik) adalah bagian PRD, tetapi belum
            dibuat. Saat ini siapa pun yang tahu alamatnya bisa membuka portal staf. Jangan
            pakai untuk operasional harian sebelum pengamanan dipasang.
          </p>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-clay-800/80">
            Status database:{" "}
            {PUNYA_KUNCI_SERVER ? (
              <strong>kunci server terpasang — data tersimpan sungguhan.</strong>
            ) : (
              <strong>
                kunci server belum terpasang — pesanan berjalan dalam mode demo dan tidak
                bertahan.
              </strong>
            )}
          </p>
        </div>

        <ul className="mt-4 space-y-2">
          {portal.map((p) => (
            <li key={p.href}>
              <a
                href={p.href}
                className="flex items-center gap-3 rounded-xl border border-ink-900/12 bg-cream-50 px-4 py-3 transition active:scale-[0.995]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] font-extrabold text-ink-900">{p.nama}</span>
                  <span className="block text-[0.75rem] leading-snug text-ink-500">{p.ket}</span>
                </span>
                <span className="text-ink-500" aria-hidden="true">
                  &rarr;
                </span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[0.6875rem] leading-relaxed text-ink-500">
          Alamat ini tidak ditautkan dari website publik. Portal pelanggan ada di{" "}
          <code className="font-mono">/order?meja=N</code>.
        </p>
      </main>
    </div>
  );
}
