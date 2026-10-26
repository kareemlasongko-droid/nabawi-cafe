import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { apiAdmin, fail, ok, readJson, str } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = await apiAdmin();
  if (admin instanceof Response) return admin;
  const body = await readJson(req);
  const name = str(body?.name, 100);
  const email = str(body?.email, 200).toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role === "admin" ? "admin" : "customer";
  if (name.length < 2) return fail("Nama minimal 2 karakter.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Format email tidak valid.");
  if (password.length < 6) return fail("Kata sandi minimal 6 karakter.");
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (exists) return fail("Email sudah terdaftar.", 409);
  const [row] = await db
    .insert(users)
    .values({ name, email, phone: str(body?.phone, 30), role, passwordHash: hashPassword(password) })
    .returning({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, createdAt: users.createdAt });
  return ok(row, 201);
}
