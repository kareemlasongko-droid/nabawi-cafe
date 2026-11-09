# Menu Nabawi Cafe

Daftar menu yang dipakai aplikasi, diambil dari dokumen pemilik cafe
`daftar_menu_lengkap_nabawi_cafe.txt`. **Nama dan harga tidak boleh diubah
sepihak di kode** — kalau cafe menaikkan harga, ubah di sini dan di database,
lalu jalankan ulang migrasinya.

| Jumlah | Nilai |
|---|---|
| Kategori | 18 |
| Item menu | 126 |
| Total harga seluruh item | Rp5.394.000 |
| Harga termurah | Rp10.000 (`Mini Croffle Original`, `Black Tea Panas`, `Mineral Bottle`) |
| Harga termahal | Rp375.000 (`Nasi Liwet Kastrol 4 Pax`) |

## Cara memasukkan ke database

Berkas `supabase/migrations/20261102000000_menu_nabawi.sql` berisi seluruh
data ini. Jalankan di Supabase → SQL Editor. Aman dijalankan berulang:
kategori dan menu dicocokkan lewat **nama**, jadi tidak menggandakan data.

Migrasi itu juga membuat `menu.nama` **unik**. Tanpa aturan itu, dua hidangan
bernama sama bisa masuk dengan harga berbeda dan pesanan bisa tertukar harga —
persis masalah yang muncul saat penanda (Hot)/(Iced) dibuang dari nama minuman.

## Catatan penamaan

Penanda **Hot/Iced** di dokumen asli jadi akhiran **Panas/Dingin**, karena
keduanya dijual dengan harga berbeda (mis. Cappuccino Panas Rp30.000 vs
Cappuccino Dingin Rp32.000). Tanpa akhiran itu, 13 nama menjadi kembar.

Beberapa sub-grup dokumen digabung ke satu kategori:

| Sub-grup di dokumen | Kategori di aplikasi |
|---|---|
| SIGNATURE COFFEE + REGULAR COFFEE | Kopi |
| SIGNATURE ICED COFFEE | Kopi |
| ALTERNATIVE DRINKS | Teh & Coklat |
| SNACKS | Camilan |
| ADDITIONS | Lauk & Sayur |
| MINUMAN SIGNATURE ICED | Minuman Signature |

`Mineral Bottle` (air mineral botol) diletakkan di **Jus Segar**, bukan di
Teh & Coklat, supaya tidak tercampur dengan minuman teh.

---

## 1. Nasi & Rice Bowl (8 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Nasi Goreng Kebuli | Rp40.000 | — |
| 2 | Nasi Goreng Oriental | Rp40.000 | — |
| 3 | Rice Bowl Chicken | Rp50.000 | Pilihan rasa: Sambal Matah, BBQ, Gravy, Salted Egg. |
| 4 | Paket Nasi Liwet (Personal) | Rp85.000 | Paket personal. Termasuk ayam, tempe, tahu, ikan asin, lalap, sayur asem, sambal. |
| 5 | Nasi Liwet Kastrol 2 Pax | Rp188.000 | Paket untuk 2 orang. Termasuk ayam, tempe, tahu, ikan asin, lalap, sayur asem, sambal. |
| 6 | Nasi Liwet Kastrol 4 Pax | Rp375.000 | Paket untuk 4 orang. Termasuk ayam, tempe, tahu, ikan asin, lalap, sayur asem, sambal. |
| 7 | Nasi Liwet (Porsi Nasi Saja) | Rp15.000 | — |
| 8 | Nasi Putih | Rp12.000 | — |

## 2. Ayam (3 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Ayam Balado | Rp62.000 | — |
| 2 | Ayam Goreng Mentega | Rp58.000 | — |
| 3 | Ayam Goreng Bawang Putih | Rp58.000 | — |

## 3. Sapi & Iga (4 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Sop Iga | Rp80.000 | — |
| 2 | Sop Iga Bakar | Rp90.000 | — |
| 3 | Daging Sapi Mercon | Rp70.000 | — |
| 4 | Daging Sapi Teriyaki | Rp75.000 | — |

