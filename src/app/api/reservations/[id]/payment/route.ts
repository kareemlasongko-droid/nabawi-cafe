import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, reservations } from "@/db/schema";
import { apiUser, fail, int, isISODate, ok, readJson, str } from "@/lib/api";
import { BANKS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const id = Number((await ctx.params).id);
  const [r] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  if (!r || r.userId !== user.id) return fail("Reservasi tidak ditemukan.", 404);
  if (r.status !== "menunggu_pembayaran") return fail("Reservasi ini tidak sedang menunggu pembayaran.", 409);

  const body = await readJson(req);
  const bank = str(body?.bank, 40);
  const senderName = str(body?.senderName, 100);
  const amount = int(body?.amount);
  const proofUrl = str(body?.proofUrl, 500);
  if (!BANKS.some((b) => b.bank === bank) && bank.length < 2) return fail("Bank pengirim wajib diisi.");
  if (senderName.length < 2) return fail("Nama pengirim wajib diisi.");
  if (amount <= 0) return fail("Nominal transfer tidak valid.");
  if (!isISODate(body?.paidAt)) return fail("Tanggal transfer tidak valid.");
  // Bukti transfer wajib berasal dari bucket privat yang diunggah lewat
  // /api/upload. Prefix ini juga yang membuat route /api/media/[...path]
  // menerapkan cek kepemilikan sebelum menyajikan berkasnya.
  if (!proofUrl.startsWith("/api/media/proof/")) return fail("Bukti transfer wajib diunggah.");

  const [p] = await db
    .insert(payments)
    .values({
      reservationId: id,
      bank,
      senderName,
      amount,
      paidAt: body.paidAt as string,
      proofUrl,
      note: str(body?.note, 300),
    })
    .returning();
  await db.update(reservations).set({ status: "menunggu_konfirmasi", adminNote: "" }).where(eq(reservations.id, id));
  return ok(p, 201);
}
