# Panduan Deploy: Supabase → Vercel

Panduan langkah demi langkah untuk men-deploy aplikasi **Senja Rimba** (repo `nabawi-cafe`).

Ada dua jalur:

- **BAGIAN 1 — Jalur Mudah (disarankan):** Supabase dibuat dari dalam Vercel
  (integrasi Vercel Marketplace). Semua environment variable tersinkron otomatis —
  tidak ada salin-tempel kredensial.
- **BAGIAN 2 — Jalur Manual:** project Supabase dibuat sendiri di supabase.com,
  nilai-nilainya dimasukkan manual. Dipakai bila Anda ingin kontrol penuh.

```
GitHub (kode) ──push──► Vercel (region sin1 / Singapura) ──► Supabase (Singapura / ap-southeast-1)
                              │                                      │
                              └─ /api/cron/keepalive (tiap Senin) ───┘  (anti-pause paket Free)
```

---

## BAGIAN 1 — Jalur Mudah (Vercel Marketplace)

**Estimasi waktu:** 15–25 menit. **Persiapan:** akun GitHub pemilik repo ini, akun Vercel
(daftar dengan **Continue with GitHub**), dan di komputer Anda: Node.js **22.x** + Git,
repo sudah di-clone, `npm install` sudah dijalankan.

### Langkah 1 — Import repo ke Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → **Import** repo `nabawi-cafe`
2. Pengaturan biarkan default (Framework *Next.js*, Root Directory `./`) — **jangan isi
   env var dulu**, langsung **Deploy**
3. ⚠️ **Build pertama akan GAGAL** dengan error `DATABASE_URL is required`. Ini **normal**
   dan memang diharapkan — database-nya belum dibuat. Abaikan dulu, lanjut ke Langkah 2.

### Langkah 2 — Buat Supabase dari dalam Vercel

1. Di halaman project Vercel Anda → tab **Storage** → **Create Database** → pilih **Supabase**
2. Ikuti alurnya (login/otorisasi Supabase bila diminta), lalu pilih:
   - **Region: Southeast Asia (Singapore)** — tidak bisa diubah nanti, dan harus sama
     dengan region Vercel (`sin1`) yang sudah dikunci di `vercel.json`
   - **Plan: Free**
3. Hubungkan database tersebut ke project ini untuk **Production, Preview, dan Development**

Setelah terhubung, Vercel otomatis mengisi environment variable seperti `POSTGRES_URL`,
`POSTGRES_URL_NON_POOLING`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, dan
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Kode aplikasi sudah menerima nama-nama tersebut
sebagai fallback dari `DATABASE_URL` dkk. — jadi tidak ada yang perlu Anda salin manual.

> Project Supabase manual yang mungkin sudah terlanjur Anda buat sebelumnya bisa dihapus
> (dashboard Supabase → Settings → General → Delete project) agar kuota Free (maks. 2 project)
> tidak penuh.

### Langkah 3 — Tambahkan satu-satunya env var manual: `CRON_SECRET`

1. Buat string acak di terminal komputer Anda:

```bash
openssl rand -hex 32                                            # macOS / Linux / Git Bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # semua OS
```

2. Vercel → project Anda → **Settings → Environment Variables** → tambahkan `CRON_SECRET`
   dengan nilai hasil generate tersebut (centang Production + Preview + Development).
   Ini dipakai cron mingguan yang mencegah project Supabase Free di-pause.
   `SEED_DEMO_DATA` **jangan diisi**.

### Langkah 4 — Tabel + bucket dibuat otomatis saat deploy

Tidak ada yang perlu dijalankan manual: `scripts/setup.mjs` berjalan otomatis
di awal setiap build Vercel (lewat `buildCommand` di `vercel.json`), membuat
**6 tabel**, **2 bucket Storage** (`media` publik, `bukti-transfer` privat),
dan mengunci **RLS**, lalu mencetak hasil verifikasi (`RLS aktif : 6/6`) di
log build. Aman dijalankan berulang di setiap deploy (idempotent) — migrasi
dilewati bila tabel sudah ada, dan skrip mencoba beberapa kandidat koneksi
(termasuk menurunkan varian session-pooler dari `POSTGRES_URL`) sampai ada
yang berhasil connect.

Alternatif manual (mis. menyiapkan database sebelum deploy pertama, atau
untuk database lokal) tetap tersedia dari komputer Anda:

```bash
npx vercel login            # sekali saja, membuka browser
npx vercel link             # pilih project nabawi-cafe Anda
npx vercel env pull .env.local
npm run setup
```

### Langkah 5 — Redeploy

Vercel → **Deployments** → deployment terakhir → **⋯ → Redeploy**.
Kali ini build harus **berhasil**: env var sudah lengkap dan tabel dibuat
otomatis di awal build.

### Langkah 6 — Verifikasi & admin pertama

1. Buka `https://<url-anda>.vercel.app/api/health` → harus membalas sukses (bukan 500).
   Ini bukti Vercel ↔ Supabase benar-benar terhubung.
2. (Opsional) Cek region: `curl -sI https://<url-anda>.vercel.app/dashboard | grep -i x-vercel-id`
   → harus menyebut `sin1`, bukan `iad1`.
3. Daftar akun biasa di `/daftar` pada situs Anda, lalu naikkan jadi admin lewat
   **SQL Editor** Supabase:

```sql
update public.users set role = 'admin' where email = 'email-anda@domain.com';
select id, name, email, role from public.users order by id;  -- pastikan tidak ada akun demo
```