## 4. Udang (3 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Udang Goreng Tepung | Rp65.000 | — |
| 2 | Udang Balado | Rp75.000 | — |
| 3 | Udang Asam Manis | Rp67.000 | — |

## 5. Ikan (3 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Gurame Bakar Minang | Rp145.000 | — |
| 2 | Gurame Bakar Kecap | Rp130.000 | — |
| 3 | Gurame Pecak | Rp136.000 | — |

## 6. Steak (2 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Wagyu Meltique | Rp130.000 | Pilihan saus: Mushroom, BBQ, Black Pepper. |
| 2 | Crispy Chicken Steak | Rp55.000 | Pilihan saus: Mushroom, BBQ, Black Pepper. |

## 7. Burger (2 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Crispy Chicken Burger | Rp55.000 | — |
| 2 | Beef Burger | Rp65.000 | — |

## 8. Pasta (3 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Spaghetti Carbonara | Rp50.000 | — |
| 2 | Spaghetti Bolognese | Rp50.000 | — |
| 3 | Spaghetti Aglio Olio Tuna | Rp50.000 | — |

## 9. Lauk & Sayur (6 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Tumis Kangkung | Rp25.000 | — |
| 2 | Karedok | Rp30.000 | — |
| 3 | Lotek | Rp30.000 | — |
| 4 | Sayur Asem | Rp20.000 | — |
| 5 | Jengkol / Pete Asin Balado | Rp50.000 | — |
| 6 | Telor Barendo | Rp20.000 | — |

## 10. Camilan (13 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Mix Platter (Sosis, Kentang, Onion Ring) | Rp65.000 | — |
| 2 | Chicken Bite | Rp35.000 | — |
| 3 | Cireng Isi Ayam Mozarella | Rp30.000 | — |
| 4 | Tahu Isi | Rp30.000 | — |
| 5 | Singkong Goreng Original | Rp25.000 | — |
| 6 | Singkong Goreng Keju | Rp30.000 | — |
| 7 | Pisang Goreng Original | Rp25.000 | — |
| 8 | Pisang Goreng Keju / Coklat | Rp30.000 | — |
| 9 | Bakwan Sayur | Rp25.000 | — |
| 10 | Bakwan Jagung | Rp25.000 | — |
| 11 | Tempe Mendoan | Rp25.000 | — |
| 12 | French Fries | Rp25.000 | — |
| 13 | Onion Ring | Rp25.000 | — |

## 11. Pastry (8 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Mini Croffle Original | Rp10.000 | — |
| 2 | Mini Croffle (Choco / Cheese) | Rp15.000 | — |
| 3 | Choco Soft Cookie | Rp23.000 | — |
| 4 | Fudgy Brownies | Rp23.000 | — |
| 5 | Almond Croissant Original | Rp25.000 | — |
| 6 | Almond Croissant (Choco / Cheese) | Rp35.000 | — |
| 7 | Cinnamon Roll Original | Rp23.000 | — |
| 8 | Cinnamon Roll (Choco / Cheese) | Rp33.000 | — |

## 12. Dessert (3 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Sundae Ice Cream | Rp29.000 | — |
| 2 | Banana Split | Rp37.000 | — |
| 3 | Additional +1 Scoop Ice Cream | Rp15.000 | Tambahan satu scoop es krim. |

