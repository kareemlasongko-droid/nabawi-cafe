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
import { LogoNabawi } from "./LogoNabawi";
import {
  ATURAN_BAWAAN,
  bacaPilihan,
  hitungTagihan,
  urutkanMenu,
  type AturanBiaya,
} from "@/app/lib/order/aturan";
import {
  rupiah,
  LABEL_BAYAR,
  type KategoriMenu,
  type Menu,
  type PilihanMenu,
  type StatusBayar,
} from "@/app/lib/order/tipe";
import {
  IkonCari,
  IkonKeranjang,
  IkonKurang,
  IkonTambah,
  IkonHapus,
  IkonMeja,
  IkonKanan,
  IkonCentang,
  IkonKiri,
  IkonBintang,
  IkonJam,
  IkonDaun,
  IkonBeranda,
  IkonPesanan,
  IkonPromo,
  IkonAkun,
  IkonKategoriMenu,
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
  /** 'menunggu' | 'lunas' | 'kedaluwarsa' | 'gagal' | 'dikembalikan' */
  status_bayar: string;
  kedaluwarsa_at: string | null;
  /** Diisi server: total tagihan pesanan ini (untuk tombol bayar). */
  total?: number | null;
};

/**
 * Nama dua metode pembayaran — SATU tempat, dipakai tombol dan ringkasan.
 *
 * Kata yang dipilih: "Bayar Sekarang" vs "Bayar di Kasir".
 *
 *   · "Bayar Sekarang"  → menekankan WAKTU. Tamu paham pesanannya baru
 *     diteruskan setelah pembayaran selesai, dan itu memang yang terjadi.
 *   · "Bayar di Kasir"  → menekankan TEMPAT. Tamu paham ia tidak perlu
 *     menyelesaikan apa pun di ponselnya; uangnya dibayar di meja kasir.
 *
 * Menghindari "QRIS" dan "Tunai" sebagai label: QRIS hanyalah SALAH SATU
 * kanal DOKU (masih ada e-wallet dan kartu), dan "tunai" mengesankan tamu
 * tidak bisa memakai kartu di kasir.
 */
