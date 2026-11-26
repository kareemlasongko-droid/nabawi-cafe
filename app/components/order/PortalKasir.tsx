"use client";

/**
 * Portal kasir — tablet landscape.
 *
 * KEPUTUSAN DESAIN
 *
 * 1. Dua kolom tetap: kiri antrean pesanan baru, kanan meja + tagihan.
 *    Kasir mengerjakan dua hal bergantian (menerima pesanan, menerima
 *    pembayaran), jadi keduanya harus terlihat bersamaan tanpa tab.
 *    Di layar sempit kolom ditumpuk, tetapi ini portal tablet.
 *
 * 2. Antrean baru SELALU paling atas dan memakai latar paling kontras.
 *    Kasir punya ~1 menit untuk menerima (metrik PRD). Yang butuh reaksi
 *    cepat harus berada di posisi pertama yang dilihat mata, bukan di
 *    bawah setelah daftar meja.
 *
 * 3. Tombol besar dan berjarak, minimal 48px. Ini bukan soal estetika:
 *    kasir menekan sambil berdiri dan kadang sambil berbicara.
 *
 * 4. Angka uang memakai tabular-nums dan rata kanan, supaya kolom total
 *    bisa dipindai vertikal. Teks pemasaran tidak ada di sini.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  rupiah,
  sejak,
  type Meja,
  type Menu,
  type Tagihan,
} from "@/app/lib/order/tipe";
import { BilahKoneksi } from "./BilahKoneksi";
import { KartuProduk } from "./KartuProduk";
import { BilahStaf } from "./Kerangka";
import { Sidebar } from "./Sidebar";
import { TombolKepala } from "./TombolKepala";
import {
  IkonCentang,
  IkonSilang,
  IkonJam,
  IkonMeja,
  IkonMuatUlang,
  IkonSuara,
  IkonMatikanSuara,
  IkonPesanan,
  IkonBill,
  IkonPromo,
  IkonMenu,
  IkonCari,
  IkonKategoriMenu,
  IkonPanah,
} from "./Ikon";
import { BukaInvoice } from "./LembarInvoice";
import { KartuRingkasan } from "./KartuRingkasan";
import { DaftarRiwayat } from "./DaftarRiwayat";
import type { BarisRiwayat, RingkasanPenjualan } from "@/app/lib/order/riwayat";
import { DiagramPenjualan } from "./DiagramPenjualan";

type ItemPesanan = {
  id: number;
  nama_saat_pesan: string;
  jumlah: number;
  harga_satuan: number;
  catatan: string | null;
  pilihan?: { nama: string; tambah: number }[] | null;
};

type PesananK = {
  id: number;
  /** Sejak prabayar: 'menunggu' | 'lunas' | … — menentukan tampil di dapur. */
  status_bayar?: string;
  no_wa?: string | null;
  nomor: string;
  meja_id: number;
  meja_nomor: string;
  status: string;
  nama_pemesan: string | null;
  total_item: number;
  created_at: string;
  items: ItemPesanan[];
};

/** Satu baris di struk: nama, jumlah, harga satuan, harga baris. */
type BarisStruk = {
  nama: string;
  /** Opsi yang dipilih; kosong bila menu tidak punya pilihan. */
  pilihan?: { nama: string; tambah: number }[] | null;
  jumlah: number;
  harga_satuan: number;
  harga_baris: number;
};

type MejaKasir = Meja & {
  tagihan: Tagihan | null;
  /** Item milik tagihan meja ini — dipakai struk, bukan tabel antrean. */
  items_tagihan?: BarisStruk[];
};

/**
 * Pesanan yang BELUM dibayar.
 *
 * Ditampilkan terpisah dari antrean dapur, dan hanya di kasir. Tujuannya
 * satu: kasir bisa menagih tunai di meja tanpa berpindah aplikasi. Pesanan
 * di sini TIDAK pernah masuk tiket dapur sampai uangnya diterima.
 */
type MenungguBayar = {
  id: number;
  nomor: string;
  meja_id: number;
  meja_nomor: string;
  nama_pemesan: string | null;
  no_wa: string | null;
  total_item: number;
  created_at: string;
  kedaluwarsa_at: string | null;
  /** Pilihan tamu: "online" atau "kasir". */
  metode_bayar: string | null;
  /** Total tagihannya. null = pesanan lama tanpa tagihan (bukan Rp0). */
  total: number | null;
};

type DataKasir = {
  pesanan: PesananK[];
  menunggu_bayar?: MenungguBayar[];
  meja: MejaKasir[];
  menu?: Menu[];
  kategori?: { id: number; nama: string }[];
  aturan: { pajakPersen: number; layananPersen: number; layananRp: number; pembulatan: number };
  demo: boolean;
};


/**
 * Nama tiap panel, dipakai kepala layar dan sidebar.
 *
 * Satu daftar, bukan dua: label yang ditulis ulang di dua tempat akan
 * menyimpang begitu salah satunya diubah — dan yang paling sulit
 * ditemukan adalah judul kepala yang menyebut panel berbeda dari yang
 * sedang terbuka.
 */
const LABEL_LAYAR: Record<"antrean" | "meja" | "menu" | "laporan" | "riwayat", string> = {
  antrean: "Antrean",
  meja: "Meja",
  menu: "Menu",
  laporan: "Laporan",
  riwayat: "Riwayat",
};

