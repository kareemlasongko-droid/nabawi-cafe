/**
 * Pembayaran lewat DOKU Checkout.
 *
 * ── KEPUTUSAN PEMILIK ────────────────────────────────────────────────
 *
 * "Satu alur saja: bayar dulu, kasir menerima pesanan yang sudah lunas."
 * "Ya, diizinkan (bayar tunai di kasir)" — dengan syarat yang sama: kasir
 * dan dapur hanya menerima pesanan LUNAS.
 *
 * ── ATURAN YANG TIDAK BOLEH DILANGGAR ────────────────────────────────
 *
 * 1. WEBHOOK ADALAH SATU-SATUNYA SUMBER KEBENARAN.
 *    Redirect `?status=success` setelah tamu kembali dari halaman DOKU
 *    bisa dipalsukan siapa pun dengan mengetik URL. Yang menandai lunas
 *    hanya notifikasi bertanda tangan dari DOKU.
 *
 * 2. SIGNATURE WAJIB DIVERIFIKASI.
 *    Tanpa ini, siapa pun bisa mengirim "sudah lunas" palsu ke endpoint
 *    kita dan mendapat makanan gratis.
 *
 * 3. IDEMPOTEN.
 *    DOKU bisa mengirim notifikasi yang sama berkali-kali. Tanpa
 *    deduplikasi, satu pembayaran tercatat berkali-kali.
 *
 * 4. UANG TIDAK PERNAH DIPERCAYAI DARI KLIEN.
 *    Nominal yang dikirim ke DOKU dihitung ulang dari database.
 */
import { createHmac, createHash } from "node:crypto";
import { db } from "./db";
import { potongStokPesanan } from "./stok";
import type { Pesanan, Tagihan } from "./tipe";

// ─────────────────────────────────────────────────────────────
// Konfigurasi
// ─────────────────────────────────────────────────────────────

const bersih = (v: string | undefined) => (v ?? "").trim();

/**
 * Dibaca lewat fungsi, bukan konstanta.
 *
 * Alasannya sama dengan db.ts: berkas uji menyetel `process.env` SETELAH
 * modul diimpor. Konstanta akan membekukan nilai kosong dan seluruh uji
 * pembayaran gagal — bukan karena kodenya salah.
 */
export const ambilDokuClientId = () => bersih(process.env.DOKU_CLIENT_ID);
export const ambilDokuSecret = () => bersih(process.env.DOKU_SECRET_KEY);
export const dokuProduksi = () => bersih(process.env.DOKU_MODE) === "production";

export const dokuSiap = () =>
  ambilDokuClientId().length > 0 && ambilDokuSecret().length > 0;

export const PESAN_DOKU_KOSONG =
  "Pembayaran online belum bisa dipakai: DOKU_CLIENT_ID / DOKU_SECRET_KEY belum diisi. " +
  "Silakan bayar tunai di kasir.";

const BasisUrl = () =>
  dokuProduksi() ? "https://api.doku.com" : "https://api-sandbox.doku.com";

// ─────────────────────────────────────────────────────────────
// Signature (non-SNAP / Jokul klasik, HMAC-SHA256)
// ─────────────────────────────────────────────────────────────

/**
 * Header dan signature untuk DOKU Checkout (non-SNAP).
 *
 * Bentuk komponen yang ditandatangani:
 *
 *     Client-Id:Request-Id:Request-Timestamp:Request-Target:Digest
 *
 * `Digest` = base64(SHA-256(body)). Semua digabung dengan newline.
 *
 * CATATAN JUJUR: ini ditulis dari dokumentasi publik DOKU (Jokul
 * non-SNAP) dan belum pernah dijalankan terhadap sandbox DOKU sungguhan —
 * sandbox hanya bisa dicapai dari jaringan luar, dan kredensialnya belum
 * ada. Yang sudah teruji di sini: bentuk komponen string, panjang digest,
 * dan verifikasi signature yang SAMA dipakai untuk notifikasi masuk
 * (diuji bolak-balik). Saat kredensial sandbox tersedia, satu-satunya
 * yang perlu dipastikan adalah apakah DOKU memakai `Request-Target`
 * berupa path saja atau path+query.
 */
