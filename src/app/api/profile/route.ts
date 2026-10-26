import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { apiUser, fail, ok, readJson, str } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const body = await readJson(req);
  const name = str(body?.name, 100);
  if (name.length < 2) return fail("Nama minimal 2 karakter.");
  const set: Partial<typeof users.$inferInsert> = { name, phone: str(body?.phone, 30) };
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (newPassword) {
    const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!row || !verifyPassword(current, row.passwordHash)) return fail("Kata sandi saat ini salah.", 400);
    if (newPassword.length < 6) return fail("Kata sandi baru minimal 6 karakter.");
    set.passwordHash = hashPassword(newPassword);
  }
  await db.update(users).set(set).where(eq(users.id, user.id));
  return ok();
}
