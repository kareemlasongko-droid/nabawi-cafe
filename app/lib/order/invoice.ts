/**
 * Invoice — SATU sumber untuk tiga tempat: kasir, pelanggan, dan cetak.
 *
 * ── KENAPA DIPISAH DARI KOMPONEN ───────────────────────────────────────
 *
 * Sebelum ini struk hanya ada di PortalKasir, dibangun dari data yang
 * kebetulan sudah ada di memori layar kasir. Akibatnya:
 *
 *   · tamu tidak bisa melihat invoice-nya sendiri sama sekali;
 *   · invoice hanya bisa dicetak dengan `window.print()` yang mencetak
 *     SELURUH halaman kasir — termasuk antrean, denah meja, dan tombol;
 *   · tidak ada nomor invoice, jadi tidak ada yang bisa disebutkan tamu
 *     saat mempersoalkan tagihan.
 *
 * Sekarang bentuk invoice ditentukan di sini, sekali. Kasir dan pelanggan
 * memakai bentuk yang SAMA, sehingga angka yang dilihat tamu selalu angka
 * yang dilihat kasir — bukan dua perhitungan yang mirip.
 *
 * ── ANGKA DIAMBIL DARI DATABASE, BUKAN DIHITUNG ULANG ─────────────────
 *
 * Subtotal, layanan, pajak, dan total dibaca dari baris `tagihan`. Kalau
 * dihitung ulang di sini, invoice bisa berbeda dari yang tercatat begitu
 * tarif pajak berubah — dan itu perbedaan yang paling sulit dijelaskan
 * kepada tamu.
 */

import { db } from "./db";
import type { BarisStruk } from "./data";
import { bacaPilihan } from "./aturan";
import type { ItemPesanan, Pesanan, Tagihan } from "./tipe";

/** Satu baris yang tercetak di invoice. */
export type BarisInvoice = {
  nama: string;
  pilihan: { nama: string }[];
  jumlah: number;
  harga_satuan: number;
  harga_baris: number;
};

export type Invoice = {
  /**
   * Nomor invoice yang bisa disebutkan tamu.
   *
   * Dipakai `pesanan.nomor` (mis. M1-1249-63), BUKAN `pembayaran.invoice_number`
   * milik DOKU. Alasannya: pesanan yang dibayar tunai tidak punya nomor
   * DOKU sama sekali, dan invoice yang nomornya kosong untuk separuh
   * transaksi bukan invoice yang berguna.
   */
  nomor: string;
  /** Nomor DOKU bila ada — dicetak sebagai referensi, bukan identitas. */
  referensi_gerbang: string | null;

  dibuat_at: string;
  dibayar_at: string | null;

  meja: string;
  nama_pemesan: string | null;
  no_wa: string | null;

  items: BarisInvoice[];

  subtotal: number;
  layanan: number;
  pajak: number;
  pembulatan: number;
  total: number;

  /** "lunas" | "menunggu" | … — apa adanya dari database. */
  status_bayar: string;
  /** Metode yang akhirnya dipakai: "tunai" | "doku" | … */
  metode: string | null;
  /** Uang yang diserahkan; null bila bukan pembayaran tunai. */
  diterima: number | null;
  kembalian: number | null;
  kasir: string | null;
};

export type HasilInvoice = { ok: true; data: Invoice } | { ok: false; pesan: string; status: number };

/**
 * Ambil invoice untuk SATU pesanan.
 *
 * `sesi` wajib untuk pemanggilan dari portal pelanggan, dan diabaikan bila
 * dipanggil server-side untuk kasir. Tanpa pemeriksaan sesi, siapa pun
 * yang menebak nomor pesanan bisa melihat nomor WhatsApp tamu lain.
 */
