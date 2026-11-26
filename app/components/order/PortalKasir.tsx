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
import { BilahStaf } from "./Kerangka";
import { TombolKepala } from "./TombolKepala";
import { NavBawahStaf } from "./NavBawahStaf";
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
} from "./Ikon";
import { BukaInvoice } from "./LembarInvoice";
import { KartuRingkasan } from "./KartuRingkasan";
import { DaftarRiwayat } from "./DaftarRiwayat";
import type { BarisRiwayat, RingkasanPenjualan } from "@/app/lib/order/riwayat";

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
  aturan: { pajakPersen: number; layananPersen: number; layananRp: number; pembulatan: number };
  demo: boolean;
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
  const [layar, setLayar] = useState<"antrean" | "meja" | "laporan" | "riwayat">("antrean");
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

  useEffect(() => {
    muat();
    muatRiwayat();
    const t = setInterval(muat, 4000);
    return () => clearInterval(t);
  }, [muat, muatRiwayat]);

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
            oleh: "kasir",
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


  // Bunyi untuk pesanan baru (K-01). Nada dibuat dengan WebAudio, bukan
  // file audio: tidak ada aset yang perlu diunduh di sinyal lemah.
  const baru = data?.pesanan.filter((p) => p.status === "menunggu_konfirmasi").length ?? 0;
  useEffect(() => {
    if (!data) return;
    if (baru > jumlahLalu.current && jumlahLalu.current > 0 && suara) {
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
        body: JSON.stringify({ id, ke, alasan, oleh: "kasir" }),
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
        body: JSON.stringify({ aksi: "set_tersedia", menu_id: menuId, tersedia, oleh: "kasir" }),
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

  const menu = data?.menu ?? [];
  const habis = useMemo(() => menu.filter((m) => !m.tersedia), [menu]);

  return (
    <div className="min-h-dvh bg-cream-50">
      <BilahStaf
        judul="Kasir"
        keterangan={
          galat
            ? galat
            : `${antrean.length} pesanan menunggu · ${diproses.length} berjalan`
        }
        demo={data?.demo}
        ringkasan={{ keteranganPonsel: `${antrean.length}` }}
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

      {galat && (
        <div className="border-b border-sela-200 bg-sela-50 px-4 py-2 sm:px-6">
          <p className="text-[0.8125rem] font-semibold text-sela-800">{galat}</p>
        </div>
      )}

      {/*
        ── MENUNGGU BAYAR ──
        Di atas segalanya karena ini satu-satunya daftar yang butuh
        tindakan kasir SEKARANG: tamu sudah memesan, duduk, dan menunggu.
        Pesanan di sini belum masuk dapur dan akan hilang sendiri setelah
        batas waktu — jadi kalau kasir tidak melihatnya, tamu tidak dapat
        makanan tanpa ada yang tahu kenapa.
      */}
      {menungguBayar.length > 0 && (
        <section
          aria-labelledby="menunggu-bayar"
          className="border-b border-sela-200/70 bg-sela-50 px-4 py-3 sm:px-6"
        >
          <h2
            id="menunggu-bayar"
            className="mb-2 flex items-center gap-2 text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] text-sela-800"
          >
            Belum dibayar
            <span className="rounded-full bg-sela-700 px-2 py-0.5 text-[0.6875rem] font-bold text-white">
              {menungguBayar.length}
            </span>
          </h2>

          <ul className="flex gap-2 overflow-x-auto pb-1">
            {menungguBayar.map((p) => (
              <li
                key={p.id}
                className="min-w-[15rem] shrink-0 rounded-[0.75rem] border border-bersih-200 bg-bersih-0 p-2.5 shadow-[0_1px_2px_rgb(22_19_15/0.04)]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[0.875rem] font-extrabold text-tinta-900">
                    Meja {p.meja_nomor}
                  </p>
                  <span className="font-mono text-[0.6875rem] text-tinta-500">{p.nomor}</span>
                </div>
                {/*
                  TOTAL TAGIHAN, BESAR DAN LEBIH DULU DARIPADA NAMA.

                  Kartu ini sebelumnya hanya memberi tahu bahwa ADA yang
                  belum dibayar, tanpa berapa. Kasir lalu menekan "Uang
                  pas" tanpa tahu nominal yang akan diterima tamu — pada
                  tagihan Rp146.600 itu perbedaan yang membuat kasir salah
                  menyebut angka di depan tamu.

                  Kasir memegang layar ini sambil berdiri: angka yang akan
                  disebut adalah yang harus paling cepat terbaca, bukan
                  nama pemesan yang sudah diketahui dari mejanya.
                */}
                {/*
                  Hanya bila ADA yang perlu dibayar. Tagihan bersaldo nol
                  (semua itemnya sudah dibatalkan) akan tampil "Rp0" — dan
                  itu terbaca sebagai "tidak perlu bayar", bukan sebagai
                  "tagihan ini sudah kosong". Lebih baik angkanya tidak ada
                  sama sekali daripada angkanya salah arti.
                */}
                {p.total !== null && p.total > 0 && (
                  <p className="mt-0.5 text-[1.125rem] font-extrabold tabular-nums leading-tight text-forest-900">
                    {rupiah(p.total)}
                  </p>
                )}
                <p className="truncate text-[0.75rem] text-tinta-500">
                  {p.nama_pemesan ?? "Tanpa nama"} · {p.total_item} item
                </p>

                {/*
                  Metode yang DIPILIH tamu. Bukan hiasan: pesanan "online"
                  berarti tamu sedang menunggu halaman pembayaran terbuka
                  (bisa jadi tautannya gagal), sedangkan "kasir" berarti
                  tamu memang menunggu ditagih. Kasir memperlakukan keduanya
                  berbeda, jadi ia perlu tahu sebelum mendatangi meja.
                */}
                <p
                  className={[
                    "mt-1 inline-block rounded-[0.25rem] px-1.5 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-wider",
                    p.metode_bayar === "online"
                      ? "bg-sela-50 text-sela-800"
                      : "bg-daun-100 text-forest-700",
                  ].join(" ")}
                >
                  {p.metode_bayar === "online" ? "Pilih bayar online" : "Bayar di kasir"}
                </p>

                {/*
                  Nomor WA ditampilkan, bukan disimpan diam-diam. Kasir
                  membutuhkannya untuk menagih/menghubungi tamu — dan data
                  yang tidak pernah terlihat tidak akan pernah dipakai.
                */}
                {p.no_wa && (
                  <a
                    href={`https://wa.me/${p.no_wa.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block font-mono text-[0.6875rem] text-forest-700 underline"
                  >
                    {p.no_wa}
                  </a>
                )}

                {/*
                  Dua tombol, dua keadaan yang berbeda:
                    · "Uang pas"   → tamu menyerahkan nominal pas. Server
                      menghitung sendiri nominalnya dari total tagihan.
                    · "Uang lebih" → nominal dimasukkan kasir, kembalian
                      dihitung. Membuka dialog pelunasan yang sudah ada.

                  Satu tombol saja pernah membuat kasir menekan "Bayar
                  tunai" untuk tamu yang membayar Rp100.000 pada tagihan
                  Rp91.000 — dan kembaliannya hilang dari catatan.
                */}
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => bayarTunai(p)}
                    disabled={memproses === p.id}
                    className="tombol-utama h-11 flex-1 text-[0.8125rem]"
                  >
                    {memproses === p.id ? "Menyimpan…" : "Uang pas"}
                  </button>
                  <button
                    type="button"
                    onClick={() => bukaPelunasan(p.meja_id)}
                    disabled={memproses === p.id}
                    className="tombol-tenang h-11 flex-1 text-[0.8125rem]"
                  >
                    Uang lebih
                  </button>
                </div>

                {/*
                  Invoice juga bisa dibuka SEBELUM dibayar. Tamu yang
                  memilih "bayar di kasir" sering meminta rinciannya lebih
                  dulu; kasir tidak perlu menghitung ulang di kepala.
                */}
                <button
                  type="button"
                  onClick={() => setInvoiceId(p.id)}
                  className="mt-1.5 h-8 w-full rounded-[0.5rem] text-[0.75rem] font-bold text-tinta-500 underline"
                >
                  Lihat invoice
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        ── PEMBUNGKUS PADDING ───────────────────────────────────────────
        Padding dipindah ke sini (dari tiap grid) supaya tab yang tinggal
        satu kolom tidak kehilangan tepi kiri-kanannya.

        `pb-[calc(5.5rem+env(safe-area-inset-bottom))]` memberi ruang untuk
        nav bawah yang tetap (fixed). Tanpa ini, kartu terakhir — biasanya
        tombol bayar — tertutup bilah navigasi, dan itu bug yang paling
        sering muncul saat pola nav bawah dipakai tanpa perhitungan.
      */}
      <div className="p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      {layar === "antrean" && (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* ── Kolom kiri: antrean ── */}
        <section aria-labelledby="antrean">
          <h2
            id="antrean"
            className="mb-2 flex items-center gap-2 text-[0.9375rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500"
          >
            Menunggu konfirmasi
            {antrean.length > 0 && (
              <span className="rounded-full bg-sela-700 px-2 py-0.5 text-[0.6875rem] font-bold text-white">
                {antrean.length}
              </span>
            )}
          </h2>

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
            <ul className="space-y-2.5">
              {antrean.map((p) => (
                <li
                  key={p.id}
                  className="overflow-hidden rounded-[0.875rem] border border-bersih-200 bg-bersih-0 shadow-[0_2px_10px_rgb(22_19_15/0.05)] ring-1 ring-sela-700/20"
                >
                  {/*
                    KEPALA KARTU ANTREAN — nomor pesanan sebagai bintang.

                    Di acuan, hal pertama yang dibaca kasir adalah NOMOR
                    PESANAN (#1058) dalam huruf besar, bukan nomor meja.
                    Alasannya nyata: tamu menyebut nomornya ("pesanan 1058"),
                    dan nomor itulah yang dicari kasir saat antrean panjang.
                    Nomor meja tetap ada, di baris kedua.

                    Lencana "Baru" oranye: pembeda tercepat antara pesanan
                    yang belum disentuh dan yang sudah ditangani, di daftar
                    yang bentuknya seragam.
                  */}
                  <div className="flex items-start justify-between gap-2 border-b border-bersih-200 bg-cream-50 px-3.5 py-3">
                    <div className="min-w-0">
                      {/*
                        ── NOMOR PESANAN HANYA SEKALI ────────────────────

                        Versi sebelumnya menulis nomor yang SAMA dua kali:
                        sekali kecil di baris lencana dan sekali besar tepat
                        di bawahnya. Itu satu baris tinggi yang tidak
                        menambah informasi apa pun, di kartu yang tingginya
                        paling mahal — setiap piksel di sini menggeser
                        kartu berikutnya keluar dari layar.

                        Lencana "Baru" pindah sebaris dengan nomor besar,
                        jadi kepala kartu turun satu baris lagi.
                      */}
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 rounded-[0.25rem] bg-sela-500 px-1.5 py-0.5 text-[0.5625rem] font-extrabold uppercase tracking-[0.1em] text-forest-950">
                          Baru
                        </span>
                        <p className="min-w-0 truncate text-[1.375rem] font-extrabold leading-none tracking-[-0.02em] text-forest-900">
                          #{p.nomor}
                        </p>
                      </div>

                      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.75rem] text-tinta-700">
                        <span className="inline-flex items-center gap-1 rounded-full bg-daun-100 px-1.5 py-0.5 font-extrabold text-forest-700">
                          <IkonMeja className="size-3" />
                          Meja {p.meja_nomor}
                        </span>
                        {p.nama_pemesan && (
                          <span className="max-w-[12ch] truncate font-semibold">
                            {p.nama_pemesan}
                          </span>
                        )}
                        <span className="text-tinta-500">{p.total_item} item</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="flex items-center gap-1 text-[0.75rem] font-bold tabular-nums text-tinta-700">
                        <IkonJam className="size-3" />
                        {sejak(p.created_at)}
                      </span>
                      <span className="text-[1.0625rem] font-extrabold tabular-nums text-sela-700">
                        {rupiah(p.items.reduce((n, i) => n + i.harga_satuan * i.jumlah, 0))}
                      </span>
                    </div>
                  </div>

                  <ul className="divide-y divide-bersih-200 px-3.5 py-1">
                    {p.items.map((i) => (
                      <li key={i.id} className="flex items-start gap-2 py-1.5">
                        <span className="w-6 shrink-0 text-[0.9375rem] font-extrabold tabular-nums text-tinta-900">
                          {i.jumlah}×
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.9375rem] font-semibold leading-tight text-tinta-900">
                            {i.nama_saat_pesan}
                          </p>
                          {Array.isArray(i.pilihan) && i.pilihan.length > 0 && (
                            <p className="mt-0.5 text-[0.6875rem] font-extrabold uppercase tracking-wide text-forest-700">
                              {i.pilihan.map((p) => p.nama).join(" · ")}
                            </p>
                          )}
                          {i.catatan && (
                            <p className="mt-0.5 text-[0.6875rem] font-bold text-sela-700">
                              {i.catatan}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[0.8125rem] tabular-nums text-tinta-500">
                          {rupiah(i.harga_satuan * i.jumlah)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex gap-2 border-t border-bersih-200 p-2.5">
                    <button
                      type="button"
                      disabled={sedang}
                      onClick={() => ubah(p.id, "diterima")}
                      className="tombol-utama h-12 flex-1 text-[0.9375rem]"
                    >
                      <IkonCentang className="size-4" />
                      Terima
                    </button>
                    <button
                      type="button"
                      disabled={sedang}
                      onClick={() => setAlasanTolak({ id: p.id, buka: true })}
                      className="flex h-12 items-center justify-center gap-2 rounded-[0.625rem] border border-sela-200 px-4 text-[0.9375rem] font-bold text-sela-700 transition active:scale-[0.99]"
                    >
                      <IkonSilang className="size-4" />
                      Tolak
                    </button>
                  </div>

                  {/* Penolakan wajib beralasan (K-02). Alasannya ditampilkan
                      langsung, bukan modal — supaya tidak menutupi antrean
                      berikutnya yang mungkin perlu dilihat bersamaan. */}
                  {alasanTolak.buka && alasanTolak.id === p.id && (
                    <div className="border-t border-sela-200 bg-sela-50 p-2.5">
                      <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-sela-800">
                        Alasan penolakan
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {["Menu habis", "Di luar jam", "Lainnya"].map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => {
                              ubah(p.id, "ditolak", a);
                              setAlasanTolak({ id: 0, buka: false });
                            }}
                            className="h-10 rounded-[0.625rem] bg-bersih-0 px-3 text-[0.8125rem] font-bold text-sela-800 ring-1 ring-sela-200"
                          >
                            {a}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAlasanTolak({ id: 0, buka: false })}
                          className="h-10 rounded-[0.625rem] px-3 text-[0.8125rem] font-semibold text-tinta-500"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* ── Pesanan berjalan ── */}
          {diproses.length > 0 && (
            <>
              <h2 className="mb-2 mt-5 text-[0.9375rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500">
                Berjalan di dapur
              </h2>
              <ul className="space-y-1.5">
                {diproses.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-[0.625rem] shadow-[0_1px_2px_rgba(22,19,15,0.04),0_6px_16px_-10px_rgba(22,19,15,0.16)] bg-bersih-0 px-3 py-2"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-[0.5rem] bg-daun-100 text-[0.9375rem] font-extrabold text-forest-700">
                      {p.meja_nomor}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-tinta-700">
                      {p.items.map((i) => `${i.jumlah}× ${i.nama_saat_pesan}`).join(", ")}
                    </span>
                    <StatusKecil status={p.status} />
                    <span className="shrink-0 text-[0.6875rem] text-tinta-500">
                      {sejak(p.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* ── Kolom kanan: meja & tagihan ── */}
        <section aria-labelledby="meja">
          <h2
            id="meja"
            className="mb-2 text-[0.9375rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500"
          >
            Meja
          </h2>

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
                ── TIGA KEADAAN, TIGA RASA YANG BERBEDA ────────────────

                Sebelumnya hanya dua warna: "ada isi" (hijau) dan "kosong"
                (putih). Padahal ada tiga keadaan yang menuntut tindakan
                berbeda: tamu masih makan, tamu siap membayar, dan meja
                kosong.

                Legenda menjanjikan oranye untuk "perlu ditagih", tetapi
                kartunya memakai hijau yang sama dengan "terisi" — legenda
                yang berbohong lebih buruk daripada tidak ada legenda.
                Sekarang oranye itu benar-benar dipakai, dengan cincin
                tebal supaya terlihat dari jauh tanpa membaca satu huruf.
              */
              const adaIsi = m.status !== "kosong";
              const perluDitagih = Boolean(m.tagihan) && m.status !== "kosong";
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setMejaPilih(aktif ? null : m.nomor)}
                    className={[
                      "relative flex h-[4.25rem] w-full flex-col items-center justify-center rounded-[0.625rem] border-2 transition",
                      aktif
                        ? "border-forest-900 bg-forest-900 text-cream-50 shadow-[0_10px_24px_-14px_rgba(20,35,26,0.8)]"
                        : perluDitagih
                          ? "border-sela-500 bg-sela-50 text-sela-800"
                          : adaIsi
                            ? "border-transparent bg-daun-100 text-tinta-900"
                            : "border-transparent bg-bersih-0 text-tinta-500 shadow-[0_1px_2px_rgba(22,19,15,0.05)]",
                    ].join(" ")}
                  >
                    <span className="text-[1.375rem] font-extrabold leading-none">{m.nomor}</span>
                    <span
                      className={[
                        "mt-1 text-[0.6875rem] font-bold uppercase tracking-wide",
                        aktif ? "text-cream-50/75" : "",
                      ].join(" ")}
                    >
                      {/*
                        "minta bill" DIHAPUS dari sini: status itu hanya
                        pernah diset oleh fitur bill, dan fitur itu sudah
                        tidak ada. Membiarkannya berarti memelihara label
                        untuk keadaan yang tidak bisa lagi terjadi — dan
                        baris mati seperti ini yang nanti membuat orang
                        mengira fiturnya masih ada.

                        Baris data lama yang telanjur berstatus "minta_bill"
                        (ada 2 di database) tetap tampil masuk akal: ia jatuh
                        ke "terisi", yang memang benar — mejanya ada isinya.
                      */}
                      {m.status === "kosong"
                        ? "kosong"
                        : perluDitagih
                          ? "tagih"
                          : "terisi"}
                    </span>
                    {/*
                      Total tagihan diletakkan DI DALAM kartu, bukan sebagai
                      badge yang menonjol keluar. Badge di luar kartu terpotong
                      oleh tepi grid (terlihat saat uji di 1280 px) sehingga
                      angkanya tidak terbaca — dan angka ini yang menentukan
                      meja mana yang perlu ditagih.

                      Nominal ditulis PENUH, bukan "86k". Pembulatan ke ribu
                      membuat Rp85.500 tampil sebagai 86k — kasir bisa menyebut
                      angka yang bukan angka tagihannya.
                    */}
                    {m.tagihan && m.status !== "kosong" && (
                      <span
                        className={[
                          "mt-1 rounded px-0.5 text-[0.6875rem] font-bold leading-tight tabular-nums",
                          aktif ? "text-white/70" : "text-tinta-500",
                        ].join(" ")}
                      >
                        {rupiah(m.tagihan.total)}
                      </span>
                    )}
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
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[0.25rem] bg-sela-100 ring-1 ring-inset ring-sela-500/40" aria-hidden="true" />
              Perlu ditagih
            </li>
          </ul>

          {/*
            ── Ketersediaan menu (K-08) ──
            Diletakkan di kolom kanan, di bawah denah, dan bisa dilipat.
            Kasir menandai menu habis beberapa kali per jam sibuk, tetapi
            hanya butuh sekejap — panel yang selalu terbuka akan mendorong
            denah meja ke bawah, padahal denah yang dipakai terus-menerus.
          */}
          <div className="mt-3 rounded-[0.875rem] shadow-[0_1px_2px_rgba(22,19,15,0.04),0_6px_16px_-10px_rgba(22,19,15,0.16)] bg-bersih-0">
            <button
              type="button"
              onClick={() => setMenuHabisBuka((b) => !b)}
              aria-expanded={menuHabisBuka}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
              <span className="flex-1 text-[0.8125rem] font-extrabold text-tinta-900">
                Ketersediaan menu
              </span>
              <span className="text-[0.6875rem] font-semibold text-tinta-500">
                {habis.length} habis
              </span>
              <span
                className={[
                  "text-tinta-500 transition-transform",
                  menuHabisBuka ? "rotate-180" : "",
                ].join(" ")}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {/* Dua kolom: dengan satu kolom bergulir, daftar terpotong di
                tengah baris dan kasir harus menggulir untuk mencari menu
                yang sedang ia cari. 14 menu muat tanpa gulir. */}
            {menuHabisBuka && (
              <ul className="grid border-t border-bersih-200 sm:grid-cols-2">
                {menu.length === 0 ? (
                  <li className="px-3 py-3 text-[0.8125rem] text-tinta-500">
                    Menu tidak terbaca dari database.
                  </li>
                ) : (
                  menu.map((m) => (
                    <li
                      key={m.id}
                      className="flex min-w-0 items-center gap-2 border-b border-bersih-200 px-3 py-1.5 sm:odd:border-r"
                    >
                      <span
                        className={[
                          "min-w-0 flex-1 truncate text-[0.8125rem]",
                          m.tersedia ? "text-tinta-900" : "text-tinta-500 line-through",
                        ].join(" ")}
                      >
                        {m.nama}
                      </span>
                      {/*
                        Sakelar, bukan tombol "Habis"/"Tersedia" yang harus
                        ditebak keadaannya. Label teksnya tetap ada karena
                        warna saja tidak cukup (aksesibilitas).
                      */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!m.tersedia}
                        onClick={() => setTersedia(m.id, !m.tersedia)}
                        disabled={menuSibuk === m.id}
                        className={[
                          "flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[0.6875rem] font-bold transition disabled:opacity-50",
                          m.tersedia
                            ? "bg-bersih-50 text-tinta-500"
                            : "bg-sela-700 text-white",
                        ].join(" ")}
                      >
                        {m.tersedia ? "Ada" : "Habis"}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

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
      </div>
      )}

      {/*
        ── LAPORAN & RIWAYAT: DUA TAB, BUKAN SATU KOLOM PANJANG ─────────

        Sebelumnya keduanya berdiri berdampingan di bawah denah dan baru
        terbaca setelah digulir. Dengan nav bawah, keduanya jadi tujuan yang
        bisa dicapai langsung — dan masing-masing dapat lebar penuh, jadi
        angka omzet tidak lagi berdesakan dengan tabel riwayat.
      */}
      {layar === "laporan" && (
      <div>
        <section aria-labelledby="rangkuman-kasir">
          <h2
            id="rangkuman-kasir"
            className="mb-2 text-[0.9375rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500"
          >
            Penjualan hari ini
          </h2>
          <KartuRingkasan
            ringkasan={ringkasan}
            galat={pesanRingkasan}
            memuat={memuatLaporan}
          />
        </section>

      </div>
      )}

      {/*
        ── TAB RIWAYAT ─────────────────────────────────────────────────

        Isinya sama dengan sebelumnya, tetapi tidak lagi disembunyikan di
        balik panah "▾" di bawah rangkuman. Kalau riwayat punya tab sendiri,
        menyembunyikannya sekali lagi berarti dua ketukan untuk sampai ke
        daftar yang tabnya sudah sengaja dipilih — dan panah yang tertutup
        terbaca seperti bagian yang rusak, bukan bagian yang bisa dibuka.
      */}
      {layar === "riwayat" && (
      <div>
        <section aria-labelledby="riwayat-kasir">
          <h2
            id="riwayat-kasir"
            className="mb-2 flex items-center gap-2 text-[0.9375rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500"
          >
            Riwayat pesanan
            <span className="rounded-full bg-bersih-200 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-tinta-700">
              {riwayat.length}
            </span>
          </h2>
          <DaftarRiwayat riwayat={riwayat} galat={pesanRiwayat} awal={8} />
        </section>
      </div>
      )}
      </div>

      {/*
        ── NAV BAWAH ────────────────────────────────────────────────────

        Empat pekerjaan kasir, semuanya terlihat tanpa menggeser apa pun:
        antrean (yang sedang dilayani), meja (denah + tagihan), laporan
        (omzet hari ini), dan riwayat (mencari pesanan lama).

        Lencana di "Antrean" menghitung MENUNGGU KONFIRMASI + BELUM DIBAYAR
        sekaligus — keduanya adalah pesanan yang menunggu tindakan kasir, dan
        itulah satu-satunya angka yang berguna di bilah navigasi. Angka yang
        butuh dibuka dulu untuk diketahui tidak menolong siapa pun.
      */}
      <NavBawahStaf
        judul="Navigasi kasir"
        aktif={layar}
        onPilih={(k) => {
          const tujuan = k as typeof layar;
          setLayar(tujuan);
          // Ringkasan & riwayat dimuat saat tabnya dibuka, bukan saat halaman
          // dimuat: kasir yang datang untuk melayani tamu tidak perlu
          // menunggu dua kueri agregat sebelum antrean tampil.
          if (tujuan === "laporan" || tujuan === "riwayat") muatRiwayat();
        }}
        item={[
          {
            kunci: "antrean",
            label: "Antrean",
            Ikon: IkonPesanan,
            lencana: antrean.length + menungguBayar.length,
          },
          { kunci: "meja", label: "Meja", Ikon: IkonMeja },
          { kunci: "laporan", label: "Laporan", Ikon: IkonBill },
          { kunci: "riwayat", label: "Riwayat", Ikon: IkonJam },
        ]}
      />

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
    </div>
  );
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
  const [kasir, setKasir] = useState("Kasir 1");
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
            onChange={(e) => setKasir(e.target.value.slice(0, 40))}
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
function bunyi(frek: number, durasi: number) {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
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
