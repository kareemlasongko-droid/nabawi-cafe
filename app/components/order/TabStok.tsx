"use client";

/**
 * Tab "Stok & HPP" di portal admin.
 *
 * ── HIRARKI, BUKAN SATU HALAMAN PANJANG ──────────────────────────────
 *
 * Empat pekerjaan berbeda, dan mencampurnya dalam satu gulungan membuat
 * semuanya setengah terbaca:
 *
 *   Bahan    → apa yang ada di gudang, dan mana yang perlu dipesan
 *   Resep    → apa yang dipakai satu porsi menu (menentukan HPP)
 *   Catat    → pembelian dari supplier, opname, bahan dibuang
 *   HPP      → laba kotor per menu dan per hari
 *
 * Urutannya mengikuti cara kerja, bukan abjad: bahan harus ada sebelum
 * resep bisa menyebutnya, dan HPP baru bermakna setelah keduanya terisi.
 *
 * ── SATU HAL YANG SENGAJA TIDAK ADA DI SINI ──────────────────────────
 *
 * Tidak ada tombol "ubah harga bahan". Harga berubah hanya lewat
 * pembelian, karena hanya pembelian yang menyimpan alasan perubahan.
 * Menyediakan input harga langsung akan membuat HPP lama berbeda dari
 * harga sekarang tanpa dokumen yang menjelaskan sebabnya.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { rupiah } from "@/app/lib/order/tipe";

// ── Tipe respons API (bentuk persis yang dikirim /api/order/stok) ──────
type Bahan = {
  id: number;
  nama: string;
  satuan: string;
  harga_satuan: number;
  stok_minimum: number;
  aktif: boolean;
  catatan: string;
  stok: number;
  status: "belum_dicatat" | "habis" | "kritis" | "cukup";
  nilai: number;
};

type Resep = {
  baris: {
    bahan_id: number;
    nama: string;
    satuan: string;
    jumlah: number;
    harga_satuan: number;
    biaya: number;
    perkiraan: boolean;
  }[];
  hpp: number;
  lengkap: boolean;
  perkiraan: boolean;
};

type HppMenu = {
  menu_id: number;
  nama: string;
  harga: number;
  hpp: number;
  laba: number;
  persen: number | null;
  lengkap: boolean;
  perkiraan: boolean;
  jumlah_bahan: number;
};

type HppHari = {
  tanggal: string;
  omzet: number;
  hpp: number;
  laba: number;
  persen: number | null;
  hppTidakLengkap: number;
};

type Gerakan = {
  id: number;
  bahan: string;
  satuan: string;
  jenis: string;
  jumlah: number;
  nilai: number;
  catatan: string;
  oleh: string;
  dibuat_at: string;
};

type Bagian = "bahan" | "resep" | "catat" | "hpp";

const LABEL_JENIS: Record<string, string> = {
  beli: "Beli",
  pakai: "Terpakai",
  opname: "Opname",
  awal: "Stok awal",
  buang: "Dibuang",
};

export function TabStok() {
  const [bagian, setBagian] = useState<Bagian>("bahan");

  return (
    <div className="grid gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["bahan", "Bahan"],
            ["resep", "Resep"],
            ["catat", "Catat"],
            ["hpp", "HPP"],
          ] as [Bagian, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setBagian(k)}
            aria-pressed={bagian === k}
            className={[
              "h-9 rounded-[0.625rem] px-3 text-[0.8125rem] font-bold",
              bagian === k
                ? "bg-forest-900 text-cream-50"
                : "border border-bersih-200 text-tinta-700",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {bagian === "bahan" && <BagianBahan />}
      {bagian === "resep" && <BagianResep />}
      {bagian === "catat" && <BagianCatat />}
      {bagian === "hpp" && <BagianHpp />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bahan
// ─────────────────────────────────────────────────────────────────────

function BagianBahan() {
  const [bahan, setBahan] = useState<Bahan[] | null>(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [formBuka, setFormBuka] = useState(false);

  const muat = useCallback(async () => {
    setPesan("");
    try {
      const r = await fetch("/api/order/stok?lihat=bahan", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        setPesan(j.pesan ?? "Daftar bahan gagal dibaca.");
        return;
      }
      setBahan(j.bahan ?? []);
    } catch {
      setPesan("Koneksi terputus. Daftar bahan belum diperbarui.");
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const perlu = useMemo(() => (bahan ?? []).filter((b) => b.status !== "cukup"), [bahan]);
  /*
    "Belum dicatat" ≠ "perlu dipesan". Bahan yang belum pernah punya gerakan
    stok memang harus diisi, tetapi mencampurnya dengan yang benar-benar
    kritis membuat peringatan merah berisi 100 baris pada hari pertama —
    dan peringatan yang selalu menyala berhenti dibaca.
  */
  const belumDicatat = useMemo(
    () => perlu.filter((b) => b.status === "belum_dicatat"),
    [perlu],
  );
  const perluNyata = useMemo(
    () => perlu.filter((b) => b.status !== "belum_dicatat"),
    [perlu],
  );
  const nilaiTotal = useMemo(() => (bahan ?? []).reduce((n, b) => n + b.nilai, 0), [bahan]);

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[0.8125rem] text-tinta-500">
          {bahan ? `${bahan.length} bahan · nilai stok ${rupiah(nilaiTotal)}` : "Memuat…"}
        </p>
        <button
          type="button"
          onClick={() => setFormBuka((b) => !b)}
          className="tombol-utama h-9 px-3 text-[0.8125rem]"
        >
          {formBuka ? "Tutup" : "+ Bahan"}
        </button>
      </div>

      {pesan && <KotakPesan pesan={pesan} />}

      {formBuka && (
        <FormBahan
          onSelesai={() => {
            setFormBuka(false);
            muat();
          }}
          onPesan={setPesan}
        />
      )}

      {/*
        Peringatan "perlu dipesan" ditaruh di ATAS daftar, bukan di tab
        terpisah. Kalau harus diklik dulu, kasir baru tahu bahan habis
        setelah membuka tab yang tidak pernah ia buka.
      */}
      {perluNyata.length > 0 && (
        <div className="rounded-[0.625rem] border border-sela-200 bg-sela-50 px-3 py-2">
          <p className="text-[0.75rem] font-extrabold text-sela-800">
            Perlu dipesan ({perluNyata.length})
          </p>
          <p className="mt-0.5 text-[0.75rem] leading-snug text-sela-800">
            {perluNyata.map((b) => `${b.nama} (${fmt(b.stok)} ${b.satuan})`).join(" · ")}
          </p>
        </div>
      )}

      {belumDicatat.length > 0 && (
        <div className="rounded-[0.625rem] border border-bersih-200 bg-bersih-50 px-3 py-2">
          <p className="text-[0.75rem] font-extrabold text-tinta-700">
            Stok belum dicatat ({belumDicatat.length})
          </p>
          <p className="mt-0.5 text-[0.75rem] leading-snug text-tinta-500">
            Belum ada pembelian atau opname untuk bahan ini, jadi saldonya belum diketahui —
            bukan berarti habis. Catat lewat pembelian supplier atau opname.
          </p>
        </div>
      )}

      {bahan && bahan.length === 0 && (
        <KotakKosong
          judul="Belum ada bahan"
          isi="Tambahkan bahan baku dulu (cabai, beras, ayam…). Tanpa bahan, resep dan HPP belum bisa dihitung."
        />
      )}

      {bahan && bahan.length > 0 && (
        <ul className="divide-y divide-bersih-200 overflow-hidden rounded-[0.875rem] border border-bersih-200 bg-bersih-0">
          {bahan.map((b) => (
            <li key={b.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-[0.8125rem] font-bold text-tinta-900">{b.nama}</p>
                  <span
                    className={[
                      "shrink-0 rounded px-1 py-px text-[0.5625rem] font-extrabold uppercase",
                      b.status === "habis"
                        ? "bg-sela-700 text-white"
                        : b.status === "kritis"
                          ? "bg-sela-50 text-sela-800"
                          : b.status === "belum_dicatat"
                            ? "bg-bersih-200 text-tinta-700"
                            : "bg-daun-100 text-forest-700",
                    ].join(" ")}
                  >
                    {b.status === "belum_dicatat" ? "belum dicatat" : b.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[0.6875rem] text-tinta-500">
                  {fmt(b.stok)} {b.satuan} · {rupiah(b.harga_satuan)}/{b.satuan} · min{" "}
                  {fmt(b.stok_minimum)}
                </p>
              </div>
              <OpnameKecil bahan={b} onSelesai={muat} onSibuk={setSibuk} sibuk={sibuk} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormBahan({
  onSelesai,
  onPesan,
}: {
  onSelesai: () => void;
  onPesan: (p: string) => void;
}) {
  const [nama, setNama] = useState("");
  const [satuan, setSatuan] = useState("gram");
  const [harga, setHarga] = useState("");
  const [minimum, setMinimum] = useState("");
  const [awal, setAwal] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const simpan = async () => {
    if (sibuk) return;
    if (!nama.trim()) {
      onPesan("Nama bahan wajib diisi.");
      return;
    }
    setSibuk(true);
    try {
      const r = await fetch("/api/order/stok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "bahan",
          nama,
          satuan,
          harga_satuan: Number(harga) || 0,
          stok_minimum: Number(minimum) || 0,
          stok_awal: Number(awal) || 0,
          oleh: "admin",
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        onPesan(j.pesan ?? "Bahan gagal disimpan.");
        return;
      }
      onSelesai();
    } catch {
      onPesan("Koneksi terputus. Bahan belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Isian label="Nama bahan" nilai={nama} ubah={setNama} tempat="Cabai merah" lebar />
        <Isian label="Satuan" nilai={satuan} ubah={setSatuan} tempat="gram / ml / pcs" />
        <Isian label="Harga / satuan" nilai={harga} ubah={setHarga} tempat="120" angka />
        <Isian label="Stok minimum" nilai={minimum} ubah={setMinimum} tempat="500" angka />
        <Isian label="Stok awal" nilai={awal} ubah={setAwal} tempat="1000" angka />
      </div>
      <p className="mt-2 text-[0.625rem] leading-snug text-tinta-500">
        Harga per <strong>satu satuan</strong> (per gram, bukan per kilo). Harga ini hanya titik
        awal — setelah itu harga berubah sendiri mengikuti rata-rata pembelian.
      </p>
      <button
        type="button"
        onClick={simpan}
        disabled={sibuk}
        className="tombol-utama mt-2 h-10 w-full text-[0.8125rem] disabled:opacity-50"
      >
        {sibuk ? "Menyimpan…" : "Simpan bahan"}
      </button>
    </div>
  );
}

/** Opname cepat: ketik jumlah fisik, sistem menghitung selisihnya. */
function OpnameKecil({
  bahan,
  onSelesai,
  onSibuk,
  sibuk,
}: {
  bahan: Bahan;
  onSelesai: () => void;
  onSibuk: (b: boolean) => void;
  sibuk: boolean;
}) {
  const [buka, setBuka] = useState(false);
  const [fisik, setFisik] = useState("");
  const [pesan, setPesan] = useState("");

  const kirim = async () => {
    if (sibuk) return;
    onSibuk(true);
    setPesan("");
    try {
      const r = await fetch("/api/order/stok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "opname",
          bahan_id: bahan.id,
          fisik: Number(fisik),
          oleh: "admin",
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setPesan(j.pesan ?? "Opname gagal disimpan.");
        return;
      }
      setPesan(
        j.data.selisih === 0
          ? "Cocok — tidak ada selisih."
          : `Selisih ${j.data.selisih > 0 ? "+" : ""}${fmt(j.data.selisih)} ${bahan.satuan}`,
      );
      setFisik("");
      onSelesai();
    } catch {
      setPesan("Koneksi terputus.");
    } finally {
      onSibuk(false);
    }
  };

  if (!buka) {
    return (
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="h-8 shrink-0 rounded-[0.5rem] border border-bersih-200 px-2 text-[0.6875rem] font-bold text-tinta-700"
      >
        Opname
      </button>
    );
  }

  return (
    <div className="w-40 shrink-0">
      <div className="flex gap-1">
        <input
          value={fisik}
          onChange={(e) => setFisik(e.target.value)}
          inputMode="decimal"
          placeholder={`fisik (${bahan.satuan})`}
          className="h-8 w-full min-w-0 rounded-[0.5rem] border border-bersih-200 px-2 text-[0.75rem] outline-none"
        />
        <button
          type="button"
          onClick={kirim}
          disabled={sibuk || fisik === ""}
          className="h-8 shrink-0 rounded-[0.5rem] bg-forest-900 px-2 text-[0.6875rem] font-bold text-cream-50 transition hover:bg-forest-800 disabled:opacity-40"
        >
          OK
        </button>
      </div>
      {pesan && <p className="mt-1 text-[0.625rem] leading-snug text-tinta-500">{pesan}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Resep
// ─────────────────────────────────────────────────────────────────────

function BagianResep() {
  const [menu, setMenu] = useState<{ id: number; nama: string; harga: number; hpp: number }[] | null>(
    null,
  );
  const [bahan, setBahan] = useState<Bahan[]>([]);
  const [cari, setCari] = useState("");
  const [dipilih, setDipilih] = useState<number | null>(null);
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    try {
      const [mRes, bRes] = await Promise.all([
        fetch("/api/order/stok?lihat=menu", { cache: "no-store" }),
        fetch("/api/order/stok?lihat=bahan", { cache: "no-store" }),
      ]);
      const m = await mRes.json();
      const b = await bRes.json();
      if (!mRes.ok) {
        setPesan(m.pesan ?? "Daftar menu gagal dibaca.");
        return;
      }
      setMenu(m.menu ?? []);
      setBahan(b.bahan ?? []);
    } catch {
      setPesan("Koneksi terputus.");
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const arr = menu ?? [];
    if (!q) return arr;
    return arr.filter((m) => m.nama.toLowerCase().includes(q));
  }, [menu, cari]);

  const terpilih = menu?.find((m) => m.id === dipilih);

  return (
    <div className="grid gap-3">
      {pesan && <KotakPesan pesan={pesan} />}

      {/*
        Tanpa bahan sama sekali, tab ini tidak bisa dipakai. Dikatakan
        terang-terangan, bukan dibiarkan menampilkan layar kosong yang
        membuat admin mengira fiturnya rusak.
      */}
      {bahan.length === 0 && !pesan && (
        <KotakKosong
          judul="Belum ada bahan"
          isi="Isi tab Bahan dulu. Resep menghubungkan menu ke bahan baku."
        />
      )}

      {bahan.length > 0 && (
        <>
          <label className="flex h-10 items-center gap-2 rounded-[0.625rem] border border-bersih-200 bg-bersih-0 px-3">
            <span className="sr-only">Cari menu</span>
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari menu…"
              className="w-full bg-transparent text-[0.8125rem] outline-none"
            />
          </label>

          <ul className="max-h-64 divide-y divide-bersih-200 overflow-auto rounded-[0.875rem] border border-bersih-200 bg-bersih-0">
            {tersaring.slice(0, 60).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setDipilih(m.id)}
                  className={[
                    "flex w-full items-center gap-2 px-3 py-2 text-left",
                    dipilih === m.id ? "bg-daun-100" : "",
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-tinta-900">
                    {m.nama}
                  </span>
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-tinta-500">
                    {m.hpp > 0 ? `HPP ${rupiah(m.hpp)}` : "belum ada resep"}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {terpilih && <EditorResep menu={terpilih} bahan={bahan} onSelesai={muat} />}
        </>
      )}
    </div>
  );
}

function EditorResep({
  menu,
  bahan,
  onSelesai,
}: {
  menu: { id: number; nama: string; harga: number; hpp: number };
  bahan: Bahan[];
  onSelesai: () => void;
}) {
  const [resep, setResep] = useState<Resep | null>(null);
  const [baris, setBaris] = useState<{ bahan_id: number; jumlah: string }[]>([]);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    setPesan("");
    try {
      const r = await fetch(`/api/order/stok?lihat=resep&menu_id=${menu.id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        setPesan(j.pesan ?? "Resep gagal dibaca.");
        return;
      }
      setResep(j);
      setBaris(j.baris.map((b: { bahan_id: number; jumlah: number }) => ({ bahan_id: b.bahan_id, jumlah: String(b.jumlah) })));
    } catch {
      setPesan("Koneksi terputus.");
    }
  }, [menu.id]);

  useEffect(() => {
    muat();
  }, [muat]);

  /*
    HPP dihitung LANGSUNG saat mengetik, memakai harga bahan yang sudah
    dimuat. Itu yang membuat layar ini berguna: admin bisa mengubah takaran
    dan melihat akibatnya pada margin sebelum menyimpan.
  */
  const hppDraf = useMemo(() => {
    let total = 0;
    let adaKosong = false;
    for (const b of baris) {
      const bh = bahan.find((x) => x.id === b.bahan_id);
      const jml = Number(b.jumlah);
      if (!bh || !Number.isFinite(jml) || jml <= 0) continue;
      if (bh.harga_satuan <= 0) adaKosong = true;
      total += Math.round(jml * bh.harga_satuan);
    }
    return { total, adaKosong };
  }, [baris, bahan]);

  const simpan = async () => {
    if (sibuk) return;
    setSibuk(true);
    setPesan("");
    try {
      const r = await fetch("/api/order/stok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "resep",
          menu_id: menu.id,
          // `perkiraan: false` — resep yang diketik manusia di layar ini
          // dianggap sudah diverifikasi. Hanya resep yang diisi sistem
          // (seed) yang ditandai perkiraan.
          baris: baris
            .filter((b) => Number(b.jumlah) > 0)
            .map((b) => ({ bahan_id: b.bahan_id, jumlah: Number(b.jumlah), perkiraan: false })),
          oleh: "admin",
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setPesan(j.pesan ?? "Resep gagal disimpan.");
        return;
      }
      setPesan(`Tersimpan (${j.data.jumlah} bahan).`);
      muat();
      onSelesai();
    } catch {
      setPesan("Koneksi terputus. Resep belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  const margin = menu.harga > 0 ? Math.round(((menu.harga - hppDraf.total) / menu.harga) * 1000) / 10 : null;

  return (
    <div className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3">
      <div className="flex items-baseline gap-2">
        <p className="min-w-0 flex-1 truncate text-[0.875rem] font-extrabold text-tinta-900">
          {menu.nama}
        </p>
        <span className="shrink-0 text-[0.75rem] tabular-nums text-tinta-500">
          jual {rupiah(menu.harga)}
        </span>
      </div>

      {resep?.perkiraan && (
        <p className="mt-1 rounded bg-sela-50 px-2 py-1 text-[0.625rem] leading-snug text-sela-800">
          Resep ini <strong>perkiraan</strong> — diisi sistem, belum dicocokkan dengan takaran
          dapur. HPP-nya belum bisa dipakai mengambil keputusan harga.
        </p>
      )}

      <div className="mt-2 grid gap-1.5">
        {baris.map((b, i) => {
          const bh = bahan.find((x) => x.id === b.bahan_id);
          const biaya = Math.round((Number(b.jumlah) || 0) * (bh?.harga_satuan ?? 0));
          return (
            <div key={i} className="flex items-center gap-1.5">
              <select
                value={b.bahan_id}
                onChange={(e) =>
                  setBaris((l) => l.map((x, k) => (k === i ? { ...x, bahan_id: Number(e.target.value) } : x)))
                }
                className="h-8 min-w-0 flex-1 rounded-[0.5rem] border border-bersih-200 px-1.5 text-[0.75rem]"
              >
                {bahan.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nama} ({x.satuan})
                  </option>
                ))}
              </select>
              <input
                value={b.jumlah}
                onChange={(e) =>
                  setBaris((l) => l.map((x, k) => (k === i ? { ...x, jumlah: e.target.value } : x)))
                }
                inputMode="decimal"
                className="h-8 w-16 shrink-0 rounded-[0.5rem] border border-bersih-200 px-1.5 text-right text-[0.75rem] tabular-nums outline-none"
              />
              <span className="w-16 shrink-0 text-right text-[0.6875rem] tabular-nums text-tinta-500">
                {rupiah(biaya)}
              </span>
              <button
                type="button"
                onClick={() => setBaris((l) => l.filter((_, k) => k !== i))}
                aria-label={`Hapus ${bh?.nama ?? "bahan"}`}
                className="h-8 w-6 shrink-0 text-[0.875rem] text-tinta-500"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setBaris((l) => [...l, { bahan_id: bahan[0]?.id ?? 0, jumlah: "" }])}
        className="mt-1.5 h-8 w-full rounded-[0.5rem] border border-dashed border-bersih-200 text-[0.75rem] font-bold text-tinta-700"
      >
        + Bahan
      </button>

      <div className="mt-2 flex items-baseline justify-between border-t border-bersih-200 pt-2">
        <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
          HPP / porsi
        </span>
        <span className="text-[0.9375rem] font-extrabold tabular-nums text-tinta-900">
          {rupiah(hppDraf.total)}
        </span>
      </div>

      {hppDraf.adaKosong && (
        <p className="mt-1 text-[0.625rem] leading-snug text-sela-800">
          Ada bahan yang harganya belum diisi — HPP ini <strong>kurang</strong> dari biaya
          sebenarnya. Isi harga lewat pembelian.
        </p>
      )}

      {margin !== null && (
        <p className="mt-0.5 text-[0.625rem] text-tinta-500">
          Laba kotor {rupiah(menu.harga - hppDraf.total)} · margin {margin}%
        </p>
      )}

      {pesan && <p className="mt-1.5 text-[0.6875rem] leading-snug text-tinta-700">{pesan}</p>}

      <button
        type="button"
        onClick={simpan}
        disabled={sibuk}
        className="tombol-utama mt-2 h-10 w-full text-[0.8125rem] disabled:opacity-50"
      >
        {sibuk ? "Menyimpan…" : "Simpan resep"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Catat: pembelian, opname, buang
// ─────────────────────────────────────────────────────────────────────

function BagianCatat() {
  const [bahan, setBahan] = useState<Bahan[]>([]);
  const [gerakan, setGerakan] = useState<Gerakan[]>([]);
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    try {
      const [bRes, gRes] = await Promise.all([
        fetch("/api/order/stok?lihat=bahan", { cache: "no-store" }),
        fetch("/api/order/stok?lihat=gerakan&batas=40", { cache: "no-store" }),
      ]);
      const b = await bRes.json();
      const g = await gRes.json();
      setBahan(b.bahan ?? []);
      setGerakan(g.gerakan ?? []);
    } catch {
      setPesan("Koneksi terputus.");
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  if (bahan.length === 0) {
    return (
      <KotakKosong
        judul="Belum ada bahan"
        isi="Pembelian dan opname butuh bahan. Isi tab Bahan lebih dulu."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {pesan && <KotakPesan pesan={pesan} />}
      <FormPembelian bahan={bahan} onSelesai={muat} />
      <FormBuang bahan={bahan} onSelesai={muat} />

      <div>
        <p className="mb-1.5 text-[0.75rem] font-extrabold uppercase tracking-wider text-tinta-500">
          Buku besar stok
        </p>
        <ul className="divide-y divide-bersih-200 overflow-hidden rounded-[0.875rem] border border-bersih-200 bg-bersih-0">
          {gerakan.map((g) => (
            <li key={g.id} className="flex items-baseline gap-2 px-3 py-1.5">
              <span className="w-16 shrink-0 text-[0.625rem] font-bold uppercase text-tinta-500">
                {LABEL_JENIS[g.jenis] ?? g.jenis}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.75rem] text-tinta-900">
                {g.bahan}
              </span>
              <span
                className={[
                  "shrink-0 text-[0.75rem] font-bold tabular-nums",
                  Number(g.jumlah) < 0 ? "text-sela-800" : "text-forest-700",
                ].join(" ")}
              >
                {Number(g.jumlah) > 0 ? "+" : ""}
                {fmt(Number(g.jumlah))} {g.satuan}
              </span>
            </li>
          ))}
          {gerakan.length === 0 && (
            <li className="px-3 py-4 text-center text-[0.75rem] text-tinta-500">
              Belum ada gerakan stok.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function FormPembelian({ bahan, onSelesai }: { bahan: Bahan[]; onSelesai: () => void }) {
  const [supplier, setSupplier] = useState("");
  const [nota, setNota] = useState("");
  const [baris, setBaris] = useState<{ bahan_id: number; jumlah: string; harga: string }[]>([]);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const total = baris.reduce(
    (n, b) => n + Math.round((Number(b.jumlah) || 0) * (Number(b.harga) || 0)),
    0,
  );

  const kirim = async () => {
    if (sibuk) return;
    if (!supplier.trim()) {
      setPesan("Nama supplier wajib diisi.");
      return;
    }
    if (baris.length === 0) {
      setPesan("Tambahkan minimal satu bahan.");
      return;
    }
    setSibuk(true);
    setPesan("");
    try {
      const r = await fetch("/api/order/stok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "pembelian",
          supplier,
          no_nota: nota,
          item: baris.map((b) => ({
            bahan_id: b.bahan_id,
            jumlah: Number(b.jumlah),
            harga_satuan: Number(b.harga),
          })),
          oleh: "admin",
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setPesan(j.pesan ?? "Pembelian gagal disimpan.");
        return;
      }
      setPesan(`Tersimpan · ${rupiah(j.data.pembelian.total)} · ${j.data.pembelian.nomor}`);
      setBaris([]);
      setNota("");
      onSelesai();
    } catch {
      setPesan("Koneksi terputus. Pembelian belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3">
      <p className="text-[0.8125rem] font-extrabold text-tinta-900">Pembelian dari supplier</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <Isian label="Supplier" nilai={supplier} ubah={setSupplier} tempat="Pasar Induk" />
        <Isian label="No. nota (opsional)" nilai={nota} ubah={setNota} tempat="INV-0123" />
      </div>

      <div className="mt-2 grid gap-1.5">
        {baris.map((b, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <select
              value={b.bahan_id}
              onChange={(e) =>
                setBaris((l) => l.map((x, k) => (k === i ? { ...x, bahan_id: Number(e.target.value) } : x)))
              }
              className="h-8 min-w-0 flex-1 rounded-[0.5rem] border border-bersih-200 px-1.5 text-[0.75rem]"
            >
              {bahan.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nama} ({x.satuan})
                </option>
              ))}
            </select>
            <input
              value={b.jumlah}
              onChange={(e) =>
                setBaris((l) => l.map((x, k) => (k === i ? { ...x, jumlah: e.target.value } : x)))
              }
              inputMode="decimal"
              placeholder="jml"
              className="h-8 w-14 shrink-0 rounded-[0.5rem] border border-bersih-200 px-1.5 text-right text-[0.75rem] tabular-nums outline-none"
            />
            <input
              value={b.harga}
              onChange={(e) =>
                setBaris((l) => l.map((x, k) => (k === i ? { ...x, harga: e.target.value } : x)))
              }
              inputMode="numeric"
              placeholder="harga"
              className="h-8 w-16 shrink-0 rounded-[0.5rem] border border-bersih-200 px-1.5 text-right text-[0.75rem] tabular-nums outline-none"
            />
            <button
              type="button"
              onClick={() => setBaris((l) => l.filter((_, k) => k !== i))}
              aria-label="Hapus baris"
              className="h-8 w-5 shrink-0 text-[0.875rem] text-tinta-500"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setBaris((l) => [...l, { bahan_id: bahan[0]?.id ?? 0, jumlah: "", harga: "" }])}
        className="mt-1.5 h-8 w-full rounded-[0.5rem] border border-dashed border-bersih-200 text-[0.75rem] font-bold text-tinta-700"
      >
        + Bahan
      </button>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-tinta-500">
          Total
        </span>
        <span className="text-[0.9375rem] font-extrabold tabular-nums text-tinta-900">
          {rupiah(total)}
        </span>
      </div>

      {pesan && <p className="mt-1 text-[0.6875rem] leading-snug text-tinta-700">{pesan}</p>}

      <button
        type="button"
        onClick={kirim}
        disabled={sibuk}
        className="tombol-utama mt-2 h-10 w-full text-[0.8125rem] disabled:opacity-50"
      >
        {sibuk ? "Menyimpan…" : "Simpan pembelian"}
      </button>
    </div>
  );
}

function FormBuang({ bahan, onSelesai }: { bahan: Bahan[]; onSelesai: () => void }) {
  const [bahanId, setBahanId] = useState(bahan[0]?.id ?? 0);
  const [jumlah, setJumlah] = useState("");
  const [alasan, setAlasan] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const kirim = async () => {
    if (sibuk || !jumlah) return;
    setSibuk(true);
    setPesan("");
    try {
      const r = await fetch("/api/order/stok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "buang",
          bahan_id: bahanId,
          jumlah: Number(jumlah),
          catatan: alasan || "Dibuang",
          oleh: "admin",
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setPesan(j.pesan ?? "Gagal disimpan.");
        return;
      }
      setPesan("Tercatat.");
      setJumlah("");
      setAlasan("");
      onSelesai();
    } catch {
      setPesan("Koneksi terputus.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="rounded-[0.875rem] border border-bersih-200 bg-bersih-0 p-3">
      <p className="text-[0.8125rem] font-extrabold text-tinta-900">Bahan dibuang / rusak</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <select
          value={bahanId}
          onChange={(e) => setBahanId(Number(e.target.value))}
          className="h-8 min-w-0 flex-1 rounded-[0.5rem] border border-bersih-200 px-1.5 text-[0.75rem]"
        >
          {bahan.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nama} ({x.satuan})
            </option>
          ))}
        </select>
        <input
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value)}
          inputMode="decimal"
          placeholder="jumlah"
          className="h-8 w-20 shrink-0 rounded-[0.5rem] border border-bersih-200 px-1.5 text-right text-[0.75rem] tabular-nums outline-none"
        />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          placeholder="Alasan (rusak, tumpah…)"
          className="h-8 min-w-0 flex-1 rounded-[0.5rem] border border-bersih-200 px-2 text-[0.75rem] outline-none"
        />
        <button
          type="button"
          onClick={kirim}
          disabled={sibuk || !jumlah}
          className="h-8 shrink-0 rounded-[0.5rem] bg-forest-900 px-3 text-[0.75rem] font-bold text-cream-50 transition hover:bg-forest-800 disabled:opacity-40"
        >
          Catat
        </button>
      </div>
      {pesan && <p className="mt-1 text-[0.6875rem] text-tinta-700">{pesan}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HPP
// ─────────────────────────────────────────────────────────────────────

function BagianHpp() {
  const [harian, setHarian] = useState<HppHari[] | null>(null);
  const [menu, setMenu] = useState<HppMenu[] | null>(null);
  const [pesan, setPesan] = useState("");
  const [urut, setUrut] = useState<"margin" | "nama">("margin");

  const muat = useCallback(async () => {
    try {
      const [hRes, mRes] = await Promise.all([
        fetch("/api/order/stok?lihat=harian&hari=14", { cache: "no-store" }),
        fetch("/api/order/stok?lihat=hpp", { cache: "no-store" }),
      ]);
      const h = await hRes.json();
      const m = await mRes.json();
      if (!hRes.ok) {
        setPesan(h.pesan ?? "Laporan HPP gagal dibaca.");
        return;
      }
      setHarian(h.harian ?? []);
      setMenu(m.menu ?? []);
    } catch {
      setPesan("Koneksi terputus.");
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const daftarMenu = useMemo(() => {
    const arr = [...(menu ?? [])];
    if (urut === "margin") {
      /*
        Diurutkan dari margin TERBURUK. Pertanyaan yang mendorong orang
        membuka tab ini adalah "menu mana yang tidak menghasilkan", bukan
        "menu mana yang paling untung" — yang terakhir tidak menuntut
        tindakan apa pun.
      */
      arr.sort((a, b) => (a.persen ?? 999) - (b.persen ?? 999));
    } else {
      arr.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
    }
    return arr;
  }, [menu, urut]);

  const belumResep = (menu ?? []).filter((m) => m.jumlah_bahan === 0).length;
  const perkiraan = (menu ?? []).filter((m) => m.perkiraan).length;

  return (
    <div className="grid gap-3">
      {pesan && <KotakPesan pesan={pesan} />}

      <div>
        <p className="mb-1.5 text-[0.75rem] font-extrabold uppercase tracking-wider text-tinta-500">
          Laba kotor per hari
        </p>
        {/* Label tegas: hanya BAHAN. Menyebutnya "laba" akan membuat
            pemilik mengira tenaga kerja & sewa sudah terhitung. */}
        <p className="mb-1.5 text-[0.625rem] leading-snug text-tinta-500">
          HPP di sini <strong>hanya biaya bahan</strong> — belum termasuk tenaga kerja, listrik,
          sewa, atau penyusutan. Angkanya laba kotor, bukan laba bersih.
        </p>
        <ul className="divide-y divide-bersih-200 overflow-hidden rounded-[0.875rem] border border-bersih-200 bg-bersih-0">
          {(harian ?? []).map((h) => (
            <li key={h.tanggal} className="px-3 py-1.5">
              <div className="flex items-baseline gap-2">
                <span className="flex-1 text-[0.75rem] font-semibold text-tinta-900">
                  {h.tanggal}
                </span>
                <span className="text-[0.75rem] font-bold tabular-nums text-tinta-900">
                  {rupiah(h.omzet)}
                </span>
                <span className="w-14 text-right text-[0.6875rem] tabular-nums text-tinta-500">
                  HPP {rupiah(h.hpp)}
                </span>
                <span
                  className={[
                    "w-12 text-right text-[0.75rem] font-bold tabular-nums",
                    h.laba < 0 ? "text-sela-800" : "text-forest-700",
                  ].join(" ")}
                >
                  {h.persen === null ? "—" : `${h.persen}%`}
                </span>
              </div>
              {h.hppTidakLengkap > 0 && (
                <p className="mt-0.5 text-[0.5625rem] text-sela-800">
                  Termasuk {rupiah(h.hppTidakLengkap)} dari resep yang belum lengkap — laba
                  sebenarnya lebih kecil.
                </p>
              )}
            </li>
          ))}
          {(harian ?? []).length === 0 && (
            <li className="px-3 py-4 text-center text-[0.75rem] text-tinta-500">
              Belum ada penjualan lunas dalam 14 hari terakhir.
            </li>
          )}
        </ul>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <p className="flex-1 text-[0.75rem] font-extrabold uppercase tracking-wider text-tinta-500">
            HPP per menu
          </p>
          <button
            type="button"
            onClick={() => setUrut((u) => (u === "margin" ? "nama" : "margin"))}
            className="h-8 rounded-[0.5rem] border border-bersih-200 px-2 text-[0.6875rem] font-bold text-tinta-700"
          >
            {urut === "margin" ? "Margin terburuk" : "Urut nama"}
          </button>
        </div>

        {(belumResep > 0 || perkiraan > 0) && (
          <p className="mb-1.5 rounded bg-sela-50 px-2 py-1 text-[0.625rem] leading-snug text-sela-800">
            {belumResep > 0 && <>{belumResep} menu belum punya resep. </>}
            {perkiraan > 0 && <>{perkiraan} menu memakai resep perkiraan yang belum diverifikasi.</>}
          </p>
        )}

        <ul className="divide-y divide-bersih-200 overflow-hidden rounded-[0.875rem] border border-bersih-200 bg-bersih-0">
          {daftarMenu.slice(0, 80).map((m) => (
            <li key={m.menu_id} className="flex items-baseline gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[0.75rem] text-tinta-900">{m.nama}</span>
              {m.jumlah_bahan === 0 ? (
                <span className="shrink-0 text-[0.625rem] font-bold text-sela-800">tanpa resep</span>
              ) : (
                <>
                  <span className="w-16 shrink-0 text-right text-[0.6875rem] tabular-nums text-tinta-500">
                    {rupiah(m.hpp)}
                  </span>
                  <span className="w-16 shrink-0 text-right text-[0.6875rem] tabular-nums text-tinta-500">
                    {rupiah(m.harga)}
                  </span>
                  <span
                    className={[
                      "w-12 shrink-0 text-right text-[0.75rem] font-bold tabular-nums",
                      (m.persen ?? 0) < 0 ? "text-sela-800" : "text-forest-700",
                    ].join(" ")}
                  >
                    {m.persen === null ? "—" : `${m.persen}%`}
                    {!m.lengkap && <span title="ada bahan tanpa harga">*</span>}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        {perkiraan > 0 && (
          <p className="mt-1 text-[0.5625rem] leading-snug text-tinta-500">
            * HPP kurang dari biaya sebenarnya karena ada bahan yang harganya belum diisi.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Potongan kecil yang dipakai berulang ──────────────────────────────

function Isian({
  label,
  nilai,
  ubah,
  tempat,
  angka,
  lebar,
}: {
  label: string;
  nilai: string;
  ubah: (v: string) => void;
  tempat?: string;
  angka?: boolean;
  lebar?: boolean;
}) {
  return (
    <label className={lebar ? "col-span-2" : ""}>
      <span className="text-[0.625rem] font-bold uppercase tracking-wider text-tinta-500">
        {label}
      </span>
      <input
        value={nilai}
        onChange={(e) => ubah(e.target.value)}
        inputMode={angka ? "numeric" : undefined}
        placeholder={tempat}
        className="mt-0.5 h-8 w-full rounded-[0.5rem] border border-bersih-200 px-2 text-[0.75rem] outline-none"
      />
    </label>
  );
}

function KotakPesan({ pesan }: { pesan: string }) {
  return (
    <div className="rounded-[0.625rem] border border-sela-200 bg-sela-50 px-3 py-2">
      <p className="text-[0.75rem] leading-snug text-sela-800">{pesan}</p>
    </div>
  );
}

function KotakKosong({ judul, isi }: { judul: string; isi: string }) {
  return (
    <div className="rounded-[0.875rem] border border-dashed border-bersih-200 bg-bersih-100 px-4 py-8 text-center">
      <p className="text-[0.9375rem] font-semibold text-tinta-500">{judul}</p>
      <p className="mt-1 text-[0.8125rem] leading-snug text-tinta-500">{isi}</p>
    </div>
  );
}

/** Angka stok: 2 desimal paling banyak, tanpa nol berekor. */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}
