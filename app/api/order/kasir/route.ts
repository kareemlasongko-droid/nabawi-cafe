/**
 * /api/order/kasir — data untuk portal kasir.
 *
 * GET  : pesanan aktif + meja + tagihan terbuka + panggilan.
 *        Semuanya dalam SATU permintaan. Kalau dipecah, tablet kasir
 *        melakukan 4 permintaan tiap 4 detik dan itu pemborosan di
 *        jaringan cafe yang tidak selalu kuat.
 * POST : aksi kecil (menangani panggilan).
 */
import { NextResponse } from "next/server";
import { ambilPesananAktif } from "@/app/lib/order/data";
import { db, PUNYA_KUNCI_SERVER } from "@/app/lib/order/db";
import {
  demoMeja,
  demoPanggilanSemua,
  demoTagihan,
  demoAmbilPesanan,
  demoItemPesanan,
} from "@/app/lib/order/demo";
import type { Meja, Panggilan, Tagihan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!PUNYA_KUNCI_SERVER) {
    const meja = demoMeja().map((m) => ({
      ...m,
      tagihan: demoTagihan().find((t) => t.meja_id === m.id && t.status !== "lunas") ?? null,
    }));
    const pesanan = demoAmbilPesanan().filter((p) =>
      ["menunggu_konfirmasi", "diterima", "diproses", "siap"].includes(p.status)
    );
    const panggilan = demoPanggilanSemua().filter((g) => !g.ditangani_at);

    return NextResponse.json({
      pesanan: pesanan.map((p) => ({
        ...p,
        meja_nomor: meja.find((m) => m.id === p.meja_id)?.nomor ?? String(p.meja_id),
        items: demoItemPesanan(p.id),
      })),
      meja,
      panggilan: panggilan.map((g) => ({
        ...g,
        meja_nomor: meja.find((m) => m.id === g.meja_id)?.nomor ?? "",
      })),
      demo: true,
    });
  }

  const [pesananRes, mejaRes, tagihanRes, panggilanRes] = await Promise.all([
    ambilPesananAktif(),
    db<Meja[]>("meja", { q: "select=*&order=nomor.asc" }),
    db<Tagihan[]>("tagihan", { q: "select=*&status=neq.lunas&order=dibuka_at.asc" }),
    db<Panggilan[]>("panggilan", { q: "select=*&ditangani_at=is.null&order=dibuat_at.asc" }),
  ]);

  if (!pesananRes.ok) return NextResponse.json({ pesan: pesananRes.pesan }, { status: 500 });
  if (!mejaRes.ok) return NextResponse.json({ pesan: mejaRes.pesan }, { status: 500 });
  if (!tagihanRes.ok) return NextResponse.json({ pesan: tagihanRes.pesan }, { status: 500 });

  const petaTagihan = new Map(tagihanRes.data.map((t) => [t.meja_id, t]));
  const petaNomor = new Map(mejaRes.data.map((m) => [m.id, m.nomor]));

  return NextResponse.json({
    pesanan: pesananRes.data,
    meja: mejaRes.data.map((m) => ({ ...m, tagihan: petaTagihan.get(m.id) ?? null })),
    panggilan: (panggilanRes.ok ? panggilanRes.data : []).map((g) => ({
      ...g,
      meja_nomor: petaNomor.get(g.meja_id) ?? "",
    })),
    demo: false,
  });
}

export async function POST(req: Request) {
  let badan: { aksi?: string; id?: number };
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  if (badan.aksi === "tangani_panggilan") {
    const id = Number(badan.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ pesan: "Panggilan tidak sah." }, { status: 400 });
    }

    if (!PUNYA_KUNCI_SERVER) {
      const g = demoPanggilanSemua().find((x) => x.id === id);
      if (g) g.ditangani_at = new Date().toISOString();
      return NextResponse.json({ ok: true, demo: true });
    }

    const res = await db("panggilan", {
      method: "PATCH",
      q: `id=eq.${id}`,
      body: { ditangani_at: new Date().toISOString() },
    });
    if (!res.ok) return NextResponse.json({ pesan: res.pesan }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ pesan: "Aksi tidak dikenal." }, { status: 400 });
}
