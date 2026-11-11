# Desain portal staf — palet B

Catatan ini menjelaskan **apa yang berubah, mengapa, dan angka apa yang dipakai**.
Tujuannya bukan dokumentasi gaya, tetapi supaya perubahan berikutnya tidak
membalikkan keputusan yang sudah dihitung.

## Ruang lingkup

| Portal | Latar | Palet |
|---|---|---|
| Pelanggan (`/order`) | terang | B — putih bersih (`bersih-*`, `tinta-*`, `aksi-*`) |
| Kasir (`/order/kasir`) | terang | B |
| Pelayan (`/order/pelayan`) | terang | B |
| Admin (`/order/admin`) | terang | B |
| Dapur (`/order/dapur`) | **gelap** | tinta gelap (`tinta-900/800`, `gelap-*`, `aksi-terang`) |

Dapur tetap gelap dengan sengaja. Layar dapur menyala sepanjang hari di area
yang tidak selalu terang; latar gelap mengurangi silau dan membuat nomor meja
jadi hal paling terang di layar. Itu keputusan yang sudah ada sejak awal dan
tidak dibatalkan oleh perubahan warna.

## Satu skala huruf

Sebelum: tujuh ukuran berbeda antarportal (9–15 px), ditambah ukuran lain lagi
di portal pelanggan. Sekarang satu skala untuk keenam berkas:

| Ukuran | Dipakai untuk |
|---|---|
| 11 px | label kecil, satuan, kode pesanan |
| 13 px | teks pendukung, keterangan |
| 15 px | teks isi, tombol |
| 17 px | judul bagian, nama menu |
| 18–19 px | kepala halaman |
| 30 px | nominal pembayaran (paling besar, memang harus) |

## Satu sistem bentuk

- **Kartu 14 px** (`rounded-[0.875rem]`): panel, tabel, baris daftar.
- **Kontrol 10 px** (`rounded-[0.625rem]`): tombol, isian, kartu meja.
- **Pil penuh**: chip status, lencana hitungan.

Garis tepi kelabu dihapus dari kartu. Pemisah permukaan memakai bayangan ganda
tipis di portal terang:

```
shadow-[0_1px_2px_rgba(22,19,15,0.04),0_6px_16px_-10px_rgba(22,19,15,0.16)]
```

Garis **tetap** dipakai di tiga tempat, karena di sana bayangan tidak bekerja:
1. pemisah baris di dalam kartu (tabel, daftar item),
2. isian dan tombol bergaris (batas kontrol harus jelas saat difokus),
3. struk kertas — garis putus-putus adalah bahasanya, bukan hiasan.

## Warna dan kontras

Semua pasangan teks/latar dihitung, bukan dikira-kira. Nilai minimum yang
dipakai adalah 4.5:1 (WCAG AA untuk teks normal).

| Pasangan | Rasio |
|---|---|
| `tinta-900` di `bersih-0` | 18.5:1 |
| `tinta-700` di `bersih-0` | 9.6:1 |
| `tinta-500` di `bersih-0` | 5.6:1 |
| `tinta-500` di `bersih-100` | 4.9:1 |
| putih di `tinta-900` | 18.5:1 |
| putih di `aksi-500` | 4.5:1 |
| `aksi-700` di `bersih-100` (label oranye) | 6.1:1 |
| `clay-800` di `tanah-100` (chip bahaya) | 8.0:1 |
| `forest-700` di `daun-100` (chip siap) | 6.7:1 |
| `gelap-isi` di `tinta-800` (dapur) | 13.1:1 |
| `gelap-samar` di `tinta-800` (dapur) | 5.4:1 |

Tiga warna **tidak boleh** dipakai sebagai teks, hanya sebagai latar:

| Warna | Kenapa |
|---|---|
| `aksi-500` `#c9500a` | 3.98:1 di `bersih-100` — gagal sebagai teks |
| `accent-500` `#ff7c32` | 2.57:1 dengan teks putih — gagal parah |
| `tinta-500` `#8a8078` (nilai lama) | 3.86:1 — sudah diganti `#6f665c` |

## Tiga kesalahan yang ditemukan saat pengukuran

Dicatat supaya tidak terulang:

1. **Sapuan warna massal membuat isian kehilangan garis tepi.** Pola
   `border border-<garis>` diganti bayangan tanpa pandang bulu, sehingga
   `<input>` dan `<select>` di dialog pembayaran dan admin ikut jadi "kartu
   tanpa tepi". Diperbaiki dengan mengembalikan garis pada 17 elemen kontrol.
2. **Kartu dapur jadi lebih samar daripada desain lama.** `tinta-800` versi
   pertama (`#221d17`) hanya 1.11:1 dari latar, sedangkan tiket lama 1.20:1 —
   artinya "pembaruan" justru menurunkan keterbacaan. Diganti `#2e2822`
   (1.27:1).
3. **Teks ketiga di dapur gagal AA** setelah permukaan dinaikkan (4.15:1).
   `gelap-samar` dinaikkan ke `#a49c92` → 5.4:1.

## Kepala portal: satu baris, dua kelompok

Kelima portal memakai pola kepala yang sama: **identitas kafe menempel kiri,
alat layar menempel kanan**, dipisah oleh `justify-between` — bukan oleh garis
tegak, bukan oleh `flex-1` pada satu sisi.

```
(logo) Nabawi Cafe · Kasir · 0        [bunyi] [muat ulang]
(logo) Nabawi Cafe · Pelayan · 0 siap                 [bunyi]
(logo) Nabawi Cafe                        [meja 3] [Panggil] [Bill]
```

### Angka yang mengatur penyusutan

