import type { Metadata } from "next";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { tourScenes, units } from "@/db/schema";
import UnitManager from "@/components/UnitManager";
import { PageHeader } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unit & Meja" };

export default async function UnitsPage() {
  await requireAdminPage();
  const [rows, scenes] = await Promise.all([
    db.select().from(units).orderBy(desc(units.isActive), asc(units.type), asc(units.id)),
    db.select({ id: tourScenes.id, title: tourScenes.title }).from(tourScenes).orderBy(asc(tourScenes.sortOrder)),
  ]);
  return (
    <div>
      <PageHeader title="Unit & Meja" description="Kelola kamar, villa, meja cafe, dan aula yang dapat dipesan pelanggan." />
      <UnitManager
        scenes={scenes}
        initial={rows.map((u) => ({
          id: u.id,
          name: u.name,
          type: u.type,
          description: u.description,
          price: u.price,
          capacity: u.capacity,
          quantity: u.quantity,
          imageUrl: u.imageUrl,
          facilities: u.facilities,
          sceneId: u.sceneId,
          isActive: u.isActive,
        }))}
      />
    </div>
  );
}
