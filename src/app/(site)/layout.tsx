import type { ReactNode } from "react";
import PublicChrome from "@/components/PublicChrome";
import { getCurrentUser } from "@/lib/auth";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <PublicChrome user={user ? { name: user.name, role: user.role } : null}>
      {children}
    </PublicChrome>
  );
}
