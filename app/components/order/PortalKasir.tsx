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
  type Panggilan,
} from "@/app/lib/order/tipe";
import { BilahStaf } from "./Kerangka";
import { TombolKepala } from "./TombolKepala";
import {
  IkonCentang,
  IkonSilang,
  IkonBel,
  IkonBill,
  IkonJam,
  IkonMeja,
  IkonMuatUlang,
  IkonSuara,
  IkonMatikanSuara,
} from "./Ikon";
import { LembarInvoice } from "./LembarInvoice";
import type { Invoice } from "@/app/lib/order/invoice";

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
};

type DataKasir = {
  pesanan: PesananK[];
  menunggu_bayar?: MenungguBayar[];
  meja: MejaKasir[];
  panggilan: (Panggilan & { meja_nomor: string })[];
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
   * Invoice yang sedang dibuka.
   *
   * Isinya diambil dari /api/order/invoice/:id — bukan dirakit dari state
   * layar ini. Struk lama dirakit dari `items_tagihan` milik meja, dan itu
   * salah begitu satu meja punya dua pesanan: struk pesanan kedua memuat
   * item pesanan pertama juga.
   *
   * `galat` menyimpan pesan bila pengambilan gagal, supaya kasir melihat
   * sebabnya — bukan dialog kosong tanpa penjelasan.
   */
  const [struk, setStruk] = useState<{ invoice: Invoice } | { galat: string } | null>(null);
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

  useEffect(() => {
    muat();
    const t = setInterval(muat, 4000);
    return () => clearInterval(t);
  }, [muat]);

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

  /**
   * Ambil invoice lalu tampilkan.
   *
   * Isinya diambil dari server, bukan dirakit dari state layar, karena
   * satu-satunya sumber angka yang boleh tercetak adalah database. Kalau
   * pengambilan gagal, kasir HARUS melihat sebabnya — invoice kosong yang
   * diam-diam tidak muncul membuat kasir mengulang pembayaran.
   */
  const bukaInvoice = useCallback(async (pesananId: number) => {
    setStruk(null);
    try {
      const res = await fetch(`/api/order/invoice/${pesananId}?kunci=1`, { cache: "no-store" });
      const j = (await res.json()) as { invoice?: Invoice; pesan?: string };
      if (!res.ok || !j.invoice) {
        setStruk({ galat: j.pesan ?? "Invoice tidak bisa dibuka." });
        return;
      }
      setStruk({ invoice: j.invoice });
    } catch {
      setStruk({ galat: "Koneksi terputus. Invoice belum bisa dibuka." });
    }
  }, []);

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
          Invoice dibuka SETELAH `muat()`: daftar di layar sudah bersih
          dari pesanan yang barusan dibayar, jadi tidak ada tombol basi
          yang masih bisa ditekan.
        */
        await bukaInvoice(p.id);
      } catch {
        setGalat("Koneksi terputus. Pembayaran belum tercatat.");
      } finally {
        setMemproses(null);
      }
    },
    [memproses, muat, bukaInvoice]
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

  async function tanganiPanggilan(id: number) {
    await fetch("/api/order/kasir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "tangani_panggilan", id }),
    }).catch(() => {});
    muat();
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
    <div className="min-h-dvh bg-bersih-50">
      <BilahStaf
        judul="Kasir"
        keterangan={
          galat
            ? galat
            : `${antrean.length} pesanan menunggu · ${diproses.length} berjalan · ${
                data?.panggilan.length ?? 0
              } panggilan`
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
        <div className="border-b border-clay-700/25 bg-tanah-100 px-4 py-2 sm:px-6">
          <p className="text-[0.8125rem] font-semibold text-clay-800">{galat}</p>
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
          className="border-b border-bersih-200 bg-bersih-100 px-4 py-3 sm:px-6"
        >
          <h2
            id="menunggu-bayar"
            className="mb-2 flex items-center gap-2 text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] text-clay-800"
          >
            Belum dibayar
            <span className="rounded-full bg-clay-700 px-2 py-0.5 text-[0.6875rem] font-bold text-bersih-0">
              {menungguBayar.length}
            </span>
          </h2>

          <ul className="flex gap-2 overflow-x-auto pb-1">
            {menungguBayar.map((p) => (
              <li
                key={p.id}
                className="min-w-[15rem] shrink-0 rounded-[0.625rem] border border-clay-700/30 bg-bersih-0 p-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[0.875rem] font-extrabold text-tinta-900">
                    Meja {p.meja_nomor}
                  </p>
                  <span className="font-mono text-[0.6875rem] text-tinta-500">{p.nomor}</span>
                </div>
                <p className="mt-0.5 truncate text-[0.75rem] text-tinta-500">
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
                      ? "bg-tanah-100 text-clay-800"
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
                    className="h-9 flex-1 rounded-[0.5rem] bg-forest-700 text-[0.75rem] font-extrabold text-bersih-0 disabled:opacity-50"
                  >
                    {memproses === p.id ? "Menyimpan…" : "Uang pas"}
                  </button>
                  <button
                    type="button"
                    onClick={() => bukaPelunasan(p.meja_id)}
                    disabled={memproses === p.id}
                    className="h-9 flex-1 rounded-[0.5rem] border border-forest-700/40 text-[0.75rem] font-bold text-forest-700 disabled:opacity-50"
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
                  onClick={() => bukaInvoice(p.id)}
                  className="mt-1.5 h-8 w-full rounded-[0.5rem] text-[0.75rem] font-bold text-tinta-500 underline"
                >
                  Lihat invoice
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* ── Kolom kiri: antrean ── */}
        <section aria-labelledby="antrean">
          <h2
            id="antrean"
            className="mb-2 flex items-center gap-2 text-[0.9375rem] font-extrabold uppercase tracking-[0.12em] text-tinta-500"
          >
            Menunggu konfirmasi
            {antrean.length > 0 && (
              <span className="rounded-full bg-clay-700 px-2 py-0.5 text-[0.6875rem] font-bold text-bersih-0">
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
                  className="overflow-hidden rounded-[0.875rem] border-2 border-clay-700/40 bg-bersih-0 shadow-[0_2px_10px_rgba(45,38,75,0.06)]"
                >
                  <div className="flex items-start gap-3 border-b border-bersih-200 bg-tanah-100 px-3.5 py-2.5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-[0.625rem] bg-tinta-900 text-[1.0625rem] font-extrabold text-bersih-0">
                      {p.meja_nomor}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.9375rem] font-extrabold text-tinta-900">
                        Meja {p.meja_nomor}
                        {p.nama_pemesan ? ` · ${p.nama_pemesan}` : ""}
                      </p>
                      <p className="flex items-center gap-1 text-[0.6875rem] text-tinta-500">
                        <IkonJam className="size-3" />
                        {sejak(p.created_at)} · {p.total_item} item · {p.nomor}
                      </p>
                    </div>
                    <span className="shrink-0 text-[1.0625rem] font-extrabold tabular-nums text-tinta-900">
                      {rupiah(p.items.reduce((n, i) => n + i.harga_satuan * i.jumlah, 0))}
                    </span>
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
                            <p className="mt-0.5 text-[0.6875rem] font-bold text-clay-700">
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
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[0.625rem] bg-tinta-900 text-[0.9375rem] font-extrabold text-bersih-0 transition active:scale-[0.99] disabled:opacity-50"
                    >
                      <IkonCentang className="size-4" />
                      Terima
                    </button>
                    <button
                      type="button"
                      disabled={sedang}
                      onClick={() => setAlasanTolak({ id: p.id, buka: true })}
                      className="flex h-12 items-center justify-center gap-2 rounded-[0.625rem] border border-clay-700/40 px-4 text-[0.9375rem] font-bold text-clay-700 transition active:scale-[0.99]"
                    >
                      <IkonSilang className="size-4" />
                      Tolak
                    </button>
                  </div>

                  {/* Penolakan wajib beralasan (K-02). Alasannya ditampilkan
                      langsung, bukan modal — supaya tidak menutupi antrean
                      berikutnya yang mungkin perlu dilihat bersamaan. */}
                  {alasanTolak.buka && alasanTolak.id === p.id && (
                    <div className="border-t border-clay-700/25 bg-tanah-100 p-2.5">
                      <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-clay-800">
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
                            className="h-10 rounded-[0.625rem] bg-bersih-0 px-3 text-[0.8125rem] font-bold text-clay-800 ring-1 ring-clay-700/30"
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

          {/* Panggilan meja ditaruh DI ATAS denah: pelanggan yang memanggil
              sedang menunggu, sedangkan denah bisa dilihat kapan saja. */}
          {(data?.panggilan.length ?? 0) > 0 && (
            <div className="mb-3 rounded-[0.875rem] border border-clay-700/30 bg-tanah-100 p-2.5">
              <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-clay-800">
                Panggilan menunggu
              </p>
              <ul className="space-y-1.5">
                {data!.panggilan.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 rounded-[0.625rem] bg-bersih-0 px-2.5 py-1.5">
                    {g.jenis === "bill" ? (
                      <IkonBill className="size-4 shrink-0 text-clay-700" />
                    ) : (
                      <IkonBel className="size-4 shrink-0 text-clay-700" />
                    )}
                    <span className="flex-1 text-[0.8125rem] font-bold text-tinta-900">
                      Meja {g.meja_nomor} · {g.jenis === "bill" ? "minta bill" : "panggil pelayan"}
                    </span>
                    <span className="text-[0.6875rem] text-tinta-500">{sejak(g.dibuat_at)}</span>
                    <button
                      type="button"
                      onClick={() => tanganiPanggilan(g.id)}
                      className="h-8 rounded-[0.5rem] bg-tinta-900 px-2.5 text-[0.6875rem] font-bold text-bersih-0"
                    >
                      Sudah
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4">
            {(data?.meja ?? []).map((m) => {
              const aktif = mejaPilih === m.nomor;
              const adaIsi = m.status !== "kosong";
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setMejaPilih(aktif ? null : m.nomor)}
                    className={[
                      "relative flex h-[4.25rem] w-full flex-col items-center justify-center rounded-[0.625rem] border-2 transition",
                      aktif
                        ? "border-tinta-900 bg-tinta-900 text-bersih-0 shadow-[0_8px_20px_-12px_rgba(22,19,15,0.7)]"
                        : adaIsi
                          ? "border-transparent bg-daun-100 text-tinta-900"
                          : "border-transparent bg-bersih-0 text-tinta-500 shadow-[0_1px_2px_rgba(22,19,15,0.05)]",
                    ].join(" ")}
                  >
                    <span className="text-[1.125rem] font-extrabold leading-none">{m.nomor}</span>
                    <span
                      className={[
                        "mt-1 text-[0.6875rem] font-bold uppercase tracking-wide",
                        aktif ? "text-bersih-0/70" : "",
                      ].join(" ")}
                    >
                      {m.status === "kosong"
                        ? "kosong"
                        : m.status === "minta_bill"
                          ? "minta bill"
                          : m.status === "menunggu_bayar"
                            ? "bayar"
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
                          aktif ? "text-bersih-0/70" : "text-tinta-500",
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
                            : "bg-clay-700 text-bersih-0",
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
            if (pesananId) bukaInvoice(pesananId);
          }}
        />
      )}

      {/* ── Invoice (sama persis dengan yang dilihat pelanggan) ── */}
      {struk && "invoice" in struk && (
        <LembarInvoice invoice={struk.invoice} onTutup={() => setStruk(null)} />
      )}
      {struk && "galat" in struk && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-tinta-900/50 p-4">
          <div className="w-full max-w-xs rounded-[0.875rem] bg-bersih-0 p-4 text-center">
            <p className="text-[0.9375rem] font-extrabold text-tinta-900">Invoice gagal dibuka</p>
            <p className="mt-1 text-[0.8125rem] text-tinta-500">{struk.galat}</p>
            <button
              type="button"
              onClick={() => setStruk(null)}
              className="mt-3 h-10 w-full rounded-[0.625rem] bg-tinta-900 text-[0.8125rem] font-bold text-bersih-0"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/*
        Peringatan ini dulu berbunyi "data pesanan tidak tersimpan permanen",
        yang memberi kesan pesanan tetap tercatat sementara. Sekarang tidak:
        tanpa kunci server, melunasi dan menandai siap akan DITOLAK. Staf
        yang membaca peringatan ini harus tahu itu sebelum mencoba, bukan
        sesudah gagal.
      */}
      {data?.demo && (
        <div className="border-t border-clay-700/25 bg-tanah-100 px-4 py-2 sm:px-6">
          <p className="text-[0.6875rem] leading-snug text-clay-800">
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
    diproses: { t: "Diproses", c: "bg-tanah-100 text-clay-800" },
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
        className="mt-2.5 h-12 w-full rounded-[0.625rem] bg-tinta-900 text-[0.9375rem] font-extrabold text-bersih-0 disabled:opacity-40"
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
                    ? "bg-tinta-900 text-bersih-0"
                    : "border border-bersih-200 bg-bersih-100 text-tinta-700",
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
          <p className="mt-2 rounded-[0.625rem] bg-clay-700/12 px-3 py-2 text-[0.8125rem] font-semibold text-clay-800">
            {galat}
          </p>
        )}

        <button
          type="button"
          onClick={kirim}
          disabled={!cukup || proses}
          className="mt-3 h-12 w-full rounded-[0.625rem] bg-tinta-900 text-[0.9375rem] font-extrabold text-bersih-0 disabled:opacity-40"
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
