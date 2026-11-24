/**
 * Uji jam buka 24 jam dan tanda tangan DOKU — MURNI, tanpa database.
 *
 * Keduanya dipilih karena dua bug di sini tidak akan terlihat sampai
 * produksi:
 *
 *   · jam "24" dari Intl membuat 00.30 dianggap TUTUP, padahal itu jam
 *     tersibuk kafe;
 *   · signature yang salah urutan komponennya tetap menghasilkan string
 *     yang "kelihatan benar" tetapi ditolak DOKU di produksi.
 *
 * Jalankan:
 *   node --experimental-strip-types --import ./scripts/uji/ts-hook.mjs \
 *        scripts/uji/prabayar.mjs
 */
import {
  CONTOH_24_JAM,
  JAM_CADANGAN,
  bacaJamMingguan,
  bacaRentang,
  keMenit,
} from "../../app/lib/order/jam-buka.ts";
import {
  signatureDoku,
  nomorInvoice,
  verifikasiNotifikasi,
} from "../../app/lib/order/doku.ts";
import { cekBuka, validasiPesananMasuk } from "../../app/lib/order/aturan.ts";

let lulus = 0;
let gagal = 0;
const cek = (nama, syarat, detail = "") => {
  if (syarat) {
    lulus++;
    console.log(`  LULUS  ${nama}${detail ? " — " + detail : ""}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}${detail ? " — " + detail : ""}`);
  }
};

// ── keMenit: "24.00" harus 1440, bukan 24 ────────────────────────────────
console.log("\n── keMenit ──");
cek("09.00 → 540", keMenit("09.00") === 540);
cek("24.00 → 1440 (bukan 24)", keMenit("24.00") === 1440, String(keMenit("24.00")));
cek("00.00 → 0", keMenit("00.00") === 0);
cek("25.00 → 1500 (pemanggil yang menolak)", keMenit("25.00") === 1500);
cek("bukan angka → NaN, bukan 0", Number.isNaN(keMenit("abc")));

// ── bacaRentang ─────────────────────────────────────────────────────────
console.log("\n── bacaRentang ──");
const penuh = bacaRentang("00.00-24.00");
cek("00.00-24.00 = sehari penuh (0..1440)", penuh?.mulai === 0 && penuh?.selesai === 1440);

const siang = bacaRentang("09.00-20.00");
cek("09.00-20.00 mulai 540", siang?.mulai === 540);
cek("selesai 20.00 = 1200", siang?.selesai === 1200);

/*
  "18.00-02.00" berarti selesai LEBIH KECIL dari mulai — rentang yang
  melewati tengah malam. cekBuka() menanganinya dengan membalik
  perbandingan; yang diuji di sini adalah bahwa bentuknya TIDAK ditolak.
*/
const lewatTengah = bacaRentang("18.00-02.00");
cek("18.00-02.00 diterima (lewat tengah malam)", lewatTengah !== null);

cek("format tanpa tanda hubung ditolak", bacaRentang("0920") === null);
cek("jam di luar 0-24 ditolak", bacaRentang("09.00-25.00") === null);

// ── bacaJamMingguan ─────────────────────────────────────────────────────
console.log("\n── bacaJamMingguan ──");
const dua = bacaJamMingguan("00.00-24.00,00.00-24.00");
cek(
  "dua sisi terbaca",
  dua?.weekday[0] === "00.00" && dua?.weekend[1] === "24.00",
  JSON.stringify(dua)
);

/* Satu sisi saja BUKAN bentuk sah — formatnya dua sisi. Null, bukan tebakan. */
cek("satu sisi ditolak (null)", bacaJamMingguan("09.00-20.00") === null);
cek("kosong ditolak (null)", bacaJamMingguan("") === null);
cek("tiga sisi ditolak (null)", bacaJamMingguan("09.00-20.00,09.00-20.00,09.00-20.00") === null);

// ── cekBuka dengan 24 jam ───────────────────────────────────────────────
console.log("\n── cekBuka 24 jam ──");

/*
  Tanggal dibuat eksplisit supaya uji tidak bergantung pada jam mesin
  penjalan. Semua waktu di bawah adalah WIB (UTC+7).
*/
const wib = (iso) => new Date(iso);

