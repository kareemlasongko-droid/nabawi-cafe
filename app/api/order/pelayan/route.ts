/**
 * GET /api/order/pelayan — pesanan siap diantar + panggilan meja.
 *
 * Hanya dua hal ini yang dibutuhkan pelayan (PRD bagian 10). Mengirim
 * seluruh data meja dan tagihan hanya akan memperlambat HP pelayan yang
 * dipakai sambil berjalan.
 */
import { NextResponse } from "next/server";
import { ambilPesananAktif } from "@/app/lib/order/data";
import { bacaPilihan } from "@/app/lib/order/aturan";
import { db, PUNYA_KUNCI_SERVER } from "@/app/lib/order/db";
import { demoAmbilPesanan, demoItemPesanan, demoMeja, demoPanggilanSemua } from "@/app/lib/order/demo";
import type { Panggilan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!PUNYA_KUNCI_SERVER) {
    const meja = demoMeja();
    const siap = demoAmbilPesanan()
      .filter((p) => p.status === "siap")
      .map((p) => ({
        id: p.id,
        nomor: p.nomor,
        meja_nomor: meja.find((m) => m.id === p.meja_id)?.nomor ?? String(p.meja_id),
        nama_pemesan: p.nama_pemesan,
        created_at: p.created_at,
        siap_at: p.siap_at,
        items: demoItemPesanan(p.id).map((i) => ({
          id: i.id,
          nama_saat_pesan: i.nama_saat_pesan,
          jumlah: i.jumlah,
          pilihan: i.pilihan ?? [],
        })),
      }));
    const panggilan = demoPanggilanSemua()
      .filter((g) => !g.ditangani_at)
      .map((g) => ({
        ...g,
        meja_nomor: meja.find((m) => m.id === g.meja_id)?.nomor ?? "",
      }));
    return NextResponse.json({ siap, panggilan, demo: true });
  }

  const [pesananRes, panggilanRes, mejaRes] = await Promise.all([
    ambilPesananAktif(),
    db<Panggilan[]>("panggilan", { q: "select=*&ditangani_at=is.null&order=dibuat_at.asc" }),
    db<{ id: number; nomor: string }[]>("meja", { q: "select=id,nomor" }),
  ]);

  if (!pesananRes.ok) return NextResponse.json({ pesan: pesananRes.pesan }, { status: 500 });

  const petaNomor = new Map((mejaRes.ok ? mejaRes.data : []).map((m) => [m.id, m.nomor]));

  const siap = pesananRes.data
    .filter((p) => p.status === "siap")
    .map((p) => ({
      id: p.id,
      nomor: p.nomor,
      meja_nomor: p.meja_nomor,
      nama_pemesan: p.nama_pemesan,
      created_at: p.created_at,
      siap_at: p.siap_at,
      items: p.items.map((i) => ({
        id: i.id,
        nama_saat_pesan: i.nama_saat_pesan,
        jumlah: i.jumlah,
        // Pelayan perlu tahu saus/rasa saat mengantar: salah hidangan di
        // meja berarti hidangan kembali ke dapur.
        pilihan: bacaPilihan(i.pilihan),
      })),
    }));

  const panggilan = (panggilanRes.ok ? panggilanRes.data : []).map((g) => ({
    id: g.id,
    meja_nomor: petaNomor.get(g.meja_id) ?? "",
    jenis: g.jenis,
    dibuat_at: g.dibuat_at,
  }));

  return NextResponse.json({ siap, panggilan, demo: false });
}
