/**
 * POST /api/order/doku/notifikasi — webhook dari DOKU.
 *
 * ── INI SATU-SATUNYA SUMBER KEBENARAN "SUDAH DIBAYAR" ────────────────
 *
 * Bukan redirect setelah tamu kembali dari halaman DOKU. Redirect itu
 * hanya URL yang bisa diketik siapa pun: `/order?status=success` tidak
 * membuktikan apa pun, dan mempercayainya berarti siapa pun bisa makan
 * gratis dengan mengetik alamat.
 *
 * ── URUTAN YANG WAJIB ────────────────────────────────────────────────
 *
 *   1. Baca badan MENTAH (bukan hasil parse lalu stringify ulang — JSON
 *      yang di-round-trip berubah spasi dan bisa membalik urutan kunci,
 *      sehingga digest tidak cocok dan notifikasi sah ikut ditolak).
 *   2. Verifikasi signature SEBELUM menyentuh database.
 *   3. Cari pesanan dari invoice.
 *   4. Tandai lunas — idempoten.
 *   5. Jawab 200. DOKU akan mengulang bila kita menjawab selain 2xx, jadi
 *      kegagalan kita sendiri jangan sampai membuat DOKU membanjiri kita.
 */
import { NextResponse } from "next/server";
import { db, punyaKunciServer, PESAN_ENV_KOSONG } from "@/app/lib/order/db";
import { tandaiLunas, verifikasiNotifikasi } from "@/app/lib/order/doku";
import type { Pesanan } from "@/app/lib/order/tipe";

export const dynamic = "force-dynamic";

const TARGET_NOTIFIKASI = "/api/order/doku/notifikasi";

/** Status DOKU yang berarti uang sudah benar-benar diterima. */
const LUNAS = new Set(["SUCCESS", "SETTLEMENT", "CAPTURE", "PAID"]);

/** Status yang berarti pembayaran gagal/berakhir tanpa uang masuk. */
const GAGAL = new Set(["FAILED", "EXPIRED", "CANCELLED", "CANCELED", "DENIED"]);

