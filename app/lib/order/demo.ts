/**
 * Mode demo.
 *
 * Kenapa ada: kunci server Supabase (service role) TIDAK boleh ditulis di
 * repo, dan sesi ini tidak memilikinya. Tanpa kunci itu, menulis pesanan
 * akan ditolak RLS. Dua pilihan buruk: (a) halaman error, atau (b) diam-diam
 * membuka hak tulis ke anon — yang berarti siapa pun bisa mengubah pesanan
 * orang lain.
 *
 * Yang dipilih: mode demo yang JUJUR. Menu tetap dibaca dari database asli
 * (aman, publik), tetapi pesanan yang dibuat hanya hidup di memori server
 * dan halaman menampilkan pemberitahuan jelas. Jadi pemilik bisa mencoba
 * seluruh alur, dan tidak ada yang mengira data ini tersimpan.
 */

import { transisiSah } from "./data";
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
} from "./tipe";
import { hitungTagihan, ATURAN_BAWAAN, nomorPesanan } from "./aturan";

const g = globalThis as unknown as {
  __demoOrder?: {
    pesanan: Pesanan[];
    items: ItemPesanan[];
    tagihan: Tagihan[];
    panggilan: Panggilan[];
    meja: Meja[];
    urutPesanan: number;
    urutItem: number;
    urutTagihan: number;
    urutPanggilan: number;
    /**
     * Menu yang diedit saat mode demo. Disimpan di store yang sama dengan
     * pesanan supaya kasir bisa mencoba alur "tandai habis → pelanggan
     * melihat Habis" tanpa database. MENU_CONTOH sendiri tidak diubah:
     * itu daftar bawaan, bukan data.
     */
    menu: Map<number, boolean>;
  };
};

function toko() {
  if (!g.__demoOrder) {
    g.__demoOrder = {
      pesanan: [],
      items: [],
      tagihan: [],
      panggilan: [],
      meja: Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        nomor: String(i + 1),
        area: i < 8 ? "teras" : i < 16 ? "taman" : "tepi sungai",
        aktif: true,
        status: "kosong" as const,
        kapasitas: 4,
      })),
      urutPesanan: 1,
      urutItem: 1,
      urutTagihan: 1,
      urutPanggilan: 1,
      menu: new Map<number, boolean>(),
    };
  }
  return g.__demoOrder;
}

/** Menu contoh dipakai hanya bila database tidak bisa dibaca sama sekali. */
export const MENU_CONTOH: { kategori: KategoriMenu[]; menu: Menu[] } = {
  kategori: [
    { id: 1, nama: "Pembuka", urutan: 1 },
    { id: 2, nama: "Menu Utama", urutan: 2 },
    { id: 3, nama: "Camilan", urutan: 3 },
    { id: 4, nama: "Kopi", urutan: 4 },
    { id: 5, nama: "Non-Kopi", urutan: 5 },
    { id: 6, nama: "Pencuci Mulut", urutan: 6 },
  ],
  menu: [
    { id: 1, nama: "Harira", deskripsi: "Sup tomat dan kacang lentil khas Maroko, disajikan hangat.", harga: 28000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 1 },
    { id: 2, nama: "Briouat Keju", deskripsi: "Pastri segitiga berisi keju, digoreng renyah.", harga: 32000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 2 },
    { id: 3, nama: "Tajine Ayam", deskripsi: "Ayam dimasak lambat dengan zaitun dan lemon asin.", harga: 68000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 1 },
    { id: 4, nama: "Couscous Maroko", deskripsi: "Bulgur gandum dengan sayur musiman dan kuah rempah.", harga: 62000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 2 },
    { id: 5, nama: "Nasi Mandi Kambing", deskripsi: "Nasi rempah dengan kambing panggang perlahan.", harga: 85000, kategori_id: 2, foto_url: null, tersedia: false, urutan: 3 },
    { id: 6, nama: "Kentang Harra", deskripsi: "Kentang goreng dengan bumbu pedas Maroko.", harga: 25000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 1 },
    { id: 7, nama: "Roti Msemen", deskripsi: "Roti lipat berlapis, disajikan dengan madu dan mentega.", harga: 22000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 2 },
    { id: 8, nama: "Kopi Mint", deskripsi: "Espresso dengan daun mint segar.", harga: 26000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 1 },
    { id: 9, nama: "Kopi Susu Nabawi", deskripsi: "Kopi susu gula aren, disajikan dingin.", harga: 28000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 2 },
    { id: 10, nama: "Teh Mint", deskripsi: "Teh hijau dengan mint segar, manis.", harga: 20000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 1 },
    { id: 11, nama: "Jus Jeruk Segar", deskripsi: "Jeruk peras tanpa gula tambahan.", harga: 24000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 2 },
    { id: 12, nama: "Air Mineral", deskripsi: "Botol 600 ml.", harga: 10000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 3 },
    { id: 13, nama: "Chebakia", deskripsi: "Kue wijen dan madu khas Ramadan.", harga: 18000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 1 },
    { id: 14, nama: "Pastilla Susu", deskripsi: "Pastri berisi krim susu dan almond.", harga: 30000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 2 },
  ],
};

