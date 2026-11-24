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
  "Lanjut ke Pembayaran"   ← pesanan SUDAH tersimpan di titik ini
      │
      ├──►  Bayar online  ──►  halaman DOKU  ──►  webhook TTD  ──►  LUNAS
      │
      └──►  Bayar tunai di kasir  ──►  kasir menekan "Bayar tunai"  ──►  LUNAS
                                                          │
                                                          ▼
                                            muncul di KASIR dan DAPUR
```

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
npm run uji:prabayar     # 48 uji: jam 24 jam, signature DOKU, verifikasi webhook
npm run uji:aturan       # 45 uji: harga, pajak, transisi status
npm run uji:jalur        # 17 uji: alur pesanan sungguhan ke database
npm run uji:menu         # 32 uji: halaman menu
npm run uji:env          # 11 uji: perilaku saat env kosong
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
