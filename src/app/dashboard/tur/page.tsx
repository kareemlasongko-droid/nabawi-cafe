import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { tourScenes } from "@/db/schema";
import SceneManager from "@/components/SceneManager";
import { PageHeader } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tur 360°" };

export default async function ScenesPage() {
  await requireAdminPage();
  const rows = await db.select().from(tourScenes).orderBy(asc(tourScenes.sortOrder), asc(tourScenes.id));
  return (
    <div>
      <PageHeader title="Tur Virtual 360°" description="Kelola area panorama dan hotspot navigasi yang tampil di tur publik." />
      <SceneManager
        initial={rows.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          category: s.category,
          imageUrl: s.imageUrl,
          sortOrder: s.sortOrder,
          isPublished: s.isPublished,
          hotspots: s.hotspots,
        }))}
      />
    </div>
  );
}
