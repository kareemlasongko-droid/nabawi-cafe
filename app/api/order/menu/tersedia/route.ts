/**
 * GET /api/order/menu/tersedia — status ketersediaan menu (publik, baca saja).
 *
 * Kenapa terpisah dari /api/order/kasir: portal pelanggan tidak boleh
 * membaca data kasir (tagihan, panggilan, nama tamu lain). Yang dibutuhkan
 * hanya "menu mana yang masih ada", dan itu memang informasi publik.
 *
 * Kenapa tidak memuat ulang seluruh halaman: K-08 meminta tanda habis
 * LANGSUNG berlaku di portal pelanggan. Memuat ulang halaman akan
 * mengosongkan pencarian, kategori terpilih, dan posisi gulir — tamu yang
 * sedang memilih menu kehilangan tempatnya. Endpoint kecil ini memungkinkan
 * daftar menu diperbarui di latar belakang tanpa menyentuh keranjang.
 *
 * Jawabannya sengaja ramping ({id, tersedia, rekomendasi}) supaya bisa
 * ditanyakan tiap 5 detik tanpa membebani kuota paket gratis.
 */
import { NextResponse } from "next/server";
import { ambilMenu } from "@/app/lib/order/data";
import { PESAN_ENV_KOSONG, punyaEnvBaca, punyaKunciServer } from "@/app/lib/order/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!punyaEnvBaca()) {
    return NextResponse.json(
      { pesan: PESAN_ENV_KOSONG, menu: [], kode: "env" },
      { status: 503 }
    );
  }

  /*
    SELALU dari database — termasuk saat kunci server belum dipasang.

    Dulu, tanpa kunci server, blok ini bisa mengembalikan MENU_CONTOH
    (salinan di kode). Itu membuat endpoint ini tampak sehat walau database
    tidak pernah dibaca, dan itulah yang sempat menyesatkan pemilik: situs
    tampil berisi 126 menu, padahal environment kosong.

    Menu memang publik (policy SELECT terbuka), jadi tidak butuh kunci
    server. Yang tidak bisa dilakukan tanpa kunci server adalah MENULIS.
  */
  const res = await ambilMenu();
  if (!res.ok) {
    // Jangan mengosongkan menu pelanggan saat database sedang tidak bisa
    // dihubungi. Klien yang memutuskan memakai data lama.
    return NextResponse.json({ pesan: res.pesan, menu: [] }, { status: 503 });
  }

  return NextResponse.json({
    // `rekomendasi` ikut dikirim: tanpa itu, admin yang menandai bintang
    // harus menunggu pelanggan memuat ulang halaman. Satu boolean per menu
    // menambah ±17 byte — jauh lebih murah daripada satu tamu yang melihat
    // urutan lama.
    menu: res.data.menu.map((m) => ({
      id: m.id,
      tersedia: m.tersedia,
      rekomendasi: m.rekomendasi === true,
    })),
    /*
      `demo` di sini berarti: "penandaan habis dari kasir belum tentu
      tersimpan". Itu benar — tanpa kunci server, PATCH ketersediaan hanya
      hidup di memori Worker. Bedanya dengan dulu: MENUNYA sendiri tetap
      data database, bukan salinan.
    */
    demo: !punyaKunciServer(),
  });
}
