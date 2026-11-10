/**
 * Penyimpanan menu dari portal admin — dipisah dari route handler.
 *
 * KENAPA DIPISAH
 * Sebelumnya seluruh logika ini menumpang di `app/api/order/menu/route.ts`.
 * Akibatnya logika hanya bisa diuji lewat HTTP, dan setiap masalah validasi
 * mengembalikan pesan yang sama: "Nama dan harga menu wajib diisi." Admin
 * yang add-on-nya ditolak karena nama ganda akan membaca pesan itu dan
 * mengira masalahnya ada di harga.
 *
 * Sekarang `rapikanMenu` murni (tanpa database) sehingga bisa diuji langsung,
 * dan setiap penolakan membawa alasannya sendiri.
 */
import { db } from "./db";
import { bacaPilihan, BATAS_PILIHAN } from "./aturan";
import type { PilihanMenu } from "./tipe";

export type HasilRapikan =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; pesan: string };

export function rapikanMenu(b: unknown, untukBaru: boolean): HasilRapikan {
  if (!b || typeof b !== "object") return { ok: false, pesan: "Isi permintaan tidak terbaca." };
  const x = b as Record<string, unknown>;
  const hasil: Record<string, unknown> = {};

  if (typeof x.nama === "string" && x.nama.trim()) hasil.nama = x.nama.trim().slice(0, 80);
  if (typeof x.deskripsi === "string") hasil.deskripsi = x.deskripsi.trim().slice(0, 240);

  if (x.harga !== undefined) {
    const h = Math.round(Number(x.harga));
    if (!Number.isFinite(h) || h < 0) {
      return { ok: false, pesan: "Harga harus angka dan tidak boleh negatif." };
    }
    hasil.harga = h;
  }
  if (x.kategori_id !== undefined) {
    hasil.kategori_id = x.kategori_id === null ? null : Number(x.kategori_id);
  }
  if (x.foto_url !== undefined) {
    hasil.foto_url = x.foto_url ? String(x.foto_url).slice(0, 400) : null;
  }
  if (typeof x.tersedia === "boolean") hasil.tersedia = x.tersedia;
  if (x.urutan !== undefined) hasil.urutan = Math.round(Number(x.urutan)) || 0;

  /*
    Pilihan / add-on.

    `null` berarti "hapus semua", `undefined` berarti "jangan sentuh".
    Perbedaan ini bukan kehalusan: tabel admin mengirim `{tersedia:false}`
    setiap kali kasir menandai menu habis. Kalau `undefined` diperlakukan
    sama dengan `null`, add-on seluruh menu akan terhapus setiap kali menu
    ditandai habis — dan tidak ada yang menyadarinya sampai pelanggan
    berikutnya tidak ditanya saus.
  */
  if (x.pilihan !== undefined) {
    if (x.pilihan === null) {
      hasil.pilihan = [];
    } else if (!Array.isArray(x.pilihan)) {
      return { ok: false, pesan: "Pilihan harus berupa daftar." };
    } else if (x.pilihan.length > BATAS_PILIHAN) {
      return { ok: false, pesan: `Pilihan maksimal ${BATAS_PILIHAN} opsi.` };
    } else {
      // Tambahan harga negatif DITOLAK, bukan dijepit diam-diam ke nol:
      // admin yang mengetik "-5000" harus tahu tidak tersimpan, bukan
      // menemukan angkanya berubah sendiri jadi 0.
      const negatif = x.pilihan.some((p) => {
        const o = p as Record<string, unknown> | null;
        return o && typeof o === "object" && Number(o.tambah) < 0;
      });
      if (negatif) return { ok: false, pesan: "Tambahan harga tidak boleh negatif." };

      const rapi = bacaPilihan(x.pilihan);
      if (x.pilihan.length > 0 && rapi.length === 0) {
        return { ok: false, pesan: "Setiap pilihan butuh nama." };
      }
      const namaGanda = new Set<string>();
      for (const p of rapi as PilihanMenu[]) {
        const kunci = p.nama.toLowerCase();
        if (namaGanda.has(kunci)) {
          return { ok: false, pesan: `Nama pilihan "${p.nama}" dipakai dua kali.` };
        }
        namaGanda.add(kunci);
      }
      hasil.pilihan = rapi;
    }
  }

  if (untukBaru && (!hasil.nama || hasil.harga === undefined)) {
    return { ok: false, pesan: "Nama dan harga menu wajib diisi." };
  }
  return { ok: true, data: hasil };
}

/** Ubah menu yang sudah ada. */
export async function simpanMenu(
  id: number,
  patch: unknown
): Promise<{ ok: true; data: unknown } | { ok: false; pesan: string }> {
  if (!Number.isFinite(id) || id <= 0) return { ok: false, pesan: "Menu tidak sah." };
  const rapi = rapikanMenu(patch, false);
  if (!rapi.ok) return rapi;
  if (Object.keys(rapi.data).length === 0) return { ok: false, pesan: "Tidak ada perubahan." };

  const res = await db("menu", {
    method: "PATCH",
    prefer: "return=representation",
    q: `id=eq.${id}`,
    body: rapi.data,
  });
  if (!res.ok) return { ok: false, pesan: res.pesan };
  return { ok: true, data: res.data };
}

/** Tambah menu baru. */
export async function tambahMenu(
  data: unknown
): Promise<{ ok: true; data: unknown } | { ok: false; pesan: string }> {
  const rapi = rapikanMenu(data, true);
  if (!rapi.ok) return rapi;
  const res = await db("menu", { method: "POST", prefer: "return=representation", body: rapi.data });
  if (!res.ok) return { ok: false, pesan: res.pesan };
  return { ok: true, data: res.data };
}
