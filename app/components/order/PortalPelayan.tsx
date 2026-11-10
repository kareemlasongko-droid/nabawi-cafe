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
 * 5. Getar + bunyi untuk pesanan siap dan panggilan baru (W-05). Getar
 *    dipakai lebih dulu karena pelayan sering menyimpan HP di saku.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sejak } from "@/app/lib/order/tipe";
import { IkonBel, IkonBill, IkonCentang, IkonSegar, IkonMeja } from "./IkonDapur";
import { LogoNabawi } from "./LogoNabawi";

type Siap = {
  id: number;
  nomor: string;
  meja_nomor: string;
  nama_pemesan: string | null;
  created_at: string;
  siap_at: string | null;
  items: { id: number; nama_saat_pesan: string; jumlah: number }[];
};

type Panggilan = {
  id: number;
  meja_nomor: string;
  jenis: "pelayan" | "bill";
  dibuat_at: string;
};

export function PortalPelayan() {
  const [siap, setSiap] = useState<Siap[]>([]);
  const [panggilan, setPanggilan] = useState<Panggilan[]>([]);
  const [tab, setTab] = useState<"antar" | "panggilan">("antar");
  const [galat, setGalat] = useState("");
  const [sekarang, setSekarang] = useState(() => Date.now());
  const [suara, setSuara] = useState(true);
  const jumlahLalu = useRef({ siap: 0, panggilan: 0 });

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
      setPanggilan(j.panggilan ?? []);
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
    const a = jumlahLalu.current;
    if (jumlahLalu.current.siap > 0 || jumlahLalu.current.panggilan > 0) {
      const adaSiapBaru = siap.length > a.siap;
      const adaPanggilanBaru = panggilan.length > a.panggilan;

      if (adaSiapBaru || adaPanggilanBaru) {
        navigator.vibrate?.([120, 60, 120]);
        if (suara) {
          bunyi(adaPanggilanBaru ? 760 : 980, 0.14);
          setTimeout(() => bunyi(adaPanggilanBaru ? 760 : 980, 0.14), 170);
        }
      }
    }
    jumlahLalu.current = { siap: siap.length, panggilan: panggilan.length };
  }, [siap, panggilan, suara]);

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

  async function tangani(id: number) {
    setPanggilan((p) => p.filter((x) => x.id !== id));
    await fetch("/api/order/kasir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "tangani_panggilan", id }),
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
    <div className="min-h-dvh bg-bersih-50 pb-4">
      <header className="sticky top-0 z-30 border-b border-bersih-200 bg-bersih-0/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[34rem] items-center gap-2 px-3 py-2.5">
          {/* Identitas + nama layar. Dua kolom ini sengaja dipisah garis:
              "Pelayan" adalah peran, "Nabawi Cafe" adalah tempatnya. */}
          <LogoNabawi ukuran={32} hanyaLogo label="Nabawi Cafe & Resto" />
          <span aria-hidden="true" className="h-7 w-px shrink-0 bg-bersih-200" />
          <div className="min-w-0 flex-1">
            {/* Nama kafe di baris atas, peran di bawah. Pelayan membawa HP
                ini sambil berjalan dan sering berpapasan dengan layar lain;
                tiga baris pendek lebih mudah dikenali sekilas daripada
                satu nama peran tanpa penanda tempat. */}
            <p className="truncate text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-tinta-500">
              Nabawi Cafe &amp; Resto
            </p>
            <h1 className="truncate text-[1.0625rem] font-extrabold leading-none text-tinta-900">
              Pelayan
            </h1>
            <p className="mt-0.5 truncate text-[0.6875rem] text-tinta-500">
              {galat || `${urutSiap.length} siap diantar · ${panggilan.length} panggilan`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSuara((s) => !s)}
            className={[
              "grid size-10 place-items-center rounded-[0.625rem] border",
              suara
                ? "border-forest-700/40 bg-daun-100 text-forest-700"
                : "border-bersih-200 text-tinta-500",
            ].join(" ")}
            aria-label={suara ? "Matikan bunyi" : "Nyalakan bunyi"}
          >
            <IkonBel className="size-4" />
          </button>
        </div>

        {/* Tab. Jumlah ditulis di dalam tab supaya pelayan tahu ada
            pekerjaan di tab lain tanpa harus membukanya. */}
        <div className="mx-auto flex max-w-[34rem] gap-1.5 px-3 pb-2">
          <Tab
            aktif={tab === "antar"}
            onClick={() => setTab("antar")}
            jumlah={urutSiap.length}
            ikon={<IkonSegar className="size-4" />}
          >
            Siap diantar
          </Tab>
          <Tab
            aktif={tab === "panggilan"}
            onClick={() => setTab("panggilan")}
            jumlah={panggilan.length}
            ikon={<IkonBel className="size-4" />}
          >
            Panggilan
          </Tab>
        </div>
      </header>

      <main className="mx-auto max-w-[34rem] px-3 pt-3">
        {tab === "antar" && (
          <>
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
                          terlama ? "border-clay-700/45" : "border-bersih-200",
                        ].join(" ")}
                      >
                        {/* Penanda "paling lama" di kiri, bukan di atas:
                            terbaca sekilas saat mata menyapu daftar. */}
                        <span
                          className={[
                            "w-1.5 shrink-0",
                            terlama ? "bg-clay-700" : "bg-bersih-300",
                          ].join(" ")}
                          aria-hidden="true"
                        />
                        <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                          <span className="grid size-12 shrink-0 place-items-center rounded-[0.625rem] bg-tinta-900 text-[1.125rem] font-extrabold leading-none text-bersih-0">
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
                                  ? "bg-tanah-100 text-clay-800"
                                  : "bg-bersih-100 text-tinta-500",
                              ].join(" ")}
                            >
                              siap {sejak(p.siap_at ?? p.created_at, sekarang)}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-center gap-1 rounded-[0.625rem] bg-tinta-900 px-2.5 py-2 text-bersih-0">
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
          </>
        )}

        {tab === "panggilan" && (
          <>
            {panggilan.length === 0 ? (
              <Kosong
                judul="Tidak ada panggilan"
                isi="Panggilan pelayan dan permintaan bill muncul di sini."
              />
            ) : (
              <ul className="space-y-2">
                {panggilan.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => tangani(g.id)}
                      className="flex w-full items-center gap-3 rounded-[0.875rem] shadow-[0_1px_2px_rgba(22,19,15,0.04),0_6px_16px_-10px_rgba(22,19,15,0.16)] bg-bersih-0 px-3 py-3 text-left transition active:scale-[0.995]"
                    >
                      <span
                        className={[
                          "grid size-11 shrink-0 place-items-center rounded-[0.625rem]",
                          g.jenis === "bill"
                            ? "bg-tanah-100 text-clay-800"
                            : "bg-daun-100 text-forest-700",
                        ].join(" ")}
                      >
                        {g.jenis === "bill" ? (
                          <IkonBill className="size-5" />
                        ) : (
                          <IkonBel className="size-5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.9375rem] font-extrabold text-tinta-900">
                          Meja {g.meja_nomor}
                        </span>
                        <span className="block text-[0.8125rem] text-tinta-500">
                          {g.jenis === "bill" ? "Minta bill" : "Panggil pelayan"} ·{" "}
                          {sejak(g.dibuat_at, sekarang)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 rounded-[0.625rem] border border-forest-700/40 px-2.5 py-2 text-[0.6875rem] font-extrabold uppercase leading-tight text-forest-700">
                        <IkonMeja className="size-4" />
                        Sudah
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <p className="mx-auto mt-4 max-w-[34rem] px-3 text-center text-[0.6875rem] leading-relaxed text-tinta-500">
        Ketuk baris untuk menandai selesai. Semua pelayan melihat semua meja.
      </p>
    </div>
  );
}

function Tab({
  aktif,
  onClick,
  jumlah,
  ikon,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  jumlah: number;
  ikon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-11 flex-1 items-center justify-center gap-2 rounded-[0.625rem] text-[0.9375rem] font-bold transition",
        aktif
          ? "bg-tinta-900 text-bersih-0"
          : "border border-bersih-200 bg-bersih-100 text-tinta-700",
      ].join(" ")}
    >
      {ikon}
      {children}
      <span
        className={[
          "rounded-full px-1.5 py-0.5 text-[0.6875rem] font-extrabold tabular-nums",
          aktif ? "bg-bersih-0/15 text-bersih-0" : "bg-bersih-100 text-tinta-700",
          jumlah === 0 ? "opacity-50" : "",
        ].join(" ")}
      >
        {jumlah}
      </span>
    </button>
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