Diukur dari metrik Plus Jakarta Sans (bobot 800 untuk nama, 400 untuk
keterangan), bukan dikira-kira. Di ponsel 360px ruang isi hanya **336px**
(portal dapur 344px karena padding-nya 8px).

| Kepala | Di ponsel | Sisa |
|---|---|---|
| Kasir | identitas 178 + dua tombol ikon 70 | 80px |
| Dapur | identitas 186 + tiga tombol ikon 116 | 34px |
| Pelayan | identitas 235 + tombol bunyi 40 | 53px |
| Admin | identitas 206 + dua tab 112 | 10px |
| Pelanggan | identitas 131 + meja/Panggil/Bill 195 | 10px |

Di tablet semuanya kembali penuh: "& Resto", nama layar panjang, dan keterangan
tiga angka. Yang dipendekkan di ponsel, berurutan sesuai prioritas:

1. **Label tombol** → ikon saja, dengan `aria-label` (tombol tetap 40px).
2. **Keterangan** → satu angka (`keteranganPonsel`), mis. "0" atau "126".
3. **"& Resto"** dan label panjang ("Dapur & Bar" → "Dapur",
   "Pajak & layanan" → "Pajak").
4. **Nama layar tidak pernah hilang** — ia yang membedakan tablet kasir dari
   tablet dapur, dan hanya butuh 37–48px.

Portal pelanggan memakai `ringkas`: hanya "Nabawi Cafe", tanpa keterangan,
karena di sana ruangnya dipakai kotak meja dan dua tombol. Label "Panggil" dan
"Bill" **tidak** disembunyikan — tamu tidak akan tahu arti ikon lonceng dan
kertas, sedangkan pelayan/kasir sudah dilatih.

### Tinggi di portal pelanggan

Logo (28px), kotak meja, dan kedua tombol sama-sama **40px**. Tiga tinggi
berbeda di satu garis — 20/28/40 — terbaca sebagai elemen yang kebetulan
berdekatan, bukan satu bilah. Logo tetap 28px agar cincinnya tajam; yang
setinggi 40px adalah kotak pembungkusnya (`setinggiKontrol`).

Kotak meja juga memakai **bentuk yang sama** dengan tombol: ikon 16px + teks
13px, `px-2`, `gap-1`. Kotak 40x40 berisi angka 17px adalah satu-satunya
elemen tanpa ikon dan satu-satunya yang hurufnya lebih besar — ia terbaca
sebagai hiasan. Bedanya dengan tombol hanya pada warna: latar `tinta-900`
penuh, tanpa `hover`/`active`, karena nomor meja tidak bisa ditekan.

Isinya **"Meja 3"**, bukan "3". Angka tanpa satuan tidak berarti apa pun bagi
tamu yang baru duduk — bisa dibaca nomor pesanan atau jumlah item.

Warna "Meja" dan angka **sama** (`text-bersih-0`, diwarisi dari kotak).
Versi pertama meredupkan "Meja" ke 70% untuk menonjolkan angka; hasilnya
terbaca sebagai dua informasi berbeda dalam satu kotak, padahal "Meja 3"
adalah satu hal. Yang membedakan sekarang hanya bobot huruf: angka `font-bold`,
"Meja" biasa. Area meja tetap hanya di `title` + teks pembaca layar
(`sr-only`), karena ia mengulang isi kotak dan panjangnya (seperti "teras
lantai 2") akan mendorong tombol keluar layar.

Kotak ini kini **78px** (dari 44px). Di 360px sisa ruang tinggal 10px, jadi
dua penyesuaian ikut: jarak antar kelompok 12 → 8px, dan ikon di dalam tombol
Panggil/Bill baru muncul mulai **414px** (dua ikon butuh 40px; di 390px itu
berarti sisa 0px, tanpa cadangan untuk huruf perangkat yang diperbesar).

Konsekuensinya lebar bertambah 32px, jadi dua penyesuaian ikut masuk: ikon di
dalam tombol hanya muncul mulai **390px** (di bawah itu label teks saja), dan
padding tombol naik 2px di lebar yang sama. Di 375px, dua ikon menyisakan 2px
— terlalu mepet untuk teks yang bisa membesar saat huruf perangkat dinaikkan.

### Kenapa tidak ada `flex-wrap`

Kepala yang membungkus ke baris kedua menambah 40px tinggi dan, di dapur,
berarti satu tiket lebih sedikit yang terlihat. Karena itu tidak ada
`flex-wrap` di kepala mana pun, dan `min-w-0` dipasang di tiap tingkat flex
supaya yang menyusut adalah teks, bukan tombol.

Dijaga oleh `node scripts/uji/kepala-portal.mjs` (32 pemeriksaan).

## Yang sengaja TIDAK dilakukan

- Tidak ada gradien, bayangan tebal, animasi denyut, atau blob blur.
- Tidak ada emoji sebagai ikon — semua ikon adalah SVG di `Ikon.tsx`.
- Tidak ada warna status baru yang generik (merah/hijau Tailwind). Dua tint
  status (`tanah-100`, `daun-100`) ditarik ke arah terracotta dan hijau hutan
  yang sudah menjadi warna merek.

## Uji

```bash
npm start                            # terminal lain
node scripts/uji/regresi.mjs         # alur order ujung ke ujung
node scripts/uji/pilihan.mjs         # pilihan sambal/saus/rasa
node scripts/uji/kepala-portal.mjs   # tata letak kepala portal
```

Hasil terakhir: **22/22**, **11/11**, dan **32/32**.

Skrip uji disimpan di `scripts/uji/` — bukan di `/tmp` — karena sandbox kerja
pernah ter-reset dan skrip uji di `/tmp` ikut hilang. Saat itu terjadi, "uji
hijau" berubah jadi asumsi.
