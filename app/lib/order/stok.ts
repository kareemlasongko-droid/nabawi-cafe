/**
 * Stok bahan, pembelian, opname, dan HPP — lapisan database.
 *
 * ── ATURAN YANG DIJAGA BERKAS INI ────────────────────────────────────
 *
 * 1. **Stok tidak pernah ditulis langsung.** Semua perubahan lewat
 *    `gerakan_stok`. Saldo adalah hasil penjumlahan, bukan kolom yang
 *    di-PATCH. Kalau saldo bisa ditulis langsung, suatu saat ia akan
 *    berbeda dari riwayatnya dan tidak ada cara mengetahui mana yang benar.
 *
 * 2. **Potong stok SATU TEMPAT.** Hanya `potongStokPesanan()` — dipanggil
 *    dari satu titik di alur pembayaran. Fungsi ini idempoten lewat indeks
 *    unik `hpp_pesanan(item_id)`, jadi notifikasi pembayaran ganda tidak
 *    menggandakan pemakaian.
 *
 * 3. **Harga dikunci saat kejadian.** HPP memakai harga yang berlaku saat
 *    pesanan lunas, bukan harga hari ini. Laporan bulan lalu tidak boleh
 *    berubah karena supplier menaikkan harga.
 *
 * 4. **Gagal potong stok TIDAK membatalkan pembayaran.** Uang sudah
 *    diterima; menolak mencatatnya karena stok bermasalah akan membuat
 *    kasir mengulang pembayaran. Kegagalan dikembalikan sebagai pesan
 *    untuk ditampilkan, bukan dilempar.
 */
import { db } from "./db";
import type { Hasil } from "./data";
import {
  hargaRataRataBaru,
  kebutuhanBahan,
  marginKotor,
  nilaiOpname,
  nilaiPakai,
  rp,
  selisihOpname,
  statusBahan,
  totalHpp,
  type BarisPesanan,
  type BarisResep,
  type StatusStok,
} from "./hpp";

// ─────────────────────────────────────────────────────────────────────
// Tipe baris database
// ─────────────────────────────────────────────────────────────────────

export type Bahan = {
  id: number;
  nama: string;
  satuan: string;
  harga_satuan: number;
  stok_minimum: number;
  aktif: boolean;
  catatan: string;
};

export type BahanDenganSaldo = Bahan & {
  stok: number;
  status: StatusStok;
  /** Nilai rupiah stok yang ada sekarang, memakai harga rata-rata. */
  nilai: number;
};

type Gerakan = {
  bahan_id: number;
  jumlah: number;
  harga_satuan: number;
  nilai: number;
};

// ─────────────────────────────────────────────────────────────────────
// Bahan & saldo
// ─────────────────────────────────────────────────────────────────────

/**
 * Saldo stok seluruh bahan.
 *
 * ── KENAPA DIJUMLAH DI SINI, BUKAN DI DATABASE ──────────────────────
 *
 * View dengan SUM akan lebih cepat, tetapi menambah objek skema yang
 * harus ikut dijaga saat migrasi. Untuk kafe dengan puluhan bahan (bukan
 * puluhan ribu), menarik seluruh gerakan lalu menjumlahkannya di sini
 * masih di bawah 50 ms — dan yang lebih penting: aturannya terbaca di
 * kode yang sama dengan aturan HPP.
 *
 * Kalau jumlah gerakan suatu saat melewati ~5000 baris, pindahkan ke
 * view dengan SUM — dan uji `uji:stok` akan menangkap kalau hasilnya
 * berbeda.
 */
export async function daftarBahan(): Promise<Hasil<BahanDenganSaldo[]>> {
  const [bahanRes, gerakRes] = await Promise.all([
    db<Bahan[]>("bahan", { q: "select=*&order=nama.asc" }),
    db<Gerakan[]>("gerakan_stok", { q: "select=bahan_id,jumlah,harga_satuan,nilai" }),
  ]);
  if (!bahanRes.ok) return { ok: false, pesan: bahanRes.pesan };
  if (!gerakRes.ok) return { ok: false, pesan: gerakRes.pesan };

  const saldo = new Map<number, number>();
  // Bahan yang punya gerakan apa pun sudah "pernah dicatat". Dibedakan dari
  // saldo 0 yang berarti belum pernah ada pembelian/opname sama sekali.
  const pernahDicatat = new Set<number>();
  for (const g of gerakRes.data) {
    saldo.set(g.bahan_id, (saldo.get(g.bahan_id) ?? 0) + Number(g.jumlah));
    pernahDicatat.add(g.bahan_id);
  }

  return {
    ok: true,
    data: bahanRes.data.map((b) => {
      const stok = Math.round((saldo.get(b.id) ?? 0) * 1000) / 1000;
      return {
        ...b,
        stok,
        status: statusBahan(stok, b.stok_minimum, pernahDicatat.has(b.id)),
        nilai: rp(stok * b.harga_satuan),
      };
    }),
  };
}

