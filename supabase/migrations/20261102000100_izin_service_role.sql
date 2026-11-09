-- =====================================================================
-- Izin untuk service_role.
--
-- KENAPA INI PERLU
-- Saat SUPABASE_SERVICE_KEY dipasang pertama kali di Vercel, production
-- langsung error: "permission denied for table meja". Ternyata peran
-- service_role di database ini hanya memegang REFERENCES, TRIGGER, dan
-- TRUNCATE pada seluruh tabel public -- tidak ada SELECT, INSERT, UPDATE,
-- maupun DELETE.
--
-- Akibatnya mode sungguhan sama sekali tidak bisa dipakai: halaman pelanggan
-- gagal membaca meja, kasir gagal membaca pesanan. Yang menyesatkan, di
-- sandbox tidak pernah terlihat karena sandbox selalu jatuh ke mode demo
-- (tidak ada jaringan keluar).
--
-- RLS (row level security) TIDAK dilewati oleh kurangnya izin tabel. RLS
-- hanya menentukan BARIS mana yang boleh disentuh setelah izin tabel ada.
-- Keduanya harus benar.
--
-- Aman dijalankan berulang.
-- =====================================================================

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Supaya tabel/sekuens baru otomatis mendapat izin yang sama.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;
