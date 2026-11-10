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
import { IkonCentang, IkonSilang, IkonBel, IkonBill, IkonJam, IkonMeja } from "./Ikon";

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

type DataKasir = {
  pesanan: PesananK[];
  meja: MejaKasir[];
  panggilan: (Panggilan & { meja_nomor: string })[];
  menu?: Menu[];
  aturan: { pajakPersen: number; layananPersen: number; layananRp: number; pembulatan: number };
  demo: boolean;
};

/**
 * Alamat yang tercetak di struk (PRD bagian 11: nama cafe, ALAMAT, nomor
 * meja, tanggal dan jam, nama kasir).
 *
 * Catatan jujur: alamat lengkap Nabawi belum ada di repo maupun di PRD,
 * jadi yang dicetak hanya wilayahnya. JANGAN mengarang nomor rumah pada
 * dokumen yang diserahkan ke tamu — alamat salah di struk lebih buruk
 * daripada alamat singkat yang benar.
 *
 * Nama kafe TIDAK diulang di sini: baris tepat di atasnya sudah
 * "Nabawi Cafe & Resto", dan struk kertas hanya selebar 8 cm.
 */
const ALAMAT_STRUK = "Yogyakarta";

type StrukData = {
  tagihan: Tagihan;
  meja: string;
  metode: string;
  diterima: number;
  kembalian: number;
  kasir: string;
  waktu: string;
  items: BarisStruk[];
  pajakPersen: number;
  layananPersen: number;
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
  const [struk, setStruk] = useState<StrukData | null>(null);

  const jumlahLalu = useRef(0);

  /*
    Persentase pajak & layanan untuk dicetak di struk ("PPN 11%").
    Sumbernya tarif dari server (aturan), bukan angka yang ditulis di
    komponen — kalau pemilik mengubah tarif, struk ikut berubah tanpa
    menyentuh kode.
  */
  const pajakPersen = data?.aturan?.pajakPersen ?? 11;
  const layananPersen = data?.aturan?.layananPersen ?? 0;

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
        kanan={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSuara((s) => !s)}
              className={[
                "flex h-10 items-center gap-2 rounded-[0.625rem] border px-3 text-[0.8125rem] font-bold",
                suara
                  ? "border-forest-700/40 bg-daun-100 text-forest-700"
                  : "border-bersih-200 bg-bersih-100 text-tinta-500",
              ].join(" ")}
            >
              <IkonBel className="size-4" />
              {suara ? "Bunyi aktif" : "Bunyi mati"}
            </button>
            <button
              type="button"
              onClick={muat}
              className="h-10 rounded-[0.625rem] border border-bersih-200 px-3 text-[0.8125rem] font-bold text-tinta-700"
            >
              Muat ulang
            </button>
          </div>
        }
      />

      {galat && (
        <div className="border-b border-clay-700/25 bg-tanah-100 px-4 py-2 sm:px-6">
          <p className="text-[0.8125rem] font-semibold text-clay-800">{galat}</p>
        </div>
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
          // Item diambil dari state SEBELUM pembayaran: setelah lunas,
          // pesanan keluar dari daftar aktif dan itemnya tidak dikirim lagi.
          items={data?.meja.find((m) => m.nomor === bayar.meja)?.items_tagihan ?? []}
          pajakPersen={pajakPersen}
          layananPersen={layananPersen}
          onTutup={() => setBayar(null)}
          onSukses={(s) => {
            setBayar(null);
            setStruk(s);
            muat();
          }}
        />
      )}

      {struk && <Struk data={struk} onTutup={() => setStruk(null)} />}

      {data?.demo && (
        <div className="border-t border-clay-700/25 bg-tanah-100 px-4 py-2 sm:px-6">
          <p className="text-[0.6875rem] text-clay-800">
            <strong>Mode demo.</strong> Data pesanan tidak tersimpan permanen. Pasang
            SUPABASE_SERVICE_KEY di Vercel agar pesanan sungguhan tersimpan.
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

function DialogBayar({
  tagihan,
  meja,
  items,
  pajakPersen,
  layananPersen,
  onTutup,
  onSukses,
}: {
  tagihan: Tagihan;
  meja: string;
  items: BarisStruk[];
  pajakPersen: number;
  layananPersen: number;
  onTutup: () => void;
  onSukses: (s: StrukData) => void;
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
      onSukses({
        tagihan: j.tagihan ?? tagihan,
        meja,
        metode,
        diterima: nominal,
        kembalian,
        kasir,
        waktu: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
        items,
        pajakPersen,
        layananPersen,
      });
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

/**
 * Struk (K-10). Ditampilkan setelah lunas, dengan tata letak yang sengaja
 * menyerupai struk kertas: huruf monospace, garis putus-putus, rata kanan
 * untuk uang. Tujuannya supaya kasir dan pelanggan sama-sama bisa
 * mencocokkan angka secara vertikal, bukan membaca kalimat.
 */
function Struk({ data, onTutup }: { data: StrukData; onTutup: () => void }) {
  const labelMetode: Record<string, string> = {
    tunai: "Tunai",
    qris_kasir: "QRIS di kasir",
    kartu: "Kartu",
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta-900/50 p-4">
      <div className="w-full max-w-xs rounded-[0.875rem] bg-bersih-0 p-4 shadow-2xl">
        <div className="border-b border-dashed border-bersih-200 pb-2 text-center">
          <p className="text-[0.9375rem] font-extrabold text-tinta-900">Nabawi Cafe &amp; Resto</p>
          {/*
            Alamat wajib ada di struk (PRD bagian 11). Sebelumnya baris ini
            berisi teks pemasaran "berkonsep Maroko · riverside view" — tidak
            berguna bagi tamu yang membawa pulang struk dan ingin tahu ini
            tagihan tempat mana.
          */}
          <p className="text-[0.6875rem] leading-tight text-tinta-500">{ALAMAT_STRUK}</p>
        </div>

        <div className="mt-2 space-y-0.5 font-mono text-[0.6875rem] text-tinta-700">
          <div className="flex justify-between">
            <span>Meja</span>
            <span className="font-bold text-tinta-900">{data.meja}</span>
          </div>
          <div className="flex justify-between">
            <span>Waktu</span>
            <span>{data.waktu}</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir</span>
            <span>{data.kasir}</span>
          </div>
        </div>

        <div className="my-2 border-t border-dashed border-bersih-200" />

        {/*
          Daftar item (PRD bagian 11): nama, jumlah, harga satuan, harga
          baris. Tanpa ini struk hanya berisi angka akhir, dan tamu yang
          merasa ditagih lebih besar tidak bisa mencocokkan sendiri — satu-
          satunya jalan adalah memanggil kasir lagi.
        */}
        <ul className="space-y-1 font-mono text-[0.6875rem]">
          {data.items.length === 0 ? (
            <li className="text-tinta-500">Tidak ada item tercatat.</li>
          ) : (
            data.items.map((i) => (
              <li key={`${i.nama}-${i.harga_satuan}-${(i.pilihan ?? []).map((p) => p.nama).sort().join(",")}`}>
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 flex-1 break-words text-tinta-900">
                    {i.jumlah}× {i.nama}
                  </span>
                  <span className="shrink-0 tabular-nums text-tinta-900">
                    {rupiah(i.harga_baris)}
                  </span>
                </div>
                {/*
                  Pilihan dicetak di struk. Kalau tidak, tamu tidak bisa
                  membuktikan saus mana yang ia pesan saat tagihan dipersoalkan,
                  dan kasir tidak punya dasar untuk membela dapur.
                */}
                {Array.isArray(i.pilihan) && i.pilihan.length > 0 && (
                  <div className="pl-3 text-[0.6875rem] font-bold uppercase tracking-wide text-tinta-700">
                    {i.pilihan.map((p) => p.nama).join(" · ")}
                  </div>
                )}
                {/*
                  Harga satuan ditulis hanya bila jumlahnya lebih dari satu.
                  Untuk 1 item angkanya sama persis dengan harga baris dan
                  hanya menambah baris yang harus dibaca.
                */}
                {i.jumlah > 1 && (
                  <div className="pl-3 text-[0.6875rem] text-tinta-500">
                    @ {rupiah(i.harga_satuan)}
                  </div>
                )}
              </li>
            ))
          )}
        </ul>

        <div className="my-2 border-t border-dashed border-bersih-200" />

        <dl className="space-y-1 font-mono text-[0.6875rem]">
          <div className="flex justify-between">
            <dt className="text-tinta-500">Subtotal</dt>
            <dd className="tabular-nums text-tinta-900">{rupiah(data.tagihan.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-tinta-500">
              Biaya layanan
              {data.layananPersen > 0 ? ` ${data.layananPersen}%` : ""}
            </dt>
            <dd className="tabular-nums text-tinta-900">{rupiah(data.tagihan.layanan)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-tinta-500">
              Pajak{data.pajakPersen > 0 ? ` ${data.pajakPersen}%` : ""}
            </dt>
            <dd className="tabular-nums text-tinta-900">{rupiah(data.tagihan.pajak)}</dd>
          </div>
          {data.tagihan.pembulatan !== 0 && (
            <div className="flex justify-between">
              <dt className="text-tinta-500">Pembulatan</dt>
              <dd className="tabular-nums text-tinta-900">{rupiah(data.tagihan.pembulatan)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-bersih-200 pt-1">
            <dt className="font-bold text-tinta-900">TOTAL</dt>
            <dd className="text-[0.9375rem] font-extrabold tabular-nums text-tinta-900">
              {rupiah(data.tagihan.total)}
            </dd>
          </div>
        </dl>

        <div className="my-2 border-t border-dashed border-bersih-200" />

        <dl className="space-y-1 font-mono text-[0.6875rem]">
          <div className="flex justify-between">
            <dt className="text-tinta-500">Bayar</dt>
            <dd className="tabular-nums text-tinta-900">{labelMetode[data.metode]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-tinta-500">Diterima</dt>
            <dd className="tabular-nums text-tinta-900">{rupiah(data.diterima)}</dd>
          </div>
          {data.kembalian > 0 && (
            <div className="flex justify-between">
              <dt className="text-tinta-500">Kembalian</dt>
              <dd className="tabular-nums text-tinta-900">{rupiah(data.kembalian)}</dd>
            </div>
          )}
        </dl>

        <p className="mt-3 border-t border-dashed border-bersih-200 pt-2 text-center text-[0.6875rem] text-tinta-500">
          Terima kasih. Meja sudah ditutup.
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 flex-1 rounded-[0.625rem] border border-bersih-200 text-[0.8125rem] font-bold text-tinta-900"
          >
            Cetak
          </button>
          <button
            type="button"
            onClick={onTutup}
            className="h-10 flex-1 rounded-[0.625rem] bg-tinta-900 text-[0.8125rem] font-bold text-bersih-0"
          >
            Selesai
          </button>
        </div>
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
