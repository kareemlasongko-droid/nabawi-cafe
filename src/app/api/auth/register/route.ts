import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { fail, ok, readJson, str } from "@/lib/api";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureSeed();
  const body = await readJson(req);
  const name = str(body?.name, 100);
  const email = str(body?.email, 200).toLowerCase();
  const phone = str(body?.phone, 30);
  const password = typeof body?.password === "string" ? body.password : "";
  if (name.length < 2) return fail("Nama minimal 2 karakter.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Format email tidak valid.");
  if (password.length < 6) return fail("Kata sandi minimal 6 karakter.");
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (exists) return fail("Email sudah terdaftar. Silakan masuk.", 409);
  const [user] = await db
    .insert(users)
    .values({ name, email, phone, passwordHash: hashPassword(password), role: "customer" })
    .returning({ id: users.id });
  await createSession(user.id);
  return ok({ ok: true }, 201);
}
