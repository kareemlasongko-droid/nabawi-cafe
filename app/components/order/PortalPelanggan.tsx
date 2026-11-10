"use client";

/**
 * Portal pelanggan. Dibuka dari QR meja: /order?meja=12
 *
 * RANCANGAN YANG MENGIKUTI PERILAKU, BUKAN KESAN VISUAL
 *
 * - Menu langsung terbuka, tanpa layar sambutan, tanpa login. PRD: "duduk
 *   dulu, lihat-lihat, baru pesan". Layar pembuka memaksa satu ketukan
 *   ekstra yang tidak menghasilkan apa pun.
 * - Bilah keranjang menempel di bawah SELALU terlihat setelah ada isi.
 *   Pelanggan sering memesan bertahap dan menoleh ke meja untuk mengobrol;
 *   kalau totalnya tersembunyi, mereka harus membuka keranjang untuk
 *   memastikan sudah memesan apa.
 * - Item habis tetap ditampilkan (redup), TIDAK disembunyikan. Kalau
 *   dihilangkan, pelanggan mengira menunya tidak ada dan bertanya ke
 *   pelayan — persis yang ingin dikurangi.
 * - Nama pemesan opsional dan ditaruh di keranjang, bukan di awal. Satu
 *   meja bisa dipesan beberapa orang; yang penting pesanannya jalan dulu.
 * - Tidak ada foto besar. Halaman ini dibuka di area terbuka dengan sinyal
 *   terbatas; foto dimuat bertahap dan hanya ukuran kecil.
 * - Tiga ketukan: ketuk item (+), ketuk bilah keranjang, ketuk Kirim.
 *   Ketukan pada jumlah dan nama tidak dihitung karena opsional.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ATURAN_BAWAAN,
  bacaPilihan,
  hitungTagihan,
  type AturanBiaya,
} from "@/app/lib/order/aturan";
import { rupiah, type KategoriMenu, type Menu, type PilihanMenu } from "@/app/lib/order/tipe";
import {
  IkonCari,
  IkonKeranjang,
  IkonKurang,
  IkonTambah,
  IkonHapus,
  IkonBel,
  IkonBill,
  IkonKanan,
  IkonCentang,
  IkonKiri,
} from "./Ikon";

type Baris = {
  menu: Menu;
  jumlah: number;
  catatan: string;
  /** Opsi yang dipilih. Kosong bila menu ini tidak punya pilihan. */
  pilihan: PilihanMenu[];
};

type StatusPesananPelanggan = {
  id: number;
  nomor: string;
  status: string;
  created_at: string;
  total_item: number;
};

const KUNCI_SESI = "nabawi-sesi-order";
const KUNCI_KERANJANG = "nabawi-keranjang";

function ambilSesi(): string {
  try {
    const ada = localStorage.getItem(KUNCI_SESI);
    if (ada) return ada;
    // Sesi acak: hanya untuk mengikat pesanan ke perangkat ini, bukan identitas.
    const baru =
      (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) + "-" + Date.now().toString(36);
    localStorage.setItem(KUNCI_SESI, baru);
    return baru;
  } catch {
    // localStorage diblokir (mode privat ketat). Tetap bisa memesan,
    // tetapi status tidak akan diingat setelah halaman ditutup.
    return "sementara-" + Date.now().toString(36);
  }
}

/** Label status untuk pelanggan — bahasa sehari-hari, bukan istilah sistem. */
const LABEL: Record<string, { judul: string; detail: string }> = {
  menunggu_konfirmasi: {
    judul: "Menunggu kasir",
    detail: "Pesanan sudah masuk. Kasir menerimanya sebentar lagi.",
  },
  diterima: { judul: "Diterima kasir", detail: "Pesanan diteruskan ke dapur." },
  diproses: { judul: "Sedang disiapkan", detail: "Dapur mulai mengerjakan." },
  siap: { judul: "Siap diantar", detail: "Menunggu pelayan mengantar ke meja." },
  diantar: { judul: "Sudah diantar", detail: "Pesanan sudah ada di meja." },
  ditolak: { judul: "Ditolak", detail: "Kasir menolak pesanan ini. Panggil pelayan." },
  dibatalkan: { judul: "Dibatalkan", detail: "Pesanan ini tidak diproses." },
};

