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
import { saringMenuDapur } from "@/app/lib/order/filter-menu-dapur";
import { aksiTiketDapur, TAHAP_DAPUR, tiketPadaTahap } from "@/app/lib/order/tahap-dapur";
import { BilahKoneksi } from "./BilahKoneksi";
import { BilahStaf } from "./Kerangka";
import { TombolKepala } from "./TombolKepala";
import { Sidebar } from "./Sidebar";
import { IkonHabis, IkonKanan, IkonSegar } from "./IkonDapur";
import {
  IkonCari,
  IkonMenu,
  IkonMatikanSuara,
  IkonMuatUlang,
  IkonPesanan,
  IkonSilang,
  IkonSuara,
} from "./Ikon";

type Item = {
  id: number;
  nama_saat_pesan: string;
  jumlah: number;
  catatan: string | null;
  pilihan?: { nama: string; tambah: number }[] | null;
};

type MenuRingkas = {
  id: number;
  nama: string;
  tersedia: boolean;
  kategori_id: number | null;
};
type KategoriDapur = { id: number; nama: string; urutan: number };

type Tiket = {
  id: number;
  nomor: string;
  meja_nomor: string;
  nama_pemesan: string | null;
  status: string;
  created_at: string;
  items: Item[];
};

type LayarDapur = "antrean" | "menu";

function layarDapurDariUrl(cari: string): LayarDapur {
  return new URLSearchParams(cari).get("layar") === "menu" ? "menu" : "antrean";
}

