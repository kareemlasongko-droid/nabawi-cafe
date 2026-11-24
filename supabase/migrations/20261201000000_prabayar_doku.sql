-- =====================================================================
-- PRABAYAR: pesanan dibayar di muka lewat DOKU Checkout.
--
-- KEPUTUSAN PEMILIK (dikonfirmasi langsung, bukan asumsi):
--   1. Satu alur saja: bayar DULU, baru kasir memproses pesanan lunas.
--   2. Pemesan tetap scan QR meja. Meja tetap tercatat di pesanan.
--   3. Bayar tunai di kasir TETAP DIIZINKAN — kasir dan dapur hanya
--      menerima pesanan yang sudah LUNAS.
--   4. Refund dicatat MANUAL di kasir, bukan lewat sistem/API DOKU.
--
-- ── KENAPA `status_bayar` DIPISAH DARI `status` ──────────────────────
--
-- Dua pertanyaan berbeda, dua mesin berbeda:
--   · status       : di mana pesanan ini di dapur?  (diterima, diproses…)
--   · status_bayar : apakah uangnya sudah masuk?    (menunggu, lunas…)
--
-- Menggabungkannya berarti setiap kombinasi baru memaksa perubahan pada
-- seluruh mesin status, dan "dibatalkan karena kedaluwarsa" vs
-- "dibatalkan karena stok habis" menjadi tidak bisa dibedakan.
--
-- ── KENAPA `tagihan` PINDAH KE PER-PESANAN ───────────────────────────
--
-- Dulu satu tagihan per MEJA, menumpuk, dibayar di akhir. Dengan prabayar,
-- tiap checkout adalah transaksi tersendiri: tamu memesan 2 item, bayar,
-- lalu memesan lagi 20 menit kemudian dan bayar lagi. Satu tagihan per
-- meja tidak bisa mewakili dua pembayaran itu.
--
-- AMAN DIJALANKAN BERULANG.
-- =====================================================================

-- ── 1. Kolom pesanan ─────────────────────────────────────────────────

alter table public.pesanan
  add column if not exists no_wa text,
  add column if not exists tagihan_id bigint references public.tagihan(id) on delete set null,
  -- Status pembayaran. Nilai awal 'lunas' untuk baris LAMA: pesanan yang
  -- sudah ada dibuat pada era bayar-di-kasir, jadi menganggapnya
  -- "menunggu bayar" akan menyembunyikan riwayat yang sah.
  add column if not exists status_bayar text not null default 'lunas',
  add column if not exists dibayar_at timestamptz,
  add column if not exists kedaluwarsa_at timestamptz,
  add column if not exists metode_bayar text;

do $$
begin
  -- Hanya nilai yang dikenal. Salah tulis ('paid', 'LUNAS') harus gagal di
  -- sini, bukan diam-diam dianggap "belum bayar" dan membuat tamu menunggu
  -- pesanan yang tidak pernah masuk dapur.
  if not exists (select 1 from pg_constraint where conname = 'pesanan_status_bayar_sah') then
    alter table public.pesanan
      add constraint pesanan_status_bayar_sah
      check (status_bayar in ('menunggu', 'lunas', 'kedaluwarsa', 'gagal', 'dikembalikan'));
  end if;

  /*
    METODE PEMBAYARAN — dua pilihan tamu, ditambah nilai yang ditulis
    sistem saat pesanan benar-benar dibayar.

    'online'    tamu memilih dibawa ke halaman DOKU
    'kasir'     tamu memilih membayar di meja kasir
    'doku'      sistem menandai lunas lewat notifikasi DOKU
    'tunai'     sistem menandai lunas lewat kasir
    'qris_kasir', 'kartu' — pembayaran manual di kasir lewat /api/order/bayar

    Dibuat setelah semua nilai itu ada, bukan hanya dua nilai pilihan:
    kolom yang sama dipakai untuk riwayat, dan constraint yang terlalu
    sempit akan menolak pembayaran yang sah.
  */
  if not exists (select 1 from pg_constraint where conname = 'pesanan_metode_bayar_sah') then
    alter table public.pesanan
      add constraint pesanan_metode_bayar_sah
      check (
        metode_bayar is null
        or metode_bayar in ('online', 'kasir', 'doku', 'tunai', 'qris_kasir', 'kartu')
      );
  end if;
end $$;

-- Pesanan yang menunggu bayar WAJIB punya batas waktu. Tanpa ini, satu
-- pesanan yang tak pernah dibayar mengunci meja selamanya.
create index if not exists pesanan_menunggu_bayar_idx
  on public.pesanan (kedaluwarsa_at)
  where status_bayar = 'menunggu';

