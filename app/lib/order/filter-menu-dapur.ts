/**
 * Filter menu untuk layar ketersediaan dapur.
 * Kategori dicocokkan berdasarkan ID, bukan nama, agar nama yang mirip
 * atau kategori baru tidak ikut terpilih secara tidak sengaja.
 */
export type KategoriFilterDapur = number | "semua" | "lainnya";

export function saringMenuDapur<T extends { nama: string; kategori_id: number | null }>(
  menu: T[],
  opsi: {
    cari: string;
    kategoriId: KategoriFilterDapur;
    kategoriValid: ReadonlySet<number>;
  },
): T[] {
  const kata = opsi.cari.trim().toLocaleLowerCase("id-ID");
  return menu.filter((item) => {
    const kategoriCocok =
      opsi.kategoriId === "semua" ||
      (opsi.kategoriId === "lainnya"
        ? item.kategori_id === null || !opsi.kategoriValid.has(item.kategori_id)
        : item.kategori_id === opsi.kategoriId);
    const cariCocok = !kata || item.nama.toLocaleLowerCase("id-ID").includes(kata);
    return kategoriCocok && cariCocok;
  });
}
