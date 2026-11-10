/**
 * Lapisan data pesanan: baca menu, buat pesanan, ubah status, tagihan.
 *
 * Setiap fungsi mengembalikan hasil yang bisa gagal (bukan melempar
 * exception), sesuai PRD bagian 4: sinyal di area terbuka tidak selalu
 * kuat, jadi kegagalan harus ditangani sebagai keadaan biasa.
 */
import { db, PUNYA_KUNCI_SERVER } from "./db";
import {
  ATURAN_BAWAAN,
  bacaPilihan,
  hitungTagihan,
  periksaPilihan,
  type AturanBiaya,
} from "./aturan";
import type {
  KategoriMenu,
  Menu,
  Meja,
  Pesanan,
  ItemPesanan,
  Tagihan,
  Panggilan,
  StatusPesanan,
  MetodeBayar,
  PilihanMenu,
} from "./tipe";
import { nomorPesanan } from "./aturan";

export type Hasil<T> = { ok: true; data: T } | { ok: false; pesan: string };

// ─────────────────────────────────────────────────────────────
// Menu
// ─────────────────────────────────────────────────────────────

export type MenuLengkap = {
  kategori: KategoriMenu[];
  menu: Menu[];
};

export async function ambilMenu(): Promise<Hasil<MenuLengkap>> {
  const [kat, mn] = await Promise.all([
    db<KategoriMenu[]>("kategori_menu", { q: "select=*&order=urutan.asc" }),
    db<Menu[]>("menu", { q: "select=*&order=urutan.asc" }),
  ]);

  if (!kat.ok) return { ok: false, pesan: kat.pesan };
  if (!mn.ok) return { ok: false, pesan: mn.pesan };

  return { ok: true, data: { kategori: kat.data, menu: mn.data } };
}

// ─────────────────────────────────────────────────────────────
// Meja
// ─────────────────────────────────────────────────────────────

export async function ambilMeja(nomor?: string): Promise<Hasil<Meja | Meja[]>> {
  if (nomor !== undefined) {
    const r = await db<Meja[]>("meja", {
      q: `select=*&nomor=eq.${encodeURIComponent(nomor)}&aktif=eq.true&limit=1`,
    });
    if (!r.ok) return { ok: false, pesan: r.pesan };
    if (r.data.length === 0) return { ok: false, pesan: "Nomor meja tidak dikenali." };
    return { ok: true, data: r.data[0] };
  }
  const r = await db<Meja[]>("meja", { q: "select=*&order=nomor.asc" });
  if (!r.ok) return { ok: false, pesan: r.pesan };
  return { ok: true, data: r.data };
}

// ─────────────────────────────────────────────────────────────
// Pengaturan biaya
// ─────────────────────────────────────────────────────────────

export async function ambilAturan(): Promise<AturanBiaya> {
  const r = await db<{ kunci: string; nilai: string }[]>("pengaturan", {
    q: "select=kunci,nilai",
  });
  if (!r.ok) return ATURAN_BAWAAN;

  const peta = new Map(r.data.map((x) => [x.kunci, x.nilai]));
  const angka = (k: string, cadangan: number) => {
    const v = Number(peta.get(k));
    return Number.isFinite(v) ? v : cadangan;
  };

  return {
    pajakPersen: angka("pajak_persen", ATURAN_BAWAAN.pajakPersen),
    layananPersen: angka("layanan_persen", ATURAN_BAWAAN.layananPersen),
    layananRp: angka("layanan_rp", ATURAN_BAWAAN.layananRp),
    pembulatan: angka("pembulatan", ATURAN_BAWAAN.pembulatan),
  };
}

// ─────────────────────────────────────────────────────────────
// Buat pesanan
// ─────────────────────────────────────────────────────────────

export type ItemTersimpan = ItemPesanan;

export type HasilBuatPesanan = {
  pesanan: Pesanan;
  items: ItemTersimpan[];
  tagihan: Tagihan;
  /**
   * true bila biaya layanan tidak ditagihkan karena tagihan ini sudah
   * punya biaya layanan dari pesanan sebelumnya di meja yang sama.
   */
  layananSudahAda: boolean;
};

