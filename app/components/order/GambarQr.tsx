"use client";

/**
 * Gambar QR dari teks — SVG, bukan <canvas> atau berkas PNG.
 *
 * ── KENAPA SVG ────────────────────────────────────────────────────────
 *
 * QR ini akan DICETAK dan ditempel di meja. canvas menghasilkan bitmap
 * yang pecah saat diperbesar; SVG tetap tajam di ukuran apa pun tanpa
 * perlu memilih resolusi lebih dulu. Ukurannya ditentukan `size` dalam
 * piksel layar, tetapi saat dicetak ia mengikuti ukuran kertas.
 *
 * Satu `<path>` untuk semua modul gelap (lihat `jalurSvg`) — 20 QR di satu
 * halaman berarti ~6.000 modul, dan 6.000 elemen DOM membuat halaman
 * admin tersendat saat digulir.
 */

import { useMemo } from "react";
import { buatQr, jalurSvg } from "@/app/lib/order/qr";

export function GambarQr({
  teks,
  /** Sisi gambar dalam piksel CSS. */
  ukuran = 128,
  /** Judul untuk pembaca layar; QR sendiri tidak terbaca mesin pembaca. */
  label,
}: {
  teks: string;
  ukuran?: number;
  label?: string;
}) {
  const qr = useMemo(() => {
    try {
      return { ok: true as const, nilai: buatQr(teks) };
    } catch (e) {
      return { ok: false as const, pesan: e instanceof Error ? e.message : "Teks terlalu panjang." };
    }
  }, [teks]);

  if (!qr.ok) {
    return (
      <p className="rounded-[0.5rem] border border-sela-200 bg-sela-50 p-2 text-[0.6875rem] text-sela-800">
        QR gagal dibuat: {qr.pesan}
      </p>
    );
  }

  /*
    Quiet zone 4 modul WAJIB ada di dalam SVG: pemindai butuh bidang
    kosong di sekeliling QR untuk menemukan tepinya. Tanpa itu, QR yang
    ditempel rapat di kartu meja sering gagal terbaca — dan gejalanya
    terlihat seperti "QR-nya rusak", bukan "margin-nya kurang".
  */
  const tenang = 4;
  const kotak = qr.nilai.ukuran + tenang * 2;

  return (
    <svg
      viewBox={`0 0 ${kotak} ${kotak}`}
      width={ukuran}
      height={ukuran}
      role="img"
      aria-label={label ?? "Kode QR"}
      shapeRendering="crispEdges"
      className="block"
    >
      <rect width={kotak} height={kotak} fill="#ffffff" />
      <path d={jalurSvg(qr.nilai)} fill="#000000" transform={`translate(${tenang} ${tenang})`} />
    </svg>
  );
}
