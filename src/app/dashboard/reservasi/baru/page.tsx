import type { Metadata } from "next";
import ReservationForm from "@/components/ReservationForm";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getActiveUnits } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reservasi Baru" };

export default async function NewReservationPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const { unit } = await searchParams;
  await requireUser(`/dashboard/reservasi/baru${unit ? `?unit=${unit}` : ""}`);
  const units = await getActiveUnits();
  return (
    <div>
      <PageHeader title="Reservasi Baru" description="Pilih unit, tentukan tanggal, lalu lanjutkan ke pembayaran manual." />
      <ReservationForm
        units={units.map((u) => ({
          id: u.id,
          name: u.name,
          type: u.type,
          description: u.description,
          price: u.price,
          capacity: u.capacity,
          quantity: u.quantity,
          imageUrl: u.imageUrl,
          sceneId: u.sceneId,
        }))}
        initialUnitId={unit ? Number(unit) : undefined}
      />
    </div>
  );
}
