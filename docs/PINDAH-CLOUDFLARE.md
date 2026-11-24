# Pindah dari Vercel ke Cloudflare (database tetap Supabase)

Dokumen ini ditulis untuk keadaan repo **per commit ini**: konfigurasi
Cloudflare sudah siap dan **sudah diuji lokal di runtime Workers**, tetapi
**belum ada yang di-deploy** dan **Vercel masih menjadi produksi**.

Prinsipnya satu: **jangan cabut Vercel sebelum Cloudflare terbukti**.
Keduanya bisa hidup bersamaan tanpa saling ganggu.

---

## 1. Yang sudah disiapkan (status: selesai, teruji lokal)

| Berkas | Isi | Kenapa |
|---|---|---|
| `wrangler.jsonc` | nama Worker, `nodejs_compat`, binding `ASSETS`, `WORKER_SELF_REFERENCE`, **`IMAGES`** | `IMAGES` inilah yang membuat `next/image` tetap bekerja (**opsi 1: pakai adapter**) |
| `open-next.config.ts` | konfigurasi minimal | belum butuh cache; satu override lebih sedikit yang bisa salah |
| `next.config.mjs` | `initOpenNextCloudflareForDev()` di dalam `catch` | `next dev`/`next build` tetap jalan walau adapter tidak ada |
| `public/_headers` | cache `immutable` untuk `/_next/static/*` | tanpa ini tiap kunjungan mengirim ~7 permintaan validasi |
| `.dev.vars.example` | contoh env lokal | `.dev.vars` sungguhan tidak masuk repo |
| `.github/workflows/cloudflare.yml` | CI: PR → `versions upload`, main → `deploy` | **nonaktif sampai digerbangi** |
| `package.json` | `next` 15.5.29, `@opennextjs/cloudflare` 1.20.18, `wrangler` 4.166.0, script `preview`/`deploy:cf` | adapter 1.20.16+ mensyaratkan Next ≥15.5.29 |

### Hasil uji lokal (runtime Workers, bukan Node)

Dijalankan dengan `npx wrangler dev --local`, binding `IMAGES`/`ASSETS`
`WORKER_SELF_REFERENCE` aktif:

| Halaman | Status |
|---|---|
| `/`, `/fitur`, `/menu`, `/tour`, `/order?meja=1`, `/order/admin` | **200** |
| `/menu` isi | 126 kartu, 6 kategori, 7 pil, 12 aturan saring — **identik** dengan versi Node |
| `/api/order/menu/tersedia` | 200, data menu |
| `POST /api/order/pesanan` (keranjang kosong) | 400 dengan pesan benar — validasi jalan |
| `/_next/image?url=…fitur-bg.jpg&w=640` | 200 · **723 KB → 119 KB** JPEG, **51 KB** AVIF |
| Bundel Worker | 5,2 MB mentah / **1,08 MB gzip** (batas gratis 3 MB) |

---

## 2. Yang harus Anda lakukan (butuh akun, tidak bisa saya lakukan dari sini)

### 2.1 Buat akun & ambil kredensial

1. Daftar di **dash.cloudflare.com** (gratis, tanpa kartu kredit untuk Workers).
2. Salin **Account ID** (kanan bawah halaman Workers).
3. Buat **API Token**: My Profile → API Tokens → Create Token →
   template **"Edit Cloudflare Workers"**. Simpan tokennya.

### 2.2 Setelan build di dashboard Cloudflare (INI YANG MEMBUAT DEPLOY GAGAL)

Kalau repo sudah terhubung ke Cloudflare lewat GitHub, Cloudflare
menanyakan build command. Nilai defaultnya **salah** untuk proyek ini.

