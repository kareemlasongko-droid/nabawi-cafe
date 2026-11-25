/**
 * QR Code generator — implementasi sendiri, tanpa dependensi.
 *
 * ── KENAPA TIDAK MEMAKAI PAKET ────────────────────────────────────────
 *
 * Kebutuhan kita sempit: satu URL pendek (`https://…/order?meja=12`),
 * koreksi galat menengah, gambar statis. Pustaka QR umumnya 20–40 kB dan
 * membawa encoder kanji, mode numerik, dan struktur data yang tidak kita
 * pakai. Yang di bawah ini ~200 baris dan hanya menangani BYTE mode.
 *
 * Konsekuensinya harus jujur: versi QR dipilih 1–10 (maks 213 byte).
 * URL meja jauh di bawah itu (~40 byte). Teks yang lebih panjang
 * mengembalikan galat, bukan QR yang salah — lihat `buatQr`.
 *
 * ── YANG DIPAKAI ──────────────────────────────────────────────────────
 *
 * Spesifikasi ISO/IEC 18004, bagian yang diperlukan saja:
 *   · byte mode + koreksi galat level M (~15%);
 *   · Reed–Solomon GF(256) dengan polinom 0x11d;
 *   · pola pencari, garis waktu, pola penyelarasan, dan format info;
 *   · penilaian topeng (mask) dengan empat aturan standar.
 *
 * Hasilnya matriks boolean; komponen yang memakainya menggambar SVG.
 */

/** Level koreksi galat M: indeks 0 di tabel pengodean format. */
const LEVEL_M = 0;

/**
 * Kapasitas data (dalam byte) untuk tiap versi pada level M.
 * Diambil dari tabel 7 ISO/IEC 18004. Versi 1..10 cukup untuk URL.
 */
const KAPASITAS_M = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];

/** Jumlah kata kode koreksi galat per versi (level M). */
const ECC_PER_BLOK_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];

/** Jumlah blok koreksi galat per versi (level M). */
const BLOK_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

/** Posisi pola penyelarasan per versi (versi 1 tidak punya). */
const PENYELARASAN: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

export type MatriksQr = {
  /** `true` = modul gelap. Baris-major: `modul[y][x]`. */
  modul: boolean[][];
  ukuran: number;
  versi: number;
};

/**
 * Bangun QR untuk teks UTF-8.
 *
 * @throws Error bila teks melebihi kapasitas versi 10 — lebih baik gagal
 *         terang-terangan daripada menghasilkan QR yang tidak terbaca.
 */