export async function ambilInvoice(
  pesananId: number,
  opsi: { sesi?: string } = {},
): Promise<HasilInvoice> {
  /**
   * ── PEMERIKSAAN SESI DI SINI, BUKAN DI RLS ──────────────────────────
   *
   * Policy `pesanan_baca_sesi` di database berbunyi "sesi_id = header
   * x-sesi-order". Policy itu TIDAK dipakai untuk permintaan ini, dan itu
   * disengaja:
   *
   *   1. Dengan RLS, pesanan milik perangkat lain tidak kembali sebagai
   *      "sesi salah" (403) melainkan sebagai NOL BARIS — dan invoice
   *      menjawab "tidak ditemukan" untuk pesanan yang jelas ada. Tamu
   *      yang salah membuka tautan tidak akan pernah tahu sebabnya.
   *
   *   2. `tagihan`, `pembayaran`, dan `item_pesanan` semuanya ber-RLS
   *      TANPA policy baca. Permintaan sebagai tamu mengembalikan nol baris
   *      dari ketiganya, sehingga invoice tamu berisi daftar item kosong
   *      dan total Rp0 — dokumen yang salah, tanpa satu pun galat.
   *
   * Jadi: server membaca dengan haknya sendiri, lalu membandingkan
   * `sesi_id` di sini, sebelum satu byte pun dikirim ke pemanggil.
   * Perbandingan ini wajib — ia satu-satunya penjaga antara tamu dan nomor
   * WhatsApp tamu lain.
   */
  const p = await db<Pesanan[]>("pesanan", {
    q: `select=*&id=eq.${pesananId}&limit=1`,
  });
  if (!p.ok) return { ok: false, pesan: p.pesan, status: 503 };
  if (p.data.length === 0) return { ok: false, pesan: "Pesanan tidak ditemukan.", status: 404 };

  const pesanan = p.data[0];

  if (opsi.sesi !== undefined && pesanan.sesi_id !== opsi.sesi) {
    return { ok: false, pesan: "Invoice ini bukan milik perangkat Anda.", status: 403 };
  }

  const mejaRes = await db<{ nomor: string }[]>("meja", {
    q: `select=nomor&id=eq.${pesanan.meja_id}&limit=1`,
  });

  /*
    Tagihan bisa tidak ada pada pesanan lama (sebelum migrasi prabayar).
    Itu BUKAN alasan menolak: invoice-nya tetap bisa dibuat dari item yang
    tersimpan, dengan angka yang dihitung dari item itu. Yang tidak boleh
    terjadi adalah invoice yang menampilkan total Rp0 untuk pesanan yang
    jelas berisi makanan.
  */
  let tagihan: Tagihan | null = null;
  if (pesanan.tagihan_id) {
    const t = await db<Tagihan[]>("tagihan", {
      q: `select=*&id=eq.${pesanan.tagihan_id}&limit=1`,
    });
    if (t.ok && t.data.length > 0) tagihan = t.data[0];
  }

  const items = await ambilBarisInvoice(pesanan.id);
  if (!items.ok) return { ok: false, pesan: items.pesan, status: 503 };

  const hitung = jumlahkan(items.data);

  const bayar = tagihan
    ? await db<{ metode: string; diterima: number; kembalian: number; kasir: string | null; invoice_number: string | null }[]>(
        "pembayaran",
        {
          q: `select=metode,diterima,kembalian,kasir,invoice_number&tagihan_id=eq.${tagihan.id}&order=id.desc&limit=1`,
        },
      )
    : null;

  const barisBayar = bayar?.ok && bayar.data.length > 0 ? bayar.data[0] : null;

  return {
    ok: true,
    data: {
      nomor: pesanan.nomor,
      referensi_gerbang: barisBayar?.invoice_number ?? null,
      dibuat_at: pesanan.created_at,
      dibayar_at: pesanan.dibayar_at,
      meja: mejaRes.ok && mejaRes.data[0] ? mejaRes.data[0].nomor : String(pesanan.meja_id),
      nama_pemesan: pesanan.nama_pemesan,
      no_wa: pesanan.no_wa,
      items: items.data,
      /*
        Angka diambil dari TAGIHAN bila ada. Bila tidak, dihitung dari item
        supaya invoice tetap berguna — dan `total` yang dipakai adalah
        angka tagihan, bukan angka hasil hitung ulang, agar cocok dengan
        yang tercatat di database.
      */
      subtotal: tagihan ? tagihan.subtotal : hitung.subtotal,
      layanan: tagihan ? tagihan.layanan : 0,
      pajak: tagihan ? tagihan.pajak : 0,
      pembulatan: tagihan ? tagihan.pembulatan : 0,
      total: tagihan ? tagihan.total : hitung.subtotal,
      status_bayar: pesanan.status_bayar,
      metode: barisBayar?.metode ?? pesanan.metode_bayar,
      diterima: barisBayar ? barisBayar.diterima : null,
      kembalian: barisBayar ? barisBayar.kembalian : null,
      kasir: barisBayar?.kasir ?? null,
    },
  };
}