| Setelan | Default (salah) | Yang benar |
|---|---|---|
| Build command | `npm run build` | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` | tetap — sudah benar |

**Kenapa `npm run build` gagal.** Perintah itu hanya menjalankan
`next build`, yang menghasilkan `.next`. Yang dibutuhkan Worker adalah
`.open-next/worker.js`. Deploy lalu berhenti dengan pesan yang
menyesatkan:

```
ERROR Could not find compiled Open Next config, did you run the build command?
```

Padahal yang hilang bukan konfigurasi, melainkan artefak Worker.
Direproduksi lokal: `npx wrangler deploy --dry-run` pada repo yang hanya
di-`next build` menghasilkan
`The entry-point file at ".open-next/worker.js" was not found.`
Setelah `npx opennextjs-cloudflare build`, deploy berjalan.

Catatan: `npx opennextjs-cloudflare build` **memanggil `next build`
sendiri** — jangan dirangkai dua kali.

Setel juga **`NODE_VERSION=22`** di environment variables. Log build
Cloudflare memakai Node 24 sementara `package.json` mensyaratkan `22.x`
(warning `EBADENGINE`). Tidak fatal hari ini, tapi berarti build berjalan
di versi yang berbeda dari yang diuji.

### 2.3 Deploy pertama dari komputer Anda

```bash
npx wrangler login          # sekali saja, membuka browser
npm run deploy:cf           # build + deploy
```

Alamat gratis yang muncul saat deploy pertama:

```
https://nabawi-cafe.<subdomain-akun>.workers.dev
```

> **Nama menentukan alamat.** `name` di `wrangler.jsonc` adalah
> `nabawi-cafe`. Kalau diubah **setelah** deploy pertama, Worker baru
> dibuat dan alamat lama tetap hidup — dua salinan aplikasi. Putuskan
> sebelum deploy pertama.

### 2.4 Pasang variabel environment

Tiga variabel, dan **ketiganya wajib**:

| Variabel | Jenis | Tanpa ini |
|---|---|---|
| `SUPABASE_URL` | biasa | tidak ada yang bisa dibaca |
| `SUPABASE_ANON_KEY` | biasa | tidak ada yang bisa dibaca |
| `SUPABASE_SERVICE_KEY` | **rahasia** | menu terbaca, **pesanan ditolak** |

```bash
# rahasia — tidak masuk repo, tidak tampil sebagai teks di dashboard
npx wrangler secret put SUPABASE_SERVICE_KEY

# nilainya bisa diimpor dari .env lokal:
#   cat .env | npx wrangler secret bulk
```

Untuk yang bukan rahasia (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), boleh
lewat dashboard Worker → Settings → Variables, atau `vars` di
`wrangler.jsonc`.

**Selama transisi, isi di Vercel DAN Cloudflare.** Jangan cabut Vercel.

#### Kenapa dulu terlihat "sudah jalan" padahal env kosong

`app/lib/supabase.ts` dan `app/lib/order/db.ts` dulu menyimpan alamat
database dan kunci publik sebagai **nilai cadangan di dalam kode**
(`process.env.SUPABASE_URL ?? "https://…"`). Akibatnya aplikasi tetap
tersambung ke database yang sama walau dashboard kosong, dan halaman
tampil normal tanpa satu pun tanda.

Ini bukan teori — pernah menimbulkan diagnosis yang salah di sesi ini:
situs tampil dengan 126 menu dan 10 venue, sehingga disimpulkan env sudah
terpasang. Yang membongkarnya baru perbandingan **rentang id**
(database 15–140, salinan lokal 1–126). Respons
`/api/order/menu/tersedia` berakhir `"demo":true` — bukti
`SUPABASE_SERVICE_KEY` tidak ada.

Nilai cadangan itu **sudah dihapus**. Sekarang:

| Keadaan | Yang terlihat |
|---|---|
| env kosong | `/menu` & `/tour` bertanda **"Data contoh"**; `/order` menolak dengan pesan env mana yang kurang |
| env baca saja | menu & tour asli, pesanan ditolak (PitaDemo) |
| ketiganya ada | semuanya jalan |

Cara memastikan dari luar, tanpa membuka dashboard:

```bash
curl -s https://<worker>.workers.dev/api/order/menu/tersedia | grep -o '"demo":[a-z]*'
```

`"demo":false` berarti kunci server terpasang. `"demo":true` berarti
belum — pesanan pelanggan akan ditolak.

### 2.5 Nyalakan CI (opsional)

Kalau ingin setiap PR otomatis dapat URL preview:

1. GitHub → Settings → Secrets and variables → Actions
2. **Secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
3. **Variables**: `CLOUDFLARE_ENABLED=true`, `CF_WORKER_NAME=nabawi-cafe`,
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`

Selama `CLOUDFLARE_ENABLED` tidak ada, alur ini **dilewati** — bukan merah.

---

## 3. Uji sebelum menyentuh domain

### 3.1 Otomatis dulu

```bash
npm run verifikasi -- https://nabawi-cafe.<subdomain>.workers.dev
```

