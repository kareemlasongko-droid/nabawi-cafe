/**
 * Logika saringan daftar menu di portal admin.
 *
 * Kenapa dipisah ke berkas sendiri, bukan ditulis langsung di komponen:
 * sebelumnya fungsi ini hidup di dalam PortalAdmin.tsx, dan uji otomatis
 * terpaksa memuat SALINAN-nya. Salinan seperti itu berbahaya — logika di
 * komponen bisa diubah, salinan di uji tidak, dan uji tetap hijau padahal
 * perilaku di layar sudah berbeda. Sekarang komponen dan uji mengimpor
 * fungsi yang sama.
 */
import type { KategoriMenu, Menu } from "./tipe";
import { urutkanMenu } from "./aturan";

export type SaringanStatus = "semua" | "ada" | "habis";

/**
 * Normalisasi untuk pencarian.
 *
 * `normalize("NFD")` + buang tanda diakritik bukan hiasan: nama menu di sini
 * ditulis pemilik cafe, dan begitu ada satu "Crème Brûlée" atau "Café Latte",
 * pencarian "creme" akan gagal pada pencocokan huruf mentah.
 *
 * `toLowerCase` dipakai, bukan `toLocaleLowerCase`, karena data menu bukan
 * teks antarmuka — hasilnya harus sama di semua perangkat staf.
 */
export function normal(teks: string): string {
  return teks
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type PermintaanSaring = {
  cari: string;
  /** `"semua"` atau id kategori. */
  kategori: number | "semua";
  status: SaringanStatus;
};

/**
 * Menyaring daftar menu.
 *
 * Nama kategori ikut dicari, bukan hanya nama menu: admin yang mengetik
 * "kopi" mengharapkan seluruh kopi muncul, tidak peduli kata "kopi" ada di
 * nama menunya atau tidak.
 */
export function saringMenu(
  menu: Menu[],
  namaKategori: Map<number, string>,
  { cari, kategori, status }: PermintaanSaring
): Menu[] {
  const kata = normal(cari);
  return menu.filter((m) => {
    if (kategori !== "semua" && m.kategori_id !== kategori) return false;
    if (status === "ada" && !m.tersedia) return false;
    if (status === "habis" && m.tersedia) return false;
    if (!kata) return true;
    const isi = [
      m.nama,
      m.deskripsi ?? "",
      m.kategori_id ? (namaKategori.get(m.kategori_id) ?? "") : "",
    ];
    return isi.some((teks) => normal(teks).includes(kata));
  });
}

/**
 * Jumlah menu per kategori dari hasil saringan.
 *
 * Angka ini sengaja bukan jumlah mentah: kalau admin mengetik "ayam",
 * chip "Kopi 24" akan menipu — diklik, hasilnya nol. Dengan hitungan
 * gabungan, setiap chip menjawab "kalau saya pilih ini, akan ada berapa".
 */
export function hitungPerKategori(menu: Menu[]): Map<number, number> {
  const peta = new Map<number, number>();
  for (const m of menu) {
    if (m.kategori_id === null) continue;
    peta.set(m.kategori_id, (peta.get(m.kategori_id) ?? 0) + 1);
  }
  return peta;
}

/**
 * Aturan CSS "tampilkan kategori yang dipilih" untuk halaman /menu.
 *
 * KENAPA DIHASILKAN DARI DATA, BUKAN DITULIS DI globals.css
 * Versi pertama menulis id 1–6 secara manual di CSS. Itu bug yang
 * menunggu waktu: pil kategori dibuat dari data, jadi kategori ke-7 akan
 * punya pil tetapi tidak punya aturan tampil — menekannya menyembunyikan
 * SELURUH daftar (aturan dasarnya `display:none`). Halamannya tidak
 * error, hanya kosong. Dengan aturan yang lahir dari data, pil dan
 * aturannya selalu berjumlah sama.
 *
 * Id dinormalkan ke bilangan bulat: id dipakai sebagai nilai atribut
 * `[data-saring="..."]`, dan id bertipe aneh (NaN, pecahan, string
 * berisi tanda kutip) akan menghasilkan CSS rusak yang membocorkan
 * seluruh daftar. Kategori yang id-nya tidak valid dilewati — pilnya
 * tetap bisa ditekan, tetapi tidak mengosongkan halaman.
 */
export function aturanSaring(kategori: { id: number }[]): string {
  const id = [...new Set(kategori.map((k) => k.id))].filter((n) => Number.isInteger(n));
  return id
    .map((n) => `body[data-saring="${n}"] [data-kat="${n}"]{display:block}`)
    .join("");
}

/**
 * Kelompokkan menu per kategori untuk halaman /menu.
 *
 * KENAPA DI LIB, BUKAN DI DALAM page.tsx
 * Versi pertama fungsi ini hidup di page.tsx dan uji:menu menyalinnya.
 * Salinan seperti itu punya cacat bawaan yang sudah pernah menggigit
 * repo ini (lihat komentar kepala berkas): logika di halaman bisa
 * diubah tanpa uji ikut berubah, dan uji tetap hijau padahal perilakunya
 * berbeda. Sekarang halaman dan uji mengimpor fungsi yang sama.
 *
 * ATURAN
 *   · urutan kategori mengikuti kolom `urutan`, bukan id atau alfabet;
 *   · kategori tanpa menu tidak dirender (judul kosong membingungkan);
 *   · menu yang `kategori_id`-nya yatim (null, atau id yang tidak ada di
 *     daftar kategori) masuk kelompok terakhir "Lainnya" — TIDAK dibuang.
 *     Membuangnya berarti tamu tidak bisa memesan hidangan yang masih
 *     dijual hanya karena satu baris kategori terhapus;
 *   · rekomendasi naik ke atas di dalam kategorinya (lewat urutkanMenu).
 */
export type KelompokMenu = {
  kategori: { id: number; nama: string; urutan: number };
  menu: Menu[];
};

export function kelompokkanMenu(kategori: KategoriMenu[], menu: Menu[]): KelompokMenu[] {
  const hasil: KelompokMenu[] = [];
  const dipakai = new Set<number>();

  for (const k of [...kategori].sort((a, b) => a.urutan - b.urutan)) {
    const isi = urutkanMenu(menu.filter((m) => m.kategori_id === k.id));
    if (isi.length === 0) continue;
    hasil.push({ kategori: k, menu: isi });
    dipakai.add(k.id);
  }

  const yatim = urutkanMenu(
    menu.filter((m) => m.kategori_id === null || !dipakai.has(m.kategori_id))
  );
  if (yatim.length > 0) {
    hasil.push({ kategori: { id: -1, nama: "Lainnya", urutan: 999 }, menu: yatim });
  }

  return hasil;
}
