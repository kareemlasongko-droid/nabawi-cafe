"use client";

/**
 * Portal admin: kelola menu, harga, ketersediaan, pajak & biaya layanan.
 *
 * KEPUTUSAN DESAIN
 *
 * 1. Daftar, bukan kartu. Admin mengerjakan tugas berulang (mengubah harga,
 *    menandai habis) — yang dibutuhkan adalah kepadatan dan kolom yang
 *    sejajar, bukan kartu besar yang memakan ruang.
 *
 * 2. "Tandai habis" adalah sakelar di baris, bukan buka detail lalu simpan.
 *    Ini aksi yang paling sering dilakukan saat jam sibuk dan harus bisa
 *    selesai dalam satu ketukan.
 *
 * 3. Harga disunting dengan input angka + format rupiah saat kehilangan
 *    fokus. Kasir/admin mengetik "68000", bukan "Rp68.000".
 */

import { useMemo, useState } from "react";
import { rupiah } from "@/app/lib/order/tipe";
import { BilahStaf } from "./Kerangka";
import type { KategoriMenu, Menu, PilihanMenu } from "@/app/lib/order/tipe";
import type { AturanBiaya } from "@/app/lib/order/aturan";
import { IkonCentang, IkonSilang, IkonTambah, IkonHapus, IkonBintang, IkonCari, IkonCariHapus } from "./Ikon";
import { saringMenu, hitungPerKategori, type SaringanStatus } from "@/app/lib/order/saring";

type Saringan = SaringanStatus;