## 13. Kopi (24 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Flavoured Latte Panas / Dingin | Rp35.000 | Pilihan rasa: Vanilla, Caramel, Hazelnut, Rum, Banana, Cotton Candy, Butter Scotch. |
| 2 | Banana Irish Cream Dingin | Rp35.000 | — |
| 3 | Tiramisu Latte Dingin | Rp35.000 | — |
| 4 | Irish Cream Latte Dingin | Rp35.000 | — |
| 5 | Jamaican Mocha Dingin | Rp35.000 | — |
| 6 | Tropical On The Rock Dingin | Rp35.000 | — |
| 7 | Avocado Coffee Dingin | Rp35.000 | — |
| 8 | Cold Brew Martini Dingin | Rp35.000 | — |
| 9 | Kopi Susu Nabawi Panas / Dingin | Rp37.000 | — |
| 10 | Mocca Latte Panas | Rp33.000 | — |
| 11 | Mocca Latte Dingin | Rp36.000 | — |
| 12 | Coffee Latte Panas | Rp30.000 | — |
| 13 | Coffee Latte Dingin | Rp32.000 | — |
| 14 | Cappuccino Panas | Rp30.000 | — |
| 15 | Cappuccino Dingin | Rp32.000 | — |
| 16 | Manual Brew Panas | Rp30.000 | — |
| 17 | Manual Brew Dingin | Rp32.000 | — |
| 18 | Piccolo | Rp29.000 | — |
| 19 | Long Black Panas | Rp26.000 | — |
| 20 | Long Black Dingin | Rp28.000 | — |
| 21 | Americano Panas | Rp26.000 | — |
| 22 | Americano Dingin | Rp28.000 | — |
| 23 | Espresso (Single Shot) | Rp26.000 | Satu shot. |
| 24 | Espresso (Double Shot) | Rp28.000 | Dua shot. |

## 14. Minuman Signature (9 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Happy Puppy | Rp47.000 | — |
| 2 | Mojito Lychee | Rp37.000 | — |
| 3 | Mojito Strawberry | Rp37.000 | — |
| 4 | Strawberry Candy | Rp37.000 | — |
| 5 | Blue Pororo | Rp35.000 | — |
| 6 | Kiwi Hime | Rp35.000 | — |
| 7 | Sunset Paradise | Rp35.000 | — |
| 8 | Verde Island | Rp35.000 | — |
| 9 | Yellow Breeze | Rp35.000 | — |

## 15. Cheese Series (7 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Cheese Latte | Rp40.000 | — |
| 2 | Matcha Cheese | Rp40.000 | — |
| 3 | Choco Cheese | Rp40.000 | — |
| 4 | Strawberry Cheese | Rp40.000 | — |
| 5 | Taro Cheese | Rp40.000 | — |
| 6 | Red Velvet Cheese | Rp40.000 | — |
| 7 | Cheese Tea | Rp30.000 | — |

## 16. Teh & Coklat (19 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Red Velvet Latte Panas | Rp35.000 | — |
| 2 | Red Velvet Latte Dingin | Rp37.000 | — |
| 3 | Matcha Latte Panas | Rp35.000 | — |
| 4 | Matcha Latte Dingin | Rp37.000 | — |
| 5 | Taro Latte Panas | Rp35.000 | — |
| 6 | Taro Latte Dingin | Rp37.000 | — |
| 7 | Klepon Latte | Rp35.000 | — |
| 8 | Chocolate Panas | Rp33.000 | — |
| 9 | Chocolate Dingin | Rp35.000 | — |
| 10 | Lychee Tea Dingin | Rp27.000 | — |
| 11 | Lemon Tea Panas | Rp25.000 | — |
| 12 | Lemon Tea Dingin | Rp26.000 | — |
| 13 | Ginger Tea | Rp25.000 | — |
| 14 | Strawberry Tea Dingin | Rp25.000 | — |
| 15 | Sweet Black Tea Panas | Rp17.000 | — |
| 16 | Sweet Black Tea Dingin | Rp18.000 | — |
| 17 | Black Tea Panas | Rp10.000 | — |
| 18 | Black Tea Dingin | Rp12.000 | — |
| 19 | Mineral Bottle | Rp10.000 | Air mineral botol. |

## 17. Milkshake (4 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Strawberry Milkshake | Rp40.000 | — |
| 2 | Chocolate Milkshake | Rp40.000 | — |
| 3 | Vanilla Milkshake | Rp40.000 | — |
| 4 | Oreo Milkshake | Rp40.000 | — |

## 18. Jus Segar (5 item)

| # | Menu | Harga | Keterangan |
|---|---|---|---|
| 1 | Mango Juice | Rp30.000 | — |
| 2 | Avocado Juice | Rp30.000 | — |
| 3 | Sirsak Juice | Rp30.000 | — |
| 4 | Dragon Fruit Juice | Rp30.000 | — |
| 5 | Orange Juice | Rp25.000 | — |

