# Prabayar — DOKU & tunai kasir

Dokumen ini menjelaskan alur **bayar dulu, baru diproses**. Menggantikan
asumsi lama "tamu membayar di kasir setelah makan".

## 1. Alur dari sisi tamu

```
scan QR meja
      │
      ▼
  pilih menu  ──►  isi nama + nomor WhatsApp  ◄── WAJIB
      │
      ▼
  PILIH METODE PEMBAYARAN  ──  dua pilihan, dua janji berbeda
      │
      ├──►  "Bayar Sekarang"  ──►  halaman DOKU  ──►  webhook TTD  ──►  LUNAS
      │        (QRIS / e-wallet / kartu)                                │
      │                                                                 │
      └──►  "Bayar di Kasir"  ──►  pesanan tersimpan, tamu duduk       │
               kasir menekan "Uang pas" / "Uang lebih"  ──►  LUNAS  ◄──┘
                                                          │
                                                          ▼
                                            muncul di KASIR dan DAPUR
```

### Kenapa dua nama itu

| Tombol | Yang ditekankan | Janji ke tamu |
| --- | --- | --- |
| **Bayar Sekarang** | **waktu** | pesanan diteruskan setelah pembayaran selesai |
| **Bayar di Kasir** | **tempat** | tamu tidak perlu menyelesaikan apa pun di ponsel |

Sengaja **bukan** "QRIS" dan "Tunai":
· QRIS hanyalah salah satu kanal DOKU (masih ada e-wallet dan kartu);
· "tunai" mengesankan tamu tidak bisa memakai kartu di kasir.

### Yang terjadi setelah memilih

| Pilihan | Yang dilihat tamu | Yang dilihat kasir |
| --- | --- | --- |
| Bayar Sekarang | layar pembayaran + tombol bayar | muncul di **Belum dibayar** dengan label *Pilih bayar online* |
| Bayar di Kasir | "Pesanan diterima · Nomor M1-…" + tombol Panggil kasir | muncul di **Belum dibayar** dengan label *Bayar di kasir* |

Keduanya **sama-sama tersimpan** — bedanya hanya apa yang terjadi sesudahnya.
Pesanan tidak masuk dapur sampai lunas, apa pun pilihannya.

Pesanan tersimpan **sebelum** tautan bayar dibuat. Urutan ini disengaja:
kebalikannya memungkinkan tamu membayar pesanan yang tidak pernah tercatat
kalau langkah penyimpanan gagal.

Kalau DOKU bermasalah, pesanan **tidak dihapus** — tamu masih bisa membayar
tunai di kasir. Menghapusnya akan membuat data yang sudah diisi hilang karena
gangguan pihak ketiga.

## 2. Status pembayaran

| `status_bayar` | Arti | Terlihat di kasir/dapur |
| --- | --- | --- |
| `menunggu` | belum dibayar, masih dalam batas waktu | tidak |
| `lunas` | uang diterima | **ya** |
| `kedaluwarsa` | lewat batas tanpa bayar | tidak |
| `gagal` | percobaan bayar gagal (masih bisa coba lagi) | tidak |
| `dikembalikan` | refund dicatat manual oleh kasir | tidak |

Pesanan yang sudah `lunas` **langsung muncul di dapur** walaupun status
dapurnya masih `menunggu_konfirmasi`. Sebelumnya dapur menyaring status itu,
sehingga pesanan yang sudah dibayar tidak pernah muncul sampai kasir menekan
"terima" satu kali lagi — dan bila kasir lupa, tamu menunggu makanan yang
tidak pernah dimasak.

`gagal` **tidak** membatalkan pesanan. Tamu sering mencoba metode lain setelah
QRIS kedaluwarsa; yang membatalkan adalah penyapu kedaluwarsa.

## 3. Endpoint

| Metode & jalur | Untuk | Pengaman |
| --- | --- | --- |
| `POST /api/order/pesanan` | tamu membuat pesanan | jam buka + validasi + batas 5/menit/sesi |
| `POST /api/order/doku/invoice` | tamu minta tautan bayar | `sesi` harus cocok dengan pemilik pesanan |
| `POST /api/order/doku/notifikasi` | **webhook DOKU** | signature HMAC-SHA256 atas badan MENTAH |
| `POST /api/order/kasir` `aksi:"bayar_tunai"` | kasir terima tunai | `SUPABASE_SERVICE_KEY` |
| `POST /api/order/sapu` | batalkan yang kedaluwarsa | header `x-sapu-kunci` |
| `GET/POST /api/order/jam-buka` | baca/ubah jam buka | GET publik, POST butuh kunci server |

