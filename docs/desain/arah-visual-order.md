# Arah visual portal order — "hijau hutan & krem hangat"

Catatan ini menjelaskan **keputusan warna dan bentuk yang berlaku sekarang**
untuk kelima portal order, beserta alasan dan angka kontrasnya. Dokumen
`portal-staf.md` tetap disimpan sebagai riwayat arah sebelumnya (palet B,
putih bersih) — yang berlaku adalah berkas ini.

Mockup acuan: `docs/desain/referensi-arah.png`.

## Ringkasan yang berubah

| Portal | Sebelum | Sekarang |
|---|---|---|
| Pelanggan `/order` | putih bersih | latar krem, kepala krem transparan, bilah keranjang hijau hutan |
| Kasir `/order/kasir` | putih bersih | latar krem, kepala **hijau hutan** |
| Admin `/order/admin` | putih bersih | latar krem, kepala **hijau hutan** |
| Dapur `/order/dapur` | hitam keabu-abuan | **hijau hutan paling gelap**, tiket berjenjang hijau → oranye |
| Pelayan `/order/pelayan` | putih bersih | latar krem, kartu putih bergaris tipis |

Kepala staf (kasir, dapur, admin) sengaja **hijau hutan gelap**, kepala tamu
(pelanggan, pelayan) tetap terang. Satu perbedaan ini membuat orang langsung
tahu apakah ia sedang memegang layar staf atau layar tamu — tanpa membaca
satu kata pun.

## Satu keluarga warna

| Peran | Token | Nilai | Dipakai untuk |
|---|---|---|---|
| Permukaan halaman | `cream-50` | `#fffdf8` | latar semua portal terang |
| Permukaan kartu | `bersih-0` | `#ffffff` | kartu, dialog, tabel |
| Identitas / aksi utama | `forest-900` | `#1b3325` | kepala staf, tombol utama, badge meja |
| Permukaan terangkat | `forest-800` | `#22402e` | kartu tiket dapur, hover tombol utama |
| Urgensi ringan | `forest-700` | `#2f5a3c` | tiket dapur yang mulai menua |
| Teks utama | `tinta-900` | `#16130f` | judul, harga |
| Teks pendukung | `tinta-500` | `#6f665c` | keterangan |
| Perhatian / uang belum masuk | `sela-700` | `#c9500a` | tombol "Habis", tiket terlambat |
| Perhatian (latar) | `sela-50/100` | `#fff4ec` / `#ffe6d5` | pita galat, chip peringatan |
| Perhatian (teks) | `sela-800` | `#a33f06` | teks di atas latar sela |
| Selesai / lunas | `daun-100` | `#e8eee7` | chip "lunas", kartu "diterima" |

**Oranye adalah warna harga dan perhatian, bukan warna tombol utama.** Tombol
utama memakai hijau hutan; oranye muncul di tempat yang memang menuntut mata:
nominal uang, chip "habis", tiket yang terlambat, pita galat.

## Tiga kelas tombol

Semua tombol portal order memakai salah satu dari tiga utilitas di
`app/globals.css` — tidak ada lagi tombol yang menulis latar dan warnanya
sendiri-sendiri.

| Utilitas | Tampilan | Kapan |
|---|---|---|
| `tombol-utama` | `forest-900` + `cream-50`, tebal, radius 10px | aksi yang menyelesaikan pekerjaan: Kirim pesanan, Terima pembayaran, Simpan, Cetak QR |
| `tombol-aksen` | `sela-700` + putih | hanya di layar gelap atau aksi beli — 4,53:1 |
| `tombol-tenang` | transparan + garis tipis `bersih-300` | aksi kedua: Muat ulang, Lihat semua, Cetak / PDF |

Alasan `tombol-utama` memakai hijau, bukan oranye: oranye `#ff7c32` hanya
2,57:1 dengan teks putih — gagal telak. `#c9500a` lolos (4,53:1) tetapi
sebagai latar tombol ia bersaing dengan harga di layar yang sama. Hijau hutan
memberi 13,35:1 dan menyisakan oranye untuk hal yang benar-benar mendesak.

## Kontras yang diukur (WCAG AA = 4,5:1)

| Pasangan | Rasio |
|---|---|
| `cream-50` di `forest-900` (tombol utama) | 13,35:1 |
| `forest-900` di `cream-50` (badge meja) | 13,35:1 |
| `gelap-isi` di `forest-950` (latar dapur) | 14,75:1 |
| `gelap-isi` di `forest-800` (kartu tiket) | 10,30:1 |
| `gelap-isi` di `forest-700` (tiket menua) | 7,16:1 |
| `gelap-isi` di `sela-800` (tiket terlambat) | 5,80:1 |
| `gelap-redup` di `forest-800` (judul kolom dapur) | 5,43:1 |
| `gelap-samar` di `forest-800` | 5,13:1 |
| putih di `sela-700` (tombol "Habis") | 4,53:1 |
| `sela-800` di `sela-100` (chip peringatan) | 5,36:1 |
| `sela-800` di `sela-50` (pita galat) | 5,93:1 |

`gelap-samar` dinaikkan dari `#a49c92` ke `#b4ada3` khusus karena panel dapur
kini memakai `forest-800`: nilai lama hanya 4,21:1 di sana dan gagal untuk
teks kecil.

## Papan dapur: tiga tingkat urgensi

Tiket dapur memakai tiga permukaan, bukan tiga warna acak:

| Menit menunggu | Permukaan | Arti |
|---|---|---|
| baru | `forest-800` + garis `cream-50/10` | belum mendesak |
| ≥ 10 menit | `forest-700` + garis `sela-500/80` | perhatikan |
| ≥ 15 menit | `sela-800` penuh | kerjakan sekarang |

Angka menitnya **selalu tercetak** — warna bukan satu-satunya pembawa arti,
karena sebagian orang tidak membedakan hijau dan oranye.

## Yang sengaja tidak diubah

- **Dapur tetap gelap.** Layar dapur menyala sepanjang hari; latar gelap
  mengurangi silau dan membuat nomor meja jadi hal paling terang. Yang
  berubah hanya rona: dari hitam keabu-abuan menjadi hijau hutan.
- **Scrim modal tetap `tinta-900/40`–`/50`.** Tirai gelap netral membuat
  dialog terbaca sebagai lapisan di atas, bukan bagian dari halaman.
- **Struk invoice tetap kertas putih.** Semua kelas `print:*` di
  `LembarInvoice.tsx` tidak disentuh; hanya tombol "Tutup"/"Cetak" yang ikut
  sistem tombol.
- **Kontras dan ukuran huruf** yang sudah ditetapkan di dokumen lama tidak
  diturunkan.

## Verifikasi

```bash
./node_modules/.bin/tsc --noEmit     # 0 galat
npm run build                        # 0 galat
```

Utilitas baru (`tombol-utama`, `tombol-tenang`, `sela-*`, `forest-800`) sudah
dipastikan **keluar sebagai CSS** di `.next/static/css/*.css` — bukan hanya
tertulis di JSX. Ini penting karena Tailwind hanya menghasilkan kelas yang
benar-benar dirujuk.

Suite uji: 17 suite, **560 lulus / 0 gagal**, termasuk `uji:ui`,
`uji:menu`, `uji:alur`, `uji:hpp:http`, dan `uji:riwayat:http`.

> Catatan jujur: tangkapan layar tidak bisa dibuat di sandbox ini (tidak ada
> Chromium dan unduhannya diblokir). Yang diperiksa adalah HTML yang benar-
> benar dikirim server, CSS hasil build, dan kontras yang dihitung dari nilai
> token — bukan kesan visual di peramban sungguhan.
