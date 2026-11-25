-- =====================================================================
-- Stok bahan, resep, pembelian, opname, dan HPP.
--
-- ── MURNI ADITIF ─────────────────────────────────────────────────────
--
-- Database ini dipakai BERSAMA aplikasi lain (ada tabel `reservations`,
-- `units`, `tour_venues`, `payments`, `users` di skema yang sama). Karena
-- itu berkas ini TIDAK mengubah, mengganti nama, atau menghapus satu pun
-- tabel/kolom yang sudah ada. Semua yang dibuat di sini baru, dan semua
-- yang dibaca hanya lewat relasi baru.
--
-- Satu-satunya penulisan ke tabel lama: NOL. Stok tidak menambah kolom ke
-- `menu`, `pesanan`, atau `tagihan`. Kalau suatu saat fitur ini dibuang,
-- cukup DROP tabel-tabel di bawah — tidak ada sisa di jalur pesanan.
--
-- ── KENAPA NILAI UANG DISIMPAN, BUKAN DIHITUNG ULANG ─────────────────
--
-- `gerakan_stok.nilai` dan `hpp_pesanan.hpp_satuan` adalah HASIL REKAMAN,
-- bukan hasil hitung. Harga bahan berubah (cabai naik, supplier ganti
-- harga). Kalau HPP bulan lalu dihitung ulang dengan harga hari ini, laba
-- bulan lalu ikut berubah — dan laporan yang bisa berubah sendiri tidak
-- bisa dipakai mengambil keputusan. Karena itu setiap pemakaian dikunci
-- pada harga saat kejadian.
-- =====================================================================

-- ── 1. Bahan baku ─────────────────────────────────────────────────────
--
-- `satuan` adalah satuan dasar pemakaian (gram, ml, pcs). Resep menyatakan
-- jumlah dalam satuan ini, dan harga selalu per satuan ini. Tidak ada
-- konversi satuan otomatis: satu bahan dengan dua satuan (mis. "kg" untuk
-- beli, "gram" untuk pakai) harus ditulis dalam satu satuan saja supaya
-- tidak ada faktor konversi yang bisa salah tanpa terlihat.
CREATE TABLE IF NOT EXISTS public.bahan (
  id           bigserial PRIMARY KEY,
  nama         text        NOT NULL,
  satuan       text        NOT NULL,
  /*
    Harga rata-rata bergerak (moving average), dibulatkan ke rupiah per
    satuan. Disimpan, bukan dihitung dari riwayat: HPP harus bisa dibaca
    dengan satu kueri, dan rata-rata seluruh riwayat akan berubah setiap
    kali pembelian baru masuk.
  */
  harga_satuan integer     NOT NULL DEFAULT 0 CHECK (harga_satuan >= 0),
  /*
    Stok minimum — memicu peringatan "hampir habis". 0 berarti tidak ada
    peringatan; itu default yang benar, karena bahan yang belum pernah
    diisi batasnya tidak boleh tiba-tiba dilaporkan kritis.
  */
  stok_minimum numeric     NOT NULL DEFAULT 0 CHECK (stok_minimum >= 0),
  aktif        boolean     NOT NULL DEFAULT true,
  catatan      text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Nama bahan unik: dua baris "Cabai Merah" membuat stok terbelah dua dan
-- tidak ada yang menyadarinya sampai opname.
CREATE UNIQUE INDEX IF NOT EXISTS bahan_nama_unik
  ON public.bahan (lower(nama));

-- ── 2. Resep: bahan per menu ──────────────────────────────────────────
--
-- Satu baris = satu bahan dalam SATU porsi menu. `menu_id` menunjuk ke
-- `menu.id` yang sudah ada; tidak ada perubahan pada tabel `menu`.
CREATE TABLE IF NOT EXISTS public.resep_menu (
  id        bigserial PRIMARY KEY,
  menu_id   integer     NOT NULL REFERENCES public.menu(id) ON DELETE CASCADE,
  bahan_id  bigint      NOT NULL REFERENCES public.bahan(id) ON DELETE RESTRICT,
  /*
    numeric, bukan integer: 0,5 gram lada atau 2,5 ml pewarna memang
    masuk akal, dan pembulatan diam-diam ke 0 akan membuat bahan itu
    seolah tidak terpakai sama sekali.
  */
  jumlah    numeric     NOT NULL CHECK (jumlah > 0),
  /*
    `perkiraan = true` berarti angka ini BELUM diverifikasi dapur.

    Ini kolom paling penting di berkas ini. Resep yang diisi sistem
    (bukan oleh dapur) tidak boleh tampil sama percayanya dengan resep
    yang sudah dicocokkan dengan takaran asli. HPP dari resep perkiraan
    ditandai di layar, supaya pemilik tidak menaikkan harga menu
    berdasarkan angka karangan.
  */
  perkiraan boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_id, bahan_id)
);

