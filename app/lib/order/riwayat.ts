/**
 * Riwayat pesanan & ringkasan penjualan — dipakai KASIR dan ADMIN.
 *
 * ── KENAPA SATU MODUL, BUKAN DUA ──────────────────────────────────────
 *
 * Kasir dan admin menanyakan hal yang sama kepada data yang sama: "hari ini
 * dapat berapa, dan pesanan mana saja yang masuk". Kalau keduanya membaca
 * dengan caranya sendiri, laporan kasir dan laporan pemilik akan berbeda —
 * dan yang paling sering terjadi adalah angka yang lebih kecil tampak lebih
 * "benar" karena tidak ada yang bisa membantahnya.
 *
 * ── UANG MASUK ≠ `diterima` ───────────────────────────────────────────
 *
 * Data live menunjukkan satu baris dengan `diterima` 300.000 untuk tagihan
 * 279.700 (kembalian 20.300). Menjumlahkan `diterima` akan menghitung uang
 * yang kembali ke tangan tamu sebagai pendapatan.
 *
 * Karena itu omzet diambil dari `tagihan.total`, dan uang fisik yang masuk
 * ke laci dihitung terpisah: `diterima − kembalian`.
 *
 * ── STATUS `pembayaran` TIDAK SERAGAM ─────────────────────────────────
 *
 * Di database ada dua nilai: `lunas` (dari /api/order/bayar) dan
 * `settlement` (dari jalur DOKU). Menyaring dengan satu nilai akan
 * menghilangkan separuh transaksi tanpa gejala — jadi yang dipakai adalah
 * `tagihan.status = 'lunas'`, satu-satunya penanda yang ditulis kedua jalur.
 */

import { db } from "./db";
import type { Tagihan } from "./tipe";

/** Satu baris riwayat — cukup untuk daftar, bukan untuk invoice. */
export type BarisRiwayat = {
  /** id pesanan; dipakai untuk membuka invoice-nya. */
  id: number;
  nomor: string;
  meja: string;
  nama_pemesan: string | null;
  total: number;
  status_bayar: string;
  status: string;
  /** Waktu pesanan dibuat. */
  dibuat_at: string;
  /** Waktu dilunasi; null bila belum. */
  dibayar_at: string | null;
  metode: string | null;
  total_item: number;
};

export type RingkasanPenjualan = {
  /** Awal hari yang dipakai (ISO), supaya layar bisa menyebutkannya. */
  sejak: string;
  /** Jumlah pesanan LUNAS hari ini. */
  jumlah_pesanan: number;
  /** Omzet = jumlah `tagihan.total`. Bukan `diterima`. */
  omzet: number;
  /** Uang tunai yang benar-benar masuk laci: diterima − kembalian. */
  tunai: number;
  /** Omzet non-tunai (QRIS, kartu, DOKU). */
  nontunai: number;
  /** Rata-rata per pesanan; 0 bila belum ada. */
  rata_rata: number;
  /** Jumlah item terjual hari ini (dari pesanan lunas). */
  item: number;
  /** Pesanan yang belum dibayar — perlu ditagih, bukan bagian omzet. */
  belum_bayar: number;
  /** Nilai pesanan yang belum dibayar. */
  nilai_belum_bayar: number;
};

/**
 * Awal hari ini dalam zona Asia/Jakarta, sebagai ISO UTC.
 *
 * Kenapa tidak `new Date().setHours(0,0,0,0)`: itu memakai zona PERANGKAT.
 * Tablet kasir yang jamnya masih WIB dan ponsel pemilik yang disetel UTC
 * akan menghasilkan dua "hari ini" yang berbeda — dan laporan tutup harian
 * yang tidak cocok dengan kasir adalah pertengkaran yang tidak perlu.
 *
 * Jakarta tidak memakai DST, jadi offset +07:00 tetap sepanjang tahun.
 */
export function awalHariIni(sekarang: Date = new Date()): Date {
  const WIB = 7 * 60 * 60 * 1000;
  const geser = new Date(sekarang.getTime() + WIB);
  // Susun tengah malam WIB, lalu kembalikan ke UTC dengan menggeser balik.
  const tengahMalamWib = Date.UTC(
    geser.getUTCFullYear(),
    geser.getUTCMonth(),
    geser.getUTCDate(),
  );
  return new Date(tengahMalamWib - WIB);
}

export type HasilRingkasan = { ok: true; data: RingkasanPenjualan } | { ok: false; pesan: string };

