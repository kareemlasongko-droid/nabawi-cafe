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
- [Deployment ke Vercel + Supabase](#deployment-ke-vercel--supabase)
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
| Penyedia database | [Supabase](https://supabase.com/) (Postgres terkelola) atau PostgreSQL mana pun |
| Penyimpanan berkas | [Supabase Storage](https://supabase.com/docs/guides/storage) via `@supabase/supabase-js` 2.118 |
| Hosting | [Vercel](https://vercel.com/) + `@vercel/functions` (manajemen koneksi DB) |
| Ikon | [lucide-react](https://lucide.dev/) |
| Linting | ESLint 9.39 + `eslint-config-next/core-web-vitals` |

Tidak ada library autentikasi pihak ketiga — session auth ditulis sendiri memakai modul `node:crypto` bawaan (lihat [Autentikasi & Keamanan](#autentikasi--keamanan)).

---

## Prasyarat

- **Node.js 22.x** — Next.js 16 butuh ≥ 20.9, tetapi `@supabase/supabase-js` mendeklarasikan ≥ 22. `package.json` sudah mengunci `"engines": { "node": "22.x" }` dan tersedia `.nvmrc`.
- **PostgreSQL** — lokal untuk development, atau project [Supabase](https://supabase.com/) (lihat [Deployment ke Vercel + Supabase](#deployment-ke-vercel--supabase))
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

Salin `.env.example` menjadi `.env.local`, lalu isi:

```bash
cp .env.example .env.local
```

Nilai minimum untuk development lokal:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db

# untuk fitur unggah gambar (boleh dikosongkan bila belum perlu)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`DATABASE_URL` **wajib** ada. Ia dibaca saat build maupun runtime — tanpa itu
`next build` gagal dengan `Error: DATABASE_URL is required` /
`Failed to collect page data for /api/auth/login` (lihat `src/db/index.ts`).

`NEXT_PUBLIC_*` juga harus ada **saat build**, karena dipakai komponen browser
di `src/components/ui.tsx`.

### 3. Buat database & skema

**Postgres lokal:**

```bash
createdb app_db            # atau lewat psql: CREATE DATABASE app_db;
npm run db:push            # membuat 6 tabel dari skema Drizzle
```

**Supabase:**

```bash
npm run db:push            # memakai DIRECT_URL (session pooler, port 5432)
```

Lalu jalankan [`supabase/setup.sql`](supabase/setup.sql) lewat SQL Editor di
dashboard untuk membuat bucket Storage dan mengunci RLS. Urutan lengkapnya ada
di bagian [Deployment ke Vercel + Supabase](#deployment-ke-vercel--supabase).

Alternatif dengan file migrasi:

```bash
npm run db:generate        # menghasilkan SQL di ./drizzle
npm run db:migrate         # menerapkan migrasi
```

> ℹ️ Konfigurasi Drizzle sekarang berada di **`drizzle.config.ts`** (bukan `.json`)
> supaya bisa membaca `DIRECT_URL` / `DATABASE_URL` dari environment — tidak ada
> lagi kredensial yang di-hardcode.

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
| `npm run db:push` | Mendorong skema langsung ke database (cepat, untuk development) |
| `npm run db:generate` | Menghasilkan file migrasi SQL ke `./drizzle` |
| `npm run db:migrate` | Menerapkan migrasi yang sudah dihasilkan |
| `npm run db:studio` | Membuka Drizzle Studio (GUI database) |

Semua perintah `db:*` memakai `DIRECT_URL` bila ada, lalu jatuh ke `DATABASE_URL`.

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
├── .env.example                 # Contoh environment variable (salin ke .env.local)
├── .nvmrc                       # Versi Node yang dipakai (22)
├── drizzle.config.ts            # Konfigurasi Drizzle Kit — baca DIRECT_URL/DATABASE_URL
├── eslint.config.mjs            # ESLint flat config
├── next.config.ts               # Konfigurasi Next.js
├── postcss.config.mjs           # PostCSS + @tailwindcss/postcss
├── tsconfig.json                # TypeScript (alias "@/*" → "./src/*")
├── vercel.json                  # Region function (sin1) + cron keepalive mingguan
├── supabase/
│   └── setup.sql                # Buat bucket Storage + kunci RLS (jalankan sekali)
└── src/
    ├── app/
    │   ├── layout.tsx           # Root layout + metadata SEO + font
    │   ├── globals.css          # Tema Tailwind (palet forest terang, kelas .btn/.input/.card)
    │   ├── (site)/              # Situs publik & pelanggan (top bar + bottom nav mobile)
    │   │   ├── page.tsx         # Beranda: hero, pencarian, kategori, kartu + sheet unit
    │   │   ├── tur/             # Tur virtual 360° publik
    │   │   ├── reservasi/       # Wizard reservasi publik (boleh tanpa login dulu)
    │   │   ├── akun/            # Hub akun pelanggan + daftar reservasi saya
    │   │   ├── masuk/           # Halaman login
    │   │   └── daftar/          # Halaman registrasi
    │   ├── dashboard/           # Area admin
    │   │   ├── reservasi/       # Semua reservasi + verifikasi (baru/ → redirect /reservasi)
    │   │   ├── unit/            # (admin) kelola unit
    │   │   ├── tur/             # (admin) kelola scene 360°
    │   │   ├── pelanggan/       # (admin) kelola pengguna
    │   │   └── profil/          # Profil saya
    │   └── api/                 # Route Handlers (REST)
    │       ├── upload/          # Menerbitkan signed upload URL (bukan penerima file)
    │       ├── media/[...path]/ # 302 ke Supabase Storage (+ cek kepemilikan bukti)
    │       └── cron/keepalive/  # Ping DB mingguan agar Supabase Free tidak pause
    ├── components/              # Komponen UI & fitur
    │   ├── PanoramaViewer.tsx   # Wrapper Photo Sphere Viewer + marker hotspot
    │   ├── TourExplorer.tsx     # Navigasi antar scene tur
    │   ├── PublicChrome.tsx     # Top bar + bottom navigation situs publik
    │   ├── HomeExplorer.tsx     # Beranda: hero, cari, kategori, kartu + sheet detail unit
    │   ├── BookingFlow.tsx      # Wizard reservasi + bayar/unggah bukti
    │   ├── AccountViews.tsx     # Layar akun pelanggan & tamu
    │   ├── DashboardShell.tsx   # Layout dashboard + sidebar (menu beda per peran)
    │   ├── ReservationManager.tsx / UnitManager.tsx / SceneManager.tsx / UserManager.tsx
    │   └── ui.tsx               # Primitif UI + ImageUpload (client-direct ke Storage)
    ├── db/
    │   ├── index.ts             # Pool pg: TLS, ukuran pool, attachDatabasePool()
    │   └── schema.ts            # Definisi tabel
    └── lib/
        ├── api.ts               # Helper route handler: ok(), fail(), apiUser(), apiAdmin()
        ├── auth.ts              # Hash password, sesi cookie, requireUser(), requireAdminPage()
        ├── constants.ts         # BRAND, BANKS, UNIT_TYPES, status, format rupiah/tanggal
        ├── data.ts              # Query baca untuk server component
        ├── queries.ts           # Query reservasi (join users/units/payments)
        ├── seed.ts              # Seeder data demo (dimatikan di production)
        └── storage.ts           # Client Supabase Storage sisi server + nama bucket
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
| `/reservasi` | Publik | Wizard reservasi: tempat → jadwal → akun (bila belum masuk) → bayar (mendukung `?unit=<id>`) |
| `/akun` | Publik/Login | Hub akun pelanggan: profil, kata sandi, menu |
| `/akun/reservasi` | Login | Reservasi saya: status, unggah bukti transfer, batalkan |
| `/dashboard` | **Admin** | Ringkasan admin (pelanggan diarahkan ke `/akun`) |
| `/dashboard/reservasi` | **Admin** | Semua reservasi + verifikasi pembayaran |
| `/dashboard/reservasi/baru` | — | Redirect ke `/reservasi` |
| `/dashboard/profil` | **Admin** | Edit profil & password admin |
| `/dashboard/unit` | **Admin** | Kelola unit |
| `/dashboard/tur` | **Admin** | Kelola scene tur 360° |
| `/dashboard/pelanggan` | **Admin** | Kelola pengguna |

Halaman yang memerlukan login memakai `requireUser()`; halaman khusus admin memakai `requireAdminPage()` yang me-*redirect* non-admin ke `/akun`.

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
| `POST` | `/api/upload` | Login | Menerbitkan *signed upload URL* (JSON: `kind`, `contentType`, `size`) — **bukan** penerima file |
| `GET` | `/api/media/[...path]` | Publik / Login | `302` ke Supabase Storage. Bucket `media` publik; bucket `proof` privat + cek kepemilikan |
| `GET` | `/api/cron/keepalive` | Vercel Cron | Ping database mingguan agar Supabase Free tidak di-pause |
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
- Nama berkas pada `/api/media/[...path]` divalidasi dengan regex `^[\w.-]+$` untuk mencegah path traversal.
- Route `/api/media/proof/*` menolak permintaan tanpa sesi (`401`) dan menolak pengguna yang bukan pemilik reservasi (`403`).
- Seeder data demo **dimatikan otomatis di production** (lihat `seedingEnabled()` di `src/lib/seed.ts`) agar akun `admin@senjarimba.id` / `admin123` tidak pernah tercipta di server publik.

---

## Media & Unggah Gambar

Unggahan memakai pola **client-direct upload** ke Supabase Storage. File tidak
pernah melewati server aplikasi — ini yang membuat batas body 4.5 MB milik Vercel
tidak berlaku dan tidak ada penulisan ke filesystem yang read-only.

**Alurnya dua langkah:**

```
 Browser                          Server aplikasi              Supabase Storage
    │                                     │                            │
    │ 1. POST /api/upload                 │                            │
    │    { kind, contentType, size }      │                            │
    │────────────────────────────────────►│                            │
    │                                     │ cek login + peran          │
    │                                     │ createSignedUploadUrl()    │
    │                                     │───────────────────────────►│
    │    { bucket, path, token, value }   │◄───────────────────────────│
    │◄────────────────────────────────────│                            │
    │                                                                  │
    │ 2. PUT berkas langsung (uploadToSignedUrl)                       │
    │─────────────────────────────────────────────────────────────────►│
    │                                                                  │
    │ 3. simpan `value` ke database, mis. /api/media/proof/1730-<hex>.jpg
```

**Dua bucket:**

| Bucket | Isi | Akses | Cara disajikan |
| --- | --- | --- | --- |
| `media` | Foto unit, panorama 360° | Publik | `302` ke `getPublicUrl()`, cache 1 tahun |
| `bukti-transfer` | Bukti transfer bank | **Privat** | Cek kepemilikan → `302` ke `createSignedUrl()` berumur 5 menit, `no-store` |

**Detail penting:**

- Yang disimpan di database adalah `/api/media/<kind>/<nama>`, bukan URL Supabase. Prefix `/api/media/` sengaja dipertahankan agar nilai lama tetap valid dan berkas privat tidak pernah bocor sebagai URL publik.
- `/api/media/proof/<nama>` memverifikasi bahwa pemanggil adalah pemilik reservasi atau admin, dengan mencocokkan `payments.proof_url` → `reservations.user_id`.
- Pelanggan hanya boleh mengunggah `kind: "proof"`. Foto unit/panorama (`kind: "media"`) khusus admin.
- Format: **JPG, PNG, WebP**. Batas sisi server default **25 MB** (`MAX_UPLOAD_MB`); bucket dibatasi **50 MB/file** sesuai kuota Supabase Free.
- Nama berkas dibuat unik: `<timestamp>-<16 hex>.<ext>`.
- `supabase-js` diimpor secara **lazy** di browser, jadi ia tidak membebani halaman awal — chunk ~63 KB gzip hanya dimuat saat pengguna menekan tombol Unggah.
- `SUPABASE_SERVICE_ROLE_KEY` bypass RLS dan hanya dipakai di server (`src/lib/storage.ts`). Jangan pernah memberinya prefix `NEXT_PUBLIC_`.

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

## Deployment ke Vercel + Supabase

Stack ini sudah disiapkan untuk Vercel (region `sin1` / Singapura) dengan Supabase
sebagai database dan penyimpanan berkas.

### Langkah 1 — Buat project Supabase

1. Buat project baru, pilih region **Southeast Asia (Singapore) / `ap-southeast-1`** agar satu region dengan function Vercel.
2. Catat **Database password**-nya.
3. Buka **Connect** dan salin dua connection string:
   - **Transaction pooler** (port `6543`) → untuk `DATABASE_URL` runtime
   - **Session pooler** (port `5432`) → untuk `DIRECT_URL` migrasi

> ⚠️ **Jangan pakai direct connection** (`db.<ref>.supabase.co:5432`) dari Vercel.
> Host itu **IPv6-only** di paket Free maupun Paid tanpa add-on berbayar, sedangkan
> Vercel function keluar lewat IPv4 — koneksi akan gagal.
>
> ⚠️ **Jangan pakai session pooler untuk runtime.** Setiap instance serverless
> menahan koneksi selama idle, sehingga slot cepat habis
> (`EMAXCONNSESSION` / `FATAL 53300`). Transaction mode-lah yang dirancang untuk serverless.

### Langkah 2 — Dorong skema & kunci keamanan

```bash
# isi DIRECT_URL di .env.local dulu, lalu:
npm run db:push
```

Kemudian jalankan [`supabase/setup.sql`](supabase/setup.sql) di **SQL Editor**
dashboard. Skrip itu:

- membuat bucket `media` (publik) dan `bukti-transfer` (privat), batas 50 MB/file,
- **menyalakan RLS** di keenam tabel — tanpa policy berarti *deny all*,
- mencabut grant `anon`/`authenticated` dan menghentikan grant otomatis untuk tabel mendatang.

Ini **tidak merusak aplikasi**: Drizzle connect sebagai role `postgres` yang
memiliki tabel, dan pemilik selalu bypass RLS. Yang ditutup hanyalah jalur Data
API (PostgREST) yang memang tidak dipakai aplikasi ini.

### Langkah 3 — Set environment variable di Vercel

Isi untuk **Production, Preview, dan Development**:

| Variabel | Nilai |
| --- | --- |
| `DATABASE_URL` | Transaction pooler, port **6543** |
| `DIRECT_URL` | Session pooler, port **5432** (dipakai `drizzle-kit`) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key — **server only** |
| `CRON_SECRET` | string acak, mis. `openssl rand -hex 32` |
| `SEED_DEMO_DATA` | **biarkan kosong** di production |

> `DATABASE_URL` dibaca **saat build**, bukan hanya saat runtime. Kalau lupa
> di-set, `next build` gagal dengan `Error: DATABASE_URL is required` sebelum
> deployment selesai. Hal yang sama berlaku untuk `NEXT_PUBLIC_*`.

### Langkah 4 — Deploy

```bash
git push   # atau impor repo lewat dashboard Vercel
```

`vercel.json` sudah mengatur region dan cron:

```json
{
  "regions": ["sin1"],
  "crons": [{ "path": "/api/cron/keepalive", "schedule": "0 3 * * 1" }]
}
```

Verifikasi region benar-benar applied dengan membaca header `x-vercel-id` pada
halaman dinamis — harus menyebut `sin1`, bukan `iad1`.

### Langkah 5 — Buat admin pertama

Seeder **tidak** jalan di production. Jadi:

1. Buka `/daftar` di situs Anda dan buat akun biasa.
2. Naikkan perannya lewat SQL Editor:

```sql
update public.users set role = 'admin' where email = 'email-anda@domain.com';
select id, name, email, role from public.users;   -- pastikan tidak ada akun demo
```

### Catatan paket Free Supabase

| Resource | Free |
| --- | --- |
| Database | 500 MB (jadi *read-only* bila lewat) |
| File storage | 1 GB, maks **50 MB/file** |
| Egress | 5 GB + 5 GB cached / bulan |
| Koneksi | ~60 direct, ~200 pooler client |
| Backup | **Tidak ada** |
| **Auto-pause** | **Setelah 7 hari tanpa aktivitas database** |

Auto-pause itu yang diatasi oleh cron `keepalive` di atas — ia menjalankan
`select 1` setiap Senin pukul 03:00 UTC. Untuk produksi sungguhan dengan backup
harian dan tanpa risiko pause, pertimbangkan paket Pro.

### Deploy di luar Vercel

Build `npm run build` lalu `npm start` di Node.js server, container, atau VPS
mana pun. Di lingkungan yang filesystem-nya bisa ditulis, unggahan tetap
mengarah ke Supabase Storage — jadi tidak ada folder `uploads/` yang perlu
disiapkan. `attachDatabasePool()` otomatis menjadi *no-op* di luar Vercel.

---

## Catatan & Keterbatasan

Beberapa hal yang perlu diketahui sebelum pengembangan lanjutan:

- **Aset gambar bawaan belum disertakan.** Data demo seeder merujuk ke `/img/*.jpg` dan `/tour/*.jpg`, tetapi folder `public/` tidak ada di repositori — gambar itu `404` sampai Anda menambahkan asetnya sendiri atau mengunggah foto lewat dashboard admin (yang kini tersimpan di Supabase Storage). Sementara foto belum ada, kartu unit di situs publik menampilkan gradien hijau sebagai pengganti.
- **Pembayaran bersifat manual** (unggah bukti transfer + verifikasi admin). Belum ada integrasi payment gateway.
- **Belum ada test suite.** Pemeriksaan yang tersedia hanya `lint` dan `typecheck`. Diketahui ada 4 error lint warisan `react-hooks/set-state-in-effect` di `ReservationManager`, `SceneManager`, `UnitManager`, dan `UserManager` (pola `useEffect(() => setItems(initial), [initial])`) yang belum dibereskan.
- **Semua route bersifat dinamis** (`force-dynamic` di mana-mana), jadi setiap pageview adalah satu invokasi function. Perlu dipantau terhadap kuota Vercel Hobby.
- **Belum ada manajemen kuota/sesi concurrent** untuk panorama; Photo Sphere Viewer + three.js cukup berat di perangkat low-end.

---

## Lisensi

Belum ada file lisensi di repositori ini. Tambahkan `LICENSE` bila proyek akan dipublikasikan atau dipakai pihak lain.
