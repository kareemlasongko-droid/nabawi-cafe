/**
 * GET /api/order/invoice/:id — invoice satu pesanan.
 *
 * ── DUA PENGGUNA, DUA CARA MASUK ──────────────────────────────────────
 *
 *   · PELANGGAN  → wajib menyertakan `?sesi=<sesi perangkat>`.
 *                  Tanpa itu, siapa pun yang menebak nomor pesanan bisa
 *                  membaca nomor WhatsApp tamu lain — dan invoice memuat
 *                  nomor itu.
 *
 *   · KASIR      → menyertakan `?kunci=1` dan memakai kunci server.
 *                  Kasir tidak punya `sesi` milik tamu; ia bekerja dari
 *                  nomor pesanan yang dibacakan tamu di depan meja.
 *
 * Kunci server TIDAK pernah dikirim ke browser: route ini yang memutuskan
 * boleh atau tidak, dan `db()` memakai kunci server di sisi Worker saja.
 */
import { NextResponse } from "next/server";
import { ambilInvoice } from "@/app/lib/order/invoice";
import { punyaEnvBaca, punyaKunciServer, PESAN_ENV_KOSONG } from "@/app/lib/order/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!punyaEnvBaca()) {
    return NextResponse.json({ pesan: PESAN_ENV_KOSONG }, { status: 503 });
  }

  const { id: idMentah } = await params;
  const id = Number(idMentah);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ pesan: "Nomor pesanan tidak sah." }, { status: 400 });
  }

  const url = new URL(req.url);
  const sesi = url.searchParams.get("sesi");
  const modKasir = url.searchParams.get("kunci") === "1";

  /*
    Jalur kasir hanya berguna bila kunci server benar-benar terpasang.
    Tanpa itu, `?kunci=1` akan menjadi pintu terbuka: siapa pun bisa
    menambahkan satu parameter dan membaca invoice orang lain.
  */
  if (modKasir) {
    if (!punyaKunciServer()) {
      return NextResponse.json(
        { pesan: "Kunci server belum dipasang, invoice kasir tidak bisa dibuka." },
        { status: 503 },
      );
    }
    const hasil = await ambilInvoice(id);
    if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: hasil.status });

    /*
      ── JENDELA WAKTU, BUKAN ALASAN KECANTIKAN ──────────────────────

      Portal kasir di aplikasi ini belum punya PIN/sesi staf — itu masalah
      lama, bukan yang diperkenalkan di sini. Tetapi invoice membawa nomor
      WhatsApp, dan `?kunci=1` membaca dengan kunci server, jadi tanpa
      batas siapa pun bisa menelusuri id 1, 2, 3, … dan mengunduh nomor
      seluruh riwayat tamu. `/api/order/kasir` tidak membuka itu: ia hanya
      mengirim pesanan yang sedang aktif.

      Batas yang dipakai: pesanan yang BELUM lunas (kasir perlu melihat
      rincian sebelum menagih) atau dilunasi dalam 24 jam terakhir (cetak
      ulang struk di hari yang sama). Arsip lama tidak terbuka dari
      internet — untuk itu kasir memakai laporan, bukan halaman publik.

      GANTI dengan PIN kasir begitu autentikasi staf ada; jendela ini
      hanya penutup sementara, bukan pengganti.
    */
    const baruSaja = (() => {
      if (hasil.data.status_bayar !== "lunas") return true;
      if (!hasil.data.dibayar_at) return false;
      const t = new Date(hasil.data.dibayar_at).getTime();
      if (!Number.isFinite(t)) return false;
      return Date.now() - t <= 24 * 60 * 60 * 1000;
    })();

    if (!baruSaja) {
      return NextResponse.json(
        {
          pesan:
            "Invoice ini lebih dari 24 jam lalu. Buka lewat laporan penjualan, " +
            "bukan dari halaman kasir.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ invoice: hasil.data });
  }

  if (!sesi) {
    return NextResponse.json(
      { pesan: "Sesi perangkat tidak dikenali. Buka invoice dari halaman pesanan Anda." },
      { status: 400 },
    );
  }

  const hasil = await ambilInvoice(id, { sesi });
  if (!hasil.ok) return NextResponse.json({ pesan: hasil.pesan }, { status: hasil.status });

  return NextResponse.json({ invoice: hasil.data });
}