### Kenapa endpoint penyapu, bukan cron Cloudflare

Cron Cloudflare memanggil event `scheduled`, sedangkan adapter OpenNext hanya
mengekspor `fetch`. Cron per menit akan **terdaftar** di konfigurasi tetapi
tidak melakukan apa pun — kegagalan yang senyap.

Sebagai gantinya:

1. **Penyapu berjalan otomatis setiap portal kasir dibuka.** Kasir membuka
   layarnya sepanjang jam buka, jadi ini titik yang paling pasti.
2. `POST /api/order/sapu` untuk penjadwal luar (GitHub Actions, layanan ping).

Kalau `SAPU_KUNCI` kosong, endpoint **menolak** (503) — tidak terbuka.

## 4. Memasang DOKU

### Rahasia (jangan pernah masuk repo)

```bash
npx wrangler secret put DOKU_CLIENT_ID
npx wrangler secret put DOKU_SECRET_KEY
```

`DOKU_MODE` (`sandbox` | `production`) boleh masuk `vars` di `wrangler.jsonc`
karena bukan rahasia.

### Webhook

Daftarkan di dashboard DOKU:

```
https://<worker>.workers.dev/api/order/doku/notifikasi
```

Endpoint menjawab **401** (bukan 200) bila signature salah. Itu disengaja:
salah konfigurasi secret harus terlihat saat pemasangan, bukan setelah ada
pembayaran yang hilang.

Notifikasi bisa dikirim berulang → penandaan lunas idempoten.

### Yang TIDAK dibangun

- **Refund otomatis lewat API DOKU.** Pemilik memutuskan refund dicatat manual
  di kasir. Tidak ada `POST /orders/v1/refund` di kode ini.
- **Mengandalkan redirect setelah bayar.** URL `?status=success` bisa diketik
  siapa saja.

## 5. Jam buka

Disimpan di `pengaturan` baris `jam_mingguan`, format
`"HH.MM-HH.MM,HH.MM-HH.MM"` (Senin–Kamis, Jumat–Minggu).

**Buka 24 jam:**

```sql
update pengaturan set nilai='00.00-24.00,00.00-24.00' where kunci='jam_mingguan';
```

Atau lewat **`/order/admin` → tab "Jam buka" → tombol "Buka 24 jam"** — satu
tekan, dan tombol "Kembali ke jam normal" ada di sebelahnya. Tidak perlu
deploy.

`mulai == selesai` berarti buka sepanjang hari, **bukan** tutup. Menafsirkannya
sebagai tutup akan menghasilkan kafe yang tidak pernah buka.

## 6. Batas waktu bayar

`pengaturan.batas_bayar_menit` (bawaan **15**). Diubah tanpa deploy:

```sql
update pengaturan set nilai='30' where kunci='batas_bayar_menit';
```

Nilai tidak sah (atau di luar 1–120) jatuh ke 15. Batas 0 akan membatalkan
pesanan sebelum tamu sempat membuka halaman pembayaran.

## 7. Bayar tunai bisa dimatikan

```sql
update pengaturan set nilai='off' where kunci='bayar_tunai_kasir';
```

Saat `off`, aksi `bayar_tunai` menjawab 403 dengan pesan yang menyebut
pengaturannya. Pesanan yang sudah ada tidak terpengaruh.

## 8. Uji

```bash
npm run uji:prabayar   # 56 uji: jam 24 jam, signature DOKU, metode bayar
npm run uji:lunas      # 37 uji: checkout -> bayar tunai -> muncul di dapur
npm run uji:alur       # 26 uji: seluruh portal lewat HTTP (butuh server)
npm run uji:aturan     # 45 uji: harga, pajak, transisi status
npm run uji:jalur      # 17 uji: alur pesanan sungguhan ke database
npm run uji:menu       # 32 uji: halaman menu
npm run uji:env        # 11 uji: perilaku saat env kosong
```

