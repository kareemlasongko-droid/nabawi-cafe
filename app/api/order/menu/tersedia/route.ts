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
 * Jawabannya sengaja ramping ({id, tersedia}) supaya bisa ditanyakan tiap
 * 15 detik tanpa membebani kuota paket gratis.
 */
import { NextResponse } from "next/server";
import { ambilMenu } from "@/app/lib/order/data";
import { PUNYA_KUNCI_SERVER } from "@/app/lib/order/db";
import { demoMenuDenganStatus, MENU_CONTOH } from "@/app/lib/order/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!PUNYA_KUNCI_SERVER) {
    return NextResponse.json({
      menu: demoMenuDenganStatus(MENU_CONTOH.menu).map((m) => ({
        id: m.id,
        tersedia: m.tersedia,
      })),
      demo: true,
    });
  }

  const res = await ambilMenu();
  if (!res.ok) {
    // Jangan mengosongkan menu pelanggan saat database sedang tidak bisa
    // dihubungi. Klien yang memutuskan memakai data lama.
    return NextResponse.json({ pesan: res.pesan }, { status: 503 });
  }

  return NextResponse.json({
    menu: res.data.menu.map((m) => ({ id: m.id, tersedia: m.tersedia })),
    demo: false,
  });
}
