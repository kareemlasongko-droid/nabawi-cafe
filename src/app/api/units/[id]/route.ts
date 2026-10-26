import { eq } from "drizzle-orm";
import { db } from "@/db";
import { units } from "@/db/schema";
import { apiAdmin, fail, ok, readJson } from "@/lib/api";
import { parseUnit } from "../route";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await apiAdmin();
  if (admin instanceof Response) return admin;
  const id = Number((await ctx.params).id);
  const body = await readJson(req);
  // Toggle cepat status aktif
  if (body && Object.keys(body).length === 1 && typeof body.isActive === "boolean") {
    const [row] = await db.update(units).set({ isActive: body.isActive }).where(eq(units.id, id)).returning();
    return row ? ok(row) : fail("Unit tidak ditemukan.", 404);
  }
  const parsed = parseUnit(body);
  if (parsed.error !== undefined) return fail(parsed.error);
  const [row] = await db.update(units).set(parsed.value).where(eq(units.id, id)).returning();
  return row ? ok(row) : fail("Unit tidak ditemukan.", 404);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await apiAdmin();
  if (admin instanceof Response) return admin;
  const id = Number((await ctx.params).id);
  try {
    await db.delete(units).where(eq(units.id, id));
    return ok();
  } catch {
    return fail("Unit ini memiliki riwayat reservasi dan tidak dapat dihapus. Nonaktifkan saja unit ini.", 409);
  }
}