export function PortalDapur({ layarAwal = "antrean" }: { layarAwal?: LayarDapur }) {
  const [tiket, setTiket] = useState<Tiket[] | null>(null);
  const [galat, setGalat] = useState("");
  /*
    Kapan pembaruan terakhir BERHASIL, dalam milidetik.

    Dipakai BilahKoneksi untuk menyebut umur data ("40 detik lalu").
    `null` = belum pernah berhasil sejak halaman dibuka — keadaan yang
    jauh lebih gawat daripada sekadar gagal sekali, dan pesannya harus
    berbeda.
  */
  const [berhasilPada, setBerhasilPada] = useState<number | null>(null);
  const [memuatUlang, setMemuatUlang] = useState(false);
  const [suara, setSuara] = useState(true);
  const [sekarang, setSekarang] = useState(() => Date.now());
  const [ambang, setAmbang] = useState({ kuning: 10, merah: 15 });
  const [menu, setMenu] = useState<MenuRingkas[]>([]);
  const [kategoriMenu, setKategoriMenu] = useState<KategoriDapur[]>([]);
  const [menuSibuk, setMenuSibuk] = useState(0);
  const [cariMenu, setCariMenu] = useState("");
  const [kategoriMenuAktif, setKategoriMenuAktif] = useState<number | "semua">("semua");
  const [layar, setLayar] = useState<LayarDapur>(layarAwal);
  const [sidebarTerbuka, setSidebarTerbuka] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem("nabawi.sidebar") === "tutup") setSidebarTerbuka(false);
    } catch {
      /* mode privat: biarkan terbuka */
    }
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (layar === "antrean") url.searchParams.delete("layar");
    else url.searchParams.set("layar", layar);
    window.history.replaceState(null, "", url);
  }, [layar]);
  useEffect(() => {
    const saatMundur = () => setLayar(layarDapurDariUrl(window.location.search));
    window.addEventListener("popstate", saatMundur);
    return () => window.removeEventListener("popstate", saatMundur);
  }, []);

  function toggleSidebar() {
    setSidebarTerbuka((terbuka) => {
      const berikutnya = !terbuka;
      try {
        window.localStorage.setItem("nabawi.sidebar", berikutnya ? "buka" : "tutup");
      } catch {
        /* abaikan */
      }
      return berikutnya;
    });
  }
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
      setBerhasilPada(Date.now());
      setTiket(j.tiket);
      if (j.ambang) setAmbang(j.ambang);
      if (Array.isArray(j.menu)) setMenu(j.menu);
      if (Array.isArray(j.kategori)) setKategoriMenu(j.kategori);
    } catch {
      setGalat("Koneksi terputus. Tiket tidak diperbarui sampai pulih.");
    }
  }, []);

  /*
    ── BERHENTI MENEMBAK SAAT GAGAL ──────────────────────────────────

    Polling 3 detik dulu berjalan terus apa pun yang terjadi: server yang
    sudah menjawab 500 akan ditembak 20 kali per menit, dari setiap layar
    dapur yang terbuka. Itu tidak mempercepat pemulihan — ia menambah
    beban pada server yang sedang bermasalah dan menghabiskan kuota data
    tablet yang memakai hotspot.

    Sekarang: saat galat, jadwalnya melambat ke 15 detik (tetap mencoba
    pulih sendiri, tanpa perlu ada yang menekan apa pun), dan tombol
    "Muat ulang" di bilah peringatan memberi jalan pulih seketika.
  */
  useEffect(() => {
    muat();
    const t = setInterval(muat, galat ? 15000 : 3000);
    const jam = setInterval(() => setSekarang(Date.now()), 10000);
    return () => {
      clearInterval(t);
      clearInterval(jam);
    };
  }, [muat, galat]);

  const baru = useMemo(() => tiketPadaTahap(tiket ?? [], TAHAP_DAPUR[0]), [tiket]);

  /** Umur data terakhir, dihitung ulang tiap `sekarang` berdetak (10 dtk). */
  const umurData =
    berhasilPada === null ? null : Math.max(0, Math.floor((sekarang - berhasilPada) / 1000));

  async function muatUlangManual() {
    setMemuatUlang(true);
    try {
      await muat();
    } finally {
      setMemuatUlang(false);
    }
  }
  const habis = useMemo(() => menu.filter((m) => !m.tersedia), [menu]);
  const petaKategoriMenu = useMemo(
    () => new Map(kategoriMenu.map((kategori) => [kategori.id, kategori.nama])),
    [kategoriMenu],
  );
  const menuTersaring = useMemo(
    () => saringMenuDapur(menu, { cari: cariMenu, kategoriId: kategoriMenuAktif }),
    [menu, cariMenu, kategoriMenuAktif],
  );

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
    <div className="flex min-h-dvh bg-forest-950 text-gelap-isi">
      <Sidebar
        judul="Dapur & Bar"
        aktif={layar}
        terbuka={sidebarTerbuka}
        onToggle={toggleSidebar}
        onPilih={(k) => {
          setLayar(k as LayarDapur);
          window.scrollTo({ top: 0 });
        }}
        item={[
          {
            kunci: "antrean",
            label: "Antrean",
            href: "#antrean",
            Ikon: IkonPesanan,
            lencana: (tiket ?? []).length,
            warna: "sela",
          },
          {
            kunci: "menu",
            label: "Menu",
            href: "#menu-dapur",
            Ikon: IkonMenu,
            lencana: habis.length,
            warna: "sela",
          },
        ]}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <BilahStaf
          tanpaLogo
          judul={layar === "antrean" ? "Antrean" : "Menu"}
          keterangan={galat || ""}
          kanan={
            <>
              <TombolKepala
                onClick={() => setSuara((s) => !s)}
                aktif={suara}
                ikon={suara ? <IkonSuara className="size-4" /> : <IkonMatikanSuara className="size-4" />}
                label={suara ? "Bunyi aktif" : "Bunyi mati"}
              />
              <TombolKepala
                onClick={muatUlangManual}
                ikon={<IkonMuatUlang className="size-4" />}
                label="Muat ulang"
              />
            </>
          }
        />

      {/*
        Peringatan koneksi DI ATAS papan tiket, bukan di dalam kepala.

        Kepala dapur berisi dua tombol alat, dan di ponsel
        ruangnya tinggal beberapa piksel. Menaruh peringatan di sana
        berarti ia kembali jadi satu karakter "!" yang tidak dibaca
        siapa pun. Bilah penuh di sini tidak mungkin terlewat, dan ia
        mendorong papan ke bawah dengan sengaja: papan yang beku harus
        terlihat beku.
      */}
      <BilahKoneksi
        galat={galat}
        tema="gelap"
        sejakBerhasil={umurData}
        onMuatUlang={muatUlangManual}
        sibuk={memuatUlang}
      />

      {layar === "menu" && (
        <section id="menu-dapur" aria-labelledby="menu-dapur-judul" className="min-w-0 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 id="menu-dapur-judul" className="text-sm font-extrabold uppercase tracking-wide text-cream-50">
              Ketersediaan menu
            </h2>
            <span className="text-xs tabular-nums text-gelap-samar">{menu.length} menu</span>
            <span className="rounded bg-sela-700 px-2 py-0.5 text-xs font-bold text-white">
              {habis.length} habis
            </span>
          </div>

          <label className="mb-3 flex h-11 max-w-xl items-center gap-2 rounded-md border border-cream-50/15 bg-forest-900 px-3">
            <IkonCari className="size-4 shrink-0 text-gelap-samar" />
            <input
              value={cariMenu}
              onChange={(e) => setCariMenu(e.target.value)}
              placeholder="Cari nama menu"
              aria-label="Cari nama menu"
              className="min-w-0 flex-1 bg-transparent text-sm text-cream-50 outline-none placeholder:text-gelap-samar"
            />
            {cariMenu && (
              <button
                type="button"
                onClick={() => setCariMenu("")}
                aria-label="Hapus pencarian"
                className="grid size-8 shrink-0 place-items-center rounded text-gelap-samar hover:bg-cream-50/10 hover:text-cream-50"
              >
                <IkonSilang className="size-4" />
              </button>
            )}
          </label>

          <div
            role="group"
            aria-label="Filter kategori menu"
            className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              onClick={() => setKategoriMenuAktif("semua")}
              aria-pressed={kategoriMenuAktif === "semua"}
              className={[
                "h-9 shrink-0 rounded px-3 text-xs font-extrabold transition",
                kategoriMenuAktif === "semua"
                  ? "bg-cream-50 text-forest-900"
                  : "border border-cream-50/15 text-gelap-redup hover:bg-cream-50/10",
              ].join(" ")}
            >
              Semua ({menu.length})
            </button>
            {kategoriMenu
              .filter((k) => menu.some((m) => m.kategori_id === k.id))
              .map((k) => {
                const jumlah = menu.filter((m) => m.kategori_id === k.id).length;
                const aktif = kategoriMenuAktif === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKategoriMenuAktif(aktif ? "semua" : k.id)}
                    aria-pressed={aktif}
                    className={[
                      "h-9 shrink-0 rounded px-3 text-xs font-extrabold transition",
                      aktif
                        ? "bg-cream-50 text-forest-900"
                        : "border border-cream-50/15 text-gelap-redup hover:bg-cream-50/10",
                    ].join(" ")}
                  >
                    {k.nama} ({jumlah})
                  </button>
                );
              })}
          </div>

          {menu.length === 0 ? (
            <p className="rounded-md border border-dashed border-cream-50/15 px-4 py-8 text-center text-sm text-gelap-samar">
              Menu tidak terbaca.
            </p>
          ) : menuTersaring.length === 0 ? (
            <p className="rounded-md border border-dashed border-cream-50/15 px-4 py-8 text-center text-sm text-gelap-samar">
              {kategoriMenuAktif === "semua" ? (
                <>Tidak ada menu yang cocok dengan “{cariMenu}”.</>
              ) : (
                <>Tidak ada menu di kategori {petaKategoriMenu.get(kategoriMenuAktif) ?? "ini"} yang cocok dengan “{cariMenu}”.</>
              )}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {menuTersaring.map((m) => (
                <li
                  key={m.id}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-cream-50/10 bg-forest-900/70 p-2.5"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-cream-50">{m.nama}</p>
                    <p className="mt-0.5 text-[0.6875rem] font-semibold text-gelap-samar">
                      {m.kategori_id === null
                        ? "Tanpa kategori"
                        : petaKategoriMenu.get(m.kategori_id) ?? "Kategori lain"}
                    </p>
                    <p className={[
                      "mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] font-bold",
                      m.tersedia ? "bg-forest-700 text-cream-50" : "bg-sela-700 text-white",
                    ].join(" ")}>
                      {!m.tersedia && <IkonHabis className="size-3" />}
                      {m.tersedia ? "Tersedia" : "Habis"}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`${m.nama}: ${m.tersedia ? "tandai habis" : "aktifkan tersedia lagi"}`}
                    onClick={() => setTersedia(m.id, !m.tersedia)}
                    disabled={menuSibuk === m.id}
                    className={[
                      "h-10 shrink-0 rounded px-2.5 text-xs font-extrabold transition disabled:cursor-wait disabled:opacity-50",
                      m.tersedia
                        ? "border border-cream-50/20 text-cream-50 hover:bg-cream-50/10"
                        : "bg-forest-600 text-white hover:bg-forest-500",
                    ].join(" ")}
                  >
                    {menuSibuk === m.id ? "Menyimpan…" : m.tersedia ? "Tandai habis" : "Aktifkan tersedia"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {layar === "antrean" && (
        <main id="antrean" className="min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-3 sm:p-4">
            {TAHAP_DAPUR.map((kol) => {
              const isi = tiketPadaTahap(tiket ?? [], kol);
              return (
                <section key={kol.kunci} aria-labelledby={`tahap-${kol.kunci}`} className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-2 border-b border-cream-50/15 pb-2">
                    <h2 id={`tahap-${kol.kunci}`} className="text-sm font-extrabold uppercase tracking-wide text-cream-50">
                      {kol.judul}
                    </h2>
                    <span className="grid min-w-7 place-items-center rounded bg-cream-50/10 px-2 py-0.5 text-xs font-extrabold tabular-nums text-cream-50">
                      {isi.length}
                    </span>
                  </div>

                  {isi.length === 0 ? (
                    <p className="rounded-md border border-dashed border-cream-50/15 px-3 py-5 text-center text-xs text-gelap-samar">
                      Tidak ada tiket.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {isi.map((t) => {
                        const menit = menitTunggu(t.created_at, sekarang);
                        const aksi = aksiTiketDapur(t.status, kol);
                        const tingkat =
                          menit >= ambang.merah ? "merah" : menit >= ambang.kuning ? "kuning" : "baru";
                        const pita =
                          tingkat === "merah" ? "bg-sela-700" : tingkat === "kuning" ? "bg-sela-500" : "bg-forest-600";
                        const lencana =
                          tingkat === "merah"
                            ? "bg-sela-100 text-sela-800"
                            : tingkat === "kuning"
                              ? "bg-sela-50 text-sela-800"
                              : "bg-bersih-100 text-tinta-700";

                        return (
                          <article
                            key={t.id}
                            className="overflow-hidden rounded-md bg-cream-50 shadow-[0_4px_12px_-8px_rgb(0_0_0/0.55)]"
                          >
                            <div className="flex items-stretch">
                              <span className={`w-1.5 shrink-0 ${pita}`} aria-hidden="true" />
                              <div className="min-w-0 flex-1 p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-mono text-[0.6875rem] font-bold text-tinta-500">{t.nomor}</p>
                                    <p className="mt-0.5 break-words text-base font-extrabold leading-tight text-forest-900">
                                      Meja {t.meja_nomor}
                                      {t.nama_pemesan ? (
                                        <span className="ml-1 text-xs font-semibold text-tinta-700">· {t.nama_pemesan}</span>
                                      ) : null}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 flex-col items-end gap-1">
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-xs font-extrabold tabular-nums ${lencana}`}
                                      title={sejak(t.created_at, sekarang)}
                                    >
                                      {menit} mnt
                                    </span>
                                    <span className="rounded bg-daun-100 px-1.5 py-0.5 text-[0.5625rem] font-extrabold uppercase tracking-wide text-forest-700">
                                      Lunas
                                    </span>
                                  </div>
                                </div>

                                <ul className="mt-2 space-y-1.5 border-t border-bersih-200 pt-2">
                                  {t.items.map((i) => (
                                    <li key={i.id}>
                                      <div className="flex items-baseline gap-2">
                                        <span className="min-w-6 shrink-0 text-sm font-extrabold tabular-nums leading-none text-sela-700">
                                          {i.jumlah}×
                                        </span>
                                        <span className="min-w-0 flex-1 break-words text-sm font-bold leading-tight text-tinta-900">
                                          {i.nama_saat_pesan}
                                        </span>
                                      </div>
                                      {Array.isArray(i.pilihan) && i.pilihan.length > 0 && (
                                        <p className="ml-8 mt-1 rounded bg-daun-100 px-2 py-1 text-xs font-extrabold uppercase leading-tight tracking-wide text-forest-700">
                                          {i.pilihan.map((p) => p.nama).join(" · ")}
                                        </p>
                                      )}
                                      {i.catatan && (
                                        <p className="ml-8 mt-1 break-words rounded bg-sela-100 px-2 py-1 text-xs font-extrabold leading-tight text-sela-800">
                                          {i.catatan}
                                        </p>
                                      )}
                                    </li>
                                  ))}
                                </ul>

                                <button
                                  type="button"
                                  onClick={() => maju(t.id, aksi.ke)}
                                  className="tombol-utama mt-2.5 h-11 w-full text-sm uppercase tracking-[0.06em]"
                                >
                                  {kol.kunci === "siap" ? <IkonSegar className="size-5" /> : null}
                                  {aksi.label}
                                  {kol.kunci === "siap" ? null : <IkonKanan className="size-5" />}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <p className="px-4 pb-4 text-center text-[0.6875rem] text-gelap-samar">
            Pita hijau = baru, oranye = lewat {ambang.kuning} menit, merah bata = lewat {ambang.merah} menit.
            Angka menit selalu ditampilkan agar tetap terbaca tanpa membedakan warna.
          </p>
        </main>
      )}
      </div>

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