export async function POST(req: Request) {
  if (!punyaKunciServer()) {
    return NextResponse.json({ pesan: PESAN_ENV_KOSONG }, { status: 503 });
  }

  const mentah = await req.text();

  const cek = verifikasiNotifikasi({
    headers: req.headers,
    target: TARGET_NOTIFIKASI,
    bodyMentah: mentah,
  });

  if (!cek.sah) {
    /*
      401, bukan 200. DOKU perlu tahu notifikasinya ditolak; menjawab 200
      pada signature yang salah akan menyembunyikan salah konfigurasi
      secret — dan itu justru yang paling sering terjadi saat pemasangan.
    */
    return NextResponse.json({ pesan: cek.alasan }, { status: 401 });
  }

  let isi: {
    order?: { invoice_number?: string };
    transaction?: { status?: string; original_request_id?: string };
    service?: { id?: string };
    channel?: { id?: string };
  };
  try {
    isi = JSON.parse(mentah);
  } catch {
    return NextResponse.json({ pesan: "Badan notifikasi bukan JSON." }, { status: 400 });
  }

  const invoice = String(isi.order?.invoice_number ?? "").trim();
  const status = String(isi.transaction?.status ?? "").trim().toUpperCase();

  if (!invoice) {
    return NextResponse.json({ pesan: "Notifikasi tanpa invoice_number." }, { status: 400 });
  }

  /*
    Cari pesanan lewat tagihan → pesanan.

    invoice_number TIDAK disimpan di pesanan karena satu pesanan bisa punya
    beberapa percobaan bayar (QRIS kedaluwarsa lalu bayar ulang). Yang
    mengikat invoice ke pesanan adalah baris `pembayaran` yang dibuat saat
    invoice diminta — tetapi pada notifikasi pertama baris itu belum ada.
    Karena itu DOKU mengirim `invoice_number` yang kita buat sendiri, dan
    formatnya memuat id pesanan: NBW-YYYYMMDD-<id>-<acak>.
  */
  const cocok = /^NBW-\d{8}-(\d+)-/i.exec(invoice);
  const idPesanan = cocok ? Number(cocok[1]) : NaN;

  if (!Number.isFinite(idPesanan)) {
    return NextResponse.json({ pesan: "Invoice tidak dikenali." }, { status: 400 });
  }

  const ada = await db<Pesanan[]>("pesanan", {
    q: `select=*&id=eq.${idPesanan}&limit=1`,
  });
  if (!ada.ok) {
    // Gangguan database kita sendiri: minta DOKU mengulang.
    return NextResponse.json({ pesan: ada.pesan }, { status: 503 });
  }
  if (ada.data.length === 0) {
    return NextResponse.json({ pesan: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  const pesanan = ada.data[0];

  if (LUNAS.has(status)) {
    const hasil = await tandaiLunas({
      pesananId: pesanan.id,
      metode: isi.channel?.id ?? isi.service?.id ?? "doku",
      referensi: isi.transaction?.original_request_id ?? null,
      invoice,
      payload: isi,
      oleh: "doku",
    });

    if (!hasil.ok) {
      /*
        Kasus yang paling penting: uang masuk untuk pesanan yang sudah
        kedaluwarsa/batal. Kita TIDAK menghidupkannya diam-diam. Jawab 200
        supaya DOKU berhenti mengulang, tapi catat supaya kasir melihatnya.

        Mengembalikan 5xx di sini akan membuat DOKU mengirim ulang
        selamanya untuk keadaan yang tidak akan pernah berubah.
      */
      await db("log_perubahan", {
        method: "POST",
        body: {
          siapa: "doku",
          aksi: "bayar_tanpa_pesanan_aktif",
          entitas: "pesanan",
          entitas_id: String(pesanan.id),
          sebelum: { status: pesanan.status, status_bayar: pesanan.status_bayar },
          sesudah: { pesan: hasil.pesan, invoice, status },
        },
      });
      return NextResponse.json({ ok: true, catatan: hasil.pesan });
    }

    return NextResponse.json({ ok: true, sudahLunas: hasil.sudahLunas });
  }

  if (GAGAL.has(status)) {
    /*
      Gagal bayar TIDAK langsung membatalkan pesanan.

      Tamu sering mencoba metode lain setelah QRIS-nya kedaluwarsa.
      Membatalkan pada notifikasi pertama membuat tombol "coba lagi"
      tidak berguna. Yang membatalkan adalah penyapu kedaluwarsa, dan itu
      memakai `kedaluwarsa_at` yang sudah ditetapkan saat pesanan dibuat.
    */
    await db("pembayaran", {
      method: "POST",
      body: {
        tagihan_id: pesanan.tagihan_id,
        metode: isi.channel?.id ?? "doku",
        diterima: 0,
        kembalian: 0,
        gerbang: "doku",
        status: status.toLowerCase(),
        invoice_number: invoice,
        referensi: isi.transaction?.original_request_id ?? null,
        payload: isi,
      },
    }).catch(() => {
      /* Indeks unik menolak duplikat — itu perilaku yang benar, bukan galat. */
    });

    return NextResponse.json({ ok: true, dicatat: status });
  }

  // Status lain (PENDING, REDIRECT, dsb): tidak ada yang perlu diubah.
  return NextResponse.json({ ok: true, diabaikan: status });
}

/**
 * GET tidak didukung — DOKU mengirim POST. Jawaban 405 di sini membuat
 * salah konfigurasi URL langsung terlihat saat pengujian, bukan diam-diam
 * dianggap berhasil.
 */
export async function GET() {
  return NextResponse.json(
    { pesan: "Endpoint ini hanya menerima POST dari DOKU." },
    { status: 405 }
  );
}