4. Login sebagai admin → tambah 1 unit + unggah 1 foto (menguji Storage), tambah
   1 scene panorama 360° (pastikan tidak hitam).
5. Uji alur pelanggan dengan akun kedua: reservasi → unggah bukti transfer →
   admin harus bisa membuka buktinya.

> Situs produksi memang **mulai dari kosong** (data demo dimatikan di production) —
> isi unit dan scene tur lewat dashboard admin.

✅ **Selesai.** Bagian 2 di bawah hanya diperlukan bila Anda memilih jalur manual.

---

## BAGIAN 2 — Jalur Manual (alternatif)

### M1. Buat project di supabase.com

[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**: nama bebas,
**Database Password** di-generate lalu segera disimpan (tidak bisa dilihat lagi;
huruf+angka saja agar tidak perlu URL-encode), region **Southeast Asia (Singapore)**,
plan Free. Tunggu ±1–2 menit.

### M2. Catat 5 nilai

| Nilai | Lokasi di dashboard | Jadi env var |
|---|---|---|
| Project URL | Settings → API Keys / General | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (`sb_publishable_…`) | Settings → **API Keys** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Secret key (`sb_secret_…`) | Settings → **API Keys** | `SUPABASE_SERVICE_ROLE_KEY` |
| **Transaction pooler** (port `6543`) | Tombol **Connect** | `DATABASE_URL` |
| **Session pooler** (port `5432`) | Tombol **Connect** | `DIRECT_URL` |

Ganti `[YOUR-PASSWORD]` pada kedua connection string. **Jangan** pakai *Direct connection*
(`db.<ref>.supabase.co`) — IPv6-only, tidak terjangkau dari Vercel.

### M3. Isi `.env.local`, lalu setup

```bash
cp .env.example .env.local   # Windows: copy / Copy-Item
cp .env.local .env           # agar drizzle-kit ikut membaca (keduanya gitignored)
npm run setup                # memakai DIRECT_URL; verifikasi harus 6/6 + 2 bucket
```

Isi 6 baris seperti contoh terisi di `.env.example` (ditambah `CRON_SECRET` acak).

### M4. Import ke Vercel + env var manual

Import repo seperti Langkah 1 pada Bagian 1, lalu di **Environment Variables** tambahkan
**6 variabel yang sama persis** dengan `.env.local` Anda (Production + Preview + Development)
**sebelum** klik Deploy, karena `DATABASE_URL` dan `NEXT_PUBLIC_*` dibaca saat build.
Lanjutkan dengan **Langkah 6** pada Bagian 1.

> 🔒 Jangan pernah mengirim database password, secret/service_role key, atau `CRON_SECRET`
> ke chat, issue, atau commit Git.

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Build pertama (saat import) gagal `DATABASE_URL is required` | Database belum dibuat — **normal** di jalur mudah | Selesaikan Langkah 2–4, lalu Redeploy |
| `npm run setup`: "Connection string tidak ditemukan" | `vercel env pull` belum dijalankan / `.env.local` kosong | Jalankan Langkah 4 dari awal; pastikan resource Storage terhubung termasuk environment **Development** |
| `npm run setup` gagal koneksi / *password authentication failed* | Password salah, atau karakter khusus belum di-encode | URL-encode mis. `@` → `%40`; pastikan memakai port `5432` |
| Build Vercel gagal `DATABASE_URL is required` (jalur manual) | Env var belum diset sebelum build | Settings → Environment Variables → isi → Redeploy |
| Halaman error 500 setelah deploy | Tabel belum ada, atau `DATABASE_URL` salah port | Jalankan `npm run setup`; runtime harus port **6543** |
| Tombol unggah gagal | `NEXT_PUBLIC_*` belum ada saat build, atau bucket belum dibuat | Pastikan integrasi/env lengkap lalu **Redeploy**; jalankan `npm run setup` |
| Panorama 360° tampil hitam | Kemungkinan CORS pada URL storage | Laporkan — ada fallback yang bisa diterapkan |
| Situs mati setelah seminggu sepi | Project Free di-pause Supabase | Klik **Resume** di dashboard Supabase; cron keepalive mencegahnya jika `CRON_SECRET` sudah diset |
| *Deployment Blocked — commit author* | Restriksi kolaborasi Vercel Hobby | Pastikan login Vercel memakai akun GitHub yang sama; repo ini publik sehingga normalnya tidak terjadi |

---

## Ringkasan arsitektur (referensi)

- **Nama env ganda:** aplikasi menerima nama manual (`DATABASE_URL`, `DIRECT_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) maupun nama bawaan
  integrasi Vercel Marketplace (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`,
  `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) sebagai fallback —
  lihat `src/db/index.ts`, `src/lib/storage.ts`, `drizzle.config.ts`.
- **Runtime DB** selalu lewat transaction pooler `6543` (aman untuk serverless);
  **migrasi/setup** lewat koneksi non-pooling `5432`. Skema dibuat dari file migrasi
  di folder `drizzle/` oleh `npm run setup` (`scripts/setup.mjs`), yang juga
  menjalankan `supabase/setup.sql`.
- Unggahan bersifat *client-direct*: browser mengunggah langsung ke Supabase Storage
  dengan signed URL — file tidak melewati function Vercel (bebas batas 4.5 MB).
  Nilai di DB berbentuk `/api/media/<kind>/<nama>`; bukti transfer disajikan lewat
  cek kepemilikan + signed URL 5 menit.
- Aplikasi connect sebagai role `postgres` (owner tabel) sehingga RLS dari `setup.sql`
  tidak mengganggu aplikasi — yang ditutup hanya akses Data API publik.
