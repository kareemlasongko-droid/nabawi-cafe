-- =====================================================================
-- Pilihan menu (sambal / saus / rasa) dengan tambahan harga.
--
-- KENAPA
-- Empat menu menyebut pilihan di deskripsinya, tetapi pelanggan tidak punya
-- cara memilih. Akibatnya dapur menerima "Wagyu Meltique" tanpa tahu saus
-- apa yang diminta, lalu menebak. Pesanan bisa salah dan makanan terbuang.
--
-- BENTUK DATA
--   menu.pilihan        jsonb  array opsi, mis.
--                       [{"nama":"Salted Egg","tambah":5000}, ...]
--   item_pesanan.pilihan jsonb opsi yang DIPILIH pelanggan, bentuk sama.
--
-- Kenapa tambahan harga disimpan di menu, bukan di kode: pemilik cafe harus
-- bisa menaikkan tambahan harga tanpa deploy ulang. Dan harga TIDAK PERNAH
-- dipercaya dari browser — server selalu menghitung ulang dari menu.
--
-- Kenapa jsonb, bukan tabel pilihan_menu terpisah: jumlahnya sedikit
-- (maks 7 per menu), selalu dibaca bersama menunya, dan tidak perlu
-- di-query sendiri. Tabel terpisah akan menambah join di setiap pembacaan
-- menu tanpa manfaat nyata.
--
-- Aman dijalankan berulang.
-- =====================================================================

ALTER TABLE public.menu
  ADD COLUMN IF NOT EXISTS pilihan jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.item_pesanan
  ADD COLUMN IF NOT EXISTS pilihan jsonb;

-- Jaga bentuknya: harus array. Tanpa ini, satu salah tulis `{}` membuat
-- seluruh pembacaan menu gagal di tengah jalan.
ALTER TABLE public.menu
  DROP CONSTRAINT IF EXISTS menu_pilihan_array;
ALTER TABLE public.menu
  ADD CONSTRAINT menu_pilihan_array CHECK (jsonb_typeof(pilihan) = 'array');

ALTER TABLE public.item_pesanan
  DROP CONSTRAINT IF EXISTS item_pesanan_pilihan_array;
ALTER TABLE public.item_pesanan
  ADD CONSTRAINT item_pesanan_pilihan_array
  CHECK (pilihan IS NULL OR jsonb_typeof(pilihan) = 'array');