export function signatureDoku(opsi: {
  clientId: string;
  requestId: string;
  timestamp: string;
  target: string;
  body: string;
  secret: string;
}): { digest: string; signature: string; komponen: string } {
  const digest = createHash("sha256").update(opsi.body, "utf8").digest("base64");
  const komponen = [
    `Client-Id:${opsi.clientId}`,
    `Request-Id:${opsi.requestId}`,
    `Request-Timestamp:${opsi.timestamp}`,
    `Request-Target:${opsi.target}`,
    `Digest:${digest}`,
  ].join("\n");

  const signature =
    "HMACSHA256=" +
    createHmac("sha256", opsi.secret).update(komponen, "utf8").digest("base64");

  return { digest, signature, komponen };
}

/**
 * Verifikasi notifikasi masuk dari DOKU.
 *
 * `target` = path endpoint KITA (mis. "/api/order/doku/notifikasi"), bukan
 * path DOKU. Badan permintaan harus RAW (belum di-parse lalu di-stringify
 * ulang) — JSON yang di-round-trip bisa berubah spasi dan kunci, sehingga
 * digest tidak cocok dan notifikasi yang sah ditolak.
 */
export function verifikasiNotifikasi(opsi: {
  headers: Headers;
  target: string;
  bodyMentah: string;
}): { sah: boolean; alasan: string } {
  const secret = ambilDokuSecret();
  if (!secret) return { sah: false, alasan: "DOKU_SECRET_KEY belum diisi." };

  const clientId = opsi.headers.get("client-id") ?? "";
  const requestId = opsi.headers.get("request-id") ?? "";
  const timestamp = opsi.headers.get("request-timestamp") ?? "";
  const tandaTangan = opsi.headers.get("signature") ?? "";

  if (!clientId || !requestId || !timestamp || !tandaTangan) {
    return { sah: false, alasan: "Header signature tidak lengkap." };
  }

  const { signature } = signatureDoku({
    clientId,
    requestId,
    timestamp,
    target: opsi.target,
    body: opsi.bodyMentah,
    secret,
  });

  /*
    Perbandingan waktu-konstan.

    `===` pada string berhenti di karakter pertama yang berbeda, sehingga
    waktu eksekusinya membocorkan berapa banyak karakter awal yang benar.
    Untuk HMAC, serangan berbasis waktu seperti itu praktis sulit, tapi
    biayanya nol untuk ditutup — jadi ditutup.
  */
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(tandaTangan, "utf8");
  if (a.length !== b.length) return { sah: false, alasan: "Signature tidak cocok." };
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a[i] ^ b[i];
  if (beda !== 0) return { sah: false, alasan: "Signature tidak cocok." };

  return { sah: true, alasan: "" };
}

// ─────────────────────────────────────────────────────────────
// Membuat invoice
// ─────────────────────────────────────────────────────────────

export type HasilInvoice = { ok: true; url: string; invoice: string } | { ok: false; pesan: string };

/**
 * Nomor invoice kita. Wajib unik dan tidak boleh ditebak berurutan, karena
 * ia muncul di URL pembayaran.
 */
export function nomorInvoice(pesanan: Pesanan, sekarang: Date = new Date()): string {
  const acak = Math.random().toString(36).slice(2, 8).toUpperCase();
  const hari = sekarang.toISOString().slice(0, 10).replace(/-/g, "");
  return `NBW-${hari}-${pesanan.id}-${acak}`;
}

/**
 * Buat halaman pembayaran DOKU untuk satu tagihan.
 *
 * Nominal diambil dari `tagihan.total` DI DATABASE, bukan dari argumen.
 * Kalau pemanggil bisa menentukan nominal, satu bug di route sudah cukup
 * untuk menjual Wagyu seharga Rp1.
 */
