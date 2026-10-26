// Konstanta & helper yang aman dipakai di server maupun client.

export const BRAND = {
  name: "Senja Rimba",
  tagline: "Cafe & Resort",
  address: "Jl. Raya Lembang KM 7, Lembang, Kabupaten Bandung Barat, Jawa Barat",
  phone: "0812-3456-7890",
  whatsapp: "6281234567890",
  email: "halo@senjarimba.id",
};

export const BANKS = [
  { bank: "BCA", number: "8830 1234 56", holder: "PT Senja Rimba Wisata" },
  { bank: "Mandiri", number: "131 00 7788 9900", holder: "PT Senja Rimba Wisata" },
  { bank: "BRI", number: "0345 01 000123 30 5", holder: "PT Senja Rimba Wisata" },
];

export const UNIT_TYPES = [
  { value: "kamar", label: "Kamar", unitLabel: "malam", multiNight: true },
  { value: "villa", label: "Villa", unitLabel: "malam", multiNight: true },
  { value: "meja", label: "Meja Cafe", unitLabel: "reservasi", multiNight: false },
  { value: "aula", label: "Aula & Acara", unitLabel: "hari", multiNight: false },
] as const;

export type UnitType = (typeof UNIT_TYPES)[number]["value"];

export function unitTypeInfo(type: string) {
  return UNIT_TYPES.find((t) => t.value === type) ?? UNIT_TYPES[0];
}

export const SCENE_CATEGORIES = ["Cafe", "Resort", "Kamar", "Kolam", "Taman", "Lainnya"];

export const RESERVATION_STATUS = {
  menunggu_pembayaran: {
    label: "Menunggu Pembayaran",
    cls: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  menunggu_konfirmasi: {
    label: "Menunggu Konfirmasi",
    cls: "bg-sky-100 text-sky-800 ring-sky-200",
  },
  dikonfirmasi: {
    label: "Dikonfirmasi",
    cls: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
  selesai: { label: "Selesai", cls: "bg-stone-200 text-stone-700 ring-stone-300" },
  ditolak: { label: "Ditolak", cls: "bg-rose-100 text-rose-800 ring-rose-200" },
  dibatalkan: { label: "Dibatalkan", cls: "bg-stone-100 text-stone-500 ring-stone-200" },
} as const;

export type ReservationStatus = keyof typeof RESERVATION_STATUS;

export const ACTIVE_STATUSES: ReservationStatus[] = [
  "menunggu_pembayaran",
  "menunggu_konfirmasi",
  "dikonfirmasi",
];

export const PAYMENT_STATUS = {
  menunggu: { label: "Menunggu verifikasi", cls: "bg-sky-100 text-sky-800 ring-sky-200" },
  diterima: { label: "Diterima", cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  ditolak: { label: "Ditolak", cls: "bg-rose-100 text-rose-800 ring-rose-200" },
} as const;

export function rupiah(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
}

export function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function formatDate(s: string | Date | null | undefined) {
  if (!s) return "-";
  const d = typeof s === "string" ? (s.length <= 10 ? parseDate(s) : new Date(s)) : s;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: typeof s === "string" && s.length <= 10 ? "UTC" : "Asia/Jakarta",
  }).format(d);
}

export function formatDateTime(s: string | Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(s));
}

export function nightsBetween(checkIn: string, checkOut: string) {
  const diff = (parseDate(checkOut).getTime() - parseDate(checkIn).getTime()) / 86400000;
  return Math.max(0, Math.round(diff));
}

export function calcTotal(
  unit: { type: string; price: number },
  checkIn: string,
  checkOut: string,
  qty: number,
) {
  const info = unitTypeInfo(unit.type);
  const nights = info.multiNight ? nightsBetween(checkIn, checkOut) : 1;
  return { nights, total: unit.price * nights * qty };
}

export function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  // zona waktu WIB
  const wib = new Date(d.getTime() + 7 * 3600000);
  return wib.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number) {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