/**
 * Ringkasan penjualan HARI INI (Asia/Jakarta).
 *
 * Dibaca dari `tagihan` yang sudah lunas dan ditutup sejak awal hari, lalu
 * `pembayaran` untuk memisahkan tunai dan non-tunai.
 *
 * Kalau pembacaan pembayaran gagal, ringkasan TETAP dikembalikan — omzet
 * dan jumlah pesanan sudah benar, hanya pisahan tunai/non-tunai yang tidak
 * bisa dipastikan. Menolak seluruh ringkasan karena satu detail tambahan
 * berarti kasir kehilangan angka yang sudah pasti benar.
 */
export async function ringkasanHariIni(
  sekarang: Date = new Date(),
): Promise<HasilRingkasan> {
  const sejak = awalHariIni(sekarang);

  const lunas = await db<Tagihan[]>("tagihan", {
    q:
      "select=*&status=eq.lunas" +
      `&ditutup_at=gte.${encodeURIComponent(sejak.toISOString())}` +
      "&order=ditutup_at.desc&limit=500",
  });
  if (!lunas.ok) return { ok: false, pesan: lunas.pesan };

  const daftar = lunas.data;
  const omzet = daftar.reduce((n, t) => n + (t.total ?? 0), 0);

  /*
    Pesanan lunas hari ini: dipakai untuk jumlah & rata-rata per pesanan.
    `tagihan` sendiri tidak menyimpan jumlah pesanan — satu tagihan bisa
    melunasi beberapa pesanan semeja.
  */
  const pesananLunas = await db<{ id: number; total_item: number | null }[]>("pesanan", {
    q:
      "select=id,total_item&status_bayar=eq.lunas" +
      `&dibayar_at=gte.${encodeURIComponent(sejak.toISOString())}` +
      "&limit=1000",
  });
  const jumlahPesanan = pesananLunas.ok ? pesananLunas.data.length : daftar.length;
  const item = pesananLunas.ok
    ? pesananLunas.data.reduce((n, p) => n + (p.total_item ?? 0), 0)
    : 0;

  /*
    Pisahan tunai/non-tunai. `pembayaran.metode` adalah kanal sebenarnya
    ("tunai", "doku", "qris_kasir", "kartu").
  */
  let tunai = 0;
  let nontunai = 0;

  if (daftar.length > 0) {
    const ids = daftar.map((t) => t.id).join(",");
    const bayar = await db<
      { tagihan_id: number; metode: string; diterima: number; kembalian: number }[]
    >("pembayaran", {
      q: `select=tagihan_id,metode,diterima,kembalian&tagihan_id=in.(${ids})`,
    });

    if (bayar.ok) {
      /*
        Satu tagihan bisa punya lebih dari satu baris pembayaran (mis. satu
        percobaan DOKU yang gagal lalu pembayaran tunai). Yang dihitung
        hanya yang benar-benar masuk; `diterima` 0 atau negatif diabaikan.
      */
      const perTagihan = new Map<number, { metode: string; masuk: number }>();
      for (const b of bayar.data) {
        const masuk = Math.max(0, (b.diterima ?? 0) - (b.kembalian ?? 0));
        if (masuk <= 0) continue;
        const ada = perTagihan.get(b.tagihan_id);
        // Baris terakhir yang menang: pembayaran yang menggantikan percobaan
        // sebelumnya biasanya ditulis belakangan (id lebih besar).
        perTagihan.set(b.tagihan_id, { metode: b.metode ?? "", masuk });
      }
      for (const { metode, masuk } of perTagihan.values()) {
        if (metode === "tunai") tunai += masuk;
        else nontunai += masuk;
      }
    } else {
      /*
        Rincian gagal dibaca. Jangan mengarang 0 tunai / seluruhnya
        non-tunai — itu angka yang salah tetapi tampak pasti. Yang dipakai:
        seluruh omzet dianggap tunai, karena itu metode bawaan di kafe ini,
        dan layar menandainya sebagai tidak terinci.
      */
      tunai = omzet;
    }
  }

  /*
    Pesanan yang belum dibayar SENGAJA tidak masuk omzet. Ia ditampilkan
    terpisah supaya kasir tahu ada uang yang belum masuk — bukan supaya
    angkanya terlihat lebih besar.
  */
  const menunggu = await db<{ id: number; tagihan_id: number | null }[]>("pesanan", {
    /*
      `not.in.(ditolak,dibatalkan)` — BUKAN `neq.dibatalkan` saja.

      Pesanan yang DITOLAK kasir juga berstatus bayar "menunggu": tidak ada
      yang membayarnya karena pesanannya memang tidak pernah dibuat. Kalau
      ia ikut terhitung, layar kasir menampilkan "belum dibayar" untuk
      pesanan yang sudah selesai urusannya — dan kasir pergi menagih tamu
      yang pesanannya sudah ditolak. Kedua status yang sama-sama berarti
      "tidak ada uang yang perlu ditagih" harus dikecualikan bersamaan.
    */
    q: "select=id,tagihan_id&status_bayar=eq.menunggu&status=not.in.(ditolak,dibatalkan)&limit=500",
  });
  const belumBayar = menunggu.ok ? menunggu.data.length : 0;

  /*
    Nilai pesanan yang belum dibayar diambil dari tagihannya bila ada.
    Pesanan tanpa tagihan (data lama) tidak bisa dinilai di sini — lebih
    baik dihitung kurang daripada mengarang angka.
  */
  let nilaiBelumBayar = 0;
  if (menunggu.ok) {
    const idTagihan = menunggu.data
      .map((p) => p.tagihan_id)
      .filter((x): x is number => typeof x === "number");
    if (idTagihan.length > 0) {
      const t = await db<{ id: number; total: number }[]>("tagihan", {
        q: `select=id,total&id=in.(${idTagihan.join(",")})`,
      });
      if (t.ok) nilaiBelumBayar = t.data.reduce((n, x) => n + (x.total ?? 0), 0);
    }
  }

  return {
    ok: true,
    data: {
      sejak: sejak.toISOString(),
      jumlah_pesanan: jumlahPesanan,
      omzet,
      tunai,
      nontunai,
      rata_rata: jumlahPesanan > 0 ? Math.round(omzet / jumlahPesanan) : 0,
      item,
      belum_bayar: belumBayar,
      nilai_belum_bayar: nilaiBelumBayar,
    },
  };
}

