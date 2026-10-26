import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tourScenes, type Hotspot } from "@/db/schema";
import { apiAdmin, fail, int, ok, readJson, str } from "@/lib/api";

export const dynamic = "force-dynamic";

export function parseScene(body: Record<string, unknown> | null) {
  if (!body) return { error: "Data tidak valid." } as const;
  const title = str(body.title, 120);
  const imageUrl = str(body.imageUrl, 500);
  if (title.length < 3) return { error: "Judul minimal 3 karakter." } as const;
  if (!imageUrl) return { error: "Gambar panorama 360° wajib diisi." } as const;
  const hotspots: Hotspot[] = Array.isArray(body.hotspots)
    ? (body.hotspots as Record<string, unknown>[])
        .map((h) => ({
          targetId: int(h?.targetId),
          label: str(h?.label, 80),
          yaw: Math.max(-180, Math.min(180, Number(h?.yaw) || 0)),
          pitch: Math.max(-90, Math.min(90, Number(h?.pitch) || 0)),
        }))
        .filter((h) => h.targetId > 0 && h.label)
        .slice(0, 12)
    : [];
  return {
    value: {
      title,
      description: str(body.description, 1500),
      category: str(body.category, 30) || "Lainnya",
      imageUrl,
      sortOrder: int(body.sortOrder),
      isPublished: body.isPublished === false ? false : true,
      hotspots,
    },
  } as const;
}

export async function POST(req: Request) {
  const admin = await apiAdmin();
  if (admin instanceof Response) return admin;
  const parsed = parseScene(await readJson(req));
  if (parsed.error !== undefined) return fail(parsed.error);
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${tourScenes.sortOrder}), 0)::int` })
    .from(tourScenes);
  const [row] = await db
    .insert(tourScenes)
    .values({ ...parsed.value, sortOrder: parsed.value.sortOrder || max + 1 })
    .returning();
  return ok(row, 201);
}
