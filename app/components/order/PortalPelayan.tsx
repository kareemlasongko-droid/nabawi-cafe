"use client";

/**
 * Portal pelayan — HP atau tablet kecil, dipakai sambil bergerak.
 *
 * KEPUTUSAN DESAIN
 *
 * 1. Satu kolom, dua tab. Tidak ada tabel dan tidak ada input teks (PRD
 *    bagian 10). Pelayan berdiri, sering satu tangan memegang nampan.
 *
 * 2. Baris terpenting ada di atas dan berukuran besar: nomor meja. Nama
 *    pemesan di bawahnya, karena kadang tidak diisi.
 *
 * 3. Tombol "Sudah diantar" mengisi seluruh lebar baris. Baris adalah
 *    tombolnya — tidak perlu membidik kotak kecil.
 *
 * 4. Yang paling lama menunggu diberi tanda di kiri (garis tebal) dan
 *    disebut waktunya. Tanpa itu, pelayan mengantar yang paling baru
 *    karena berada paling atas.
 *
 * 5. Getar + bunyi untuk pesanan yang baru siap (W-05). Getar
 *    dipakai lebih dulu karena pelayan sering menyimpan HP di saku.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sejak } from "@/app/lib/order/tipe";
import { IkonCentang, IkonSegar, IkonMeja } from "./IkonDapur";
import { LogoNabawi } from "./LogoNabawi";
import { TombolKepala } from "./TombolKepala";
import { IkonSuara, IkonMatikanSuara } from "./Ikon";

type Siap = {
  id: number;
  nomor: string;
  meja_nomor: string;
  nama_pemesan: string | null;
  created_at: string;
  siap_at: string | null;
  items: { id: number; nama_saat_pesan: string; jumlah: number }[];
};

export function PortalPelayan() {
  const [siap, setSiap] = useState<Siap[]>([]);
  const [galat, setGalat] = useState("");
  const [sekarang, setSekarang] = useState(() => Date.now());
  const [suara, setSuara] = useState(true);
  const jumlahLalu = useRef(0);

  const muat = useCallback(async () => {
    try {
      const res = await fetch("/api/order/pelayan", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        setGalat(j.pesan ?? "Gagal memuat daftar.");
        return;
      }
      setGalat("");
      setSiap(j.siap ?? []);
    } catch {
      setGalat("Koneksi terputus. Daftar tidak diperbarui.");
    }
  }, []);

  useEffect(() => {
    muat();
    const t = setInterval(muat, 4000);
    const jam = setInterval(() => setSekarang(Date.now()), 15000);
    return () => {
      clearInterval(t);
      clearInterval(jam);
    };
  }, [muat]);

  // Notifikasi: getar dulu (HP di saku), lalu bunyi.
  useEffect(() => {
    if (jumlahLalu.current > 0 && siap.length > jumlahLalu.current) {
      navigator.vibrate?.([120, 60, 120]);
      if (suara) {
        bunyi(980, 0.14);
        setTimeout(() => bunyi(980, 0.14), 170);
      }
    }
    jumlahLalu.current = siap.length;
  }, [siap, suara]);

  async function sudahDiantar(id: number) {
    // Optimistis: baris langsung hilang, lalu disinkronkan. Pelayan sedang
    // berjalan; menunggu jaringan sebelum menghilangkan baris membuatnya
    // menekan dua kali.
    setSiap((s) => s.filter((x) => x.id !== id));
    await fetch("/api/order/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ke: "diantar", oleh: "pelayan" }),
    }).catch(() => {});
    muat();
  }

  const urutSiap = useMemo(
    () =>
      [...siap].sort(
        (a, b) =>
          new Date(a.siap_at ?? a.created_at).getTime() -
          new Date(b.siap_at ?? b.created_at).getTime()
      ),
    [siap]
  );

  return (
    <div className="min-h-dvh bg-cream-50 pb-4">
      <header className="sticky top-0 z-30 border-b border-bersih-200/80 bg-cream-50/92 backdrop-blur-md">
        {/*
          SATU BARIS: identitas kiri, satu tombol ikon kanan.

          Dulu di bawahnya ada dua tab ("Siap diantar" / "Panggilan").
          Fitur panggilan sudah dihapus, jadi tinggal satu daftar — tidak
          ada yang perlu dipilih, dan kepala kembali setipis satu baris.
        */}
        <div className="mx-auto flex max-w-[34rem] items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex min-w-0 items-center">
            <LogoNabawi
              ukuran={28}
              layar="Pelayan"
              keterangan={galat || `${urutSiap.length} siap diantar`}
              keteranganPonsel={galat ? "!" : `${urutSiap.length} siap`}
            />
          </div>
          <div className="flex shrink-0 items-center">
            {/*
              HANYA IKON, di semua lebar. Ini satu-satunya tombol di kepala
              pelayan, jadi tidak ada label yang perlu disembunyikan di
              ponsel — dan label "Bunyi" yang ikut tampil di tablet membuat
              tombol 40px ini selebar ~100px tanpa menambah arti. Nama
              tombolnya tetap ada untuk pembaca layar lewat `judul`
              ("Matikan bunyi"/"Nyalakan bunyi"), yang lebih menjelaskan
              daripada label "Bunyi" itu sendiri.
            */}
            <TombolKepala
              onClick={() => setSuara((s) => !s)}
              aktif={suara}
              ikon={suara ? <IkonSuara className="size-4" /> : <IkonMatikanSuara className="size-4" />}
              label="Bunyi"
              judul={suara ? "Matikan bunyi" : "Nyalakan bunyi"}
              hanyaIkon
              className="size-10 justify-center px-0"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[34rem] px-3 pt-3">
        {urutSiap.length === 0 ? (
        <Kosong
          judul="Tidak ada yang menunggu diantar"
          isi="Pesanan muncul di sini setelah dapur menandainya siap."
        />
      ) : (
        <ul className="space-y-2">
          {urutSiap.map((p, i) => {
            const menit = Math.floor(
              (sekarang - new Date(p.siap_at ?? p.created_at).getTime()) / 60000
            );
            const terlama = i === 0 && menit >= 5;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => sudahDiantar(p.id)}
                  className={[
                    "flex w-full items-stretch gap-0 overflow-hidden rounded-[0.875rem] border bg-bersih-0 text-left transition active:scale-[0.995]",
                    terlama
                      ? "border-sela-600/50 shadow-[0_8px_20px_-14px_rgb(201_80_10/0.5)]"
                      : "border-bersih-200 shadow-[0_1px_2px_rgb(22_19_15/0.04)]",
                  ].join(" ")}
                >
                  {/* Penanda "paling lama" di kiri, bukan di atas:
                      terbaca sekilas saat mata menyapu daftar. */}
                  <span
                    className={[
                      "w-1.5 shrink-0",
                      terlama ? "bg-sela-600" : "bg-bersih-300",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-[0.75rem] bg-forest-900 text-[1.125rem] font-extrabold leading-none text-cream-50">
                      {p.meja_nomor}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-extrabold leading-tight text-tinta-900">
                        Meja {p.meja_nomor}
                        {p.nama_pemesan ? ` · ${p.nama_pemesan}` : ""}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.8125rem] leading-snug text-tinta-500">
                        {p.items.map((i) => `${i.jumlah}× ${i.nama_saat_pesan}`).join(", ") ||
                          `${p.nomor}`}
                      </span>
                      <span
                        className={[
                          "mt-1 inline-block rounded px-1.5 py-0.5 text-[0.6875rem] font-bold tabular-nums",
                          terlama
                            ? "bg-sela-100 text-sela-800"
                            : "bg-bersih-100 text-tinta-500",
                        ].join(" ")}
                      >
                        siap {sejak(p.siap_at ?? p.created_at, sekarang)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-center gap-1 rounded-[0.75rem] bg-forest-900 px-2.5 py-2 text-cream-50">
                      <IkonCentang className="size-5" />
                      <span className="text-[0.6875rem] font-extrabold uppercase leading-none">
                        Sudah
                        <br />
                        diantar
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </main>

      <p className="mx-auto mt-4 max-w-[34rem] px-3 text-center text-[0.6875rem] leading-relaxed text-tinta-500">
        Ketuk baris untuk menandai selesai. Semua pelayan melihat semua meja.
      </p>
    </div>
  );
}

function Kosong({ judul, isi }: { judul: string; isi: string }) {
  return (
    <div className="rounded-[0.875rem] border border-dashed border-bersih-200 bg-bersih-100 px-4 py-10 text-center">
      <p className="text-[0.9375rem] font-bold text-tinta-700">{judul}</p>
      <p className="mx-auto mt-1 max-w-[16rem] text-[0.8125rem] leading-relaxed text-tinta-500">{isi}</p>
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
    o.type = "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durasi);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + durasi + 0.02);
  } catch {
    /* abaikan */
  }
}