`uji:alur` **butuh server yang menyala** (`BASE=http://localhost:3000`).
Jangan arahkan ke production — ia membuat pesanan sungguhan (dan
membatalkannya lewat perubahan status, bukan menghapus).

### Yang dijaga `uji:alur`

Rantai yang pernah putus dan dilaporkan pemilik:

```
POST /api/order/pesanan   →  tersimpan + punya tagihan
GET  /api/order/kasir     →  muncul di "Belum dibayar", BELUM di dapur
POST /api/order/kasir     →  bayar_tunai → lunas
GET  /api/order/kasir     →  muncul di antrean, membawa nomor meja & item
GET  /api/order/dapur     →  tiket muncul, membawa nomor meja
PATCH /api/order/status   →  diterima → diproses → siap
GET  /api/order/pelayan   →  muncul setelah siap (dan TIDAK sebelum)
```

`uji:prabayar` menguji **bolak-balik**: signature yang dibuat harus lolos
verifikasi sendiri, dan yang diubah satu karakter harus ditolak. Tanpa arah
kedua, fungsi verifikasi yang selalu mengembalikan `true` akan lolos uji.

## 9. Yang belum diuji di sini

Signature DOKU diuji **bentuk dan bolak-baliknya**, bukan terhadap sandbox
DOKU sungguhan — tidak ada kredensial di lingkungan pengembangan. Yang perlu
dipastikan saat memasang:

1. `POST /api/order/doku/invoice` mengembalikan `url` yang bisa dibuka.
2. Setelah bayar di sandbox, webhook masuk dan pesanan berubah `lunas`.
3. Notifikasi ganda tidak menghasilkan dua baris `pembayaran`.

---

# 10. Invoice yang bisa dicetak

Sebelum ini "struk" hanya ada di portal kasir, muncul satu kali setelah
lunas, dan tombol Cetak memanggil `window.print()` tanpa CSS cetak — jadi
yang keluar di kertas adalah **seluruh layar kasir**: antrean, denah 20
meja, dan semua tombol. Tamu pun tidak punya salinan apa pun, dan tidak ada
nomor yang bisa ia sebutkan saat mempersoalkan tagihan.

## Satu sumber data, satu komponen

| Berkas | Peran |
| --- | --- |
| `app/lib/order/invoice.ts` | `ambilInvoice(pesananId, { sesi })` → bentuk invoice. Satu-satunya tempat yang tahu cara merakitnya. |
| `app/components/order/LembarInvoice.tsx` | Tampilan + tombol cetak. Dipakai **kasir dan pelanggan**. |
| `app/api/order/invoice/[id]/route.ts` | Jalur kasir (`?kunci=1`) dan pelanggan (`?sesi=…`). |
| `app/order/invoice/[id]/page.tsx` | Halaman cetak milik tamu; bisa disimpan & dibuka ulang. |
| `app/globals.css` → `@media print` | Yang membuat hanya invoice yang keluar di kertas. |

Alasan digabung menjadi satu komponen: dua salinan akan menyimpang, dan
tamu akan membawa pulang invoice yang tidak cocok dengan yang dipegang
kasir.

## Nomor invoice

Dipakai `pesanan.nomor` (mis. `M9-1909-56`), **bukan**
`pembayaran.invoice_number` milik DOKU. Pembayaran tunai tidak punya nomor
DOKU sama sekali; invoice yang nomornya kosong untuk separuh transaksi
bukan invoice. Nomor DOKU tetap dicetak sebagai `Ref. DOKU` bila ada.

## Angka dari tagihan, bukan dihitung ulang

Subtotal, layanan, pajak, pembulatan, dan total dibaca dari baris
`tagihan`. Kalau dihitung ulang dari item, invoice bisa berbeda dari yang
tercatat begitu tarif berubah — perbedaan yang paling sulit dijelaskan
kepada tamu. Bila tagihannya tidak ada (pesanan lama), total dihitung dari
item supaya tidak tercetak Rp0.

## Keamanan

- Jalur pelanggan **wajib** `?sesi=`; sesi lain → **403**, tanpa
  membocorkan nama maupun nomor WhatsApp.
- Jalur kasir (`?kunci=1`) hanya membuka pesanan yang **belum lunas** atau
  dilunasi **≤ 24 jam** lalu. Tanpa batas ini, id pesanan bisa ditelusuri
  satu per satu untuk memanen nomor WA seluruh arsip. Ini penutup
  sementara sampai portal kasir punya PIN staf.