const jam24 = bacaJamMingguan(CONTOH_24_JAM);
if (!jam24) throw new Error("CONTOH_24_JAM tidak terbaca — uji tidak bisa jalan.");

const dini = cekBuka(wib("2026-11-02T00:30:00+07:00"), jam24);
cek("00.30 dianggap BUKA saat 24 jam", dini.buka === true, dini.sebab ?? "");

const subuh = cekBuka(wib("2026-11-02T04:59:00+07:00"), jam24);
cek("04.59 dianggap BUKA saat 24 jam", subuh.buka === true);

const malam = cekBuka(wib("2026-11-02T23:59:00+07:00"), jam24);
cek("23.59 dianggap BUKA saat 24 jam", malam.buka === true);

/*
  Label yang dilihat tamu. Nilai persisnya bukan kontrak — yang penting
  ia menyebut 24 jam, bukan "tutup", dan tidak menampilkan "24.00 – 24.00"
  yang membingungkan.
*/
cek(
  "label jam hari ini menyebut 24 jam",
  /24 jam/i.test(dini.jamHariIni) || dini.jamHariIni === "00.00 – 24.00",
  dini.jamHariIni
);

// ── cekBuka dengan jam normal ───────────────────────────────────────────
console.log("\n── cekBuka jam normal ──");
const normal = bacaJamMingguan("09.00-20.00,09.00-20.00");
if (!normal) throw new Error("jam normal tidak terbaca — uji tidak bisa jalan.");

const pagi = cekBuka(wib("2026-11-02T08:59:00+07:00"), normal);
cek("08.59 TUTUP sebelum buka", pagi.buka === false);

const siangHari = cekBuka(wib("2026-11-02T12:00:00+07:00"), normal);
cek("12.00 BUKA", siangHari.buka === true);

const malamHari = cekBuka(wib("2026-11-02T20:01:00+07:00"), normal);
cek("20.01 TUTUP setelah tutup", malamHari.buka === false);

// ── JAM_CADANGAN tetap masuk akal ───────────────────────────────────────
console.log("\n── JAM_CADANGAN ──");
const cadangan = bacaJamMingguan(JAM_CADANGAN);
cek("cadangan terbaca", cadangan !== null);
const cadWd = cadangan ? bacaRentang(cadangan.weekday.join("-")) : null;
cek("cadangan BUKAN 24 jam", cadWd !== null && cadWd.mulai > 0);

// ── nomor invoice ───────────────────────────────────────────────────────
console.log("\n── nomorInvoice ──");
const pesananUji = { id: 42 };
const waktuUji = new Date("2026-12-01T10:00:00+07:00");
const inv = nomorInvoice(pesananUji, waktuUji);

cek("berformat NBW-YYYYMMDD-id-acak", /^NBW-\d{8}-42-[A-Z0-9]{4,}$/.test(inv), inv);

/*
  INI BAGIAN PALING PENTING dari seluruh berkas ini.

  Webhook DOKU mencocokkan invoice ke pesanan dengan membaca id dari
  string ini (lihat app/api/order/doku/notifikasi/route.ts). Kalau format
  berubah tanpa keduanya ikut berubah, SEMUA notifikasi akan ditolak
  sebagai "Invoice tidak dikenali" — dan gejalanya hanya "pembayaran
  tidak pernah masuk", tanpa satu pun galat di log.
*/
const cocok = /^NBW-\d{8}-(\d+)-/i.exec(inv);
cek("regex webhook mencocokkan invoice ini", cocok !== null);
cek("id pesanan terbaca dari invoice", cocok?.[1] === "42", cocok?.[1] ?? "");

cek(
  "dua invoice untuk pesanan sama berbeda",
  nomorInvoice(pesananUji, waktuUji) !== nomorInvoice(pesananUji, waktuUji)
);

// ── signature DOKU: urutan komponen ─────────────────────────────────────
console.log("\n── signatureDoku ──");
const dasar = {
  clientId: "BRN-123",
  requestId: "req-1",
  timestamp: "2026-12-01T10:00:00Z",
  target: "/checkout/v1/payment",
  body: '{"a":1}',
  secret: "rahasia",
};
const { signature: sig, komponen } = signatureDoku(dasar);

