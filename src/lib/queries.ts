import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { payments, reservations, units, users } from "@/db/schema";

export type PaymentView = {
  id: number;
  bank: string;
  senderName: string;
  amount: number;
  paidAt: string;
  proofUrl: string;
  note: string;
  status: string;
  createdAt: string;
};

export type ReservationView = {
  id: number;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  arrivalTime: string;
  guests: number;
  qty: number;
  totalPrice: number;
  notes: string;
  adminNote: string;
  createdAt: string;
  unit: { id: number; name: string; type: string; imageUrl: string };
  customer: { id: number; name: string; email: string; phone: string };
  payments: PaymentView[];
};

export async function getReservations(opts: { userId?: number } = {}): Promise<ReservationView[]> {
  const base = db
    .select({
      r: reservations,
      unit: { id: units.id, name: units.name, type: units.type, imageUrl: units.imageUrl },
      customer: { id: users.id, name: users.name, email: users.email, phone: users.phone },
    })
    .from(reservations)
    .innerJoin(units, eq(units.id, reservations.unitId))
    .innerJoin(users, eq(users.id, reservations.userId));
  const rows = await (opts.userId ? base.where(eq(reservations.userId, opts.userId)) : base).orderBy(
    desc(reservations.createdAt),
  );
  if (rows.length === 0) return [];
  const pays = await db
    .select()
    .from(payments)
    .where(
      inArray(
        payments.reservationId,
        rows.map((x) => x.r.id),
      ),
    )
    .orderBy(desc(payments.id));
  return rows.map(({ r, unit, customer }) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    arrivalTime: r.arrivalTime,
    guests: r.guests,
    qty: r.qty,
    totalPrice: r.totalPrice,
    notes: r.notes,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    unit,
    customer,
    payments: pays
      .filter((p) => p.reservationId === r.id)
      .map((p) => ({
        id: p.id,
        bank: p.bank,
        senderName: p.senderName,
        amount: p.amount,
        paidAt: p.paidAt,
        proofUrl: p.proofUrl,
        note: p.note,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
  }));
}
