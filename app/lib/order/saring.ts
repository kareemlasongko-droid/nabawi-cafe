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
import type { Menu } from "./tipe";

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
