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
import { PUNYA_KUNCI_SERVER } from "@/app/lib/order/db";
import {
  demoBuatPesanan,
  demoAmbilPesanan,
  demoMenuDenganStatus,
  MENU_CONTOH,
} from "@/app/lib/order/demo";
import { ambilMenu } from "@/app/lib/order/data";

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
    !PUNYA_KUNCI_SERVER &&
    badan !== null &&
    typeof badan === "object" &&
    (badan as { lewatiJamBuka?: boolean }).lewatiJamBuka === true;

  const buka = cekBuka();
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
  if (!PUNYA_KUNCI_SERVER) {
    // Mode demo. Harga diambil dari menu asli bila bisa dibaca; kalau
    // database tidak terjangkau, pakai MENU_CONTOH — daftar yang sama
    // dengan yang ditampilkan ke pelanggan, jadi harga yang dilihat
    // pelanggan = harga yang dihitung. (Daftar kosong akan membuat semua
    // item Rp0 dan tagihan nol — itu bug yang pernah terjadi di sini.)
    const menu = await ambilMenu();
    const hasil = demoBuatPesanan({
      ...v.bersih,
      /*
        Tanda "habis" dari kasir/dapur (K-08, D-07) hidup di store demo,
        bukan di MENU_CONTOH. Tanpa demoMenuDenganStatus di sini, menu yang
        sudah ditandai habis tetap bisa dipesan di mode demo — dan uji
        otomatis akan melaporkannya lulus, padahal produksi menolaknya.
      */
      menu: demoMenuDenganStatus(menu.ok ? menu.data.menu : MENU_CONTOH.menu),
    });
    if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: 400 });
    return NextResponse.json({ ...hasil, demo: true });
  }

  const hasil = await buatPesanan(v.bersih);
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

  if (!PUNYA_KUNCI_SERVER) {
    return NextResponse.json({ pesanan: demoAmbilPesanan(sesi), demo: true });
  }

  const { db } = await import("@/app/lib/order/db");
  const res = await db<
    { id: number; nomor: string; status: string; created_at: string; total_item: number }[]
  >("pesanan", {
    q: `select=id,nomor,status,created_at,total_item&sesi_id=eq.${encodeURIComponent(
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
  return NextResponse.json({ pesanan: res.data });
}