CREATE INDEX IF NOT EXISTS resep_menu_menu_idx  ON public.resep_menu (menu_id);
CREATE INDEX IF NOT EXISTS resep_menu_bahan_idx ON public.resep_menu (bahan_id);

-- ── 3. Gerakan stok: SATU BUKU BESAR ──────────────────────────────────
--
-- Semua perubahan stok masuk ke sini — masuk dari pembelian, keluar dari
-- penjualan, koreksi dari opname. Tidak ada jalur lain yang boleh
-- mengubah stok, karena begitu stok bisa berubah tanpa jejak, angka
-- selisih opname berhenti bermakna.
--
-- `jenis`:
--   beli    → +jumlah, dari pembelian supplier
--   pakai   → −jumlah, dari pesanan yang lunas
--   opname  → selisih koreksi hitung fisik (boleh + atau −)
--   awal    → +jumlah, stok awal saat bahan pertama dibuat
--   buang   → −jumlah, rusak/tumpah/kedaluwarsa
--
-- `nilai` = jumlah × harga satuan SAAT KEJADIAN. Untuk `pakai` inilah
-- HPP; untuk `beli` inilah uang yang keluar.
CREATE TABLE IF NOT EXISTS public.gerakan_stok (
  id         bigserial   PRIMARY KEY,
  bahan_id   bigint      NOT NULL REFERENCES public.bahan(id) ON DELETE RESTRICT,
  jenis      text        NOT NULL CHECK (jenis IN ('beli','pakai','opname','awal','buang')),
  /*
    Bertanda: negatif berarti stok keluar. Menyimpan tanda di satu kolom
    (bukan kolom `masuk`/`keluar` terpisah) membuat saldo = SUM(jumlah)
    — satu operasi, tidak ada kemungkinan lupa mengurangkan.
  */
  jumlah     numeric     NOT NULL CHECK (jumlah <> 0),
  harga_satuan integer   NOT NULL DEFAULT 0 CHECK (harga_satuan >= 0),
  nilai      integer     NOT NULL DEFAULT 0,
  /*
    Kaitan ke dokumen asal. `pesanan_id` diisi untuk jenis `pakai`,
    `pembelian_id` untuk `beli`. Keduanya nullable karena `opname` dan
    `awal` tidak berasal dari dokumen mana pun.
  */
  pesanan_id   bigint,
  pembelian_id bigint,
  catatan      text      NOT NULL DEFAULT '',
  oleh         text      NOT NULL DEFAULT 'sistem',
  dibuat_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gerakan_stok_bahan_idx   ON public.gerakan_stok (bahan_id, dibuat_at DESC);
CREATE INDEX IF NOT EXISTS gerakan_stok_pesanan_idx ON public.gerakan_stok (pesanan_id);
CREATE INDEX IF NOT EXISTS gerakan_stok_jenis_idx   ON public.gerakan_stok (jenis, dibuat_at DESC);

-- ── 4. Pembelian dari supplier ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pembelian (
  id         bigserial   PRIMARY KEY,
  nomor      text        NOT NULL UNIQUE,
  supplier   text        NOT NULL,
  /*
    Nomor nota supplier. Boleh kosong (pasar tidak memberi nota), tetapi
    kalau ada, harus unik per supplier — dua nota bernomor sama hampir
    pasti berarti pembelian yang tercatat dua kali.
  */
  no_nota    text        NOT NULL DEFAULT '',
  total      integer     NOT NULL DEFAULT 0 CHECK (total >= 0),
  dibayar    boolean     NOT NULL DEFAULT true,
  catatan    text        NOT NULL DEFAULT '',
  oleh       text        NOT NULL DEFAULT 'sistem',
  dibeli_at  timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pembelian_nota_unik
  ON public.pembelian (lower(supplier), lower(no_nota))
  WHERE no_nota <> '';

CREATE TABLE IF NOT EXISTS public.pembelian_item (
  id           bigserial PRIMARY KEY,
  pembelian_id bigint    NOT NULL REFERENCES public.pembelian(id) ON DELETE CASCADE,
  bahan_id     bigint    NOT NULL REFERENCES public.bahan(id) ON DELETE RESTRICT,
  jumlah       numeric   NOT NULL CHECK (jumlah > 0),
  harga_satuan integer   NOT NULL CHECK (harga_satuan >= 0)
);

CREATE INDEX IF NOT EXISTS pembelian_item_pembelian_idx ON public.pembelian_item (pembelian_id);

-- ── 5. HPP terkunci per baris pesanan ─────────────────────────────────
--
-- Disimpan terpisah dari `item_pesanan` — bukan kolom baru di sana —
-- karena `item_pesanan` adalah tabel milik alur pesanan. Menambah kolom
-- HPP ke sana berarti setiap pembacaan pesanan ikut membawa data biaya,
-- dan itu tidak perlu untuk dapur maupun tamu.
--
-- `lengkap = false` berarti ada bahan di resep menu ini yang belum punya
-- harga. HPP-nya tetap dicatat, tetapi DITANDAI tidak lengkap: menampilkan
-- HPP sebagian seolah angka final adalah cara paling mudah melaporkan
-- laba yang terlalu besar.
CREATE TABLE IF NOT EXISTS public.hpp_pesanan (
  id          bigserial PRIMARY KEY,
  pesanan_id  bigint    NOT NULL REFERENCES public.pesanan(id) ON DELETE CASCADE,
  item_id     bigint    NOT NULL REFERENCES public.item_pesanan(id) ON DELETE CASCADE,
  menu_id     integer,
  jumlah      smallint  NOT NULL,
  hpp_satuan  integer   NOT NULL DEFAULT 0,
  hpp_total   integer   NOT NULL DEFAULT 0,
  lengkap     boolean   NOT NULL DEFAULT true,
  dibuat_at   timestamptz NOT NULL DEFAULT now(),
  /*
    Satu baris pesanan hanya boleh punya SATU catatan HPP. Indeks unik
    ini yang membuat pemotongan stok idempoten: menandai lunas dua kali
    (notifikasi DOKU ganda, kasir menekan tombol dua kali) tidak
    menggandakan HPP maupun pemakaian bahan.
  */
  UNIQUE (item_id)
);

CREATE INDEX IF NOT EXISTS hpp_pesanan_pesanan_idx ON public.hpp_pesanan (pesanan_id);
CREATE INDEX IF NOT EXISTS hpp_pesanan_dibuat_idx  ON public.hpp_pesanan (dibuat_at);

-- ── 6. RLS: TERTUTUP, seperti `tagihan` ───────────────────────────────
--
-- Tabel-tabel ini TIDAK diberi policy apa pun. Dengan RLS menyala dan
-- nol policy, anon key tidak bisa membaca apa pun — persis seperti
-- `tagihan` dan `pembayaran` yang sudah ada.
--
-- Ini bukan kelalaian, ini syarat: harga bahan dan HPP adalah data
-- internal. Kalau bisa dibaca anon key, siapa pun yang membuka DevTools
-- di halaman tamu bisa melihat margin setiap menu.
ALTER TABLE public.bahan           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resep_menu      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gerakan_stok    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembelian       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembelian_item  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpp_pesanan     ENABLE ROW LEVEL SECURITY;

-- ── 7. `updated_at` ikut berubah ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sentuh_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bahan_sentuh ON public.bahan;
CREATE TRIGGER bahan_sentuh
  BEFORE UPDATE ON public.bahan
  FOR EACH ROW EXECUTE FUNCTION public.sentuh_updated_at();

DROP TRIGGER IF EXISTS resep_menu_sentuh ON public.resep_menu;
CREATE TRIGGER resep_menu_sentuh
  BEFORE UPDATE ON public.resep_menu
  FOR EACH ROW EXECUTE FUNCTION public.sentuh_updated_at();
