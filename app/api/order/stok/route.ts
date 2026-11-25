/**
 * /api/order/stok — stok bahan, resep, pembelian, opname, dan HPP.
 *
 * GET  ?lihat=bahan|resep|hpp|pembelian|gerakan|harian|perlu|menu
 * POST ?aksi=bahan|ubah_bahan|resep|pembelian|opname|buang|awal
 *
 * ── KENAPA SATU RUTE, BUKAN TUJUH ───────────────────────────────────
 *
 * Ketujuh bagian ini berbagi satu aturan: harga bahan dan HPP adalah data
 * internal yang tidak boleh keluar tanpa kunci server. Kalau tiap bagian
 * punya rute sendiri, cepat atau lambat satu di antaranya lupa memeriksa
 * kunci — dan itu cukup sekali untuk membocorkan seluruh margin menu.
 * Satu pintu berarti satu pemeriksaan yang harus benar.
 *
 * ── SEMUA PENULISAN DITOLAK TANPA KUNCI SERVER ──────────────────────
 *
 * Sama seperti /api/order/menu. Membaca dibolehkan dengan kunci baca
 * (anon) supaya halaman admin tetap bisa menampilkan data; tetapi tabel
 * stok tidak punya policy RLS, jadi tanpa service key pembacaan akan
 * gagal di database — bukan di sini. Itu disengaja: lapisan keduanya
 * tetap tertutup kalau kode ini salah.
 */
import { NextResponse } from "next/server";
import { PESAN_ENV_KOSONG, punyaEnvBaca, punyaKunciServer } from "@/app/lib/order/db";
import {
  buatBahan,
  catatGerakan,
  catatPembelian,
  daftarBahan,
  daftarPembelian,
  hppHarian,
  hppSemuaMenu,
  opname,
  resepMenu,
  riwayatStok,
  simpanResep,
  ubahBahan,
} from "@/app/lib/order/stok";
import { awalHariIni } from "@/app/lib/order/riwayat";

export const dynamic = "force-dynamic";

const PESAN_KUNCI =
  "Kunci server database belum dipasang, jadi data stok tidak bisa diubah.";

