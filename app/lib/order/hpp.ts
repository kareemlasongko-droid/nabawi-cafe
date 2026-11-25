/**
 * Rumus stok & HPP — FUNGSI MURNI, tanpa database.
 *
 * ── KENAPA DIPISAH DARI `stok.ts` ────────────────────────────────────
 *
 * Bagian yang paling mudah salah pada fitur ini bukan kuerinya, melainkan
 * aritmetikanya: rata-rata harga, pembulatan, dan tanda negatif pada
 * pemakaian. Semua itu bisa diuji tanpa server sama sekali, dan uji tanpa
 * server tidak bisa lolos karena kebetulan datanya kosong.
 *
 * `stok.ts` memanggil fungsi-fungsi di sini. Kalau ada aturan hitung yang
 * ditulis ulang di sana, uji ini berhenti menjaga apa pun.
 */

/** Pembulatan rupiah. Satu tempat, supaya tidak ada dua pembulatan berbeda. */
export const rp = (n: number): number => Math.round(n);

/**
 * Harga rata-rata bergerak setelah pembelian baru.
 *
 * ── KENAPA RATA-RATA BERGERAK, BUKAN FIFO ───────────────────────────
 *
 * FIFO lebih akurat untuk laporan keuangan, tetapi menuntut setiap
 * pemakaian menelusuri lapisan stok yang tersisa. Dengan 126 menu yang
 * memakai bahan yang sama, itu berarti laporan HPP bergantung pada
 * urutan 500 baris gerakan — dan satu baris yang salah hapus membuat
 * seluruh perhitungan setelahnya meleset tanpa jejak.
 *
 * Rata-rata bergerak cukup akurat untuk kafe (selisihnya kecil pada
 * bahan yang harganya bergerak lambat), dan jauh lebih sulit salah.
 *
 * ── KENAPA DIBULATKAN KE RUPIAH ─────────────────────────────────────
 *
 * Harga per gram cabai adalah Rp 120,4. Kalau desimalnya disimpan, nilai
 * stok akan punya pecahan sen yang tidak pernah cocok dengan uang di
 * laci. Dibulatkan SEKALI di sini membuat seluruh sistem memakai angka
 * yang sama dengan yang tercetak di layar.
 *
 * @param stokLama jumlah stok sekarang (boleh 0)
 * @param hargaLama harga rata-rata sekarang (dipakai bila stokLama > 0)
 * @param masuk jumlah yang dibeli
 * @param hargaMasuk harga satuan pembelian
 */
export function hargaRataRataBaru(
  stokLama: number,
  hargaLama: number,
  masuk: number,
  hargaMasuk: number,
): number {
  if (masuk <= 0) return rp(hargaLama);
  /*
    Stok 0 atau NEGATIF → harga lama tidak berhak ikut dirata-ratakan.

    Stok negatif bisa terjadi sungguhan: stok belum sempat dicatat, dapur
    sudah memasak. Kalau harga lama (mungkin dari bulan lalu) tetap
    ditimbang, rata-ratanya menjadi angka yang tidak mewakili pembelian
    mana pun. Membuangnya dan memakai harga beli terbaru adalah pilihan
    yang bisa dijelaskan: "harga mengikuti pembelian terakhir".
  */
  if (stokLama <= 0) return rp(hargaMasuk);

  const nilaiLama = stokLama * hargaLama;
  const nilaiBaru = masuk * hargaMasuk;
  return rp((nilaiLama + nilaiBaru) / (stokLama + masuk));
}

/** Satu baris pemakaian bahan oleh satu pesanan. */
export type PakaiBahan = {
  bahan_id: number;
  jumlah: number;
  /** Harga satuan yang berlaku saat pemakaian — dikunci, bukan dihitung ulang. */
  harga_satuan: number;
};

export type HasilKebutuhan = {
  pakai: PakaiBahan[];
  /**
   * Bahan yang dibutuhkan tetapi harganya belum diketahui (0).
   *
   * Dikembalikan terpisah, TIDAK dibuang diam-diam. Pemilik harus melihat
   * menu mana yang HPP-nya belum bisa dipercaya — kalau daftar ini hilang,
   * satu bahan tanpa harga akan tampak seperti "gratis" dan laba terlihat
   * lebih besar daripada kenyataan.
   */
  hargaKosong: number[];
  /** Menu yang belum punya resep sama sekali. */
  tanpaResep: number[];
  /** True bila seluruh kebutuhan bisa dihargai penuh. */
  lengkap: boolean;
};

export type BarisResep = { bahan_id: number; jumlah: number };
export type BarisPesanan = { menu_id: number | null; jumlah: number };

/**
 * Hitung bahan yang dipakai sekumpulan item pesanan.
 *
 * ── PENGGABUNGAN, BUKAN PENJUMLAHAN PER ITEM ────────────────────────
 *
 * Kalau satu pesanan berisi dua menu yang sama-sama memakai cabai, cabai
 * dari kedua menu digabung menjadi SATU baris gerakan stok. Tanpa
 * penggabungan, satu pesanan bisa menghasilkan 12 baris gerakan untuk
 * bahan yang sama di 12 menu berbeda — dan saldo stok menjadi deretan
 * penjumlahan yang tidak bisa dibaca manusia saat ada selisih.
 *
 * Dibulatkan ke atas pada 3 desimal supaya 0,3333 gram tidak hilang
 * menjadi 0.
 */
