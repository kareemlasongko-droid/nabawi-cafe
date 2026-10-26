import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, reservations } from "@/db/schema";
import { apiUser, fail, ok, readJson, str } from "@/lib/api";
import { todayISO } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const id = Number((await ctx.params).id);
  const body = await readJson(req);
  const action = str(body?.action, 30);
  const [r] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  if (!r) return fail("Reservasi tidak ditemukan.", 404);
  const isAdmin = user.role === "admin";
  if (!isAdmin && r.userId !== user.id) return fail("Anda tidak memiliki akses.", 403);

  const adminNote = str(body?.adminNote, 500);

  const latestPayment = async () =>
    (
      await db
        .select()
        .from(payments)
        .where(eq(payments.reservationId, id))
        .orderBy(desc(payments.id))
        .limit(1)
    )[0];

  if (action === "cancel") {
    const allowed = isAdmin
      ? ["menunggu_pembayaran", "menunggu_konfirmasi", "dikonfirmasi"]
      : ["menunggu_pembayaran", "menunggu_konfirmasi"];
    if (!allowed.includes(r.status)) {
      return fail("Reservasi ini tidak dapat dibatalkan. Hubungi kami untuk bantuan.", 409);
    }
    const [row] = await db
      .update(reservations)
      .set({ status: "dibatalkan", adminNote: isAdmin ? adminNote : r.adminNote })
      .where(eq(reservations.id, id))
      .returning();
    return ok(row);
  }

  if (!isAdmin) return fail("Anda tidak memiliki akses.", 403);

  if (action === "confirm") {
    if (!["menunggu_pembayaran", "menunggu_konfirmasi"].includes(r.status)) {
      return fail("Status reservasi tidak dapat dikonfirmasi.", 409);
    }
    const p = await latestPayment();
    if (p) {
      await db.update(payments).set({ status: "diterima" }).where(eq(payments.id, p.id));
    } else {
      await db.insert(payments).values({
        reservationId: id,
        bank: "Manual",
        senderName: "Dicatat oleh admin",
        amount: r.totalPrice,
        paidAt: todayISO(),
        status: "diterima",
        note: "Pembayaran dikonfirmasi manual oleh admin.",
      });
    }
    const [row] = await db
      .update(reservations)
      .set({ status: "dikonfirmasi", adminNote })
      .where(eq(reservations.id, id))
      .returning();
    return ok(row);
  }

  if (action === "reject_payment") {
    if (r.status !== "menunggu_konfirmasi") return fail("Tidak ada pembayaran yang menunggu verifikasi.", 409);
    const p = await latestPayment();
    if (p) await db.update(payments).set({ status: "ditolak" }).where(eq(payments.id, p.id));
    const [row] = await db
      .update(reservations)
      .set({ status: "menunggu_pembayaran", adminNote: adminNote || "Bukti pembayaran tidak sesuai. Silakan unggah ulang." })
      .where(eq(reservations.id, id))
      .returning();
    return ok(row);
  }

  if (action === "reject") {
    if (!["menunggu_pembayaran", "menunggu_konfirmasi"].includes(r.status)) {
      return fail("Status reservasi tidak dapat ditolak.", 409);
    }
    const [row] = await db
      .update(reservations)
      .set({ status: "ditolak", adminNote })
      .where(eq(reservations.id, id))
      .returning();
    return ok(row);
  }

  if (action === "complete") {
    if (r.status !== "dikonfirmasi") return fail("Hanya reservasi terkonfirmasi yang dapat diselesaikan.", 409);
    const [row] = await db
      .update(reservations)
      .set({ status: "selesai" })
      .where(eq(reservations.id, id))
      .returning();
    return ok(row);
  }

  if (action === "note") {
    const [row] = await db.update(reservations).set({ adminNote }).where(eq(reservations.id, id)).returning();
    return ok(row);
  }

  return fail("Aksi tidak dikenal.");
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const id = Number((await ctx.params).id);
  const [r] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  if (!r) return ok();
  if (user.role !== "admin") {
    if (r.userId !== user.id) return fail("Anda tidak memiliki akses.", 403);
    if (!["dibatalkan", "ditolak"].includes(r.status)) {
      return fail("Hanya reservasi yang dibatalkan atau ditolak yang dapat dihapus.", 409);
    }
  }
  await db.delete(reservations).where(and(eq(reservations.id, id)));
  return ok();
}