export function PortalKasir() {
  const [data, setData] = useState<DataKasir | null>(null);
  const [galat, setGalat] = useState("");
  const [mejaPilih, setMejaPilih] = useState<string | null>(null);
  const [alasanTolak, setAlasanTolak] = useState<{ id: number; buka: boolean }>({
    id: 0,
    buka: false,
  });
  const [sedang, setSedang] = useState(false);
  const [suara, setSuara] = useState(true);
  const [bayar, setBayar] = useState<{ tagihan: Tagihan; meja: string } | null>(null);
  const [menuHabisBuka, setMenuHabisBuka] = useState(false);
  const [menuSibuk, setMenuSibuk] = useState(0);
  /**
   * Pesanan yang invoice-nya sedang dibuka.
   *
   * Hanya ID yang disimpan di sini. Pengambilan dan penampilannya
   * diserahkan ke `<BukaInvoice>` — komponen yang SAMA dipakai daftar
   * riwayat di bawah. Dua salinan modal invoice akan menyimpang pada
   * penanganan galat dan cara menutupnya.
   */
  const [invoiceId, setInvoiceId] = useState<number | null>(null);

  /** Rangkuman penjualan hari ini + riwayat pesanan (lihat /api/order/riwayat). */
  const [ringkasan, setRingkasan] = useState<RingkasanPenjualan | null>(null);
  const [pesanRingkasan, setPesanRingkasan] = useState("");
  /*
    `memuatLaporan` membedakan "sedang mengambil" dari "gagal dibaca".
    Tanpa ini, tab Laporan menampilkan pesan KEGAGALAN selama satu detik
    setiap kali dibuka — dan kasir mengira laporannya rusak.
  */
  const [memuatLaporan, setMemuatLaporan] = useState(false);
  const [riwayat, setRiwayat] = useState<BarisRiwayat[]>([]);
  const [pesanRiwayat, setPesanRiwayat] = useState("");
  /*
    ── SATU TAB AKTIF, BUKAN BEBERAPA BAGIAN TERBUKA SEKALIGUS ─────────

    Dulu layar ini menggulung dari atas: "Belum dibayar", antrean, denah
    meja, lalu rangkuman penjualan dan riwayat di bawahnya. Semuanya ada,
    tetapi untuk mencapai riwayat kasir harus menggulir melewati denah 10
    meja — dan setelah menggulir, antrean yang sedang ditangani hilang dari
    pandangan.

    Sekarang tiap tab adalah satu pekerjaan. `layar` menyimpan pekerjaan
    yang sedang dibuka; `mejaPilih` tetap terpisah karena ia BUKAN tab,
    melainkan pilihan di dalam tab Antrean.
  */
  const [layar, setLayar] = useState<"antrean" | "meja" | "menu" | "laporan" | "riwayat">("antrean");
  /*
    Kapan pembaruan terakhir BERHASIL. `null` = belum pernah sejak halaman
    dibuka, yang jauh lebih gawat daripada gagal sekali.
    Dipakai bilah peringatan untuk menyebut umur data ("40 detik lalu").
  */
  const [berhasilPada, setBerhasilPada] = useState<number | null>(null);
  const [memuatUlang, setMemuatUlang] = useState(false);
  const [detak, setDetak] = useState(() => Date.now());
  /** Kata kunci panel Menu. */
  const [cariMenu, setCariMenu] = useState("");
  /*
    ── SIAPA YANG MENERIMA UANG ────────────────────────────────────────

    Nama kasir masuk ke kolom `oleh` setiap pembayaran dan setiap
    perubahan status. Sebelumnya nilainya selalu literal "kasir", jadi
    jejak audit berbunyi "kasir" untuk tiga orang berbeda dalam satu
    shift — tidak berguna saat laci kurang Rp50.000 dan pemilik perlu
    tahu siapa yang menutup transaksi.

    Diingat di localStorage per perangkat: kasir mengetiknya sekali di
    awal shift, bukan sebelum tiap tamu. Kalau kosong, rantai ini tetap
    berjalan dengan "kasir" — nama yang tidak diketahui tidak boleh
    menghentikan penagihan.
  */
  /** id menu yang sedang diubah — `null` = tidak ada dialog. */
  const [menuUbah, setMenuUbah] = useState<number | null>(null);
  const [namaKasir, setNamaKasir] = useState("");
  /*
    Sidebar terbuka/tertutup. Disimpan di localStorage: kasir yang lebih
    suka layar lebar tidak perlu melipat ulang setiap kali membuka
    halaman — dan yang butuh sidebar (staf baru) tidak kehilangannya
    karena orang lain pernah melipatnya di perangkat yang sama.

    Dibaca di effect, bukan saat inisialisasi state: `localStorage` tidak
    ada di server, dan membaca di sana membuat markup server berbeda dari
    klien (hydration mismatch).
  */
  const [sidebarTerbuka, setSidebarTerbuka] = useState(true);
  useEffect(() => {
    try {
      const simpan = window.localStorage.getItem("nabawi.sidebar");
      if (simpan === "tutup") setSidebarTerbuka(false);
    } catch {
      /* mode privat: biarkan terbuka */
    }
  }, []);

  function toggleSidebar() {
    setSidebarTerbuka((v) => {
      const baru = !v;
      try {
        window.localStorage.setItem("nabawi.sidebar", baru ? "buka" : "tutup");
      } catch {
        /* abaikan */
      }
      return baru;
    });
  }
  const [ubahNama, setUbahNama] = useState(false);

  /*
    Dibaca di effect, bukan di `useState(() => ...)`: `localStorage` tidak
    ada saat server merender komponen ini, dan membacanya di inisialisasi
    membuat markup server dan klien berbeda (hydration mismatch).
  */
  useEffect(() => {
    try {
      setNamaKasir(window.localStorage.getItem("nabawi.kasir") ?? "");
    } catch {
      /* Mode privat / storage diblokir: tetap jalan tanpa nama. */
    }
  }, []);

  const oleh = namaKasir.trim() || "kasir";

  /*
    ── PENANDA AKTIF = LAYAR YANG DIPILIH ──────────────────────────────

    Dulu penanda mengikuti panel yang terlihat saat menggulir, karena
    kelima panel ditumpuk di satu halaman. Sekarang hanya satu panel
    dirender, jadi tidak ada yang perlu diamati: `layar` adalah
    kebenarannya, dan sidebar membacanya langsung.
  */

  function simpanNamaKasir(nama: string) {
    const bersih = nama.trim().slice(0, 40);
    setNamaKasir(bersih);
    try {
      if (bersih) window.localStorage.setItem("nabawi.kasir", bersih);
      else window.localStorage.removeItem("nabawi.kasir");
    } catch {
      /* abaikan */
    }
  }
  /** id pesanan yang sedang dicatat pembayarannya — mencegah ketuk ganda. */
  const [memproses, setMemproses] = useState<number | null>(null);

  const jumlahLalu = useRef(0);

  /*
    Persentase pajak & layanan TIDAK lagi dibaca di sini.

    Dulu keduanya diteruskan ke struk supaya tercetak "PPN 11%". Sejak
    invoice punya sumber datanya sendiri, komponen itu mencetak RUPIAH dari
    baris `tagihan` — angka yang benar-benar ditagihkan. Persentase hanya
    berguna bila tarif berubah dan invoice lama ikut berubah, dan itu justru
    yang tidak boleh terjadi pada bukti pembayaran.
  */

  const muat = useCallback(async () => {
    try {
      const res = await fetch("/api/order/kasir", { cache: "no-store" });
      const j = (await res.json()) as DataKasir & { pesan?: string };
      if (!res.ok) {
        setGalat(j.pesan ?? "Gagal memuat data kasir.");
        return;
      }
      setGalat("");
      setBerhasilPada(Date.now());
      setData(j);
    } catch {
      setGalat("Koneksi ke server terputus. Pesanan baru tidak akan masuk sampai pulih.");
    }
  }, []);

  /**
   * Muat rangkuman & riwayat.
   *
   * Dipisah dari `muat()` dan TIDAK ikut polling 4 detik: rangkuman
   * penjualan tidak berubah cukup sering untuk itu, dan setiap polling
   * menambah dua kueri agregat ke database — di jaringan kafe, itu
   * ongkos nyata untuk angka yang sama. Dimuat saat layar dibuka, setiap
   * kali pembayaran berhasil, dan saat tab riwayat dibuka.
   */
  const muatRiwayat = useCallback(async () => {
    setMemuatLaporan(true);
    try {
      const res = await fetch("/api/order/riwayat", { cache: "no-store" });
      const j = (await res.json()) as {
        ringkasan?: RingkasanPenjualan | null;
        pesan_ringkasan?: string;
        riwayat?: BarisRiwayat[];
        pesan_riwayat?: string;
        pesan?: string;
      };
      if (!res.ok) {
        setPesanRingkasan(j.pesan ?? "Rangkuman belum bisa dibaca.");
        setPesanRiwayat(j.pesan ?? "Riwayat belum bisa dibaca.");
        return;
      }
      setRingkasan(j.ringkasan ?? null);
      setPesanRingkasan(j.pesan_ringkasan ?? "");
      setRiwayat(j.riwayat ?? []);
      setPesanRiwayat(j.pesan_riwayat ?? "");
    } catch {
      setPesanRingkasan("Koneksi terputus. Rangkuman belum diperbarui.");
      setPesanRiwayat("Koneksi terputus. Riwayat belum diperbarui.");
    } finally {
      setMemuatLaporan(false);
    }
  }, []);

  /*
    ── BERHENTI MENEMBAK SAAT GAGAL ────────────────────────────────────

    Dulu 4 detik terus-menerus, apa pun yang terjadi. Server yang sudah
    menjawab 500 akan ditembak 15 kali per menit dari setiap tablet kasir
    yang terbuka — di jaringan kafe yang memakai hotspot, itu ongkos
    kuota nyata yang tidak mempercepat apa pun.

    Sekarang 12 detik saat galat (tetap berusaha pulih sendiri), dan
    tombol "Muat ulang" di bilah peringatan memberi pemulihan seketika.
    `detak` membuat umur data ikut berdetak walau polling melambat.
  */
  useEffect(() => {
    muat();
    muatRiwayat();
    const t = setInterval(muat, galat ? 12000 : 4000);
    const d = setInterval(() => setDetak(Date.now()), 5000);
    return () => {
      clearInterval(t);
      clearInterval(d);
    };
  }, [muat, muatRiwayat, galat]);

  /**
   * Catat pembayaran tunai untuk satu pesanan.
   *
   * `uang_pas: true` — kasir tidak memasukkan nominal di kartu ini; tombol
   * ini untuk tamu yang sudah menyiapkan uang pas. Server yang membaca
   * total dari database. JANGAN mengirim angka besar sebagai "nominal
   * tak terbatas": kembalian yang tercatat akan ikut salah, dan itu
   * merusak laporan kas di akhir hari.
   */
  /**
   * Buka dialog pelunasan untuk meja tertentu.
   *
   * Dipakai tombol "Uang lebih": kasir memasukkan nominal yang diterima,
   * kembalian dihitung. Dialog ini sudah ada untuk denah meja; di sini
   * dipanggil dari kartu "Belum dibayar" supaya kasir tidak perlu mencari
   * mejanya dulu di denah.
   */
  const bukaPelunasan = useCallback(
    (mejaId: number) => {
      const m = data?.meja.find((x) => x.id === mejaId);
      if (!m?.tagihan) {
        setGalat("Meja ini belum punya tagihan terbuka.");
        return;
      }
      // `mejaPilih` menyimpan NOMOR meja (sama seperti klik di denah),
      // bukan id. Membandingkan id dengan nomor akan membuka kartu meja
      // yang salah — dan kasir menagih tamu di meja lain.
      setMejaPilih(m.nomor);
      setBayar({ tagihan: m.tagihan, meja: m.nomor });
    },
    [data]
  );

  const bayarTunai = useCallback(
    async (p: MenungguBayar) => {
      if (memproses !== null) return;

      /*
        ── KONFIRMASI DI DALAM APLIKASI, BUKAN window.confirm ──────────

        `window.confirm` tidak bisa menampilkan rincian tagihan, tidak
        bisa di-style, dan di iOS memblokir seluruh UI sehingga polling
        berhenti. Kasir mengonfirmasi uang tanpa melihat apa yang dibayar
        — pada tagihan Rp146.600 itu perbedaan yang membuat kasir salah
        menyebut angka di depan tamu.

        Sekarang konfirmasinya membuka lembar yang sama dengan "Uang
        lebih", tetapi sudah terisi nominal pas. Kasir melihat rincian,
        menekan satu tombol, dan kembaliannya tercatat nol.
      */
      const tagihanMeja = data?.meja.find((m) => m.id === p.meja_id)?.tagihan;
      if (tagihanMeja) {
        setBayar({ tagihan: tagihanMeja, meja: p.meja_nomor });
        return;
      }

      /*
        Tidak ada tagihan di meja ini (mis. datanya belum tersinkron).
        Jatuh ke jalur lama — tetap boleh, tetapi tetap lewat satu
        konfirmasi yang menyebut nomor pesanan dan jumlahnya.
      */
      const teks = `${p.total_item} item · ${p.nama_pemesan ?? "tanpa nama"}`;
      if (!window.confirm(`Terima uang pas untuk ${p.nomor} (${teks})?`)) return;

      setMemproses(p.id);
      try {
        // Nominal uang pas: total tagihan tidak dikirim dari sini. Server
        // yang membacanya dari database, lalu menolak bila kurang.
        const res = await fetch("/api/order/kasir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            aksi: "bayar_tunai",
            pesanan_id: p.id,
            uang_pas: true,
            oleh,
          }),
        });
        const j = (await res.json()) as { pesan?: string };
        if (!res.ok) {
          setGalat(j.pesan ?? "Pembayaran tunai gagal dicatat.");
          return;
        }
        setGalat("");
        await muat();
        /*
          Rangkuman ikut disegarkan: omzet yang tidak berubah setelah kasir
          menerima uang akan terlihat seperti pembayaran yang gagal
          tercatat.
        */
        muatRiwayat();
        /*
          Invoice dibuka SETELAH `muat()`: daftar di layar sudah bersih
          dari pesanan yang barusan dibayar, jadi tidak ada tombol basi
          yang masih bisa ditekan.
        */
        setInvoiceId(p.id);
      } catch {
        setGalat("Koneksi terputus. Pembayaran belum tercatat.");
      } finally {
        setMemproses(null);
      }
    },
    [memproses, muat, muatRiwayat]
  );


  /** Umur data terakhir, dihitung ulang tiap `detak` (5 dtk). */
  const umurData =
    berhasilPada === null ? null : Math.max(0, Math.floor((detak - berhasilPada) / 1000));

  async function muatUlangManual() {
    setMemuatUlang(true);
    try {
      await muat();
    } finally {
      setMemuatUlang(false);
    }
  }

  // Bunyi untuk pesanan baru (K-01). Nada dibuat dengan WebAudio, bukan
  // file audio: tidak ada aset yang perlu diunduh di sinyal lemah.
  const baru = data?.pesanan.filter((p) => p.status === "menunggu_konfirmasi").length ?? 0;
  useEffect(() => {
    if (!data) return;
    /*
      `jumlahLalu.current > 0` DIHAPUS.

      Syarat itu membuat pesanan pertama setelah halaman dibuka tidak
      pernah berbunyi — persis pesanan yang paling perlu didengar, karena
      kasir baru saja membuka layar dan belum melihat apa pun. Yang
      dihindari syarat itu adalah bunyi saat halaman dimuat dengan
      pesanan yang sudah ada sebelumnya; sekarang itu ditangani dengan
      `siap` (lihat di bawah), bukan dengan membisukan kasus terpenting.
    */
    if (baru > jumlahLalu.current && suara) {
      bunyi(880, 0.12);
      setTimeout(() => bunyi(1180, 0.14), 130);
    }
    jumlahLalu.current = baru;
  }, [baru, suara, data]);

  async function ubah(id: number, ke: string, alasan?: string) {
    setSedang(true);
    try {
      const res = await fetch("/api/order/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ke, alasan, oleh }),
      });
      const j = await res.json();
      if (!res.ok) {
        setGalat(j.pesan ?? "Gagal mengubah status.");
        return;
      }
      await muat();
    } catch {
      setGalat("Koneksi terputus saat mengubah status.");
    } finally {
      setSedang(false);
    }
  }

  /**
   * K-08 — tandai menu habis / tersedia lagi.
   *
   * Perubahan diterapkan optimistis di layar lalu dikembalikan bila server
   * menolak. Kasir menekan tombol ini sambil berdiri di depan tamu; menunggu
   * satu putaran polling (4 detik) membuat tombol terasa tidak bekerja dan
   * kasir menekannya berkali-kali.
   */
  async function setTersedia(menuId: number, tersedia: boolean) {
    setMenuSibuk(menuId);
    setData((d) =>
      d?.menu
        ? { ...d, menu: d.menu.map((m) => (m.id === menuId ? { ...m, tersedia } : m)) }
        : d
    );
    try {
      const res = await fetch("/api/order/kasir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "set_tersedia", menu_id: menuId, tersedia, oleh }),
      });
      const j = await res.json();
      if (!res.ok) {
        setGalat(j.pesan ?? "Gagal menandai menu.");
        await muat();
        return;
      }
      setGalat("");
    } catch {
      setGalat("Koneksi terputus. Ketersediaan menu belum berubah.");
      await muat();
    } finally {
      setMenuSibuk(0);
    }
  }

  const antrean = useMemo(
    () => (data?.pesanan ?? []).filter((p) => p.status === "menunggu_konfirmasi"),
    [data]
  );

  /*
    Pesanan yang belum dibayar. SENGAJA TIDAK digabung ke `antrean`:
    antrean adalah pekerjaan yang boleh dikerjakan sekarang, sedangkan ini
    adalah pekerjaan yang menunggu uang. Menggabungkannya membuat kasir
    menerima pesanan yang belum lunas karena keduanya tampak sama.
  */
  const menungguBayar = data?.menunggu_bayar ?? [];
  const diproses = useMemo(
    () => (data?.pesanan ?? []).filter((p) => ["diterima", "diproses", "siap"].includes(p.status)),
    [data]
  );

  const mejaTerpilih = data?.meja.find((m) => m.nomor === mejaPilih) ?? null;

  /*
    Meja yang punya pesanan atau tagihan terbuka. Dipakai strip status:
    satu angka yang menjawab "berapa meja sedang sibuk" tanpa kasir
    memindai 20 kotak denah.
  */
  const mejaTerisi = useMemo(
    () => (data?.meja ?? []).filter((m) => m.status !== "kosong" || m.tagihan !== null).length,
    [data?.meja]
  );

  const menu = data?.menu ?? [];
  const habis = useMemo(() => menu.filter((m) => !m.tersedia), [menu]);

  /*
    Bentuk kartu produk.

    `kategori` dicari dari data.kategori lewat id — bukan disalin ke
    tiap baris menu di API, karena satu kategori dipakai puluhan menu
    dan menyalin namanya 126 kali hanya membengkakkan respons.
  */
  const petaKategori = useMemo(() => {
    const m = new Map<number, string>();
    for (const k of data?.kategori ?? []) m.set(k.id, k.nama);
    return m;
  }, [data?.kategori]);

  const menuProduk = useMemo(
    () =>
      menu.map((m) => ({
        id: m.id,
        nama: m.nama,
        harga: m.harga,
        kategori: m.kategori_id ? (petaKategori.get(m.kategori_id) ?? "") : "",
        tersedia: m.tersedia,
        rekomendasi: m.rekomendasi === true,
        foto_url: m.foto_url ?? null,
        kategori_id: m.kategori_id ?? null,
        jumlahPilihan: Array.isArray(m.pilihan) ? m.pilihan.length : 0,
      })),
    [menu, petaKategori],
  );

  const menuTersaring = useMemo(() => {
    const k = cariMenu.trim().toLowerCase();
    if (!k) return menuProduk;
    return menuProduk.filter(
      (m) => m.nama.toLowerCase().includes(k) || m.kategori.toLowerCase().includes(k),
    );
  }, [menuProduk, cariMenu]);

  return (
    /*
      ── KERANGKA DASHBOARD: SIDEBAR + AREA KERJA ─────────────────────

      Sebelumnya: satu kolom dengan nav bawah. Nav bawah benar untuk
      layar sempit sekali, tetapi di tablet 10" dan desktop ia memaksa
      korteks membaca dari atas ke bawah untuk berpindah pekerjaan —
      dan di portal yang dipakai sepanjang jam kerja, itu gesekan yang
      berulang ratusan kali per shift.

      Kerangka baru:

        HP (<768px)      rail ikon 72px | isi
        Tablet (≥768px)  sidebar 232px | isi
        Desktop (≥1280)  sidebar 256px | isi

      Sidebar `sticky top-0 h-dvh`, jadi tetap terlihat saat isi
      digulir, dan tidak pernah ikut ter-print (struk/invoice dicetak
      dari halaman yang sama).

      `min-w-0` pada kolom isi WAJIB: tanpa itu, flex item menolak
      mengecil di bawah lebar isinya, dan grid kartu melebar melewati
      layar — persis bug horizontal-scroll yang paling sering muncul
      saat sidebar dipasang.
    */
    <div className="flex min-h-dvh bg-cream-50">
      <Sidebar
        judul="Kasir"
        aktif={layar}
        terbuka={sidebarTerbuka}
        onToggle={toggleSidebar}
        onPilih={(k) => {
          setLayar(k as typeof layar);
          /*
            Gulir ke atas saat berpindah layar. Tanpa ini, kasir yang
            menggulir jauh di panel Menu lalu memilih Antrean akan
            mendarat di tengah panel baru — dan mengira isinya kosong.
          */
          window.scrollTo({ top: 0 });
        }}
        item={[
          {
            kunci: "antrean",
            label: LABEL_LAYAR.antrean,
            href: "#antrean",
            Ikon: IkonPesanan,
            lencana: antrean.length + menungguBayar.length,
            warna: "sela",
          },
          { kunci: "meja", label: LABEL_LAYAR.meja, href: "#meja", Ikon: IkonMeja },
          { kunci: "menu", label: LABEL_LAYAR.menu, href: "#menu", Ikon: IkonMenu },
          { kunci: "laporan", label: LABEL_LAYAR.laporan, href: "#laporan", Ikon: IkonBill },
          { kunci: "riwayat", label: LABEL_LAYAR.riwayat, href: "#riwayat", Ikon: IkonJam },
        ]}
        kaki={
          <>
          {/*
            Penanda kasir bertugas. Di layar ≥768px tampil nama; di rail
            72px hanya inisial, karena nama lengkap tidak muat dan akan
            terpotong jadi dua huruf acak.
          */}
          <button
            type="button"
            onClick={() => setUbahNama(true)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[0.5rem] text-[0.8125rem] font-bold text-cream-50/70 transition hover:bg-cream-50/10 hover:text-cream-50 md:justify-start md:px-3"
          >
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center rounded-full bg-cream-50/15 text-[0.6875rem] font-extrabold uppercase text-cream-50"
            >
              {oleh.slice(0, 2)}
            </span>
            <span className="hidden min-w-0 flex-1 truncate text-left md:inline">{oleh}</span>
            <span className="sr-only">— ubah nama kasir</span>
          </button>
          {/*
            Sakelar bunyi DIHAPUS dari sini.

            Ia dulu ada di dua tempat sekaligus — kaki sidebar dan kepala
            layar. Dua tombol untuk satu keadaan bukan hanya mubazir: kasir
            yang mematikan bunyi dari sidebar lalu melihat tombol kepala
            masih menyala akan mengira bunyinya masih hidup, lalu
            melewatkan pesanan masuk. Satu keadaan, satu tombol, di kepala.
          */}
          </>
        }
      />

      {/* ── AREA KERJA ── */}
      <div className="flex min-w-0 flex-1 flex-col">
      {/*
        ── KEPALA TIPIS, TANPA MENGULANG ANGKA ─────────────────────────
        Sebelumnya keterangan di sini berbunyi "3 pesanan menunggu ·
        2 berjalan" — angka yang sama persis dengan strip status tepat di
        bawahnya. Dua baris yang menyebut hal sama membuat layar terasa
        penuh tanpa menambah informasi.

        Sekarang kepala hanya membawa identitas ("Kasir") dan alat
        (bunyi, muat ulang). Semua angka pindah ke strip, tempat ia
        seharusnya — satu sumber kebenaran, terbaca sekali.
      */}
      <BilahStaf
        tanpaLogo
        judul={LABEL_LAYAR[layar]}
        keterangan={galat ? galat : ""}
        demo={data?.demo}
        ringkasan={{ keteranganPonsel: "" }}
        kanan={
          <>
            <TombolKepala
              onClick={() => setSuara((s) => !s)}
              aktif={suara}
              ikon={suara ? <IkonSuara className="size-4" /> : <IkonMatikanSuara className="size-4" />}
              label={suara ? "Bunyi aktif" : "Bunyi mati"}
            />
            <TombolKepala
              onClick={muat}
              ikon={<IkonMuatUlang className="size-4" />}
              label="Muat ulang"
            />
          </>
        }
      />

      {/*
        Bilah koneksi penuh — bukan satu baris teks.

        Kasir yang layarnya berhenti diperbarui harus tahu SEBELUM ia
        menerima uang: pesanan yang baru masuk tidak akan tampil, dan
        kasir bisa menagih tamu yang pesanannya tidak pernah tercatat.
        Bilah ini menyebut umur data dan menyediakan tombol Muat ulang.
      */}
      <BilahKoneksi
        galat={galat}
        tema="terang"
        sejakBerhasil={umurData}
        onMuatUlang={muatUlangManual}
        sibuk={memuatUlang}
      />

      {/*
        ── STRIP STATUS: EMPAT ANGKA YANG MENJAWAB "SEKARANG APA?" ─────

        Sebelum strip ini, kasir harus membaca tiga panel berbeda untuk
        tahu keadaannya: berapa pesanan baru, berapa yang belum dibayar,
        berapa yang sedang dikerjakan, berapa meja terisi. Empat angka
        itu yang menentukan tindakan berikutnya, dan semuanya muat dalam
        satu baris.

        Padat, bukan kartu besar: tinggi 56px supaya di tablet 10" layar
        masih menyisakan ruang untuk antrean tanpa menggulir. Angka yang
        butuh tindakan diberi aksen `sela` — mata langsung ke sana.

        ── HANYA DI LAYAR ANTREAN ───────────────────────────────────────

        Pemilik meminta status antrean TIDAK muncul di layar lain. Tiga
        dari empat angka di sini (Baru, Belum bayar, Berjalan) adalah
        status antrean; menampilkannya saat kasir sedang mengurus menu
        berarti mengundangnya keluar dari pekerjaan yang sedang
        dikerjakan.

        Satu angka tetap relevan di mana pun: "Meja terisi", karena ia
        menjelaskan seluruh denah meja. Stripnya menyusut jadi satu sel di
        layar selain Antrean — bukan hilang, karena kasir masih perlu tahu
        apakah kafe sedang penuh.
      */}
      <div
        className={[
          "flex shrink-0 divide-x divide-bersih-200 border-b border-bersih-200 bg-bersih-0",
          layar === "antrean" ? "" : "hidden",
        ].join(" ")}
      >
        {[
          {
            kunci: "baru",
            label: "Baru",
            nilai: antrean.length,
            aksen: antrean.length > 0,
            tujuan: "antrean",
          },
          {
            kunci: "belum-bayar",
            label: "Belum bayar",
            nilai: menungguBayar.length,
            aksen: menungguBayar.length > 0,
            tujuan: "antrean",
          },
          {
            kunci: "berjalan",
            label: "Berjalan",
            nilai: diproses.length,
            aksen: false,
            tujuan: "antrean",
          },
          {
            kunci: "terisi",
            label: "Meja terisi",
            nilai: mejaTerisi,
            aksen: false,
            tujuan: "meja",
          },
        ].map((k) => (
          <button
            key={k.kunci}
            type="button"
            onClick={() => setLayar(k.tujuan as typeof layar)}
            className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 text-left transition hover:bg-bersih-100 sm:px-4"
          >
            <span className="truncate text-[0.625rem] font-bold uppercase tracking-[0.1em] text-tinta-500">
              {k.label}
            </span>
            <span
              className={[
                "text-[1.25rem] font-extrabold leading-none tabular-nums",
                k.aksen ? "text-sela-700" : "text-tinta-900",
              ].join(" ")}
            >
              {k.nilai}
            </span>
          </button>
        ))}
      </div>

      {/*
        ── MENUNGGU BAYAR ──
        Di atas segalanya karena ini satu-satunya daftar yang butuh
        tindakan kasir SEKARANG: tamu sudah memesan, duduk, dan menunggu.
        Pesanan di sini belum masuk dapur dan akan hilang sendiri setelah
        batas waktu — jadi kalau kasir tidak melihatnya, tamu tidak dapat
        makanan tanpa ada yang tahu kenapa.
      */}
      {layar === "antrean" && menungguBayar.length > 0 && (
        <section
          id="belum-dibayar"
          aria-labelledby="menunggu-bayar"
          className="border-b border-sela-200/70 bg-sela-50/60 px-3 py-3 sm:px-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2
              id="menunggu-bayar"
              className="flex items-center gap-2 text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] text-sela-800"
            >
              {/*
                Ikon, bukan hanya teks: panel ini adalah SATU-SATUNYA yang
                menuntut tindakan kasir sekarang juga. Di antara panel
                berwarna krem, satu penanda oranye membuat mata berhenti
                di sini lebih dulu.
              */}
              <IkonBill className="size-4" />
              Belum dibayar
              <span className="rounded-full bg-sela-700 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-white">
                {menungguBayar.length}
              </span>
            </h2>
            <p className="hidden text-[0.6875rem] font-semibold text-sela-800/70 sm:block">
              Tamu menunggu ditagih
            </p>
          </div>

          {/*
            ── GRID TIGA, BUKAN BARIS GESER ──────────────────────────────

            Sebelumnya `overflow-x-auto` + `min-w-[15rem]`: di tablet hanya
            dua kartu terlihat dan sisanya di luar layar. Kasir harus
            menggeser untuk tahu berapa tamu yang menunggu dibayar — di
            panel yang justru paling mendesak.

            Sekarang semua kartu terlihat tanpa digeser, dengan jumlah
            kolom mengikuti lebar yang tersedia. Isi kartu dipadatkan
            supaya tiga kolom tetap terbaca: total tagihan dan meja adalah
            dua hal yang dicari mata, sisanya pelengkap.
          */}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {menungguBayar.map((p) => {
              const sisa = sisaWaktu(p.kedaluwarsa_at);
              const online = p.metode_bayar === "online";
              return (
                <li
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-[0.75rem] border border-sela-200 bg-bersih-0 shadow-[0_1px_3px_rgb(22_19_15/0.06)]"
                >
                  {/* Pita atas: meja + sisa waktu. Yang paling mendesak
                      (waktu) diberi warna sendiri supaya terlihat tanpa
                      membaca angka. */}
                  <div className="flex items-center justify-between gap-1.5 border-b border-bersih-200 bg-cream-50 px-2.5 py-1.5">
                    <span className="flex min-w-0 items-center gap-1 text-[0.8125rem] font-extrabold text-tinta-900">
                      <IkonMeja className="size-3.5 shrink-0 text-forest-700" />
                      <span className="truncate">Meja {p.meja_nomor}</span>
                    </span>
                    {sisa ? (
                      <span
                        className={[
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem] font-extrabold tabular-nums leading-none",
                          sisa.mendesak
                            ? "bg-sela-700 text-white"
                            : "bg-sela-100 text-sela-800",
                        ].join(" ")}
                      >
                        {sisa.teks}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[0.625rem] font-semibold tabular-nums text-tinta-500">
                        {sejak(p.created_at)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    {/*
                      TOTAL TAGIHAN sebagai angka terbesar di kartu. Ini
                      nominal yang akan disebut kasir di depan tamu — dan
                      satu-satunya alasan kartu ini ada.

                      `break-words` + ukuran mengecil di layar sempit:
                      "Rp1.234.500" pada tiga kolom 360px akan terpotong
                      kalau dipaksa satu ukuran.
                    */}
                    {p.total !== null && p.total > 0 ? (
                      <p className="whitespace-nowrap text-[1.0625rem] font-extrabold leading-none tabular-nums tracking-[-0.01em] text-forest-900 sm:text-[1.125rem]">
                        {rupiah(p.total)}
                      </p>
                    ) : (
                      <p className="text-[0.75rem] font-semibold italic text-tinta-500">
                        Tagihan kosong
                      </p>
                    )}

                    <p className="truncate text-[0.6875rem] leading-tight text-tinta-500">
                      {p.nama_pemesan ?? "Tanpa nama"} · {p.total_item} item
                    </p>

                    <p className="flex flex-wrap items-center gap-1">
                      {/*
                        Metode bayar: "online" berarti tamu sedang menunggu
                        halaman pembayaran terbuka (tautannya bisa gagal),
                        "kasir" berarti tamu memang menunggu ditagih. Kasir
                        memperlakukan keduanya berbeda, jadi ini harus
                        terbaca sebelum ia mendatangi meja.
                      */}
                      <span
                        className={[
                          "rounded px-1.5 py-0.5 text-[0.5625rem] font-extrabold uppercase tracking-wider",
                          online ? "bg-sela-100 text-sela-800" : "bg-daun-100 text-forest-700",
                        ].join(" ")}
                      >
                        {online ? "Online" : "Di kasir"}
                      </span>
                      {p.no_wa && (
                        <a
                          href={`https://wa.me/${p.no_wa.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded px-1.5 py-0.5 text-[0.5625rem] font-bold text-forest-700 underline decoration-dotted hover:bg-daun-100"
                        >
                          WA
                        </a>
                      )}
                    </p>

                    <div className="mt-auto flex flex-col gap-1 pt-1.5">
                      <button
                        type="button"
                        onClick={() => bayarTunai(p)}
                        disabled={memproses === p.id}
                        className="tombol-utama h-10 w-full text-[0.8125rem]"
                      >
                        {memproses === p.id ? "Menyimpan…" : "Uang pas"}
                      </button>
                      <button
                        type="button"
                        onClick={() => bukaPelunasan(p.meja_id)}
                        disabled={memproses === p.id}
                        className="tombol-tenang h-10 w-full text-[0.8125rem]"
                      >
                        Uang lebih
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoiceId(p.id)}
                        className="h-8 w-full rounded text-[0.6875rem] font-bold text-tinta-500 transition hover:bg-bersih-100"
                      >
                        Lihat invoice
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/*
        ── SATU LAYAR, SATU PEKERJAAN ──────────────────────────────────

        Sebelumnya kelima panel ditumpuk di satu halaman panjang dan
        sidebar hanya dipakai untuk melompat ke anchor. Itu salah untuk
        alat kerja: kasir yang sedang menerima pesanan tidak perlu
        melihat denah meja, dan sebaliknya. Halaman sepanjang ribuan
        piksel membuat semuanya terasa sesak sekaligus menyulitkan —
        menggulir jauh untuk pekerjaan yang tidak sedang dikerjakan.

        Sekarang pola yang lazim untuk POS: sidebar memilih SATU panel,
        dan isinya mengisi sisa layar. `layar` menentukan panel mana yang
        dirender; sisanya tidak ada di DOM (bukan sekadar disembunyikan),
        jadi tidak ada tinggi tersembunyi yang membuat halaman bisa
        digulir ke ruang kosong.
      */}
      <div className="min-w-0 flex-1 p-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
        {layar === "antrean" && (
        <section id="antrean" aria-labelledby="antrean" className="min-w-0 scroll-mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2
              id="antrean"
              className="flex items-center gap-2 text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500"
            >
              <IkonPesanan className="size-4" />
              Menunggu konfirmasi
              {antrean.length > 0 && (
                <span className="rounded-full bg-sela-700 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-white">
                  {antrean.length}
                </span>
              )}
            </h2>
            <p className="hidden text-[0.6875rem] font-semibold text-tinta-500 sm:block">
              Sudah dibayar · siap masuk dapur
            </p>
          </div>

          {/*
            ── TIGA KARTU PER BARIS ─────────────────────────────────────

            Pemilik meminta satu baris memuat tiga kartu. Sebelumnya daftar
            satu kolom selebar layar: satu pesanan menghabiskan hampir
            seluruh tinggi layar, sehingga antrean berisi empat pesanan
            sudah butuh menggulir — padahal isinya hanya nomor, meja, dan
            dua tombol.

            Tiga kolom memaksa isi kartu dipadatkan: rincian item tidak
            lagi didaftar satu per satu, melainkan diringkas jadi satu
            baris yang bisa dipindai ("2× Gurame, 1× Es Teh"). Rincian
            penuh tetap tersedia lewat "Lihat invoice" — kasir yang perlu
            memeriksa bahan tidak kehilangan apa pun.

            `sm:grid-cols-2 xl:grid-cols-3`: di ponsel 360px tiga kartu
            berarti ~110px per kartu — nomor pesanan dan tombol "Terima"
            tidak akan muat. Dua kolom mulai 640px, tiga mulai 1280px.
          */}
          {antrean.length === 0 ? (
            <div className="rounded-[0.875rem] border border-dashed border-bersih-200 bg-bersih-100 px-4 py-8 text-center">
              <p className="text-[0.9375rem] font-semibold text-tinta-500">
                Tidak ada pesanan baru.
              </p>
              <p className="mt-1 text-[0.8125rem] text-tinta-500">
                Pesanan dari QR meja akan muncul di sini disertai bunyi.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {antrean.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-[0.875rem] border border-l-[3px] border-bersih-200 border-l-sela-700 bg-bersih-0 shadow-[0_1px_2px_rgb(22_19_15/0.04),0_8px_24px_-16px_rgb(22_19_15/0.25)]"
                >
                  <div className="px-3.5 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 rounded-[0.375rem] bg-sela-700 px-2 py-1 text-[0.625rem] font-extrabold uppercase leading-none tracking-[0.1em] text-white">
                          Baru
                        </span>
                        <p className="min-w-0 truncate text-[1.25rem] font-extrabold leading-none tracking-[-0.02em] text-forest-900">
                          #{p.nomor}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold tabular-nums text-tinta-500">
                        <IkonJam className="size-3.5" />
                        {sejak(p.created_at)}
                      </span>
                    </div>

                    <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] leading-none text-tinta-700">
                      <span className="inline-flex items-center gap-1 rounded-[0.375rem] bg-daun-100 px-2 py-1.5 font-extrabold leading-none text-forest-700">
                        <IkonMeja className="size-3.5" />
                        Meja {p.meja_nomor}
                      </span>
                      {p.nama_pemesan && (
                        <>
                          <span aria-hidden="true" className="text-tinta-500/50">
                            ·
                          </span>
                          <span className="min-w-0 max-w-[14ch] truncate font-semibold">
                            {p.nama_pemesan}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-tinta-500/50">
                        ·
                      </span>
                      <span className="shrink-0 font-semibold text-tinta-500">
                        {p.total_item} item
                      </span>
                    </p>
                  </div>

                  <div className="mx-3.5 mt-2.5 rounded-[0.625rem] bg-bersih-50 px-3 pb-2.5 pt-1">
                    <ul className="divide-y divide-bersih-200">
                      {p.items.map((i) => (
                        <li key={i.id} className="flex items-start gap-2 py-2">
                          <span className="mt-px grid size-6 shrink-0 place-items-center rounded-[0.25rem] bg-bersih-200 text-[0.6875rem] font-extrabold leading-none tabular-nums text-tinta-700">
                            {i.jumlah}x
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.8125rem] font-semibold leading-snug text-tinta-900">
                              {i.nama_saat_pesan}
                              {Array.isArray(i.pilihan) && i.pilihan.length > 0 && (
                                <span className="ml-1.5 inline-block rounded-[0.25rem] bg-sela-100 px-1.5 py-0.5 align-middle text-[0.5625rem] font-extrabold uppercase leading-none tracking-wide text-sela-800">
                                  {i.pilihan.map((x) => x.nama).join(" · ")}
                                </span>
                              )}
                            </p>
                            {i.catatan && (
                              <p className="mt-0.5 text-[0.6875rem] font-bold leading-snug text-sela-700">
                                {i.catatan}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-bersih-200 pt-2">
                      <span className="text-[0.75rem] font-semibold text-tinta-500">Subtotal</span>
                      <span className="whitespace-nowrap text-[1.125rem] font-extrabold leading-none tabular-nums tracking-[-0.01em] text-sela-700">
                        {rupiah(p.items.reduce((n, i) => n + i.harga_satuan * i.jumlah, 0))}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-2 px-3.5 pb-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setInvoiceId(p.id)}
                      className="flex h-11 shrink-0 items-center gap-1.5 rounded-[0.375rem] px-1 text-[0.75rem] font-bold text-tinta-500 transition hover:text-forest-700"
                    >
                      <IkonPanah className="size-3.5" />
                      Lihat invoice
                    </button>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={sedang}
                        onClick={() => setAlasanTolak({ id: p.id, buka: true })}
                        className="flex h-11 items-center gap-1.5 rounded-[0.5rem] border border-sela-200 bg-bersih-0 px-3.5 text-[0.875rem] font-bold text-sela-700 transition hover:bg-sela-50 active:scale-[0.99] disabled:opacity-50"
                      >
                        <IkonSilang className="size-4" />
                        Tolak
                      </button>
                      <button
                        type="button"
                        disabled={sedang}
                        onClick={() => ubah(p.id, "diterima")}
                        className="flex h-11 items-center gap-1.5 rounded-[0.5rem] bg-forest-900 px-4 text-[0.875rem] font-bold text-cream-50 transition hover:bg-forest-950 active:scale-[0.99] disabled:opacity-50"
                      >
                        <IkonCentang className="size-4" />
                        Terima
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/*
            ── BERJALAN DI DAPUR: TIGA PER BARIS, BENTUK SAMA ───────────

            Pemilik meminta kartu ini disamakan dengan "Menunggu
            konfirmasi" — tiga per baris. Sebelumnya ia daftar satu baris
            tipis selebar layar, sementara kartu di atasnya berbentuk
            kartu penuh. Dua bentuk berbeda untuk dua daftar yang setara
            membuat mata harus menyesuaikan diri dua kali.

            Bedanya sekarang hanya pada ISI yang memang berbeda: tidak ada
            tombol aksi (pekerjaan sudah di dapur, kasir tidak perlu
            memutuskan apa pun), dan statusnya menonjol karena itulah satu-
            satunya hal yang berubah di sini.
          */}
          {diproses.length > 0 && (
            <>
              <div className="mb-2 mt-5 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500">
                  <IkonPromo className="size-4" />
                  Berjalan di dapur
                  <span className="rounded-full bg-bersih-200 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-tinta-700">
                    {diproses.length}
                  </span>
                </h2>
                <p className="hidden text-[0.6875rem] font-semibold text-tinta-500 sm:block">
                  Sedang dimasak
                </p>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {diproses.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col overflow-hidden rounded-[0.875rem] border border-bersih-200 bg-bersih-0 shadow-[0_1px_2px_rgb(22_19_15/0.04),0_8px_24px_-16px_rgb(22_19_15/0.25)]"
                  >
                    <div className="px-3.5 pt-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="min-w-0 truncate text-[1.25rem] font-extrabold leading-none tracking-[-0.02em] text-forest-900">
                            #{p.nomor}
                          </p>
                        </div>
                        <StatusKecil status={p.status} />
                      </div>

                      <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] leading-none text-tinta-700">
                        <span className="inline-flex items-center gap-1 rounded-[0.375rem] bg-daun-100 px-2 py-1.5 font-extrabold leading-none text-forest-700">
                          <IkonMeja className="size-3.5" />
                          Meja {p.meja_nomor}
                        </span>
                        {p.nama_pemesan && (
                          <>
                            <span aria-hidden="true" className="text-tinta-500/50">
                              ·
                            </span>
                            <span className="min-w-0 max-w-[14ch] truncate font-semibold">
                              {p.nama_pemesan}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true" className="text-tinta-500/50">
                          ·
                        </span>
                        <span className="shrink-0 font-semibold text-tinta-500">
                          {p.total_item} item
                        </span>
                      </p>
                    </div>

                    <div className="mx-3.5 mt-2.5 rounded-[0.625rem] bg-bersih-50 px-3 pb-2.5 pt-1">
                      <ul className="divide-y divide-bersih-200">
                        {p.items.map((i) => (
                          <li key={i.id} className="flex items-start gap-2 py-2">
                            <span className="mt-px grid size-6 shrink-0 place-items-center rounded-[0.25rem] bg-bersih-200 text-[0.6875rem] font-extrabold leading-none tabular-nums text-tinta-700">
                              {i.jumlah}x
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.8125rem] font-semibold leading-snug text-tinta-900">
                                {i.nama_saat_pesan}
                                {Array.isArray(i.pilihan) && i.pilihan.length > 0 && (
                                  <span className="ml-1.5 inline-block rounded-[0.25rem] bg-sela-100 px-1.5 py-0.5 align-middle text-[0.5625rem] font-extrabold uppercase leading-none tracking-wide text-sela-800">
                                    {i.pilihan.map((x) => x.nama).join(" · ")}
                                  </span>
                                )}
                              </p>
                              {i.catatan && (
                                <p className="mt-0.5 text-[0.6875rem] font-bold leading-snug text-sela-700">
                                  {i.catatan}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-bersih-200 pt-2">
                        <span className="flex items-center gap-1 text-[0.75rem] font-semibold tabular-nums text-tinta-500">
                          <IkonJam className="size-3" />
                          {sejak(p.created_at)}
                        </span>
                        <span className="whitespace-nowrap text-[1.125rem] font-extrabold leading-none tabular-nums tracking-[-0.01em] text-forest-900">
                          {rupiah(p.items.reduce((n, i) => n + i.harga_satuan * i.jumlah, 0))}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 px-3.5 pb-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setInvoiceId(p.id)}
                        className="flex h-11 shrink-0 items-center gap-1.5 rounded-[0.375rem] px-1 text-[0.75rem] font-bold text-tinta-500 transition hover:text-forest-700"
                      >
                        <IkonPanah className="size-3.5" />
                        Lihat invoice
                      </button>
                      <p className="text-[0.6875rem] font-semibold text-tinta-500">
                        Dikerjakan dapur
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        )}

        {layar === "meja" && (
        <section id="meja" aria-labelledby="meja" className="min-w-0 scroll-mt-4">
          {/*
            Angka "terisi" pindah ke sini karena strip status hanya
            muncul di layar Antrean. Tanpa ini, kasir yang membuka denah
            meja kehilangan satu-satunya ringkasan hunian — ia harus
            menghitung sendiri 20 kotak.
          */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2
              id="meja"
              className="flex items-center gap-2 text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500"
            >
              <IkonMeja className="size-4" />
              Meja
            </h2>
            <p className="text-[0.75rem] font-bold tabular-nums text-tinta-700">
              <span className="text-forest-900">{mejaTerisi}</span>
              <span className="text-tinta-500"> / {(data?.meja ?? []).length} terisi</span>
            </p>
          </div>

          {/*
            ── DUA KOLOM DI PONSEL, SEPERTI ACUAN ─────────────────────

            Sebelumnya empat kolom. Di layar kasir (tablet 10", sering
            dipakai berdiri) empat kolom membuat tiap kotak hanya ~70px:
            nomor meja terbaca, tetapi nominal tagihannya terpotong dan
            sasaran sentuhnya kecil.

            Acuan desain memakai DUA kolom, dengan kotak yang cukup besar
            untuk memuat nomor meja, status, dan total sekaligus — tiga hal
            yang dibaca kasir dalam satu pandangan tanpa membuka apa pun.
          */}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
            {(data?.meja ?? []).map((m) => {
              const aktif = mejaPilih === m.nomor;
              /*
                ── DUA KEADAAN, BUKAN TIGA ─────────────────────────────

                "Perlu ditagih" DIHAPUS. Itu keadaan yang tidak pernah
                benar-benar ada: `meja.status` hanya pernah bernilai
                "kosong" atau "ada_pesanan" — tidak ada yang menulis
                "menunggu_bayar", karena fitur "minta bill" sudah dibuang.

                Akibatnya oranye "perlu ditagih" menyala untuk SETIAP meja
                yang punya tagihan terbuka, termasuk tamu yang baru mulai
                makan. Kasir membacanya sebagai "tamu sudah minta bayar" —
                label yang menjanjikan lebih dari yang diketahui sistem.

                Yang benar-benar diketahui sistem: ada tagihan atau tidak.
                Itu ditampilkan sebagai ANGKA di kartu, bukan sebagai warna
                yang menyamar jadi status.
              */
              const adaIsi = m.status !== "kosong";
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setMejaPilih(aktif ? null : m.nomor)}
                    className={[
                      "relative flex h-[4.25rem] w-full flex-col items-center justify-center rounded-[0.625rem] border-2 transition",
                      aktif
                        ? "border-forest-900 bg-forest-900 text-cream-50 shadow-[0_10px_24px_-14px_rgba(20,35,26,0.8)]"
                        : adaIsi
                          ? "border-transparent bg-daun-100 text-tinta-900"
                          : "border-transparent bg-bersih-0 text-tinta-500 shadow-[0_1px_2px_rgba(22,19,15,0.05)]",
                    ].join(" ")}
                  >
                    <span className="text-[1.375rem] font-extrabold leading-none">{m.nomor}</span>
                    {/*
                      ── TOTAL DI ATAS LABEL ────────────────────────────

                      Pemilik meminta nilai total muncul sebelum status.
                      Urutannya juga yang benar untuk dibaca: angka meja
                      (1.375rem) → nominal tagihan → keadaan meja. Kasir
                      mencari meja untuk DITAGIH, jadi nominalnya harus
                      lebih dekat ke nomor daripada ke label.

                      Saat kosong tidak ada nominal, dan baris itu tidak
                      boleh bolong: tinggi kartu dijaga oleh `min-h` pada
                      pembungkusnya, bukan oleh teks pengganti seperti "—"
                      yang menambah satu hal lagi untuk dibaca.
                    */}
                    {m.tagihan && m.status !== "kosong" ? (
                      <span
                        /*
                          `data-meja-total` sengaja dipakai sebagai penanda
                          uji, bukan sebagai gaya. Urutan "nominal sebelum
                          label" tidak bisa diperiksa dari bundel yang sudah
                          diminifikasi: ekspresi seperti
                          `rupiah(m.tagihan.total)` berubah jadi `t(e.total)`,
                          dan pencarian teksnya selalu gagal. Penanda data
                          bertahan apa adanya setelah minify.
                        */
                        data-meja-total
                        className={[
                          "mt-1 text-[0.75rem] font-extrabold leading-none tabular-nums",
                          aktif ? "text-white/80" : "text-forest-800",
                        ].join(" ")}
                      >
                        {rupiah(m.tagihan.total)}
                      </span>
                    ) : (
                      <span className="mt-1 h-3" aria-hidden="true" />
                    )}
                    <span
                      data-meja-status
                      className={[
                        "mt-1 text-[0.6875rem] font-bold uppercase tracking-wide",
                        aktif ? "text-cream-50/75" : "",
                      ].join(" ")}
                    >
                      {m.status === "kosong" ? "kosong" : "terisi"}
                    </span>
                    {/*
                      Nominal tagihan TIDAK diulang di sini. Ia sudah naik
                      ke atas label sebagai angka utama kartu — dulu ada di
                      sini sebagai teks kecil, dan setelah dipindah akan
                      tampil dua kali dalam satu kotak 4rem.
                    */}
                  </button>
                </li>
              );
            })}
          </ul>

          {/*
            ── LEGENDA WARNA ──────────────────────────────────────────

            Warna kotak meja (hijau = terisi, putih = kosong, gelap =
            dipilih) hanya berguna bila artinya bisa dilihat tanpa bertanya.
            Sebelumnya tidak ada keterangan sama sekali: kasir baru harus
            menebak, dan tamu yang melihat layar tidak tahu apa-apa.

            Ditaruh TEPAT DI BAWAH grid, bukan di atas: mata membaca kotak
            dulu, lalu mencari arti warna yang barusan dilihatnya.
          */}
          <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.75rem] text-tinta-500">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[0.25rem] bg-daun-100 ring-1 ring-inset ring-forest-600/25" aria-hidden="true" />
              Terisi
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[0.25rem] bg-bersih-0 ring-1 ring-inset ring-bersih-300" aria-hidden="true" />
              Kosong
            </li>
            {/*
              "Perlu ditagih" DIHAPUS dari legenda — keadaannya tidak ada
              (lihat catatan di kartu meja). Legenda yang menyebut warna
              yang tidak dipakai mengajari kasir mencari sesuatu yang tidak
              akan pernah ia temukan.
            */}
          </ul>

          {/*
            ── KETERSEDIAAN MENU DIHAPUS DARI SINI ──────────────────────

            Panel lipat "Ketersediaan menu" dulu ada di bawah denah meja.
            Pemilik meminta dihilangkan: halaman Meja dipakai untuk melihat
            meja mana yang terisi dan menagih, bukan untuk mengurus stok
            menu — dan menandai menu habis SUDAH punya panel sendiri yang
            penuh (kartu bergambar, semua menu terlihat sekaligus) di menu
            "Menu" di sidebar.

            Menyisakan salinan kecil di sini berarti dua tempat berbeda
            untuk satu pekerjaan, dengan yang di Meja selalu kalah lengkap
            — kasir akan memakainya, lalu kecewa karena tidak semua menu
            bisa ditandai dari sana.
          */}

          {/* ── Detail tagihan meja terpilih ── */}
          {mejaTerpilih && (
            <div className="mt-3 rounded-[0.875rem] shadow-[0_1px_2px_rgba(22,19,15,0.04),0_6px_16px_-10px_rgba(22,19,15,0.16)] bg-bersih-0 p-3">
              <div className="flex items-center gap-2">
                <IkonMeja className="size-4 text-tinta-500" />
                <p className="flex-1 text-[0.9375rem] font-extrabold text-tinta-900">
                  Meja {mejaTerpilih.nomor} · {mejaTerpilih.area}
                </p>
                <button
                  type="button"
                  onClick={() => setMejaPilih(null)}
                  className="text-[0.6875rem] font-semibold text-tinta-500"
                >
                  Tutup
                </button>
              </div>

              {mejaTerpilih.tagihan ? (
                <RincianTagihan
                  tagihan={mejaTerpilih.tagihan}
                  onBayar={() =>
                    setBayar({ tagihan: mejaTerpilih.tagihan!, meja: mejaTerpilih.nomor })
                  }
                />
              ) : (
                <p className="mt-2 text-[0.8125rem] text-tinta-500">
                  Belum ada tagihan terbuka untuk meja ini.
                </p>
              )}
            </div>
          )}
        </section>
        )}

        {/*
          ── PANEL MENU: KARTU PRODUK, BUKAN DAFTAR TEKS ──────────────

          Menggantikan panel "Ketersediaan menu" yang bisa dilipat dan
          hanya berisi baris nama + tombol kecil. Kasir menandai menu
          habis beberapa kali per jam sibuk — itu pekerjaan yang layak
          mendapat kartu bergambar, bukan daftar tersembunyi di balik
          panah "▾".

          Bentuk kartunya sama dengan yang dilihat tamu di portal
          pelanggan: gambar/ikon di atas, teks di bawah, harga tebal.
          Satu bahasa visual untuk staf dan tamu.
        */}
        {layar === "menu" && (
        <section id="menu" aria-labelledby="menu-kasir" className="min-w-0 scroll-mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2
              id="menu-kasir"
              className="text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500"
            >
              Menu
            </h2>
            <span className="rounded-full bg-bersih-200 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-tinta-700">
              {menu.length}
            </span>
            {habis.length > 0 && (
              <span className="rounded-full bg-sela-700 px-2 py-0.5 text-[0.6875rem] font-bold text-white">
                {habis.length} habis
              </span>
            )}
          </div>

          {/*
            Kotak cari menu. Kasir mencari hidangan yang disebut tamu
            ("ada matcha?") di antara 126 menu — tanpa kotak ini ia
            menggulir sambil tamu menunggu jawaban.
          */}
          {/*
            ── PIL KATEGORI ────────────────────────────────────────────
            Kasir mencari "yang di kategori Kopi" jauh lebih sering
            daripada mengetik nama hidangan. Satu baris pil yang bisa
            digeser mengubah 126 kartu jadi belasan — tanpa membuka
            apa pun.
          */}
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCariMenu("")}
              aria-pressed={cariMenu.trim() === ""}
              className={[
                "h-8 shrink-0 rounded-full px-3 text-[0.75rem] font-bold transition",
                cariMenu.trim() === ""
                  ? "bg-forest-900 text-cream-50"
                  : "bg-bersih-200 text-tinta-700 hover:bg-bersih-200/70",
              ].join(" ")}
            >
              Semua
            </button>
            {(data?.kategori ?? []).map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setCariMenu(cariMenu.trim() === k.nama ? "" : k.nama)}
                aria-pressed={cariMenu.trim() === k.nama}
                className={[
                  "h-8 shrink-0 rounded-full px-3 text-[0.75rem] font-bold transition",
                  cariMenu.trim() === k.nama
                    ? "bg-forest-900 text-cream-50"
                    : "bg-bersih-200 text-tinta-700 hover:bg-bersih-200/70",
                ].join(" ")}
              >
                {k.nama}
              </button>
            ))}
          </div>

          <label className="mb-2 flex h-9 items-center gap-2 rounded-[0.5rem] border border-bersih-200 bg-bersih-0 px-2.5">
            <IkonCari className="size-4 shrink-0 text-tinta-500" />
            <input
              value={cariMenu}
              onChange={(e) => setCariMenu(e.target.value)}
              placeholder="Cari menu"
              aria-label="Cari menu"
              className="w-full bg-transparent text-[0.875rem] text-tinta-900 outline-none placeholder:text-tinta-500/70"
            />
            {cariMenu && (
              <button
                type="button"
                onClick={() => setCariMenu("")}
                aria-label="Hapus pencarian"
                className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-tinta-500 active:bg-bersih-100"
              >
                <IkonSilang className="size-4" />
              </button>
            )}
          </label>

          {/*
            Grid kartu produk. Satu kolom di ponsel sempit (harga tidak
            terpotong), dua mulai 480px, dua saat sidebar memakan lebar,
            lalu tiga di layar lebar.
          */}
          {/*
            ── PANEL MENU MENGGULIR SENDIRI ────────────────────────────
            `lg:max-h-[calc(100dvh-16rem)]` + `overflow-y-auto`: panel ini
            tidak lagi memanjangkan halaman. Kasir tetap bisa melihat
            Meja dan Laporan di sebelahnya sambil menggulir menu — itulah
            yang membuat dashboard terasa seperti dashboard, bukan satu
            halaman panjang.

            Di ponsel (`<lg`) batasnya dilepas: layar sempit memang
            bergulir, dan memaksa dua area gulir bersarang di ponsel
            membuat gestur terasa macet.
          */}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {menuTersaring.map((m) => (
              <KartuProduk
                key={m.id}
                produk={m}
                rupiah={rupiah}
                IkonKategori={IkonKategoriMenu}
                sibuk={menuSibuk === m.id}
                onTersedia={() => setTersedia(m.id, !m.tersedia)}
                onUbah={() => setMenuUbah(m.id)}
              />
            ))}
          </ul>

          {menuTersaring.length === 0 && (
            <p className="rounded-[0.75rem] border border-dashed border-bersih-200 bg-bersih-100 px-4 py-8 text-center text-[0.8125rem] text-tinta-500">
              Tidak ada menu yang cocok dengan &ldquo;{cariMenu}&rdquo;.
            </p>
          )}
        </section>
        )}

        {/*
          ── LAPORAN: PANEL SENDIRI ─────────────────────────────────────
          Dulu berbagi baris dengan Riwayat di bawah semua panel lain.
          Sebagai panel sendiri, ia bisa memakai lebar penuh untuk tabel
          dan grafik yang memang butuh ruang — bukan terjepit separuh
          layar di bawah daftar yang panjang.
        */}
        {layar === "laporan" && (
          <section id="laporan" aria-labelledby="rangkuman-kasir" className="min-w-0 scroll-mt-4">
            <h2
              id="rangkuman-kasir"
              className="mb-2 text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500"
            >
              Penjualan hari ini
            </h2>
            <KartuRingkasan
              ringkasan={ringkasan}
              galat={pesanRingkasan}
              memuat={memuatLaporan}
            />
            {/*
              Diagram hanya digambar bila angkanya sudah ada. Kerangka abu-
              abu yang menyerupai diagram lebih buruk daripada tidak ada:
              bentuknya terbaca sebagai "grafik dengan data aneh" selama
              satu detik pertama.

              `riwayat` dipakai bersama untuk sebaran per jam dan per
              metode — satu sumber, jadi diagramnya tidak bisa bercerita
              berbeda dari tabel di panel Riwayat.
            */}
            {ringkasan && (
              <DiagramPenjualan ringkasan={ringkasan} riwayat={riwayat} />
            )}
          </section>
        )}

        {/*
          ── RIWAYAT: PANEL SENDIRI ─────────────────────────────────────
          Tabel riwayat butuh lebar untuk menampilkan nomor, meja, waktu,
          metode bayar, dan nominal dalam satu baris. Di kolom separuh ia
          memaksa gulir horizontal — dan gulir horizontal di tabel adalah
          hal pertama yang membuat layar terasa rusak.
        */}
        {layar === "riwayat" && (
          <section id="riwayat" aria-labelledby="riwayat-kasir" className="min-w-0 scroll-mt-4">
            <h2
              id="riwayat-kasir"
              className="mb-2 flex items-center gap-2 text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500"
            >
              Riwayat pesanan
              <span className="rounded-full bg-bersih-200 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-tinta-700">
                {riwayat.length}
              </span>
            </h2>
            <DaftarRiwayat riwayat={riwayat} galat={pesanRiwayat} awal={20} />
          </section>
        )}
      </div>{/* tutup padding area kerja */}

      {/*
        ── UBAH MENU ────────────────────────────────────────────────────

        Halaman ini TIDAK menyunting harga. Sumber kebenaran menu adalah
        /order/admin (nama, harga, kategori, pilihan, foto). Menyalin
        formulir itu ke sini berarti dua tempat yang bisa menyimpang —
        dan harga yang berbeda antara layar kasir dan admin adalah
        kesalahan yang mahal.

        Yang dibuka di sini hanya satu keputusan cepat: tersedia atau
        habis. Untuk perubahan lain, kasir diarahkan ke admin dengan
        menu tersebut sudah tersorot.
      */}
      {/*
        ── UBAH NAMA KASIR ───────────────────────────────────────────────
        Satu isian, satu tombol. Nama ini yang tercatat di tiap
        pembayaran, jadi salah ketik harus bisa diperbaiki tanpa
        mengosongkan penyimpanan peramban.
      */}
      {ubahNama && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/60 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setUbahNama(false)}
            className="absolute inset-0"
          />
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-nama-kasir"
            onSubmit={(e) => {
              e.preventDefault();
              setUbahNama(false);
            }}
            className="relative w-full max-w-sm rounded-t-[1.25rem] bg-bersih-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(22,19,15,0.24)] sm:rounded-[1.25rem]"
          >
            <h2 id="judul-nama-kasir" className="text-[1rem] font-extrabold text-tinta-900">
              Nama kasir
            </h2>
            <p className="mt-1 text-[0.8125rem] leading-snug text-tinta-500">
              Tercatat di setiap pembayaran dan perubahan status. Cukup diisi sekali per
              perangkat.
            </p>
            <label className="mt-3 block">
              <span className="sr-only">Nama kasir</span>
              <input
                autoFocus
                value={namaKasir}
                onChange={(e) => setNamaKasir(e.target.value)}
                maxLength={40}
                placeholder="Contoh: Rina"
                className="h-12 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-0 px-3 text-[0.9375rem] text-tinta-900 outline-none focus:border-sela-500"
              />
            </label>
            <div className="mt-3 grid gap-2">
              <button
                type="submit"
                onClick={() => simpanNamaKasir(namaKasir)}
                className="tombol-utama h-11 w-full text-[0.875rem]"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setUbahNama(false)}
                className="h-11 text-[0.8125rem] font-semibold text-tinta-500"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {menuUbah !== null && (() => {
        const m = menu.find((x) => x.id === menuUbah);
        if (!m) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/60 p-0 sm:items-center sm:p-4">
            <button
              type="button"
              aria-label="Tutup"
              onClick={() => setMenuUbah(null)}
              className="absolute inset-0"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="judul-ubah-menu"
              className="relative w-full max-w-sm rounded-t-[1.25rem] bg-bersih-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(22,19,15,0.24)] sm:rounded-[1.25rem]"
            >
              <h2
                id="judul-ubah-menu"
                className="text-[1rem] font-extrabold leading-snug text-tinta-900"
              >
                {m.nama}
              </h2>
              <p className="mt-0.5 text-[0.8125rem] tabular-nums text-tinta-500">
                {rupiah(m.harga)}
              </p>

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTersedia(m.id, !m.tersedia);
                    setMenuUbah(null);
                  }}
                  className="tombol-utama h-11 w-full text-[0.875rem]"
                >
                  {m.tersedia ? "Tandai habis" : "Tandai tersedia lagi"}
                </button>
                <a
                  href="/order/admin"
                  className="flex h-11 items-center justify-center rounded-[0.625rem] border border-bersih-200 text-[0.875rem] font-bold text-tinta-700"
                >
                  Ubah harga &amp; detail di Admin
                </a>
                <button
                  type="button"
                  onClick={() => setMenuUbah(null)}
                  className="h-11 text-[0.8125rem] font-semibold text-tinta-500"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Penutup dialog & invoice ── */}
      {/* ── Dialog pembayaran ── */}
      {bayar && (
        <DialogBayar
          tagihan={bayar.tagihan}
          meja={bayar.meja}
          onTutup={() => setBayar(null)}
          onSukses={(pesananId) => {
            setBayar(null);
            muat();
            /*
              Invoice pesanan yang BARU dilunasi — bukan tagihan meja.
              Satu meja bisa berisi dua pesanan yang ditagih bersamaan;
              membuka berdasarkan meja bisa menampilkan invoice pesanan
              yang salah.
            */
            if (pesananId) setInvoiceId(pesananId);
          }}
        />
      )}

      {/* ── Invoice (sama persis dengan yang dilihat pelanggan) ── */}
      {invoiceId !== null && (
        <BukaInvoice pesananId={invoiceId} onTutup={() => setInvoiceId(null)} />
      )}

      {/*
        Peringatan ini dulu berbunyi "data pesanan tidak tersimpan permanen",
        yang memberi kesan pesanan tetap tercatat sementara. Sekarang tidak:
        tanpa kunci server, melunasi dan menandai siap akan DITOLAK. Staf
        yang membaca peringatan ini harus tahu itu sebelum mencoba, bukan
        sesudah gagal.
      */}
      {data?.demo && (
        <div className="border-t border-sela-200 bg-sela-50 px-4 py-2 sm:px-6">
          <p className="text-[0.6875rem] leading-snug text-sela-800">
            <strong>Mode demo.</strong> Pelunasan dan penandaan siap belum bisa
            dipakai: kunci server database belum dipasang di Cloudflare. Menu dan
            meja tetap terbaca dari database.
          </p>
        </div>
      )}
      </div>{/* tutup: area kerja */}
    </div>
  );
}

/**
 * Sisa waktu sebelum pesanan kedaluwarsa, dalam bentuk yang bisa dibaca
 * sekilas.
 *
 * ── MENGAPA INI PENTING, BUKAN HIASAN ─────────────────────────────────
 *
 * Pesanan yang belum dibayar HILANG SENDIRI setelah batas waktu. Kartu
 * "Belum dibayar" tidak pernah menyebutkan itu: kasir bisa mendatangi
 * meja, menagih, lalu mendapat "pesanan tidak ditemukan" — atau lebih
 * buruk, tamu sudah menunggu sepuluh menit untuk pesanan yang sudah
 * dibatalkan sistem.
 *
 * Kembalian `null` ketika tidak ada tenggat atau tenggatnya masih jauh
 * (> 30 menit): menampilkan "sisa 43 menit" hanya menambah angka yang
 * tidak mengubah keputusan siapa pun.
 */
function sisaWaktu(kedaluwarsa: string | null): { teks: string; mendesak: boolean } | null {
  if (!kedaluwarsa) return null;
  const sisa = new Date(kedaluwarsa).getTime() - Date.now();
  if (!Number.isFinite(sisa) || sisa <= 0) return { teks: "Kedaluwarsa", mendesak: true };

  const menit = Math.ceil(sisa / 60000);
  if (menit > 30) return null;
  return { teks: `Sisa ${menit} mnt`, mendesak: menit <= 10 };
}

function StatusKecil({ status }: { status: string }) {
  const peta: Record<string, { t: string; c: string }> = {
    diterima: { t: "Diterima", c: "bg-daun-100 text-forest-700" },
    diproses: { t: "Diproses", c: "bg-sela-50 text-sela-800" },
    siap: { t: "Siap", c: "bg-daun-100 text-forest-700" },
  };
  const s = peta[status] ?? { t: status, c: "bg-bersih-100 text-tinta-700" };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${s.c}`}>
      {s.t}
    </span>
  );
}

function RincianTagihan({ tagihan, onBayar }: { tagihan: Tagihan; onBayar: () => void }) {
  return (
    <>
      <dl className="mt-2 space-y-1 text-[0.8125rem]">
        <Baris k="Subtotal" v={rupiah(tagihan.subtotal)} />
        <Baris k="Biaya layanan" v={rupiah(tagihan.layanan)} />
        <Baris k="Pajak" v={rupiah(tagihan.pajak)} />
        {tagihan.pembulatan !== 0 && <Baris k="Pembulatan" v={rupiah(tagihan.pembulatan)} />}
      </dl>
      <div className="mt-2 flex items-end justify-between border-t border-bersih-200 pt-2">
        <span className="text-[0.8125rem] font-bold uppercase tracking-wider text-tinta-500">
          Total
        </span>
        <span className="text-[1.125rem] font-extrabold tabular-nums leading-none text-tinta-900">
          {rupiah(tagihan.total)}
        </span>
      </div>
      <button
        type="button"
        onClick={onBayar}
        disabled={tagihan.total <= 0}
        className="tombol-utama mt-2.5 h-12 w-full text-[0.9375rem]"
      >
        Terima pembayaran
      </button>
    </>
  );
}

function Baris({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-tinta-500">{k}</dt>
      <dd className="font-semibold tabular-nums text-tinta-900">{v}</dd>
    </div>
  );
}

/**
 * Dialog pelunasan meja.
 *
 * Sejak invoice punya sumber datanya sendiri (/api/order/invoice/:id),
 * dialog ini TIDAK lagi merakit struk. Ia hanya mencatat pembayaran, lalu
 * memberi tahu pesanan mana yang dilunasi — invoice-nya diambil ulang dari
 * database. Dulu struk dirakit dari `items` yang dikirim ke sini, dan itu
 * memuat item pesanan lain di meja yang sama.
 */
function DialogBayar({
  tagihan,
  meja,
  onTutup,
  onSukses,
}: {
  tagihan: Tagihan;
  meja: string;
  onTutup: () => void;
  /** `null` bila server tidak menyebutkan pesanan yang dilunasi. */
  onSukses: (pesananId: number | null) => void;
}) {
  const [metode, setMetode] = useState<"tunai" | "qris_kasir" | "kartu">("tunai");
  const [diterima, setDiterima] = useState<string>(String(tagihan.total));
  /*
    ── NAMA KASIR DIINGAT DI PERANGKAT ────────────────────────────────

    Sebelumnya selalu mulai dari "Kasir 1" — nama bawaan yang salah untuk
    semua orang. Kasir yang teliti harus menghapus dan mengetik namanya
    di SETIAP transaksi, karena panel ini dibuka-tutup per pembayaran.
    Di jam sibuk itu beberapa kali per menit, di tablet, sambil berdiri.

    Konsekuensi kalau dilewati bukan kosmetik: nama ini masuk ke kolom
    `oleh` pada catatan pembayaran. Salah nama berarti laporan siapa
    menerima uang menjadi tidak bisa dipercaya, dan selisih kas
    kehilangan jejak.

    Disimpan per perangkat (bukan per akun — portal ini belum punya
    login), jadi satu tablet kasir mengingat nama kasir yang biasa
    memakainya. Nilai awal dibaca di efek, bukan di useState, supaya
    render pertama di server dan klien tetap sama.
  */
  const [kasir, setKasir] = useState("Kasir 1");

  useEffect(() => {
    try {
      const tersimpan = localStorage.getItem("nabawi.kasir");
      if (tersimpan) setKasir(tersimpan);
    } catch {
      /* Mode privat / storage diblokir: nama bawaan tetap dipakai. */
    }
  }, []);

  function simpanKasir(nilai: string) {
    const rapi = nilai.slice(0, 40);
    setKasir(rapi);
    try {
      localStorage.setItem("nabawi.kasir", rapi);
    } catch {
      /* Diabaikan: mengingat nama adalah kenyamanan, bukan syarat bayar. */
    }
  }
  const [galat, setGalat] = useState("");
  const [proses, setProses] = useState(false);

  const nominal = Number(diterima.replace(/\D/g, "")) || 0;
  const kembalian = metode === "tunai" ? Math.max(0, nominal - tagihan.total) : 0;
  const cukup = nominal >= tagihan.total;

  // Tombol uang cepat: nilai yang paling sering diserahkan. Mengurangi
  // ketikan di tablet, tempat mengetik angka paling rawan salah.
  const cepat = [tagihan.total, 50000, 100000, 150000, 200000].filter(
    (v, i, a) => v >= tagihan.total && a.indexOf(v) === i
  );

  async function kirim() {
    setProses(true);
    setGalat("");
    try {
      const res = await fetch("/api/order/bayar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagihan_id: tagihan.id, metode, diterima: nominal, kasir }),
      });
      const j = await res.json();
      if (!res.ok) {
        setGalat(j.pesan ?? "Pembayaran gagal dicatat.");
        return;
      }
      const pesananId = Number(j.pesanan_id);
      onSukses(Number.isFinite(pesananId) && pesananId > 0 ? pesananId : null);
    } catch {
      setGalat("Koneksi terputus. Pembayaran belum tercatat.");
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta-900/50 p-4">
      <div className="w-full max-w-md rounded-[0.875rem] bg-bersih-0 p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[1.0625rem] font-extrabold text-tinta-900">Pembayaran meja {meja}</h3>
            <p className="text-[0.8125rem] text-tinta-500">Pembayaran dilakukan setelah makan.</p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            className="grid size-9 shrink-0 place-items-center rounded-[0.625rem] border border-bersih-200 text-tinta-700"
            aria-label="Tutup"
          >
            <IkonSilang className="size-4" />
          </button>
        </div>

        <div className="mt-3 rounded-[0.625rem] bg-bersih-100 p-3">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
            Total tagihan
          </p>
          <p className="text-[1.875rem] font-extrabold tabular-nums leading-none text-tinta-900">
            {rupiah(tagihan.total)}
          </p>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
            Metode
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["tunai", "Tunai"],
                ["qris_kasir", "QRIS"],
                ["kartu", "Kartu"],
              ] as const
            ).map(([v, t]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMetode(v)}
                className={[
                  "h-11 rounded-[0.625rem] text-[0.8125rem] font-bold transition",
                  metode === v
                    ? "bg-forest-900 text-cream-50 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
                    : "border border-bersih-200 bg-bersih-100 text-tinta-700 hover:bg-bersih-200",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {metode === "tunai" && (
          <>
            <div className="mt-3">
              <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
                Uang diterima
              </label>
              <input
                value={diterima}
                onChange={(e) => setDiterima(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="h-12 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-100 px-3 text-[1.125rem] font-extrabold tabular-nums text-tinta-900 outline-none focus:border-forest-700"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {cepat.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDiterima(String(v))}
                    className="h-9 rounded-[0.5rem] border border-bersih-200 bg-bersih-100 px-2.5 text-[0.6875rem] font-bold tabular-nums text-tinta-700"
                  >
                    {v === tagihan.total ? "Uang pas" : rupiah(v)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between rounded-[0.625rem] bg-daun-100 px-3 py-2">
              <span className="text-[0.8125rem] font-bold text-tinta-700">Kembalian</span>
              <span className="text-[1.0625rem] font-extrabold tabular-nums text-forest-700">
                {rupiah(kembalian)}
              </span>
            </div>
          </>
        )}

        <div className="mt-3">
          <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
            Nama kasir
          </label>
          <input
            value={kasir}
            onChange={(e) => simpanKasir(e.target.value)}
            className="h-10 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-100 px-3 text-[0.8125rem] text-tinta-900 outline-none focus:border-forest-700"
          />
        </div>

        {galat && (
          <p className="mt-2 rounded-[0.625rem] bg-sela-50 px-3 py-2 text-[0.8125rem] font-semibold text-sela-800">
            {galat}
          </p>
        )}

        <button
          type="button"
          onClick={kirim}
          disabled={!cukup || proses}
          className="tombol-utama mt-3 h-12 w-full text-[0.9375rem]"
        >
          {proses ? "Menyimpan…" : cukup ? `Bayar ${rupiah(tagihan.total)}` : "Nominal kurang"}
        </button>
      </div>
    </div>
  );
}

/** Nada pendek dengan WebAudio — tanpa aset audio, hemat sinyal. */
/*
  SATU AudioContext untuk seumur halaman.

  Versi sebelumnya membuat `new AudioContext()` untuk setiap nada. Dua
  akibatnya:

    · Browser membatasi jumlah AudioContext per halaman (Chrome: 6).
      Setelah beberapa pesanan, bunyi berhenti tanpa pesan galat —
      dan kasir tidak tahu ada pesanan baru.

    · AudioContext baru lahir dalam keadaan "suspended" bila dibuat
      tanpa interaksi pengguna, jadi nada pertama setelah halaman
      dimuat tidak berbunyi. Kasir yang baru membuka layar lalu berjalan
      ke meja tidak mendengarkan apa pun.
*/
let ctxAudio: AudioContext | null = null;

function ambilCtx(): AudioContext | null {
  try {
    if (!ctxAudio || ctxAudio.state === "closed") {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctxAudio = new AC();
    }
    // Lanjutkan bila browser menangguhkan (butuh satu interaksi).
    if (ctxAudio.state === "suspended") void ctxAudio.resume();
    return ctxAudio;
  } catch {
    return null;
  }
}

function bunyi(frek: number, durasi: number) {
  try {
    const ctx = ambilCtx();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = frek;
    o.type = "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durasi);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + durasi + 0.02);
  } catch {
    /* audio diblokir browser: abaikan, bunyi bukan syarat mutlak */
  }
}