export function kebutuhanBahan(
  item: BarisPesanan[],
  resepPerMenu: Map<number, BarisResep[]>,
  hargaPerBahan: Map<number, number>,
): HasilKebutuhan {
  const kumpul = new Map<number, number>();
  const tanpaResep: number[] = [];

  for (const it of item) {
    if (it.menu_id == null) continue;
    const resep = resepPerMenu.get(it.menu_id);
    if (!resep || resep.length === 0) {
      // Menu tanpa resep BUKAN kesalahan — 126 menu belum semuanya diisi.
      // Tetapi harus dilaporkan, karena HPP-nya tidak bisa dihitung.
      if (!tanpaResep.includes(it.menu_id)) tanpaResep.push(it.menu_id);
      continue;
    }
    for (const r of resep) {
      kumpul.set(r.bahan_id, (kumpul.get(r.bahan_id) ?? 0) + r.jumlah * it.jumlah);
    }
  }

  const hargaKosong: number[] = [];
  const pakai: PakaiBahan[] = [];

  for (const [bahan_id, jumlahMentah] of kumpul) {
    const jumlah = Math.round(jumlahMentah * 1000) / 1000;
    if (jumlah <= 0) continue;
    const harga = hargaPerBahan.get(bahan_id) ?? 0;
    if (harga <= 0 && !hargaKosong.includes(bahan_id)) hargaKosong.push(bahan_id);
    pakai.push({ bahan_id, jumlah, harga_satuan: harga });
  }

  return {
    pakai,
    hargaKosong,
    tanpaResep,
    lengkap: hargaKosong.length === 0 && tanpaResep.length === 0,
  };
}

/** Nilai rupiah satu baris pemakaian. */
export const nilaiPakai = (p: PakaiBahan): number => rp(p.jumlah * p.harga_satuan);

/**
 * Total HPP sekumpulan pemakaian.
 *
 * Dijumlah dari `nilaiPakai` per baris, BUKAN dari total bahan × harga
 * rata-rata. Bedanya kecil, tetapi yang pertama menjumlahkan angka yang
 * benar-benar tercatat di buku besar — sehingga HPP pesanan selalu sama
 * dengan jumlah baris gerakan stoknya saat diperiksa manual.
 */
export const totalHpp = (pakai: PakaiBahan[]): number =>
  pakai.reduce((n, p) => n + nilaiPakai(p), 0);

/**
 * Harga satuan untuk satu baris gerakan `opname`.
 *
 * Opname tidak mengubah harga: koreksi stok karena hitung fisik bukan
 * pembelian. Nilainya memakai harga rata-rata yang berlaku supaya selisih
 * stok punya nilai rupiah yang bisa dibaca — kalau tidak, "kurang 2 kg"
 * tidak bisa diterjemahkan ke kerugian.
 */
export const nilaiOpname = (selisih: number, harga: number): number => rp(selisih * harga);

/**
 * Selisih opname dari hitung fisik.
 *
 * `fisik` adalah angka yang dihitung orang di gudang. Selisihnya boleh
 * negatif (stok hilang/susut) dan boleh positif (ternyata lebih banyak
 * dari catatan). Keduanya SAH — opname yang hanya bisa mengurangi akan
 * membuat orang malas mencatat kelebihan.
 */
export const selisihOpname = (tercatat: number, fisik: number): number =>
  Math.round((fisik - tercatat) * 1000) / 1000;

export type StatusStok = "belum_dicatat" | "habis" | "kritis" | "cukup";

/**
 * Status satu bahan untuk layar.
 *
 * Ambangnya memakai `stok_minimum` milik bahan itu sendiri, bukan angka
 * global. Cabai dan beras tidak punya skala yang sama; satu ambang untuk
 * semua bahan hanya akan benar untuk satu bahan.
 *
 * Stok negatif selalu "habis": angka negatif berarti ada pemakaian yang
 * belum tercatat pembeliannya, dan itu lebih mendesak daripada sekadar
 * "kurang".
 */
export function statusStok(stok: number, minimum: number): StatusStok {
  if (stok <= 0) return "habis";
  if (minimum > 0 && stok <= minimum) return "kritis";
  return "cukup";
}

/**
 * Status bahan dengan pengetahuan apakah stoknya PERNAH dicatat.
 *
 * ── KENAPA "0" BUKAN SELALU "HABIS" ─────────────────────────────────
 *
 * Saldo 0 karena seratus bahan baru diisi lewat seed berbeda artinya dari
 * saldo 0 karena deterjen benar-benar habis dipakai. Yang pertama berarti
 * "belum ada pembelian/opname yang dicatat", dan menampilkannya sebagai
 * "habis" membuat seluruh daftar belanja berisi 100 baris — layar yang
 * menuduh tanpa dasar, dan orang berhenti mempercayainya.
 *
 * `pernahDicatat` diambil dari ada/tidaknya gerakan stok untuk bahan itu.
 * Opname yang mencatat fisik 0 TETAP dihitung "pernah dicatat" — dapur
 * sudah bilang kosong, itu pernyataan, bukan ketiadaan data.
 */
export function statusBahan(
  stok: number,
  minimum: number,
  pernahDicatat: boolean,
): StatusStok {
  if (stok <= 0 && !pernahDicatat) return "belum_dicatat";
  return statusStok(stok, minimum);
}

/**
 * Margin kotor dari omzet dan HPP.
 *
 * Dikembalikan `null` bila omzet 0 — persentase dari nol tidak bermakna,
 * dan menampilkan "0%" atau "∞" sama-sama menyesatkan.
 */
export function marginKotor(
  omzet: number,
  hpp: number,
): { laba: number; persen: number | null } {
  const laba = omzet - hpp;
  if (omzet <= 0) return { laba, persen: null };
  return { laba, persen: Math.round((laba / omzet) * 1000) / 10 };
}
