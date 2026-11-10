"use client";

/**
 * Portal dapur & bar (satu layar, sesuai keputusan pemilik).
 *
 * KEPUTUSAN DESAIN — semuanya punya alasan operasional
 *
 * 1. Tiga kolom tetap, bukan satu daftar. Dapur bekerja seperti papan tiket
 *    di restoran: yang belum dikerjakan, yang sedang dikerjakan, dan yang
 *    siap. Satu daftar memaksa membaca status per baris — itu kerja mata
 *    yang tidak perlu saat tangan penuh.
 *
 * 2. Huruf besar dan tebal untuk nama menu, angka jumlah dipisah ke kolom
 *    sendiri supaya "2×" dan "Tajine Ayam" bisa dipindai terpisah.
 *    PRD D-09: huruf besar, kontras tinggi.
 *
 * 3. Catatan khusus (mis. "tanpa sambal") dicetak tebal, diberi latar
 *    krem, dan TIDAK pernah dipotong. Ini bagian yang paling sering
 *    menyebabkan pesanan dikembalikan.
 *
 * 4. Warna waktu tunggu mengikuti ambang di pengaturan (kuning >10 menit,
 *    merah >15 menit). Warna saja tidak cukup untuk orang dengan buta
 *    warna, jadi selalu disertai angkanya ("12 mnt").
 *
 * 5. Satu tombol besar per tiket: memindahkan ke kolom berikutnya.
 *    Hampir tanpa mengetik (PRD bagian 4).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { menitTunggu, sejak } from "@/app/lib/order/tipe";
import { BilahStaf } from "./Kerangka";
import { TombolKepala } from "./TombolKepala";
import { IkonBel, IkonHabis, IkonKanan, IkonKembali, IkonSegar } from "./IkonDapur";
import { IkonMuatUlang, IkonSuara, IkonMatikanSuara } from "./Ikon";
import { LogoNabawi } from "./LogoNabawi";

type Item = {
  id: number;
  nama_saat_pesan: string;
  jumlah: number;
  catatan: string | null;
  pilihan?: { nama: string; tambah: number }[] | null;
};

type MenuRingkas = { id: number; nama: string; tersedia: boolean };

type Tiket = {
  id: number;
  nomor: string;
  meja_nomor: string;
  nama_pemesan: string | null;
  status: string;
  created_at: string;
  items: Item[];
};

const KOLOM = [
  { kunci: "menunggu", judul: "Baru", status: ["diterima"], aksi: "diproses", label: "Mulai" },
  { kunci: "diproses", judul: "Diproses", status: ["diproses"], aksi: "siap", label: "Siap" },
  { kunci: "siap", judul: "Siap", status: ["siap"], aksi: "diantar", label: "Diantar" },
] as const;

export function PortalDapur() {
  const [tiket, setTiket] = useState<Tiket[] | null>(null);
  const [galat, setGalat] = useState("");
  const [suara, setSuara] = useState(true);
  const [sekarang, setSekarang] = useState(() => Date.now());
  const [ambang, setAmbang] = useState({ kuning: 10, merah: 15 });
  const [menu, setMenu] = useState<MenuRingkas[]>([]);
  const [menuBuka, setMenuBuka] = useState(false);
  const [menuSibuk, setMenuSibuk] = useState(0);
  const jumlahLalu = useRef(0);
  const idLalu = useRef<Set<number>>(new Set());

  const muat = useCallback(async () => {
    try {
      const res = await fetch("/api/order/dapur", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        setGalat(j.pesan ?? "Gagal memuat tiket.");
        return;
      }
      setGalat("");
      setTiket(j.tiket);
      if (j.ambang) setAmbang(j.ambang);
      if (Array.isArray(j.menu)) setMenu(j.menu);
    } catch {
      setGalat("Koneksi terputus. Tiket tidak diperbarui sampai pulih.");
    }
  }, []);

  useEffect(() => {
    muat();
    const t = setInterval(muat, 3000);
    const jam = setInterval(() => setSekarang(Date.now()), 10000);
    return () => {
      clearInterval(t);
      clearInterval(jam);
    };
  }, [muat]);

  const baru = useMemo(() => (tiket ?? []).filter((t) => t.status === "diterima"), [tiket]);
  const habis = useMemo(() => menu.filter((m) => !m.tersedia), [menu]);

  // Bunyi pesanan baru. Pesanan TAMBAHAN di meja yang sudah punya tiket
  // memakai nada berbeda (D-06) supaya dapur tahu ini bukan meja baru.
  useEffect(() => {
    if (!tiket) return;
    const ids = new Set(baru.map((t) => t.id));
    const tambahan = baru.filter((t) => idLalu.current.has(t.id));
    const benar2Baru = baru.filter((t) => !idLalu.current.has(t.id));

    if (jumlahLalu.current > 0 && suara) {
      if (benar2Baru.length > 0) {
        bunyi(920, 0.1);
        setTimeout(() => bunyi(1240, 0.12), 120);
      } else if (tambahan.length > 0) {
        bunyi(640, 0.16);
      }
    }
    jumlahLalu.current = baru.length;
    idLalu.current = ids;
  }, [baru, suara, tiket]);

  /**
   * D-07 — tandai menu/bahan habis.
   *
   * Optimistis di layar, dikembalikan bila server menolak. Dapur menekan
   * tombol ini dengan tangan basah/bertepung; umpan balik yang tertunda
   * membuat tombol terasa mati dan ditekan berulang.
   */
  async function setTersedia(menuId: number, tersedia: boolean) {
    setMenuSibuk(menuId);
    setMenu((d) => d.map((m) => (m.id === menuId ? { ...m, tersedia } : m)));
    try {
      const res = await fetch("/api/order/dapur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "set_tersedia", menu_id: menuId, tersedia, oleh: "dapur" }),
      });
      const j = await res.json();
      if (!res.ok) {
        setGalat(j.pesan ?? "Gagal menandai menu.");
        await muat();
      }
    } catch {
      setGalat("Koneksi terputus. Menu belum ditandai.");
      await muat();
    } finally {
      setMenuSibuk(0);
    }
  }

  async function maju(id: number, ke: string) {
    await fetch("/api/order/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ke, oleh: "dapur" }),
    }).catch(() => {});
    muat();
  }

  return (
    /* Latar gelap, bukan terang. Alasan: layar dapur sering berada di area
       teduh dan dinyalakan sepanjang hari; latar gelap dengan teks krem
       mengurangi silau dan menjaga tiket tetap jadi fokus paling terang.
       Ini kebalikan dari portal pelanggan, dan disengaja. */
    <div className="min-h-dvh bg-tinta-900 text-gelap-isi">
      <header className="sticky top-0 z-30 border-b border-tinta-700/60 bg-tinta-900/95 backdrop-blur">
        {/*
          DUA KELOMPOK, SATU BARIS: identitas kiri, alat kanan.

          Dapur adalah kepala paling padat — tiga tombol di kanan. Di ponsel
          360px tombolnya menyusut jadi ikon (labelnya tetap ada untuk
          pembaca layar) dan "Menu habis" memakai ikon piring supaya angka
          jumlahnya tetap bisa dibaca tanpa label. `flex-nowrap` di sini
          bukan pilihan gaya: baris kedua berarti satu tiket lebih sedikit
          yang terlihat di papan.
        */}
        <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-2 px-2 py-2.5 sm:gap-3 sm:px-6">
          {/* ── KIRI: identitas kafe ── */}
          <div className="flex min-w-0 items-center">
            {/*
              Logo versi terang: kepala dapur berlatar gelap, jadi nama kafe
              memakai gelap-isi dan keterangannya gelap-samar. Menyalin warna
              dari portal kasir (tinta-900 di atas tinta-900) akan membuat
              nama kafe tak terbaca — persis kegagalan yang dicegah oleh
              prop `tema` di komponen logo.
            */}
            <LogoNabawi
              tema="gelap"
              ukuran={30}
              layar={
                <>
                  <span className="sm:hidden">Dapur</span>
                  <span className="hidden sm:inline">Dapur &amp; Bar</span>
                </>
              }
              keterangan={galat || `${baru.length} baru · ${(tiket ?? []).length} tiket`}
              keteranganPonsel={galat ? "!" : `${baru.length}`}
            />
          </div>

          {/* ── KANAN: alat dapur ── */}
          <div className="flex shrink-0 items-center gap-1.5">
            <TombolKepala
              tema="gelap"
              onClick={() => setSuara((s) => !s)}
              aktif={suara}
              ikon={suara ? <IkonSuara className="size-4" /> : <IkonMatikanSuara className="size-4" />}
              label={suara ? "Bunyi aktif" : "Bunyi mati"}
            />
            <TombolKepala
              tema="gelap"
              onClick={() => setMenuBuka((b) => !b)}
              expanded={menuBuka}
              judul="Tandai bahan habis"
              className={habis.length > 0 ? "border-clay-700/60 bg-clay-800 text-gelap-isi" : ""}
              ikon={<IkonHabis className="size-4" />}
              label="Habis"
            >
              {/*
                Angka jumlah selalu tampil, termasuk di ponsel: ia satu-satunya
                hal yang memberi tahu dapur bahwa ada bahan yang sedang kosong
                tanpa membuka panelnya.
              */}
              <span className="rounded-full bg-gelap-isi/10 px-1.5 text-[0.6875rem] tabular-nums">
                {habis.length}
              </span>
            </TombolKepala>
            <TombolKepala
              tema="gelap"
              onClick={muat}
              ikon={<IkonMuatUlang className="size-4" />}
              label="Muat ulang"
            />
          </div>
        </div>
      </header>

      {/*
        Panel ketersediaan (D-07). Diletakkan di ATAS papan tiket tapi
        hanya terbuka bila diminta: saat jam sibuk, papan tiket harus tetap
        jadi hal pertama yang terlihat. Yang sudah ditandai habis tetap
        tampil di label hitungan tombol ("Menu habis 2") supaya dapur ingat
        apa yang sedang kosong tanpa perlu membuka panel.
      */}
      {menuBuka && (
        <div className="border-b border-tinta-700/60 bg-tinta-800 px-3 py-2 sm:px-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-gelap-samar">
              Ketuk untuk menandai bahan habis
            </p>
            <p className="text-[0.6875rem] text-gelap-samar">
              Langsung berlaku di portal pelanggan dan kasir
            </p>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {menu.length === 0 && (
              <li className="text-[0.8125rem] text-gelap-samar">Menu tidak terbaca.</li>
            )}
            {menu.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!m.tersedia}
                  aria-label={`${m.nama}: ${m.tersedia ? "tandai habis" : "tandai tersedia"}`}
                  onClick={() => setTersedia(m.id, !m.tersedia)}
                  disabled={menuSibuk === m.id}
                  className={[
                    "h-11 rounded-[0.625rem] border px-3 text-[0.9375rem] font-bold transition disabled:opacity-50",
                    m.tersedia
                      ? "border-tinta-700 text-gelap-redup active:bg-gelap-isi/10"
                      : "border-clay-700 bg-clay-800 text-bersih-0 line-through",
                  ].join(" ")}
                >
                  {m.nama}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-3">
        {KOLOM.map((kol) => {
          const isi = (tiket ?? []).filter((t) => (kol.status as readonly string[]).includes(t.status));
          return (
            <section
              key={kol.kunci}
              aria-labelledby={`kol-${kol.kunci}`}
              className="min-w-0 rounded-xl border border-tinta-700/60 bg-tinta-800"
            >
              <h2
                id={`kol-${kol.kunci}`}
                className="flex items-center justify-between gap-2 border-b border-tinta-700/60 px-3 py-2"
              >
                <span className="text-[0.9375rem] font-extrabold uppercase tracking-[0.14em] text-gelap-redup">
                  {kol.judul}
                </span>
                <span className="rounded-full bg-gelap-isi/10 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-gelap-isi">
                  {isi.length}
                </span>
              </h2>

              <div className="min-h-[8rem] space-y-2 p-2">
                {isi.length === 0 && (
                  <p className="px-2 py-6 text-center text-[0.8125rem] text-gelap-samar">
                    Kosong
                  </p>
                )}

                {isi.map((t) => {
                  const menit = menitTunggu(t.created_at, sekarang);
                  const warna =
                    menit >= ambang.merah
                      ? "border-clay-700 bg-clay-800"
                      : menit >= ambang.kuning
                        ? "border-aksi-terang/70 bg-tinta-800"
                        : "border-tinta-700 bg-tinta-800";

                  return (
                    <article
                      key={t.id}
                      className={`overflow-hidden rounded-[0.625rem] border-2 ${warna} shadow-[0_2px_12px_rgba(0,0,0,0.25)]`}
                    >
                      <div className="flex items-center gap-2 px-3 pt-2.5">
                        {/* Nomor meja paling besar di tiket: itu satu-satunya
                            informasi yang dicari saat mengantar. */}
                        <span className="grid size-11 shrink-0 place-items-center rounded-[0.625rem] bg-gelap-isi text-[1.125rem] font-extrabold leading-none text-tinta-900">
                          {t.meja_nomor}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.9375rem] font-bold text-gelap-isi">
                            {t.nama_pemesan || "Tanpa nama"}
                          </p>
                          <p className="font-mono text-[0.6875rem] text-gelap-samar">{t.nomor}</p>
                        </div>
                        {/* Waktu tunggu: angka SELALU ada, warna hanya penguat. */}
                        <span
                          className={[
                            "shrink-0 rounded-[0.5rem] px-2 py-1 text-[0.8125rem] font-extrabold tabular-nums",
                            menit >= ambang.merah
                              ? "bg-gelap-isi text-clay-800"
                              : menit >= ambang.kuning
                                ? "bg-aksi-terang text-tinta-900"
                                : "bg-gelap-isi/10 text-gelap-isi",
                          ].join(" ")}
                          title={sejak(t.created_at, sekarang)}
                        >
                          {menit} mnt
                        </span>
                      </div>

                      <ul className="mt-2 space-y-1 px-3">
                        {t.items.map((i) => (
                          <li key={i.id}>
                            <div className="flex items-baseline gap-2">
                              <span className="min-w-6 shrink-0 text-[1.0625rem] font-extrabold tabular-nums leading-none text-gelap-isi">
                                {i.jumlah}×
                              </span>
                              <span className="min-w-0 flex-1 text-[1.0625rem] font-bold leading-tight text-gelap-isi">
                                {i.nama_saat_pesan}
                              </span>
                            </div>
                            {/*
                              Pilihan (saus/rasa) didahulukan di atas catatan,
                              dengan huruf besar dan kontras tinggi. Dapur harus
                              membacanya dari dua meter; salah saus = hidangan
                              dibuat ulang.
                            */}
                            {Array.isArray(i.pilihan) && i.pilihan.length > 0 && (
                              <p className="mt-1 ml-8 rounded-[0.5rem] bg-daun-100 px-2 py-1 text-[0.9375rem] font-extrabold uppercase leading-tight tracking-wide text-forest-700">
                                {i.pilihan.map((p) => p.nama).join(" · ")}
                              </p>
                            )}
                            {i.catatan && (
                              /* Catatan: tebal, latar terang, tidak dipotong.
                                 Dipotong berarti dapur bisa melewatkan
                                 "tanpa sambal" — kesalahan yang paling mahal. */
                              <p className="mt-1 ml-8 rounded-[0.5rem] bg-bersih-0 px-2 py-1 text-[0.9375rem] font-extrabold leading-tight text-clay-800">
                                {i.catatan}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        onClick={() => maju(t.id, kol.aksi)}
                        className="mt-2.5 flex w-full items-center justify-center gap-2 border-t border-tinta-700 bg-gelap-isi/8 py-3.5 text-[1.0625rem] font-extrabold uppercase tracking-wide text-gelap-isi transition active:bg-tinta-700/60"
                      >
                        {kol.kunci === "siap" ? <IkonSegar className="size-5" /> : null}
                        {kol.label}
                        {kol.kunci === "siap" ? null : <IkonKanan className="size-5" />}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <p className="px-4 pb-4 text-center text-[0.6875rem] text-gelap-samar">
        Warna kuning di atas {ambang.kuning} menit, merah di atas {ambang.merah} menit. Angka menit
        selalu ditampilkan agar tetap terbaca tanpa membedakan warna.
      </p>
    </div>
  );
}

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
    o.type = "square";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durasi);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + durasi + 0.02);
  } catch {
    /* abaikan */
  }
}
