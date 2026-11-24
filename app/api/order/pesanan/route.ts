/**
 * POST /api/order/pesanan — pelanggan mengirim pesanan.
 *
 * Yang diperiksa di sini (berurutan, karena urutannya bagian dari aturan):
 * 1. Jam buka (P-12). Ditolak sebelum menyentuh database.
 * 2. Bentuk data (validasiPesananMasuk) — termasuk batas jumlah item.
 * 3. Nomor meja harus ada di database.
 * 4. Baru disimpan; harga diambil dari database, bukan dari browser.
 *
 * Batas per menit per perangkat (PRD bagian 13) dijaga di memori proses:
 * 5 pesanan per menit per sesi. Ini bukan pengaman kuat (server bisa
 * di-restart), tetapi cukup menahan ketukan ganda dan iseng ringan tanpa
 * menambah tabel.
 */
import { NextResponse } from "next/server";
import { cekBuka, validasiPesananMasuk } from "@/app/lib/order/aturan";
import { buatPesanan } from "@/app/lib/order/data";
import { ambilBatasBayarMenit } from "@/app/lib/order/katalog";
import { ambilJamBuka } from "@/app/lib/order/jam-buka";
import { punyaKunciServer } from "@/app/lib/order/db";
import { pesanModeContoh, statusModeContoh } from "@/app/lib/order/mode-contoh";

export const dynamic = "force-dynamic";

const JENDELA_MS = 60_000;
const BATAS_PER_JENDELA = 5;

const g = globalThis as unknown as { __laju?: Map<string, number[]> };
const laju = (g.__laju ??= new Map<string, number[]>());

function terlaluSering(sesi: string): boolean {
  const kini = Date.now();
  const daftar = (laju.get(sesi) ?? []).filter((t) => kini - t < JENDELA_MS);
  if (daftar.length >= BATAS_PER_JENDELA) return true;
  daftar.push(kini);
  laju.set(sesi, daftar);
  return false;
}

export async function POST(req: Request) {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  /*
    1. Jam buka (P-12).

    `lewatiJamBuka` HANYA berlaku di mode demo dan hanya untuk pengujian.
    Tanpa ini, alat uji hanya bisa berjalan pada jam operasional cafe —
    dan kegagalan "pesanan terkirim" yang muncul di luar jam buka mudah
    disalahartikan sebagai bug. Di mode sungguhan (kunci server terpasang)
    flag ini diabaikan sepenuhnya, jadi tidak ada jalan memesan di luar jam.
  */
  const bolehLewati =
    !punyaKunciServer() &&
    badan !== null &&
    typeof badan === "object" &&
    (badan as { lewatiJamBuka?: boolean }).lewatiJamBuka === true;

  const jamAktif = await ambilJamBuka();
  const buka = cekBuka(new Date(), jamAktif.jam);
  if (!buka.buka && !bolehLewati) {
    return NextResponse.json({ pesan: buka.alasan, kode: "tutup" }, { status: 409 });
  }

  // 2. Validasi
  const v = validasiPesananMasuk(badan);
  if (!v.ok) return NextResponse.json({ pesan: v.pesan }, { status: 400 });

  // Batas laju
  if (terlaluSering(v.bersih.sesi)) {
    return NextResponse.json(
      { pesan: "Terlalu banyak pesanan dari perangkat ini. Tunggu sebentar." },
      { status: 429 }
    );
  }

  // 3-4. Simpan
  /*
    PESANAN PELANGGAN WAJIB MENDARAT DI DATABASE.

    Dulu, tanpa kunci server, pesanan "berhasil" dikirim ke store di
    memori: pelanggan melihat konfirmasi, nomor pesanan keluar, dan tidak
    ada satu pun yang sampai ke kasir atau dapur. Itu kegagalan yang paling
    mahal di sistem ini — tamu duduk menunggu makanan yang tidak pernah
    masuk pesanan.

    Karena itu tanpa kunci server pesanan DITOLAK, dengan pesan yang bisa
    dibaca tamu ("panggil pelayan"), bukan pesan teknis soal env.
  */
  if (!punyaKunciServer()) {
    const mode = await statusModeContoh(false);
    return NextResponse.json(
      {
        pesan:
          "Pesanan belum bisa dikirim lewat aplikasi. Silakan panggil pelayan " +
          "untuk mencatat pesanan Anda.",
        sebab: pesanModeContoh(mode),
        demo: true,
      },
      { status: 503 }
    );
  }

  const batasBayarMenit = await ambilBatasBayarMenit();
  const hasil = await buatPesanan({ ...v.bersih, batasBayarMenit });
  if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: 400 });

  return NextResponse.json(hasil.data);
}