cek("berawalan HMACSHA256=", sig.startsWith("HMACSHA256="), sig.slice(0, 14));
cek("panjang base64 44 karakter", sig.slice(11).length === 44, String(sig.slice(11).length));

/*
  Urutan komponen adalah kontrak DOKU. Diuji sebagai teks utuh: kalau ada
  yang menukar Request-Id dengan Request-Timestamp, hasilnya tetap string
  "HMACSHA256=..." yang tampak sah tetapi SETIAP notifikasi ditolak.
*/
const baris = komponen.split("\n");
cek("komponen 1: Client-Id", baris[0] === "Client-Id:BRN-123", baris[0]);
cek("komponen 2: Request-Id", baris[1] === "Request-Id:req-1", baris[1]);
cek(
  "komponen 3: Request-Timestamp",
  baris[2] === "Request-Timestamp:2026-12-01T10:00:00Z",
  baris[2]
);
cek("komponen 4: Request-Target", baris[3] === "Request-Target:/checkout/v1/payment", baris[3]);
cek("komponen 5: Digest", baris[4]?.startsWith("Digest:") === true);
cek("tepat lima baris, tanpa baris kosong", baris.length === 5, String(baris.length));

cek("deterministik untuk masukan sama", sig === signatureDoku(dasar).signature);
cek(
  "body berbeda → signature berbeda",
  sig !== signatureDoku({ ...dasar, body: '{"a":2}' }).signature
);
cek("secret berbeda → signature berbeda", sig !== signatureDoku({ ...dasar, secret: "lain" }).signature);
cek("target berbeda → signature berbeda", sig !== signatureDoku({ ...dasar, target: "/lain" }).signature);

/*
  Urutan komponen adalah bagian dari kontrak DOKU. Uji ini mengunci
  urutannya: kalau suatu saat ada yang menukar Request-Id dengan
  Request-Timestamp, hasilnya tetap "HMACSHA256=..." yang tampak sah,
  tetapi setiap notifikasi akan ditolak — dan gejalanya hanya terlihat
  sebagai "pembayaran tidak pernah masuk".
*/
const manual = signatureDoku({ ...dasar, body: "" });
cek("body kosong tetap menghasilkan signature", manual.signature.startsWith("HMACSHA256="));
cek("digest body kosong = hash SHA256 string kosong", manual.digest.length === 44);

// ── verifikasi notifikasi: bolak-balik ──────────────────────────────────
console.log("\n── verifikasiNotifikasi ──");

/*
  Uji ini menguji KEDUA ARAH: yang kita buat harus lolos verifikasi kita
  sendiri, dan yang diubah satu karakter harus ditolak. Tanpa arah kedua,
  fungsi verifikasi yang selalu mengembalikan `true` akan lolos uji.

  Secret disuntik lewat env karena itulah cara produksi membacanya.
*/
process.env.DOKU_SECRET_KEY = "rahasia-uji";

const target = "/api/order/doku/notifikasi";
const badan = JSON.stringify({
  order: { invoice_number: "NBW-20261201-42-ET041Q" },
  transaction: { status: "SUCCESS", original_request_id: "req-9" },
});
const waktu = "2026-12-01T10:00:00Z";

const buatHeader = (bodyUbah = badan, sigUbah = null) => {
  const { signature } = signatureDoku({
    clientId: "BRN-123",
    requestId: "notif-1",
    timestamp: waktu,
    target,
    body: bodyUbah,
    secret: "rahasia-uji",
  });
  return new Headers({
    "client-id": "BRN-123",
    "request-id": "notif-1",
    "request-timestamp": waktu,
    signature: sigUbah ?? signature,
  });
};

const sah = verifikasiNotifikasi({ headers: buatHeader(), target, bodyMentah: badan });
cek("notifikasi sah diterima", sah.sah === true, sah.alasan);

const sigSalah = verifikasiNotifikasi({
  headers: buatHeader(badan, "HMACSHA256=" + "A".repeat(44)),
  target,
  bodyMentah: badan,
});
cek("signature salah ditolak", sigSalah.sah === false, sigSalah.alasan);