export async function buatInvoice(opts: {
  pesanan: Pesanan;
  tagihan: Tagihan;
  noWa: string;
  nama: string;
  /** Path publik untuk kembali setelah bayar, mis. "/order?meja=1". */
  kembaliKe: string;
  origin: string;
}): Promise<HasilInvoice> {
  if (!dokuSiap()) return { ok: false, pesan: PESAN_DOKU_KOSONG };
  if (opts.tagihan.total <= 0) {
    return { ok: false, pesan: "Tagihan bernilai nol, tidak bisa dibayar online." };
  }

  const invoice = nomorInvoice(opts.pesanan);
  const target = "/checkout/v1/payment";
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const body = JSON.stringify({
    order: {
      invoice_number: invoice,
      // DOKU memakai jumlah ini sebagai sumber kebenaran tagihannya.
      // Karena itu nilainya dari database, bukan dari browser.
      amount: opts.tagihan.total,
      currency: "IDR",
      callback_url: `${opts.origin}${opts.kembaliKe}`,
      callback_url_cancel: `${opts.origin}${opts.kembaliKe}`,
      // Halaman hasil DOKU tidak dipakai sebagai bukti; hanya kenyamanan.
      auto_redirect: true,
    },
    payment: {
      payment_due_date: 15,
    },
    customer: {
      name: opts.nama.slice(0, 60),
      phone: opts.noWa,
    },
  });

  const { signature } = signatureDoku({
    clientId: ambilDokuClientId(),
    requestId,
    timestamp,
    target,
    body,
    secret: ambilDokuSecret(),
  });

  let res: Response;
  try {
    res = await fetch(`${BasisUrl()}${target}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": ambilDokuClientId(),
        "Request-Id": requestId,
        "Request-Timestamp": timestamp,
        Signature: signature,
      },
      body,
    });
  } catch {
    return {
      ok: false,
      pesan: "Tidak bisa menghubungi DOKU. Periksa koneksi, atau bayar tunai di kasir.",
    };
  }

  const teks = await res.text();
  let j: { response?: { payment?: { url?: string } }; message?: string[] | string } = {};
  try {
    j = JSON.parse(teks);
  } catch {
    /* jawaban bukan JSON — ditangani di bawah */
  }

  if (!res.ok) {
    const pesanDoku =
      Array.isArray(j.message) ? j.message.join(", ") : (j.message ?? teks.slice(0, 160));
    return { ok: false, pesan: `DOKU menolak permintaan: ${pesanDoku}` };
  }

  const url = j.response?.payment?.url;
  if (!url) {
    return { ok: false, pesan: "DOKU tidak mengembalikan alamat pembayaran." };
  }

  return { ok: true, url, invoice };
}

// ─────────────────────────────────────────────────────────────
// Menandai lunas
// ─────────────────────────────────────────────────────────────

/**
 * Tandai pesanan lunas — IDEMPOTEN.
 *
 * Mengembalikan `sudahLunas: true` bila pesanan memang sudah lunas
 * sebelumnya. Pemanggil (webhook) tetap menjawab 200 OK ke DOKU, karena
 * notifikasi ulang bukan kesalahan DOKU — menganggapnya gagal membuat
 * DOKU mengirim berkali-kali.
 */
export async function tandaiLunas(opts: {
  pesananId: number;
  metode: string;
  referensi: string | null;
  invoice: string | null;
  payload: unknown;
  oleh: string;
}): Promise<{ ok: true; sudahLunas: boolean } | { ok: false; pesan: string }> {
  const ada = await db<Pesanan[]>("pesanan", {
    q: `select=*&id=eq.${opts.pesananId}&limit=1`,
  });
  if (!ada.ok) return { ok: false, pesan: ada.pesan };
  if (ada.data.length === 0) return { ok: false, pesan: "Pesanan tidak ditemukan." };

  const p = ada.data[0];
  if (p.status_bayar === "lunas") return { ok: true, sudahLunas: true };

  /*
    Pesanan yang sudah dibatalkan/kedaluwarsa TIDAK dihidupkan kembali.

    Ini terjadi bila tamu membayar tepat setelah penyapu membatalkan
    pesanannya. Uangnya sudah masuk, jadi ini harus terlihat manusia:
    kasir perlu mengembalikan atau membuat pesanan baru. Menandai lunas
    diam-diam akan membuat dapur memasak pesanan yang sudah ditutup.
  */
  if (p.status === "dibatalkan" || p.status === "ditolak" || p.status_bayar === "kedaluwarsa") {
    return {
      ok: false,
      pesan:
        `Pesanan ${p.nomor} sudah ${p.status_bayar === "kedaluwarsa" ? "kedaluwarsa" : p.status} ` +
        `tetapi pembayaran masuk. Perlu tindakan manual kasir.`,
    };
  }

  const kini = new Date().toISOString();

  // 1. Catat pembayaran. Indeks unik (invoice_number, status) di database
  //    menjaga baris 'settlement' ganda tetap ditolak, jadi balapan dua
  //    notifikasi bersamaan tidak menghasilkan dua catatan.
  await db("pembayaran", {
    method: "POST",
    body: {
      tagihan_id: p.tagihan_id,
      metode: opts.metode,
      diterima: 0,
      kembalian: 0,
      gerbang: "doku",
      status: "settlement",
      invoice_number: opts.invoice,
      referensi: opts.referensi,
      payload: opts.payload,
    },
  });

  // 2. Pesanan → lunas.
  const upd = await db("pesanan", {
    method: "PATCH",
    q: `id=eq.${opts.pesananId}`,
    body: {
      status_bayar: "lunas",
      dibayar_at: kini,
      /*
        "doku" — BUKAN nama kanal (QRIS/e-wallet/kartu). Constraint kolom
        ini hanya menerima nilai yang dikenal; kanal sebenarnya tersimpan
        di `pembayaran.metode`, yang tidak dibatasi supaya kanal baru dari
        DOKU tidak membuat pembayaran gagal.
      */
      metode_bayar: "doku",
      // Pesanan yang lunas masuk antrean kasir, dan hanya yang lunas yang
      // boleh muncul di sana. Status dapur TIDAK dilompati: kasir tetap
      // harus menerimanya secara sadar.
      status: "menunggu_konfirmasi",
    },
  });
  if (!upd.ok) return { ok: false, pesan: upd.pesan };

  // 3. Tagihan → lunas.
  if (p.tagihan_id) {
    await db("tagihan", {
      method: "PATCH",
      q: `id=eq.${p.tagihan_id}`,
      body: { status: "lunas", ditutup_at: kini },
    });
  }

  /*
    4. POTONG STOK — hanya di sini dan di `bayarTunaiKasir`.

    Urutannya SESUDAH pesanan ditandai lunas, bukan sebelumnya. Kalau stok
    dipotong lebih dulu lalu penandaan lunas gagal, bahan sudah keluar
    untuk pesanan yang menurut database belum dibayar — dan tidak ada yang
    tahu harus mengembalikannya.

    Gagal di sini TIDAK membatalkan pembayaran. Uangnya sudah masuk; kalau
    `tandaiLunas` mengembalikan galat, gerbang pembayaran akan mencoba
    lagi dan mencatat pembayaran kedua.
  */
  const potong = await potongStokPesanan(opts.pesananId, opts.oleh);
  if (!potong.ok) {
    console.error("stok gagal dipotong setelah lunas", opts.pesananId, potong.pesan);
  } else if (potong.data.baru && (potong.data.hargaKosong.length > 0 || potong.data.tanpaResep.length > 0)) {
    /*
      Dicatat, tidak disembunyikan: HPP pesanan ini UNDER-estimasi karena
      ada bahan tanpa harga atau menu tanpa resep. Tanpa catatan ini,
      laporan laba akan terlihat lebih baik daripada kenyataan dan tidak
      ada jejak kenapa.
    */
    console.warn(
      "HPP tidak lengkap untuk pesanan",
      opts.pesananId,
      "bahan tanpa harga:",
      potong.data.hargaKosong.join(", ") || "-",
      "menu tanpa resep:",
      potong.data.tanpaResep.join(", ") || "-",
    );
  }

  // 5. Log. Tanpa ini, pertanyaan "siapa yang menandai lunas?" tidak bisa
  //    dijawab saat ada sengketa.
  await db("log_perubahan", {
    method: "POST",
    body: {
      siapa: opts.oleh,
      aksi: "lunas",
      entitas: "pesanan",
      entitas_id: String(opts.pesananId),
      sebelum: { status_bayar: p.status_bayar },
      sesudah: { status_bayar: "lunas", invoice: opts.invoice, metode: opts.metode },
    },
  });

  return { ok: true, sudahLunas: false };
}
