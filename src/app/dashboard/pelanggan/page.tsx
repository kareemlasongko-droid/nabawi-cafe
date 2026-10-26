import type { Metadata } from "next";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { reservations, users } from "@/db/schema";
import UserManager from "@/components/UserManager";
import { PageHeader } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pengguna" };

export default async function UsersPage() {
  const me = await requireAdminPage();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      reservations: sql<number>`(select count(*)::int from ${reservations} where ${reservations.userId} = ${users.id})`,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
  return (
    <div>
      <PageHeader title="Pengguna" description="Kelola akun admin dan pelanggan." />
      <UserManager initial={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))} currentUserId={me.id} />
    </div>
  );
}
