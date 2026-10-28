import { redirect } from "next/navigation";

/** Reservasi baru kini memakai wizard publik yang mobile-friendly di /reservasi. */
export default async function NewReservationRedirect({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit } = await searchParams;
  redirect(unit ? `/reservasi?unit=${unit}` : "/reservasi");
}