export function buatQr(teks: string): MatriksQr {
  const data = new TextEncoder().encode(teks);

  let versi = 0;
  for (let v = 1; v <= 10; v++) {
    if (data.length <= KAPASITAS_M[v]) {
      versi = v;
      break;
    }
  }
  if (versi === 0) {
    throw new Error(
      `Teks terlalu panjang untuk QR (${data.length} byte, maksimum ${KAPASITAS_M[10]}).`,
    );
  }

  const bit = new BitPenulis();
  // Mode byte = 0100, lalu 8 bit panjang data (versi 1–9) atau 16 bit (10+).
  bit.tulis(0b0100, 4);
  bit.tulis(data.length, versi < 10 ? 8 : 16);
  for (const b of data) bit.tulis(b, 8);

  const totalData = 8 * (KAPASITAS_M[versi] + 2);
  // Terminator maksimal 4 bit nol.
  const sisa = totalData - bit.panjang;
  bit.tulis(0, Math.min(4, sisa));
  while (bit.panjang % 8 !== 0) bit.tulis(0, 1);

  // Pola padding bergantian 0xEC / 0x11 sampai kapasitas data penuh.
  const kataData = totalData / 8;
  let isi = 0;
  while (bit.panjang < totalData) {
    bit.tulis(isi % 2 === 0 ? 0xec : 0x11, 8);
    isi++;
  }

  const mentah = bit.selesai();
  const kata = antarbalikBlok(mentah, versi, kataData);

  const ukuran = 21 + (versi - 1) * 4;
  const matriks: boolean[][] = Array.from({ length: ukuran }, () =>
    Array.from({ length: ukuran }, () => false),
  );
  const terpakai: boolean[][] = Array.from({ length: ukuran }, () =>
    Array.from({ length: ukuran }, () => false),
  );

  gambarPolaTetap(matriks, terpakai, versi, ukuran);
  tempatkanData(matriks, terpakai, kata, ukuran);

  /*
    Pilih topeng dengan skor terbaik. Tanpa ini, QR dengan bidang data
    yang rata (mis. banyak nol) menghasilkan blok besar berwarna seragam
    yang sulit dibaca pemindai.
  */
  let terbaik = 0;
  let skorTerbaik = Infinity;
  for (let m = 0; m < 8; m++) {
    const salinan = matriks.map((r) => [...r]);
    terapkanTopeng(salinan, terpakai, m, ukuran);
    tulisFormat(salinan, m, ukuran);
    const skor = nilai(salinan, ukuran);
    if (skor < skorTerbaik) {
      skorTerbaik = skor;
      terbaik = m;
    }
  }
  terapkanTopeng(matriks, terpakai, terbaik, ukuran);
  tulisFormat(matriks, terbaik, ukuran);

  return { modul: matriks, ukuran, versi };
}

// ── Penulis bit ─────────────────────────────────────────────────────────

class BitPenulis {
  bit: number[] = [];
  tulis(nilai: number, jumlah: number) {
    for (let i = jumlah - 1; i >= 0; i--) this.bit.push((nilai >>> i) & 1);
  }
  get panjang() {
    return this.bit.length;
  }
  selesai(): number[] {
    const keluar: number[] = [];
    for (let i = 0; i < this.bit.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (this.bit[i + j] ?? 0);
      keluar.push(b);
    }
    return keluar;
  }
}

// ── Reed–Solomon over GF(256) ───────────────────────────────────────────

const GF_EKSP: number[] = [];
const GF_LOG: number[] = [];
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EKSP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  // Lanjutan untuk indeks 255..511 supaya perkalian tidak perlu modulo.
  for (let i = 255; i < 512; i++) GF_EKSP[i] = GF_EKSP[i - 255];
})();

const kaliGf = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : GF_EKSP[GF_LOG[a] + GF_LOG[b]];

function polinomDerajat(derajat: number): number[] {
  let hasil = [1];
  for (let i = 0; i < derajat; i++) {
    const berikut = Array.from({ length: hasil.length + 1 }, () => 0);
    for (let j = 0; j < hasil.length; j++) {
      berikut[j] ^= hasil[j];
      berikut[j + 1] ^= kaliGf(hasil[j], GF_EKSP[i]);
    }
    hasil = berikut;
  }
  return hasil;
}

function sisaReedSolomon(data: number[], ecc: number): number[] {
  const pembagi = polinomDerajat(ecc);
  const sisa = Array.from({ length: ecc }, () => 0);
  for (const b of data) {
    const faktor = b ^ sisa[0];
    sisa.shift();
    sisa.push(0);
    for (let i = 0; i < ecc; i++) sisa[i] ^= kaliGf(pembagi[i + 1], faktor);
  }
  return sisa;
}

/**
 * Pecah data menjadi blok, hitung ECC tiap blok, lalu jalin kembali.
 *
 * Penjalinan (interleaving) WAJIB: pemindai membaca kata kode bergiliran
 * antarb lok. Menaruh blok berurutan akan menghasilkan QR yang mati total
 * bila satu bagian tergores.
 */