export async function GET(req: Request) {
  if (!punyaEnvBaca()) {
    return NextResponse.json({ pesan: PESAN_ENV_KOSONG, kode: "env" }, { status: 503 });
  }
  if (!punyaKunciServer()) {
    /*
      Tabel stok tidak punya policy RLS. Tanpa service key, kueri akan
      ditolak database dengan pesan Postgres yang tidak berguna bagi
      pemilik. Menjawab di sini memberi pesan yang bisa ditindaklanjuti.
    */
    return NextResponse.json(
      { pesan: "Kunci server database belum dipasang, jadi stok tidak bisa dibaca.", kode: "kunci" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const lihat = url.searchParams.get("lihat") ?? "bahan";
  const batas = Math.min(Math.max(Number(url.searchParams.get("batas")) || 60, 1), 500);

  try {
    switch (lihat) {
      case "bahan": {
        const r = await daftarBahan();
        if (!r.ok) return galat(r.pesan);
        return NextResponse.json({ bahan: r.data });
      }
      case "perlu": {
        const r = await daftarBahan();
        if (!r.ok) return galat(r.pesan);
        return NextResponse.json({ bahan: r.data.filter((b) => b.aktif && b.status !== "cukup") });
      }
      case "resep": {
        const menuId = Number(url.searchParams.get("menu_id"));
        if (!Number.isFinite(menuId)) return salah("menu_id wajib diisi.");
        const r = await resepMenu(menuId);
        if (!r.ok) return galat(r.pesan);
        return NextResponse.json(r.data);
      }
      case "hpp": {
        const r = await hppSemuaMenu();
        if (!r.ok) return galat(r.pesan);
        return NextResponse.json({ menu: r.data });
      }
      case "pembelian": {
        const r = await daftarPembelian(batas);
        if (!r.ok) return galat(r.pesan);
        return NextResponse.json({ pembelian: r.data });
      }
      case "gerakan": {
        const bahanId = Number(url.searchParams.get("bahan_id")) || undefined;
        const r = await riwayatStok(batas, bahanId);
        if (!r.ok) return galat(r.pesan);
        return NextResponse.json({ gerakan: r.data });
      }
      case "harian": {
        /*
          Rentang bawaan 14 hari. Dihitung dari awal hari WIB, bukan dari
          "sekarang dikurangi 14×24 jam": kalau pakai yang kedua, laporan
          yang dibuka pagi hari akan kehilangan hari paling awal.
        */
        const hari = Math.min(Math.max(Number(url.searchParams.get("hari")) || 14, 1), 120);
        const awal = awalHariIni(new Date());
        awal.setUTCDate(awal.getUTCDate() - (hari - 1));
        const r = await hppHarian(awal.toISOString());
        if (!r.ok) return galat(r.pesan);
        return NextResponse.json({ harian: r.data, sejak: awal.toISOString() });
      }
      case "menu": {
        // Daftar menu ringkas untuk pemilih resep — id, nama, harga saja.
        const r = await hppSemuaMenu();
        if (!r.ok) return galat(r.pesan);
        return NextResponse.json({
          menu: r.data.map((m) => ({ id: m.menu_id, nama: m.nama, harga: m.harga, hpp: m.hpp })),
        });
      }
      default:
        return salah(`Nilai "lihat" tidak dikenal: ${lihat}`);
    }
  } catch (e) {
    console.error("api stok GET gagal", lihat, e);
    return galat("Data stok gagal dibaca.");
  }
}

export async function POST(req: Request) {
  if (!punyaEnvBaca()) {
    return NextResponse.json({ pesan: PESAN_ENV_KOSONG, kode: "env" }, { status: 503 });
  }
  if (!punyaKunciServer()) {
    return NextResponse.json({ pesan: PESAN_KUNCI, kode: "kunci" }, { status: 503 });
  }

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return salah("Isi permintaan tidak terbaca.");
  }

  const aksi = String(b.aksi ?? "");
  const oleh = String(b.oleh ?? "admin").slice(0, 60) || "admin";

  try {
    switch (aksi) {
      case "bahan": {
        const r = await buatBahan({
          nama: String(b.nama ?? ""),
          satuan: String(b.satuan ?? ""),
          harga_satuan: Number(b.harga_satuan ?? 0),
          stok_minimum: Number(b.stok_minimum ?? 0),
          stok_awal: Number(b.stok_awal ?? 0),
          oleh,
        });
        return jawab(r);
      }
      case "ubah_bahan": {
        const id = Number(b.id);
        if (!Number.isFinite(id)) return salah("id bahan wajib diisi.");
        const patch: Record<string, unknown> = {};
        for (const k of ["nama", "satuan", "stok_minimum", "aktif", "catatan"] as const) {
          if (b[k] !== undefined) patch[k] = b[k];
        }
        const r = await ubahBahan(id, patch);
        return jawab(r);
      }
      case "resep": {
        const menuId = Number(b.menu_id);
        if (!Number.isFinite(menuId)) return salah("menu_id wajib diisi.");
        const baris = Array.isArray(b.baris) ? b.baris : [];
        const r = await simpanResep(
          menuId,
          baris.map((x) => {
            const o = x as Record<string, unknown>;
            return {
              bahan_id: Number(o.bahan_id),
              jumlah: Number(o.jumlah),
              perkiraan: o.perkiraan === undefined ? false : Boolean(o.perkiraan),
            };
          }),
        );
        return jawab(r);
      }
      case "pembelian": {
        const item = Array.isArray(b.item) ? b.item : [];
        const r = await catatPembelian({
          supplier: String(b.supplier ?? ""),
          no_nota: String(b.no_nota ?? ""),
          dibayar: b.dibayar === undefined ? true : Boolean(b.dibayar),
          catatan: String(b.catatan ?? ""),
          oleh,
          dibeli_at: typeof b.dibeli_at === "string" ? b.dibeli_at : undefined,
          item: item.map((x) => {
            const o = x as Record<string, unknown>;
            return {
              bahan_id: Number(o.bahan_id),
              jumlah: Number(o.jumlah),
              harga_satuan: Number(o.harga_satuan),
            };
          }),
        });
        return jawab(r);
      }
      case "opname": {
        const id = Number(b.bahan_id);
        if (!Number.isFinite(id)) return salah("bahan_id wajib diisi.");
        const r = await opname(id, Number(b.fisik), oleh, String(b.catatan ?? ""));
        return jawab(r);
      }
      case "buang":
      case "awal": {
        const r = await catatGerakan({
          bahan_id: Number(b.bahan_id),
          jenis: aksi,
          // Buang selalu MENGURANGI. Dikirim positif dari layar (jumlah
          // yang dibuang), dibalik di sini supaya pengguna tidak perlu
          // mengingat tanda minus.
          jumlah: aksi === "buang" ? -Math.abs(Number(b.jumlah)) : Math.abs(Number(b.jumlah)),
          catatan: String(b.catatan ?? ""),
          oleh,
        });
        return jawab(r);
      }
      default:
        return salah(`Aksi tidak dikenal: ${aksi || "(kosong)"}`);
    }
  } catch (e) {
    console.error("api stok POST gagal", aksi, e);
    return galat("Perubahan stok gagal disimpan.");
  }
}

const salah = (pesan: string) => NextResponse.json({ pesan }, { status: 400 });
const galat = (pesan: string) => NextResponse.json({ pesan }, { status: 503 });

function jawab<T>(r: { ok: true; data: T } | { ok: false; pesan: string }) {
  return r.ok
    ? NextResponse.json({ ok: true, data: r.data })
    : NextResponse.json({ pesan: r.pesan }, { status: 400 });
}