- Halaman pelanggan `noindex` — invoice memuat nomor WhatsApp.

## Cetak

`window.print()` pada modal biasa akan mencetak seluruh halaman. Saat
tombol ditekan, `LembarInvoice` memasang kelas `mencetak-invoice` di
`<body>`; CSS mencetak menyisakan hanya `[data-invoice]`.

Dipilih pendekatan ini, bukan `window.open` + `document.write`, karena
pemblokir popup mematikan jendela baru tanpa gejala, jendela baru
kehilangan CSS Tailwind, dan di ponsel tamu ia membuka tab nyasar.

Dua lapis, dengan alasan:

1. `visibility` — bekerja di semua browser. Elemen tersembunyi masih
   memakan ruang, jadi ini jaring pengaman, bukan solusi penuh.
2. `:has()` — mematikan elemen yang bukan invoice dan meratakan
   leluhurnya (tanpa `overflow`, tanpa `position: fixed`) supaya invoice
   mulai dari atas kertas dan bisa lanjut ke halaman kedua. Browser yang
   tidak mengenal `:has()` mengabaikan lapis ini; lapis 1 tetap membuat
   hasil cetak hanya berisi invoice.

## Yang diuji

| Perintah | Cakupan | Butuh server |
| --- | --- | --- |
| `npm run uji:invoice` | 35 cek `ambilInvoice`: nomor, angka dari tagihan, penggabungan item, sesi, pesanan tanpa tagihan, label, zona waktu | tidak |
| `npm run uji:invoice:http` | 29 cek rantai: buat → bayar → invoice kasir → invoice pelanggan → halaman cetak | ya |

Yang paling penting di `uji:invoice:http`: invoice jalur kasir dan jalur
pelanggan dibandingkan **persis** (`JSON.stringify`). Dua jalur yang
menghasilkan angka berbeda adalah cara tercepat kehilangan kepercayaan
tamu.

## Catatan jujur

Hasil cetak **belum pernah dirender** di lingkungan ini: Chromium tidak
bisa diunduh di sandbox pengembangan (`playwright install` gagal). Yang
sudah dibuktikan: aturan `@media print` benar-benar tersaji di CSS hasil
build, dan halaman memuat `data-invoice`, nomor, total, serta tombol cetak.
Yang belum: pratinjau kertas sungguhan. Periksa sekali di tablet kasir
(Chrome → Cetak → Simpan sebagai PDF) sebelum jam buka.

---

# 11. Perubahan: panggilan dihapus, meja & QR dirapikan

## 11.1 Fitur panggilan dan bill dihapus

Yang dihapus, bukan hanya disembunyikan:

| Bagian | Keadaan sekarang |
| --- | --- |
| `POST /api/order/panggilan` | **dihapus** — 404 |
| `buatPanggilan()` di `data.ts` | dihapus |
| `Panggilan` di `tipe.ts` | dihapus (tipe maupun label) |
| `tangani_panggilan` di route kasir | dihapus |
| Respons `/api/order/pelayan` & `/api/order/kasir` | tidak lagi memuat `panggilan` |
| Portal pelanggan | tombol **Panggil** dan **Bill** hilang dari kepala; "Panggil kasir" di layar konfirmasi hilang |
| Portal pelayan | tab **Panggilan** hilang; tinggal satu daftar antar |
| Portal kasir | kartu "Panggilan menunggu" hilang |
| `StatusMeja` / `StatusTagihan` | `minta_bill` dihapus dari tipe |

**Tabel `panggilan` sengaja TIDAK dihapus.** Isinya 3 baris (2 `bill`,
1 `pelayan`) dan tabelnya tidak dibaca siapa pun lagi. Menghapus tabel
berarti migrasi yang tidak bisa dibatalkan; membiarkannya tidak merugikan.
Kalau nanti dipastikan tidak diperlukan, buang lewat migrasi tersendiri.

`minta_bill` juga masih diizinkan oleh CHECK constraint di database. Data
live diperiksa sebelum perubahan ini: **tidak ada** baris meja maupun
tagihan yang berstatus `minta_bill`, jadi tidak ada data yang jadi tidak
terbaca.

## 11.2 Urutan nomor meja

