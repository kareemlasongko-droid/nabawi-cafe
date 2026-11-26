/**
 * /api/order/meja — daftar meja yang aktif, untuk tombol "Pesan" di /menu.
 *
 * ── KENAPA RUTE INI ADA ───────────────────────────────────────────────
 *
 * Tombol pesan di /menu sebelumnya menulis `/order?meja=&menu=<id>` —
 * nomor meja kosong. Portal pelanggan menolak nomor kosong dengan layar
 * "Scan QR di meja Anda", jadi tombol yang dimaksudkan MEMUDAHKAN
 * pemesanan justru mendaratkan tamu di jalan buntu. Ditemukan saat
 * memeriksa hasil deploy ke produksi, bukan di uji lokal — uji lokal hanya
 * memeriksa bahwa tautannya ada, bukan bahwa tautannya bisa dipakai.
 *
 * Rute ini hanya MEMBACA: tanpa kunci server tetap menjawab, karena
 * daftar meja bukan data rahasia (nomornya tertempel di meja). Yang
 * dikembalikan hanya nomor dan area — bukan id internal.
 */
import { NextResponse } from "next/server";
import { ambilMeja } from "@/app/lib/order/katalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasil = await ambilMeja();

  if (!hasil.ok) {
    /*
      200 dengan daftar kosong, BUKAN 500.

      Pemanggilnya adalah tombol di halaman katalog, dan kegagalan di sini
      tidak boleh membuat seluruh halaman menu gagal dimuat. Halaman akan
      menyembunyikan pemilih meja dan menampilkan petunjuk scan QR — dua
      jalan yang tetap benar tanpa daftar ini.
    */
    return NextResponse.json({ meja: [], pesan: hasil.pesan }, { status: 200 });
  }

  /*
    Buang kolom yang tidak dipakai layar. `select=*` mengembalikan id,
    status, kapasitas, dan kolom lain yang tidak ada gunanya di browser
    tamu — dan status meja ("terisi") bukan informasi yang perlu
    dibagikan ke halaman katalog publik.
  */
  const meja = (hasil.data as { nomor: string; area: string }[]).map((m) => ({
    nomor: m.nomor,
    area: m.area,
  }));

  return NextResponse.json({ meja });
}