/**
 * Item pesanan → baris invoice.
 *
 * Digabung bila menu + harga + pilihan sama, persis seperti struk kasir
 * selama ini. Alasannya bukan estetika: tamu yang memesan 2 kopi di awal
 * lalu 1 kopi lagi di tengah makan akan melihat dua baris "Kopi Mint" dan
 * menyangka dirinya ditagih dua kali.
 */
async function ambilBarisInvoice(pesananId: number): Promise<{ ok: true; data: BarisInvoice[] } | { ok: false; pesan: string }> {
  const r = await db<ItemPesanan[]>("item_pesanan", {
    q: `select=*&pesanan_id=eq.${pesananId}&order=id.asc`,
  });
  if (!r.ok) return { ok: false, pesan: r.pesan };

  const peta = new Map<string, BarisInvoice>();
  for (const i of r.data) {
    const pilihan = bacaPilihan(i.pilihan);
    const label = pilihan
      .map((x) => x.nama)
      .sort()
      .join(",");
    const kunci = `${i.nama_saat_pesan}|${i.harga_satuan}|${label}`;

    const ada = peta.get(kunci);
    if (ada) {
      ada.jumlah += i.jumlah;
      ada.harga_baris = ada.jumlah * ada.harga_satuan;
    } else {
      peta.set(kunci, {
        nama: i.nama_saat_pesan,
        pilihan: pilihan.map((x) => ({ nama: x.nama })),
        jumlah: i.jumlah,
        harga_satuan: i.harga_satuan,
        harga_baris: i.jumlah * i.harga_satuan,
      });
    }
  }

  return { ok: true, data: [...peta.values()] };
}

/** Subtotal dari baris item — hanya dipakai bila tagihan tidak ada. */
function jumlahkan(baris: BarisInvoice[]): { subtotal: number } {
  return { subtotal: baris.reduce((n, b) => n + b.harga_baris, 0) };
}

/**
 * Nama metode pembayaran dalam bahasa yang dibaca tamu.
 *
 * "doku" dan "qris_kasir" adalah istilah internal; tamu membawa pulang
 * invoice dan bertanya "ini apa?". Nilai tak dikenal dikembalikan apa
 * adanya — lebih baik jujur daripada mengarang.
 */
export function labelMetode(metode: string | null): string {
  const peta: Record<string, string> = {
    tunai: "Tunai",
    doku: "Bayar online (DOKU)",
    qris_kasir: "QRIS di kasir",
    kartu: "Kartu",
    online: "Belum dibayar — pilih bayar online",
    kasir: "Belum dibayar — bayar di kasir",
  };
  if (!metode) return "—";
  return peta[metode] ?? metode;
}

/**
 * Waktu dalam zona Asia/Jakarta — bukan zona perangkat.
 *
 * Invoice yang dicetak di ponsel tamu dan invoice yang dicetak di komputer
 * kasir HARUS menunjukkan jam yang sama. Memakai `toLocaleString()` tanpa
 * `timeZone` menghasilkan dua jam berbeda bila salah satu perangkat salah
 * setel — dan pada invoice, selisih jam terlihat seperti pemalsuan.
 */
export function waktuInvoice(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const bagian = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const ambil = (t: string) => bagian.find((b) => b.type === t)?.value ?? "";
  return `${ambil("day")} ${ambil("month")} ${ambil("year")} · ${ambil("hour")}.${ambil("minute")}`;
}