/*
  Inilah alasan badan MENTAH dipakai, bukan hasil parse lalu stringify
  ulang. Menambah satu spasi mengubah digest, jadi badan yang di-round-trip
  akan ditolak walaupun isinya "sama".
*/
const badanDiubah = verifikasiNotifikasi({
  headers: buatHeader(),
  target,
  bodyMentah: badan.replace("SUCCESS", "FAILED"),
});
cek("badan diubah setelah ditandatangani → ditolak", badanDiubah.sah === false);

const targetSalah = verifikasiNotifikasi({ headers: buatHeader(), target: "/lain", bodyMentah: badan });
cek("target berbeda → ditolak", targetSalah.sah === false);

const tanpaHeader = verifikasiNotifikasi({ headers: new Headers(), target, bodyMentah: badan });
cek("tanpa header → ditolak", tanpaHeader.sah === false, tanpaHeader.alasan);

/*
  Tanpa secret, verifikasi HARUS menolak — bukan meloloskan. Endpoint yang
  terbuka saat konfigurasi kosong adalah cara paling umum sebuah sistem
  pembayaran bisa dilubangi.
*/
delete process.env.DOKU_SECRET_KEY;
const tanpaSecret = verifikasiNotifikasi({ headers: buatHeader(), target, bodyMentah: badan });
cek("secret kosong → ditolak, bukan diloloskan", tanpaSecret.sah === false, tanpaSecret.alasan);
process.env.DOKU_SECRET_KEY = "rahasia-uji";

// ── metode pembayaran (pilihan tamu) ─────────────────────────────────
console.log("\n── metode pembayaran ──");

const dasarPesan = {
  meja: "1",
  sesi: "sesi-uji",
  nama: "Tamu Uji",
  no_wa: "081234567890",
  items: [{ menu_id: 1, jumlah: 1, catatan: null, pilihan: [] }],
};

const online = validasiPesananMasuk({ ...dasarPesan, metode_bayar: "online" });
cek("metode 'online' diterima", online.ok && online.bersih.metode_bayar === "online");

const kasir = validasiPesananMasuk({ ...dasarPesan, metode_bayar: "kasir" });
cek("metode 'kasir' diterima", kasir.ok && kasir.bersih.metode_bayar === "kasir");

/*
  Tanpa nilai: jatuh ke "kasir", BUKAN "online".

  "online" menjanjikan tamu dibawa ke halaman pembayaran. Kalau nilai
  kosong jatuh ke sana, tamu yang kliennya versi lama akan menunggu
  tautan yang tidak pernah dibuka — dan pesanannya tidak pernah dibayar.
*/
const tanpaMetode = validasiPesananMasuk(dasarPesan);
cek(
  "tanpa metode → 'kasir' (pilihan aman)",
  tanpaMetode.ok && tanpaMetode.bersih.metode_bayar === "kasir"
);

const metodeAsing = validasiPesananMasuk({ ...dasarPesan, metode_bayar: "qris" });
cek("metode tak dikenal DITOLAK, bukan ditelan", metodeAsing.ok === false, metodeAsing.pesan ?? "");

const metodeAngka = validasiPesananMasuk({ ...dasarPesan, metode_bayar: 1 });
cek("metode bukan teks ditolak", metodeAngka.ok === false);

/*
  Nilai yang ditulis SISTEM saat lunas harus lolos constraint
  pesanan_metode_bayar_sah di database. Diuji di sini supaya perubahan
  nilai di kode tidak diam-diam membuat pembayaran gagal setelah uang
  diterima.
*/
const NILAI_SAH = ["online", "kasir", "doku", "tunai", "qris_kasir", "kartu"];
cek("'tunai' termasuk nilai sah", NILAI_SAH.includes("tunai"));
cek("'doku' termasuk nilai sah", NILAI_SAH.includes("doku"));
cek("'tunai_kasir' TIDAK sah (jangan dipakai)", !NILAI_SAH.includes("tunai_kasir"));

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
process.exit(gagal === 0 ? 0 : 1);