`nomor` di tabel `meja` bertipe TEXT, sehingga `order=nomor.asc` memberi
**1, 10, 11, 12, …, 19, 2, 20, 3** — inilah "urutan acak" yang dilaporkan.

Perbaikan dilakukan di aplikasi, bukan di database: `urutNomorMeja()` di
`tipe.ts` dijalankan di `ambilMeja()` (dipakai admin & halaman tamu) dan
di route kasir. Nomor non-angka (`A1`, `VIP`) ditaruh setelah semua nomor
angka agar urutan angka tetap terbaca.

Migrasi kolom ke integer tidak dilakukan karena mengubah kontrak API dan
menyentuh kode QR; manfaatnya tidak sebanding untuk 20 meja.

## 11.3 Invoice menempel pada pesanan

Invoice sudah bisa dibuka **sebelum** dibayar dan **berkali-kali sesudah**
dibayar. Yang berubah di sesi ini: tautan invoice tersedia untuk **setiap**
pesanan di portal tamu (termasuk yang sudah masuk riwayat), dan uji baru
membuktikan dua kali pembukaan menghasilkan isi yang identik.

## 11.4 Portal pelanggan: pesanan baru vs riwayat

- **Pesanan Anda** — hanya yang masih berjalan.
- **Riwayat pesanan (n)** — tombol, tertutup secara bawaan.

Batas "selesai": pembayaran `kedaluwarsa`/`gagal`/`dikembalikan`, atau
status `diantar`/`ditolak`/`dibatalkan`. Pesanan **belum lunas tetap di
daftar aktif** apa pun status dapurnya — menyembunyikan tagihan yang belum
dibayar di balik "Riwayat" membuatnya terasa seperti arsip.

Kartu pesanan dipakai bersama oleh dua daftar itu (`KartuPesanan`), supaya
salah satunya tidak lupa menampilkan tautan invoice.

## 11.5 Tab Meja + QR di admin

Tab keempat di `/order/admin`: daftar meja per area, satu kartu per meja
berisi nomor, area, kapasitas, status, dan **QR**.

- **Isi QR:** `<origin>/order?meja=<nomor>` — tamu memindai, langsung
  memesan untuk meja itu. Tanpa parameter meja, tamu memilih sendiri dan
  pesanan bisa diantar ke meja orang.
- **Origin diambil dari `window.location.origin`**, bukan variabel
  lingkungan. Alamat production sudah pernah berubah (Vercel → Workers);
  QR yang tercetak dengan alamat lama adalah kertas mati yang baru
  ketahuan setelah ditempel di 20 meja. URL lengkapnya juga dicetak kecil
  di kartu supaya bisa diperiksa **sebelum** mencetak.
- **Cetak semua QR** memanggil `window.print()`; kartu memakai
  `break-inside-avoid` agar tidak terpotong dua halaman.
- Generator QR ditulis sendiri di `app/lib/order/qr.ts` (~200 baris,
  tanpa dependensi baru). Alasan: kebutuhan kita hanya byte mode level M
  untuk URL pendek, sedangkan pustaka QR umumnya 20–40 kB dan membawa
  encoder yang tidak dipakai.

### Generator QR ini diuji bagaimana

1. **Struktur** (`npm run uji:meja`): pola pencari di tiga sudut, garis
   waktu bergantian, modul gelap tetap, dua salinan format info identik,
   kepadatan modul 35–65%, jumlah perintah SVG = jumlah modul gelap, dan
   teks di luar kapasitas **melempar galat** alih-alih menghasilkan QR
   rusak.
2. **Dibaca ulang oleh decoder sungguhan** (sekali, saat pengembangan,
   dengan `jsqr`): 6 dari 6 kasus terbaca tepat — termasuk URL panjang dan
   teks non-ASCII. Decoder tidak dijadikan dependensi repo.

## 11.6 Yang belum dibuktikan

Sama seperti invoice: **hasil cetak QR belum pernah dirender** di
lingkungan ini (Chromium tidak bisa diunduh). Yang terbukti: matriksnya
valid, isinya tepat, dan halaman admin memuat tab serta tombol cetaknya.
Sebelum menempel 20 lembar, periksa satu: buka `/order/admin` → tab
**Meja** → pindai satu QR dengan ponsel. Kalau terbuka di `/order?meja=…`
dengan meja yang benar, sisanya akan sama.
