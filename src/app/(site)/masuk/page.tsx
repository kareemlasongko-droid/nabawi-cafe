import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import AuthShell from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await ensureSeed();
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/dashboard" : "/akun");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return (
    <AuthShell title="Selamat datang kembali" subtitle="Masuk untuk memantau reservasi dan pembayaranmu.">
      <AuthForm mode="masuk" next={dest} />
    </AuthShell>
  );
}
