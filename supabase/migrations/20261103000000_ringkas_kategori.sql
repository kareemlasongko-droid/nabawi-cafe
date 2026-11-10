-- =====================================================================
-- Ringkas kategori menu: 18 -> 6.
--
-- KENAPA
-- Di portal pelanggan, kategori tampil sebagai baris chip yang digeser
-- horizontal. Dengan 18 kategori, lebar total chip ~1.662 px sedangkan
-- layar HP ~390 px: pelanggan harus menggeser lebih dari 4 lebar layar
-- hanya untuk melihat semua pilihan. Dengan 6 kategori, ~749 px (~1,9
-- layar). Semua 126 item tetap ada; hanya pengelompokannya yang berubah.
--
-- PEMBAGIAN
--   Makanan Utama       28  <- Nasi & Rice Bowl, Ayam, Sapi & Iga, Udang,
--                              Ikan, Steak, Burger, Pasta
--   Camilan & Pastry    27  <- Lauk & Sayur, Camilan, Pastry
--   Kopi                24  <- Kopi  (sengaja berdiri sendiri: menu paling
--                              sering dicari; digabung akan jadi 51 item)
--   Non-Kopi            27  <- Minuman Signature, Teh & Coklat
--   Cheese & Milkshake  11  <- Cheese Series, Milkshake
--   Jus & Dessert        9  <- Jus Segar, Dessert
--
-- CATATAN: "Lauk & Sayur" (Tumis Kangkung, Sayur Asem, ...) bukan camilan.
-- Digabung karena hanya 6 item dan merupakan pendamping, bukan tujuan utama.
--
-- Aman dijalankan berulang. Untuk mengembalikan ke 18 kategori, jalankan
-- migrasi 20261102000000_menu_nabawi.sql lagi (idempoten, memetakan ulang
-- setiap menu ke kategori asalnya lewat nama).
-- =====================================================================

-- 1. Kategori baru
INSERT INTO public.kategori_menu (nama, urutan) VALUES
  ('Makanan Utama', 1),
  ('Camilan & Pastry', 2),
  ('Kopi', 3),
  ('Non-Kopi', 4),
  ('Cheese & Milkshake', 5),
  ('Jus & Dessert', 6)
ON CONFLICT (nama) DO UPDATE SET urutan = EXCLUDED.urutan;

-- 2. Pindahkan setiap menu ke kategori barunya
UPDATE public.menu m
SET kategori_id = k.id
FROM (VALUES
  ('Nasi & Rice Bowl', 'Makanan Utama'),
  ('Ayam',             'Makanan Utama'),
  ('Sapi & Iga',       'Makanan Utama'),
  ('Udang',            'Makanan Utama'),
  ('Ikan',             'Makanan Utama'),
  ('Steak',            'Makanan Utama'),
  ('Burger',           'Makanan Utama'),
  ('Pasta',            'Makanan Utama'),
  ('Lauk & Sayur',     'Camilan & Pastry'),
  ('Camilan',          'Camilan & Pastry'),
  ('Pastry',           'Camilan & Pastry'),
  ('Kopi',             'Kopi'),
  ('Minuman Signature','Non-Kopi'),
  ('Teh & Coklat',     'Non-Kopi'),
  ('Cheese Series',    'Cheese & Milkshake'),
  ('Milkshake',        'Cheese & Milkshake'),
  ('Jus Segar',        'Jus & Dessert'),
  ('Dessert',          'Jus & Dessert')
) AS peta(lama, baru)
JOIN public.kategori_menu k ON k.nama = peta.baru
JOIN public.kategori_menu k0 ON k0.nama = peta.lama
WHERE m.kategori_id = k0.id;

-- 3. Hapus kategori lama yang sudah kosong.
--    Menghapus yang masih terpakai akan gagal karena FOREIGN KEY, jadi
--    langkah ini tidak bisa menghapus data yang salah tanpa ketahuan.
DELETE FROM public.kategori_menu
WHERE nama IN (
  'Nasi & Rice Bowl','Ayam','Sapi & Iga','Udang','Ikan','Steak','Burger','Pasta',
  'Lauk & Sayur','Camilan','Pastry','Minuman Signature','Teh & Coklat',
  'Cheese Series','Milkshake','Jus Segar','Dessert'
);
