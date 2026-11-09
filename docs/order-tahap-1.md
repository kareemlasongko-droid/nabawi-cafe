# Sistem Order Meja — Tahap 1

Pesanan dari meja mengalir **pelanggan → kasir → dapur → pelayan → kasir (bayar)**.
Tahap 1 sengaja belum menyertakan pembayaran online/QRIS dinamis: tamu membayar di
kasir setelah makan.

## Alamat

| Halaman           | Untuk siapa | Login |
| ----------------- | ----------- | ----- |
| `/order?meja=12`  | Tamu (scan QR di meja) | tidak perlu |
| `/order/kasir`    | Kasir       | belum ada |
| `/order/dapur`    | Dapur & bar | belum ada |
| `/order/pelayan`  | Pelayan     | belum ada |
| `/order/admin`    | Pemilik / admin menu | belum ada |
| `/order/masuk`    | Daftar portal internal + keadaan keamanan | — |

Portal internal **tidak ditautkan** dari website publik dan diberi
`robots: noindex`.

## Keadaan sekarang: MODE DEMO

Kunci server database (`SUPABASE_SERVICE_KEY`) belum dipasang, jadi:

- Semua data order hidup di memori proses (`globalThis.__demoOrder`).
- Pesanan, tagihan, dan panggilan **hilang saat server restart** dan **tidak
  dibagi antar-instance** — dua orang yang membuka portal berbeda bisa melihat
  data berbeda di lingkungan serverless.
- Semua portal menampilkan pita **"Mode demo"** yang jelas. Ini disengaja:
  lebih baik terlihat seperti alat peraga daripada terlihat seperti sistem
  sungguhan yang diam-diam kehilangan pesanan.
- Hak tulis anon **tidak** dibuka untuk mengakalinya. Kalau dibuka, siapa pun
  yang menemukan anon key bisa mengubah harga dan status pesanan.

Untuk mengaktifkan mode sungguhan, pasang di Vercel:

```
SUPABASE_SERVICE_KEY = <service role key project mvuqdakfzffhrnzxnmke>
```

Tanpa variabel itu, endpoint tulis tetap menolak dengan status 503 dan pesan
yang menjelaskan sebabnya.

## Skema database

Migrasi `sistem_order_tahap1` sudah terpasang: 11 tabel + fungsi
`hitung_tagihan(meja_id)`.

`meja`, `kategori_menu`, `menu`, `pesanan`, `item_pesanan`, `tagihan`,
`pembayaran`, `panggilan`, `pengguna_internal`, `pengaturan`, `log_perubahan`.

Dua pengaman yang penting untuk dipahami sebelum mengubah data:

1. **Satu tagihan belum lunas per meja** — dijaga oleh unique index parsial.
   Ini yang membuat tamu bisa menambah pesanan kapan saja lalu membayar sekali.
2. **Harga tidak pernah datang dari klien.** `item_pesanan` menyimpan
   `nama_saat_pesan` dan `harga_satuan`; tagihan yang sudah terbuka tidak
   berubah saat harga menu diubah.

## Rumus tagihan

```
layanan = subtotal × persen   (kalau persen 0 → Rp2.000 flat)
pajak   = (subtotal + layanan) × 11%
total   = subtotal + layanan + pajak, dibulatkan sekali ke kelipatan 100
```

Biaya layanan dikenakan **sekali per tagihan**, bukan per pesanan — tamu yang
menambah menu dua kali tidak membayar dua kali biaya layanan.

## Aturan status

```
menunggu_konfirmasi → diterima → diproses → siap → diantar   (selesai)
        ↓                ↓
     ditolak         dibatalkan
```

- Maju **tepat satu langkah**. Tidak boleh melompat: pelanggan akan melihat
  status yang tak pernah terjadi, dan dapur kehilangan penanda "dikerjakan".
- `ditolak` wajib beralasan dan hanya dari `menunggu_konfirmasi`.
- `dibatalkan` hanya sebelum `diproses`. Setelah dapur mulai memasak,
  pembatalan berarti makanan terbuang dan harus lewat keputusan kasir.
- **Dapur hanya melihat pesanan yang sudah diterima kasir.** Ini yang mencegah
  dapur memasak pesanan yang belum dikonfirmasi (mis. tamu salah meja).
- Saat kasir menutup tagihan: meja kembali `kosong` **dan** semua panggilan
  meja itu ditutup, supaya pelayan tidak mendatangi meja yang sudah pergi.

Aturan ini ada di satu tempat (`app/lib/order/data.ts` → `transisiSah`) dan
dipakai **baik oleh jalur database maupun mode demo**. Kalau hanya jalur
database yang memeriksa, bug alur baru muncul di produksi.

## Keputusan tampilan yang perlu dijaga

- **Kasir**: 2 kolom. Antrean konfirmasi di kiri (paling atas, paling kontras),
  meja + tagihan di kanan. Tombol ≥48 px. Uang rata kanan, angka tabular.
  Penolakan beralasan lewat baris inline, bukan modal.
- **Dapur**: latar gelap `forest-950`, tiga kolom Baru / Diproses / Siap.
  Layar menyala sepanjang hari di area teduh — gelap mengurangi silau. Catatan
  pesanan **tidak boleh dipotong**. Menit tunggu selalu angka; warna
  (kuning 10 mnt, merah 15 mnt) hanya penguat, supaya tetap terbaca oleh
  orang dengan buta warna.
- **Pelayan**: satu kolom, seluruh baris = tombol, tanpa input teks. Getar
  dulu, baru bunyi — pelayan memegang HP sambil berjalan.
- **Pelanggan**: nomor meja besar dan area, bukan nama kafe. Tombol Panggil dan
  Minta bill selalu berteks (bukan ikon saja).
- Semua ikon SVG garis sendiri (`app/components/order/Ikon.tsx`,
  `IkonDapur.tsx`). **Tidak ada emoji sebagai ikon.**
- Semua bunyi memakai WebAudio — tidak ada aset audio yang perlu diunduh.

## Yang belum ada (jangan dianggap selesai)

- **Login per peran** (`pengguna_internal.pin_hash` sudah ada kolomnya, alur
  masuknya belum). Portal staf saat ini terbuka bagi siapa pun yang tahu
  alamatnya. `/order/masuk` menyatakan ini terang-terangan, bukan menampilkan
  formulir sandi palsu.
- Pindah meja, batal pesanan oleh kasir + log, tandai menu habis dari kasir.
- Struk belum memuat alamat kafe.
- Pengaturan pajak/layanan masih lewat database; halaman admin hanya
  menampilkannya.

## Menguji

Alat uji ada di `/home/user/uji` (di luar repo):

- `alur.js` — 47 pemeriksaan API + screenshot semua portal.
- `pelanggan.js` — uji UI: tambah ke keranjang, kirim, ukur jeda status.
- `responsif.js` — screenshot 390 px, 430 px, 820 px, 1100 px.

```bash
cd /home/user/uji
LD_LIBRARY_PATH=/tmp/chrom/lib/lib node alur.js
```

Kalau `/tmp/chrom` hilang (tidak persist antar sesi), ekstrak ulang dari
tarball `@sparticuz/chromium`.