/**
 * GET /api/order/pesanan?sesi=... — status pesanan untuk halaman pelanggan.
 * Hanya mengembalikan pesanan milik sesi itu, jadi perangkat tidak bisa
 * mengintip pesanan meja lain hanya dengan menebak nomor.
 */
export async function GET(req: Request) {
  const sesi = new URL(req.url).searchParams.get("sesi") ?? "";
  if (!sesi) return NextResponse.json({ pesanan: [] });

  if (!punyaKunciServer()) {
    /*
      Tidak ada pesanan karangan. Tamu yang pesanannya ditolak memang tidak
      punya pesanan, dan daftar kosong adalah jawaban yang benar.
    */
    return NextResponse.json({ pesanan: [], demo: true });
  }

  const { db } = await import("@/app/lib/order/db");
  const res = await db<
    {
      id: number;
      nomor: string;
      status: string;
      created_at: string;
      total_item: number;
      status_bayar: string;
      kedaluwarsa_at: string | null;
      tagihan_id: number | null;
    }[]
  >("pesanan", {
    /*
      `status_bayar` dan `kedaluwarsa_at` ikut dikirim: tanpa keduanya,
      portal pelanggan menampilkan "Menunggu kasir" untuk pesanan yang
      sebenarnya belum dibayar — dan tamu menunggu makanan yang belum
      pernah masuk dapur.
    */
    q: `select=id,nomor,status,created_at,total_item,status_bayar,kedaluwarsa_at,tagihan_id&sesi_id=eq.${encodeURIComponent(
      sesi
    )}&order=created_at.desc&limit=10`,
    /*
      Header ini WAJIB, bukan hiasan. Policy RLS pesanan_baca_sesi berbunyi
      "sesi_id = header x-sesi-order". Tanpa header, PostgREST menerima
      permintaan yang sah tetapi RLS mengembalikan nol baris — tamu melihat
      "belum ada pesanan" padahal pesanannya tersimpan. Tidak terdeteksi di
      mode demo karena demo memfilter sendiri di memori.
    */
    headers: { "x-sesi-order": sesi },
  });

  if (!res.ok) return NextResponse.json({ pesan: res.pesan, pesanan: [] }, { status: 200 });
  /*
    Total tagihan ikut dikirim untuk pesanan yang menunggu bayar: portal
    menampilkannya di layar pembayaran, dan mengambilnya satu per satu
    lewat request terpisah akan memperlambat checkout di jaringan kafe.

    Tagihan diambil lewat `tagihan_id` milik pesanan — bukan lewat meja.
    Semenjak tagihan per-pesanan, satu meja bisa punya beberapa tagihan,
    dan mengambil yang salah berarti tamu melihat nominal orang lain.
  */
  const perluTotal = res.data
    .filter((p) => p.status_bayar === "menunggu")
    .map((p) => (p as { tagihan_id?: number | null }).tagihan_id)
    .filter((x): x is number => typeof x === "number");

  const petaTotal = new Map<number, number>();
  if (perluTotal.length > 0) {
    const tag = await db<{ id: number; total: number }[]>("tagihan", {
      q: `select=id,total&id=in.(${perluTotal.join(",")})`,
    });
    if (tag.ok) for (const t of tag.data) petaTotal.set(t.id, t.total);
  }

  return NextResponse.json({
    pesanan: res.data.map((p) => ({
      ...p,
      total: petaTotal.get((p as { tagihan_id?: number | null }).tagihan_id ?? -1) ?? null,
    })),
  });
}
