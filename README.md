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

**Production hanya naik kalau dipromosikan manual.** Merge ke `main` tidak
lagi menerbitkan production secara otomatis.

| Tahap | Sumber | Hasil | Domain |
| --- | --- | --- | --- |
| Development | `npm run dev` | HMR, bukan versi publik | `localhost:3000` |
| Preview | setiap push ke branch PR | Deployment Preview | URL preview per-commit |
| Production | **promosikan manual** di dashboard Vercel | Deployment Production | `https://nabawi-cafe.vercel.app` |

### Yang mengunci production

`vercel.json`:

```json
{ "git": { "deploymentEnabled": { "main": false } } }
```

 Push ke `main` — termasuk merge pull request — **tidak** membuat deployment
production. Preview per-branch tetap dibuat, jadi cek Vercel pada PR masih ada
dan perubahan tetap bisa diperiksa sebelum dipromosikan.

### Cara naik ke production

1. Buka Vercel → project `nabawi-cafe` → tab **Deployments**.
2. Pilih deployment preview yang sudah diperiksa.
3. Menu **⋯ → Promote to Production**.

Cara ini juga berarti production bisa **di-rollback** kapan saja dengan
memilih deployment lama dan mempromosikannya kembali.

### Kenapa bukan lewat git

Repository ini tidak punya jalur deploy lain: tidak ada `npm run deploy`,
tidak ada kredensial Vercel di lingkungan pengembangan, dan integrasi Git
Vercel-lah satu-satunya yang terhubung ke akun. Mematikan auto-deploy di
`vercel.json` berarti satu-satunya cara menaikkan production adalah tindakan
manual yang disengaja di dashboard.

**Catatan:** kalau di dashboard Vercel ada setelan yang berlawanan (mis.
"Production Branch" atau opsi auto-deploy yang dipaksa hidup), setelan
dashboard menang atas `vercel.json`. Periksa sekali di
**Settings → Git → Ignored Build Step / Production Branch** setelah perubahan
ini masuk.

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
