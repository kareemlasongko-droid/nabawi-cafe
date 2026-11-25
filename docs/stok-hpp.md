# Stok bahan & HPP

Dokumen ini menjelaskan **kenapa** fitur ini berbentuk begini, bukan hanya
apa yang ada di layar. Bagian yang benar-benar harus dibaca sebelum dipakai:
[§4 titik potong stok](#4-titik-potong-stok-satu-satunya) dan
[§7 batas yang jujur](#7-batas-yang-jujur).

---

## 1. Bentuk datanya

Enam tabel baru, semuanya **aditif** — tidak ada satu pun tabel lama yang
diubah kolomnya:

| Tabel | Isi |
|---|---|
| `bahan` | bahan baku, satuan dasar, harga rata-rata, stok minimum |
| `resep_menu` | bahan per **satu porsi** menu |
| `gerakan_stok` | buku besar: satu baris per perubahan stok |
| `pembelian` + `pembelian_item` | nota supplier |
| `hpp_pesanan` | HPP **terkunci** per baris pesanan |

Database ini dipakai bersama aplikasi lain (`reservations`, `units`,
`tour_venues`). Karena itu fitur ini tidak menambah kolom ke `menu`,
`pesanan`, atau `tagihan` sama sekali. Kalau suatu saat dibuang, cukup
`DROP` enam tabel di atas — tidak ada sisa di jalur pesanan.

**Tidak ada kolom "stok sekarang".** Saldo = `SUM(gerakan_stok.jumlah)`.
Satu kolom saldo yang bisa ditulis langsung akan, cepat atau lambat,
berbeda dari riwayatnya — dan saat itu terjadi tidak ada cara mengetahui
mana yang benar.

---

## 2. Rumus yang dipakai

Semua rumus ada di `app/lib/order/hpp.ts` sebagai fungsi murni, dan diuji
di `npm run uji:hpp` (44 cek). Yang penting:

**Harga rata-rata bergerak**

```
harga_baru = (stok_lama × harga_lama + masuk × harga_masuk) / (stok_lama + masuk)
```

Dibulatkan ke rupiah bulat. Kalau `stok_lama ≤ 0`, harga lama **dibuang**
dan harga mengikuti pembelian terakhir — karena stok negatif berarti
catatan belum lengkap, dan harga lama dari periode itu tidak mewakili
apa pun.

**HPP satu porsi** = Σ (jumlah bahan × harga satuan bahan), dijumlah dari
**nilai per baris yang sudah dibulatkan** — bukan dari total mentah. Ini
membuat HPP pesanan selalu sama persis dengan jumlah baris di buku besar
stok, sehingga bisa dicocokkan manual tanpa selisih 1 rupiah.

**Opname** dihitung dari angka **fisik**, bukan selisih. Pengguna mengetik
"tinggal 2,5 kg"; sistem menghitung selisihnya. Selisih boleh positif
(ternyata lebih banyak) maupun negatif (susut).

---

## 3. Kenapa HPP dikunci, bukan dihitung ulang

`hpp_pesanan.hpp_satuan` adalah **hasil rekaman**. Harga cabai berubah;
kalau HPP bulan lalu dihitung ulang dengan harga hari ini, laba bulan lalu
ikut berubah. Laporan yang bisa berubah sendiri tidak bisa dipakai
mengambil keputusan.

Karena itu setiap pemakaian menyimpan `harga_satuan` saat kejadian, dan
`gerakan_stok.nilai` ikut menyimpannya.

---

## 4. Titik potong stok — satu-satunya

Stok dipotong **saat pesanan lunas**, di dua tempat:

| Jalur | Berkas | Fungsi |
|---|---|---|
| Bayar online (DOKU) | `app/lib/order/doku.ts` | `tandaiLunas()` → `potongStokPesanan()` |
| Bayar tunai di kasir | `app/lib/order/data.ts` | `bayarTunaiKasir()` → `potongStokPesanan()` |

**Tidak** dipotong saat pesanan dibuat. Alasannya: pesanan yang ditolak
kasir atau kedaluwarsa tidak pernah menghasilkan makanan. Kalau stok
dipotong di awal, setiap pesanan yang gagal meninggalkan bahan yang
"hilang" dan harus dikembalikan — pembalikan yang mudah lupa dan sulit
diaudit.

**Idempoten.** `hpp_pesanan` punya `UNIQUE (item_id)`. Notifikasi DOKU
ganda, atau kasir menekan tombol bayar dua kali, tidak memotong stok dua
kali.

**Kegagalan tidak membatalkan pembayaran.** Uang sudah diterima. Kalau
pemotongan stok gagal, kegagalannya dicatat di log server dan pembayaran
tetap sah. Membalikkan respons di sini akan membuat kasir menagih tamu dua
kali.

**Urutan di dalam `potongStokPesanan`:**
1. HPP ditulis dulu (kalau gagal → berhenti, stok tidak bergerak)
2. Gerakan stok ditulis kedua

Urutan ini disengaja: HPP tanpa gerakan stok hanya membuat stok terlihat
lebih banyak dari kenyataan (bisa dikoreksi lewat opname). Gerakan stok
tanpa HPP membuat laporan laba kehilangan biaya — lebih berbahaya karena
tidak terlihat.

---

## 5. Hirarki layar

Tab **Stok** di portal admin punya empat bagian, urutannya mengikuti cara
kerja:

```
Bahan  → apa yang ada di gudang, mana yang perlu dipesan
Resep  → apa yang dipakai satu porsi (menentukan HPP)
Catat  → pembelian supplier, opname, bahan dibuang
HPP    → laba kotor per menu & per hari
```

Bahan harus ada sebelum resep bisa menyebutnya, dan HPP baru bermakna
setelah keduanya terisi.

**Bahan yang belum pernah dicatat stoknya tampil "belum dicatat", bukan
"habis".** Saldo 0 karena belum ada pembelian berbeda dari saldo 0 karena
deterjen benar-benar habis. Pembedanya adalah ada/tidaknya gerakan stok
untuk bahan itu. Di layar, keduanya dipisah: "Perlu dipesan" hanya berisi
yang kritis/habis, sedangkan "Stok belum dicatat" berisi yang saldonya
belum diketahui. Keduanya tetap masuk daftar kerja, tetapi peringatan merah
tidak boleh menyala untuk seratus bahan pada hari pertama.

**Tidak ada input harga bahan langsung.** Harga hanya berubah lewat
pembelian, karena hanya pembelian yang menyimpan alasan perubahan
(supplier, tanggal, jumlah). Menyediakan input harga akan membuat HPP lama
berbeda dari harga sekarang tanpa dokumen yang menjelaskan sebabnya.

---

## 6. Yang membuat angka HPP bisa dipercaya

`resep_menu.perkiraan` menandai resep yang **diisi sistem**, bukan oleh
dapur. Ini kolom paling penting di fitur ini.

HPP dari resep perkiraan tetap dihitung, tetapi:
- ditandai di layar sebagai "perkiraan";
- tidak boleh dipakai menaikkan harga menu tanpa dicocokkan dulu.

Saat resep disimpan lewat layar admin, `perkiraan` diset `false` — resep
yang diketik manusia dianggap sudah diverifikasi.

Resep perkiraan untuk seluruh 126 menu diisi `scripts/seed/resep-perkiraan.mjs`.
Skrip itu **menimpa** resep yang sudah ada (upsert `menu_id,bahan_id`), bukan
melewatinya — kalau ia melewati, memperbaiki rumus lalu menjalankan ulang
tidak mengubah apa pun. Profil hidangannya dipilih dari nama menu, bukan
dari kategori: kategori pernah membuat "Spaghetti Carbonara" mendapat 150 g
beras dan "Mix Platter" mendapat HPP susu karena mengandung "pLATTE".

`hpp_pesanan.lengkap = false` berarti ada bahan tanpa harga. HPP-nya tetap
dicatat tetapi ditandai; laporan harian menampilkan berapa rupiah dari
total yang berasal dari baris tidak lengkap, supaya laba tidak terbaca
lebih besar daripada kenyataan.

---

## 7. Batas yang jujur

Yang **tidak** dilakukan sistem ini, dan sebaiknya diketahui sebelum
dipakai:

1. **HPP hanya biaya bahan.** Tidak ada tenaga kerja, listrik, sewa,
   penyusutan, atau biaya kemasan. Karena itu labelnya **laba kotor**,
   bukan laba bersih.
2. **Tidak ada konversi satuan.** Satu bahan ditulis dalam satu satuan
   (harga per gram, bukan per kilo). Kalau dibeli per kilo, isi harga
   per gram saat mencatat pembelian.
3. **Tidak ada multi-gudang.** Satu saldo per bahan.
4. **Pembelian tidak terhubung ke kas/bank.** `pembelian.dibayar` hanya
   penanda, bukan jurnal keuangan.
5. **Resep per porsi, bukan per batch.** Kalau satu menu dimasak sekaligus
   20 porsi dan bahannya ditimbang per batch, bagi dulu angka bahannya
   dengan 20 saat mengisi resep.
6. **Tidak ada transaksi database.** PostgREST tidak mendukungnya. Setiap
   operasi multi-langkah (pembelian, simpan resep) menulis dokumen lebih
   dulu, lalu detailnya — sehingga kegagalan di tengah meninggalkan
   dokumen tanpa efek samping, bukan efek samping tanpa dokumen.

---

## 8. Cara menguji

```bash
npm run uji:hpp          # 44 cek rumus, tanpa server
npm run uji:hpp:http     # cek rute + alur, butuh server & mock PostgREST
```

`uji:hpp` menguji aritmetikanya: pembulatan, stok minus, bahan tanpa
harga, penggabungan bahan dari dua menu, dan margin dari omzet nol.

`uji:hpp:http` menguji bahwa stok benar-benar bergerak lewat alur
pembayaran sungguhan — termasuk memastikan **menandai lunas dua kali tidak
memotong stok dua kali**.
