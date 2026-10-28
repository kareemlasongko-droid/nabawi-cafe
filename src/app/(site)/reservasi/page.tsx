import type { Metadata } from "next";
import BookingFlow from "@/components/BookingFlow";
import { getCurrentUser } from "@/lib/auth";
import { getActiveUnits } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reservasi" };

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const { unit } = await searchParams;
  const [user, units] = await Promise.all([getCurrentUser().catch(() => null), getActiveUnits()]);
  return (
    <BookingFlow
      units={units.map((u) => ({
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
      }))}
      initialUnitId={unit ? Number(unit) : undefined}
      user={user ? { name: user.name, email: user.email, phone: user.phone, role: user.role } : null}
    />
  );
}
