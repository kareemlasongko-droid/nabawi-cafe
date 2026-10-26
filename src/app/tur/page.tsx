import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import TourExplorer from "@/components/TourExplorer";
import { getCurrentUser } from "@/lib/auth";
import { getActiveUnits, getPublishedScenes } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tur Virtual 360°" };

export default async function TourPage({ searchParams }: { searchParams: Promise<{ scene?: string }> }) {
  const sp = await searchParams;
  const [user, scenes, units] = await Promise.all([getCurrentUser(), getPublishedScenes(), getActiveUnits()]);
  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">Tur virtual</p>
          <h1 className="font-display text-3xl font-semibold text-forest-900 sm:text-4xl">Jelajahi Senja Rimba dalam 360°</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">
            Seret panorama untuk melihat sekeliling, gunakan scroll atau cubit untuk zoom, dan klik tombol bulat untuk berpindah ke
            ruangan berikutnya.
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
        />
      </main>
    </div>
  );
}
