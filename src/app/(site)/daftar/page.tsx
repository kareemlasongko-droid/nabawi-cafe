import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import AuthShell from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Daftar" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/dashboard" : "/akun");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return (
    <AuthShell title="Buat akun baru" subtitle="Daftar sebentar saja — setelahnya langsung bisa reservasi.">
      <AuthForm mode="daftar" next={dest} />
    </AuthShell>
  );
}
