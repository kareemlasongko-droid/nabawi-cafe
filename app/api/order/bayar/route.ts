/**
 * POST /api/order/bayar — kasir mencatat pembayaran manual (K-09).
 *
 * Pembayaran tunai kurang dari total DITOLAK. Ini bukan kehati-hatian
 * berlebihan: kalau dibiarkan, tagihan bisa tertutup dengan kas lebih
 * sedikit dan selisihnya baru ketahuan saat tutup harian (metrik PRD
 * bagian 15: selisih kas Rp0).
 */
import { NextResponse } from "next/server";
import { catatPembayaran } from "@/app/lib/order/data";
import { pembayaranCukup } from "@/app/lib/order/aturan";
import { punyaKunciServer, db } from "@/app/lib/order/db";
import { pesanModeContoh, statusModeContoh } from "@/app/lib/order/mode-contoh";
import type { MetodeBayar, Tagihan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

const METODE: MetodeBayar[] = ["tunai", "qris_kasir", "kartu"];

export async function POST(req: Request) {
  let badan: { tagihan_id?: number; metode?: string; diterima?: number; kasir?: string };
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  const id = Number(badan.tagihan_id);
  const metode = badan.metode as MetodeBayar;
  const diterima = Math.round(Number(badan.diterima));
  const kasir = String(badan.kasir ?? "kasir").slice(0, 40);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ pesan: "Tagihan tidak sah." }, { status: 400 });
  }
  if (!METODE.includes(metode)) {
    return NextResponse.json({ pesan: "Metode pembayaran tidak dikenal." }, { status: 400 });
  }
  if (!Number.isFinite(diterima) || diterima < 0) {
    return NextResponse.json({ pesan: "Nominal tidak sah." }, { status: 400 });
  }

  const mode = await statusModeContoh(punyaKunciServer());

  /*
    Tagihan yang dibayar SELALU dari database.

    Dulu, tanpa kunci server, pembayaran dicatat ke tagihan karangan di
    memori: kasir melihat "Lunas" dan struk tercetak, sementara pemilik
    tidak menerima satu rupiah pun di catatan mana pun. Itu jenis
    kesalahan yang baru ketahuan saat tutup buku.

    Tanpa kunci server kita tidak bisa menulis, jadi jawabannya jelas:
    tolak, dan sebutkan sebabnya. Nominal tetap diperiksa lebih dulu
    supaya pesan "nominal kurang" tidak tertutup oleh masalah env.
  */
  if (!punyaKunciServer()) {
    return NextResponse.json(
      { pesan: pesanModeContoh(mode) || "Kunci server belum dipasang, pembayaran tidak bisa dicatat.", demo: true },
      { status: 503 }
    );
  }

  const t = await db<Tagihan[]>("tagihan", { q: `select=*&id=eq.${id}&limit=1` });
  if (!t.ok) return NextResponse.json({ pesan: t.pesan }, { status: 400 });
  if (t.data.length === 0) {
    return NextResponse.json({ pesan: "Tagihan tidak ditemukan." }, { status: 404 });
  }

  if (!pembayaranCukup(metode, t.data[0].total, diterima)) {
    return NextResponse.json(
      { pesan: `Nominal kurang. Tagihan ${t.data[0].total}.` },
      { status: 400 }
    );
  }

  const hasil = await catatPembayaran({
    tagihan_id: id,
    metode,
    diterima,
    kasir,
  });
  if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: 400 });

  return NextResponse.json({ ok: true, tagihan: hasil.data.tagihan });
}
