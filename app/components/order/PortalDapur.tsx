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
import { BilahKoneksi } from "./BilahKoneksi";
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
  const [menuBuka, setMenuBuka] = useState(false);
  /*
    Tab aktif papan tiket. Bawaannya "menunggu" (Baru) — pekerjaan yang
    memang harus dikerjakan lebih dulu. Kalau bawaannya "Diproses", tiket
    baru menumpuk tanpa terlihat karena staf sedang melihat tahap lain.
  */
  const [tabAktif, setTabAktif] = useState<(typeof KOLOM)[number]["kunci"]>("menunggu");
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
      setBerhasilPada(Date.now());
      setTiket(j.tiket);
      if (j.ambang) setAmbang(j.ambang);
      if (Array.isArray(j.menu)) setMenu(j.menu);
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

  const baru = useMemo(() => (tiket ?? []).filter((t) => t.status === "diterima"), [tiket]);

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
    <div className="min-h-dvh bg-forest-950 text-gelap-isi">
      <header className="sticky top-0 z-30 border-b border-cream-50/10 bg-forest-900/95 backdrop-blur">
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
              className={habis.length > 0 ? "bg-sela-700 text-white hover:bg-sela-800" : ""}
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
        Peringatan koneksi DI ATAS papan tiket, bukan di dalam kepala.

        Kepala dapur penuh (tiga tombol alat + logo), dan di ponsel
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

      {/*
        Panel ketersediaan (D-07). Diletakkan di ATAS papan tiket tapi
        hanya terbuka bila diminta: saat jam sibuk, papan tiket harus tetap
        jadi hal pertama yang terlihat. Yang sudah ditandai habis tetap
        tampil di label hitungan tombol ("Menu habis 2") supaya dapur ingat
        apa yang sedang kosong tanpa perlu membuka panel.
      */}
      {menuBuka && (
        <div className="border-b border-cream-50/10 bg-forest-800 px-3 py-2 sm:px-4">
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
                      ? "border-cream-50/15 text-gelap-redup hover:bg-cream-50/10 active:bg-cream-50/15"
                      : "border-sela-600 bg-sela-700 text-white line-through",
                  ].join(" ")}
                >
                  {m.nama}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        ── TAB FILTER + SATU DAFTAR ────────────────────────────────────────

        Sebelumnya tiga KOLOM berdampingan (Baru | Diproses | Siap). Di
        tablet dapur itu terbaca sebagai tiga papan kecil: tiketnya sempit,
        nama hidangan terpotong, dan tiap kolom menggulir sendiri sehingga
        sulit membandingkan mana yang paling lama menunggu.

        Sekarang satu daftar penuh dengan tab di atas — mengikuti acuan.
        Alasannya bukan tren: tiket jadi selebar layar, sehingga nomor
        pesanan, daftar item, dan catatan muat dalam satu pandangan. Yang
        hilang hanyalah kemampuan melihat ketiga tahap sekaligus; itu
        ditutup angka di setiap tab, jadi dapur tetap tahu ada 2 tiket
        menunggu walau sedang membuka tab "Diproses".
      */}
      <div className="sticky top-[3.75rem] z-20 border-b border-cream-50/10 bg-forest-950/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="mx-auto flex max-w-[52rem] gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {KOLOM.map((kol) => {
            const jumlah = (tiket ?? []).filter((t) =>
              (kol.status as readonly string[]).includes(t.status)
            ).length;
            const aktif = tabAktif === kol.kunci;
            return (
              <button
                key={kol.kunci}
                type="button"
                onClick={() => setTabAktif(kol.kunci)}
                aria-pressed={aktif}
                className={[
                  "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-extrabold uppercase tracking-[0.06em] transition",
                  aktif
                    ? "bg-cream-50 text-forest-900"
                    : "border border-cream-50/15 text-gelap-redup hover:bg-cream-50/10",
                ].join(" ")}
              >
                {kol.judul}
                <span
                  className={[
                    "grid min-w-5 place-items-center rounded-full px-1 text-[0.6875rem] font-extrabold tabular-nums",
                    aktif ? "bg-forest-900 text-cream-50" : "bg-cream-50/12 text-gelap-isi",
                  ].join(" ")}
                >
                  {jumlah}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-[52rem] space-y-2.5 p-3 sm:p-4">
        {(tiket ?? []).length === 0 && (
          <p className="rounded-[1rem] border border-dashed border-cream-50/15 px-4 py-10 text-center text-[0.8125rem] text-gelap-samar">
            Belum ada tiket masuk.
          </p>
        )}

        {(() => {
          const kol = KOLOM.find((k) => k.kunci === tabAktif) ?? KOLOM[0];
          const isi = (tiket ?? []).filter((t) =>
            (kol.status as readonly string[]).includes(t.status)
          );

          if (isi.length === 0 && (tiket ?? []).length > 0) {
            return (
              <p className="rounded-[1rem] border border-dashed border-cream-50/15 px-4 py-10 text-center text-[0.8125rem] text-gelap-samar">
                Tidak ada tiket di tahap &ldquo;{kol.judul}&rdquo;.
              </p>
            );
          }

          return isi.map((t) => {
            const menit = menitTunggu(t.created_at, sekarang);
            /*
              KARTU TERANG DI ATAS LATAR GELAP — ini perubahan yang paling
              terasa di dapur.

              Sebelumnya kartu ikut gelap, jadi seluruh layar satu bidang
              hijau tua dan tiket hanya dibedakan garis tipis. Di ruangan
              terang, staf harus mendekat untuk membaca nama hidangan.
              Sekarang tiketnya kertas krem: teksnya gelap di atas terang
              (13:1), dan latar gelap hanya menjadi bingkai. Kontras antar
              elemen jadi jauh lebih besar tanpa menaikkan kecerahan layar.

              Urgensi tetap terbaca lewat pita kiri + lencana menit:
              hijau (baru), oranye (mulai menua), merah bata (terlambat).
            */
            const tingkat =
              menit >= ambang.merah ? "merah" : menit >= ambang.kuning ? "kuning" : "baru";

            const pita =
              tingkat === "merah"
                ? "bg-sela-700"
                : tingkat === "kuning"
                  ? "bg-sela-500"
                  : "bg-forest-600";

            const lencana =
              tingkat === "merah"
                ? "bg-sela-100 text-sela-800"
                : tingkat === "kuning"
                  ? "bg-sela-50 text-sela-800"
                  : "bg-bersih-100 text-tinta-700";

            return (
              <article
                key={t.id}
                className="overflow-hidden rounded-[1rem] bg-cream-50 shadow-[0_10px_28px_-16px_rgb(0_0_0/0.55)]"
              >
                <div className="flex items-stretch">
                  <span className={`w-1.5 shrink-0 ${pita}`} aria-hidden="true" />

                  <div className="min-w-0 flex-1 p-3">
                    {/* Baris atas: nomor pesanan besar + waktu tunggu */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[0.75rem] font-bold text-tinta-500">
                          {t.nomor}
                        </p>
                        <p className="mt-0.5 text-[1.125rem] font-extrabold leading-tight text-forest-900">
                          Meja {t.meja_nomor}
                          {t.nama_pemesan ? (
                            <span className="ml-1.5 text-[0.875rem] font-semibold text-tinta-700">
                              · {t.nama_pemesan}
                            </span>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`rounded-[0.5rem] px-2 py-1 text-[0.8125rem] font-extrabold tabular-nums ${lencana}`}
                          title={sejak(t.created_at, sekarang)}
                        >
                          {menit} mnt
                        </span>
                        <span className="rounded-[0.25rem] bg-daun-100 px-1.5 py-0.5 text-[0.5625rem] font-extrabold uppercase tracking-[0.1em] text-forest-700">
                          Lunas
                        </span>
                      </div>
                    </div>

                    {/* Item: besar, karena dibaca dari dua meter */}
                    <ul className="mt-2.5 space-y-1.5 border-t border-bersih-200 pt-2.5">
                      {t.items.map((i) => (
                        <li key={i.id}>
                          <div className="flex items-baseline gap-2">
                            <span className="min-w-6 shrink-0 text-[1rem] font-extrabold tabular-nums leading-none text-sela-700">
                              {i.jumlah}×
                            </span>
                            <span className="min-w-0 flex-1 text-[1rem] font-bold leading-tight text-tinta-900">
                              {i.nama_saat_pesan}
                            </span>
                          </div>

                          {Array.isArray(i.pilihan) && i.pilihan.length > 0 && (
                            <p className="ml-8 mt-1 rounded-[0.5rem] bg-daun-100 px-2 py-1 text-[0.875rem] font-extrabold uppercase leading-tight tracking-wide text-forest-700">
                              {i.pilihan.map((p) => p.nama).join(" · ")}
                            </p>
                          )}

                          {i.catatan && (
                            <p className="ml-8 mt-1 rounded-[0.5rem] bg-sela-100 px-2 py-1 text-[0.875rem] font-extrabold leading-tight text-sela-800">
                              {i.catatan}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => maju(t.id, kol.aksi)}
                      className="tombol-utama mt-3 h-12 w-full text-[0.9375rem] uppercase tracking-[0.08em]"
                    >
                      {kol.kunci === "siap" ? <IkonSegar className="size-5" /> : null}
                      {kol.label}
                      {kol.kunci === "siap" ? null : <IkonKanan className="size-5" />}
                    </button>
                  </div>
                </div>
              </article>
            );
          });
        })()}
      </div>

      <p className="px-4 pb-4 text-center text-[0.6875rem] text-gelap-samar">
        Pita hijau = baru, oranye = lewat {ambang.kuning} menit, merah bata = lewat{" "}
        {ambang.merah} menit. Angka menit selalu ditampilkan agar tetap terbaca tanpa
        membedakan warna.
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
