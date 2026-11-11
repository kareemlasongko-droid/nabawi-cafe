-- =====================================================================
-- Isi pilihan untuk 4 menu yang menyebut pilihan di deskripsinya.
--
-- Harga tambahan di bawah ini CONTOH AWAL dan ditandai jelas. Pemilik
-- harus mengonfirmasi angkanya. Mengubahnya tidak perlu deploy:
--
--   UPDATE public.menu
--   SET pilihan = '[{"nama":"Salted Egg","tambah":8000}]'::jsonb
--   WHERE nama = 'Rice Bowl Chicken';
--
-- Selama tambahan harga masih 0, pelanggan bisa memilih dan dapur tahu
-- saus yang diminta — cacat utamanya sudah tertutup — tetapi cafe belum
-- menagih tambahan yang mungkin seharusnya ditagih.
--
-- Aman dijalankan berulang: nilainya diganti, bukan ditambahkan.
-- =====================================================================

UPDATE public.menu SET pilihan = '[
  {"nama":"Sambal Matah","tambah":0},
  {"nama":"BBQ","tambah":0},
  {"nama":"Gravy","tambah":0},
  {"nama":"Salted Egg","tambah":5000}
]'::jsonb WHERE nama = 'Rice Bowl Chicken';

UPDATE public.menu SET pilihan = '[
  {"nama":"Mushroom","tambah":0},
  {"nama":"BBQ","tambah":0},
  {"nama":"Black Pepper","tambah":0}
]'::jsonb WHERE nama = 'Wagyu Meltique';

UPDATE public.menu SET pilihan = '[
  {"nama":"Mushroom","tambah":0},
  {"nama":"BBQ","tambah":0},
  {"nama":"Black Pepper","tambah":0}
]'::jsonb WHERE nama = 'Crispy Chicken Steak';

UPDATE public.menu SET pilihan = '[
  {"nama":"Vanilla","tambah":0},
  {"nama":"Caramel","tambah":0},
  {"nama":"Hazelnut","tambah":0},
  {"nama":"Rum","tambah":0},
  {"nama":"Banana","tambah":0},
  {"nama":"Cotton Candy","tambah":0},
  {"nama":"Butter Scotch","tambah":0}
]'::jsonb WHERE nama = 'Flavoured Latte Panas / Dingin';