export function PortalAdmin({
  awal,
  aturanAwal,
  bisaUbah,
  galatAwal,
}: {
  awal: { kategori: KategoriMenu[]; menu: Menu[] };
  aturanAwal: AturanBiaya;
  bisaUbah: boolean;
  galatAwal: string;
}) {
  const [menu, setMenu] = useState<Menu[]>(awal.menu);
  const [aturan, setAturan] = useState<AturanBiaya>(aturanAwal);
  const [galat, setGalat] = useState(galatAwal);
  const [tab, setTab] = useState<"menu" | "biaya">("menu");
  const [sunting, setSunting] = useState<Menu | null>(null);
  const [baru, setBaru] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [tersimpan, setTersimpan] = useState("");

  // Peta id → nama. Dipakai kolom tabel, pencarian, dan chip kategori.
  // Identitasnya dijaga stabil karena ikut jadi dependensi useMemo di bawah:
  // kalau dibuat ulang tiap render, hasil saringan dihitung ulang terus.
  const namaKategori = useMemo(
    () => new Map(awal.kategori.map((k) => [k.id, k.nama])),
    [awal.kategori]
  );


  // ── Saringan daftar menu ──────────────────────────────────────────────
  // 126 menu berarti admin harus menggulir ±3 layar untuk sampai ke "Wagyu".
  // Tiga saringan ini menjawab tiga cara orang mencari: mengetik nama,
  // memilih kategori, atau mencari yang sedang habis untuk ditandai ulang.
  const [cari, setCari] = useState("");
  const [kategoriSaring, setKategoriSaring] = useState<number | "semua">("semua");
  const [statusSaring, setStatusSaring] = useState<Saringan>("semua");

  const hasilSaring = useMemo(
    () =>
      saringMenu(menu, namaKategori, {
        cari,
        kategori: kategoriSaring,
        status: statusSaring,
      }),
    [menu, cari, kategoriSaring, statusSaring, namaKategori]
  );

  const adaSaringan = cari.trim() !== "" || kategoriSaring !== "semua" || statusSaring !== "semua";

  /**
   * Jumlah menu per kategori SETELAH kata kunci dan status diterapkan.
   *
   * Angka ini sengaja bukan jumlah mentah: kalau admin mengetik "ayam",
   * chip "Kopi 24" akan menipu — diklik, hasilnya nol. Dengan hitungan
   * gabungan, setiap chip menjawab "kalau saya pilih ini, akan ada berapa".
   */
  const jumlahPerKategori = useMemo(() => hitungPerKategori(hasilSaring), [hasilSaring]);

  function bersihkanSaringan() {
    setCari("");
    setKategoriSaring("semua");
    setStatusSaring("semua");
  }


  async function ubahMenu(m: Menu, patch: Partial<Menu>) {
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch("/api/order/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) {
        setGalat(j.pesan ?? "Gagal menyimpan perubahan.");
        return false;
      }
      setMenu((daftar) => daftar.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
      setTersimpan(`${m.nama} diperbarui`);
      setTimeout(() => setTersimpan(""), 2500);
      return true;
    } catch {
      setGalat("Koneksi terputus. Perubahan belum tersimpan.");
      return false;
    } finally {
      setSibuk(false);
    }
  }

  async function simpanBaru(data: {
    nama: string;
    deskripsi: string;
    harga: number;
    kategori_id: number | null;
    pilihan: PilihanMenu[];
    rekomendasi: boolean;
  }) {
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch("/api/order/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tersedia: true, urutan: 99 }),
      });
      const j = await res.json();
      if (!res.ok) {
        setGalat(j.pesan ?? "Gagal menambah menu.");
        return false;
      }
      const dibuat = Array.isArray(j.data) ? j.data[0] : j.data;
      if (dibuat) setMenu((d) => [...d, dibuat as Menu]);
      setBaru(false);
      // Menu baru yang tidak cocok saringan akan "hilang" dari tabel tepat
      // setelah disimpan — admin mengira penyimpanan gagal. Saringan
      // dibersihkan supaya baris barunya pasti terlihat.
      bersihkanSaringan();
      setTersimpan("Menu baru ditambahkan");
      setTimeout(() => setTersimpan(""), 2500);
      return true;
    } catch {
      setGalat("Koneksi terputus. Menu belum tersimpan.");
      return false;
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bersih-50">
      <BilahStaf
        judul="Admin menu"
        keterangan={
          (bisaUbah
            ? `${menu.length} menu · ${menu.filter((m) => m.tersedia).length} tersedia`
            : "Hanya-baca: kunci server database belum dipasang")
        }
        kanan={
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setTab("menu")}
              className={[
                "h-10 rounded-[0.625rem] px-3 text-[0.8125rem] font-bold",
                tab === "menu" ? "bg-tinta-900 text-bersih-0" : "border border-bersih-200 text-tinta-700",
              ].join(" ")}
            >
              Menu
            </button>
            <button
              type="button"
              onClick={() => setTab("biaya")}
              className={[
                "h-10 rounded-[0.625rem] px-3 text-[0.8125rem] font-bold",
                tab === "biaya" ? "bg-tinta-900 text-bersih-0" : "border border-bersih-200 text-tinta-700",
              ].join(" ")}
            >
              Pajak &amp; layanan
            </button>
          </div>
        }
      />

      {!bisaUbah && (
        <div className="border-b border-clay-700/25 bg-tanah-100 px-4 py-2 sm:px-6">
          <p className="text-[0.6875rem] leading-snug text-clay-800">
            <strong>Hanya-baca.</strong> Perubahan menu memerlukan kunci server database
            (SUPABASE_SERVICE_KEY) yang dipasang di Vercel. Tanpa itu, halaman ini hanya
            menampilkan data.
          </p>
        </div>
      )}

      {/*
        Satu tempat untuk galat, dan hanya bila penyebabnya bukan sekadar
        kunci server yang belum dipasang — keadaan itu sudah dijelaskan oleh
        pita di atas. Dua pita kuning bertumpuk dengan pesan yang sama
        membuat admin mengira ada dua masalah berbeda.
      */}
      {galat && bisaUbah && (
        <div className="border-b border-clay-700/25 bg-tanah-100 px-4 py-2 sm:px-6">
          <p className="text-[0.8125rem] font-semibold text-clay-800">{galat}</p>
        </div>
      )}

      {tab === "menu" && (
        <div className="p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[0.6875rem] leading-snug text-tinta-500">
              Harga yang diubah di sini tidak mengubah tagihan yang sudah terbuka — tagihan
              memakai harga saat dipesan.
            </p>
            <button
              type="button"
              onClick={() => setBaru(true)}
              disabled={!bisaUbah}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-[0.625rem] bg-tinta-900 px-3 text-[0.8125rem] font-bold text-bersih-0 disabled:opacity-40"
            >
              <IkonTambah className="size-4" />
              Menu baru
            </button>
          </div>

          {/*
            ── Saringan ──────────────────────────────────────────────────
            Selalu terbuka, tidak dilipat: admin membuka halaman ini untuk
            mencari satu menu tertentu, bukan untuk membaca seluruh daftar.
            Kolom yang harus dibuka dulu akan membuat pencarian jadi dua
            ketukan, padahal itu pekerjaan yang paling sering dilakukan.

            Urutannya mengikuti kebiasaan: ketik dulu (paling cepat), lalu
            kategori, lalu status. Status diletakkan paling kanan karena
            hanya dipakai saat jam sibuk atau saat menandai menu kembali ada.
          */}
          <div className="mb-3 rounded-[0.875rem] bg-bersih-0 p-2.5 shadow-[0_1px_2px_rgba(22,19,15,0.04),0_6px_16px_-10px_rgba(22,19,15,0.16)]">
            <div className="relative">
              <IkonCari className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-500" />
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Cari menu atau kategori…"
                aria-label="Cari menu atau kategori"
                className="h-11 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-50 pl-9 pr-10 text-[0.9375rem] text-tinta-900 outline-none placeholder:text-tinta-500 focus:border-tinta-700 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
              />
              {cari && (
                <button
                  type="button"
                  onClick={() => setCari("")}
                  aria-label="Hapus kata pencarian"
                  className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-tinta-500 transition active:bg-bersih-100"
                >
                  <IkonCariHapus className="size-4" />
                </button>
              )}
            </div>

            {/* Kategori: satu baris yang bisa digeser, sama seperti chip di
                portal pelanggan supaya staf dan tamu melihat kosakata yang
                sama. Hitungan di tiap chip memakai daftar SETELAH kata kunci
                dan status diterapkan — jadi angka itu menjawab "kalau saya
                pilih kategori ini, akan ada berapa baris", bukan sekadar
                jumlah mentah yang menyesatkan. */}
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ChipSaring
                aktif={kategoriSaring === "semua"}
                onClick={() => setKategoriSaring("semua")}
              >
                Semua
              </ChipSaring>
              {awal.kategori.map((k) => {
                const jumlah = jumlahPerKategori.get(k.id) ?? 0;
                return (
                  <ChipSaring
                    key={k.id}
                    aktif={kategoriSaring === k.id}
                    onClick={() => setKategoriSaring(kategoriSaring === k.id ? "semua" : k.id)}
                  >
                    {k.nama}
                    <span className="tabular-nums opacity-60">{jumlah}</span>
                  </ChipSaring>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {(
                [
                  ["semua", "Semua status"],
                  ["ada", "Tersedia"],
                  ["habis", "Habis"],
                ] as const
              ).map(([nilai, label]) => (
                <ChipSaring
                  key={nilai}
                  aktif={statusSaring === nilai}
                  onClick={() => setStatusSaring(nilai)}
                  kecil
                >
                  {label}
                </ChipSaring>
              ))}

              {/* Ringkasan hasil + tombol bersihkan. Diletakkan di baris yang
                  sama dengan status supaya mata tidak perlu berpindah jauh
                  untuk tahu "berapa yang tersisa". */}
              {/* aria-live: saat admin mengetik, angka ini berubah terus.
                  Tanpa pengumuman, pengguna pembaca layar tidak tahu
                  pencariannya menyisakan berapa baris. */}
              <span
                aria-live="polite"
                className="ml-auto text-[0.6875rem] tabular-nums text-tinta-500"
              >
                {hasilSaring.length} dari {menu.length} menu
              </span>
              {adaSaringan && (
                <button
                  type="button"
                  onClick={bersihkanSaringan}
                  className="rounded-full px-2 py-1 text-[0.6875rem] font-bold text-tinta-700 underline decoration-bersih-300 underline-offset-2"
                >
                  Bersihkan
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[0.875rem] shadow-[0_1px_2px_rgba(22,19,15,0.04),0_6px_16px_-10px_rgba(22,19,15,0.16)] bg-bersih-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-bersih-200 bg-bersih-100 text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
                  <th className="px-3 py-2">Menu</th>
                  <th className="hidden px-3 py-2 sm:table-cell">Kategori</th>
                  <th className="px-3 py-2 text-right">Harga</th>
                  <th className="px-3 py-2 text-center">Tersedia</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-bersih-200">
                {hasilSaring.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <p className="text-[0.9375rem] font-bold text-tinta-700">
                        Tidak ada menu yang cocok
                      </p>
                      <p className="mx-auto mt-1 max-w-[22rem] text-[0.8125rem] leading-relaxed text-tinta-500">
                        Coba kata lain, atau kosongkan saringan. Pencarian memeriksa nama,
                        deskripsi, dan nama kategori.
                      </p>
                      {adaSaringan && (
                        <button
                          type="button"
                          onClick={bersihkanSaringan}
                          className="mt-3 h-9 rounded-[0.5rem] border border-bersih-200 px-3 text-[0.8125rem] font-bold text-tinta-700"
                        >
                          Tampilkan semua menu
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {hasilSaring.map((m) => (
                  <tr key={m.id} className={m.tersedia ? "" : "bg-bersih-50"}>
                    <td className="px-3 py-2">
                      <p
                        className={[
                          "text-[0.9375rem] font-bold leading-tight",
                          m.tersedia ? "text-tinta-900" : "text-tinta-500 line-through",
                        ].join(" ")}
                      >
                        {m.nama}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[0.6875rem] text-tinta-500">
                        {m.deskripsi}
                      </p>
                      {/* Penanda pilihan. Tanpa ini, satu-satunya cara tahu
                          sebuah menu punya add-on adalah membuka dialognya
                          satu per satu. */}
                      {Array.isArray(m.pilihan) && m.pilihan.length > 0 && (
                        <p className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="rounded-full bg-bersih-100 px-1.5 py-0.5 text-[0.6875rem] font-bold text-tinta-700">
                            {m.pilihan.length} pilihan
                          </span>
                          {m.pilihan.some((p) => p.tambah > 0) && (
                            <span className="rounded-full bg-tanah-100 px-1.5 py-0.5 text-[0.6875rem] font-bold text-clay-800">
                              ada tambahan harga
                            </span>
                          )}
                        </p>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 text-[0.8125rem] text-tinta-500 sm:table-cell">
                      {m.kategori_id ? (namaKategori.get(m.kategori_id) ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-[0.9375rem] font-bold tabular-nums text-tinta-900">
                      {rupiah(m.harga)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => ubahMenu(m, { tersedia: !m.tersedia })}
                        disabled={!bisaUbah || sibuk}
                        aria-pressed={m.tersedia}
                        className={[
                          "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[0.6875rem] font-bold transition disabled:opacity-50",
                          m.tersedia
                            ? "bg-daun-100 text-forest-700"
                            : "bg-tanah-100 text-clay-800",
                        ].join(" ")}
                      >
                        {m.tersedia ? (
                          <>
                            <IkonCentang className="size-3" /> Ada
                          </>
                        ) : (
                          <>
                            <IkonSilang className="size-3" /> Habis
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/*
                          Bintang rekomendasi: aksi yang paling sering
                          berubah (stok sedang banyak, hidangan baru), jadi
                          satu ketukan langsung dari tabel — bukan buka
                          dialog lalu simpan. Sama seperti sakelar
                          "tersedia" di kolom sebelah.
                        */}
                        <button
                          type="button"
                          onClick={() => ubahMenu(m, { rekomendasi: !m.rekomendasi })}
                          disabled={!bisaUbah || sibuk}
                          aria-pressed={m.rekomendasi === true}
                          aria-label={
                            m.rekomendasi
                              ? `Cabut rekomendasi ${m.nama}`
                              : `Jadikan ${m.nama} rekomendasi`
                          }
                          title={m.rekomendasi ? "Rekomendasi" : "Jadikan rekomendasi"}
                          className={[
                            "grid size-8 place-items-center rounded-[0.5rem] border transition disabled:opacity-40",
                            m.rekomendasi
                              ? "border-aksi-700/40 bg-tanah-100 text-clay-800"
                              : "border-bersih-200 text-tinta-500",
                          ].join(" ")}
                        >
                          <IkonBintang className={m.rekomendasi ? "size-4" : "size-4 opacity-60"} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSunting(m)}
                          disabled={!bisaUbah}
                          className="h-8 rounded-[0.5rem] border border-bersih-200 px-2.5 text-[0.6875rem] font-bold text-tinta-700 disabled:opacity-40"
                        >
                          Ubah
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "biaya" && (
        <div className="max-w-xl p-4 sm:p-6">
          <p className="mb-3 text-[0.8125rem] leading-relaxed text-tinta-500">
            Nilai ini dipakai menghitung setiap tagihan. Rumusnya: biaya layanan dari subtotal,
            lalu pajak dari (subtotal + layanan), lalu total dibulatkan sekali per tagihan.
            Persentase pajak bawaan 11%.
          </p>

          <dl className="space-y-2 rounded-[0.875rem] shadow-[0_1px_2px_rgba(22,19,15,0.04),0_6px_16px_-10px_rgba(22,19,15,0.16)] bg-bersih-0 p-4 text-[0.9375rem]">
            <div className="flex justify-between">
              <dt className="text-tinta-500">Pajak</dt>
              <dd className="font-bold tabular-nums text-tinta-900">{aturan.pajakPersen}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-500">Biaya layanan</dt>
              <dd className="font-bold tabular-nums text-tinta-900">
                {aturan.layananPersen > 0 ? `${aturan.layananPersen}%` : rupiah(aturan.layananRp)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-500">Pembulatan</dt>
              <dd className="font-bold tabular-nums text-tinta-900">
                ke {rupiah(aturan.pembulatan)} terdekat
              </dd>
            </div>
          </dl>

          <div className="mt-3 rounded-[0.875rem] shadow-[0_1px_2px_rgba(22,19,15,0.04),0_6px_16px_-10px_rgba(22,19,15,0.16)] bg-bersih-0 p-4">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
              Contoh pada subtotal Rp100.000
            </p>
            <ContohBiaya aturan={aturan} />
          </div>

          <p className="mt-3 text-[0.6875rem] leading-relaxed text-tinta-500">
            Untuk mengubah nilai ini, ubah tabel <code className="font-mono">pengaturan</code> di
            database atau hubungi pengembang. Halaman ini sengaja menampilkan nilainya agar kasir
            dan pemilik memakai angka yang sama.
          </p>
        </div>
      )}

      {sunting && (
        <DialogMenu
          menu={sunting}
          kategori={awal.kategori}
          onTutup={() => setSunting(null)}
          onSimpan={async (patch) => {
            const ok = await ubahMenu(sunting, patch);
            if (ok) setSunting(null);
          }}
          sibuk={sibuk}
        />
      )}

      {baru && (
        <DialogMenu
          kategori={awal.kategori}
          onTutup={() => setBaru(false)}
          onSimpan={async (patch) => {
            await simpanBaru({
              nama: patch.nama ?? "",
              deskripsi: patch.deskripsi ?? "",
              harga: patch.harga ?? 0,
              kategori_id: patch.kategori_id ?? null,
              pilihan: patch.pilihan ?? [],
              rekomendasi: patch.rekomendasi === true,
            });
          }}
          sibuk={sibuk}
        />
      )}

      {tersimpan && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-tinta-900 px-4 py-2 text-[0.8125rem] font-bold text-bersih-0 shadow-lg"
        >
          {tersimpan}
        </div>
      )}
    </div>
  );
}

function ContohBiaya({ aturan }: { aturan: AturanBiaya }) {
  const subtotal = 100000;
  const layanan =
    aturan.layananPersen > 0
      ? Math.round((subtotal * aturan.layananPersen) / 100)
      : aturan.layananRp;
  const pajak = Math.round(((subtotal + layanan) * aturan.pajakPersen) / 100);
  const mentah = subtotal + layanan + pajak;
  const total = Math.round(mentah / (aturan.pembulatan || 1)) * (aturan.pembulatan || 1);

  return (
    <dl className="mt-2 space-y-1 text-[0.8125rem]">
      <div className="flex justify-between">
        <dt className="text-tinta-500">Subtotal</dt>
        <dd className="tabular-nums text-tinta-900">{rupiah(subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-tinta-500">Biaya layanan</dt>
        <dd className="tabular-nums text-tinta-900">{rupiah(layanan)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-tinta-500">Pajak</dt>
        <dd className="tabular-nums text-tinta-900">{rupiah(pajak)}</dd>
      </div>
      <div className="flex justify-between border-t border-bersih-200 pt-1">
        <dt className="font-bold text-tinta-900">Total</dt>
        <dd className="font-extrabold tabular-nums text-tinta-900">{rupiah(total)}</dd>
      </div>
    </dl>
  );
}

function DialogMenu({
  menu,
  kategori,
  onTutup,
  onSimpan,
  sibuk,
}: {
  menu?: Menu;
  kategori: KategoriMenu[];
  onTutup: () => void;
  onSimpan: (patch: Partial<Menu>) => void;
  sibuk: boolean;
}) {
  const [nama, setNama] = useState(menu?.nama ?? "");
  const [deskripsi, setDeskripsi] = useState(menu?.deskripsi ?? "");
  const [harga, setHarga] = useState(String(menu?.harga ?? ""));
  const [kategoriId, setKategoriId] = useState<string>(
    menu?.kategori_id ? String(menu.kategori_id) : String(kategori[0]?.id ?? "")
  );

  /**
   * Pilihan disimpan sebagai teks di state, bukan angka.
   *
   * Alasannya bukan kemalasan: kalau `tambah` disimpan sebagai number dan
   * langsung dirapikan ke rupiah, admin yang mengetik "50000" akan melihat
   * angkanya melompat jadi "50.000" di tengah pengetikan dan kursor pindah
   * ke ujung. Teks mentah dipertahankan sampai disimpan; yang dirapikan
   * hanya saat dihitung.
   */
  const [pilihan, setPilihan] = useState<{ nama: string; tambah: string }[]>(
    () => (menu?.pilihan ?? []).map((p) => ({ nama: p.nama, tambah: p.tambah ? String(p.tambah) : "" }))
  );
  const [rekomendasi, setRekomendasi] = useState(menu?.rekomendasi === true);

  const angka = Number(harga.replace(/\D/g, "")) || 0;
  // Baris pilihan yang namanya kosong diabaikan, bukan membuat seluruh
  // penyimpanan gagal: admin sering menekan "+ Tambah pilihan" lalu berubah
  // pikiran dan langsung menyimpan.
  const pilihanBersih = pilihan
    .map((p) => ({ nama: p.nama.trim(), tambah: Math.max(0, Math.round(Number(p.tambah.replace(/\D/g, "")) || 0)) }))
    .filter((p) => p.nama.length > 0);
  const namaPilihanGanda = pilihanBersih.some(
    (p, i) => pilihanBersih.findIndex((q) => q.nama.toLowerCase() === p.nama.toLowerCase()) !== i
  );
  const sah = nama.trim().length > 0 && angka > 0 && !namaPilihanGanda;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta-900/50 p-4">
      <div className="w-full max-w-md rounded-[0.875rem] bg-bersih-0 p-4 shadow-2xl">
        <h3 className="text-[1.0625rem] font-extrabold text-tinta-900">
          {menu ? "Ubah menu" : "Menu baru"}
        </h3>

        <label className="mt-3 block text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
          Nama
        </label>
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          maxLength={80}
          className="mt-1 h-11 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-100 px-3 text-[0.9375rem] text-tinta-900 outline-none focus:border-forest-700"
        />

        <label className="mt-2.5 block text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
          Deskripsi satu baris
        </label>
        <input
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          maxLength={240}
          className="mt-1 h-11 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-100 px-3 text-[0.9375rem] text-tinta-900 outline-none focus:border-forest-700"
        />

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
              Harga
            </label>
            <input
              value={harga}
              onChange={(e) => setHarga(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="mt-1 h-11 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-100 px-3 text-[0.9375rem] font-bold tabular-nums text-tinta-900 outline-none focus:border-forest-700"
            />
            <p className="mt-0.5 text-[0.6875rem] text-tinta-500">{rupiah(angka)}</p>
          </div>
          <div>
            <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
              Kategori
            </label>
            <select
              value={kategoriId}
              onChange={(e) => setKategoriId(e.target.value)}
              className="mt-1 h-11 w-full rounded-[0.625rem] border border-bersih-200 bg-bersih-100 px-2 text-[0.9375rem] text-tinta-900 outline-none focus:border-forest-700"
            >
              {kategori.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Pilihan / add-on ─────────────────────────────────────────
            Satu pilihan per item (keputusan pemilik). Kalau daftar kosong,
            pelanggan tidak ditanya apa pun; kalau berisi, pelanggan WAJIB
            memilih satu — jadi menambah opsi berarti menambah satu langkah
            pemesanan. Kalimat penjelas di bawah ini menyatakan akibat itu
            terang-terangan supaya tidak ada yang mengira ini "opsional". */}
        <div className="mt-3 rounded-[0.625rem] bg-bersih-50 p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
              Pilihan / add-on
            </p>
            <span className="text-[0.6875rem] tabular-nums text-tinta-500">
              {pilihanBersih.length}/{12}
            </span>
          </div>

          {pilihan.length === 0 ? (
            <p className="mt-1 text-[0.8125rem] leading-snug text-tinta-500">
              Tanpa pilihan. Pelanggan langsung memasukkan menu ini ke keranjang.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {pilihan.map((p, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <input
                    value={p.nama}
                    onChange={(e) =>
                      setPilihan((d) => d.map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)))
                    }
                    maxLength={80}
                    placeholder="Nama pilihan"
                    aria-label={`Nama pilihan ${i + 1}`}
                    className="h-10 min-w-0 flex-1 rounded-[0.5rem] border border-bersih-200 bg-bersih-0 px-2.5 text-[0.9375rem] text-tinta-900 outline-none placeholder:text-tinta-500 focus:border-tinta-700"
                  />
                  <div className="relative w-[6.5rem] shrink-0">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[0.6875rem] text-tinta-500">
                      +Rp
                    </span>
                    <input
                      value={p.tambah}
                      onChange={(e) =>
                        setPilihan((d) =>
                          d.map((x, j) =>
                            j === i ? { ...x, tambah: e.target.value.replace(/\D/g, "") } : x
                          )
                        )
                      }
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`Tambahan harga pilihan ${i + 1}`}
                      className="h-10 w-full rounded-[0.5rem] border border-bersih-200 bg-bersih-0 pl-8 pr-2 text-right text-[0.9375rem] font-bold tabular-nums text-tinta-900 outline-none placeholder:text-tinta-500 focus:border-tinta-700"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPilihan((d) => d.filter((_, j) => j !== i))}
                    aria-label={`Hapus pilihan ${p.nama || i + 1}`}
                    className="grid size-10 shrink-0 place-items-center rounded-[0.5rem] text-tinta-500 transition active:bg-tanah-100 active:text-clay-800"
                  >
                    <IkonHapus className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {namaPilihanGanda && (
            <p className="mt-1.5 text-[0.75rem] font-semibold text-clay-800">
              Ada nama pilihan yang sama. Samakan ejaannya atau hapus salah satu.
            </p>
          )}

          <button
            type="button"
            onClick={() =>
              setPilihan((d) => (d.length >= 12 ? d : [...d, { nama: "", tambah: "" }]))
            }
            disabled={pilihan.length >= 12}
            className="mt-2 flex h-9 items-center gap-1 rounded-[0.5rem] border border-dashed border-bersih-300 px-2.5 text-[0.8125rem] font-bold text-tinta-700 disabled:opacity-40"
          >
            <IkonTambah className="size-3.5" />
            Tambah pilihan
          </button>

          <p className="mt-1.5 text-[0.75rem] leading-snug text-tinta-500">
            {pilihanBersih.length > 0
              ? "Pelanggan wajib memilih satu. Tambahan harga ditambahkan ke harga satuan saat dipesan."
              : "Isi minimal satu pilihan agar pelanggan ditanya saus/sambal/rasa."}
          </p>
        </div>

        {/* Rekomendasi juga bisa diatur dari dialog, supaya admin yang sudah
            membuka satu menu tidak perlu menutupnya untuk menandai bintang. */}
        <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-[0.625rem] bg-bersih-50 p-2.5">
          <input
            type="checkbox"
            checked={rekomendasi}
            onChange={(e) => setRekomendasi(e.target.checked)}
            className="size-4 accent-[var(--color-aksi-500)]"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.8125rem] font-bold text-tinta-900">
              Tampilkan sebagai rekomendasi
            </span>
            <span className="block text-[0.75rem] leading-snug text-tinta-500">
              Muncul paling atas di kategorinya dengan lencana bintang.
            </span>
          </span>
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onTutup}
            className="h-11 flex-1 rounded-[0.625rem] border border-bersih-200 text-[0.9375rem] font-bold text-tinta-700"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!sah || sibuk}
            onClick={() =>
              onSimpan({
                nama: nama.trim(),
                deskripsi: deskripsi.trim(),
                harga: angka,
                kategori_id: kategoriId ? Number(kategoriId) : null,
                // Selalu dikirim, termasuk array kosong: itulah caranya
                // menghapus semua pilihan dari sebuah menu.
                pilihan: pilihanBersih,
                rekomendasi,
              })
            }
            className="h-11 flex-1 rounded-[0.625rem] bg-tinta-900 text-[0.9375rem] font-bold text-bersih-0 disabled:opacity-40"
          >
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Chip saringan.
 *
 * Kenapa tombol biasa, bukan <select>: di tablet kasir/admin, memilih
 * kategori lewat dropdown berarti buka-tutup panel sistem, dan pilihannya
 * tersembunyi sampai dibuka. Chip menampilkan semua pilihan sekaligus —
 * untuk enam kategori itu masih masuk akal, dan angkanya terlihat langsung.
 *
 * `aria-pressed` dipakai supaya pembaca layar mengumumkan keadaan terpilih,
 * bukan hanya "tombol". Warna saja tidak cukup.
 */
function ChipSaring({
  aktif,
  onClick,
  children,
  kecil = false,
}: {
  aktif: boolean;
  onClick: () => void;
  children: React.ReactNode;
  kecil?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      className={[
        "flex shrink-0 items-center gap-1 rounded-full font-bold transition",
        kecil ? "h-8 px-2.5 text-[0.6875rem]" : "h-9 px-3 text-[0.8125rem]",
        aktif
          ? "bg-tinta-900 text-bersih-0"
          : "bg-bersih-100 text-tinta-700 active:bg-bersih-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