function antarbalikBlok(data: number[], versi: number, kataData: number): number[] {
  const jumlahBlok = BLOK_M[versi];
  const ecc = ECC_PER_BLOK_M[versi];
  const totalData = kataData;

  const pendek = Math.floor(totalData / jumlahBlok);
  const sisa = totalData % jumlahBlok;
  const panjangBlok: number[] = [];
  for (let i = 0; i < jumlahBlok; i++) panjangBlok.push(pendek + (i < jumlahBlok - sisa ? 0 : 1));

  const blokData: number[][] = [];
  const blokEcc: number[][] = [];
  let posisi = 0;
  for (let i = 0; i < jumlahBlok; i++) {
    const isi = data.slice(posisi, posisi + panjangBlok[i]);
    posisi += panjangBlok[i];
    blokData.push(isi);
    blokEcc.push(sisaReedSolomon(isi, ecc));
  }

  const keluar: number[] = [];
  const maks = Math.max(...panjangBlok);
  for (let i = 0; i < maks; i++) {
    for (const blok of blokData) if (i < blok.length) keluar.push(blok[i]);
  }
  for (let i = 0; i < ecc; i++) {
    for (const blok of blokEcc) keluar.push(blok[i]);
  }
  return keluar;
}

// ── Pola tetap ──────────────────────────────────────────────────────────

