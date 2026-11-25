/**
 * GET /api/order/pelayan — pesanan yang siap diantar.
 *
 * Dulu route ini juga mengirim panggilan meja ("panggil pelayan" dan
 * "minta bill"). Fitur panggilan sudah dihapus dari aplikasi, jadi yang
 * tersisa hanya daftar antar — satu pekerjaan, satu layar.
 */
import { NextResponse } from "next/server";
import { ambilPesananAktif } from "@/app/lib/order/data";
import { bacaPilihan } from "@/app/lib/order/aturan";
import { db, punyaKunciServer } from "@/app/lib/order/db";
import { PESAN_ENV_KOSONG, punyaEnvBaca } from "@/app/lib/order/db";
import { pesanModeContoh, statusModeContoh } from "@/app/lib/order/mode-contoh";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = await statusModeContoh(punyaKunciServer());

  /*
    Pesanan siap SELALU dari database.

    Dulu, tanpa kunci server, pelayan menerima daftar pesanan siap antar
    karangan. Itu paling berbahaya di antara semua portal: pelayan akan
    membawa hidangan ke meja yang pesanannya tidak pernah ada.
  */
  if (!punyaEnvBaca()) {
    return NextResponse.json(
      { pesan: PESAN_ENV_KOSONG, demo: mode.aktif, kode: "env" },
      { status: 503 }
    );
  }

  const [pesananRes, mejaRes] = await Promise.all([
    ambilPesananAktif(),
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

  return NextResponse.json({ siap, demo: false });
}
