-- =====================================================================
-- Saklar mode contoh: satu baris di `pengaturan`, bukan data di kode.
--
-- Sebelum ini, "mode demo" menyala/diam sendiri hanya karena
-- SUPABASE_SERVICE_KEY kosong, dan seluruh isinya adalah salinan menu,
-- meja, dan pesanan yang menempel di app/lib/order/demo.ts. Pemilik
-- meminta data itu dihapus dan semuanya masuk database.
--
-- Yang tersisa sebagai "contoh" hanya perilaku yang memang tidak boleh
-- menyentuh data sungguhan: pesanan yang tidak tersimpan. Menu, meja, dan
-- venue tetap dari database.
--
-- Nilai awal "off": sistem harus berjalan dengan data sungguhan. Kalau
-- kunci server belum dipasang, mode contoh tetap menyala — tetapi karena
-- KEHARUSAN (tidak ada cara menyimpan), bukan karena baris ini, dan
-- halaman portal mengatakannya terus terang.
--
-- Aman dijalankan berulang.
-- =====================================================================

insert into public.pengaturan (kunci, nilai)
values ('mode_contoh', 'off')
on conflict (kunci) do nothing;

-- Pastikan hanya nilai yang dikenal yang bisa masuk, supaya salah tulis
-- ("false", "mati", "0") tidak diam-diam dianggap mati padahal maksudnya
-- menyala — atau sebaliknya.
alter table public.pengaturan
  drop constraint if exists pengaturan_mode_contoh_sah;

alter table public.pengaturan
  add constraint pengaturan_mode_contoh_sah
  check (
    kunci <> 'mode_contoh'
    or nilai in ('on', 'off')
  );
