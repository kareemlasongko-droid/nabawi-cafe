import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tourScenes } from "@/db/schema";
import { apiAdmin, fail, ok, readJson } from "@/lib/api";
import { parseScene } from "../route";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await apiAdmin();
  if (admin instanceof Response) return admin;
  const id = Number((await ctx.params).id);
  const body = await readJson(req);
  if (body && Object.keys(body).length === 1 && typeof body.isPublished === "boolean") {
    const [row] = await db
      .update(tourScenes)
      .set({ isPublished: body.isPublished })
      .where(eq(tourScenes.id, id))
      .returning();
    return row ? ok(row) : fail("Scene tidak ditemukan.", 404);
  }
  const parsed = parseScene(body);
  if (parsed.error !== undefined) return fail(parsed.error);
  const value = { ...parsed.value, hotspots: parsed.value.hotspots.filter((h) => h.targetId !== id) };
  const [row] = await db.update(tourScenes).set(value).where(eq(tourScenes.id, id)).returning();
  return row ? ok(row) : fail("Scene tidak ditemukan.", 404);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await apiAdmin();
  if (admin instanceof Response) return admin;
  const id = Number((await ctx.params).id);
  await db.transaction(async (tx) => {
    await tx.delete(tourScenes).where(eq(tourScenes.id, id));
    const others = await tx.select().from(tourScenes);
    for (const s of others) {
      const filtered = s.hotspots.filter((h) => h.targetId !== id);
      if (filtered.length !== s.hotspots.length) {
        await tx.update(tourScenes).set({ hotspots: filtered }).where(eq(tourScenes.id, s.id));
      }
    }
  });
  return ok();
}