export function demoBuatPesanan(masuk: {
  meja: string;
  sesi: string;
  nama: string | null;
  items: { menu_id: number; jumlah: number; catatan: string | null }[];
  menu: Menu[];
}) {
  const t = toko();
  const meja = t.meja.find((m) => m.nomor === masuk.meja);
  if (!meja) return { ok: false as const, pesan: "Nomor meja tidak dikenali." };

  const peta = new Map(masuk.menu.map((m) => [m.id, m]));

  // Menu yang ditandai habis harus ditolak di sini juga. Tanpa pemeriksaan
  // ini mode demo menerima menu habis, sehingga perilakunya berbeda dari
  // mode sungguhan dan bug seperti itu lolos dari pengujian.
  for (const it of masuk.items) {
    const mnu = peta.get(it.menu_id);
    if (mnu && !mnu.tersedia) {
      return { ok: false as const, pesan: `${mnu.nama} sedang habis. Hapus dari keranjang.` };
    }
  }
  const itemFinal = masuk.items.map((i) => {
    const m = peta.get(i.menu_id);
    return {
      id: t.urutItem++,
      pesanan_id: 0,
      menu_id: i.menu_id,
      nama_saat_pesan: m?.nama ?? `Menu ${i.menu_id}`,
      jumlah: i.jumlah,
      harga_satuan: m?.harga ?? 0,
      catatan: i.catatan,
    };
  });

  const pesanan: Pesanan = {
    id: t.urutPesanan++,
    nomor: `${nomorPesanan(meja.nomor)}-D${t.urutPesanan}`,
    meja_id: meja.id,
    status: "menunggu_konfirmasi",
    nama_pemesan: masuk.nama,
    sesi_id: masuk.sesi,
    alasan_tolak: null,
    alasan_batal: null,
    total_item: itemFinal.reduce((n, i) => n + i.jumlah, 0),
    created_at: new Date().toISOString(),
    diterima_at: null,
    diproses_at: null,
    siap_at: null,
    diantar_at: null,
  };

  for (const it of itemFinal) it.pesanan_id = pesanan.id;
  t.pesanan.push(pesanan);
  t.items.push(...itemFinal);
  meja.status = "ada_pesanan";

  let tagihan = t.tagihan.find((x) => x.meja_id === meja.id && x.status !== "lunas");
  if (!tagihan) {
    tagihan = {
      id: t.urutTagihan++,
      meja_id: meja.id,
      status: "terbuka",
      subtotal: 0,
      layanan: 0,
      pajak: 0,
      pembulatan: 0,
      total: 0,
      dibuka_at: new Date().toISOString(),
      ditutup_at: null,
      kasir: null,
    };
    t.tagihan.push(tagihan);
  }

  const subtotal = t.items
    .filter((i) => {
      const p = t.pesanan.find((x) => x.id === i.pesanan_id);
      return p?.meja_id === meja.id && p.status !== "ditolak" && p.status !== "dibatalkan";
    })
    .reduce((n, i) => n + i.jumlah * i.harga_satuan, 0);

  const r = hitungTagihan(subtotal, ATURAN_BAWAAN);
  Object.assign(tagihan, r, { id: tagihan.id, meja_id: meja.id });

  return { ok: true as const, pesanan, items: itemFinal, tagihan };
}

export function demoAmbilPesanan(sesi?: string) {
  const t = toko();
  return sesi ? t.pesanan.filter((p) => p.sesi_id === sesi) : t.pesanan;
}

/**
 * Item satu tagihan meja, digabung per menu+harga — sama seperti
 * ambilItemTagihan di jalur database. Dipakai struk di mode demo.
 */
export function demoItemTagihan(mejaId: number) {
  const t = toko();
  const pesananSah = new Set(
    t.pesanan
      .filter((p) => p.meja_id === mejaId && p.status !== "ditolak" && p.status !== "dibatalkan")
      .map((p) => p.id)
  );

  const peta = new Map<string, { nama: string; jumlah: number; harga_satuan: number; harga_baris: number }>();
  for (const i of t.items) {
    if (!pesananSah.has(i.pesanan_id)) continue;
    const kunci = `${i.nama_saat_pesan}|${i.harga_satuan}`;
    const ada = peta.get(kunci);
    if (ada) {
      ada.jumlah += i.jumlah;
      ada.harga_baris = ada.jumlah * ada.harga_satuan;
    } else {
      peta.set(kunci, {
        nama: i.nama_saat_pesan,
        jumlah: i.jumlah,
        harga_satuan: i.harga_satuan,
        harga_baris: i.jumlah * i.harga_satuan,
      });
    }
  }
  return [...peta.values()];
}