function gambarPolaTetap(
  m: boolean[][],
  dipakai: boolean[][],
  versi: number,
  ukuran: number,
) {
  const set = (x: number, y: number, gelap: boolean) => {
    if (x < 0 || y < 0 || x >= ukuran || y >= ukuran) return;
    m[y][x] = gelap;
    dipakai[y][x] = true;
  };

  // Tiga pola pencari 7×7 di sudut, dengan pemisah 1 modul.
  for (const [cx, cy] of [
    [3, 3],
    [ukuran - 4, 3],
    [3, ukuran - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const jauh = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, jauh !== 2 && jauh !== 4);
      }
    }
  }

  // Garis waktu (timing pattern).
  for (let i = 8; i < ukuran - 8; i++) {
    const gelap = i % 2 === 0;
    set(i, 6, gelap);
    set(6, i, gelap);
  }

  // Pola penyelarasan (alignment pattern).
  const posisi = PENYELARASAN[versi];
  for (const py of posisi) {
    for (const px of posisi) {
      // Yang bertumpuk pola pencari dilewati.
      if ((px === 6 && py === 6) || (px === 6 && py === ukuran - 7) || (px === ukuran - 7 && py === 6))
        continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Modul gelap tetap (versi ≥ 2).
  set(8, ukuran - 8, true);

  // Area format: ditandai terpakai supaya data tidak ditulis ke sana.
  // Nilainya diisi `tulisFormat` setelah topeng dipilih.
  for (let i = 0; i < 9; i++) {
    if (!dipakai[8][i]) set(i, 8, false);
    if (!dipakai[i][8]) set(8, i, false);
  }
  for (let i = 0; i < 8; i++) {
    set(ukuran - 1 - i, 8, false);
    set(8, ukuran - 1 - i, false);
  }
}

// ── Penempatan data (zig-zag dari kanan bawah) ─────────────────────────

function tempatkanData(
  m: boolean[][],
  dipakai: boolean[][],
  kata: number[],
  ukuran: number,
) {
  let i = 0;
  let arah = -1;
  for (let kolom = ukuran - 1; kolom >= 1; kolom -= 2) {
    // Kolom 6 dilewati: itu garis waktu vertikal.
    if (kolom === 6) kolom = 5;
    for (let n = 0; n < ukuran; n++) {
      const y = arah === -1 ? ukuran - 1 - n : n;
      for (const x of [kolom, kolom - 1]) {
        if (dipakai[y][x]) continue;
        const bit = i < kata.length * 8 ? (kata[i >>> 3] >>> (7 - (i & 7))) & 1 : 0;
        m[y][x] = bit === 1;
        i++;
      }
    }
    arah = -arah;
  }
}

// ── Topeng & format ────────────────────────────────────────────────────

const RUMUS_TOPENG = [
  (x: number, y: number) => (x + y) % 2 === 0,
  (x: number, y: number) => y % 2 === 0,
  (x: number, y: number) => x % 3 === 0,
  (x: number, y: number) => (x + y) % 3 === 0,
  (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function terapkanTopeng(m: boolean[][], dipakai: boolean[][], topeng: number, ukuran: number) {
  const rumus = RUMUS_TOPENG[topeng];
  for (let y = 0; y < ukuran; y++) {
    for (let x = 0; x < ukuran; x++) {
      if (!dipakai[y][x] && rumus(x, y)) m[y][x] = !m[y][x];
    }
  }
}

/** Tulis 15 bit format info: level M + nomor topeng. */
function tulisFormat(m: boolean[][], topeng: number, ukuran: number) {
  const data = (LEVEL_M << 3) | topeng;
  let sisa = data;
  for (let i = 0; i < 10; i++) sisa = (sisa << 1) ^ ((sisa >>> 9) * 0x537);
  const bit = ((data << 10) | sisa) ^ 0x5412;

  for (let i = 0; i < 15; i++) {
    const gelap = ((bit >>> i) & 1) === 1;
    // Salinan pertama: di sekitar pola pencari kiri atas.
    if (i < 6) m[8][i] = gelap;
    else if (i < 8) m[8][i + 1] = gelap;
    else if (i === 8) m[7][8] = gelap;
    else m[14 - i][8] = gelap;

    // Salinan kedua: dibelah antara dua pola pencari lainnya.
    if (i < 8) m[8][ukuran - 1 - i] = gelap;
    else m[ukuran - 15 + i][8] = gelap;
  }
  m[ukuran - 8][8] = true; // modul gelap tetap
}

// ── Penilaian topeng ───────────────────────────────────────────────────

function nilai(m: boolean[][], ukuran: number): number {
  let skor = 0;

  // Aturan 1: deretan ≥5 modul sewarna.
  for (let y = 0; y < ukuran; y++) {
    for (const arah of [0, 1]) {
      let jalan = 0;
      let lalu = false;
      for (let n = 0; n < ukuran; n++) {
        const v = arah === 0 ? m[y][n] : m[n][y];
        if (v === lalu) {
          jalan++;
        } else {
          if (jalan >= 5) skor += jalan - 2;
          jalan = 1;
          lalu = v;
        }
      }
      if (jalan >= 5) skor += jalan - 2;
    }
  }

  // Aturan 2: blok 2×2 sewarna.
  for (let y = 0; y < ukuran - 1; y++) {
    for (let x = 0; x < ukuran - 1; x++) {
      const v = m[y][x];
      if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) skor += 3;
    }
  }

  // Aturan 4: proporsi modul gelap yang menyimpang dari 50%.
  let gelap = 0;
  for (let y = 0; y < ukuran; y++) for (let x = 0; x < ukuran; x++) if (m[y][x]) gelap++;
  const persen = (gelap * 100) / (ukuran * ukuran);
  skor += Math.floor(Math.abs(persen - 50) / 5) * 10;

  return skor;
}

// ── SVG ─────────────────────────────────────────────────────────────────

/**
 * Jalur SVG untuk QR ini, dalam satuan modul (bukan piksel).
 *
 * Satu `<path>` untuk semua modul gelap, bukan satu `<rect>` per modul:
 * QR versi 5 punya ~300 modul gelap, dan 300 elemen DOM untuk satu gambar
 * membuat halaman admin berat saat 20 meja ditampilkan bersamaan.
 */
export function jalurSvg(qr: MatriksQr): string {
  const bagian: string[] = [];
  for (let y = 0; y < qr.ukuran; y++) {
    for (let x = 0; x < qr.ukuran; x++) {
      if (qr.modul[y][x]) bagian.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return bagian.join("");
}
