/**
 * PATCH /api/order/status — memindahkan status pesanan.
 *
 * Dipakai kasir (terima/tolak), dapur (proses/siap), pelayan (diantar).
 * Aturan transisi ada di data.ts (transisiSah): status hanya boleh maju
 * satu langkah, dan pesanan yang sudah selesai tidak bisa diubah lagi.
 */
import { NextResponse } from "next/server";
import { ubahStatus } from "@/app/lib/order/data";
import { punyaKunciServer } from "@/app/lib/order/db";
import { pesanModeContoh, statusModeContoh } from "@/app/lib/order/mode-contoh";
import type { StatusPesanan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

const SAH: StatusPesanan[] = [
  "menunggu_konfirmasi",
  "diterima",
  "diproses",
  "siap",
  "diantar",
  "ditolak",
  "dibatalkan",
];

export async function PATCH(req: Request) {
  let badan: { id?: number; ke?: string; alasan?: string; oleh?: string };
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  const id = Number(badan.id);
  const ke = badan.ke as StatusPesanan;

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ pesan: "Nomor pesanan tidak sah." }, { status: 400 });
  }
  if (!SAH.includes(ke)) {
    return NextResponse.json({ pesan: "Status tujuan tidak dikenal." }, { status: 400 });
  }
  // Menolak WAJIB beralasan (K-02).
  if (ke === "ditolak" && !String(badan.alasan ?? "").trim()) {
    return NextResponse.json(
      { pesan: "Penolakan wajib memilih alasan." },
      { status: 400 }
    );
  }

  /*
    Status pesanan HARUS berpindah di database.

    Dulu, tanpa kunci server, status berpindah di memori: kasir melihat
    pesanan "diterima", dapur "diproses", pelayan "diantar" — semua di
    perangkat masing-masing, tidak ada yang benar-benar berubah. Tiga
    portal bisa menampilkan tiga keadaan berbeda untuk pesanan yang sama.
  */
  if (!punyaKunciServer()) {
    const mode = await statusModeContoh(false);
    return NextResponse.json(
      { pesan: pesanModeContoh(mode) || "Kunci server belum dipasang, status tidak bisa diubah.", demo: true },
      { status: 503 }
    );
  }

  const hasil = await ubahStatus(id, ke, {
    alasan: badan.alasan,
    oleh: badan.oleh ?? "internal",
  });
  if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: 400 });

  /*
    ── KEMBALIKAN KEADAAN YANG CUKUP UNTUK MEMUTUSKAN ──────────────────

    Dulu hanya `status` yang terlihat di respons, sehingga pemanggil tidak
    bisa tahu apakah pesanan yang baru dipindahkan itu sudah dibayar.
    Itu sebabnya bug "pesanan hilang dari semua papan" tidak terlihat:
    responsnya tampak wajar padahal statusnya sudah masuk alur dapur tanpa
    uang.

    `status_bayar` dan `nomor` dikembalikan eksplisit — dua kolom yang
    dipakai setiap pemanggil untuk memutuskan langkah berikutnya.
  */
  return NextResponse.json({
    ok: true,
    pesanan: {
      ...hasil.data,
      status_bayar: hasil.data.status_bayar,
      nomor: hasil.data.nomor,
    },
  });
}