export type HasilRiwayat = { ok: true; data: BarisRiwayat[] } | { ok: false; pesan: string };

/**
 * Riwayat pesanan terbaru — SEMUA pesanan, bukan hanya yang lunas.
 *
 * `status_bayar` ikut dikirim apa adanya: daftar riwayat yang hanya memuat
 * pesanan lunas akan menyembunyikan pesanan yang ditolak atau kedaluwarsa,
 * dan itu justru yang paling sering ditanyakan tamu ("pesanan saya yang
 * tadi bagaimana?").
 */
export async function riwayatPesanan(batas = 40): Promise<HasilRiwayat> {
  const r = await db<
    {
      id: number;
      nomor: string;
      meja_id: number;
      nama_pemesan: string | null;
      status: string;
      status_bayar: string;
      created_at: string;
      dibayar_at: string | null;
      metode_bayar: string | null;
      total_item: number | null;
      tagihan_id: number | null;
    }[]
  >("pesanan", {
    q: `select=*&order=created_at.desc&limit=${batas}`,
  });
  if (!r.ok) return { ok: false, pesan: r.pesan };

  const [mejaRes, tagihanRes] = await Promise.all([
    db<{ id: number; nomor: string }[]>("meja", { q: "select=id,nomor" }),
    (async () => {
      const ids = r.data
        .map((p) => p.tagihan_id)
        .filter((x): x is number => typeof x === "number");
      if (ids.length === 0) return { ok: true as const, data: [] as { id: number; total: number }[] };
      return db<{ id: number; total: number }[]>("tagihan", {
        q: `select=id,total&id=in.(${ids.join(",")})`,
      });
    })(),
  ]);

  const petaMeja = new Map((mejaRes.ok ? mejaRes.data : []).map((m) => [m.id, m.nomor]));
  const petaTotal = new Map(
    (tagihanRes.ok ? tagihanRes.data : []).map((t) => [t.id, t.total]),
  );

  return {
    ok: true,
    data: r.data.map((p) => ({
      id: p.id,
      nomor: p.nomor,
      meja: petaMeja.get(p.meja_id) ?? String(p.meja_id),
      nama_pemesan: p.nama_pemesan,
      /*
        Total 0 (bukan null) bila tagihannya tidak ada: layar menampilkan
        "—" untuk 0, dan `null` akan membuat sorting serta penjumlahan di
        klien lebih rumit tanpa manfaat.
      */
      total: p.tagihan_id ? (petaTotal.get(p.tagihan_id) ?? 0) : 0,
      status_bayar: p.status_bayar,
      status: p.status,
      dibuat_at: p.created_at,
      dibayar_at: p.dibayar_at,
      metode: p.metode_bayar,
      total_item: p.total_item ?? 0,
    })),
  };
}
