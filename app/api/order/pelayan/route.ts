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
import { db, punyaKunciServer } from "@/app/lib/order/db";
import { PESAN_ENV_KOSONG, punyaEnvBaca } from "@/app/lib/order/db";
import { pesanModeContoh, statusModeContoh } from "@/app/lib/order/mode-contoh";
import type { Panggilan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = await statusModeContoh(punyaKunciServer());

  /*
    Pesanan siap dan panggilan meja SELALU dari database.

    Dulu, tanpa kunci server, pelayan menerima daftar pesanan siap antar
    dan panggilan karangan. Itu paling berbahaya di antara semua portal:
    pelayan akan berjalan ke meja yang tidak memanggil, sementara panggilan
    sungguhan tidak pernah muncul.
  */
  if (!punyaEnvBaca()) {
    return NextResponse.json(
      { pesan: PESAN_ENV_KOSONG, demo: mode.aktif, kode: "env" },
      { status: 503 }
    );
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
