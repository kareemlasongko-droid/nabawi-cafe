import type { Metadata } from "next";
import ProfileForm from "@/components/ProfileForm";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="Profil Saya" description="Perbarui data diri dan kata sandi akun Anda." />
      <ProfileForm user={{ name: user.name, email: user.email, phone: user.phone, role: user.role }} />
    </div>
  );
}
