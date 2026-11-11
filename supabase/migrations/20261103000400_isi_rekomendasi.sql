-- Isi awal tanda rekomendasi: satu menu unggulan per kategori.
--
-- Ini titik AWAL, bukan selera akhir. Pemilik bisa mengubahnya sendiri dari
-- /order/admin (tombol bintang) tanpa deploy.
--
-- Dicocokkan lewat NAMA, bukan id: id berbeda antara database dan salinan
-- MENU_CONTOH. Aman dijalankan berulang — baris yang sudah bertanda tidak
-- diubah lagi.

update public.menu set rekomendasi = true
where nama in (
  'Paket Nasi Liwet (Personal)',
  'Tumis Kangkung',
  'Flavoured Latte Panas / Dingin',
  'Mojito Lychee',
  'Cheese Latte',
  'Sundae Ice Cream'
);
