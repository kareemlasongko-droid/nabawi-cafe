/**
 * Filter menu pada panel kasir.
 *
 * Chip kategori harus memfilter `kategori_id` dengan persamaan tepat.
 * Membandingkan nama kategori dengan `.includes("kopi")` membuat
 * "Non-Kopi" ikut masuk saat memilih chip "Kopi" — kata itu memang
 * terkandung di dalam "Non-Kopi". Kolom cari, sebaliknya, hanya mencari
 * nama menu; kategori dipilih lewat chip, bukan lewat substring nama.
 */
export type OpsiSaringMenuKasir = {
  cari: string;
  kategoriId: number | "semua";
};

export function saringMenuKasir<T extends { nama: string; kategori_id: number | null }>(
  menu: T[],
  { cari, kategoriId }: OpsiSaringMenuKasir,
): T[] {
  const kata = cari.trim().toLocaleLowerCase("id-ID");

  return menu.filter((item) => {
    if (kategoriId !== "semua" && item.kategori_id !== kategoriId) return false;
    return kata === "" || item.nama.toLocaleLowerCase("id-ID").includes(kata);
  });
}
