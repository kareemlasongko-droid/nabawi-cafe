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

import { useState } from "react";
import { rupiah } from "@/app/lib/order/tipe";
import { BilahStaf } from "./Kerangka";
import type { KategoriMenu, Menu } from "@/app/lib/order/tipe";
import type { AturanBiaya } from "@/app/lib/order/aturan";
import { IkonCentang, IkonSilang, IkonTambah } from "./Ikon";

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

  const namaKategori = new Map(awal.kategori.map((k) => [k.id, k.nama]));

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
    <div className="min-h-dvh bg-cream-200">
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
                "h-10 rounded-lg px-3 text-[0.75rem] font-bold",
                tab === "menu" ? "bg-ink-900 text-cream-50" : "border border-ink-900/15 text-ink-700",
              ].join(" ")}
            >
              Menu
            </button>
            <button
              type="button"
              onClick={() => setTab("biaya")}
              className={[
                "h-10 rounded-lg px-3 text-[0.75rem] font-bold",
                tab === "biaya" ? "bg-ink-900 text-cream-50" : "border border-ink-900/15 text-ink-700",
              ].join(" ")}
            >
              Pajak &amp; layanan
            </button>
          </div>
        }
      />

      {!bisaUbah && (
        <div className="border-b border-clay-600/20 bg-clay-600/8 px-4 py-2 sm:px-6">
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
        <div className="border-b border-clay-600/25 bg-clay-600/10 px-4 py-2 sm:px-6">
          <p className="text-[0.75rem] font-semibold text-clay-800">{galat}</p>
        </div>
      )}

      {tab === "menu" && (
        <div className="p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[0.6875rem] leading-snug text-ink-500">
              Harga yang diubah di sini tidak mengubah tagihan yang sudah terbuka — tagihan
              memakai harga saat dipesan.
            </p>
            <button
              type="button"
              onClick={() => setBaru(true)}
              disabled={!bisaUbah}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-forest-900 px-3 text-[0.75rem] font-bold text-cream-50 disabled:opacity-40"
            >
              <IkonTambah className="size-4" />
              Menu baru
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-ink-900/12 bg-cream-50">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-ink-900/10 bg-cream-100 text-[0.625rem] font-bold uppercase tracking-wider text-ink-500">
                  <th className="px-3 py-2">Menu</th>
                  <th className="hidden px-3 py-2 sm:table-cell">Kategori</th>
                  <th className="px-3 py-2 text-right">Harga</th>
                  <th className="px-3 py-2 text-center">Tersedia</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/8">
                {menu.map((m) => (
                  <tr key={m.id} className={m.tersedia ? "" : "bg-cream-100/60"}>
                    <td className="px-3 py-2">
                      <p
                        className={[
                          "text-[0.8125rem] font-bold leading-tight",
                          m.tersedia ? "text-ink-900" : "text-ink-500 line-through",
                        ].join(" ")}
                      >
                        {m.nama}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[0.6875rem] text-ink-500">
                        {m.deskripsi}
                      </p>
                    </td>
                    <td className="hidden px-3 py-2 text-[0.75rem] text-ink-500 sm:table-cell">
                      {m.kategori_id ? (namaKategori.get(m.kategori_id) ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-[0.8125rem] font-bold tabular-nums text-ink-900">
                      {rupiah(m.harga)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => ubahMenu(m, { tersedia: !m.tersedia })}
                        disabled={!bisaUbah || sibuk}
                        aria-pressed={m.tersedia}
                        className={[
                          "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[0.625rem] font-bold transition disabled:opacity-50",
                          m.tersedia
                            ? "bg-mint-600/18 text-mint-700"
                            : "bg-clay-600/15 text-clay-800",
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
                      <button
                        type="button"
                        onClick={() => setSunting(m)}
                        disabled={!bisaUbah}
                        className="h-8 rounded-md border border-ink-900/15 px-2.5 text-[0.6875rem] font-bold text-ink-700 disabled:opacity-40"
                      >
                        Ubah
                      </button>
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
          <p className="mb-3 text-[0.75rem] leading-relaxed text-ink-500">
            Nilai ini dipakai menghitung setiap tagihan. Rumusnya: biaya layanan dari subtotal,
            lalu pajak dari (subtotal + layanan), lalu total dibulatkan sekali per tagihan.
            Persentase pajak bawaan 11%.
          </p>

          <dl className="space-y-2 rounded-xl border border-ink-900/12 bg-cream-50 p-4 text-[0.8125rem]">
            <div className="flex justify-between">
              <dt className="text-ink-500">Pajak</dt>
              <dd className="font-bold tabular-nums text-ink-900">{aturan.pajakPersen}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Biaya layanan</dt>
              <dd className="font-bold tabular-nums text-ink-900">
                {aturan.layananPersen > 0 ? `${aturan.layananPersen}%` : rupiah(aturan.layananRp)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Pembulatan</dt>
              <dd className="font-bold tabular-nums text-ink-900">
                ke {rupiah(aturan.pembulatan)} terdekat
              </dd>
            </div>
          </dl>

          <div className="mt-3 rounded-xl border border-ink-900/12 bg-cream-50 p-4">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-500">
              Contoh pada subtotal Rp100.000
            </p>
            <ContohBiaya aturan={aturan} />
          </div>

          <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-500">
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
            });
          }}
          sibuk={sibuk}
        />
      )}

      {tersimpan && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900 px-4 py-2 text-[0.75rem] font-bold text-cream-50 shadow-lg"
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
    <dl className="mt-2 space-y-1 text-[0.75rem]">
      <div className="flex justify-between">
        <dt className="text-ink-500">Subtotal</dt>
        <dd className="tabular-nums text-ink-900">{rupiah(subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-ink-500">Biaya layanan</dt>
        <dd className="tabular-nums text-ink-900">{rupiah(layanan)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-ink-500">Pajak</dt>
        <dd className="tabular-nums text-ink-900">{rupiah(pajak)}</dd>
      </div>
      <div className="flex justify-between border-t border-ink-900/10 pt-1">
        <dt className="font-bold text-ink-900">Total</dt>
        <dd className="font-extrabold tabular-nums text-ink-900">{rupiah(total)}</dd>
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

  const angka = Number(harga.replace(/\D/g, "")) || 0;
  const sah = nama.trim().length > 0 && angka > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-cream-50 p-4 shadow-2xl">
        <h3 className="text-[1rem] font-extrabold text-ink-900">
          {menu ? "Ubah menu" : "Menu baru"}
        </h3>

        <label className="mt-3 block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-500">
          Nama
        </label>
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          maxLength={80}
          className="mt-1 h-11 w-full rounded-lg border border-ink-900/15 bg-cream-100 px-3 text-[0.8125rem] text-ink-900 outline-none focus:border-forest-700"
        />

        <label className="mt-2.5 block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-500">
          Deskripsi satu baris
        </label>
        <input
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          maxLength={240}
          className="mt-1 h-11 w-full rounded-lg border border-ink-900/15 bg-cream-100 px-3 text-[0.8125rem] text-ink-900 outline-none focus:border-forest-700"
        />

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-500">
              Harga
            </label>
            <input
              value={harga}
              onChange={(e) => setHarga(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="mt-1 h-11 w-full rounded-lg border border-ink-900/15 bg-cream-100 px-3 text-[0.8125rem] font-bold tabular-nums text-ink-900 outline-none focus:border-forest-700"
            />
            <p className="mt-0.5 text-[0.625rem] text-ink-500">{rupiah(angka)}</p>
          </div>
          <div>
            <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-500">
              Kategori
            </label>
            <select
              value={kategoriId}
              onChange={(e) => setKategoriId(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-ink-900/15 bg-cream-100 px-2 text-[0.8125rem] text-ink-900 outline-none focus:border-forest-700"
            >
              {kategori.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onTutup}
            className="h-11 flex-1 rounded-lg border border-ink-900/15 text-[0.8125rem] font-bold text-ink-700"
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
              })
            }
            className="h-11 flex-1 rounded-lg bg-forest-900 text-[0.8125rem] font-bold text-cream-50 disabled:opacity-40"
          >
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