const METODE_BAYAR = {
  online: {
    judul: "Bayar Sekarang",
    detail: "QRIS, e-wallet, atau kartu. Pesanan langsung diproses.",
    catatan: "Butuh aplikasi pembayaran di ponsel Anda",
  },
  kasir: {
    judul: "Bayar di Kasir",
    detail: "Pesan dulu, bayar di meja kasir. Pesanan diproses setelah dibayar.",
    catatan: "Tunai atau kartu, langsung ke kasir",
  },
} as const;

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
  ditolak: { judul: "Ditolak", detail: "Kasir menolak pesanan ini. Silakan tanya kasir." },
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
  pesanDemo,
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
  /** Kalimat yang menjelaskan MENGAPA mode contoh menyala. */
  pesanDemo?: string;
}) {
  /*
    ── `?menu=<id>`: TAMU YANG SUDAH MEMILIH DI /menu ─────────────────

    Tombol pesan di /menu mengirim id menu yang sedang dilihat tamu. Tanpa
    pembacaan di sini, tamu itu mendarat di portal, kehilangan pilihannya,
    dan harus mencari ulang di antara 126 menu — friksi yang dibuat oleh
    tombol yang justru dimaksudkan mengurangi friksi.

    Menu yang ditandai dibuka lembarnya SEKALI (bila punya pilihan) atau
    langsung masuk keranjang (bila tidak). `useRef` mencegahnya berulang
    saat React merender ulang: kalau tidak, menutup lembar pilihan akan
    membukanya lagi, dan tamu tidak bisa keluar dari lembar itu.
  */
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
  /** Sudahkah `?menu=` diproses? Sekali saja per pemuatan halaman. */
  const menuAwalDiproses = useRef(false);
  /*
    Menu yang sedang dipilihkan opsi (sambal/saus/rasa). null = lembar
    tertutup. Disimpan sebagai Menu, bukan id, supaya lembar tetap benar
    walau daftar menu diperbarui polling di tengah pemilihan.
  */
  const [pilihUntuk, setPilihUntuk] = useState<Menu | null>(null);
  const [nama, setNama] = useState("");
  const [noWa, setNoWa] = useState("");
  /** Urutan checkout: 'keranjang' → 'data' → 'bayar'. */
  const [langkah, setLangkah] = useState<"keranjang" | "data">("keranjang");
  /** Pesanan yang baru dibuat dan menunggu dibayar. */
  const [menungguBayar, setMenungguBayar] = useState<{
    id: number;
    nomor: string;
    total: number;
  } | null>(null);
  const [membuatInvoice, setMembuatInvoice] = useState(false);
  /** Pesanan yang baru dibuat dengan metode "Bayar di Kasir". */
  const [pesananDiKasir, setPesananDiKasir] = useState<{
    id: number;
    nomor: string;
    total: number;
  } | null>(null);
  const [galatBayar, setGalatBayar] = useState("");
  /**
   * Metode yang dipilih tamu. `null` = belum memilih.
   *
   * Kenapa harus dipilih lebih dulu, bukan tombol "Kirim" tunggal: dua
   * metode ini menuntut hal berbeda DARI TAMU. "Bayar sekarang" berarti ia
   * harus menyelesaikan pembayaran sebelum pesanan diteruskan; "bayar di
   * kasir" berarti ia boleh langsung duduk. Satu tombol untuk dua janji
   * yang berbeda membuat tamu tidak tahu mana yang ia sepakati.
   */
  const [metode, setMetode] = useState<"online" | "kasir" | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [pesanGalat, setPesanGalat] = useState("");
  const [pesananSaya, setPesananSaya] = useState<StatusPesananPelanggan[]>([]);
  /** Daftar pesanan lama dibuka? Lihat bagian "Riwayat" di bawah. */
  const [riwayatBuka, setRiwayatBuka] = useState(false);
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
        const j = (await res.json()) as {
          menu?: { id: number; tersedia: boolean; rekomendasi?: boolean }[];
        };
        if (!hidup || !Array.isArray(j.menu)) return;

        const peta = new Map(j.menu.map((m) => [m.id, m]));
        setDaftarMenu((lama) =>
          lama.map((m) => {
            const baru = peta.get(m.id);
            if (!baru) return m;
            const rek = baru.rekomendasi === true;
            if (baru.tersedia === m.tersedia && rek === (m.rekomendasi === true)) return m;
            // Mengembalikan objek baru hanya bila ada yang berubah: objek
            // baru untuk setiap menu setiap 5 detik akan memicu render
            // ulang seluruh daftar tanpa alasan.
            return { ...m, tersedia: baru.tersedia, rekomendasi: rek };
          })
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
    // Rekomendasi naik ke atas DI DALAM kategorinya, bukan dipindah ke
    // kategori lain: pelanggan yang sedang melihat "Kopi" tetap melihat
    // kopi, hanya saja yang direkomendasikan lebih dulu.
    for (const [kunci, isi] of peta) peta.set(kunci, urutkanMenu(isi));
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
  /*
    Baca `?menu=<id>` sekali setelah halaman siap.

    Dijalankan di efek (bukan saat render) karena `tambah` menyentuh
    state keranjang, dan karena `window` belum ada saat render server.
    Menu yang sudah habis atau portal yang sedang tutup sengaja
    DIABAIKAN diam-diam: menampilkan galat untuk tautan yang tamu sendiri
    tidak pernah ketik akan membingungkan, dan kartu menunya sudah
    menampilkan "Habis" dengan jelas.
  */
  useEffect(() => {
    if (menuAwalDiproses.current) return;
    menuAwalDiproses.current = true;

    const id = Number(new URLSearchParams(window.location.search).get("menu"));
    if (!Number.isInteger(id) || id <= 0) return;

    const m = daftarMenu.find((x) => x.id === id);
    if (!m || !m.tersedia || !bukaSekarang) return;

    if (opsiDari(m).length > 0) setPilihUntuk(m);
    else tambah(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
    if (keranjang.length === 0 || mengirim || !metode) return;
    setMengirim(true);
    setPesanGalat("");

    try {
      const res = await fetch("/api/order/pesanan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meja: mejaNomor,
          sesi,
          // Wajib sejak prabayar. Divalidasi ulang di server.
          nama: nama.trim(),
          no_wa: noWa.trim(),
          /*
            Metode dikirim ke server dan DISIMPAN di pesanan.

            Tanpa ini kasir tidak tahu pesanan mana yang harus ditagih
            (tamu berharap dilayani, kasir tidak tahu uangnya belum masuk),
            dan tamu yang memilih "Bayar Sekarang" tidak bisa dibedakan
            dari yang memilih "Bayar di Kasir" — padahal yang pertama
            sedang menunggu halaman pembayaran terbuka.
          */
          metode_bayar: metode,
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
      setLangkah("keranjang");

      /*
        Pesanan tersimpan, tetapi BELUM dibayar. Yang ditampilkan bukan
        "berhasil" — melainkan layar pembayaran. Kalau kasir menerima
        pesanan yang belum lunas, dapur memasak makanan yang belum tentu
        dibayar; itu keputusan pemilik dan dijaga di server, bukan di sini.
      */
      const total = Number(j?.tagihan?.total ?? 0);
      const dibuat = {
        id: Number(j?.pesanan?.id ?? 0),
        nomor: String(j?.pesanan?.nomor ?? ""),
        total,
      };

      /*
        Dua jalan setelah pesanan tersimpan:

        · "Bayar Sekarang" → layar pembayaran, lalu tamu dibawa ke DOKU.
        · "Bayar di Kasir"  → TIDAK ada layar pembayaran. Pesanan sudah
          masuk dan tamu boleh langsung duduk. Memaksakan layar bayar di
          sini akan membuat tamu yang sudah memilih kasir mengira ia harus
          membayar di ponsel.
      */
      if (metode === "kasir") {
        setMenungguBayar(null);
        setPesananDiKasir(dibuat);
      } else {
        setPesananDiKasir(null);
        setMenungguBayar(dibuat);
      }
      setMetode(null);
      setGalatBayar("");
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

  /**
   * Minta tautan pembayaran DOKU, lalu arahkan tamu ke sana.
   *
   * Pesanan SUDAH tersimpan sebelum ini. Kalau DOKU gagal, pesanan tetap
   * ada dan tamu masih bisa membayar tunai di kasir — menghapusnya akan
   * membuat data yang sudah diisi hilang karena gangguan pihak ketiga.
   */
  async function bayarOnline() {
    if (!menungguBayar || membuatInvoice) return;
    setMembuatInvoice(true);
    setGalatBayar("");

    try {
      const res = await fetch("/api/order/doku/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesanan_id: menungguBayar.id, sesi }),
      });
      const j = await res.json();

      if (!res.ok) {
        setGalatBayar(j.pesan ?? "Pembayaran online tidak bisa dimulai.");
        return;
      }

      // `assign`, bukan `location.href` di state React: ini pindah ke
      // domain lain (halaman DOKU), jadi tidak ada yang perlu dirender.
      window.location.assign(j.url);
    } catch {
      setGalatBayar("Koneksi terputus. Coba lagi, atau bayar tunai di kasir.");
    } finally {
      setMembuatInvoice(false);
    }
  }

  /*
    Kelengkapan data dicek di sini HANYA untuk kenyamanan (tombol mati).
    Yang menentukan tetap server — menonaktifkan tombol di browser tidak
    menghentikan siapa pun yang mengirim POST langsung.
  */
  const namaCukup = nama.trim().length >= 2;
  const waCukup = /\d{8,}/.test(noWa.replace(/[^0-9]/g, ""));

  /*
    ── SATU TEMPAT YANG MENJAWAB "KENAPA TOMBOLNYA MATI?" ─────────────

    `kurang` menyebut SETIAP sebab yang masih menggantung, berurutan
    sesuai urutan isian di layar. `labelKirim` lalu menyebut yang PERTAMA
    — jadi kalau nama belum diisi, tombolnya berbunyi "Isi nama" dan bukan
    "Pilih metode pembayaran".

    Kenapa penting: urutan ini menentukan apakah tamu tahu harus berbuat
    apa. Sebelumnya label hanya menangani sebab terakhir (metode), dan
    sebab-sebab sebelumnya tidak pernah disebut di mana pun.
  */
  const kurang: string[] = [];
  if (keranjang.length === 0) kurang.push("pilih menu");
  if (!namaCukup) kurang.push("isi nama");
  if (!waCukup) kurang.push("isi nomor WhatsApp");
  if (!metode) kurang.push("pilih metode pembayaran");
  if (!bukaSekarang) kurang.push("tunggu jam buka");

  const bisaKirim = kurang.length === 0 && !mengirim;

  /*
    Label tombol = satu kalimat yang menyebut tindakan berikutnya.
    Saat semuanya lengkap, labelnya menyebut konsekuensinya (bayar
    sekarang / di kasir) — itu yang dibaca ulang tamu sebelum menekan
    tombol uang.
  */
  const labelKirim = mengirim
    ? "Mengirim…"
    : kurang.length > 0
      ? kurang[0].charAt(0).toUpperCase() + kurang[0].slice(1)
      : metode === "kasir"
        ? "Kirim Pesanan · Bayar di Kasir"
        : "Kirim Pesanan · Bayar Sekarang";

  /*
    ── SATU PESANAN, SATU TEMPAT ──────────────────────────────────────

    Pesanan dianggap SELESAI (pindah ke riwayat) bila salah satu benar:
      · pembayarannya gagal/kedaluwarsa/dikembalikan — tidak akan berlanjut;
      · statusnya sudah diantar, ditolak, atau dibatalkan.

    Pesanan yang belum lunas TETAP di daftar aktif, apa pun status
    dapurnya: tamu masih harus membayar, dan menyembunyikannya di balik
    "Riwayat" membuat tagihan yang belum dibayar terasa seperti arsip.
  */
  const pesananAktif = pesananSaya.filter((p) => {
    const berhenti =
      p.status_bayar !== "lunas"
        ? ["kedaluwarsa", "gagal", "dikembalikan"].includes(p.status_bayar)
        : ["diantar", "ditolak", "dibatalkan"].includes(p.status);
    return !berhenti;
  });
  const pesananLama = pesananSaya.filter((p) => !pesananAktif.includes(p));

  const adaPesananBerjalan = pesananAktif.length > 0;

  return (
    <div className="min-h-dvh bg-cream-50">
      {/* ── Kepala: nomor meja adalah informasi terpenting di layar ini ──
          Kalau salah meja, seluruh pesanan salah antar. Karena itu nomor
          meja ditaruh paling atas, besar, dan area-nya ikut disebut. */}
      <header className="sticky top-0 z-30 border-b border-bersih-200/80 bg-cream-50/92 backdrop-blur-md">
        {/*
          SATU BARIS, DUA KELOMPOK: identitas kafe menempel kiri, nomor meja
          menempel kanan.

          Dulu di sini juga ada dua tombol ("Panggil" dan "Bill"). Keduanya
          dihapus bersama fitur panggilan, sehingga bilah ini sekarang hanya
          memuat dua hal — dan justru itu yang membuatnya muat lega di layar
          360px: sebelumnya sisa ruangnya hanya 10px.

          Tingginya tetap 40px semua (logo dan kotak meja), supaya terbaca
          sebagai satu bilah, bukan tiga elemen yang kebetulan berdekatan.
        */}
        <div className="mx-auto flex max-w-[45rem] items-center justify-between gap-2 px-3 py-2.5 sm:gap-3">
          {/* ── KIRI: identitas kafe ── */}
          <div className="flex min-w-0 items-center">
            <LogoNabawi
              ukuran={28}
              setinggiKontrol
              ringkas
              label="Nabawi Cafe & Resto"
            />
          </div>

          {/* ── KANAN: meja + tombol ── */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/*
              Kotak meja sekarang BERBENTUK SAMA dengan tombol di sebelahnya:
              ikon 16px + angka 13px, padding px-2, tinggi h-10. Sebelumnya ia
              kotak 40x40 berisi angka 17px — satu-satunya elemen tanpa ikon
              dan satu-satunya dengan huruf lebih besar, sehingga terbaca
              sebagai hiasan, bukan bagian dari bilah.

              Ia tetap BUKAN tombol: latar tinta penuh dan tidak ada
              `hover`/`active`, karena nomor meja memang tidak bisa ditekan.
            */}
            <span
              className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-forest-900 px-3 text-[0.8125rem] text-cream-50 shadow-[0_2px_10px_-4px_rgb(20_35_26/0.5)]"
              title={`Meja ${mejaNomor} · ${mejaArea}`}
            >
              <IkonMeja className="size-4 shrink-0" />
              {/*
                "Meja" ditulis, bukan hanya angkanya: tanpa kata itu, "3"
                hanyalah angka tanpa satuan — tamu yang baru duduk tidak
                tahu apakah itu nomor meja, nomor pesanan, atau jumlah item.

                Warnanya SAMA dengan angka (mewarisi `text-white` dari
                kotak). Sebelumnya diredupkan ke 70%, dan hasilnya justru
                terbaca sebagai dua informasi berbeda dalam satu kotak —
                padahal "Meja 3" adalah satu hal. Yang membedakan sekarang
                hanya bobot huruf: angka tebal, kata biasa.
              */}
              <span>Meja</span>
              <span className="font-bold tabular-nums">{mejaNomor}</span>
                <span className="sr-only">, area {mejaArea}</span>
            </span>

            {/*
              Keranjang sebagai IKON BERBADGE, seperti acuan. Di ponsel
              bilah keranjang mengambang sudah menampilkan total, tetapi
              ikon ini tetap perlu: saat tamu menggulir jauh ke bawah di
              kategori terakhir, ia bisa membuka keranjang tanpa mencari
              bilahnya. Angka kecil di pojok memberi tahu ada isi.
            */}
            <button
              type="button"
              onClick={() => setBukaKeranjang(true)}
              aria-label={`Buka keranjang${totalItem > 0 ? `, ${totalItem} item` : ""}`}
              className="relative grid size-10 shrink-0 place-items-center rounded-full text-forest-900 transition hover:bg-cream-100 active:scale-95"
            >
              <IkonKeranjang className="size-5" />
              {totalItem > 0 && (
                <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-sela-500 px-1 text-[0.625rem] font-extrabold leading-4 text-forest-950">
                  {totalItem}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Jam buka + status. Kalau tutup, pesan ini muncul SEBELUM pelanggan
            memilih menu — bukan setelah menekan Kirim (P-12). */}
        {!bukaSekarang && (
          <div className="border-t border-sela-200 bg-sela-50 px-4 py-2">
            <p className="mx-auto max-w-[45rem] text-[0.8125rem] font-semibold leading-snug text-sela-800">
              {alasanTutup} Pesanan belum bisa dikirim.
            </p>
          </div>
        )}
        {demo && (
          <div className="border-t border-bersih-200 bg-bersih-100 px-4 py-1.5">
            <p className="mx-auto max-w-[45rem] text-[0.6875rem] leading-snug text-tinta-500">
              {pesanDemo || "Mode contoh: pesanan tidak tersimpan permanen."}
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
          // Ruang bawah = tinggi nav (≈68px) + bilah keranjang (≈76px) bila
          // ada isi. Tanpa ini, menu terakhir tertutup bilah keranjang —
          // dan tamu mengira menunya habis.
          totalItem > 0 && !bukaKeranjang
            ? "pb-[calc(10rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(6rem+env(safe-area-inset-bottom))]",
        ].join(" ")}
      >
        {/*
          ── HERO: SAPAAN, BUKAN JUDUL ─────────────────────────────────
          Satu baris besar + satu baris kecil. Tujuannya menjawab "saya di
          mana dan harus apa" dalam sekali lihat: nama kafe, sapaan, lalu
          petunjuk memilih menu. Tidak ada gambar besar di sini — foto besar
          di atas layar 360px memakan seluruh tinggi lipatan dan mendorong
          menu pertama ke bawah, padahal menu itulah yang dicari tamu.
        */}
        <section className="flex items-start justify-between gap-3 pt-4">
          <div className="min-w-0">
            <h1 className="text-[1.375rem] font-extrabold leading-tight tracking-[-0.01em] text-forest-900">
              Selamat datang di Nabawi
            </h1>
            <p className="mt-1 text-[0.8125rem] leading-snug text-tinta-500">
              Pilih menu favoritmu — pesanan langsung masuk ke dapur.
            </p>
          </div>
          {/* Daun = penanda segar; warnanya hijau hutan, bukan hijau baru. */}
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-daun-100 text-forest-700"
          >
            <IkonDaun className="size-5" />
          </span>
        </section>

        {/* ── PESANAN TERSIMPAN, BAYAR DI KASIR ──
            Ini layar yang paling penting untuk metode kasir. Tanpa
            konfirmasi, tamu yang sudah menekan kirim melihat keranjangnya
            kosong dan tidak tahu apakah pesanannya masuk — lalu memesan
            ulang, dan dapur menerima dua pesanan yang sama. */}
        {pesananDiKasir && (
          <section className="mt-4" aria-live="polite">
            <div className="rounded-[0.875rem] border border-forest-700/25 bg-daun-100/70 p-4">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-forest-700 text-white">
                  <IkonCentang />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[1rem] font-extrabold text-tinta-900">
                    Pesanan diterima
                  </h2>
                  <p className="mt-0.5 text-[0.8125rem] leading-snug text-tinta-500">
                    Nomor <strong className="font-mono text-tinta-900">{pesananDiKasir.nomor}</strong>
                    {" · "}
                    {rupiah(pesananDiKasir.total)}
                  </p>
                </div>
              </div>

              <p className="mt-2.5 text-[0.8125rem] leading-snug text-tinta-700">
                Silakan bayar di meja kasir. Pesanan mulai disiapkan setelah
                pembayaran diterima.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPesananDiKasir(null)}
                  className="h-10 rounded-[0.625rem] border border-forest-700/30 px-3 text-[0.8125rem] font-bold text-forest-700"
                >
                  Pesan lagi
                </button>
                {/*
                  Invoice dibuka SEBELUM dibayar pun berguna: tamu bisa
                  menunjukkan "Ini pesanan saya" ke kasir, lengkap dengan
                  nomor dan rinciannya — tanpa perlu membaca ulang dari layar
                  ponsel yang kecil.
                */}
                <a
                  href={`/order/invoice/${pesananDiKasir.id}?sesi=${encodeURIComponent(sesi)}`}
                  className="flex h-10 items-center rounded-[0.625rem] border border-forest-700/30 px-3 text-[0.8125rem] font-bold text-forest-700"
                >
                  Lihat invoice
                </a>
              </div>
            </div>
          </section>
        )}

        {/* ── LAYAR BAYAR ──
            Muncul tepat setelah pesanan tersimpan, dan hanya sekali. Ia
            sengaja TIDAK menutupi seluruh layar: tamu perlu tetap bisa
            memanggil pelayan kalau memilih bayar tunai.

            Tidak ada tombol "Saya sudah bayar" yang menandai lunas. Tombol
            semacam itu hanya akan berbohong: yang menentukan adalah
            notifikasi bertanda tangan dari DOKU. Yang disediakan adalah
            "Periksa status", yang menanyakan ulang ke server. */}
        {menungguBayar && (
          <section className="mt-4">
            <div className="rounded-[0.875rem] border border-sela-200 bg-sela-50 p-4">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-tinta-500">
                Pesanan {menungguBayar.nomor}
              </p>
              <h2 className="mt-1 text-[1rem] font-extrabold text-tinta-900">
                Selesaikan pembayaran
              </h2>
              <p className="mt-1 text-[0.8125rem] leading-snug text-tinta-500">
                Total{" "}
                <strong className="font-extrabold text-tinta-900">
                  {rupiah(menungguBayar.total)}
                </strong>
                . Pesanan diteruskan ke kasir setelah pembayaran diterima.
              </p>

              {galatBayar && (
                <p
                  role="alert"
                  className="mt-2 rounded-[0.5rem] bg-sela-600/10 p-2 text-[0.75rem] font-semibold leading-snug text-sela-800"
                >
                  {galatBayar}
                </p>
              )}

              <button
                type="button"
                onClick={bayarOnline}
                disabled={membuatInvoice}
                className="tombol-utama mt-3 h-12 w-full text-[0.875rem] active:scale-[0.99] disabled:opacity-45"
              >
                {membuatInvoice ? "Menyiapkan pembayaran…" : "Bayar Online (QRIS / e-wallet)"}
              </button>

              <button
                type="button"
                onClick={() => setMenungguBayar(null)}
                className="mt-2 flex h-11 w-full items-center justify-center rounded-[0.625rem] border border-forest-700/30 text-[0.8125rem] font-bold text-forest-700"
              >
                Bayar tunai di kasir
              </button>

              <p className="mt-2 text-center text-[0.6875rem] leading-snug text-tinta-500">
                Pesanan otomatis dibatalkan bila tidak dibayar dalam 15 menit.
                Bisa pesan ulang kapan saja.
              </p>
            </div>
          </section>
        )}

        {/* ── Pesanan berjalan ──
            Hanya pesanan yang MASIH BERJALAN yang tampil di sini.

            Dulu semua pesanan (maksimal 3) tampil, termasuk yang sudah
            selesai — sehingga tamu yang sudah beberapa kali makan di sini
            harus menggulir kartu-kartu lama sebelum sampai ke menu. Riwayat
            pindah ke balik tombol: tamu yang butuh invoice lama mencari
            dengan sengaja, tamu yang sedang makan tidak terganggu. */ }
        {pesananAktif.length > 0 && (
          <section className="mt-4" aria-live="polite">
            <h2 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-tinta-500">
              Pesanan Anda
            </h2>
            <div className="space-y-2">
              {pesananAktif.map((p) => (
                <KartuPesanan key={p.id} pesanan={p} sesi={sesi} />
              ))}
            </div>
          </section>
        )}

        {/* ── Riwayat ──
            Tombol hanya muncul bila memang ada yang bisa dibuka; tombol
            kosong membuat tamu menekannya lalu kecewa. `aria-expanded`
            dipakai supaya pembaca layar tahu keadaan daftar, bukan hanya
            warna tombolnya yang berubah. */}
        {pesananLama.length > 0 && (
          <section className="mt-3">
            <button
              type="button"
              onClick={() => setRiwayatBuka((b) => !b)}
              aria-expanded={riwayatBuka}
              className="flex h-11 w-full items-center justify-between rounded-[0.625rem] border border-bersih-200 bg-bersih-0 px-3 text-[0.8125rem] font-bold text-tinta-900"
            >
              <span className="inline-flex items-center gap-2">
                <IkonJam className="size-4 text-tinta-500" />
                Riwayat pesanan
                <span className="rounded-full bg-bersih-100 px-1.5 py-0.5 text-[0.6875rem] font-extrabold tabular-nums text-tinta-700">
                  {pesananLama.length}
                </span>
              </span>
              <span className="text-[0.6875rem] font-semibold text-tinta-500">
                {riwayatBuka ? "Tutup" : "Lihat"}
              </span>
            </button>

            {riwayatBuka && (
              <div className="mt-2 space-y-2">
                {pesananLama.map((p) => (
                  <KartuPesanan key={p.id} pesanan={p} sesi={sesi} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Cari + kategori ──
            Kategori dibuat baris yang bisa digeser horizontal, bukan grid
            kartu: pelanggan memakai satu tangan, dan baris di bawah ibu jari
            lebih mudah dijangkau daripada grid dua kolom di tengah layar. */}
        {/*
          `top-[3.75rem]` = 60px, TINGGI KEPALA YANG SEBENARNYA (py-2.5 = 20px
          + isi tertinggi h-10 = 40px). Sebelumnya 4.25rem (68px) — sisa 8px
          dari versi lama ketika kepala masih memuat baris identitas
          tambahan, dan tidak pernah diperbarui setelah baris itu dihapus.
          Akibatnya baris cari menempel 8px di bawah tepi kepala, sehingga
          menu sempat menyelip di celah itu saat digulir.
          Kalau tinggi kepala berubah, angka ini WAJIB ikut berubah.
        */}
        <div className="sticky top-[3.75rem] z-20 -mx-4 mt-4 bg-bersih-50/95 px-4 py-2 backdrop-blur">
          <label className="flex h-11 items-center gap-2 rounded-[0.625rem] border border-bersih-200 bg-bersih-0 px-3">
            <IkonCari className="size-4 shrink-0 text-tinta-500" />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari menu"
              className="w-full bg-transparent text-[0.8125rem] text-tinta-900 outline-none placeholder:text-tinta-500/70"
              inputMode="search"
            />
            {cari && (
              <button
                type="button"
                onClick={() => setCari("")}
                aria-label="Hapus pencarian"
                className="grid size-6 place-items-center rounded-full bg-bersih-200 text-tinta-700"
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
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-cream-50 to-transparent"
          />
          </div>
        </div>

        {/* ── Daftar menu ── */}
        {kategori.map((k) => {
          const isi = perKategori.get(k.id) ?? [];
          if (isi.length === 0) return null;
          return (
            <section key={k.id} className="mt-5">
              <h2 className="mb-2 flex items-baseline gap-2 text-[0.9375rem] font-extrabold text-tinta-900">
                {k.nama}
                <span className="text-[0.6875rem] font-semibold text-tinta-500">
                  {isi.length} menu
                </span>
              </h2>
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {isi.map((m) => {
                  const opsi = opsiDari(m);
                  /*
                    Baris keranjang untuk menu ini. Bila menu punya pilihan,
                    hanya baris dengan pilihan PERTAMA yang ditampilkan sebagai
                    penghitung cepat, supaya tombol +/- tetap satu tempat.
                  */
                  const diKeranjang = keranjang.find((b) => b.menu.id === m.id);
                  const kunciPertama = diKeranjang
                    ? kunciBaris(diKeranjang.menu.id, diKeranjang.pilihan)
                    : "";
                  const habis = !m.tersedia;
                  return (
                    <li
                      key={m.id}
                      className={[
                        "group relative flex flex-col overflow-hidden rounded-[1rem] border border-bersih-200/80 bg-bersih-0",
                        "shadow-[0_1px_2px_rgb(22_19_15/0.04),0_10px_24px_-20px_rgb(22_19_15/0.35)]",
                        habis ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      {/* Ikon kategori sementara; foto asli dapat dipasang nanti di slot 1:1 ini. */}
                      <div className="relative aspect-square w-full overflow-hidden bg-bersih-100">
                        <span aria-hidden="true" className="grid size-full place-items-center bg-daun-100">
                          <IkonKategoriMenu
                            kategoriId={m.kategori_id}
                            className="size-9 text-forest-700/60"
                          />
                        </span>

                        {m.rekomendasi === true && !habis && (
                          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-cream-50/95 px-1.5 py-0.5 text-[0.625rem] font-bold text-sela-800 shadow-sm backdrop-blur">
                            <IkonBintang className="size-2.5" />
                            Rekomendasi
                          </span>
                        )}

                        {habis && (
                          <span className="absolute inset-0 grid place-items-center bg-forest-950/70 text-[0.6875rem] font-extrabold uppercase tracking-[0.14em] text-cream-50">
                            Habis
                          </span>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col p-2.5">
                        <p className="line-clamp-2 text-[0.8125rem] font-extrabold leading-snug text-tinta-900">
                          {m.nama}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[0.6875rem] leading-snug text-tinta-500">
                          {m.deskripsi}
                        </p>

                        {/* Harga + tombol satu baris, rata bawah (`mt-auto`):
                            semua kartu di satu baris grid jadi sejajar. */}
                        <div className="mt-auto flex items-end justify-between gap-1.5 pt-2">
                          <p className="min-w-0 text-[0.8125rem] font-extrabold leading-none text-sela-700">
                            {rupiah(m.harga)}
                            {opsi.some((p) => p.tambah > 0) && (
                              <span className="ml-0.5 align-middle text-[0.5625rem] font-semibold text-tinta-500">
                                +
                              </span>
                            )}
                          </p>

                          {habis ? (
                            <span className="shrink-0 pb-0.5 text-[0.625rem] font-bold text-tinta-500">
                              —
                            </span>
                          ) : diKeranjang ? (
                            <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-forest-900 p-0.5 text-cream-50">
                              {/*
                                ── 44px, BUKAN 28px ──────────────────────

                                Tombol kurangi/tambah sebelumnya 28×28px.
                                Itu di bawah ambang sentuh yang aman (44px,
                                panduan Apple/Material) dan merupakan dua
                                tombol paling sering ditekan di seluruh
                                layar ini — pelanggan menambah porsi sambil
                                memegang ponsel satu tangan, sering sambil
                                mengobrol.

                                Yang berubah: kotak sentuhnya 44px, ikonnya
                                tetap kecil. Angka jumlah ditaruh di antara
                                keduanya dengan `min-w-5` supaya tidak
                                bergeser saat jumlah digitnya bertambah
                                (9 → 10), karena tombol yang bergerak di
                                bawah jari adalah tombol yang salah tekan.
                              */}
                              <button
                                type="button"
                                onClick={() => ubahJumlah(kunciPertama, -1)}
                                aria-label={`Kurangi ${m.nama}`}
                                className="-m-2 grid size-11 place-items-center rounded-full transition hover:bg-cream-50/15 active:bg-cream-50/25"
                              >
                                <IkonKurang className="size-4" />
                              </button>
                              <span className="min-w-5 text-center text-[0.8125rem] font-extrabold tabular-nums">
                                {diKeranjang.jumlah}
                              </span>
                              <button
                                type="button"
                                onClick={() => (opsi.length > 0 ? setPilihUntuk(m) : tambah(m))}
                                aria-label={`Tambah ${m.nama}`}
                                className="-m-2 grid size-11 place-items-center rounded-full transition hover:bg-cream-50/15 active:bg-cream-50/25"
                              >
                                <IkonTambah className="size-4" />
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
                              className="grid size-11 shrink-0 place-items-center rounded-full bg-forest-900 text-cream-50 shadow-[0_4px_12px_-6px_rgb(20_35_26/0.7)] transition hover:bg-forest-800 active:scale-95 disabled:opacity-40"
                            >
                              <IkonTambah className="size-[1.125rem]" />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {daftar.length === 0 && (
          <p className="mt-10 text-center text-[0.8125rem] text-tinta-500">
            Tidak ada menu yang cocok dengan &ldquo;{cari}&rdquo;.
          </p>
        )}

        {/* ── Catatan tambahan: jam buka & info, diletakkan di akhir
             supaya tidak menghalangi menu. */}
        <footer className="mt-8 border-t border-bersih-200 pt-4">
          <p className="text-[0.6875rem] leading-relaxed text-tinta-500">
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
        <div className="fixed inset-x-0 bottom-[4.25rem] z-30 px-3 pb-2">
          <div className="mx-auto flex max-w-[45rem] items-center gap-3 rounded-[1rem] border border-forest-950/30 bg-forest-900 p-2 pl-3 text-cream-50 shadow-[0_14px_34px_-16px_rgb(20_35_26/0.9)]">
            {/*
              DUA BAGIAN, BUKAN SATU TOMBOL BESAR.

              Kiri: ringkasan (jumlah + total) — informasi, tidak bisa ditekan.
              Kanan: satu tombol "Lihat keranjang" yang jelas batasnya.
              Ini mengikuti acuan dan memperbaiki satu hal nyata: sebelumnya
              seluruh bilah adalah tombol, sehingga tamu yang ingin sekadar
              membaca total ikut membuka keranjang.
            */}
            <span className="relative grid size-9 shrink-0 place-items-center rounded-[0.625rem] bg-cream-50/12">
              <IkonKeranjang className="size-4.5" />
              <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-sela-500 px-1 text-[0.625rem] font-extrabold leading-4 text-forest-950">
                {totalItem}
              </span>
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[0.6875rem] font-semibold leading-none text-cream-200/75">
                Total pesanan
              </span>
              <span className="mt-0.5 block text-[0.9375rem] font-extrabold leading-none tabular-nums">
                {rupiah(rincian.total)}
              </span>
            </span>

            <button
              type="button"
              onClick={() => setBukaKeranjang(true)}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-[0.75rem] bg-cream-50 px-3.5 text-[0.8125rem] font-extrabold text-forest-900 transition hover:bg-cream-100 active:scale-[0.98]"
            >
              Lihat keranjang
              <IkonKanan className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/*
        ── NAVIGASI BAWAH ────────────────────────────────────────────────
        Empat tab seperti acuan. Yang benar-benar berfungsi hari ini hanya
        "Beranda" dan "Pesanan"; "Promo" dan "Akun" DIMATIKAN (bukan
        disembunyikan) dengan label "segera" supaya tidak menjadi tombol
        mati yang membingungkan. Menampilkan tab yang tidak melakukan apa
        pun lebih buruk daripada tidak menampilkannya.

        Tab "Pesanan" membuka panel riwayat yang sudah ada — jadi nav ini
        menggantikan tombol "Riwayat pesanan" yang dulu mengambang.
      */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-bersih-200 bg-cream-50/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md print:hidden"
      >
        <ul className="mx-auto flex max-w-[45rem] items-stretch justify-around px-2">
          {[
            { kunci: "beranda", label: "Beranda", Ikon: IkonBeranda, aktif: !riwayatBuka },
            { kunci: "pesanan", label: "Pesanan", Ikon: IkonPesanan, aktif: riwayatBuka },
          ].map(({ kunci, label, Ikon, aktif }) => (
            <li key={kunci} className="flex-1">
              <button
                type="button"
                onClick={() =>
                  kunci === "beranda" ? setRiwayatBuka(false) : setRiwayatBuka(true)
                }
                aria-current={aktif ? "page" : undefined}
                className={[
                  "flex w-full flex-col items-center gap-1 rounded-[0.625rem] py-1.5 text-[0.625rem] font-bold transition",
                  aktif ? "text-forest-900" : "text-tinta-500 hover:text-tinta-700",
                ].join(" ")}
              >
                <Ikon className={aktif ? "size-5" : "size-5 opacity-70"} />
                {label}
              </button>
            </li>
          ))}
          {[
            { kunci: "promo", label: "Promo", Ikon: IkonPromo },
            { kunci: "akun", label: "Akun", Ikon: IkonAkun },
          ].map(({ kunci, label, Ikon }) => (
            <li key={kunci} className="flex-1">
              <span
                aria-disabled="true"
                title={`${label} — segera hadir`}
                className="flex w-full cursor-default flex-col items-center gap-1 py-1.5 text-[0.625rem] font-bold text-tinta-500/45"
              >
                <Ikon className="size-5" />
                {label}
                <span className="sr-only">(segera hadir)</span>
              </span>
            </li>
          ))}
        </ul>
      </nav>


      {/* ── Lembar pilih opsi (sambal / saus / rasa) ──
          Muncul SEBELUM masuk keranjang, bukan sesudah. Kalau pelanggan
          menekan (+) dan barang langsung masuk tanpa ditanya, dapur
          menerima pesanan tanpa saus — persis masalah yang diperbaiki di
          sini. Muncul sebagai lembar bawah supaya jangkauan ibu jari. */}
      {pilihUntuk && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-tinta-900/40">
          <button
            type="button"
            aria-label="Tutup pilihan"
            onClick={() => setPilihUntuk(null)}
            className="flex-1"
          />
          <div className="rounded-t-[1.25rem] bg-bersih-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="mx-auto max-w-[45rem]">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-tinta-500">
                Pilih salah satu
              </p>
              <h2 className="mt-1 text-[1rem] font-extrabold text-tinta-900">{pilihUntuk.nama}</h2>
              <div className="mt-3 space-y-2">
                {opsiDari(pilihUntuk).map((p) => (
                  <button
                    key={p.nama}
                    type="button"
                    onClick={() => {
                      tambah(pilihUntuk, [p]);
                      setPilihUntuk(null);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-[0.625rem] border border-bersih-200 bg-bersih-100 px-3 py-3 text-left transition active:bg-bersih-50"
                  >
                    <span className="text-[0.9375rem] font-bold text-tinta-900">{p.nama}</span>
                    <span className="shrink-0 text-[0.8125rem] font-semibold text-tinta-700">
                      {p.tambah > 0 ? `+${rupiah(p.tambah)}` : "Gratis"}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPilihUntuk(null)}
                className="mt-3 h-11 w-full rounded-[0.625rem] border border-bersih-200 text-[0.8125rem] font-bold text-tinta-700 active:bg-bersih-100"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lembar keranjang ── */}
      {bukaKeranjang && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-tinta-900/40">
          <button
            type="button"
            aria-label="Tutup keranjang"
            onClick={() => setBukaKeranjang(false)}
            className="flex-1"
          />
          <div className="max-h-[88dvh] overflow-y-auto rounded-t-[1.25rem] bg-bersih-0 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(22,19,15,0.24)]">
            <div className="sticky top-0 flex items-center gap-2 border-b border-bersih-200 bg-bersih-0 px-4 py-3">
              <button
                type="button"
                onClick={() => setBukaKeranjang(false)}
                className="grid size-9 place-items-center rounded-[0.625rem] border border-bersih-200 text-tinta-900"
                aria-label="Kembali ke menu"
              >
                <IkonKiri />
              </button>
              <h2 className="flex-1 text-[0.9375rem] font-extrabold text-tinta-900">Keranjang</h2>
              <span className="text-[0.6875rem] font-semibold text-tinta-500">
                Meja {mejaNomor}
              </span>
            </div>

            <div className="px-4">
              {keranjang.length === 0 ? (
                <p className="py-10 text-center text-[0.8125rem] text-tinta-500">
                  Keranjang kosong. Pilih menu dulu.
                </p>
              ) : (
                <ul className="divide-y divide-bersih-100">
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
                          <p className="text-[0.9375rem] font-bold text-tinta-900">{b.menu.nama}</p>
                          {b.pilihan.length > 0 && (
                            <p className="mt-0.5 text-[0.8125rem] font-semibold text-sela-700">
                              {b.pilihan
                                .map((p) => (p.tambah > 0 ? `${p.nama} (+${rupiah(p.tambah)})` : p.nama))
                                .join(", ")}
                            </p>
                          )}
                          <p className="text-[0.8125rem] text-tinta-500">
                            {rupiah(satuan)} × {b.jumlah} ={" "}
                            <span className="font-bold text-tinta-900">
                              {rupiah(satuan * b.jumlah)}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 rounded-[0.625rem] border border-bersih-200 p-0.5">
                          <button
                            type="button"
                            onClick={() => ubahJumlah(kunci, -1)}
                            className="grid size-8 place-items-center rounded-[0.625rem] active:bg-bersih-50"
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
                            className="grid size-8 place-items-center rounded-[0.625rem] active:bg-bersih-50"
                            aria-label={`Tambah ${b.menu.nama}`}
                          >
                            <IkonTambah className="size-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => hapus(kunci)}
                          aria-label={`Hapus ${b.menu.nama}`}
                          className="grid size-8 place-items-center rounded-[0.625rem] text-sela-700 active:bg-sela-600/10"
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
                        className="mt-2 h-9 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-100 px-2.5 text-[0.8125rem] text-tinta-900 outline-none placeholder:text-tinta-500/70 focus:border-forest-700"
                      />
                    </li>
                    );
                  })}
                </ul>
              )}

              {/* ── Data pemesan — WAJIB sejak prabayar ──
                  Dulu opsional karena pesanan dibayar di kasir dan pelayan
                  bisa menanyakan langsung. Sekarang pesanan masuk lebih dulu
                  dari uangnya: tanpa nama dan nomor, kasir tidak punya cara
                  menghubungi tamu bila pembayaran menggantung atau menu
                  yang dipesan ternyata habis. */}
              {keranjang.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label
                      htmlFor="nama-pemesan"
                      className="block text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-tinta-500"
                    >
                      Nama pemesan
                    </label>
                    <input
                      id="nama-pemesan"
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      maxLength={40}
                      autoComplete="name"
                      placeholder="Mis. Rani"
                      className="mt-1 h-11 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-100 px-3 text-[0.8125rem] text-tinta-900 outline-none placeholder:text-tinta-500/70 focus:border-forest-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="no-wa"
                      className="block text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-tinta-500"
                    >
                      Nomor WhatsApp
                    </label>
                    <input
                      id="no-wa"
                      value={noWa}
                      onChange={(e) => setNoWa(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={20}
                      placeholder="0812 3456 7890"
                      className="mt-1 h-11 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-100 px-3 text-[0.8125rem] text-tinta-900 outline-none placeholder:text-tinta-500/70 focus:border-forest-700"
                    />
                    <p className="mt-1 text-[0.6875rem] leading-snug text-tinta-500">
                      Dipakai kasir untuk menghubungi Anda bila ada yang perlu dikonfirmasi.
                      Tidak untuk promosi.
                    </p>
                  </div>
                </div>
              )}

              {/* Rincian biaya (P-14). Pajak ditampilkan sebagai baris
                  terpisah, bukan dilipat ke harga, karena pelanggan berhak
                  tahu ke mana uangnya pergi sebelum membayar di kasir. */}
              {keranjang.length > 0 && (
                <dl className="mt-4 space-y-1.5 rounded-[0.625rem] bg-bersih-100 p-3 text-[0.8125rem]">
                  <div className="flex justify-between">
                    <dt className="text-tinta-500">Subtotal</dt>
                    <dd className="font-semibold text-tinta-900">{rupiah(rincian.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-tinta-500">Biaya layanan</dt>
                    <dd className="font-semibold text-tinta-900">{rupiah(rincian.layanan)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-tinta-500">Pajak {aturan.pajakPersen}%</dt>
                    <dd className="font-semibold text-tinta-900">{rupiah(rincian.pajak)}</dd>
                  </div>
                  {rincian.pembulatan !== 0 && (
                    <div className="flex justify-between">
                      <dt className="text-tinta-500">Pembulatan</dt>
                      <dd className="font-semibold text-tinta-900">
                        {rincian.pembulatan > 0 ? "+" : ""}
                        {rupiah(rincian.pembulatan)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-bersih-200 pt-1.5">
                    <dt className="font-extrabold text-tinta-900">Perkiraan total</dt>
                    <dd className="text-[0.9375rem] font-extrabold text-tinta-900">
                      {rupiah(rincian.total)}
                    </dd>
                  </div>
                </dl>
              )}

              {pesanGalat && (
                <div
                  ref={refGalat}
                  role="alert"
                  className="mt-3 rounded-[0.625rem] border border-sela-200 bg-sela-50 p-3"
                >
                  <p className="text-[0.8125rem] font-semibold leading-snug text-sela-800">
                    {pesanGalat}
                  </p>
                </div>
              )}

              {/* ── PILIHAN METODE PEMBAYARAN ──
                  Dua kartu, bukan dua tombol kecil: pilihan ini menentukan
                  apa yang tamu harus LAKUKAN setelah menekan kirim, jadi
                  konsekuensinya harus terbaca sebelum memilih. */}
              {keranjang.length > 0 && (
                <fieldset className="mt-4">
                  <legend className="mb-2 block text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-tinta-500">
                    Metode pembayaran
                  </legend>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {(Object.keys(METODE_BAYAR) as ("online" | "kasir")[]).map((k) => {
                      const m = METODE_BAYAR[k];
                      const aktif = metode === k;
                      return (
                        <label
                          key={k}
                          className={[
                            "relative flex cursor-pointer gap-2.5 rounded-[0.625rem] border-2 p-3 transition",
                            aktif
                              ? "border-forest-700 bg-forest-700/[0.06]"
                              : "border-bersih-200 bg-bersih-100 hover:border-forest-700/40",
                          ].join(" ")}
                        >
                          <input
                            type="radio"
                            name="metode-bayar"
                            value={k}
                            checked={aktif}
                            onChange={() => setMetode(k)}
                            className="sr-only"
                          />
                          {/* Penanda pilihan: lingkaran dengan titik di tengah. */}
                          <span
                            aria-hidden
                            className={[
                              "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2",
                              aktif ? "border-forest-700" : "border-tinta-500/40",
                            ].join(" ")}
                          >
                            {aktif && <span className="size-2 rounded-full bg-forest-700" />}
                          </span>

                          <span className="min-w-0">
                            <span className="block text-[0.875rem] font-extrabold text-tinta-900">
                              {m.judul}
                            </span>
                            <span className="mt-0.5 block text-[0.75rem] leading-snug text-tinta-500">
                              {m.detail}
                            </span>
                            <span className="mt-1 block text-[0.6875rem] font-semibold leading-snug text-forest-700">
                              {m.catatan}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/*
                    Pesanan yang memilih kasir TIDAK boleh kedaluwarsa dalam
                    15 menit. Tanpa penjelasan ini, tamu yang memilih kasir
                    dan baru datang membayar 20 menit kemudian akan menemukan
                    pesanannya sudah batal — dan itu terasa seperti jebakan.
                  */}
                  <p className="mt-2 text-[0.6875rem] leading-snug text-tinta-500">
                    {metode === "kasir"
                      ? "Pesanan disiapkan setelah Anda membayar di kasir. Batas waktunya 15 menit."
                      : "Pesanan disiapkan setelah pembayaran diterima. Batas waktunya 15 menit."}
                  </p>
                </fieldset>
              )}

              <button
                type="button"
                onClick={kirim}
                disabled={!bisaKirim}
                className="tombol-utama mt-4 h-14 w-full text-[0.9375rem]"
              >
                {labelKirim}
                {bisaKirim && <IkonKanan />}
              </button>
              {/*
                ── MENGAPA TOMBOLNYA MATI ────────────────────────────────

                Label tombol sebelumnya hanya menyebut SATU sebab: metode
                pembayaran belum dipilih. Nama dan nomor WA yang kosong —
                dua isian yang wajib — tidak disebut sama sekali, jadi
                tamu yang mengisi keduanya melihat tombol mati berlabel
                "Pilih metode pembayaran", memilih metode, dan tombolnya
                TETAP mati tanpa penjelasan.

                Baris di bawah menyebut persis apa yang kurang, per
                langkah, dan menghilang begitu semuanya lengkap. Ditulis
                sebagai teks, bukan tooltip: di ponsel tidak ada hover.
              */}
              {kurang.length > 0 ? (
                <p className="mt-2 pb-1 text-center text-[0.75rem] font-semibold leading-snug text-sela-800">
                  Lengkapi dulu: {kurang.join(" · ")}
                </p>
              ) : (
                <p className="mt-2 pb-1 text-center text-[0.6875rem] leading-snug text-tinta-500">
                  Pesanan diteruskan ke kasir dan dapur setelah pembayaran diterima.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * Satu kartu pesanan di daftar tamu.
 *
 * Dipakai DUA tempat — "Pesanan Anda" (yang masih berjalan) dan "Riwayat".
 * Dulu blok ini ditulis langsung di dalam JSX dan hanya ada satu salinan;
 * begitu riwayat ditambahkan, salinan kedua pasti lahir, lalu keduanya
 * menyimpang (satu menampilkan invoice, satu lupa).
 */
function KartuPesanan({
  pesanan: p,
  sesi,
}: {
  pesanan: StatusPesananPelanggan;
  sesi: string;
}) {
  /*
    Pesanan yang belum lunas TIDAK boleh memakai label dapur. "Menunggu
    kasir" pada pesanan yang belum dibayar membuat tamu mengira pesanannya
    sedang diproses, padahal dapur belum melihatnya sama sekali — dan itu
    sumber keluhan "pesanan saya kok belum datang".
  */
  const belumLunas = p.status_bayar && p.status_bayar !== "lunas";
  const l = belumLunas
    ? (LABEL_BAYAR[p.status_bayar as StatusBayar] ?? {
        judul: "Menunggu pembayaran",
        detail: "",
      })
    : (LABEL[p.status] ?? { judul: p.status, detail: "" });
  const selesai = belumLunas
    ? ["kedaluwarsa", "gagal", "dikembalikan"].includes(p.status_bayar)
    : ["diantar", "ditolak", "dibatalkan"].includes(p.status);

  return (
    <div
      className={[
        "rounded-[0.625rem] border px-3 py-2.5",
        selesai
          ? "border-bersih-200 bg-bersih-100"
          : "border-bersih-200 bg-bersih-0 shadow-[0_1px_2px_rgb(22_19_15/0.04)]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] font-extrabold text-tinta-900">{l.judul}</p>
        <span className="shrink-0 font-mono text-[0.6875rem] text-tinta-500">{p.nomor}</span>
      </div>
      <p className="mt-0.5 text-[0.8125rem] leading-snug text-tinta-500">
        {l.detail} · {p.total_item} item
      </p>
      {/*
        Invoice tersedia untuk SETIAP pesanan, lunas atau belum, dan tetap
        bisa dibuka berkali-kali — invoice menempel pada pesanannya, bukan
        pada satu momen setelah pembayaran. Tamu yang memilih bayar di
        kasir justru butuh dokumennya SEBELUM membayar.
      */}
      <a
        href={`/order/invoice/${p.id}?sesi=${encodeURIComponent(sesi)}`}
        className="mt-1 inline-block text-[0.75rem] font-bold text-forest-700 underline"
      >
        Lihat invoice
      </a>
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
        "shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold transition",
        aktif
          ? "bg-forest-900 text-cream-50 shadow-[0_4px_12px_-6px_rgb(20_35_26/0.6)]"
          : "border border-bersih-200 bg-bersih-0 text-tinta-700 hover:bg-bersih-100 active:bg-bersih-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