/** Bahan yang perlu dipesan: habis atau di bawah minimum. */
export async function bahanPerluDipesan(): Promise<Hasil<BahanDenganSaldo[]>> {
  const r = await daftarBahan();
  if (!r.ok) return r;
  return {
    ok: true,
    // "belum dicatat" memang perlu diisi stoknya, tetapi bukan karena
    // kehabisan — ia tetap masuk daftar, dengan alasannya sendiri.
    data: r.data.filter((b) => b.aktif && b.status !== "cukup"),
  };
}

export async function buatBahan(masuk: {
  nama: string;
  satuan: string;
  harga_satuan: number;
  stok_minimum?: number;
  stok_awal?: number;
  oleh: string;
}): Promise<Hasil<Bahan>> {
  const nama = masuk.nama.trim();
  const satuan = masuk.satuan.trim();
  if (!nama) return { ok: false, pesan: "Nama bahan wajib diisi." };
  if (!satuan) return { ok: false, pesan: "Satuan wajib diisi (mis. gram, ml, pcs)." };
  if (!Number.isFinite(masuk.harga_satuan) || masuk.harga_satuan < 0) {
    return { ok: false, pesan: "Harga satuan tidak sah." };
  }

  /*
    INSERT bahan dan INSERT gerakan awal TIDAK atomik (PostgREST tanpa
    transaksi). Kalau langkah kedua gagal, bahan tetap ada dengan stok 0 —
    dan itu keadaan yang benar, bukan rusak: pengguna tinggal mengisi
    stok lewat pembelian atau opname. Kegagalannya dikembalikan sebagai
    peringatan supaya tidak diam-diam dianggap berhasil.
  */
  const r = await db<Bahan[]>("bahan", {
    method: "POST",
    prefer: "return=representation",
    q: "select=*",
    body: {
      nama,
      satuan,
      harga_satuan: rp(masuk.harga_satuan),
      stok_minimum: Number(masuk.stok_minimum ?? 0) || 0,
    },
  });
  if (!r.ok) return { ok: false, pesan: r.pesan };
  const bahan = r.data[0];

  const awal = Number(masuk.stok_awal ?? 0);
  if (awal > 0) {
    const g = await db("gerakan_stok", {
      method: "POST",
      body: {
        bahan_id: bahan.id,
        jenis: "awal",
        jumlah: awal,
        harga_satuan: bahan.harga_satuan,
        nilai: rp(awal * bahan.harga_satuan),
        oleh: masuk.oleh,
        catatan: "Stok awal saat bahan dibuat",
      },
    });
    if (!g.ok) {
      return {
        ok: false,
        pesan: `Bahan tersimpan, tetapi stok awalnya gagal dicatat (${g.pesan}). Isi lewat pembelian atau opname.`,
      };
    }
  }

  return { ok: true, data: bahan };
}

export async function ubahBahan(
  id: number,
  patch: Partial<Pick<Bahan, "nama" | "satuan" | "stok_minimum" | "aktif" | "catatan">>,
): Promise<Hasil<Bahan>> {
  /*
    `harga_satuan` SENGAJA tidak bisa diubah langsung.

    Harga hanya berubah lewat pembelian, karena hanya pembelian yang
    menyimpan alasan perubahan (supplier, tanggal, jumlah). Kalau harga
    bisa disunting langsung, HPP yang sudah terkunci di pesanan lama akan
    berbeda dari harga bahan sekarang tanpa ada dokumen yang menjelaskan —
    dan saat pemilik bertanya "kenapa HPP bulan ini beda", jawabannya tidak
    akan ada di mana pun.

    Untuk mengoreksi harga karena salah input, pakai pembelian koreksi.
  */
  if (!Object.keys(patch).length) return { ok: false, pesan: "Tidak ada yang diubah." };
  const r = await db<Bahan[]>("bahan", {
    method: "PATCH",
    prefer: "return=representation",
    q: `id=eq.${id}&select=*`,
    body: patch,
  });
  if (!r.ok) return { ok: false, pesan: r.pesan };
  if (!r.data[0]) return { ok: false, pesan: "Bahan tidak ditemukan." };
  return { ok: true, data: r.data[0] };
}

// ─────────────────────────────────────────────────────────────────────
// Resep
// ─────────────────────────────────────────────────────────────────────

export type BarisResepTampil = {
  bahan_id: number;
  nama: string;
  satuan: string;
  jumlah: number;
  harga_satuan: number;
  biaya: number;
  perkiraan: boolean;
};

/**
 * Resep satu menu + HPP satu porsinya.
 *
 * `hpp` = 0 dan `lengkap = false` bila ada bahan tanpa harga. Menu tanpa
 * resep mengembalikan daftar kosong dengan `lengkap = false` — bukan galat,
 * karena memang belum diisi.
 */
export async function resepMenu(menuId: number): Promise<
  Hasil<{ baris: BarisResepTampil[]; hpp: number; lengkap: boolean; perkiraan: boolean }>