/** Item milik satu pesanan — dipakai portal dapur & pelayan. */
export function demoItemPesanan(pesananId: number) {
  return toko().items.filter((i) => i.pesanan_id === pesananId);
}

export function demoUbahStatus(id: number, ke: StatusPesanan, alasan?: string) {
  const t = toko();
  const p = t.pesanan.find((x) => x.id === id);
  if (!p) return { ok: false as const, pesan: "Pesanan tidak ditemukan." };

  // Aturan transisi HARUS sama dengan jalur database. Kalau mode demo
  // membiarkan semua perpindahan, bug alur (mis. pelayan mengantar pesanan
  // yang belum siap) hanya akan muncul di produksi — persis tempat yang
  // paling mahal untuk menemukannya.
  if (!transisiSah(p.status, ke)) {
    return {
      ok: false as const,
      pesan: `Status tidak bisa berpindah dari ${p.status} ke ${ke}.`,
    };
  }

  p.status = ke;
  const sekarang = new Date().toISOString();
  if (ke === "diterima") p.diterima_at = sekarang;
  if (ke === "diproses") p.diproses_at = sekarang;
  if (ke === "siap") p.siap_at = sekarang;
  if (ke === "diantar") p.diantar_at = sekarang;
  if (ke === "ditolak") p.alasan_tolak = alasan ?? "Tidak disebutkan";
  if (ke === "dibatalkan") p.alasan_batal = alasan ?? null;
  return { ok: true as const, pesanan: p };
}

export function demoPanggilan(mejaId: number, jenis: "pelayan" | "bill") {
  const t = toko();
  // Panggilan yang sama tidak boleh menumpuk (sama seperti mode sungguhan).
  const ada = t.panggilan.find(
    (g) => g.meja_id === mejaId && g.jenis === jenis && !g.ditangani_at
  );
  if (ada) return ada;

  const p: Panggilan = {
    id: t.urutPanggilan++,
    meja_id: mejaId,
    jenis,
    dibuat_at: new Date().toISOString(),
    ditangani_at: null,
  };
  t.panggilan.push(p);
  const meja = t.meja.find((m) => m.id === mejaId);
  if (meja && jenis === "bill") meja.status = "minta_bill";
  return p;
}

export function demoBayar(tagihanId: number, metode: MetodeBayar, diterima: number, kasir: string) {
  const t = toko();
  const tag = t.tagihan.find((x) => x.id === tagihanId);
  if (!tag) return { ok: false as const, pesan: "Tagihan tidak ditemukan." };
  if (tag.status === "lunas") return { ok: false as const, pesan: "Tagihan sudah lunas." };
  tag.status = "lunas";
  tag.ditutup_at = new Date().toISOString();
  tag.kasir = kasir;
  const meja = t.meja.find((m) => m.id === tag.meja_id);
  if (meja) meja.status = "kosong";

  // Panggilan yang belum ditangani milik meja ini harus ditutup. Kalau
  // tidak, kartu "Meja 12 minta bill" tetap menggantung di portal pelayan
  // setelah tamu membayar dan pergi — pelayan akan mendatangi meja kosong.
  const sekarang = new Date().toISOString();
  for (const g of t.panggilan) {
    if (g.meja_id === tag.meja_id && !g.ditangani_at) g.ditangani_at = sekarang;
  }

  return { ok: true as const, tagihan: tag, metode, diterima };
}

export function demoMeja() {
  return toko().meja;
}

/** Terapkan penandaan habis/tersedia dari mode demo ke daftar menu. */
export function demoMenuDenganStatus(daftar: Menu[]): Menu[] {
  const ubah = toko().menu;
  return daftar.map((m) => (ubah.has(m.id) ? { ...m, tersedia: ubah.get(m.id)! } : m));
}

export function demoSetTersedia(menuId: number, tersedia: boolean) {
  toko().menu.set(menuId, tersedia);
}

export function demoTagihan() {
  return toko().tagihan.map((t) => ({
    ...t,
    meja_nomor: toko().meja.find((m) => m.id === t.meja_id)?.nomor ?? "",
  }));
}

export function demoPanggilanSemua() {
  return toko().panggilan;
}

export function demoReset() {
  delete (globalThis as unknown as { __demoOrder?: unknown }).__demoOrder;
}
