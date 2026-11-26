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

  /*
    ── SATU KARTU PER ANGKA, BUKAN SATU KARTU BERISI EMPAT ─────────────

    Dulu empat angka berbagi satu kotak, dipisah garis tipis. Pemilik
    meminta "Omzet hari ini" dan "Pesanan" jadi kartu masing-masing:
    angka yang berdiri sendiri bisa dibandingkan sekali lihat, sedangkan
    angka yang berbagi kotak terbaca sebagai satu paragraf.

    Kartu kedua dan ketiga lebih kecil dari yang pertama dengan sengaja.
    "Rata-rata per pesanan" dan "Item terjual" menjelaskan omzet — bukan
    angka yang dicari lebih dulu — jadi ukurannya mengikuti kepentingannya.
  */
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Kartu utama. `col-span-2` di layar lebar membuat omzet mengambil
            separuh baris: ia satu-satunya angka yang dibaca dengan jari
            menunjuk layar. */}
        <div className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3 shadow-[0_1px_2px_rgb(22_19_15/0.04)] sm:col-span-2 xl:col-span-1">
          <p className="text-[0.625rem] font-bold uppercase tracking-wider text-tinta-500">
            Omzet hari ini
          </p>
          <p className="mt-1 text-[1.75rem] font-extrabold leading-none tabular-nums text-forest-900 sm:text-[2rem]">
            {rupiah(r.omzet)}
          </p>
          <p className="mt-2 text-[0.6875rem] leading-snug text-tinta-500">
            Dari total tagihan lunas · bukan uang yang diserahkan tamu
          </p>
        </div>

        <div className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3 shadow-[0_1px_2px_rgb(22_19_15/0.04)]">
          <p className="text-[0.625rem] font-bold uppercase tracking-wider text-tinta-500">
            Pesanan lunas
          </p>
          <p className="mt-1 text-[1.75rem] font-extrabold leading-none tabular-nums text-tinta-900">
            {r.jumlah_pesanan}
          </p>
          <p className="mt-2 text-[0.6875rem] leading-snug text-tinta-500">
            Rata-rata {rupiah(r.rata_rata)} · {r.item} item terjual
          </p>
        </div>

        <div className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3 shadow-[0_1px_2px_rgb(22_19_15/0.04)]">
          <p className="text-[0.625rem] font-bold uppercase tracking-wider text-tinta-500">
            Tunai
          </p>
          <p className="mt-1 text-[1.25rem] font-extrabold leading-none tabular-nums text-tinta-900">
            {rupiah(r.tunai)}
          </p>
          <p className="mt-2 text-[0.6875rem] leading-snug text-tinta-500">
            Non-tunai {rupiah(r.nontunai)}
          </p>
        </div>

        {/*
          Kartu "Belum dibayar" hanya muncul bila ADA. Angka nol yang selalu
          tampil membuat kasir berhenti membacanya — dan saat benar-benar
          ada yang belum dibayar, ia tidak menyadarinya. Warnanya sela
          (oranye) karena ini pekerjaan, bukan pencapaian.
        */}
        {r.belum_bayar > 0 ? (
          <div className="rounded-[0.875rem] border border-sela-500/40 bg-sela-50 p-3">
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-sela-800">
              Belum dibayar
            </p>
            <p className="mt-1 text-[1.25rem] font-extrabold leading-none tabular-nums text-sela-800">
              {rupiah(r.nilai_belum_bayar)}
            </p>
            <p className="mt-2 text-[0.6875rem] leading-snug text-sela-800/80">
              {r.belum_bayar} pesanan menunggu kasir · tidak masuk omzet
            </p>
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-[0.625rem] leading-snug text-tinta-500">
        Sejak 00.00 WIB. Pesanan yang belum dibayar tidak masuk omzet.
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