> {
  const [resepRes, bahanRes] = await Promise.all([
    db<{ bahan_id: number; jumlah: number; perkiraan: boolean }[]>("resep_menu", {
      q: `select=bahan_id,jumlah,perkiraan&menu_id=eq.${menuId}`,
    }),
    db<Bahan[]>("bahan", { q: "select=*" }),
  ]);
  if (!resepRes.ok) return { ok: false, pesan: resepRes.pesan };
  if (!bahanRes.ok) return { ok: false, pesan: bahanRes.pesan };

  const peta = new Map(bahanRes.data.map((b) => [b.id, b]));
  const baris: BarisResepTampil[] = resepRes.data.map((r) => {
    const b = peta.get(r.bahan_id);
    return {
      bahan_id: r.bahan_id,
      nama: b?.nama ?? `Bahan #${r.bahan_id}`,
      satuan: b?.satuan ?? "",
      jumlah: Number(r.jumlah),
      harga_satuan: b?.harga_satuan ?? 0,
      biaya: rp(Number(r.jumlah) * (b?.harga_satuan ?? 0)),
      perkiraan: r.perkiraan,
    };
  });

  const lengkap = baris.length > 0 && baris.every((b) => b.harga_satuan > 0);
  return {
    ok: true,
    data: {
      baris,
      hpp: baris.reduce((n, b) => n + b.biaya, 0),
      lengkap,
      perkiraan: baris.some((b) => b.perkiraan),
    },
  };
}

/**
 * Simpan resep satu menu — MENGGANTI seluruh isinya.
 *
 * Mengganti, bukan menambah: resep yang disunting di layar adalah daftar
 * lengkap. Kalau baris yang dihapus di layar tidak ikut terhapus di
 * database, bahan yang sudah tidak dipakai tetap terpotong setiap kali
 * menu itu terjual — dan stok akan menyusut tanpa penjelasan.
 */
export async function simpanResep(
  menuId: number,
  baris: { bahan_id: number; jumlah: number; perkiraan?: boolean }[],
): Promise<Hasil<{ jumlah: number }>> {
  const bersih = baris.filter((b) => Number(b.jumlah) > 0);
  for (const b of bersih) {
    if (!Number.isFinite(b.jumlah) || b.jumlah <= 0) {
      return { ok: false, pesan: "Jumlah bahan harus lebih dari 0." };
    }
  }

  const hapus = await db("resep_menu", { method: "DELETE", q: `menu_id=eq.${menuId}` });
  if (!hapus.ok) return { ok: false, pesan: hapus.pesan };

  if (bersih.length === 0) return { ok: true, data: { jumlah: 0 } };

  const tulis = await db("resep_menu", {
    method: "POST",
    body: bersih.map((b) => ({
      menu_id: menuId,
      bahan_id: b.bahan_id,
      jumlah: Number(b.jumlah),
      // Default `perkiraan` mengikuti aturan database (true). Resep yang
      // diketik manusia lewat layar dianggap sudah diverifikasi.
      perkiraan: b.perkiraan ?? false,
    })),
  });
  if (!tulis.ok) {
    /*
      Kalau POST gagal setelah DELETE berhasil, menu ini kehilangan seluruh
      resepnya. Itu lebih baik daripada resep setengah jadi (sebagian bahan
      terpotong, sebagian tidak), tetapi pengguna HARUS tahu.
    */
    return {
      ok: false,
      pesan: `Resep lama sudah dihapus tetapi resep baru gagal disimpan (${tulis.pesan}). Isi ulang resep menu ini.`,
    };
  }
  return { ok: true, data: { jumlah: bersih.length } };
}

/** HPP satu porsi seluruh menu, untuk tab HPP di admin. */
export async function hppSemuaMenu(): Promise<
  Hasil<
    {
      menu_id: number;
      nama: string;
      harga: number;
      hpp: number;
      laba: number;
      persen: number | null;
      lengkap: boolean;
      perkiraan: boolean;
      jumlah_bahan: number;
    }[]
  >
