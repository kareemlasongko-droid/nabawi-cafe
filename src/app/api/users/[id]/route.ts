import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { apiAdmin, fail, ok, readJson, str } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await apiAdmin();
  if (admin instanceof Response) return admin;
  const id = Number((await ctx.params).id);
  const body = await readJson(req);
  const name = str(body?.name, 100);
  const email = str(body?.email, 200).toLowerCase();
  if (name.length < 2) return fail("Nama minimal 2 karakter.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Format email tidak valid.");
  const [dupe] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, id)))
    .limit(1);
  if (dupe) return fail("Email sudah dipakai pengguna lain.", 409);
  const role = body?.role === "admin" ? "admin" : "customer";
  if (id === admin.id && role !== "admin") return fail("Anda tidak dapat menurunkan peran akun sendiri.");
  const set: Partial<typeof users.$inferInsert> = { name, email, phone: str(body?.phone, 30), role };
  const pw = typeof body?.password === "string" ? body.password : "";
  if (pw) {
    if (pw.length < 6) return fail("Kata sandi minimal 6 karakter.");
    set.passwordHash = hashPassword(pw);
  }
  const [row] = await db
    .update(users)
    .set(set)
    .where(eq(users.id, id))
    .returning({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, createdAt: users.createdAt });
  return row ? ok(row) : fail("Pengguna tidak ditemukan.", 404);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await apiAdmin();
  if (admin instanceof Response) return admin;
  const id = Number((await ctx.params).id);
  if (id === admin.id) return fail("Anda tidak dapat menghapus akun sendiri.");
  await db.delete(users).where(eq(users.id, id));
  return ok();
}
