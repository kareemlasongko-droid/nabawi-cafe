import type { Metadata } from "next";
import TourExplorer from "@/components/TourExplorer";
import { getActiveUnits, getPublishedScenes } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tur Virtual 360°" };

export default async function TourPage({ searchParams }: { searchParams: Promise<{ scene?: string }> }) {
  const sp = await searchParams;
  const [scenes, units] = await Promise.all([getPublishedScenes(), getActiveUnits()]);
  return (
    <div className="container-app pb-10 pt-4 sm:pt-6">
      <div className="mb-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-forest-700">Tur Virtual 360°</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
          Jelajahi Senja Rimba dari genggamanmu
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-stone-500">
          Geser untuk melihat sekeliling, cubit untuk memperbesar, dan ketuk titik putih untuk berpindah ruangan.
        </p>
      </div>
      <TourExplorer
        scenes={scenes.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          category: s.category,
          imageUrl: s.imageUrl,
          hotspots: s.hotspots,
        }))}
        units={units.map((u) => ({
          id: u.id,
          name: u.name,
          type: u.type,
          price: u.price,
          sceneId: u.sceneId,
          imageUrl: u.imageUrl,
        }))}
        initialSceneId={sp.scene ? Number(sp.scene) : undefined}
        viewerClass="h-[58dvh] min-h-[340px] lg:h-[620px]"
      />
    </div>
  );
}
