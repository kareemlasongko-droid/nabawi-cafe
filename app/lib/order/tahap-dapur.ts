/** Tiga tahap yang dapur kerjakan, ditampilkan berdampingan pada satu layar. */
export const TAHAP_DAPUR = [
  {
    kunci: "baru",
    judul: "Baru",
    status: ["menunggu_konfirmasi", "diterima"],
    aksi: "diproses",
    label: "Mulai",
  },
  { kunci: "diproses", judul: "Diproses", status: ["diproses"], aksi: "siap", label: "Siap" },
  { kunci: "siap", judul: "Siap", status: ["siap"], aksi: "diantar", label: "Diantar" },
] as const;

export type TahapDapur = (typeof TAHAP_DAPUR)[number];

export function tiketPadaTahap<T extends { status: string }>(tiket: T[], tahap: TahapDapur): T[] {
  return tiket.filter((t) => (tahap.status as readonly string[]).includes(t.status));
}

/**
 * Pesanan lunas `menunggu_konfirmasi` juga muncul di tahap Baru. Status
 * harus maju satu langkah setiap kali: terima dulu, baru bisa mulai masak.
 */
export function aksiTiketDapur(status: string, tahap: TahapDapur) {
  return status === "menunggu_konfirmasi"
    ? { ke: "diterima", label: "Terima" }
    : { ke: tahap.aksi, label: tahap.label };
}
