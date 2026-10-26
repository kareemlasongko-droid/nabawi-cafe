-- ============================================================================
--  Setup Supabase untuk aplikasi Senja Rimba
-- ============================================================================
--  Jalankan SEKALI setelah project Supabase dibuat dan SETELAH skema tabel
--  didorong dengan `npm run db:push`.
--
--  Cara menjalankan: Supabase Dashboard → SQL Editor → New query → tempel
--  seluruh isi file ini → Run. (Atau: psql "$DIRECT_URL" -f supabase/setup.sql)
--
--  Urutan yang benar:
--    1. Buat project Supabase, region Southeast Asia (Singapore / ap-southeast-1)
--    2. Set DIRECT_URL di .env.local (session pooler, port 5432)
--    3. npm run db:push          → membuat 6 tabel di skema public
--    4. Jalankan file ini        → bucket storage + penguncian RLS
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. BUCKET STORAGE
-- ----------------------------------------------------------------------------
--  Aplikasi memakai pola "client-direct upload": browser meng-PUT berkas
--  langsung ke Storage memakai signed upload URL yang diterbitkan server.
--  Karena itu TIDAK dibutuhkan policy RLS pada storage.objects untuk unggahan —
--  token signed URL sudah menjadi otorisasinya.
--
--  Batas 50 MB/file di bawah = batas paket Free Supabase. Foto panorama
--  equirectangular biasanya 5–20 MB, jadi muat dengan lega.
-- ----------------------------------------------------------------------------

-- Bucket PUBLIK: foto unit, foto panorama 360°, gambar konten.
-- Isinya memang untuk dilihat semua pengunjung, jadi public = true.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bucket PRIVAT: bukti transfer bank. Berisi nomor rekening & nama pengirim,
-- jadi tidak boleh bisa dibaca publik. Diakses lewat /api/media/proof/<nama>
-- yang memverifikasi kepemilikan lalu menerbitkan signed URL berumur 5 menit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bukti-transfer', 'bukti-transfer', false, 52428800, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ----------------------------------------------------------------------------
--  2. ROW LEVEL SECURITY — kunci semua tabel aplikasi
-- ----------------------------------------------------------------------------
--  Kenapa ini aman dan tidak merusak aplikasi:
--  aplikasi connect sebagai role `postgres` yang merupakan PEMILIK tabel, dan
--  pemilik selalu bypass RLS. Yang ditutup di sini hanyalah akses lewat Data
--  API (PostgREST) memakai anon key — jalur yang tidak dipakai aplikasi ini
--  sama sekali.
--
--  Kenapa ini perlu:
--  Supabase mengekspos skema public lewat REST API publik. Project yang dibuat
--  sebelum 30 Mei 2026 memberi grant otomatis ke anon/authenticated untuk
--  setiap tabel baru, sehingga tabel tanpa RLS bisa dibaca siapa saja yang
--  memegang anon key (key itu memang dirancang publik). CVE-2025-48757
--  menemukan 303 endpoint bocor di 170 aplikasi produksi karena hal ini.
--
--  Tanpa policy = deny all. Tepat yang kita inginkan.
-- ----------------------------------------------------------------------------

alter table if exists public.users        enable row level security;
alter table if exists public.sessions     enable row level security;
alter table if exists public.tour_scenes  enable row level security;
alter table if exists public.units        enable row level security;
alter table if exists public.reservations enable row level security;
alter table if exists public.payments     enable row level security;


-- ----------------------------------------------------------------------------
--  3. Cabut grant Data API (defense in depth)
-- ----------------------------------------------------------------------------
--  Berlaku untuk project lama yang tabelnya sudah terlanjur mendapat grant
--  otomatis. Untuk project baru (dibuat setelah 30 Mei 2026) perintah ini
--  tidak mengubah apa pun — memang sudah tidak ada grant.
--
--  `service_role` sengaja TIDAK dicabut: key itu hanya ada di server dan
--  dibutuhkan bila nanti Anda memakai supabase-js sisi server.
-- ----------------------------------------------------------------------------

revoke all on table public.users        from anon, authenticated;
revoke all on table public.sessions     from anon, authenticated;
revoke all on table public.tour_scenes  from anon, authenticated;
revoke all on table public.units        from anon, authenticated;
revoke all on table public.reservations from anon, authenticated;
revoke all on table public.payments     from anon, authenticated;

-- Sequence milik kolom `serial` juga ikut diekspos lewat Data API.
revoke all on all sequences in schema public from anon, authenticated;

-- Hentikan grant otomatis untuk tabel yang dibuat di masa depan, supaya
-- tabel baru tidak diam-diam terbuka lagi.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;


-- ----------------------------------------------------------------------------
--  4. Verifikasi
-- ----------------------------------------------------------------------------
--  Jalankan query di bawah untuk memastikan hasilnya seperti yang diharapkan.

-- 4a. Semua tabel aplikasi harus `rowsecurity = true`
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('users', 'sessions', 'tour_scenes', 'units', 'reservations', 'payments')
order by tablename;

-- 4b. Tidak boleh ada satu pun tabel public yang masih memberi hak ke anon
select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by table_name;
-- Hasil yang diharapkan: 0 baris.

-- 4c. Kedua bucket harus ada, `media` publik dan `bukti-transfer` privat
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('media', 'bukti-transfer')
order by id;


-- ----------------------------------------------------------------------------
--  5. Membuat admin pertama (JANGAN andalkan seeder di production)
-- ----------------------------------------------------------------------------
--  Seeder demo dimatikan di production (lihat src/lib/seed.ts). Untuk membuat
--  admin: daftarkan akun biasa lewat halaman /daftar di situs Anda, lalu
--  jalankan perintah di bawah dengan email yang sesuai.
--
--  update public.users set role = 'admin' where email = 'email-anda@domain.com';
--
--  Pastikan akun demo TIDAK ada di production:
--  select id, name, email, role from public.users order by id;
-- ----------------------------------------------------------------------------
