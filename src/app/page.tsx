import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  Coffee,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  View,
  Waves,
  Wifi,
  Mountain,
  TreePine,
} from "lucide-react";
import SiteHeader, { Logo } from "@/components/SiteHeader";
import UnitGrid from "@/components/UnitGrid";
import { getCurrentUser } from "@/lib/auth";
import { getActiveUnits, getPublishedScenes } from "@/lib/data";
import { BANKS, BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

const steps = [
  { icon: View, title: "Jelajahi tur 360°", text: "Lihat langsung kamar, villa, kolam, dan cafe dari layar Anda sebelum memutuskan." },
  { icon: CalendarCheck, title: "Pilih & reservasi", text: "Tentukan unit, tanggal, dan jumlah tamu. Ketersediaan dicek otomatis." },
  { icon: Banknote, title: "Transfer manual", text: "Transfer ke rekening resmi kami lalu unggah bukti pembayaran di dashboard." },
  { icon: Star, title: "Konfirmasi admin", text: "Tim kami memverifikasi pembayaran Anda, status reservasi berubah menjadi terkonfirmasi." },
];

const highlights = [
  { icon: Mountain, title: "Pemandangan lembah", text: "Teras kayu menghadap perbukitan Lembang." },
  { icon: Waves, title: "Kolam infinity", text: "Berenang dengan latar hutan pinus." },
  { icon: Coffee, title: "Kopi lokal", text: "Biji pilihan petani Jawa Barat, diseduh di tempat." },
  { icon: TreePine, title: "Udara sejuk", text: "Dikelilingi pinus, 1.250 mdpl." },
  { icon: Wifi, title: "Wi-Fi cepat", text: "Nyaman untuk bekerja dari alam." },
];

export default async function HomePage() {
  const [user, scenes, units] = await Promise.all([getCurrentUser(), getPublishedScenes(), getActiveUnits()]);
  const cover = scenes[0];

  return (
    <div>
      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-forest-950 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/hero-resort.jpg" alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-forest-950/70 via-forest-950/30 to-forest-950" />
        <SiteHeader user={user} overlay />
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-36 sm:px-6 sm:pt-44 lg:pb-32">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 backdrop-blur">
            <MapPin className="size-3.5" /> Lembang, Bandung Barat
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[1.08] sm:text-6xl">
            Rasakan senja di tengah rimba, <span className="text-gold-300">sebelum Anda tiba.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
            Jelajahi cafe, kolam, dan villa kami lewat tur virtual 360°, lalu reservasi langsung secara online — pembayaran
            lewat transfer, dikonfirmasi oleh tim kami.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/tur" className="btn btn-gold !px-6 !py-3">
              <View className="size-5" /> Mulai Tur 360°
            </Link>
            <Link href="/dashboard/reservasi/baru" className="btn !px-6 !py-3 bg-white/10 text-white backdrop-blur hover:bg-white/20">
              Reservasi Sekarang <ArrowRight className="size-4" />
            </Link>
          </div>
          <dl className="mt-14 grid max-w-xl grid-cols-3 gap-4 border-t border-white/15 pt-6">
            {[
              [`${scenes.length}`, "Area tur 360°"],
              [`${units.length}`, "Pilihan akomodasi & meja"],
              ["4.8/5", "Rating tamu"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-2xl font-semibold text-gold-300 sm:text-3xl">{v}</dt>
                <dd className="text-xs text-white/70 sm:text-sm">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* SOROTAN */}
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-5">
          {highlights.map((h) => (
            <div key={h.title} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
                <h.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-forest-900">{h.title}</p>
                <p className="text-xs text-stone-500">{h.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TUR */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">Tur virtual</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-forest-900 sm:text-4xl">
              Keliling resort tanpa beranjak dari rumah
            </h2>
            <p className="mt-4 text-stone-600">
              Putar, perbesar, dan berpindah antar ruangan dengan panorama 360° interaktif. Lihat sendiri suasana teras senja,
              interior villa, hingga kolam renang — lalu pesan area favorit Anda langsung dari tur.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-stone-700">
              {["Navigasi antar ruangan lewat tombol hotspot", "Berfungsi di ponsel, tablet, dan desktop", "Pesan unit langsung dari area yang dilihat"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-gold-500" /> {t}
                </li>
              ))}
            </ul>
            <Link href="/tur" className="btn btn-primary mt-8 !px-6 !py-3">
              Buka Tur 360° <ArrowRight className="size-4" />
            </Link>
          </div>
          <Link href="/tur" className="group relative block aspect-[4/3] overflow-hidden rounded-3xl shadow-xl ring-1 ring-stone-200">
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.imageUrl} alt={cover.title} className="size-full object-cover transition duration-700 group-hover:scale-105" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-forest-950/70 to-transparent" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid size-20 place-items-center rounded-full bg-white/90 text-forest-800 shadow-xl transition group-hover:scale-110">
                <View className="size-9" />
              </span>
            </div>
            <span className="absolute bottom-4 left-4 rounded-full bg-forest-950/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              {cover?.title ?? "Tur 360°"} · Klik untuk menjelajah
            </span>
          </Link>
        </div>
      </section>

      {/* UNIT */}
      <section id="unit" className="scroll-mt-20 bg-gold-50/60 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">Akomodasi & Cafe</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-forest-900 sm:text-4xl">Pilih tempat favorit Anda</h2>
          <p className="mb-8 mt-3 max-w-2xl text-stone-600">
            Dari kamar nyaman untuk berdua, villa keluarga, meja di teras senja, hingga aula untuk acara spesial.
          </p>
          <UnitGrid
            units={units.map((u) => ({
              id: u.id,
              name: u.name,
              type: u.type,
              description: u.description,
              price: u.price,
              capacity: u.capacity,
              imageUrl: u.imageUrl,
              facilities: u.facilities,
              sceneId: u.sceneId,
            }))}
          />
        </div>
      </section>

      {/* CARA RESERVASI */}
      <section id="cara-reservasi" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">Cara reservasi</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-forest-900 sm:text-4xl">Empat langkah mudah</h2>
        </div>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="card relative p-6">
              <span className="absolute right-5 top-4 font-display text-5xl font-semibold text-forest-100">{i + 1}</span>
              <span className="grid size-11 place-items-center rounded-xl bg-forest-800 text-gold-300">
                <s.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold text-forest-900">{s.title}</h3>
              <p className="mt-1.5 text-sm text-stone-500">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-3xl bg-forest-900 p-6 text-white sm:p-8">
          <h3 className="font-display text-xl font-semibold">Rekening pembayaran resmi</h3>
          <p className="mt-1 text-sm text-white/70">Transfer sesuai total tagihan, lalu unggah bukti di halaman reservasi Anda.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {BANKS.map((b) => (
              <div key={b.bank} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-wider text-gold-300">{b.bank}</p>
                <p className="mt-1 font-mono text-lg">{b.number}</p>
                <p className="text-xs text-white/70">a.n. {b.holder}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KONTAK */}
      <footer id="kontak" className="scroll-mt-20 bg-forest-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm text-white/60">
              Cafe & resort di dataran tinggi Lembang untuk melepas penat, merayakan momen, dan menikmati senja.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-white/80">
            <li className="flex gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-gold-300" /> {BRAND.address}</li>
            <li className="flex gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-gold-300" /> {BRAND.phone}</li>
            <li className="flex gap-3"><Mail className="mt-0.5 size-4 shrink-0 text-gold-300" /> {BRAND.email}</li>
          </ul>
          <div>
            <p className="text-sm text-white/70">Ada pertanyaan sebelum reservasi? Hubungi kami lewat WhatsApp.</p>
            <a
              href={`https://wa.me/${BRAND.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-gold mt-4"
            >
              <MessageCircle className="size-4" /> Chat WhatsApp
            </a>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">
          © {new Date().getFullYear()} {BRAND.name} {BRAND.tagline}. Seluruh hak dilindungi.
        </div>
      </footer>
    </div>
  );
}
