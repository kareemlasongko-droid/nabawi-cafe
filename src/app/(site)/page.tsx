import Link from "next/link";
import { Banknote, CalendarCheck, Mail, MapPin, MessageCircle, Phone, View } from "lucide-react";
import HomeExplorer from "@/components/HomeExplorer";
import Logo from "@/components/Logo";
import { getActiveUnits, getPublishedScenes } from "@/lib/data";
import { BANKS, BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

const steps = [
  {
    icon: View,
    title: "Lihat & pilih tempat",
    text: "Intip dulu lewat tur 360°, lalu pilih kamar, villa, meja, atau aula favoritmu.",
  },
  {
    icon: CalendarCheck,
    title: "Atur jadwal",
    text: "Tentukan tanggal dan jumlah tamu — total harga langsung terlihat, tanpa biaya tersembunyi.",
  },
  {
    icon: Banknote,
    title: "Transfer & unggah bukti",
    text: "Bayar ke rekening resmi kami dan unggah bukti transfer. Admin mengonfirmasi, selesai!",
  },
];

export default async function HomePage() {
  const [scenes, units] = await Promise.all([getPublishedScenes(), getActiveUnits()]);
  const coverImage = scenes[0]?.imageUrl ?? units.find((u) => u.imageUrl)?.imageUrl ?? "";

  return (
    <div>
      <HomeExplorer
        coverImage={coverImage}
        sceneCount={scenes.length}
        units={units.map((u) => ({
          id: u.id,
          name: u.name,
          type: u.type,
          description: u.description,
          price: u.price,
          capacity: u.capacity,
          quantity: u.quantity,
          imageUrl: u.imageUrl,
          facilities: u.facilities,
          sceneId: u.sceneId,
        }))}
      />

      {/* ---------- CARA PESAN ---------- */}
      <section id="cara-pesan" className="container-app mt-12 scroll-mt-24">
        <h2 className="text-center text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
          Pesan semudah pesan kopi
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-center text-sm text-stone-500">
          Tiga langkah singkat, semua dari HP. Tanpa antre, tanpa ribet.
        </p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="card relative overflow-hidden p-5">
              <span className="absolute -right-1 -top-3 text-[64px] font-extrabold leading-none text-forest-50">{i + 1}</span>
              <span className="relative grid size-11 place-items-center rounded-2xl bg-forest-600 text-white shadow-md shadow-forest-600/25">
                <s.icon className="size-5" />
              </span>
              <h3 className="relative mt-3.5 font-extrabold text-stone-900">{s.title}</h3>
              <p className="relative mt-1 text-sm leading-relaxed text-stone-500">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- REKENING & KONTAK ---------- */}
      <section className="container-app mt-8 grid gap-4 lg:grid-cols-2">
        <div className="card p-5 sm:p-6">
          <h3 className="font-extrabold text-stone-900">Rekening pembayaran resmi</h3>
          <p className="mt-1 text-sm text-stone-500">
            Transfer hanya ke rekening berikut atas nama {BANKS[0].holder}.
          </p>
          <ul className="mt-4 space-y-2">
            {BANKS.map((b) => (
              <li key={b.bank} className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f6f4] px-4 py-3 ring-1 ring-stone-200/70">
                <div>
                  <p className="text-sm font-extrabold text-stone-800">{b.bank}</p>
                  <p className="text-xs text-stone-400">a.n. {b.holder}</p>
                </div>
                <p className="font-mono text-[15px] font-semibold text-stone-700">{b.number}</p>
              </li>
            ))}
          </ul>
        </div>

        <div id="kontak" className="scroll-mt-24 rounded-[24px] bg-forest-950 p-5 text-white shadow-lg sm:p-6">
          <Logo light />
          <p className="mt-3 max-w-sm text-sm text-white/70">
            Cafe &amp; resort di dataran tinggi Lembang untuk melepas penat dan merayakan momen.
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/85">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-forest-300" /> {BRAND.address}
            </li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-forest-300" /> {BRAND.phone}
            </li>
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-forest-300" /> {BRAND.email}
            </li>
          </ul>
          <a
            href={`https://wa.me/${BRAND.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="btn mt-5 bg-white font-extrabold text-forest-900 hover:bg-forest-50"
          >
            <MessageCircle className="size-4" /> Chat WhatsApp
          </a>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="mt-12 border-t border-stone-200/80">
        <div className="container-app flex flex-col items-center justify-between gap-3 py-6 text-xs text-stone-400 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {BRAND.name} {BRAND.tagline}. Seluruh hak dilindungi.
          </p>
          <nav className="flex gap-5 font-semibold">
            <Link href="/tur" className="hover:text-forest-700">
              Tur 360°
            </Link>
            <Link href="/reservasi" className="hover:text-forest-700">
              Reservasi
            </Link>
            <Link href="/akun" className="hover:text-forest-700">
              Akun
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
