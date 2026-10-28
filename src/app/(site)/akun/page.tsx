import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { reservations } from "@/db/schema";
import { AccountHome, GuestAccount } from "@/components/AccountViews";
import { getCurrentUser } from "@/lib/auth";
import { ACTIVE_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Akun Saya" };

export default async function AccountPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return <GuestAccount />;

  const active = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(eq(reservations.userId, user.id), inArray(reservations.status, [...ACTIVE_STATUSES])));

  return (
    <AccountHome
      user={{ name: user.name, email: user.email, phone: user.phone, role: user.role }}
      activeCount={active.length}
    />
  );
}