create index if not exists pesanan_tagihan_idx
  on public.pesanan (tagihan_id)
  where tagihan_id is not null;

-- ── 2. Kolom pembayaran ──────────────────────────────────────────────

alter table public.pembayaran
  add column if not exists invoice_number text,
  add column if not exists gerbang text not null default 'kasir',
  add column if not exists status text not null default 'lunas',
  -- Referensi dari DOKU (mis. `reference`/`request_id`). Disimpan apa
  -- adanya untuk rekonsiliasi manual — bukan dipercaya sebagai bukti lunas.
  add column if not exists referensi text,
  -- Payload notifikasi UTUH. Kalau nanti ada sengketa dengan DOKU, yang
  -- dibutuhkan adalah apa yang benar-benar mereka kirim, bukan ringkasan
  -- yang kita buat sendiri.
  add column if not exists payload jsonb,
  add column if not exists kedaluwarsa_at timestamptz,
  add column if not exists kasir text;

-- Kunci idempotensi webhook. DOKU bisa mengirim notifikasi yang SAMA
-- beberapa kali; tanpa indeks unik ini, satu pembayaran bisa tercatat
-- berkali-kali dan tagihan dinyatakan lunas dua kali.
--
-- Pasangan (invoice_number, status), BUKAN invoice_number saja: satu
-- tagihan bisa dibayar bertahap (DP lalu pelunasan), dan tiap tahap
-- punya barisnya sendiri. Yang harus mustahil adalah DUA baris 'settlement'
-- untuk invoice yang sama.
create unique index if not exists pembayaran_invoice_status_unik
  on public.pembayaran (invoice_number, status)
  where invoice_number is not null;

-- ── 3. Pengaturan baru ───────────────────────────────────────────────

insert into public.pengaturan (kunci, nilai) values
  ('batas_bayar_menit', '15'),
  ('bayar_tunai_kasir', 'on'),
  ('jam_mingguan', '09.00-20.00,08.00-21.00'),
  ('pesan_tutup', '')
on conflict (kunci) do nothing;

-- ── 4. Jam buka: SATU sumber, di database ────────────────────────────
--
-- Sebelum ini, `cekBuka()` memakai konstanta di app/lib/order/aturan.ts,
-- sementara tabel `pengaturan` sudah menyimpan `jam_weekday` dan
-- `jam_weekend` yang TIDAK PERNAH DIBACA. Pemilik yang mengubah jam di
-- dashboard Supabase tidak melihat efek apa pun.
--
-- Format: "HH.MM-HH.MM,HH.MM-HH.MM" → Senin–Kamis, Jumat–Minggu.
-- Nilai "24.00-24.00" berarti BUKA 24 JAM.
--
-- Contoh "24 jam sementara":
--   update pengaturan set nilai = '00.00-24.00,00.00-24.00'
--   where kunci = 'jam_mingguan';
--
-- Nilai awal = jam yang berlaku sekarang (09.00-20.00 / 08.00-21.00),
-- supaya perilakunya TIDAK berubah karena migrasi ini. Mengubah jam adalah
-- keputusan pemilik, bukan efek samping migrasi.

-- ── 5. Catatan pembatalan ────────────────────────────────────────────

alter table public.pesanan
  add column if not exists dibatalkan_oleh text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pesanan_dibatalkan_oleh_sah') then
    alter table public.pesanan
      add constraint pesanan_dibatalkan_oleh_sah
      check (dibatalkan_oleh is null or dibatalkan_oleh in ('tamu', 'kasir', 'sistem', 'doku'));
  end if;
end $$;

-- ── 6. Komentar untuk orang yang membuka tabel ini nanti ─────────────

comment on column public.pesanan.status_bayar is
  'menunggu | lunas | kedaluwarsa | gagal | dikembalikan. Terpisah dari status dapur.';
comment on column public.pesanan.kedaluwarsa_at is
  'Batas waktu bayar. Setelah lewat, pesanan dibatalkan otomatis oleh penyapu.';
comment on column public.pembayaran.invoice_number is
  'Nomor invoice yang dikirim ke DOKU. Unik — dipakai sebagai kunci idempotensi webhook.';
update public.pengaturan
   set keterangan = 'HH.MM-HH.MM,HH.MM-HH.MM (Senin-Kamis,Jumat-Minggu). 24.00 = buka 24 jam.'
 where kunci = 'jam_mingguan';
