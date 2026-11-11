-- Kolom "rekomendasi" pada menu.
--
-- Kenapa di database, bukan di kode: pemilik cafe perlu menandai menu
-- unggulan sendiri (stok sedang banyak, bahan baru datang, hidangan baru)
-- tanpa deploy. Daftar rekomendasi yang ditulis di kode akan basi dalam
-- hitungan hari.
--
-- Default false, bukan null: menu lama otomatis "bukan rekomendasi", dan
-- kolom tidak perlu nullable supaya tidak ada tiga keadaan
-- (true / false / tidak diketahui).
--
-- Aman dijalankan berulang: ADD COLUMN IF NOT EXISTS.

alter table public.menu
  add column if not exists rekomendasi boolean not null default false;

comment on column public.menu.rekomendasi is
  'Ditampilkan sebagai lencana Rekomendasi di portal pelanggan dan diurutkan paling atas di kategorinya.';
