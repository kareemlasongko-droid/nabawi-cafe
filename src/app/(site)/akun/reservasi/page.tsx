import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import ReservationManager from "@/components/ReservationManager";
import { requireUser } from "@/lib/auth";
import { getReservations } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reservasi Saya" };

export default async function MyReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const user = await requireUser("/akun/reservasi");
  const items = await getReservations({ userId: user.id });

  return (
    <div className="container-app">
      <div className="mx-auto max-w-3xl pt-4 sm:pt-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">Reservasi Saya</h1>
            <p className="mt-1 text-sm text-stone-500">Pantau status, unggah bukti transfer, atau batalkan pesanan.</p>
          </div>
          <Link href="/reservasi" className="btn btn-primary btn-sm shrink-0 sm:!px-4">
            <PlusCircle className="size-4" /> Baru
          </Link>
        </div>
        <ReservationManager
          initial={items}
          role="customer"
          userName={user.name}
          initialStatus={status}
          variant="customer"
        />
      </div>
    </div>
  );
}
