import type { ReactNode } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { reservations } from "@/db/schema";
import DashboardShell from "@/components/DashboardShell";
import { requireUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await ensureSeed();
  const user = await requireUser();
  // admin: pembayaran yang menunggu verifikasi · pelanggan: reservasi yang butuh pembayaran
  const rows = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      user.role === "admin"
        ? eq(reservations.status, "menunggu_konfirmasi")
        : and(eq(reservations.userId, user.id), inArray(reservations.status, ["menunggu_pembayaran"])),
    );
  return (
    <DashboardShell user={{ name: user.name, email: user.email, role: user.role }} pending={rows.length}>
      {children}
    </DashboardShell>
  );
}