Skrip ini memeriksa 24 hal: semua halaman (termasuk kelima portal staf),
isi `/menu` (126 kartu, 6 kategori, 7 pil, aturan saring), **optimasi
gambar** (harus jauh di bawah 723 KB dan berformat AVIF/WebP), API
(`/api/order/menu/tersedia` dan penolakan pesanan kosong), serta CSS.

Ia juga **berhenti dengan kode gagal** kalau ada yang tidak beres, jadi
bisa dipakai di CI. Yang tidak bisa dinilai dari luar ditulis eksplisit
sebagai "LEWAT", bukan diam-diam dianggap lulus.

Yang **tidak** bisa diperiksa skrip ini dan tetap harus Anda lihat:

- [ ] menu benar-benar dari database (bandingkan satu harga dengan dashboard Supabase)
- [ ] pesanan sungguhan terkirim dan muncul di portal dapur
- [ ] waktu muat terasa setara atau lebih cepat dari Vercel

### 3.2 Manual di HP

Buka alamat `workers.dev` di HP, lalu periksa **satu per satu**:

- [ ] `/menu` — 126 kartu, foto/ikon tampil, pil kategori menyaring
- [ ] `/tour` — panorama dan latar sama seperti di Vercel
- [ ] `/order?meja=1` — pesanan bisa dikirim
- [ ] `/order/admin`, `/order/kasir`, `/order/dapur`, `/order/pelayan` — bisa dibuka
- [ ] Gambar menu (kalau sudah ada foto di Supabase) tampil, bukan kotak kosong
- [ ] Waktu muat terasa setara atau lebih cepat

**Jangan lewati ini.** Lima portal staf belum punya autentikasi; kalau
salah satu pecah di Workers, Anda ingin tahu sebelum domain pindah.

---

## 4. Pindah domain (hanya setelah semua di atas lolos)

1. Tambahkan domain ke Cloudflare (atau pindahkan nameserver-nya).
2. Worker → Settings → Domains & Routes → **Add Custom Domain**.
3. Tes ulang daftar di bagian 3 memakai domain baru.
4. **Baru** matikan Vercel.

Yang paling mudah terlupa: **URL webhook** (DOKU nanti, atau apa pun)
harus diarahkan ke domain baru. Cari semua yang menyebut domain lama.

---

## 5. Yang berbeda dan perlu diingat

| | Vercel | Cloudflare Workers |
|---|---|---|
| Runtime | Node.js penuh | Workers + `nodejs_compat` |
| `crypto` / `Buffer` | lengkap | **sebagian** — audit sebelum pakai |
| Optimasi gambar | otomatis, termasuk | perlu binding `IMAGES`, **bisa berbiaya** |
| Cache ISR | otomatis | perlu R2 (belum dipakai di sini) |
| Cold start | ~0 | ada, biasanya singkat |
| Biaya | per request | gratis 100k req/hari |

### Kalau nanti biaya Images mengganggu

Ada jalur mundur yang tidak membongkar kode: loader kustom ke
`/cdn-cgi/image/...` (memakai transformasi zona, bukan Cloudflare
Images). Lihat dokumentasi adapter bagian *"Use a custom loader"*.

---

## 6. Batasan yang harus jujur disebut

- **Semua verifikasi di atas dilakukan di sandbox ini**, yang **tidak bisa
  menjangkau Supabase**. Artinya halaman yang diuji memakai salinan menu
  lokal (`MENU_CONTOH`), bukan data live. Uji dengan database sungguhan
  tetap harus Anda lakukan di Workers sungguhan.
- **Belum ada deploy.** Tidak ada akun Cloudflare di sesi ini, jadi semua
  yang tertulis di sini berhenti di "siap deploy", bukan "sudah deploy".
- **Node di build Cloudflare = 24, bukan 22.** `package.json` mensyaratkan
  `22.x`, jadi build berjalan di versi berbeda dari yang diuji. Setel
  `NODE_VERSION=22` di environment variables Worker, atau longgarkan
  `engines` ke `>=22` setelah diuji.
- **`vercel.json` sengaja belum dihapus.** Ia mematikan deploy `main` di
  Vercel. Menghapusnya sebelum Cloudflare terbukti justru menghidupkan
  deploy otomatis di Vercel saat `main` berubah — kebalikan dari yang
  kita mau. Hapus **setelah** migrasi selesai.