export function PortalPelanggan({
  mejaNomor,
  mejaArea,
  kategori,
  menu,
  aturan,
  jamHariIni,
  bukaSekarang,
  alasanTutup,
  demo,
}: {
  mejaNomor: string;
  mejaArea: string;
  kategori: KategoriMenu[];
  menu: Menu[];
  aturan: AturanBiaya;
  jamHariIni: string;
  bukaSekarang: boolean;
  alasanTutup: string;
  demo: boolean;
}) {
  const [sesi] = useState(() => (typeof window === "undefined" ? "" : ambilSesi()));
  const [cari, setCari] = useState("");
  const [kategoriAktif, setKategoriAktif] = useState<number | "semua">("semua");
  const [keranjang, setKeranjang] = useState<Baris[]>([]);
  /*
    Menu disimpan di state, bukan dibaca langsung dari prop, supaya tanda
    "habis" dari kasir bisa masuk tanpa memuat ulang halaman (K-08).
    Memuat ulang akan menghapus kata kunci pencarian, kategori terpilih, dan
    posisi gulir — tamu yang sedang memilih kehilangan tempatnya.
  */
  const [daftarMenu, setDaftarMenu] = useState<Menu[]>(menu);
  const [bukaKeranjang, setBukaKeranjang] = useState(false);
  /*
    Menu yang sedang dipilihkan opsi (sambal/saus/rasa). null = lembar
    tertutup. Disimpan sebagai Menu, bukan id, supaya lembar tetap benar
    walau daftar menu diperbarui polling di tengah pemilihan.
  */
  const [pilihUntuk, setPilihUntuk] = useState<Menu | null>(null);
  const [nama, setNama] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [pesanGalat, setPesanGalat] = useState("");
  const [pesananSaya, setPesananSaya] = useState<StatusPesananPelanggan[]>([]);
  const [panggilanTerkirim, setPanggilanTerkirim] = useState<"pelayan" | "bill" | "">("");
  const [baruSaja, setBaruSaja] = useState(0);

  const refGalat = useRef<HTMLDivElement>(null);

  // Keranjang disimpan lokal supaya tidak hilang saat koneksi putus (P-13).
  useEffect(() => {
    try {
      const simpan = localStorage.getItem(KUNCI_KERANJANG);
      if (simpan) setKeranjang(JSON.parse(simpan));
    } catch {
      /* keranjang rusak — mulai kosong, jangan gagalkan halaman */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KUNCI_KERANJANG, JSON.stringify(keranjang));
    } catch {
      /* kuota penuh / privat — abaikan */
    }
  }, [keranjang]);

  /** Ambil status pesanan milik perangkat ini, ulang tiap 5 detik (P-08). */
  useEffect(() => {
    if (!sesi) return;
    let hidup = true;

    const muat = async () => {
      try {
        const res = await fetch(`/api/order/pesanan?sesi=${encodeURIComponent(sesi)}`, {
          cache: "no-store",
        });
        const j = await res.json();
        if (hidup && Array.isArray(j.pesanan)) setPesananSaya(j.pesanan);
      } catch {
        /* koneksi putus: status lama tetap ditampilkan, jangan kosongkan */
      }
    };

    muat();
    /*
      Polling 2,5 detik, bukan 5 detik.
      Target PRD: perubahan status terlihat di layar pelanggan ≤5 detik.
      Dengan interval 5 detik, perubahan yang terjadi tepat setelah satu
      putaran baru terlihat 5 detik kemudian — sudah menyentuh batasnya dan
      meleset begitu jaringan sedikit lambat (terukur 5,1 dtk saat diuji).
      2,5 detik memberi ruang untuk latensi. Biayanya satu query kecil per
      tamu; itu jauh lebih murah daripada tamu mengira pesanannya tidak
      masuk lalu memanggil pelayan.
    */
    const t = setInterval(muat, 2500);
    return () => {
      hidup = false;
      clearInterval(t);
    };
  }, [sesi]);

  /**
   * Status ketersediaan menu (K-08), tiap 15 detik.
   *
   * Lebih jarang daripada status pesanan: menu habis berubah beberapa kali
   * per jam, bukan per detik. Kalau database tidak menjawab, daftar lama
   * DIPERTAHANKAN — lebih baik tamu sempat menekan menu habis lalu ditolak
   * kasir daripada menunya kosong karena gangguan sesaat.
   */
  useEffect(() => {
    let hidup = true;

    const muat = async () => {
      try {
        const res = await fetch("/api/order/menu/tersedia", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { menu?: { id: number; tersedia: boolean }[] };
        if (!hidup || !Array.isArray(j.menu)) return;

        const peta = new Map(j.menu.map((m) => [m.id, m.tersedia]));
        setDaftarMenu((lama) =>
          lama.map((m) => (peta.has(m.id) && peta.get(m.id) !== m.tersedia
            ? { ...m, tersedia: peta.get(m.id)! }
            : m))
        );
      } catch {
        /* koneksi putus: biarkan status lama */
      }
    };

    /*
      5 detik, bukan 15. K-08 menuntut tanda habis "langsung berlaku" di
      portal pelanggan; dengan 15 detik, tamu bisa memesan menu yang sudah
      habis selama seperempat menit (terukur 14 dtk saat diuji) — lalu
      pesanannya ditolak kasir dan tamu harus memilih lagi.
      Jawabannya hanya {id, tersedia} untuk 14 menu (±400 byte), jadi biaya
      memeriksa tiap 5 detik jauh lebih kecil daripada satu pesanan ditolak.
    */
    const t = setInterval(muat, 5000);
    return () => {
      hidup = false;
      clearInterval(t);
    };
  }, []);

  const totalItem = keranjang.reduce((n, b) => n + b.jumlah, 0);
  const subtotal = keranjang.reduce((n, b) => n + b.menu.harga * b.jumlah, 0);
  const rincian = useMemo(() => hitungTagihan(subtotal, aturan), [subtotal, aturan]);

  /*
    Nama kategori ikut dicari, bukan hanya nama menu.

    Sejak kategori diringkas 18 -> 6, "Ayam", "Ikan", dan "Udang" tidak
    lagi punya chip sendiri — semuanya masuk "Makanan Utama". Tanpa ini,
    mengetik "gurame" tidak menemukan "Gurame Bakar Minang" karena nama
    kategorinya tidak ikut dicocokkan, dan tamu kehilangan cara cepat
    yang dulu disediakan chip.
  */
  const namaKategori = useMemo(() => {
    const peta = new Map<number, string>();
    for (const k of kategori) peta.set(k.id, k.nama.toLowerCase());
    return peta;
  }, [kategori]);

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return daftarMenu.filter((m) => {
      if (kategoriAktif !== "semua" && m.kategori_id !== kategoriAktif) return false;
      if (!q) return true;
      const namaK = m.kategori_id != null ? (namaKategori.get(m.kategori_id) ?? "") : "";
      return (
        m.nama.toLowerCase().includes(q) ||
        m.deskripsi.toLowerCase().includes(q) ||
        namaK.includes(q)
      );
    });
    /*
      Bergantung pada daftarMenu, BUKAN pada prop menu. Prop itu hanya
      nilai awal; status ketersediaan terbaru datang dari polling. Kalau
      dependensinya prop, tanda "habis" dari kasir tidak pernah muncul
      sampai halaman dimuat ulang — dan itulah yang terjadi sebelum ini.
    */
  }, [daftarMenu, cari, kategoriAktif, namaKategori]);

  const perKategori = useMemo(() => {
    const peta = new Map<number | null, Menu[]>();
    for (const m of daftar) {
      const k = peta.get(m.kategori_id) ?? [];
      k.push(m);
      peta.set(m.kategori_id, k);
    }
    return peta;
  }, [daftar]);

  /**
   * Menu ini punya pilihan yang harus ditentukan pelanggan?
   * Dibaca lewat bacaPilihan() supaya data rusak tidak meloloskan menu
   * berpilihan ke keranjang tanpa pilihan — server akan menolaknya dan
   * pelanggan hanya melihat galat tanpa tahu apa yang kurang.
   */
  function opsiDari(m: Menu): PilihanMenu[] {
    return bacaPilihan(m.pilihan);
  }

  /**
   * Kunci baris keranjang: menu + pilihan.
   *
   * Hanya id menu TIDAK cukup. Dua Rice Bowl dengan sambal berbeda adalah
   * dua baris terpisah dengan harga berbeda; kalau digabung berdasarkan id,
   * salah satu rasa hilang dan tagihannya keliru.
   */
  function kunciBaris(menuId: number, pilihan: PilihanMenu[]): string {
    const nama = pilihan.map((p) => p.nama).sort().join("|").toLowerCase();
    return `${menuId}::${nama}`;
  }

  function tambah(m: Menu, pilihan: PilihanMenu[] = []) {
    if (!m.tersedia || !bukaSekarang) return;
    const kunci = kunciBaris(m.id, pilihan);
    setKeranjang((k) => {
      const ada = k.find((b) => kunciBaris(b.menu.id, b.pilihan) === kunci);
      if (ada) {
        return k.map((b) =>
          kunciBaris(b.menu.id, b.pilihan) === kunci
            ? { ...b, jumlah: Math.min(20, b.jumlah + 1) }
            : b
        );
      }
      return [...k, { menu: m, jumlah: 1, catatan: "", pilihan }];
    });
    setBaruSaja((n) => n + 1);
  }

  function ubahJumlah(kunci: string, d: number) {
    setKeranjang((k) =>
      k
        .map((b) => (kunciBaris(b.menu.id, b.pilihan) === kunci ? { ...b, jumlah: b.jumlah + d } : b))
        .filter((b) => b.jumlah > 0)
    );
  }

  function hapus(kunci: string) {
    setKeranjang((k) => k.filter((b) => kunciBaris(b.menu.id, b.pilihan) !== kunci));
  }

  async function kirim() {
    if (keranjang.length === 0 || mengirim) return;
    setMengirim(true);
    setPesanGalat("");

    try {
      const res = await fetch("/api/order/pesanan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meja: mejaNomor,
          sesi,
          nama: nama.trim() || null,
          items: keranjang.map((b) => ({
            menu_id: b.menu.id,
            jumlah: b.jumlah,
            catatan: b.catatan.trim() || null,
            // Hanya NAMA opsi. Harga dihitung server dari database.
            pilihan: b.pilihan.map((p) => p.nama),
          })),
        }),
      });
      const j = await res.json();

      if (!res.ok) {
        // Keranjang TIDAK dikosongkan saat gagal (P-13).
        setPesanGalat(j.pesan ?? "Pesanan gagal dikirim.");
        return;
      }

      setKeranjang([]);
      setBukaKeranjang(false);
      setPanggilanTerkirim("");
      const ulang = await fetch(`/api/order/pesanan?sesi=${encodeURIComponent(sesi)}`, {
        cache: "no-store",
      });
      const uj = await ulang.json();
      if (Array.isArray(uj.pesanan)) setPesananSaya(uj.pesanan);
    } catch {
      setPesanGalat(
        "Koneksi terputus. Pesanan belum terkirim dan keranjang tetap tersimpan. Coba lagi."
      );
    } finally {
      setMengirim(false);
    }
  }

  async function panggil(jenis: "pelayan" | "bill") {
    try {
      const res = await fetch("/api/order/panggilan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meja: mejaNomor, jenis }),
      });
      if (res.ok) {
        setPanggilanTerkirim(jenis);
        setTimeout(() => setPanggilanTerkirim(""), 4000);
      }
    } catch {
      setPesanGalat("Panggilan gagal terkirim. Coba lagi atau lambaikan tangan.");
    }
  }

  const adaPesananBerjalan = pesananSaya.some(
    (p) => !["diantar", "ditolak", "dibatalkan"].includes(p.status)
  );

  return (
    <div className="min-h-dvh bg-cream-200">
      {/* ── Kepala: nomor meja adalah informasi terpenting di layar ini ──
          Kalau salah meja, seluruh pesanan salah antar. Karena itu nomor
          meja ditaruh paling atas, besar, dan area-nya ikut disebut. */}
      <header className="sticky top-0 z-30 border-b border-ink-900/10 bg-cream-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-[45rem] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest-900 text-cream-50">
              <span className="text-[1.0625rem] font-extrabold leading-none">{mejaNomor}</span>
            </span>
            {/*
              Isi kepala HANYA yang dibutuhkan tamu: meja mana ia duduk dan
              di area mana. Nama kafe sebelumnya ada di sini dan selalu
              terpotong jadi "Nabawi Cafe …" di layar 390 px — teks yang
              tidak menambah informasi tetapi memakan ruang yang dipakai
              tombol Panggil dan Minta bill. Nama kafe tetap ada di judul
              halaman dan struk.
            */}
            {/*
              Satu baris saja. Dua tombol di kanan (Panggil, Minta bill) sudah
              memakan ~250 px dari 390 px, jadi baris kedua PASTI terpotong.
              Isi yang tersisa: nomor meja besar (sudah terbaca dari kotak di
              kiri) dan nama areanya. Itu dua hal yang dibutuhkan tamu untuk
              memastikan ia membuka meja yang benar.
            */}
            <div className="min-w-0">
              <p className="truncate text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-500">
                Meja {mejaNomor}
              </p>
              <p className="truncate text-[0.9375rem] font-extrabold capitalize leading-tight text-ink-900">
                {mejaArea}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => panggil("pelayan")}
              className="flex h-11 items-center gap-1.5 rounded-xl border border-ink-900/15 px-2.5 text-[0.75rem] font-bold text-ink-900 transition active:scale-[0.97]"
              title="Panggil pelayan ke meja"
            >
              <IkonBel className="size-4" />
              Panggil
            </button>
            <button
              type="button"
              onClick={() => panggil("bill")}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-forest-900 px-3 text-[0.75rem] font-bold text-cream-50 transition active:scale-[0.97]"
            >
              <IkonBill className="size-4" />
              Minta bill
            </button>
          </div>
        </div>

        {/* Jam buka + status. Kalau tutup, pesan ini muncul SEBELUM pelanggan
            memilih menu — bukan setelah menekan Kirim (P-12). */}
        {!bukaSekarang && (
          <div className="border-t border-clay-600/20 bg-clay-600/10 px-4 py-2">
            <p className="mx-auto max-w-[45rem] text-[0.75rem] font-semibold leading-snug text-clay-800">
              {alasanTutup} Pesanan belum bisa dikirim.
            </p>
          </div>
        )}
        {demo && (
          <div className="border-t border-ink-900/10 bg-ink-900/5 px-4 py-1.5">
            <p className="mx-auto max-w-[45rem] text-[0.6875rem] leading-snug text-ink-500">
              Mode demo: pesanan tidak tersimpan permanen.
            </p>
          </div>
        )}
      </header>

      {/*
        Padding bawah MENYESUAIKAN tinggi bilah keranjang, bukan angka tetap.

        Dulu pb-40 (160 px) dipatok. Bilah keranjang tingginya hanya 80 px di
        HP biasa (pt-3 12 + tombol h-14 56 + pb 12) dan 102 px di iPhone
        berponi. Jadi ada 80 px ruang kosong menganggur di bawah footer —
        terasa seperti halaman terpotong, bukan selesai.

        Sekarang: 80 px saat bilah TIDAK tampil (cukup untuk napas di ujung
        halaman), dan tinggi bilah + jarak aman saat bilah tampil, supaya
        baris terakhir footer tidak tertutup.

          bilah tampil   : 5rem (80) + safe-area + 1.5rem jarak = 104 px
          bilah tidak    : 5rem (80) saja
      */}
      <main
        className={[
          "mx-auto max-w-[45rem] px-4",
          totalItem > 0 && !bukaKeranjang
            ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
            : "pb-20",
        ].join(" ")}
      >
        {/* ── Pesanan berjalan ──
            Ditaruh paling atas setelah kepala karena pertanyaan pertama
            pelanggan yang sudah memesan adalah "pesanan saya bagaimana".
            Pelanggan yang belum memesan tidak melihat bagian ini sama sekali. */}
        {pesananSaya.length > 0 && (
          <section className="mt-4" aria-live="polite">
            <h2 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-500">
              Pesanan Anda
            </h2>
            <div className="space-y-2">
              {pesananSaya.slice(0, 3).map((p) => {
                const l = LABEL[p.status] ?? { judul: p.status, detail: "" };
                const selesai = ["diantar", "ditolak", "dibatalkan"].includes(p.status);
                return (
                  <div
                    key={p.id}
                    className={[
                      "rounded-xl border px-3 py-2.5",
                      selesai
                        ? "border-ink-900/10 bg-cream-100"
                        : "border-forest-700/30 bg-forest-900/[0.06]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.8125rem] font-extrabold text-ink-900">{l.judul}</p>
                      <span className="shrink-0 font-mono text-[0.6875rem] text-ink-500">
                        {p.nomor}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[0.75rem] leading-snug text-ink-500">
                      {l.detail} · {p.total_item} item
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Cari + kategori ──
            Kategori dibuat baris yang bisa digeser horizontal, bukan grid
            kartu: pelanggan memakai satu tangan, dan baris di bawah ibu jari
            lebih mudah dijangkau daripada grid dua kolom di tengah layar. */}
        <div className="sticky top-[4.25rem] z-20 -mx-4 mt-4 bg-cream-200/95 px-4 py-2 backdrop-blur">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-ink-900/15 bg-cream-50 px-3">
            <IkonCari className="size-4 shrink-0 text-ink-500" />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari menu"
              className="w-full bg-transparent text-[0.8125rem] text-ink-900 outline-none placeholder:text-ink-500/70"
              inputMode="search"
            />
            {cari && (
              <button
                type="button"
                onClick={() => setCari("")}
                aria-label="Hapus pencarian"
                className="grid size-6 place-items-center rounded-full bg-ink-900/10 text-ink-700"
              >
                <IkonKurang className="size-3" />
              </button>
            )}
          </label>

          <div className="relative -mr-4">
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterAktif aktif={kategoriAktif === "semua"} onClick={() => setKategoriAktif("semua")}>
              Semua
            </FilterAktif>
            {kategori.map((k) => (
              <FilterAktif
                key={k.id}
                aktif={kategoriAktif === k.id}
                onClick={() => setKategoriAktif(k.id)}
              >
                {k.nama}
              </FilterAktif>
            ))}
          </div>
          {/* Petunjuk tepi: kategori bisa digeser. Tanpa ini pelanggan
              mengira hanya kategori yang terlihat saja yang ada. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-cream-200 to-transparent"
          />
          </div>
        </div>

        {/* ── Daftar menu ── */}
        {kategori.map((k) => {
          const isi = perKategori.get(k.id) ?? [];
          if (isi.length === 0) return null;
          return (
            <section key={k.id} className="mt-5">
              <h2 className="mb-2 flex items-baseline gap-2 text-[0.9375rem] font-extrabold text-ink-900">
                {k.nama}
                <span className="text-[0.6875rem] font-semibold text-ink-500">
                  {isi.length} menu
                </span>
              </h2>
              <ul className="divide-y divide-ink-900/8 overflow-hidden rounded-2xl border border-ink-900/10 bg-cream-50">
                {isi.map((m) => {
                  const opsi = opsiDari(m);
                  /*
                    Baris keranjang untuk menu ini. Bila menu punya pilihan,
                    hanya baris dengan pilihan PERTAMA yang ditampilkan sebagai
                    penghitung cepat, supaya tombol +/- tetap satu tempat.
                    Pilihan lain diatur di dalam keranjang (bisa dihapus).
                  */
                  const diKeranjang = keranjang.find((b) => b.menu.id === m.id);
                  const kunciPertama = diKeranjang ? kunciBaris(diKeranjang.menu.id, diKeranjang.pilihan) : "";
                  const habis = !m.tersedia;
                  return (
                    <li
                      key={m.id}
                      className={["flex items-start gap-3 p-3", habis ? "opacity-55" : ""].join(" ")}
                    >
                      {/* Foto kecil 64px. Bukan hiasan: pelanggan memilih
                          dengan mata, dan sebagian nama menu Maroko tidak
                          dikenal. Ukuran dijaga kecil supaya hemat sinyal. */}
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-cream-300">
                        {m.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.foto_url}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="grid size-full place-items-center text-[0.625rem] font-bold uppercase tracking-wider text-ink-500">
                            {m.nama.slice(0, 2)}
                          </span>
                        )}
                        {habis && (
                          <span className="absolute inset-0 grid place-items-center bg-ink-900/55 text-[0.5625rem] font-bold uppercase tracking-wider text-cream-50">
                            Habis
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[0.875rem] font-extrabold leading-tight text-ink-900">
                          {m.nama}
                        </p>
                        {/* Deskripsi satu baris (PRD P-03). Dua baris membuat
                            satu layar hanya memuat 4 menu, padahal pelanggan
                            perlu melihat lebih banyak untuk memutuskan. */}
                        <p className="mt-0.5 line-clamp-2 text-[0.75rem] leading-snug text-ink-500">
                          {m.deskripsi}
                        </p>
                        <p className="mt-1 text-[0.8125rem] font-bold text-ink-900">
                          {rupiah(m.harga)}
                          {opsi.some((p) => p.tambah > 0) && (
                            <span className="ml-1 text-[0.625rem] font-semibold text-ink-500">
                              + pilihan
                            </span>
                          )}
                        </p>
                      </div>

                      {habis ? (
                        <span className="shrink-0 self-center text-[0.6875rem] font-semibold text-ink-500">
                          Habis
                        </span>
                      ) : diKeranjang ? (
                        <div className="flex shrink-0 items-center gap-1 self-center rounded-lg border border-ink-900/15 bg-cream-100 p-0.5">
                          <button
                            type="button"
                            onClick={() => ubahJumlah(kunciPertama, -1)}
                            aria-label={`Kurangi ${m.nama}`}
                            className="grid size-9 place-items-center rounded-md text-ink-900 transition active:bg-cream-300"
                          >
                            <IkonKurang />
                          </button>
                          <span className="min-w-5 text-center text-[0.8125rem] font-extrabold text-ink-900">
                            {diKeranjang.jumlah}
                          </span>
                          <button
                            type="button"
                            onClick={() => ubahJumlah(kunciPertama, 1)}
                            aria-label={`Tambah ${m.nama}`}
                            className="grid size-9 place-items-center rounded-md text-ink-900 transition active:bg-cream-300"
                          >
                            <IkonTambah />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => (opsi.length > 0 ? setPilihUntuk(m) : tambah(m))}
                          disabled={!bukaSekarang}
                          aria-label={
                            opsi.length > 0
                              ? `Pilih ${m.nama}`
                              : `Tambah ${m.nama} ke keranjang`
                          }
                          className="grid size-11 shrink-0 self-center place-items-center rounded-xl bg-forest-900 text-cream-50 transition active:scale-95 disabled:opacity-40"
                        >
                          {opsi.length > 0 ? (
                            <span className="px-2 text-[0.6875rem] font-bold">Pilih</span>
                          ) : (
                            <IkonTambah className="size-5" />
                          )}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {daftar.length === 0 && (
          <p className="mt-10 text-center text-[0.8125rem] text-ink-500">
            Tidak ada menu yang cocok dengan &ldquo;{cari}&rdquo;.
          </p>
        )}

        {/* ── Catatan tambahan: jam buka & info, diletakkan di akhir
             supaya tidak menghalangi menu. */}
        <footer className="mt-8 border-t border-ink-900/10 pt-4">
          <p className="text-[0.6875rem] leading-relaxed text-ink-500">
            Buka setiap hari {jamHariIni}. Pembayaran di kasir setelah makan.
            Harga belum termasuk pajak dan biaya layanan.
          </p>
        </footer>
      </main>

      {/* ── Bilah keranjang tetap ──
          Muncul hanya kalau ada isi, dan menempel di bawah dengan jarak aman
          untuk iPhone berponi. Satu tombol besar: seluruh bilah adalah tombol
          buka keranjang, jadi tidak ada ketukan meleset. */}
      {totalItem > 0 && !bukaKeranjang && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-900/10 bg-cream-50/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-[45rem]">
            <button
              type="button"
              onClick={() => setBukaKeranjang(true)}
              className="flex h-14 w-full items-center gap-3 rounded-xl bg-forest-900 px-4 text-cream-50 transition active:scale-[0.99]"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-cream-50/15">
                <IkonKeranjang className="size-4.5" />
              </span>
              <span className="flex-1 text-left">
                <span className="block text-[0.8125rem] font-extrabold leading-tight">
                  Lihat keranjang · {totalItem} item
                </span>
                <span className="block text-[0.6875rem] leading-tight text-cream-100/80">
                  {rupiah(rincian.total)} termasuk pajak
                </span>
              </span>
              <IkonKanan className="size-4" />
            </button>
          </div>
        </div>
      )}


      {/* ── Lembar pilih opsi (sambal / saus / rasa) ──
          Muncul SEBELUM masuk keranjang, bukan sesudah. Kalau pelanggan
          menekan (+) dan barang langsung masuk tanpa ditanya, dapur
          menerima pesanan tanpa saus — persis masalah yang diperbaiki di
          sini. Muncul sebagai lembar bawah supaya jangkauan ibu jari. */}
      {pilihUntuk && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-ink-900/45">
          <button
            type="button"
            aria-label="Tutup pilihan"
            onClick={() => setPilihUntuk(null)}
            className="flex-1"
          />
          <div className="rounded-t-2xl bg-cream-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="mx-auto max-w-[45rem]">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-ink-500">
                Pilih salah satu
              </p>
              <h2 className="mt-1 text-[1rem] font-extrabold text-ink-900">{pilihUntuk.nama}</h2>
              <div className="mt-3 space-y-2">
                {opsiDari(pilihUntuk).map((p) => (
                  <button
                    key={p.nama}
                    type="button"
                    onClick={() => {
                      tambah(pilihUntuk, [p]);
                      setPilihUntuk(null);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-900/15 bg-cream-100 px-3 py-3 text-left transition active:bg-cream-200"
                  >
                    <span className="text-[0.875rem] font-bold text-ink-900">{p.nama}</span>
                    <span className="shrink-0 text-[0.75rem] font-semibold text-ink-700">
                      {p.tambah > 0 ? `+${rupiah(p.tambah)}` : "Gratis"}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPilihUntuk(null)}
                className="mt-3 h-11 w-full rounded-xl border border-ink-900/15 text-[0.8125rem] font-bold text-ink-700 active:bg-cream-100"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lembar keranjang ── */}
      {bukaKeranjang && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-ink-900/45">
          <button
            type="button"
            aria-label="Tutup keranjang"
            onClick={() => setBukaKeranjang(false)}
            className="flex-1"
          />
          <div className="max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-cream-50 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(20,35,26,0.28)]">
            <div className="sticky top-0 flex items-center gap-2 border-b border-ink-900/10 bg-cream-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setBukaKeranjang(false)}
                className="grid size-9 place-items-center rounded-lg border border-ink-900/15 text-ink-900"
                aria-label="Kembali ke menu"
              >
                <IkonKiri />
              </button>
              <h2 className="flex-1 text-[0.9375rem] font-extrabold text-ink-900">Keranjang</h2>
              <span className="text-[0.6875rem] font-semibold text-ink-500">
                Meja {mejaNomor}
              </span>
            </div>

            <div className="px-4">
              {keranjang.length === 0 ? (
                <p className="py-10 text-center text-[0.8125rem] text-ink-500">
                  Keranjang kosong. Pilih menu dulu.
                </p>
              ) : (
                <ul className="divide-y divide-ink-900/8">
                  {keranjang.map((b) => {
                    /*
                      Harga satuan sudah termasuk tambahan pilihan. Menampilkan
                      b.menu.harga saja akan membuat pelanggan menghitung
                      sendiri dan mengira tagihannya salah.
                    */
                    const kunci = kunciBaris(b.menu.id, b.pilihan);
                    const satuan = b.menu.harga + b.pilihan.reduce((n, p) => n + p.tambah, 0);
                    return (
                    <li key={kunci} className="py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.875rem] font-bold text-ink-900">{b.menu.nama}</p>
                          {b.pilihan.length > 0 && (
                            <p className="mt-0.5 text-[0.75rem] font-semibold text-clay-700">
                              {b.pilihan
                                .map((p) => (p.tambah > 0 ? `${p.nama} (+${rupiah(p.tambah)})` : p.nama))
                                .join(", ")}
                            </p>
                          )}
                          <p className="text-[0.75rem] text-ink-500">
                            {rupiah(satuan)} × {b.jumlah} ={" "}
                            <span className="font-bold text-ink-900">
                              {rupiah(satuan * b.jumlah)}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 rounded-lg border border-ink-900/15 p-0.5">
                          <button
                            type="button"
                            onClick={() => ubahJumlah(kunci, -1)}
                            className="grid size-8 place-items-center rounded-md active:bg-cream-200"
                            aria-label={`Kurangi ${b.menu.nama}`}
                          >
                            <IkonKurang className="size-3.5" />
                          </button>
                          <span className="min-w-5 text-center text-[0.8125rem] font-extrabold">
                            {b.jumlah}
                          </span>
                          <button
                            type="button"
                            onClick={() => ubahJumlah(kunci, 1)}
                            className="grid size-8 place-items-center rounded-md active:bg-cream-200"
                            aria-label={`Tambah ${b.menu.nama}`}
                          >
                            <IkonTambah className="size-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => hapus(kunci)}
                          aria-label={`Hapus ${b.menu.nama}`}
                          className="grid size-8 place-items-center rounded-md text-clay-700 active:bg-clay-600/10"
                        >
                          <IkonHapus className="size-4" />
                        </button>
                      </div>
                      {/* Catatan per item (P-06). Ditaruh di bawah, bukan
                          disembunyikan di balik tombol, karena "tanpa sambal"
                          adalah permintaan yang paling sering muncul. */}
                      <input
                        value={b.catatan}
                        onChange={(e) =>
                          setKeranjang((k) =>
                            k.map((x) =>
                              kunciBaris(x.menu.id, x.pilihan) === kunci
                                ? { ...x, catatan: e.target.value }
                                : x
                            )
                          )
                        }
                        placeholder="Catatan (mis. tanpa sambal)"
                        maxLength={200}
                        className="mt-2 h-9 w-full rounded-lg border border-ink-900/12 bg-cream-100 px-2.5 text-[0.75rem] text-ink-900 outline-none placeholder:text-ink-500/70 focus:border-forest-700"
                      />
                    </li>
                    );
                  })}
                </ul>
              )}

              {/* Nama pemesan opsional. Satu meja bisa dipesan beberapa orang,
                  jadi nama membantu pelayan menaruh pesanan pada orang yang
                  benar — tetapi tidak diwajibkan (PRD bagian 4). */}
              {keranjang.length > 0 && (
                <div className="mt-4">
                  <label className="block text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-ink-500">
                    Nama pemesan (opsional)
                  </label>
                  <input
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    maxLength={40}
                    placeholder="Mis. Rani"
                    className="mt-1 h-11 w-full rounded-xl border border-ink-900/15 bg-cream-100 px-3 text-[0.8125rem] text-ink-900 outline-none placeholder:text-ink-500/70 focus:border-forest-700"
                  />
                  <p className="mt-1 text-[0.6875rem] text-ink-500">
                    Supaya pelayan tahu pesanan ini untuk siapa kalau satu meja dipesan bergantian.
                  </p>
                </div>
              )}

              {/* Rincian biaya (P-14). Pajak ditampilkan sebagai baris
                  terpisah, bukan dilipat ke harga, karena pelanggan berhak
                  tahu ke mana uangnya pergi sebelum membayar di kasir. */}
              {keranjang.length > 0 && (
                <dl className="mt-4 space-y-1.5 rounded-xl bg-cream-100 p-3 text-[0.75rem]">
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Subtotal</dt>
                    <dd className="font-semibold text-ink-900">{rupiah(rincian.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Biaya layanan</dt>
                    <dd className="font-semibold text-ink-900">{rupiah(rincian.layanan)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Pajak {aturan.pajakPersen}%</dt>
                    <dd className="font-semibold text-ink-900">{rupiah(rincian.pajak)}</dd>
                  </div>
                  {rincian.pembulatan !== 0 && (
                    <div className="flex justify-between">
                      <dt className="text-ink-500">Pembulatan</dt>
                      <dd className="font-semibold text-ink-900">
                        {rincian.pembulatan > 0 ? "+" : ""}
                        {rupiah(rincian.pembulatan)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-ink-900/10 pt-1.5">
                    <dt className="font-extrabold text-ink-900">Perkiraan total</dt>
                    <dd className="text-[0.875rem] font-extrabold text-ink-900">
                      {rupiah(rincian.total)}
                    </dd>
                  </div>
                </dl>
              )}

              {pesanGalat && (
                <div
                  ref={refGalat}
                  role="alert"
                  className="mt-3 rounded-xl border border-clay-600/30 bg-clay-600/10 p-3"
                >
                  <p className="text-[0.75rem] font-semibold leading-snug text-clay-800">
                    {pesanGalat}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={kirim}
                disabled={keranjang.length === 0 || mengirim || !bukaSekarang}
                className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-forest-900 text-[0.875rem] font-extrabold text-cream-50 transition active:scale-[0.99] disabled:opacity-45"
              >
                {mengirim ? "Mengirim…" : keranjang.length === 0 ? "Keranjang kosong" : "Kirim Pesanan"}
                {!mengirim && keranjang.length > 0 && <IkonKanan />}
              </button>
              <p className="mt-2 pb-1 text-center text-[0.6875rem] text-ink-500">
                Bayar di kasir setelah makan. Bisa tambah pesanan kapan saja.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pemberitahuan panggilan terkirim — singkat, cukup untuk memastikan
          tombolnya bekerja tanpa menutupi layar. */}
      {panggilanTerkirim && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full bg-ink-900 px-4 py-2 text-[0.75rem] font-bold text-cream-50 shadow-lg"
        >
          <span className="inline-flex items-center gap-2">
            <IkonCentang className="size-4" />
            {panggilanTerkirim === "bill" ? "Permintaan bill terkirim" : "Pelayan dipanggil"}
          </span>
        </div>
      )}
    </div>
  );
}

function FilterAktif({
  aktif,
  onClick,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full px-3 py-1.5 text-[0.75rem] font-bold transition",
        aktif
          ? "bg-ink-900 text-cream-50"
          : "border border-ink-900/15 bg-cream-50 text-ink-700 active:bg-cream-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