/**
 * Simpan pesanan pelanggan.
 *
 * URUTAN YANG PENTING:
 * 1. Ambil meja. Nomor meja divalidasi ke database, bukan dipercaya dari QR.
 * 2. Ambil menu yang diminta, lalu pakai HARGA DARI DATABASE. Harga kiriman
 *    browser diabaikan sepenuhnya.
 * 3. Tolak item yang ditandai habis.
 * 4. Pastikan ada tagihan terbuka untuk meja ini (open bill). Kalau belum,
 *    buat. Satu meja satu tagihan — dijaga indeks unik di database, jadi
 *    dua pesanan bersamaan tidak bisa menghasilkan dua tagihan.
 * 5. Simpan pesanan + item, lalu hitung ulang tagihan dari SEMUA pesanan
 *    aktif di meja itu (bukan hanya yang baru), agar pesanan tambahan
 *    otomatis menambah bill yang sama.
 */
export async function buatPesanan(masuk: {
  meja: string;
  sesi: string;
  nama: string | null;
  items: { menu_id: number; jumlah: number; catatan: string | null; pilihan: string[] }[];
}): Promise<Hasil<HasilBuatPesanan>> {
  if (!PUNYA_KUNCI_SERVER) {
    return {
      ok: false,
      pesan:
        "Mode demo: pesanan tidak bisa disimpan karena kunci server database belum dipasang.",
    };
  }

  // 1. Meja
  const meja = await ambilMeja(masuk.meja);
  if (!meja.ok) return meja;
  const m = meja.data as Meja;

  // 2. Menu + harga resmi
  const ids = [...new Set(masuk.items.map((i) => i.menu_id))];
  const menuRes = await db<Menu[]>("menu", {
    q: `select=*&id=in.(${ids.join(",")})`,
  });
  if (!menuRes.ok) return { ok: false, pesan: menuRes.pesan };

  const petaMenu = new Map(menuRes.data.map((x) => [x.id, x]));

  const itemFinal: {
    menu_id: number;
    nama_saat_pesan: string;
    jumlah: number;
    harga_satuan: number;
    catatan: string | null;
    pilihan: PilihanMenu[];
  }[] = [];

  for (const it of masuk.items) {
    const mnu = petaMenu.get(it.menu_id);
    if (!mnu) {
      return { ok: false, pesan: `Ada menu yang tidak dikenal (id ${it.menu_id}).` };
    }
    // 3. Item habis ditolak di server juga, bukan hanya disembunyikan di layar.
    if (!mnu.tersedia) {
      return { ok: false, pesan: `${mnu.nama} sedang habis. Hapus dari keranjang.` };
    }

    /*
      3b. Pilihan (sambal / saus / rasa).

      Browser hanya mengirim NAMA opsi. Tambahan harganya diambil dari sini,
      dari database, lalu dijumlahkan ke harga_satuan. Kalau kiriman browser
      dipercaya, siapa pun bisa mengirim {"nama":"Black Pepper","tambah":0}
      dan makan Wagyu dengan harga dasar — tidak ada yang menahannya karena
      total tagihan hanya menjumlahkan isi item_pesanan.
    */
    const pilihanMenu = bacaPilihan(mnu.pilihan);
    const cekP = periksaPilihan(pilihanMenu, it.pilihan);
    if (!cekP.ok) {
      return { ok: false, pesan: `${mnu.nama}: ${cekP.pesan}` };
    }

    itemFinal.push({
      menu_id: mnu.id,
      nama_saat_pesan: mnu.nama,
      jumlah: it.jumlah,
      harga_satuan: mnu.harga + cekP.tambah,
      catatan: it.catatan,
      pilihan: cekP.pilihan,
    });
  }

  // 4. Tagihan terbuka untuk meja ini
  const tagihanAda = await db<Tagihan[]>("tagihan", {
    q: `select=*&meja_id=eq.${m.id}&status=neq.lunas&limit=1`,
  });
  if (!tagihanAda.ok) return { ok: false, pesan: tagihanAda.pesan };

  let tagihan: Tagihan;
  if (tagihanAda.data.length > 0) {
    tagihan = tagihanAda.data[0];
  } else {
    const baru = await db<Tagihan[]>("tagihan", {
      method: "POST",
      prefer: "return=representation",
      q: "select=*",
      body: { meja_id: m.id, status: "terbuka" },
    });
    if (!baru.ok) return { ok: false, pesan: baru.pesan };
    tagihan = baru.data[0];
  }

  /*
    5. Pesanan + item.

    Nomor pesanan WAJIB unik (ada unique index pada kolom nomor). Dulu
    nomornya hanya M{meja}-{jam}{menit}, jadi dua tamu di meja yang sama
    yang menambah pesanan dalam menit yang sama menghasilkan nomor identik
    dan INSERT-nya ditolak database — pesanan kedua hilang tanpa penjelasan.
    Sekarang ditambahkan dua digit acak, dan bila toh bentrok, dicoba ulang
    sekali dengan angka baru sebelum menyerah.
  */
  let pesananRes: Hasil<Pesanan[]> = { ok: false, pesan: "belum dicoba" };
  let nomor = nomorPesanan(m.nomor);
  for (let percobaan = 0; percobaan < 2; percobaan++) {
    pesananRes = await db<Pesanan[]>("pesanan", {
      method: "POST",
      prefer: "return=representation",
      q: "select=*",
      body: {
        nomor,
        meja_id: m.id,
        status: "menunggu_konfirmasi",
        nama_pemesan: masuk.nama,
        sesi_id: masuk.sesi,
        total_item: itemFinal.reduce((n, i) => n + i.jumlah, 0),
      },
    });
    if (pesananRes.ok) break;
    // 23505 = unique violation. Selain itu tidak ada gunanya mengulang.
    if (!/duplicate|23505/i.test(pesananRes.pesan)) break;
    nomor = nomorPesanan(m.nomor);
  }
  if (!pesananRes.ok) {
    /*
      Pesan mentah Postgres ("duplicate key value violates unique
      constraint") tidak berarti apa pun bagi tamu. Yang penting: tamu tahu
      pesanannya BELUM masuk, dan tidak menekan Kirim berkali-kali.
    */
    return {
      ok: false,
      pesan:
        "Pesanan belum tersimpan karena ada gangguan sesaat. Coba tekan Kirim sekali lagi.",
    };
  }
  const pesanan = pesananRes.data[0];

  const itemRes = await db<ItemPesanan[]>("item_pesanan", {
    method: "POST",
    prefer: "return=representation",
    q: "select=*",
    body: itemFinal.map((i) => ({ ...i, pesanan_id: pesanan.id })),
  });
  if (!itemRes.ok) return { ok: false, pesan: itemRes.pesan };

  // Tandai meja ada pesanan
  await db("meja", {
    method: "PATCH",
    q: `id=eq.${m.id}`,
    body: { status: "ada_pesanan" },
  });

  const tagihanBaru = await hitungUlangTagihan(m.id, tagihan.id);
  if (!tagihanBaru.ok) return { ok: false, pesan: tagihanBaru.pesan };

  return {
    ok: true,
    data: {
      pesanan,
      items: itemRes.data,
      tagihan: tagihanBaru.data,
      layananSudahAda: false,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Hitung ulang tagihan
// ─────────────────────────────────────────────────────────────

/**
 * Hitung tagihan dari semua pesanan yang tidak ditolak/dibatalkan.
 *
 * Biaya layanan hanya dikenakan SEKALI per tagihan, bukan per pesanan.
 * Kalau dikenakan per pesanan, pelanggan yang menambah minuman di tengah
 * makan akan ditagih biaya layanan dua kali — itu keluhan yang pasti muncul.
 */
export async function hitungUlangTagihan(
  mejaId: number,
  tagihanId: number
): Promise<Hasil<Tagihan>> {
  const pesananRes = await db<{ id: number }[]>("pesanan", {
    q: `select=id&meja_id=eq.${mejaId}&status=not.in.(ditolak,dibatalkan)&status=not.is.null`,
  });
  if (!pesananRes.ok) return { ok: false, pesan: pesananRes.pesan };

  const ids = pesananRes.data.map((p) => p.id);
  let subtotal = 0;

  if (ids.length > 0) {
    const itemRes = await db<{ jumlah: number; harga_satuan: number }[]>("item_pesanan", {
      q: `select=jumlah,harga_satuan&pesanan_id=in.(${ids.join(",")})`,
    });
    if (!itemRes.ok) return { ok: false, pesan: itemRes.pesan };
    subtotal = itemRes.data.reduce((n, i) => n + i.jumlah * i.harga_satuan, 0);
  }

  const aturan = await ambilAturan();
  const r = hitungTagihan(subtotal, aturan);

  const upd = await db<Tagihan[]>("tagihan", {
    method: "PATCH",
    prefer: "return=representation",
    q: `id=eq.${tagihanId}&select=*`,
    body: {
      subtotal: r.subtotal,
      layanan: r.layanan,
      pajak: r.pajak,
      pembulatan: r.pembulatan,
      total: r.total,
    },
  });
  if (!upd.ok) return { ok: false, pesan: upd.pesan };
  return { ok: true, data: upd.data[0] };
}

// ─────────────────────────────────────────────────────────────
// Status pesanan
// ─────────────────────────────────────────────────────────────

/** Urutan maju yang sah. Mencegah "Diantar" melompat dari "Menunggu konfirmasi". */
export const URUTAN_STATUS: StatusPesanan[] = [
  "menunggu_konfirmasi",
  "diterima",
  "diproses",
  "siap",
  "diantar",
];

export function transisiSah(dari: StatusPesanan, ke: StatusPesanan): boolean {
  if (dari === ke) return false;
  // Status akhir: tidak bisa berpindah lagi sama sekali.
  if (dari === "diantar" || dari === "ditolak" || dari === "dibatalkan") return false;

  // DUA jalur keluar selain maju satu langkah:
  //  a) Ditolak — HANYA dari "menunggu_konfirmasi". Setelah kasir menerima,
  //     pesanan sudah masuk dapur; membatalkannya harus lewat pembatalan
  //     supaya alasannya tercatat dan dapur tahu harus berhenti.
  //  b) Dibatalkan — hanya sebelum "diproses". Setelah dapur mulai memasak,
  //     pembatalan berarti makanan terbuang; itu keputusan kasir/pemilik
  //     lewat alur tersendiri, bukan tombol pelanggan.
  if (ke === "ditolak") return dari === "menunggu_konfirmasi";
  if (ke === "dibatalkan") {
    return dari === "menunggu_konfirmasi" || dari === "diterima";
  }

  const iDari = URUTAN_STATUS.indexOf(dari);
  const iKe = URUTAN_STATUS.indexOf(ke);
  if (iDari === -1 || iKe === -1) return false;

  // Maju tepat satu langkah saja. Tidak boleh melompat dari "diterima"
  // langsung ke "siap": pelanggan akan melihat status yang tidak pernah
  // benar-benar terjadi, dan dapur kehilangan penanda "sedang dikerjakan".
  return iKe === iDari + 1;
}

const KOLOM_WAKTU: Partial<Record<StatusPesanan, string>> = {
  diterima: "diterima_at",
  diproses: "diproses_at",
  siap: "siap_at",
  diantar: "diantar_at",
};

export async function ubahStatus(
  pesananId: number,
  ke: StatusPesanan,
  opsi: { alasan?: string; oleh?: string } = {}
): Promise<Hasil<Pesanan>> {
  const ada = await db<Pesanan[]>("pesanan", { q: `select=*&id=eq.${pesananId}&limit=1` });
  if (!ada.ok) return { ok: false, pesan: ada.pesan };
  if (ada.data.length === 0) return { ok: false, pesan: "Pesanan tidak ditemukan." };

  const p = ada.data[0];
  if (!transisiSah(p.status, ke)) {
    return {
      ok: false,
      pesan: `Tidak bisa memindahkan pesanan dari "${p.status}" ke "${ke}".`,
    };
  }

  const patch: Record<string, unknown> = { status: ke };
  const kolom = KOLOM_WAKTU[ke];
  if (kolom) patch[kolom] = new Date().toISOString();
  if (ke === "ditolak") patch.alasan_tolak = opsi.alasan ?? "Tidak disebutkan";
  if (ke === "dibatalkan") patch.alasan_batal = opsi.alasan ?? null;

  const upd = await db<Pesanan[]>("pesanan", {
    method: "PATCH",
    prefer: "return=representation",
    q: `id=eq.${pesananId}&select=*`,
    body: patch,
  });
  if (!upd.ok) return { ok: false, pesan: upd.pesan };

  // Catat di log bila ada yang membatalkan/menolak (PRD bagian 13: log).
  if (ke === "ditolak" || ke === "dibatalkan") {
    await db("log_perubahan", {
      method: "POST",
      body: {
        siapa: opsi.oleh ?? "sistem",
        aksi: ke,
        entitas: "pesanan",
        entitas_id: String(pesananId),
        sebelum: { status: p.status },
        sesudah: { status: ke, alasan: patch.alasan_tolak ?? patch.alasan_batal ?? null },
      },
    });
  }

  return { ok: true, data: upd.data[0] };
}

// ─────────────────────────────────────────────────────────────
// Panggilan meja
// ─────────────────────────────────────────────────────────────

export async function buatPanggilan(
  mejaId: number,
  jenis: "pelayan" | "bill"
): Promise<Hasil<Panggilan>> {
  const res = await db<Panggilan[]>("panggilan", {
    method: "POST",
    prefer: "return=representation",
    q: "select=*",
    body: { meja_id: mejaId, jenis },
  });
  if (!res.ok) return { ok: false, pesan: res.pesan };

  // Minta bill sekaligus mengubah status meja, supaya kasir melihatnya
  // di denah tanpa harus membuka daftar panggilan.
  if (jenis === "bill") {
    await db("meja", { method: "PATCH", q: `id=eq.${mejaId}`, body: { status: "minta_bill" } });
    await db("tagihan", {
      method: "PATCH",
      q: `meja_id=eq.${mejaId}&status=eq.terbuka`,
      body: { status: "minta_bill" },
    });
  }

  return { ok: true, data: res.data[0] };
}

// ─────────────────────────────────────────────────────────────
// Pembayaran
// ─────────────────────────────────────────────────────────────

export async function catatPembayaran(masuk: {
  tagihan_id: number;
  metode: MetodeBayar;
  diterima: number;
  kasir: string;
}): Promise<Hasil<{ tagihan: Tagihan }>> {
  const t = await db<Tagihan[]>("tagihan", {
    q: `select=*&id=eq.${masuk.tagihan_id}&limit=1`,
  });
  if (!t.ok) return { ok: false, pesan: t.pesan };
  if (t.data.length === 0) return { ok: false, pesan: "Tagihan tidak ditemukan." };

  const tagihan = t.data[0];
  if (tagihan.status === "lunas") {
    return { ok: false, pesan: "Tagihan ini sudah lunas." };
  }

  const bayar = await db("pembayaran", {
    method: "POST",
    body: {
      tagihan_id: tagihan.id,
      metode: masuk.metode,
      diterima: Math.round(masuk.diterima),
      kembalian:
        masuk.metode === "tunai" ? Math.max(0, Math.round(masuk.diterima - tagihan.total)) : 0,
      kasir: masuk.kasir,
    },
  });
  if (!bayar.ok) return { ok: false, pesan: bayar.pesan };

  const upd = await db<Tagihan[]>("tagihan", {
    method: "PATCH",
    prefer: "return=representation",
    q: `id=eq.${tagihan.id}&select=*`,
    body: {
      status: "lunas",
      ditutup_at: new Date().toISOString(),
      kasir: masuk.kasir,
    },
  });
  if (!upd.ok) return { ok: false, pesan: upd.pesan };

  // Meja kembali kosong setelah kasir menutupnya (PRD K-11).
  await db("meja", {
    method: "PATCH",
    q: `id=eq.${tagihan.meja_id}`,
    body: { status: "kosong" },
  });

  // Panggilan yang belum ditangani milik meja ini ikut ditutup. Tanpa ini,
  // kartu "minta bill" tetap menggantung di portal pelayan setelah tamu
  // membayar dan pergi — pelayan mendatangi meja yang sudah kosong.
  await db("panggilan", {
    method: "PATCH",
    q: `meja_id=eq.${tagihan.meja_id}&ditangani_at=is.null`,
    body: { ditangani_at: new Date().toISOString() },
  });

  return { ok: true, data: { tagihan: upd.data[0] } };
}

// ─────────────────────────────────────────────────────────────
// Item per tagihan (untuk struk)
// ─────────────────────────────────────────────────────────────

export type BarisStruk = {
  nama: string;
  /** Opsi yang dipilih; kosong bila menu tidak punya pilihan. */
  pilihan?: PilihanMenu[];
  jumlah: number;
  /** Sudah termasuk tambahan pilihan. */
  harga_satuan: number;
  /** nama, jumlah, harga satuan, harga baris (PRD bagian 11). */
  harga_baris: number;
};

/**
 * Semua item yang termasuk dalam satu tagihan sebuah meja.
 *
 * Dipakai struk (K-10). Struk baru bisa dicetak SETELAH tagihan lunas, dan
 * saat itu pesanan sudah tidak masuk daftar aktif — jadi item tidak bisa
 * lagi diambil dari /api/order/kasir. Karena itu server mengirimkannya
 * bersama tagihan.
 *
 * Pesanan yang ditolak/dibatalkan tidak dihitung, sama seperti
 * hitungUlangTagihan, supaya jumlah baris struk selalu cocok dengan
 * subtotalnya.
 */
export async function ambilItemTagihan(mejaId: number): Promise<Hasil<BarisStruk[]>> {
  const pesananRes = await db<{ id: number }[]>("pesanan", {
    q: `select=id&meja_id=eq.${mejaId}&status=not.in.(ditolak,dibatalkan)`,
  });
  if (!pesananRes.ok) return { ok: false, pesan: pesananRes.pesan };

  const ids = pesananRes.data.map((p) => p.id);
  if (ids.length === 0) return { ok: true, data: [] };

  const itemRes = await db<ItemPesanan[]>("item_pesanan", {
    q: `select=*&pesanan_id=in.(${ids.join(",")})&order=id.asc`,
  });
  if (!itemRes.ok) return { ok: false, pesan: itemRes.pesan };

  /*
    Item dengan menu yang sama digabung menjadi satu baris. Kalau tidak,
    struk tamu yang memesan 2 kopi di awal lalu 1 kopi lagi di tengah makan
    akan menampilkan dua baris "Kopi Mint" — lebih sulit dicocokkan dengan
    yang diingat tamu, dan mudah disangka tagihan ganda. Harga satuan
    dipakai dari item pertama; dalam satu tagihan harganya sama karena
    harga dikunci saat dipesan.
  */
  const peta = new Map<string, BarisStruk>();
  for (const i of itemRes.data) {
    /*
      Pilihan ikut masuk kunci penggabungan. Dua Rice Bowl dengan saus
      berbeda tetapi tambahan harga yang sama akan tergabung kalau kuncinya
      hanya nama+harga — struk lalu menampilkan "2× Rice Bowl" padahal
      dapurnya mengerjakan dua rasa. Nama pilihan diurutkan supaya
      urutannya tidak memengaruhi penggabungan.
    */
    const pilihan = bacaPilihan(i.pilihan);
    const labelPilihan = pilihan
      .map((p) => p.nama)
      .sort()
      .join(",");
    const kunci = `${i.nama_saat_pesan}|${i.harga_satuan}|${labelPilihan}`;
    const ada = peta.get(kunci);
    if (ada) {
      ada.jumlah += i.jumlah;
      ada.harga_baris = ada.jumlah * ada.harga_satuan;
    } else {
      peta.set(kunci, {
        nama: i.nama_saat_pesan,
        pilihan,
        jumlah: i.jumlah,
        harga_satuan: i.harga_satuan,
        harga_baris: i.jumlah * i.harga_satuan,
      });
    }
  }

  return { ok: true, data: [...peta.values()] };
}

// ─────────────────────────────────────────────────────────────
// Pembacaan untuk portal internal
// ─────────────────────────────────────────────────────────────

export type PesananDenganItem = Pesanan & { items: ItemPesanan[]; meja_nomor: string };

export async function ambilPesananAktif(): Promise<Hasil<PesananDenganItem[]>> {
  const res = await db<Pesanan[]>("pesanan", {
    q: "select=*&status=in.(menunggu_konfirmasi,diterima,diproses,siap)&order=created_at.asc",
  });
  if (!res.ok) return { ok: false, pesan: res.pesan };
  if (res.data.length === 0) return { ok: true, data: [] };

  const ids = res.data.map((p) => p.id);
  const items = await db<ItemPesanan[]>("item_pesanan", {
    q: `select=*&pesanan_id=in.(${ids.join(",")})`,
  });
  if (!items.ok) return { ok: false, pesan: items.pesan };

  const mejaIds = [...new Set(res.data.map((p) => p.meja_id))];
  const mejaRes = await db<{ id: number; nomor: string }[]>("meja", {
    q: `select=id,nomor&id=in.(${mejaIds.join(",")})`,
  });
  if (!mejaRes.ok) return { ok: false, pesan: mejaRes.pesan };
  const petaMeja = new Map(mejaRes.data.map((m) => [m.id, m.nomor]));

  const petaItem = new Map<number, ItemPesanan[]>();
  for (const it of items.data) {
    const daftar = petaItem.get(it.pesanan_id) ?? [];
    daftar.push(it);
    petaItem.set(it.pesanan_id, daftar);
  }

  return {
    ok: true,
    data: res.data.map((p) => ({
      ...p,
      items: petaItem.get(p.id) ?? [],
      meja_nomor: petaMeja.get(p.meja_id) ?? String(p.meja_id),
    })),
  };
}
