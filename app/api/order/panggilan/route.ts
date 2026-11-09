/**
 * POST /api/order/panggilan — pelanggan memanggil pelayan atau minta bill.
 *
 * Dibatasi: satu panggilan jenis yang sama per meja tidak boleh menumpuk.
 * Tanpa batas ini, satu pelanggan yang menekan tombol lima kali akan
 * memunculkan lima kartu di portal pelayan untuk satu kebutuhan.
 */
import { NextResponse } from "next/server";
import { ambilMeja } from "@/app/lib/order/data";
import { buatPanggilan } from "@/app/lib/order/data";
import { PUNYA_KUNCI_SERVER, db } from "@/app/lib/order/db";
import { demoPanggilan, demoPanggilanSemua, demoMeja } from "@/app/lib/order/demo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let badan: { meja?: string; jenis?: string };
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  const mejaNomor = String(badan.meja ?? "").trim();
  const jenis = badan.jenis === "bill" ? "bill" : badan.jenis === "pelayan" ? "pelayan" : null;

  if (!mejaNomor) return NextResponse.json({ pesan: "Nomor meja kosong." }, { status: 400 });
  if (!jenis) return NextResponse.json({ pesan: "Jenis panggilan tidak dikenal." }, { status: 400 });

  if (!PUNYA_KUNCI_SERVER) {
    const meja = demoMeja().find((m) => m.nomor === mejaNomor);
    if (!meja) return NextResponse.json({ pesan: "Nomor meja tidak dikenali." }, { status: 404 });
    // demoPanggilan mengembalikan panggilan yang sudah ada bila sama,
    // jadi kita bandingkan waktu buatnya untuk menandai "sudahAda".
    const sebelum = demoPanggilanSemua().length;
    const p = demoPanggilan(meja.id, jenis);
    const sudahAda = demoPanggilanSemua().length === sebelum;
    return NextResponse.json({ ok: true, panggilan: p, sudahAda, demo: true });
  }

  const mejaRes = await ambilMeja(mejaNomor);
  if (!mejaRes.ok) return NextResponse.json({ pesan: mejaRes.pesan }, { status: 404 });
  const meja = mejaRes.data as { id: number };

  // Jangan menumpuk panggilan yang sama.
  const ada = await db<{ id: number }[]>("panggilan", {
    q: `select=id&meja_id=eq.${meja.id}&jenis=eq.${jenis}&ditangani_at=is.null&limit=1`,
  });
  if (ada.ok && ada.data.length > 0) {
    return NextResponse.json({ ok: true, sudahAda: true });
  }

  const hasil = await buatPanggilan(meja.id, jenis);
  if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: 400 });

  return NextResponse.json({ ok: true, panggilan: hasil.data });
}
