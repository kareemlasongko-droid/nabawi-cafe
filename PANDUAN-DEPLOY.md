# Panduan Deploy: Supabase → Vercel

Panduan langkah demi langkah untuk men-deploy aplikasi **Senja Rimba** (repo `nabawi-cafe`).
Ikuti **sesuai urutan** — jangan dibalik, karena Vercel membutuhkan `DATABASE_URL` saat build
dan situs membutuhkan tabel yang sudah dibuat saat pertama kali dibuka.

```
GitHub (kode) ──push──► Vercel (region sin1 / Singapura) ──► Supabase (Singapura / ap-southeast-1)
                              │                                      │
                              └─ /api/cron/keepalive (tiap Senin) ───┘  (anti-pause paket Free)
```

**Estimasi waktu:** 30–45 menit.

---

## Persiapan (sekali saja)

- [ ] Akun **GitHub** yang memiliki repo ini (`kareemlasongko-droid/nabawi-cafe`)
- [ ] Akun **Supabase** — [supabase.com](https://supabase.com), daftar gratis
- [ ] Akun **Vercel** — [vercel.com](https://vercel.com), daftar dengan tombol **Continue with GitHub**
- [ ] Di komputer Anda: **Node.js 22.x** dan **Git** terpasang (`node -v` harus menampilkan `v22.x`)
- [ ] Repo sudah di-clone dan dependensi terpasang:

```bash
git clone https://github.com/kareemlasongko-droid/nabawi-cafe.git
cd nabawi-cafe
npm install
```

---

## TAHAP A — Supabase

### A1. Buat project

1. Buka [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Isi:
   - **Name:** bebas, mis. `senja-rimba`
   - **Database Password:** klik **Generate a password**, lalu **segera salin & simpan** —
     password ini tidak bisa dilihat lagi, hanya bisa di-reset.
     Tip: gunakan huruf + angka saja. Karakter seperti `@ : / ? # %` harus di-URL-encode
     di dalam connection string dan itu sumber error yang paling sering terjadi.
   - **Region:** **Southeast Asia (Singapore)** — ⚠️ region **tidak bisa diubah** setelah
     project dibuat. Pilihan ini harus sama dengan region Vercel (`sin1`) yang sudah
     dikunci di `vercel.json`.
   - **Plan:** Free
   - Jika muncul checkbox *"Automatically expose new tables"*, biarkan **tidak dicentang**.
3. Klik **Create new project**, tunggu ±1–2 menit sampai provisioning selesai.

### A2. Catat 5 nilai ini

| # | Nilai | Lokasi di dashboard |
|---|-------|----------------------|
| 1 | Project URL (`https://<ref>.supabase.co`) | Settings → API Keys / General |
| 2 | Publishable key (`sb_publishable_…`) atau legacy *anon* | Settings → **API Keys** |
| 3 | Secret key (`sb_secret_…`) atau legacy *service_role* | Settings → **API Keys** |
| 4 | Connection string **Transaction pooler** (port `6543`) | Tombol **Connect** di atas → *Transaction pooler* |
| 5 | Connection string **Session pooler** (port `5432`) | Tombol **Connect** → *Session pooler* |

Pada kedua connection string, ganti `[YOUR-PASSWORD]` dengan database password dari A1.

> ⚠️ **Jangan pakai "Direct connection"** (`db.<ref>.supabase.co:5432`) — host itu IPv6-only
> dan tidak terjangkau dari Vercel. Jangan juga tertukar: **6543 = transaction** (untuk aplikasi),
> **5432 = session** (untuk migrasi).

### A3. Isi `.env.local` di komputer Anda

```bash
cp .env.example .env.local
# Windows CMD:        copy .env.example .env.local
# Windows PowerShell: Copy-Item .env.example .env.local
```

Buka `.env.local` dan isi 6 baris ini (nilai di bawah adalah **contoh palsu**, ganti dengan milik Anda).
Jika ada baris yang masih diawali `#`, hapus `#`-nya:

```env
DATABASE_URL=postgresql://postgres.xkqprjmzabcdefghijkl:SandiSenjaRimba26@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.xkqprjmzabcdefghijkl:SandiSenjaRimba26@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://xkqprjmzabcdefghijkl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ContohKunciPublik1234567890
SUPABASE_SERVICE_ROLE_KEY=sb_secret_ContohKunciRahasia1234567890
CRON_SECRET=9f2c4a7e1b8d3f605a2e9c4d7b1f8a3e6c0d5b2a9f4e7c1d8b3a605f2e9c4d7b
```

- `xkqprjmzabcdefghijkl` = project ref Anda (terlihat di URL dashboard).
  Salin connection string **utuh** dari dialog *Connect*, jangan mengetik manual.
- `CRON_SECRET` buat sendiri dengan salah satu perintah ini, lalu tempel hasilnya:

```bash
openssl rand -hex 32                                            # macOS / Linux / Git Bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # semua OS
```

- `SEED_DEMO_DATA` **jangan diisi** — seeder mati di production secara default, dan itu yang kita mau.

Lalu salin juga ke `.env` (drizzle-kit membaca `.env`; `.env.local` adalah konvensi Next.js —
kedua file sudah masuk `.gitignore` sehingga tidak akan ter-commit):

```bash
cp .env.local .env
```

### A4. Buat 6 tabel

```bash
npm run db:push
```

Perintah ini memakai `DIRECT_URL` (session pooler), menampilkan SQL pembuatan tabel,
dan meminta konfirmasi → pilih **apply / Yes**.

✅ **Cek:** dashboard Supabase → **Table Editor** → ada 6 tabel:
`users`, `sessions`, `tour_scenes`, `units`, `reservations`, `payments`.

### A5. Buat bucket Storage + kunci RLS

1. Dashboard Supabase → **SQL Editor** → **New query**
2. Tempel **seluruh isi** file [`supabase/setup.sql`](supabase/setup.sql) → **Run**
3. Skrip ini membuat bucket `media` (publik) & `bukti-transfer` (privat), menyalakan RLS
   di 6 tabel, dan mencabut grant `anon`/`authenticated`. Jalankan juga query verifikasi
   di bagian 4 file tersebut.

✅ **Cek:** menu **Storage** → ada 2 bucket (`media` publik, `bukti-transfer` privat).

> 🔒 Jangan pernah mengirim database password, secret/service_role key, atau `CRON_SECRET`
> ke chat, issue, atau commit Git. Cukup simpan di `.env.local` dan dashboard Vercel.

---

## TAHAP B — Vercel

### B1. Import repo

1. Buka [vercel.com](https://vercel.com) → **Log in with GitHub** (akun yang sama)
2. **Add New… → Project** → pada daftar *Import Git Repository* pilih **`nabawi-cafe`** → **Import**
   (jika tidak muncul: klik *Adjust GitHub App Permissions*)

### B2. Konfigurasi proyek

| Pengaturan | Isi |
|---|---|
| Framework Preset | **Next.js** (terdeteksi otomatis) |
| Root Directory | `./` (default) |
| Build / Install Command | Default (jangan diubah) |
| Node.js Version | Otomatis dari `engines` = 22.x |

### B3. Environment Variables — **isi sebelum klik Deploy**

Buka bagian **Environment Variables**, tambahkan 6 variabel ini (nilainya **sama persis**
dengan `.env.local` Anda), dan centang **Production + Preview + Development** untuk semuanya:

| Variabel | Nilai |
|---|---|
| `DATABASE_URL` | Transaction pooler, port **6543** |
| `DIRECT_URL` | Session pooler, port **5432** |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret / service_role key |
| `CRON_SECRET` | String acak yang sama seperti di `.env.local` |

> `DATABASE_URL` dan `NEXT_PUBLIC_*` dibaca **saat build** — jika belum ada, build gagal.
> Region `sin1` dan cron mingguan sudah diatur otomatis oleh `vercel.json`, tidak perlu diset manual.

### B4. Deploy

Klik **Deploy** dan tunggu build selesai (±1–3 menit). Setelah berhasil, Vercel memberi
URL seperti `nabawi-cafe-<acak>.vercel.app`.

---

## TAHAP C — Verifikasi

### C1. Koneksi Vercel ↔ Supabase

Buka `https://<url-anda>.vercel.app/api/health` → harus membalas sukses (bukan error 500).
Ini bukti end-to-end bahwa aplikasi di Vercel berhasil terhubung ke database Supabase.

Cek region (opsional, dari terminal):

```bash
curl -sI https://<url-anda>.vercel.app/dashboard | grep -i x-vercel-id
# harus menyebut sin1, bukan iad1
```

### C2. Buat admin pertama

Seeder tidak jalan di production, jadi:

1. Daftar akun biasa di `/daftar` pada situs Anda
2. Di SQL Editor Supabase, jalankan:

```sql
update public.users set role = 'admin' where email = 'email-anda@domain.com';
select id, name, email, role from public.users order by id;  -- pastikan tidak ada akun demo
```

### C3. Uji unggah (Storage)

Login sebagai admin → tambah **1 unit** dan unggah **1 foto** → foto harus tampil.
Tambahkan juga **1 scene panorama 360°** → pastikan tampil normal (tidak hitam).

### C4. Uji alur pelanggan

Buat akun kedua → buat reservasi → unggah bukti transfer → kembali sebagai admin →
bukti transfer harus bisa dibuka (bukti bucket privat + signed URL bekerja).

> Catatan: situs produksi memang **mulai dari kosong** — unit dan scene tur Anda isi
> sendiri lewat dashboard admin.

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `db:push` error `ECONNREFUSED 127.0.0.1:5432` | Env tidak terbaca drizzle-kit | Pastikan `.env` ada (langkah A3) dan `DIRECT_URL` terisi |
| `db:push` error *password authentication failed* | Password salah / karakter khusus belum di-encode | Cek password; URL-encode mis. `@` → `%40` |
| Build Vercel gagal: `DATABASE_URL is required` | Env var belum diset sebelum build | Settings → Environment Variables → isi → **Deployments → ⋯ → Redeploy** |
| Halaman error 500 setelah deploy | Tabel belum ada, atau port `DATABASE_URL` salah | Jalankan A4; pastikan `DATABASE_URL` port **6543** |
| Tombol unggah gagal | `NEXT_PUBLIC_*` belum ada saat build, atau bucket belum dibuat | Set env var lalu **Redeploy**; jalankan A5 |
| Panorama 360° tampil hitam | Kemungkinan CORS pada URL storage | Laporkan — ada fallback yang bisa diterapkan |
| Situs mati setelah seminggu sepi | Project Free di-pause Supabase | Klik **Resume** di dashboard Supabase; cron keepalive mencegahnya jika `CRON_SECRET` sudah diset di Vercel |
| *Deployment Blocked — commit author* | Restriksi kolaborasi Vercel Hobby | Pastikan login Vercel memakai akun GitHub yang sama; repo ini publik sehingga normalnya tidak terjadi |

---

## Ringkasan arsitektur (untuk referensi)

- **Runtime DB** selalu lewat transaction pooler `6543` (aman untuk serverless);
  **migrasi** selalu lewat `DIRECT_URL` `5432`.
- Unggahan bersifat *client-direct*: browser mengunggah langsung ke Supabase Storage
  dengan signed URL — file tidak melewati function Vercel (bebas batas 4.5 MB).
- Nilai yang disimpan di DB berbentuk `/api/media/<kind>/<nama>`; bukti transfer
  disajikan lewat cek kepemilikan + signed URL 5 menit.
- Aplikasi connect sebagai role `postgres` (owner tabel) sehingga RLS yang dinyalakan
  di `setup.sql` tidak mengganggu aplikasi — yang ditutup hanya akses Data API publik.
