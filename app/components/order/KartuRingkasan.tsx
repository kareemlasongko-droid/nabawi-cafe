"use client";

/**
 * Rangkuman penjualan hari ini — dipakai KASIR dan ADMIN.
 *
 * ── "RINGKAS SAJA" ITU KEPUTUSAN, BUKAN KEKURANGAN ────────────────────
 *
 * Pemilik meminta rangkuman yang ringkas. Karena itu bentuknya SATU baris
 * angka, bukan dashboard: kartu-kartu dengan grafik akan menempati separuh
 * layar kasir yang dipakai sambil berdiri, dan angka yang tidak dipakai
 * untuk mengambil keputusan hanya menambah yang harus dibaca.
 *
 * Yang ditampilkan hanya yang bisa ditindaklanjuti:
 *   · omzet hari ini          → pertanyaan pertama pemilik;
 *   · jumlah pesanan          → ekspektasi beban dapur;
 *   · belum dibayar           → pekerjaan yang masih menunggu kasir.
 *
 * Tunai dan non-tunai ditampilkan lebih kecil: berguna saat tutup laci,
 * bukan saat melayani tamu.
 *
 * ── OMZET BUKAN "UANG DITERIMA" ───────────────────────────────────────
 *
 * Angkanya dari `tagihan.total`. `pembayaran.diterima` memuat uang yang
 * diserahkan tamu — pada satu transaksi live nilainya Rp300.000 untuk
 * tagihan Rp279.700. Menjumlahkannya akan memasukkan uang kembalian
 * sebagai pendapatan.
 */

import { rupiah } from "@/app/lib/order/tipe";
import type { RingkasanPenjualan } from "@/app/lib/order/riwayat";

export function KartuRingkasan({
  ringkasan,
  galat,
  memuat = false,
  /** `compact` dipakai di kepala kasir; `penuh` di tab admin. */
  varian = "compact",
}: {
  ringkasan: RingkasanPenjualan | null;
  galat?: string;
  /** Sedang mengambil data — BUKAN kegagalan. */
  memuat?: boolean;
  varian?: "compact" | "penuh";
}) {
  /*
    ── "SEDANG MEMUAT" BUKAN "GAGAL DIBACA" ─────────────────────────────

    Versi sebelumnya hanya punya dua keadaan: ada angkanya, atau pesan
    "Rangkuman penjualan belum bisa dibaca." Karena `ringkasan` mulai
    sebagai null, SETIAP kali tab Laporan dibuka kasir melihat pesan
    KEGAGALAN selama permintaan berjalan — kira-kira satu detik.

    Itu bukan sekadar tidak rapi. Pesan itu membuat kasir mengira
    laporannya rusak, lalu menekan "Muat ulang" berulang kali, atau
    menutup tab dan menganggap omzetnya hilang. Padahal datanya sedang
    dalam perjalanan.

    Sekarang tiga keadaan dibedakan dengan jujur: memuat (kerangka abu-abu
    tanpa kalimat menakutkan), gagal (pesan galat yang sebenarnya), dan
    ada data.
  */
  if (!ringkasan) {
    if (memuat) {
      return (
        <div
          className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">Memuat rangkuman penjualan</span>
          {/* Kerangka berbentuk kartu yang sama, supaya tata letak tidak
              melompat saat angkanya tiba. Lebar 60% meniru angka rupiah
              yang memang panjang. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-2.5 w-16 animate-pulse rounded bg-bersih-200" />
                <div className="mt-1.5 h-5 w-3/5 animate-pulse rounded bg-bersih-100" />
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-[0.625rem] border border-dashed border-bersih-200 bg-bersih-100 px-3 py-2">
        <p className="text-[0.6875rem] leading-snug text-tinta-500">
          {galat || "Rangkuman penjualan belum bisa dibaca."}
        </p>
      </div>
    );
  }

  const r = ringkasan;

  if (varian === "compact") {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Angka label="Omzet hari ini" nilai={rupiah(r.omzet)} utama />
        <Angka label="Pesanan" nilai={String(r.jumlah_pesanan)} />
        {/*
          "Belum dibayar" hanya muncul bila ADA. Angka nol yang selalu
          tampil membuat kasir berhenti membacanya — dan saat benar-benar
          ada yang belum dibayar, ia tidak menyadarinya.
        */}
        {r.belum_bayar > 0 && (
          <Angka
            label="Belum dibayar"
            nilai={`${r.belum_bayar} · ${rupiah(r.nilai_belum_bayar)}`}
            perhatian
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3 shadow-[0_1px_2px_rgb(22_19_15/0.04)]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kotak label="Omzet hari ini" nilai={rupiah(r.omzet)} utama />
        <Kotak label="Pesanan lunas" nilai={String(r.jumlah_pesanan)} />
        <Kotak label="Rata-rata / pesanan" nilai={rupiah(r.rata_rata)} />
        <Kotak label="Item terjual" nilai={String(r.item)} />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-bersih-200 pt-2">
        <Kecil label="Tunai" nilai={rupiah(r.tunai)} />
        <Kecil label="Non-tunai" nilai={rupiah(r.nontunai)} />
        {r.belum_bayar > 0 && (
          <Kecil
            label="Belum dibayar"
            nilai={`${r.belum_bayar} pesanan · ${rupiah(r.nilai_belum_bayar)}`}
            perhatian
          />
        )}
      </div>

      <p className="mt-2 text-[0.625rem] leading-snug text-tinta-500">
        Sejak 00.00 WIB. Omzet dihitung dari total tagihan yang sudah lunas — bukan
        dari uang yang diserahkan tamu, supaya kembalian tidak ikut terhitung.
        Pesanan yang belum dibayar tidak masuk omzet.
      </p>
    </div>
  );
}

function Angka({
  label,
  nilai,
  utama = false,
  perhatian = false,
}: {
  label: string;
  nilai: string;
  utama?: boolean;
  perhatian?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[0.625rem] font-bold uppercase tracking-wider text-tinta-500">
        {label}
      </span>
      <span
        className={[
          "tabular-nums",
          utama
            ? "text-[1.0625rem] font-extrabold text-forest-900"
            : perhatian
              ? "text-[0.875rem] font-extrabold text-sela-800"
              : "text-[0.875rem] font-bold text-tinta-900",
        ].join(" ")}
      >
        {nilai}
      </span>
    </span>
  );
}

function Kotak({ label, nilai, utama = false }: { label: string; nilai: string; utama?: boolean }) {
  return (
    <div>
      <p className="text-[0.625rem] font-bold uppercase tracking-wider text-tinta-500">{label}</p>
      <p
        className={[
          "mt-0.5 tabular-nums",
          utama ? "text-[1.25rem] font-extrabold text-forest-900" : "text-[1rem] font-bold text-tinta-900",
        ].join(" ")}
      >
        {nilai}
      </p>
    </div>
  );
}

function Kecil({
  label,
  nilai,
  perhatian = false,
}: {
  label: string;
  nilai: string;
  perhatian?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[0.6875rem] font-semibold text-tinta-500">{label}</span>
      <span
        className={[
          "text-[0.8125rem] font-bold tabular-nums",
          perhatian ? "text-sela-800" : "text-tinta-900",
        ].join(" ")}
      >
        {nilai}
      </span>
    </span>
  );
}
