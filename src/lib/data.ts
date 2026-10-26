import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tourScenes, units } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";

export async function getPublishedScenes() {
  await ensureSeed();
  return db
    .select()
    .from(tourScenes)
    .where(eq(tourScenes.isPublished, true))
    .orderBy(asc(tourScenes.sortOrder), asc(tourScenes.id));
}

export async function getActiveUnits() {
  await ensureSeed();
  return db.select().from(units).where(eq(units.isActive, true)).orderBy(asc(units.type), asc(units.price));
}
