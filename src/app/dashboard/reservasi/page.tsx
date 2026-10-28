import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusCircle } from "lucide-react";
import ReservationManager from "@/components/ReservationManager";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getReservations } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reservasi" };

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/akun/reservasi");
  const { status } = await searchParams;
  const isAdmin = user.role === "admin";
  const items = await getReservations(isAdmin ? {} : { userId: user.id });
  return (
    <div>
      <PageHeader
        title={isAdmin ? "Kelola Reservasi" : "Reservasi Saya"}
        description={
          isAdmin
            ? "Verifikasi bukti transfer secara manual, konfirmasi, atau tolak reservasi pelanggan."
            : "Lihat status reservasi, unggah bukti transfer, atau batalkan pesanan."
        }
        action={
          !isAdmin && (
            <Link href="/dashboard/reservasi/baru" className="btn btn-primary">
              <PlusCircle className="size-4" /> Reservasi Baru
            </Link>
          )
        }
      />
      <ReservationManager initial={items} role={user.role} userName={user.name} initialStatus={status} />
    </div>
  );
}
