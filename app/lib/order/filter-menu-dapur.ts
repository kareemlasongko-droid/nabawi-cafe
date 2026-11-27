/** Filter pencarian + kategori pada panel Menu dapur. */
export type KriteriaMenuDapur = {
  cari: string;
  kategoriId: number | "semua";
};

export function saringMenuDapur<T extends { nama: string; kategori_id: number | null }>(
  menu: T[],
  { cari, kategoriId }: KriteriaMenuDapur,
): T[] {
  const kata = cari.trim().toLocaleLowerCase("id-ID");
  return menu.filter((item) => {
    if (kategoriId !== "semua" && item.kategori_id !== kategoriId) return false;
    return kata === "" || item.nama.toLocaleLowerCase("id-ID").includes(kata);
  });
}
