import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import { reservations, units } from "@/db/schema";
import { apiUser, fail, int, isISODate, ok, readJson, str } from "@/lib/api";
import {
  ACTIVE_STATUSES,
  addDaysISO,
  calcTotal,
  formatDate,
  todayISO,
  unitTypeInfo,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const body = await readJson(req);
  if (!body) return fail("Data tidak valid.");

  const unitId = int(body.unitId);
  const [unit] = await db.select().from(units).where(eq(units.id, unitId)).limit(1);
  if (!unit || !unit.isActive) return fail("Unit tidak tersedia untuk dipesan.", 404);

  const info = unitTypeInfo(unit.type);
  if (!isISODate(body.checkIn)) return fail("Tanggal tidak valid.");
  const checkIn = body.checkIn;
  const checkOut = info.multiNight ? (isISODate(body.checkOut) ? body.checkOut : "") : checkIn;
  if (!checkOut) return fail("Tanggal check-out wajib diisi.");
  if (checkIn < todayISO()) return fail("Tanggal tidak boleh di masa lalu.");
  if (info.multiNight && checkOut <= checkIn) return fail("Check-out harus setelah check-in.");

  const qty = Math.max(1, int(body.qty, 1));
  const guests = Math.max(1, int(body.guests, 1));
  if (qty > unit.quantity) return fail(`Jumlah maksimal ${unit.quantity} unit.`);
  if (guests > unit.capacity * qty) {
    return fail(`Kapasitas maksimal ${unit.capacity * qty} tamu untuk pilihan ini.`);
  }
  const arrivalTime = str(body.arrivalTime, 5);
  if (unit.type === "meja" && !/^\d{2}:\d{2}$/.test(arrivalTime)) return fail("Jam kedatangan wajib diisi.");

  // Cek ketersediaan per hari
  const lastDay = info.multiNight ? addDaysISO(checkOut, -1) : checkIn;
  const existing = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.unitId, unit.id),
        inArray(reservations.status, ACTIVE_STATUSES),
        lte(reservations.checkIn, lastDay),
        gte(reservations.checkOut, checkIn),
      ),
    );
  for (let d = checkIn; d <= lastDay; d = addDaysISO(d, 1)) {
    const used = existing
      .filter((r) => (r.checkIn === r.checkOut ? r.checkIn === d : r.checkIn <= d && d < r.checkOut))
      .reduce((s, r) => s + r.qty, 0);
    if (used + qty > unit.quantity) {
      return fail(`Maaf, ${unit.name} tidak cukup tersedia pada ${formatDate(d)}. Silakan pilih tanggal lain.`, 409);
    }
  }

  const { total } = calcTotal(unit, checkIn, checkOut, qty);
  let row;
  for (let i = 0; i < 5; i++) {
    try {
      [row] = await db
        .insert(reservations)
        .values({
          code: `SR-${randomInt(100000, 999999)}`,
          userId: user.id,
          unitId: unit.id,
          checkIn,
          checkOut,
          arrivalTime: unit.type === "meja" ? arrivalTime : "",
          guests,
          qty,
          totalPrice: total,
          notes: str(body.notes, 500),
        })
        .returning();
      break;
    } catch (e) {
      if (i === 4) throw e;
    }
  }
  return ok(row, 201);
}
