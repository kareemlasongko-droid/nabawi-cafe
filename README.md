# Nabawi Cafe & Resto

Landing page **mobile-only** untuk Nabawi Cafe & Resto — cafe & resto berkonsep Maroko
dengan pemandangan sungai (*nature escape riverside view & play*).

Dibangun dengan **Next.js 16 (App Router) + Tailwind CSS v4 + TypeScript**.

> Desain mengikuti referensi di [`docs/reference-beranda.jpg`](docs/reference-beranda.jpg).

---

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:3000
```

Build produksi:

```bash
npm run build
npm start
```

## Alur deploy

**Produksi berjalan di Cloudflare Workers** (`npx opennextjs-cloudflare build`
→ `wrangler deploy`, lihat `wrangler.jsonc` dan `docs/PINDAH-CLOUDFLARE.md`).

> **Vercel sudah dihapus.** Proyek `nabawi-cafe` beserta seluruh deployment
> dan environment variable-nya dihapus permanen, dan
> `https://nabawi-cafe.vercel.app` **tidak lagi melayani**. Alamat lama yang
> masih tercetak di QR meja atau dokumen harus diganti ke alamat Worker.
> `vercel.json` sudah dihapus juga: berkas itu hanya berisi setelan
> auto-deploy yang sekarang tidak dibaca siapa pun.

| Tahap | Sumber | Hasil |
| --- | --- | --- |
| Development | `npm run dev` | HMR, bukan versi publik (`localhost:3000`) |
| Produksi | `wrangler deploy` / CI Cloudflare | Worker `nabawi-cafe` |

### Environment variable

Dulu dipasang di dashboard Vercel; sekarang di **Cloudflare → Worker
`nabawi-cafe` → Settings → Variables**:

| Variabel | Jenis | Tanpa ini |
| --- | --- | --- |
| `SUPABASE_URL` | biasa | tidak ada yang bisa dibaca |
| `SUPABASE_ANON_KEY` | biasa | tidak ada yang bisa dibaca |
| `SUPABASE_SERVICE_KEY` | **rahasia** | menu terbaca, **pesanan ditolak** |

Karena proyek Vercel sudah dihapus, ketiga nilai itu **tidak bisa diambil
lagi dari Vercel**. Kalau Cloudflare belum memilikinya, ambil ulang dari
dashboard Supabase.

### Database dipakai bersama

Preview dan production memakai Supabase yang sama (`SUPABASE_URL` /
`SUPABASE_ANON_KEY`), jadi perubahan skema atau isi data langsung terasa di
keduanya. Tidak ada database staging terpisah. Karena itu migrasi database
juga harus dianggap sebagai tindakan production.

## Konsep tampilan

Halaman ini **tidak responsive** — memang dirancang sebagai kanvas mobile dengan lebar
tetap **430px** yang diletakkan di tengah layar. Di desktop pun tampilannya tetap seperti
layar HP (dengan latar hijau tua di sisi kiri–kanan). Tidak ada breakpoint sama sekali.

- Ilustrasi penuh layar sebagai latar
- Kartu putih *floating* berisi identitas cafe, jam buka, dan tombol **Mulai menjelajah**
- Tombol **Mulai menjelajah** memunculkan panel sambutan: *“Selamat datang di Nabawi Cafe & Resto”*

## Struktur

```
app/
  layout.tsx            # metadata, viewport, font
  page.tsx              # kanvas mobile + latar ilustrasi + state panel sambutan
  globals.css           # tema warna (Tailwind @theme), utilitas kartu & animasi
  components/
    HeroCard.tsx        # kartu putih: judul, tagline, jam buka, tombol
    WelcomePanel.tsx    # panel sambutan (bisa ditutup: tombol, klik luar, Esc)
    icons.tsx           # logo, ikon kalender, ikon masjid, panah
public/
  images/hero-bg.jpg    # ilustrasi latar (placeholder)
docs/
  reference-beranda.jpg # gambar referensi desain
```

## Mengganti ilustrasi latar

Cukup timpa satu file:

```
public/images/hero-bg.jpg
```

Syarat supaya hasilnya rapi:

- **Rasio potret ± 9:16** (mis. 1080 × 1920 px). Foto 941 × 1672 juga sudah pas.
- **Tanpa teks, kartu, atau tombol di dalam gambar** — kartu di halaman ini elemen HTML
  asli supaya bisa diklik dan dibaca screen reader.
- Ruang atas agak lengang (tempat kartu) dan fokus bangunan di bagian bawah.

Kalau posisi fokus gambar meleset, atur *object-position* pada `app/page.tsx`:

```tsx
className="object-cover object-[50%_42%]"
```

## Mengganti warna & tipografi

Semua warna ada di blok `@theme` pada `app/globals.css`:

| Token                 | Dipakai untuk                        |
| --------------------- | ------------------------------------ |
| `--color-forest-*`    | latar halaman & hijau hutan          |
| `--color-cream-*`     | kartu, teks terang                   |
| `--color-clay-600`    | tombol utama (terracotta)            |
| `--color-mint-*`      | badge jam buka                       |
| `--color-ink-*`       | teks di atas kartu                   |

Font: **Plus Jakarta Sans** (judul & isi) dan **Space Mono** (jam buka / label kecil),
keduanya di-host lokal lewat Fontsource — tidak ada request ke Google Fonts.
