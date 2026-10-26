# Senja Rimba · Cafe & Resort

> Repositori: **`nabawi-cafe`** — aplikasi web profil usaha, **tur virtual 360°**, dan **reservasi online** untuk cafe & resort.

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8?logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-336791?logo=postgresql&logoColor=white)
![Bahasa](https://img.shields.io/badge/Bahasa-Indonesia-ff0000)

Aplikasi full-stack berbasis **Next.js App Router** yang menggabungkan tiga hal dalam satu tempat: situs profil usaha, tur panorama 360° antar-ruangan yang bisa diklik (hotspot), dan sistem reservasi kamar / villa / meja cafe / aula lengkap dengan unggah bukti transfer dan verifikasi manual oleh admin.

Semua teks antarmuka, format tanggal, dan mata uang sudah dilokalkan ke **Bahasa Indonesia / WIB**.

---

## Daftar Isi

- [Fitur](#fitur)
- [Tech Stack](#tech-stack)
- [Prasyarat](#prasyarat)
- [Menjalankan Proyek](#menjalankan-proyek)
- [Skrip npm](#skrip-npm)
- [Database](#database)
- [Seed Data Otomatis & Akun Demo](#seed-data-otomatis--akun-demo)
- [Struktur Proyek](#struktur-proyek)
- [Rute Halaman](#rute-halaman)
- [API Endpoints](#api-endpoints)
- [Alur Reservasi & Status](#alur-reservasi--status)
- [Autentikasi & Keamanan](#autentikasi--keamanan)
- [Media & Unggah Gambar](#media--unggah-gambar)
- [Kustomisasi Brand](#kustomisasi-brand)
- [Deployment](#deployment)
- [Catatan & Keterbatasan](#catatan--keterbatasan)

---

## Fitur

### Situs publik
- **Landing page** dengan hero, daftar unit unggulan, penjelasan cara reservasi, dan footer kontak.
- **Tur Virtual 360°** (`/tur`) — panorama equirectangular yang bisa diseret, di-zoom (scroll / cubit), dan dilengkapi **hotspot bulat** untuk berpindah antar-ruangan. Setiap scene dapat ditautkan ke unit tertentu sehingga pengunjung bisa langsung "masuk" ke kamar/villa lalu memesan dari dalam tur.
- **Registrasi & login** pelanggan tanpa perlu approval admin.

### Dashboard pelanggan
- Ringkasan akun dan jumlah reservasi yang menunggu pembayaran.
- **Reservasi baru** dengan pilihan unit, tanggal check-in/check-out (atau jam kedatangan untuk meja cafe), jumlah unit, dan jumlah tamu — harga dihitung otomatis sesuai tipe unit (per malam / per reservasi / per hari).
- **Riwayat reservasi** beserta kode booking (format `SR-xxxxxx`) dan statusnya.
- **Unggah bukti pembayaran** (transfer BCA / Mandiri / BRI) untuk reservasi berstatus *menunggu pembayaran*.
- **Batalkan reservasi** selama statusnya masih `menunggu_pembayaran` atau `menunggu_konfirmasi`.
- Edit profil (nama, email, telepon, password).

### Dashboard admin
- **Ringkasan** operasional dan daftar pembayaran yang menunggu verifikasi.
- **Manajemen reservasi** semua pelanggan: konfirmasi, tolak reservasi, tolak pembayaran (dikembalikan ke `menunggu_pembayaran`), tandai selesai, batalkan, dan tambahkan catatan internal.
- **Manajemen unit** (kamar / villa / meja / aula): harga, kapasitas, jumlah unit tersedia, fasilitas, foto, tautan ke scene tur, dan status aktif.
- **Manajemen tur 360°**: tambah/edit scene panorama, kategori, urutan tampil, status publish, serta penempatan hotspot (yaw & pitch bisa diambil dengan mengklik langsung pada panorama).
- **Manajemen pengguna**: lihat, ubah peran, reset password, dan hapus akun.

---

## Tech Stack

| Kategori | Teknologi |
| --- | --- |
| Framework | [Next.js](https://nextjs.org/) 16.2.6 (App Router, Server Components, Route Handlers) |
| UI | [React](https://react.dev/) 19.2.6, [Tailwind CSS](https://tailwindcss.com/) 4.1.17 (`@tailwindcss/postcss`) |
| Bahasa | [TypeScript](https://www.typescriptlang.org/) 5.9.3 (mode `strict`) |
| Panorama 360° | [Photo Sphere Viewer](https://photo-sphere-viewer.js.org/) 5.15.1 + Markers Plugin, [three.js](https://threejs.org/) 0.186 |
| Database | PostgreSQL via [node-postgres](https://node-postgres.com/) (`pg` 8.20) |
| ORM & migrasi | [Drizzle ORM](https://orm.drizzle.team/) 0.45.2 + [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview) 0.31.10 |
| Ikon | [lucide-react](https://lucide.dev/) |
| Linting | ESLint 9.39 + `eslint-config-next/core-web-vitals` |

Tidak ada library autentikasi pihak ketiga — session auth ditulis sendiri memakai modul `node:crypto` bawaan (lihat [Autentikasi & Keamanan](#autentikasi--keamanan)).

---

## Prasyarat

- **Node.js ≥ 20.9** (disarankan 20 LTS atau 22 LTS)
- **PostgreSQL ≥ 13** yang berjalan dan dapat diakses
- npm (atau pnpm/yarn — sesuaikan perintahnya)

---

## Menjalankan Proyek

### 1. Instal dependensi

```bash
git clone https://github.com/kareemlasongko-droid/nabawi-cafe.git
cd nabawi-cafe
npm install
```

### 2. Siapkan environment variable

Buat file `.env.local` di root proyek:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

`DATABASE_URL` **wajib** ada — tanpa itu aplikasi langsung gagal saat dijalankan dengan pesan `DATABASE_URL is required` (lihat `src/db/index.ts`).

### 3. Buat database & skema

```bash
# buat database kosong (sekali saja)
createdb app_db            # atau lewat psql: CREATE DATABASE app_db;

# buat tabel dari skema Drizzle
npx drizzle-kit push       # cara cepat untuk development
```

Alternatif dengan file migrasi:

```bash
npx drizzle-kit generate   # menghasilkan SQL di ./drizzle
npx drizzle-kit migrate    # menerapkan migrasi
```

> ⚠️ **Perhatikan:** `drizzle.config.json` menyimpan URL database secara *hardcode*
> (`postgresql://postgres:postgres@127.0.0.1:5432/app_db`), sedangkan aplikasi membaca
> `DATABASE_URL`. Jika kredensial Anda berbeda, ubah **keduanya** agar konsisten.

### 4. Jalankan dev server

```bash
npm run dev
```

Buka <http://localhost:3000>. Pada permintaan pertama yang menyentuh database (`/`, `/tur`, `/dashboard`, atau `/api/health`), aplikasi otomatis menjalankan seeder dan mengisi data demo — tidak perlu perintah seed manual.

### 5. Build produksi

```bash
npm run build
npm start
```

---

## Skrip npm

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan dev server Next.js |
| `npm run build` | Build produksi |
| `npm start` | Menjalankan hasil build produksi |
| `npm run lint` | Menjalankan ESLint di seluruh proyek |
| `npm run typecheck` | Memeriksa tipe TypeScript tanpa emit (`tsc --noEmit`) |

---

## Database

Skema didefinisikan di [`src/db/schema.ts`](src/db/schema.ts) dengan Drizzle ORM.

| Tabel | Isi | Relasi penting |
| --- | --- | --- |
| `users` | Akun pengguna: nama, email (unik), hash password, telepon, `role` (`admin` \| `customer`) | — |
| `sessions` | Token sesi (disimpan sebagai SHA-256) + `expires_at` | `user_id` → `users.id` (`ON DELETE CASCADE`) |
| `tour_scenes` | Scene panorama 360°: judul, deskripsi, kategori, `image_url`, `sort_order`, `is_published`, dan `hotspots` (JSONB) | — |
| `units` | Unit yang bisa dipesan: tipe (`kamar` \| `villa` \| `meja` \| `aula`), harga, kapasitas, jumlah tersedia, fasilitas (JSONB), `is_active` | `scene_id` → `tour_scenes.id` (`ON DELETE SET NULL`) |
| `reservations` | Reservasi: kode unik, tanggal check-in/out, jam kedatangan, jumlah tamu & unit, total harga, status, catatan pelanggan & catatan admin | `user_id` → `users.id` (CASCADE), `unit_id` → `units.id` (RESTRICT) |
| `payments` | Bukti pembayaran: bank, nama pengirim, nominal, tanggal bayar, `proof_url`, status (`menunggu` \| `diterima` \| `ditolak`) | `reservation_id` → `reservations.id` (CASCADE) |

Field JSONB `tour_scenes.hotspots` bertipe:

```ts
type Hotspot = {
  targetId: number; // id scene tujuan
  label: string;    // teks pada tombol
  yaw: number;      // derajat horizontal
  pitch: number;    // derajat vertikal
};
```

Index tambahan dibuat pada `reservations(user_id)`, `reservations(unit_id)`, dan `payments(reservation_id)` untuk mempercepat query dashboard.

---

## Seed Data Otomatis & Akun Demo

Seeder berada di [`src/lib/seed.ts`](src/lib/seed.ts) dan dipanggil lewat `ensureSeed()`. Ia:

- memakai `pg_advisory_xact_lock(424242)` agar aman terhadap request paralel,
- **hanya mengisi data bila tabel `users` masih kosong**, sehingga tidak pernah menimpa data produksi,
- mengisi: **5 pengguna**, **5 scene tur 360°** (sudah saling terhubung lewat hotspot), **7 unit**, dan **12 reservasi** contoh dengan berbagai status beserta pembayaran terkait.

### Akun demo

| Peran | Email | Password |
| --- | --- | --- |
| **Admin** | `admin@senjarimba.id` | `admin123` |
| Pelanggan | `budi@contoh.id` | `demo123` |
| Pelanggan | `sari@contoh.id` | `demo123` |
| Pelanggan | `rizky@contoh.id` | `demo123` |
| Pelanggan | `dewi@contoh.id` | `demo123` |

> 🔒 Ganti atau hapus akun-akun ini sebelum dipakai di lingkungan produksi.

---

## Struktur Proyek

```
nabawi-cafe/
├── drizzle.config.json          # Konfigurasi Drizzle Kit (dialect: postgresql)
├── eslint.config.mjs            # ESLint flat config
├── next.config.ts               # Konfigurasi Next.js
├── postcss.config.mjs           # PostCSS + @tailwindcss/postcss
├── tsconfig.json                # TypeScript (alias "@/*" → "./src/*")
└── src/
    ├── app/
    │   ├── layout.tsx           # Root layout + metadata SEO
    │   ├── page.tsx             # Landing page
    │   ├── globals.css          # Tema Tailwind (warna forest & gold)
    │   ├── masuk/               # Halaman login
    │   ├── daftar/              # Halaman registrasi
    │   ├── tur/                 # Tur virtual 360° publik
    │   ├── dashboard/           # Area terproteksi (pelanggan & admin)
    │   │   ├── reservasi/       # Daftar + form reservasi baru
    │   │   ├── unit/            # (admin) kelola unit
    │   │   ├── tur/             # (admin) kelola scene 360°
    │   │   ├── pelanggan/       # (admin) kelola pengguna
    │   │   └── profil/          # Profil saya
    │   └── api/                 # Route Handlers (REST)
    ├── components/              # Komponen UI & fitur
    │   ├── PanoramaViewer.tsx   # Wrapper Photo Sphere Viewer + marker hotspot
    │   ├── TourExplorer.tsx     # Navigasi antar scene tur
    │   ├── DashboardShell.tsx   # Layout dashboard + sidebar (menu beda per peran)
    │   ├── ReservationManager.tsx / UnitManager.tsx / SceneManager.tsx / UserManager.tsx
    │   └── ui.tsx               # Primitif UI (Button, Modal, Toast, Spinner, dll.)
    ├── db/
    │   ├── index.ts             # Pool pg + instance drizzle (singleton saat dev)
    │   └── schema.ts            # Definisi tabel
    └── lib/
        ├── api.ts               # Helper route handler: ok(), fail(), apiUser(), apiAdmin()
        ├── auth.ts              # Hash password, sesi cookie, requireUser(), requireAdminPage()
        ├── constants.ts         # BRAND, BANKS, UNIT_TYPES, status, format rupiah/tanggal
        ├── data.ts              # Query baca untuk server component
        ├── queries.ts           # Query reservasi (join users/units/payments)
        └── seed.ts              # Seeder data demo
```

Alias impor `@/*` memetakan ke `./src/*`.

---

## Rute Halaman

| Rute | Akses | Keterangan |
| --- | --- | --- |
| `/` | Publik | Landing page: hero, unit unggulan, cara reservasi, kontak |
| `/tur` | Publik | Tur virtual 360° (mendukung `?scene=<id>`) |
| `/masuk` | Publik | Login (mendukung `?next=<path>` untuk redirect setelah masuk) |
| `/daftar` | Publik | Registrasi akun pelanggan |
| `/dashboard` | Login | Ringkasan |
| `/dashboard/reservasi` | Login | Reservasi saya (pelanggan) / semua reservasi (admin) |
| `/dashboard/reservasi/baru` | Login | Form reservasi baru (mendukung `?unit=<id>`) |
| `/dashboard/profil` | Login | Edit profil & password |
| `/dashboard/unit` | **Admin** | Kelola unit |
| `/dashboard/tur` | **Admin** | Kelola scene tur 360° |
| `/dashboard/pelanggan` | **Admin** | Kelola pengguna |

Halaman yang memerlukan login memakai `requireUser()`; halaman khusus admin memakai `requireAdminPage()` yang me-*redirect* non-admin ke `/dashboard`.

---

## API Endpoints

Semua endpoint mengembalikan JSON. Kesalahan memakai bentuk `{ "error": "pesan" }` dengan status HTTP yang sesuai (`400`, `401`, `403`, `404`, `409`).

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Publik | Cek koneksi DB (sekaligus memicu seed) |
| `POST` | `/api/auth/register` | Publik | Daftar akun baru |
| `POST` | `/api/auth/login` | Publik | Login & membuat sesi |
| `POST` | `/api/auth/logout` | Login | Mengakhiri sesi |
| `PATCH` | `/api/profile` | Login | Ubah data profil / password |
| `POST` | `/api/upload` | Login | Unggah gambar (JPG/PNG/WebP, maks. 12 MB) |
| `GET` | `/api/media/[name]` | Publik | Menyajikan file dari folder `uploads/` |
| `POST` | `/api/scenes` | **Admin** | Buat scene tur 360° |
| `PATCH` | `/api/scenes/[id]` | **Admin** | Ubah scene / hotspot |
| `DELETE` | `/api/scenes/[id]` | **Admin** | Hapus scene |
| `POST` | `/api/units` | **Admin** | Buat unit |
| `PATCH` | `/api/units/[id]` | **Admin** | Ubah unit |
| `DELETE` | `/api/units/[id]` | **Admin** | Hapus unit |
| `POST` | `/api/users` | **Admin** | Buat pengguna |
| `PATCH` | `/api/users/[id]` | **Admin** | Ubah pengguna / peran / password |
| `DELETE` | `/api/users/[id]` | **Admin** | Hapus pengguna |
| `POST` | `/api/reservations` | Login | Buat reservasi (cek ketersediaan per hari) |
| `PATCH` | `/api/reservations/[id]` | Login/Admin | Aksi berbasis `action`: `confirm`, `reject`, `reject_payment`, `complete`, `cancel`, `note` |
| `DELETE` | `/api/reservations/[id]` | Login/Admin | Hapus reservasi |
| `POST` | `/api/reservations/[id]/payment` | Login | Unggah bukti pembayaran |

> **Catatan desain:** endpoint `GET` untuk daftar data sengaja tidak dibuat. Semua data daftar dibaca langsung di **Server Component** melalui `src/lib/data.ts` dan `src/lib/queries.ts`, lalu diteruskan ke komponen client — sehingga lebih sedikit round-trip dan tidak perlu caching manual. Route handler hanya dipakai untuk mutasi.

---

## Alur Reservasi & Status

Definisi status ada di `RESERVATION_STATUS` ([`src/lib/constants.ts`](src/lib/constants.ts)).

```
                    ┌──────────────────────────┐
 pelanggan memesan  │   menunggu_pembayaran    │  ← admin: reject_payment
 ──────────────────►│  (Menunggu Pembayaran)   │     (bukti tidak sesuai)
                    └────────────┬─────────────┘
              unggah bukti bayar │        │ admin: confirm (tanpa bukti)
                                 ▼        │  → dicatat sebagai pembayaran "Manual"
                    ┌──────────────────────────┐
                    │   menunggu_konfirmasi    │
                    │  (Menunggu Konfirmasi)   │
                    └────────────┬─────────────┘
        admin: confirm ┌────────┴────────┐ admin: reject
                       ▼                 ▼
          ┌───────────────────┐   ┌──────────────┐
          │    dikonfirmasi   │   │   ditolak    │
          └─────────┬─────────┘   └──────────────┘
       admin: complete │
                       ▼
             ┌───────────────┐
             │    selesai    │
             └───────────────┘

  dibatalkan ← dapat diset oleh pelanggan (dari menunggu_pembayaran /
               menunggu_konfirmasi) atau admin (termasuk dari dikonfirmasi)
```

Aturan penting saat membuat reservasi:

- Tanggal tidak boleh di masa lalu (dihitung dalam **WIB**).
- Unit bertipe `kamar`/`villa` bersifat *multi-night* → `check-out` wajib setelah `check-in`, total = `harga × jumlah malam × qty`.
- Unit bertipe `meja`/`aula` bersifat satu hari → `check-out` = `check-in`, dan tipe `meja` **wajib** mengisi jam kedatangan (`HH:MM`).
- Ketersediaan dicek **per hari** terhadap `quantity` unit, hanya menghitung reservasi berstatus aktif. Bila bentrok, API membalas `409` dengan tanggal yang bermasalah.
- Jumlah tamu dibatasi `capacity × qty`.
- Kode booking dibuat acak dengan format `SR-` + 6 digit, dan dicoba ulang hingga 5 kali bila terjadi tabrakan unik.

---

## Autentikasi & Keamanan

Implementasi ada di [`src/lib/auth.ts`](src/lib/auth.ts).

- **Hash password:** `scrypt` dengan salt acak 16 byte, disimpan sebagai `salt:hash`. Verifikasi memakai `timingSafeEqual` untuk mencegah timing attack.
- **Sesi:** token acak 32 byte dikirim ke browser sebagai cookie `sr_session` (`httpOnly`, `sameSite=lax`, masa berlaku **14 hari**). Yang disimpan di database hanyalah **SHA-256** dari token, jadi kebocoran tabel `sessions` tidak membocorkan cookie yang valid.
- **Otorisasi:** `getCurrentUser()` di-*cache* per-request lewat `react.cache`. `requireUser()` dan `requireAdminPage()` melindungi halaman; `apiUser()` dan `apiAdmin()` melindungi route handler (mengembalikan `401` / `403`).
- **Kepemilikan data:** pelanggan hanya bisa mengubah/melihat reservasinya sendiri; aksi administratif ditolak dengan `403`.
- Semua route handler dinamis (`export const dynamic = "force-dynamic"`) agar tidak ter-cache.
- Nama file pada `/api/media/[name]` divalidasi dengan regex `^[\w-]+\.(jpg|png|webp)$` untuk mencegah path traversal.

---

## Media & Unggah Gambar

- File diunggah lewat `POST /api/upload` (multipart, field `file`) ke folder **`uploads/`** di root proyek.
- Format diterima: **JPG, PNG, WebP**. Batas ukuran: **12 MB**.
- Nama file dibuat unik: `<timestamp>-<12 hex>.<ext>`.
- File disajikan lewat `GET /api/media/<nama>` dengan header `Cache-Control: public, max-age=31536000, immutable`.
- Folder `uploads/` dibuat otomatis saat unggahan pertama dan **tidak** disimpan di Git — siapkan volume/penyimpanan persisten bila deploy di platform serverless atau container.

---

## Kustomisasi Brand

Identitas usaha dipusatkan di satu tempat agar mudah diganti:

```ts
// src/lib/constants.ts
export const BRAND = {
  name: "Senja Rimba",
  tagline: "Cafe & Resort",
  address: "Jl. Raya Lembang KM 7, Lembang, Kabupaten Bandung Barat, Jawa Barat",
  phone: "0812-3456-7890",
  whatsapp: "6281234567890",
  email: "halo@senjarimba.id",
};

export const BANKS = [ /* daftar rekening tujuan transfer */ ];
export const UNIT_TYPES = [ /* kamar | villa | meja | aula */ ];
export const SCENE_CATEGORIES = [ /* Cafe | Resort | Kamar | Kolam | Taman | Lainnya */ ];
```

Selain itu ubah juga:

- `src/app/layout.tsx` → `metadata.title` / `description` dan `viewport.themeColor`
- `src/app/globals.css` → palet warna `--color-forest-*` dan `--color-gold-*`
- `src/lib/seed.ts` → data demo & prefix kode booking (`SR-`)

---

## Deployment

1. Build dengan `npm run build` lalu jalankan `npm start` (Node.js server biasa, container, atau VPS).
2. Set `DATABASE_URL` ke PostgreSQL produksi (idealnya lewat connection pooling seperti PgBouncer / Supabase pooler).
3. Terapkan skema: `npx drizzle-kit migrate` (atau `push`).
4. **Jangan** bergantung pada seeder di produksi — ia hanya berjalan saat tabel `users` kosong. Buat akun admin pertama lewat registrasi lalu naikkan perannya di database, atau tulis skrip tersendiri.
5. Siapkan penyimpanan persisten untuk folder `uploads/`, atau ganti `src/app/api/upload/route.ts` dan `src/app/api/media/[name]/route.ts` agar memakai object storage (S3/R2/Supabase Storage).

---

## Catatan & Keterbatasan

Beberapa hal yang perlu diketahui sebelum pengembangan lanjutan:

- **Aset gambar belum disertakan.** Seeder dan landing page merujuk ke `/img/*.jpg` dan `/tour/*.jpg`, tetapi folder `public/` tidak ada di repositori — gambar tersebut akan `404` sampai Anda menambahkan asetnya sendiri atau mengunggah foto lewat dashboard admin.
- **Belum ada `.gitignore`.** Sebaiknya tambahkan agar `node_modules/`, `.next/`, `.env.local`, dan `uploads/` tidak ikut ter-commit.
- **Pembayaran bersifat manual** (unggah bukti transfer + verifikasi admin). Belum ada integrasi payment gateway.
- **Belum ada test suite** — pemeriksaan yang tersedia saat ini hanya `lint` dan `typecheck`.
- **Belum ada manajemen kuota/sesi concurrent** untuk panorama; Photo Sphere Viewer + three.js cukup berat di perangkat low-end.

---

## Lisensi

Belum ada file lisensi di repositori ini. Tambahkan `LICENSE` bila proyek akan dipublikasikan atau dipakai pihak lain.