> {
  const [menuRes, resepRes, bahanRes] = await Promise.all([
    db<{ id: number; nama: string; harga: number }[]>("menu", {
      q: "select=id,nama,harga&order=nama.asc",
    }),
    db<{ menu_id: number; bahan_id: number; jumlah: number; perkiraan: boolean }[]>("resep_menu", {
      q: "select=menu_id,bahan_id,jumlah,perkiraan",
    }),
    db<Bahan[]>("bahan", { q: "select=id,harga_satuan" }),
  ]);
  if (!menuRes.ok) return { ok: false, pesan: menuRes.pesan };
  if (!resepRes.ok) return { ok: false, pesan: resepRes.pesan };
  if (!bahanRes.ok) return { ok: false, pesan: bahanRes.pesan };

  const harga = new Map(bahanRes.data.map((b) => [b.id, b.harga_satuan]));
  const perMenu = new Map<number, { biaya: number; kosong: boolean; perkiraan: boolean; n: number }>();

  for (const r of resepRes.data) {
    const k = perMenu.get(r.menu_id) ?? { biaya: 0, kosong: false, perkiraan: false, n: 0 };
    const h = harga.get(r.bahan_id) ?? 0;
    if (h <= 0) k.kosong = true;
    k.biaya += rp(Number(r.jumlah) * h);
    k.n += 1;
    if (r.perkiraan) k.perkiraan = true;
    perMenu.set(r.menu_id, k);
  }

  return {
    ok: true,
    data: menuRes.data.map((m) => {
      const k = perMenu.get(m.id);
      const hpp = k?.biaya ?? 0;
      const { laba, persen } = marginKotor(m.harga, hpp);
      return {
        menu_id: m.id,
        nama: m.nama,
        harga: m.harga,
        hpp,
        laba,
        persen,
        // Menu tanpa resep BUKAN "lengkap dengan HPP 0" — tanpaResep jelas
        // belum bisa dihitung dan harus tampil berbeda.
        lengkap: !!k && k.n > 0 && !k.kosong,
        perkiraan: k?.perkiraan ?? false,
        jumlah_bahan: k?.n ?? 0,
      };
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Pembelian
// ─────────────────────────────────────────────────────────────────────

export type Pembelian = {
  id: number;
  nomor: string;
  supplier: string;
  no_nota: string;
  total: number;
  dibayar: boolean;
  catatan: string;
  oleh: string;
  dibeli_at: string;
};

export type PembelianItem = {
  id: number;
  pembelian_id: number;
  bahan_id: number;
  jumlah: number;
  harga_satuan: number;
};

/**
 * Catat pembelian: dokumen + item + gerakan stok + harga rata-rata baru.
 *
 * ── URUTAN YANG DIPAKAI ─────────────────────────────────────────────
 *
 *  1. dokumen pembelian (nomor unik — ini yang mencegah pencatatan ganda)
 *  2. item
 *  3. gerakan stok per bahan
 *  4. harga rata-rata bahan diperbarui
 *
 * Kalau langkah mana pun gagal, pembelian sudah tercatat dan bisa
 * diperbaiki manual. Yang TIDAK boleh terjadi adalah kebalikannya: stok
 * naik tetapi tidak ada dokumen yang menjelaskan dari mana.
 */
export async function catatPembelian(masuk: {
  supplier: string;
  no_nota?: string;
  item: { bahan_id: number; jumlah: number; harga_satuan: number }[];
  dibayar?: boolean;
  catatan?: string;
  oleh: string;
  dibeli_at?: string;
}): Promise<Hasil<{ pembelian: Pembelian; diperbarui: number }>> {
  const supplier = masuk.supplier.trim();
  if (!supplier) return { ok: false, pesan: "Nama supplier wajib diisi." };
  const item = masuk.item.filter((i) => Number(i.jumlah) > 0);
  if (item.length === 0) return { ok: false, pesan: "Pembelian harus berisi minimal satu bahan." };
  for (const i of item) {
    if (!Number.isFinite(i.harga_satuan) || i.harga_satuan < 0) {
      return { ok: false, pesan: "Harga satuan tidak sah." };
    }
  }

  const total = item.reduce((n, i) => n + rp(Number(i.jumlah) * i.harga_satuan), 0);
  const nomor = `BLI-${Date.now().toString(36).toUpperCase()}`;

  const dok = await db<Pembelian[]>("pembelian", {
    method: "POST",
    prefer: "return=representation",
    q: "select=*",
    body: {
      nomor,
      supplier,
      no_nota: (masuk.no_nota ?? "").trim(),
      total,
      dibayar: masuk.dibayar ?? true,
      catatan: masuk.catatan ?? "",
      oleh: masuk.oleh,
      ...(masuk.dibeli_at ? { dibeli_at: masuk.dibeli_at } : {}),
    },
  });
  if (!dok.ok) {
    // 23505 pada indeks (supplier, no_nota) = nota ini sudah pernah dicatat.
    if (/duplicate|23505/i.test(dok.pesan)) {
      return {
        ok: false,
        pesan: `Nota "${masuk.no_nota}" dari ${supplier} sudah pernah dicatat.`,
      };
    }
    return { ok: false, pesan: dok.pesan };
  }
  const pembelian = dok.data[0];

  const tulisItem = await db<PembelianItem[]>("pembelian_item", {
    method: "POST",
    prefer: "return=representation",
    q: "select=*",
    body: item.map((i) => ({
      pembelian_id: pembelian.id,
      bahan_id: i.bahan_id,
      jumlah: Number(i.jumlah),
      harga_satuan: rp(i.harga_satuan),
    })),
  });
  if (!tulisItem.ok) {
    return {
      ok: false,
      pesan: `Pembelian ${nomor} tercatat tetapi itemnya gagal disimpan (${tulisItem.pesan}). Stok belum bertambah.`,
    };
  }

  /*
    Satu gerakan per bahan — kalau satu nota memuat bahan yang sama dua
    kali (pembelian dua batch dengan harga beda), keduanya digabung setelah
    harga rata-ratanya dihitung, supaya gerakan stok tidak bercabang dua
    untuk bahan yang sama di nota yang sama.
  */
  const perBahan = new Map<number, { jumlah: number; nilai: number }>();
  for (const i of item) {
    const k = perBahan.get(i.bahan_id) ?? { jumlah: 0, nilai: 0 };
    k.jumlah += Number(i.jumlah);
    k.nilai += rp(Number(i.jumlah) * i.harga_satuan);
    perBahan.set(i.bahan_id, k);
  }

  const semuaBahan = await db<Bahan[]>("bahan", { q: "select=*" });
  if (!semuaBahan.ok) {
    return { ok: false, pesan: `Pembelian ${nomor} tercatat, tetapi bahan gagal dibaca (${semuaBahan.pesan}).` };
  }
  const saldo = await saldoPerBahan(semuaBahan.data.map((b) => b.id));
  if (!saldo.ok) {
    return { ok: false, pesan: `Pembelian ${nomor} tercatat, tetapi saldo stok gagal dibaca (${saldo.pesan}).` };
  }

  const gerakan: Record<string, unknown>[] = [];
  const perubahanHarga: { id: number; harga: number }[] = [];

  for (const [bahan_id, k] of perBahan) {
    const bahan = semuaBahan.data.find((b) => b.id === bahan_id);
    if (!bahan) continue;
    const hargaMasuk = rp(k.nilai / k.jumlah);
    const stokLama = saldo.data.get(bahan_id) ?? 0;
    const hargaBaru = hargaRataRataBaru(stokLama, bahan.harga_satuan, k.jumlah, hargaMasuk);
    perubahanHarga.push({ id: bahan_id, harga: hargaBaru });

    gerakan.push({
      bahan_id,
      jenis: "beli",
      jumlah: k.jumlah,
      harga_satuan: hargaMasuk,
      nilai: k.nilai,
      pembelian_id: pembelian.id,
      oleh: masuk.oleh,
      catatan: `${supplier}${masuk.no_nota ? ` · nota ${masuk.no_nota}` : ""}`,
    });
  }

  const geser = await db("gerakan_stok", { method: "POST", body: gerakan });
  if (!geser.ok) {
    return {
      ok: false,
      pesan: `Pembelian ${nomor} dan itemnya tercatat, tetapi stok gagal diperbarui (${geser.pesan}). Catat ulang lewat opname.`,
    };
  }

  /*
    Harga rata-rata diperbarui SETELAH gerakan stok tersimpan.

    Urutan ini penting: kalau harga diperbarui lebih dulu lalu penyimpanan
    gerakan gagal, harga bahan akan mencerminkan pembelian yang tidak ada
    di buku besar. Dengan urutan ini, kegagalan paling buruk membuat harga
    tertinggal satu pembelian — dan itu bisa dikoreksi tanpa menyentuh
    riwayat stok.
  */
  let diperbarui = 0;
  for (const p of perubahanHarga) {
    const r = await db("bahan", { method: "PATCH", q: `id=eq.${p.id}`, body: { harga_satuan: p.harga } });
    if (r.ok) diperbarui += 1;
  }

  return { ok: true, data: { pembelian, diperbarui } };
}

/** Saldo stok per bahan — dipakai internal. */
export async function saldoPerBahan(ids?: number[]): Promise<Hasil<Map<number, number>>> {
  const q = ids?.length
    ? `select=bahan_id,jumlah&bahan_id=in.(${ids.join(",")})`
    : "select=bahan_id,jumlah";
  const r = await db<{ bahan_id: number; jumlah: number }[]>("gerakan_stok", { q });
  if (!r.ok) return { ok: false, pesan: r.pesan };
  const peta = new Map<number, number>();
  for (const g of r.data) {
    peta.set(g.bahan_id, (peta.get(g.bahan_id) ?? 0) + Number(g.jumlah));
  }
  return { ok: true, data: peta };
}

export async function daftarPembelian(batas = 30): Promise<Hasil<Pembelian[]>> {
  return db<Pembelian[]>("pembelian", { q: `select=*&order=dibeli_at.desc&limit=${batas}` });
}

// ─────────────────────────────────────────────────────────────────────
// Opname, buang, dan gerakan stok
// ─────────────────────────────────────────────────────────────────────

export async function catatGerakan(masuk: {
  bahan_id: number;
  jenis: "opname" | "buang" | "awal";
  jumlah: number;
  catatan?: string;
  oleh: string;
}): Promise<Hasil<{ jumlah: number; nilai: number }>> {
  if (!Number.isFinite(masuk.jumlah) || masuk.jumlah === 0) {
    return { ok: false, pesan: "Jumlah harus angka dan tidak boleh 0." };
  }
  const b = await db<Bahan[]>("bahan", { q: `select=*&id=eq.${masuk.bahan_id}&limit=1` });
  if (!b.ok) return { ok: false, pesan: b.pesan };
  if (!b.data[0]) return { ok: false, pesan: "Bahan tidak ditemukan." };

  const g = await db("gerakan_stok", {
    method: "POST",
    body: {
      bahan_id: masuk.bahan_id,
      jenis: masuk.jenis,
      jumlah: masuk.jumlah,
      harga_satuan: b.data[0].harga_satuan,
      nilai: Math.abs(nilaiOpname(masuk.jumlah, b.data[0].harga_satuan)),
      catatan: masuk.catatan ?? "",
      oleh: masuk.oleh,
    },
  });
  if (!g.ok) return { ok: false, pesan: g.pesan };
  return {
    ok: true,
    data: {
      jumlah: masuk.jumlah,
      nilai: Math.abs(nilaiOpname(masuk.jumlah, b.data[0].harga_satuan)),
    },
  };
}

/**
 * Opname: catat hasil hitung fisik, tulis selisihnya sebagai gerakan.
 *
 * `fisik` adalah angka absolut hasil hitung di gudang, bukan selisih.
 * Pengguna mengetik "tinggal 2,5 kg", bukan "-1,5 kg" — meminta selisih
 * berarti meminta orang menghitung di kepalanya, dan itu sumber salah
 * input yang paling sering terjadi pada opname.
 */
export async function opname(
  bahanId: number,
  fisik: number,
  oleh: string,
  catatan = "",
): Promise<Hasil<{ tercatat: number; fisik: number; selisih: number; nilai: number }>> {
  if (!Number.isFinite(fisik) || fisik < 0) {
    return { ok: false, pesan: "Jumlah fisik tidak sah." };
  }
  const b = await db<Bahan[]>("bahan", { q: `select=*&id=eq.${bahanId}&limit=1` });
  if (!b.ok) return { ok: false, pesan: b.pesan };
  if (!b.data[0]) return { ok: false, pesan: "Bahan tidak ditemukan." };

  const saldo = await saldoPerBahan([bahanId]);
  if (!saldo.ok) return { ok: false, pesan: saldo.pesan };
  const tercatat = Math.round((saldo.data.get(bahanId) ?? 0) * 1000) / 1000;
  const selisih = selisihOpname(tercatat, fisik);

  if (selisih === 0) {
    // Tidak ada selisih = tidak ada yang perlu dicatat. Menulis gerakan
    // bernilai 0 akan membuat buku besar penuh baris tanpa arti.
    return { ok: true, data: { tercatat, fisik, selisih: 0, nilai: 0 } };
  }

  const g = await db("gerakan_stok", {
    method: "POST",
    body: {
      bahan_id: bahanId,
      jenis: "opname",
      jumlah: selisih,
      harga_satuan: b.data[0].harga_satuan,
      nilai: Math.abs(nilaiOpname(selisih, b.data[0].harga_satuan)),
      catatan: catatan || `Opname: tercatat ${tercatat}, fisik ${fisik}`,
      oleh,
    },
  });
  if (!g.ok) return { ok: false, pesan: g.pesan };

  return {
    ok: true,
    data: { tercatat, fisik, selisih, nilai: Math.abs(nilaiOpname(selisih, b.data[0].harga_satuan)) },
  };
}

export type BarisBukuBesar = {
  id: number;
  bahan_id: number;
  bahan: string;
  satuan: string;
  jenis: string;
  jumlah: number;
  harga_satuan: number;
  nilai: number;
  catatan: string;
  oleh: string;
  dibuat_at: string;
};

/** Riwayat gerakan stok — buku besar. */
export async function riwayatStok(batas = 60, bahanId?: number): Promise<Hasil<BarisBukuBesar[]>> {
  const filter = bahanId ? `&bahan_id=eq.${bahanId}` : "";
  const [g, b] = await Promise.all([
    db<Omit<BarisBukuBesar, "bahan" | "satuan">[]>("gerakan_stok", {
      q: `select=*&order=dibuat_at.desc&limit=${batas}${filter}`,
    }),
    db<Bahan[]>("bahan", { q: "select=id,nama,satuan" }),
  ]);
  if (!g.ok) return { ok: false, pesan: g.pesan };
  if (!b.ok) return { ok: false, pesan: b.pesan };
  const peta = new Map(b.data.map((x) => [x.id, x]));
  return {
    ok: true,
    data: g.data.map((x) => ({
      ...x,
      bahan: peta.get(x.bahan_id)?.nama ?? `Bahan #${x.bahan_id}`,
      satuan: peta.get(x.bahan_id)?.satuan ?? "",
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// POTONG STOK — satu-satunya pintu
// ─────────────────────────────────────────────────────────────────────

export type HasilPotong = {
  /** True bila pemotongan baru saja dilakukan; false bila sudah pernah. */
  baru: boolean;
  hpp: number;
  lengkap: boolean;
  /** Bahan yang harganya belum ada — HPP-nya tidak bisa dipercaya penuh. */
  hargaKosong: string[];
  /** Menu yang belum punya resep. */
  tanpaResep: string[];
  pesan: string;
};

/**
 * Potong stok untuk satu pesanan yang BARU LUNAS, lalu kunci HPP-nya.
 *
 * ── TITIK PANGGIL ───────────────────────────────────────────────────
 *
 * Dipanggil dari `tandaiLunas` (DOKU) dan `bayarTunaiKasir` (kasir) —
 * dua jalur pembayaran yang ada. TIDAK dipanggil dari `buatPesanan`:
 * pesanan yang belum dibayar belum boleh menggerakkan stok, karena
 * pesanan yang ditolak atau kedaluwarsa tidak pernah menghasilkan
 * makanan. Ini keputusan pemilik: potong saat lunas.
 *
 * ── IDEMPOTEN ───────────────────────────────────────────────────────
 *
 * Kalau `hpp_pesanan` sudah punya baris untuk item ini, tidak ada yang
 * dikerjakan. Itu yang membuat notifikasi DOKU ganda, atau kasir menekan
 * tombol bayar dua kali, tidak memotong stok dua kali.
 *
 * ── KENAPA TIDAK PERNAH MELEMPAR ────────────────────────────────────
 *
 * Pemanggilnya adalah jalur pembayaran. Uang sudah diterima; melempar
 * galat di sini akan membuat pembayaran tampak gagal dan kasir mengulang.
 * Semua kegagalan dikembalikan sebagai `pesan`.
 */
export async function potongStokPesanan(
  pesananId: number,
  oleh: string,
): Promise<Hasil<HasilPotong>> {
  const itemRes = await db<{ id: number; menu_id: number | null; jumlah: number }[]>("item_pesanan", {
    q: `select=id,menu_id,jumlah&pesanan_id=eq.${pesananId}`,
  });
  if (!itemRes.ok) return { ok: false, pesan: itemRes.pesan };
  if (itemRes.data.length === 0) {
    return {
      ok: true,
      data: { baru: false, hpp: 0, lengkap: false, hargaKosong: [], tanpaResep: [], pesan: "Pesanan tanpa item." },
    };
  }

  // Sudah pernah dipotong? Berhenti di sini — inilah penjaga idempotennya.
  const sudah = await db<{ item_id: number }[]>("hpp_pesanan", {
    q: `select=item_id&pesanan_id=eq.${pesananId}`,
  });
  if (!sudah.ok) return { ok: false, pesan: sudah.pesan };
  if (sudah.data.length > 0) {
    return {
      ok: true,
      data: {
        baru: false,
        hpp: 0,
        lengkap: true,
        hargaKosong: [],
        tanpaResep: [],
        pesan: "Stok pesanan ini sudah dipotong sebelumnya.",
      },
    };
  }

  const menuIds = [
    ...new Set(itemRes.data.map((i) => i.menu_id).filter((x): x is number => typeof x === "number")),
  ];

  const [resepRes, bahanRes, menuRes] = await Promise.all([
    menuIds.length
      ? db<{ menu_id: number; bahan_id: number; jumlah: number }[]>("resep_menu", {
          q: `select=menu_id,bahan_id,jumlah&menu_id=in.(${menuIds.join(",")})`,
        })
      : Promise.resolve({ ok: true as const, data: [] }),
    db<Bahan[]>("bahan", { q: "select=id,nama,harga_satuan" }),
    menuIds.length
      ? db<{ id: number; nama: string }[]>("menu", { q: `select=id,nama&id=in.(${menuIds.join(",")})` })
      : Promise.resolve({ ok: true as const, data: [] }),
  ]);
  if (!resepRes.ok) return { ok: false, pesan: resepRes.pesan };
  if (!bahanRes.ok) return { ok: false, pesan: bahanRes.pesan };
  if (!menuRes.ok) return { ok: false, pesan: menuRes.pesan };

  const resepPerMenu = new Map<number, BarisResep[]>();
  for (const r of resepRes.data) {
    const arr = resepPerMenu.get(r.menu_id) ?? [];
    arr.push({ bahan_id: r.bahan_id, jumlah: Number(r.jumlah) });
    resepPerMenu.set(r.menu_id, arr);
  }
  const hargaPerBahan = new Map(bahanRes.data.map((b) => [b.id, b.harga_satuan]));
  const namaBahan = new Map(bahanRes.data.map((b) => [b.id, b.nama]));
  const namaMenu = new Map(menuRes.data.map((m) => [m.id, m.nama]));

  const baris: BarisPesanan[] = itemRes.data.map((i) => ({ menu_id: i.menu_id, jumlah: i.jumlah }));
  const kebutuhan = kebutuhanBahan(baris, resepPerMenu, hargaPerBahan);

  // 1. HPP per baris pesanan.
  //
  // Dihitung dari kebutuhan SELURUH pesanan lalu dibagi per item sesuai
  // porsinya. Menghitung per item satu per satu akan membulatkan setiap
  // baris dan membuat jumlahnya tidak sama dengan total di buku besar.
  const hppPesanan: Record<string, unknown>[] = [];
  for (const i of itemRes.data) {
    if (i.menu_id == null) continue;
    const resep = resepPerMenu.get(i.menu_id) ?? [];
    const pakaiItem = resep.map((r) => ({
      bahan_id: r.bahan_id,
      jumlah: r.jumlah,
      harga_satuan: hargaPerBahan.get(r.bahan_id) ?? 0,
    }));
    const hppSatuan = totalHpp(pakaiItem);
    hppPesanan.push({
      pesanan_id: pesananId,
      item_id: i.id,
      menu_id: i.menu_id,
      jumlah: i.jumlah,
      hpp_satuan: hppSatuan,
      hpp_total: hppSatuan * i.jumlah,
      lengkap: resep.length > 0 && pakaiItem.every((p) => p.harga_satuan > 0),
    });
  }
  if (hppPesanan.length > 0) {
    const tulis = await db("hpp_pesanan", { method: "POST", body: hppPesanan });
    if (!tulis.ok) return { ok: false, pesan: `HPP gagal dicatat: ${tulis.pesan}` };
  }

  // 2. Gerakan stok keluar.
  if (kebutuhan.pakai.length > 0) {
    const geser = await db(
      "gerakan_stok",
      { method: "POST", body: kebutuhan.pakai.map((p) => ({
        bahan_id: p.bahan_id,
        jenis: "pakai",
        // NEGATIF: stok keluar. Tanda disimpan di data, bukan di logika
        // pembacaan, supaya saldo = SUM(jumlah) tanpa pengecualian.
        jumlah: -p.jumlah,
        harga_satuan: p.harga_satuan,
        nilai: nilaiPakai(p),
        pesanan_id: pesananId,
        oleh,
        catatan: `Pesanan #${pesananId}`,
      })) },
    );
    if (!geser.ok) {
      return { ok: false, pesan: `HPP tercatat, tetapi stok gagal dipotong: ${geser.pesan}` };
    }
  }

  return {
    ok: true,
    data: {
      baru: true,
      hpp: hppPesanan.reduce((n, h) => n + Number(h.hpp_total), 0),
      lengkap: kebutuhan.lengkap,
      hargaKosong: kebutuhan.hargaKosong.map((id) => namaBahan.get(id) ?? `#${id}`),
      tanpaResep: kebutuhan.tanpaResep.map((id) => namaMenu.get(id) ?? `#${id}`),
      pesan: "",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// HPP & laba per hari — menyambung ke omzet
// ─────────────────────────────────────────────────────────────────────

export type HppHarian = {
  /** Tanggal WIB, "YYYY-MM-DD". */
  tanggal: string;
  omzet: number;
  hpp: number;
  laba: number;
  persen: number | null;
  /** HPP dari baris yang resepnya belum lengkap — angka ini UNDER-estimasi. */
  hppTidakLengkap: number;
};

/**
 * Omzet, HPP, dan laba untuk rentang tanggal (WIB).
 *
 * ── OMZET DARI `tagihan`, HPP DARI `hpp_pesanan` ────────────────────
 *
 * Keduanya sengaja tidak diambil dari tabel yang sama. Omzet adalah uang
 * yang ditagih (sudah termasuk pajak & layanan); HPP adalah biaya bahan.
 * Menghitung omzet dari item akan kehilangan pajak dan layanan, dan
 * membuat margin terlihat lebih tipis daripada kenyataan.
 *
 * ── YANG TIDAK DIHITUNG ─────────────────────────────────────────────
 *
 * Biaya tenaga kerja, listrik, sewa, dan penyusutan TIDAK masuk HPP.
 * Yang dihitung hanya bahan. Karena itu labelnya "laba kotor", bukan
 * "laba" — menampilkannya sebagai laba bersih akan membuat pemilik
 * mengira angkanya sudah final.
 */
export async function hppHarian(sejakIso: string): Promise<Hasil<HppHarian[]>> {
  const [tagihanRes, hppRes] = await Promise.all([
    db<{ total: number; ditutup_at: string | null; status: string }[]>("tagihan", {
      q: `select=total,ditutup_at,status&status=eq.lunas&ditutup_at=gte.${encodeURIComponent(sejakIso)}&limit=2000`,
    }),
    db<{ hpp_total: number; lengkap: boolean; dibuat_at: string }[]>("hpp_pesanan", {
      q: `select=hpp_total,lengkap,dibuat_at&dibuat_at=gte.${encodeURIComponent(sejakIso)}&limit=5000`,
    }),
  ]);
  if (!tagihanRes.ok) return { ok: false, pesan: tagihanRes.pesan };
  if (!hppRes.ok) return { ok: false, pesan: hppRes.pesan };

  /*
    Pengelompokan per tanggal WIB memakai fungsi yang SAMA dengan
    ringkasan penjualan (`awalHariIni`). Kalau di sini dipakai `toISOString`
    mentah, laporan HPP dan laporan omzet akan berbeda satu hari untuk
    transaksi setelah pukul 17.00 UTC — dan itu terjadi setiap malam.
  */
  const per: Record<string, { omzet: number; hpp: number; tidakLengkap: number }> = {};
  const kunci = (iso: string) => tanggalWib(iso);

  for (const t of tagihanRes.data) {
    if (!t.ditutup_at) continue;
    const k = kunci(t.ditutup_at);
    per[k] = per[k] ?? { omzet: 0, hpp: 0, tidakLengkap: 0 };
    per[k].omzet += t.total;
  }
  for (const h of hppRes.data) {
    const k = kunci(h.dibuat_at);
    per[k] = per[k] ?? { omzet: 0, hpp: 0, tidakLengkap: 0 };
    per[k].hpp += h.hpp_total;
    if (!h.lengkap) per[k].tidakLengkap += h.hpp_total;
  }

  return {
    ok: true,
    data: Object.entries(per)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([tanggal, v]) => {
        const { laba, persen } = marginKotor(v.omzet, v.hpp);
        return { tanggal, omzet: v.omzet, hpp: v.hpp, laba, persen, hppTidakLengkap: v.tidakLengkap };
      }),
  };
}

/** Tanggal WIB "YYYY-MM-DD" dari ISO UTC. Offset tetap +07:00. */
export function tanggalWib(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "?";
  const geser = new Date(t.getTime() + 7 * 60 * 60 * 1000);
  return geser.toISOString().slice(0, 10);
}
