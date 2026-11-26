/**
 * Lapisan data pesanan: baca menu, buat pesanan, ubah status, tagihan.
 *
 * Setiap fungsi mengembalikan hasil yang bisa gagal (bukan melempar
 * exception), sesuai PRD bagian 4: sinyal di area terbuka tidak selalu
 * kuat, jadi kegagalan harus ditangani sebagai keadaan biasa.
 */
import { db, punyaKunciServer } from "./db";
import { potongStokPesanan } from "./stok";
import {
  ATURAN_BAWAAN,
  bacaPilihan,
  hitungTagihan,
  pembayaranCukup,
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
  StatusPesanan,
  MetodeBayar,
  PilihanMenu,
} from "./tipe";
import { nomorPesanan } from "./aturan";

export type Hasil<T> = { ok: true; data: T } | { ok: false; pesan: string };

// ─────────────────────────────────────────────────────────────
// Menu, meja, pengaturan — PINDAH ke katalog.ts
// ─────────────────────────────────────────────────────────────

/*
  Menu, meja, dan pengaturan biaya sekarang tinggal di satu pintu:
  `app/lib/order/katalog.ts`. Alasan pemindahan ada di berkas itu —
  ringkasnya: satu tempat untuk "dari mana data ini datang" jauh lebih
  mudah dijaga daripada definisi yang tersebar.

  Diekspor ulang di sini supaya pemanggil lama (rute API, halaman) tidak
  perlu diubah sekaligus, dan supaya hanya ada SATU definisi `ambilMenu`.
*/
export {
  ambilAturan,
  ambilMeja,
  ambilMenu,
  bacaAturan,
} from "./katalog";
export type { MenuLengkap } from "./katalog";

// Dipakai juga DI DALAM berkas ini (buatPesanan, hitungTagihanPesanan), jadi
// perlu diimpor, bukan hanya diekspor ulang.
import { ambilAturan, ambilMeja } from "./katalog";

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
  /** Wajib — divalidasi di aturan.ts sebelum sampai ke sini. */
  nama: string;
  /** Sudah dinormalkan ke +62… */
  no_wa: string;
  items: { menu_id: number; jumlah: number; catatan: string | null; pilihan: string[] }[];
  /** Menit sampai pesanan dianggap kedaluwarsa bila belum dibayar. */
  batasBayarMenit: number;
  /**
   * Pilihan tamu: bayar online sekarang, atau bayar di kasir.
   *
   * Disimpan di `pesanan.metode_bayar` supaya kasir bisa MENGANTREKAN yang
   * memilih kasir, dan supaya laporan bisa menjawab "berapa persen tamu
   * membayar online" tanpa menebak.
   */
  metode_bayar: "online" | "kasir";
}): Promise<Hasil<HasilBuatPesanan>> {
  if (!punyaKunciServer()) {
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

  /*
    4. TAGIHAN PER PESANAN (bukan per meja).

    Dulu satu tagihan per meja, menumpuk, dibayar di akhir. Dengan
    prabayar, setiap checkout adalah transaksi tersendiri: tamu memesan 2
    item lalu bayar, 20 menit kemudian memesan lagi dan bayar lagi. Satu
    tagihan per meja tidak bisa mewakili dua pembayaran itu — dan biaya
    layanan akan terhitung ganda.
  */
  /*
    ── DIBUAT SETELAH PESANAN, BUKAN SEBELUMNYA ──────────────────────

    Sebelumnya tagihan dibuat DULU, lalu pesanan, lalu tagihan itu diisi.
    Akibatnya: kalau pembuatan pesanan gagal dengan sebab apa pun, yang
    tertinggal adalah TAGIHAN KOSONG — dan tamu melihat "pesanan gagal"
    tanpa satu pun baris pesanan yang bisa diperiksa kasir. Persis
    kegagalan yang dilaporkan pemilik: checkout tidak tersimpan, tidak ada
    di kasir, tidak ada di dapur, dan tidak ada jejak apa pun.

    Urutan yang dipakai sekarang:
      1. pesanan (tanpa tagihan_id)
      2. tagihan (per pesanan)
      3. pesanan.tagihan_id diisi
      4. item

    Kalau langkah 2 atau 3 gagal, pesanan SUDAH ada dan kelihatan kasir —
    lebih baik pesanan tanpa tagihan (bisa ditagih manual) daripada tamu
    yang menunggu makanan yang tidak pernah tercatat.

    Kebalikannya juga tidak benar: tagihan tidak boleh dibuat sebelum ada
    pesanan, karena tagihan tanpa pesanan = meja tertahan tanpa isi.
  */

  /*
    5. Pesanan + item.

    Nomor pesanan WAJIB unik (ada unique index pada kolom nomor). Dulu
    nomornya hanya M{meja}-{jam}{menit}, jadi dua tamu di meja yang sama
    yang menambah pesanan dalam menit yang sama menghasilkan nomor identik
    dan INSERT-nya ditolak database — pesanan kedua hilang tanpa penjelasan.
    Sekarang ditambahkan dua digit acak, dan bila toh bentrok, dicoba ulang
    sekali dengan angka baru sebelum menyerah.
  */
  const kedaluwarsa = new Date(Date.now() + masuk.batasBayarMenit * 60_000).toISOString();

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
        /*
          `status` TIDAK dikirim. Nilainya tetap 'menunggu_konfirmasi' dari
          default database — dan itu memang yang diinginkan saat pesanan
          lunas nanti.

          Kenapa tidak dikirim eksplisit: kalau suatu saat default database
          berubah, dua tempat akan berbeda pendapat tentang status awal
          sebuah pesanan, dan yang menang adalah yang tidak terlihat di
          kode ini. Membiarkannya di satu tempat (skema) membuat perubahan
          skema berlaku menyeluruh.

          Pesanan BELUM terlihat kasir maupun dapur pada titik ini. Yang
          membuatnya terlihat adalah `status_bayar` berubah menjadi 'lunas'
          (lihat tandaiLunas di doku.ts) — bukan status dapur.
        */
        status_bayar: "menunggu",
        kedaluwarsa_at: kedaluwarsa,
        /*
          `metode_bayar` di sini adalah PILIHAN TAMU, bukan kanal yang
          dipakai. Saat lunas, kolom yang sama ditimpa metode sebenarnya
          ("doku", "tunai") — jadi riwayat pilihan tamu hanya terbaca
          selagi pesanan belum lunas. Itu cukup: yang perlu diketahui
          kasir hanyalah pesanan mana yang menunggu uangnya.
        */
        metode_bayar: masuk.metode_bayar,
        nama_pemesan: masuk.nama,
        no_wa: masuk.no_wa,
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
  let pesanan = pesananRes.data[0];

  /*
    6. TAGIHAN — dibuat SESUDAH pesanan ada.

    Statusnya 'terbuka' dan totalnya masih 0; `hitungTagihanPesanan` di
    langkah 8 yang mengisinya dari item. Membuatnya lebih awal berarti
    tagihan kosong bisa tertinggal saat pembuatan pesanan gagal.
  */
  const tagihanBaru = await db<Tagihan[]>("tagihan", {
    method: "POST",
    prefer: "return=representation",
    q: "select=*",
    body: { meja_id: m.id, status: "terbuka" },
  });
  if (!tagihanBaru.ok) return { ok: false, pesan: tagihanBaru.pesan };
  const tagihan = tagihanBaru.data[0];

  /*
    Tautkan tagihan ke pesanan. Kegagalan di sini TIDAK membatalkan
    pesanan: pesanan sudah ada dan kasir bisa menagihnya manual. Yang
    dibatalkan hanya tautannya — dan itu dicatat supaya kelihatan.
  */
  const taut = await db<Pesanan[]>("pesanan", {
    method: "PATCH",
    prefer: "return=representation",
    q: `id=eq.${pesanan.id}&select=*`,
    body: { tagihan_id: tagihan.id },
  });
  if (taut.ok && taut.data[0]) pesanan = taut.data[0];
  else {
    const sebab = taut.ok ? "respons kosong" : taut.pesan;
    console.error("tagihan tidak bisa ditautkan ke pesanan", pesanan.id, sebab);
  }

  // 7. Item
  const itemRes = await db<ItemPesanan[]>("item_pesanan", {
    method: "POST",
    prefer: "return=representation",
    q: "select=*",
    body: itemFinal.map((i) => ({ ...i, pesanan_id: pesanan.id })),
  });
  if (!itemRes.ok) return { ok: false, pesan: itemRes.pesan };

  // Tandai meja ada pesanan (kasir melihat denah meja terisi).
  await db("meja", {
    method: "PATCH",
    q: `id=eq.${m.id}`,
    body: { status: "ada_pesanan" },
  });

  // 8. Hitung tagihan dari item yang baru disimpan.
  const hitung = await hitungTagihanPesanan(pesanan.id, tagihan.id);
  if (!hitung.ok) return { ok: false, pesan: hitung.pesan };

  return {
    ok: true,
    data: {
      pesanan,
      items: itemRes.data,
      tagihan: hitung.data,
      layananSudahAda: false,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Hitung ulang tagihan
// ─────────────────────────────────────────────────────────────

/**
 * Hitung tagihan DARI SATU PESANAN.
 *
 * Sebelumnya fungsi ini menjumlahkan semua pesanan aktif di satu MEJA.
 * Dengan tagihan per-pesanan, itu akan menagihkan pesanan lain ke tagihan
 * yang salah — tamu A membayar makanan tamu B.
 *
 * Biaya layanan dikenakan sekali per tagihan, dan karena sekarang satu
 * tagihan melayani satu pesanan, itu berarti sekali per pesanan. Itu
 * memang yang diinginkan: dua kali checkout adalah dua kali transaksi.
 */
export async function hitungTagihanPesanan(
  pesananId: number,
  tagihanId: number
): Promise<Hasil<Tagihan>> {
  /*
    ── PESANAN YANG DIBATALKAN/DITOLAK TIDAK MENAGIH APA PUN ──────────

    Ini bug yang tertangkap uji `bug-audit`, bukan sekadar kerapian.

    `statusPesanan()` MEMANG memanggil fungsi ini setelah menolak atau
    membatalkan pesanan — tujuannya supaya total di meja kasir ikut turun.
    Tetapi fungsi ini menjumlahkan SEMUA baris `item_pesanan` milik pesanan
    itu, tanpa melihat statusnya. Baris item tidak dihapus saat pesanan
    batal, jadi hasilnya: tagihan tetap Rp91.000 lengkap dengan biaya
    layanan dan pajak, padahal pesanannya sudah batal dan struknya kosong.

    Yang membuatnya berbahaya: kasir melihat angka, bukan riwayat. Tamu
    yang pesanannya dibatalkan bisa ditagih makanan yang tidak pernah
    dibuat.

    Jadi statusnya dibaca lebih dulu. Batal/tolak = tagihan nol, tanpa
    biaya layanan dan pajak (lihat `kosong` di bawah).
  */
  const pesananRes = await db<{ status: string }[]>("pesanan", {
    q: `select=status&id=eq.${pesananId}&limit=1`,
  });
  if (!pesananRes.ok) return { ok: false, pesan: pesananRes.pesan };

  const statusPesananIni = pesananRes.data[0]?.status ?? "";
  const batal = statusPesananIni === "dibatalkan" || statusPesananIni === "ditolak";

  const itemRes = await db<{ jumlah: number; harga_satuan: number }[]>("item_pesanan", {
    q: `select=jumlah,harga_satuan&pesanan_id=eq.${pesananId}`,
  });
  if (!itemRes.ok) return { ok: false, pesan: itemRes.pesan };

  const subtotal = batal
    ? 0
    : itemRes.data.reduce((n, i) => n + i.jumlah * i.harga_satuan, 0);

  /*
    PESANAN TANPA ITEM TIDAK BOLEH MENGHASILKAN TAGIHAN BERISI BIAYA.

    Kalau semua item gagal tersimpan, subtotal = 0 tetapi layanan tetap
    Rp2.000. Tamu lalu diminta membayar biaya layanan untuk pesanan kosong.
  */
  const aturan = await ambilAturan();
  const r = hitungTagihan(subtotal, aturan);
  const kosong = subtotal === 0;

  const upd = await db<Tagihan[]>("tagihan", {
    method: "PATCH",
    prefer: "return=representation",
    q: `id=eq.${tagihanId}&select=*`,
    body: {
      subtotal: r.subtotal,
      layanan: kosong ? 0 : r.layanan,
      pajak: kosong ? 0 : r.pajak,
      pembulatan: kosong ? 0 : r.pembulatan,
      total: kosong ? 0 : r.total,
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

    /*
      TAGIHAN WAJIB DIHITUNG ULANG.

      hitungTagihanPesanan hanya dipanggil saat pesanan DIBUAT. Akibatnya
      pesanan yang ditolak atau dibatalkan tetap menempel di tagihan: tamu
      yang memesan Rp46.600 lalu dibatalkan melihat tagihan Rp46.600 di
      meja kasir padahal struknya kosong. Kalau kasir menagihnya, tamu
      membayar makanan yang tidak pernah dibuat — dan kalau kasir
      menyadarinya, ia harus menghitung ulang secara manual.

      Kegagalan di sini TIDAK membatalkan perubahan status: status sudah
      tersimpan, dan menolak pesanan tetap lebih penting daripada tagihan
      yang benar. Selisihnya akan terlihat di layar kasir sebagai total
      yang tidak cocok dengan daftar item — lebih mudah ditemukan daripada
      pesanan yang statusnya tidak berubah.
    */
    /*
      Dengan tagihan per-pesanan, tagihan yang dihitung ulang adalah
      tagihan MILIK pesanan ini — bukan tagihan mana pun milik mejanya.
      Menghitung ulang tagihan tetangga akan mengubah total yang sedang
      dibayar orang lain.
    */
    if (p.tagihan_id) {
      await hitungTagihanPesanan(p.id, p.tagihan_id);
    }
  }

  return { ok: true, data: upd.data[0] };
}

// ─────────────────────────────────────────────────────────────
// Pembayaran
// ─────────────────────────────────────────────────────────────

export async function catatPembayaran(masuk: {
  tagihan_id: number;
  metode: MetodeBayar;
  diterima: number;
  kasir: string;
}): Promise<Hasil<{ tagihan: Tagihan; pesanan_id: number | null }>> {
  const t = await db<Tagihan[]>("tagihan", {
    q: `select=*&id=eq.${masuk.tagihan_id}&limit=1`,
  });
  if (!t.ok) return { ok: false, pesan: t.pesan };
  if (t.data.length === 0) return { ok: false, pesan: "Tagihan tidak ditemukan." };

  const tagihan = t.data[0];
  if (tagihan.status === "lunas") {
    return { ok: false, pesan: "Tagihan ini sudah lunas." };
  }

  /*
    Sejak tagihan per-pesanan, "lunas"-nya tagihan bukan lagi akhir cerita:
    kasir dan dapur menyaring lewat `pesanan.status_bayar`. Kalau baris ini
    tidak ikut diperbarui, uangnya sudah masuk tetapi pesanannya tetap
    tidak muncul di dapur — tamu membayar lalu menunggu selamanya.
  */
  const pesananTagihan = await db<Pesanan[]>("pesanan", {
    q: `select=*&tagihan_id=eq.${tagihan.id}`,
  });
  const belumLunas = (pesananTagihan.ok ? pesananTagihan.data : []).filter(
    (p) => p.status_bayar !== "lunas" && p.status !== "dibatalkan"
  );

  /*
    Pesanan yang ikut dilunasi dikembalikan ke pemanggil.

    Kasir membutuhkannya untuk membuka INVOICE PESANAN ITU setelah uang
    diterima. Tanpa id ini, layar kasir hanya tahu tagihannya — dan satu
    meja bisa berisi dua pesanan, jadi struk yang dibuka berisiko milik
    pesanan tetangga.
  */
  const pesananDilunasi = belumLunas[0]?.id ?? null;

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

  const kini = new Date().toISOString();
  for (const p of belumLunas) {
    await db("pesanan", {
      method: "PATCH",
      q: `id=eq.${p.id}`,
      /*
        Metode yang DIPILIH tamu ("kasir") dipertahankan; kanal sebenarnya
        (tunai / qris_kasir / kartu) tersimpan di baris `pembayaran`.

        Kenapa tidak ditimpa: pertanyaan yang muncul belakangan adalah
        "tamu memilih bayar di kasir atau online?", dan menimpanya dengan
        kanal menghapus jawaban itu. Kolom `pembayaran.metode` sudah
        menyimpan kanal dengan tepat.
      */
      body: { status_bayar: "lunas", dibayar_at: kini },
    });
  }

  // Meja kembali kosong setelah kasir menutupnya (PRD K-11).
  await db("meja", {
    method: "PATCH",
    q: `id=eq.${tagihan.meja_id}`,
    body: { status: "kosong" },
  });

  return { ok: true, data: { tagihan: upd.data[0], pesanan_id: pesananDilunasi } };
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
 * hitungTagihanPesanan, supaya jumlah baris struk selalu cocok dengan
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

/**
 * Pesanan yang boleh dilihat kasir dan dapur: HANYA YANG SUDAH LUNAS.
 *
 * Ini keputusan pemilik, dan konsekuensinya disengaja: pesanan yang belum
 * dibayar tidak muncul di dapur sama sekali. Kalau filter ini lupa
 * dipasang di salah satu portal, dapur akan memasak makanan yang belum
 * tentu dibayar — kerugian yang langsung terasa dan tidak bisa ditarik.
 */
export async function ambilPesananAktif(): Promise<Hasil<PesananDenganItem[]>> {
  const res = await db<Pesanan[]>("pesanan", {
    q:
      "select=*&status_bayar=eq.lunas" +
      "&status=in.(menunggu_konfirmasi,diterima,diproses,siap)&order=created_at.asc",
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

// ─────────────────────────────────────────────────────────────
// Bayar tunai di kasir (keputusan pemilik: tetap diizinkan)
// ─────────────────────────────────────────────────────────────

/**
 * Kasir mencatat pembayaran tunai untuk SATU pesanan.
 *
 * Alurnya tetap sama dengan prabayar: pesanan tidak masuk dapur sebelum
 * `status_bayar` menjadi 'lunas'. Bedanya hanya siapa yang menandai.
 *
 * Kenapa menerima `pesanan_id`, bukan `tagihan_id`: kasir bekerja dari
 * daftar pesanan yang belum dibayar, dan yang ia lihat adalah nomor
 * pesanan. Meminta id tagihan membuat staf harus menebak angka internal.
 */
/**
 * Buat tagihan baru untuk pesanan yang kehilangan tagihannya, lalu hitung
 * dari item yang tersimpan.
 *
 * Dipakai HANYA saat tagihan tidak ada. Kalau tagihannya ada tetapi totalnya
 * 0 (mis. item belum dihitung), itu bukan kasus fungsi ini — jalur normal
 * yang memperbaikinya.
 */
async function pulihkanTagihan(p: Pesanan): Promise<Hasil<Tagihan>> {
  const baru = await db<Tagihan[]>("tagihan", {
    method: "POST",
    prefer: "return=representation",
    q: "select=*",
    body: { meja_id: p.meja_id, status: "terbuka" },
  });
  if (!baru.ok) return { ok: false, pesan: baru.pesan };

  const tagihan = baru.data[0];

  const taut = await db("pesanan", {
    method: "PATCH",
    q: `id=eq.${p.id}`,
    body: { tagihan_id: tagihan.id },
  });

  const hitung = await hitungTagihanPesanan(p.id, tagihan.id);
  if (!hitung.ok) return { ok: false, pesan: hitung.pesan };

  /*
    Dicatat, karena ini menandakan ada yang tidak beres di jalur pembuatan
    pesanan. Satu baris log hari ini menghemat satu jam penyelidikan nanti.
  */
  await db("log_perubahan", {
    method: "POST",
    body: {
      siapa: "kasir",
      aksi: "pulihkan_tagihan",
      entitas: "pesanan",
      entitas_id: String(p.id),
      sebelum: { tagihan_id: p.tagihan_id },
      sesudah: { tagihan_id: tagihan.id, total: hitung.data.total, taut_ok: taut.ok },
    },
  });

  return { ok: true, data: hitung.data };
}

export async function bayarTunaiKasir(masuk: {
  pesanan_id: number;
  /**
   * Uang yang diserahkan tamu. Diabaikan bila `uang_pas` benar — dan itu
   * memang yang diinginkan: nominal yang "pas" hanya bisa ditentukan
   * dengan membaca total dari database, bukan dari angka yang dikirim
   * browser. Angka besar dari browser akan menghasilkan kembalian palsu
   * yang merusak laporan kas.
   */
  diterima: number;
  /** True bila tamu membayar uang pas; nominal dihitung server. */
  uang_pas?: boolean;
  kasir: string;
}): Promise<Hasil<{ pesanan: Pesanan; kembalian: number }>> {
  const ada = await db<Pesanan[]>("pesanan", {
    q: `select=*&id=eq.${masuk.pesanan_id}&limit=1`,
  });
  if (!ada.ok) return { ok: false, pesan: ada.pesan };
  if (ada.data.length === 0) return { ok: false, pesan: "Pesanan tidak ditemukan." };

  const p = ada.data[0];
  if (p.status_bayar === "lunas") return { ok: false, pesan: "Pesanan ini sudah lunas." };
  if (p.status === "dibatalkan" || p.status === "ditolak") {
    return { ok: false, pesan: "Pesanan ini sudah dibatalkan dan tidak bisa dibayar." };
  }
  /*
    ── TAGIHAN YANG HILANG DIPULIHKAN, BUKAN DITOLAK ───────────────────

    Sebelumnya: "Pesanan ini tidak punya tagihan." — dan kasir tidak punya
    jalan keluar. Pesanan tampil di layar, tamu sudah di depan kasir, uang
    sudah disiapkan, tetapi sistem menolak. Itu jalan buntu yang kita
    ciptakan sendiri.

    Tagihan bisa hilang karena beberapa sebab yang semuanya sudah terjadi
    atau mungkin terjadi: pesanan dibuat sebelum migrasi prabayar, tagihan
    terhapus, atau penautan gagal karena gangguan sesaat.

    Yang AMAN dilakukan: buat ulang tagihan dari item yang tersimpan, lalu
    tautkan. Nominalnya dihitung ulang dari database — bukan dari apa pun
    yang dikirim browser — jadi tidak ada celah harga.
  */
  let tagihan: Tagihan;

  if (!p.tagihan_id) {
    const pulih = await pulihkanTagihan(p);
    if (!pulih.ok) return { ok: false, pesan: pulih.pesan };
    tagihan = pulih.data;
  } else {
    const t = await db<Tagihan[]>("tagihan", {
      q: `select=*&id=eq.${p.tagihan_id}&limit=1`,
    });
    if (!t.ok) return { ok: false, pesan: t.pesan };
    if (t.data.length === 0) {
      const pulih = await pulihkanTagihan(p);
      if (!pulih.ok) return { ok: false, pesan: pulih.pesan };
      tagihan = pulih.data;
    } else {
      tagihan = t.data[0];
    }
  }

  // Uang pas: nominalnya TOTAL, bukan angka dari browser.
  const diterima = masuk.uang_pas ? tagihan.total : Math.round(Number(masuk.diterima));

  if (!pembayaranCukup("tunai", tagihan.total, diterima)) {
    return {
      ok: false,
      pesan: `Uang diterima kurang dari total ${tagihan.total.toLocaleString("id-ID")}.`,
    };
  }

  const kembalian = Math.max(0, diterima - tagihan.total);
  const kini = new Date().toISOString();

  const bayar = await db("pembayaran", {
    method: "POST",
    body: {
      tagihan_id: tagihan.id,
      metode: "tunai",
      diterima,
      kembalian,
      gerbang: "kasir",
      status: "settlement",
      kasir: masuk.kasir,
    },
  });
  if (!bayar.ok) return { ok: false, pesan: bayar.pesan };

  const upd = await db<Pesanan[]>("pesanan", {
    method: "PATCH",
    prefer: "return=representation",
    q: `id=eq.${p.id}&select=*`,
    body: {
      status_bayar: "lunas",
      dibayar_at: kini,
      /*
        "tunai" — bukan "tunai_kasir". Nilai di kolom ini punya constraint
        (pesanan_metode_bayar_sah) dan dipakai laporan; "tunai_kasir" akan
        ditolak database dan membuat pembayaran gagal setelah uangnya
        diterima.
      */
      metode_bayar: "tunai",
    },
  });
  if (!upd.ok) return { ok: false, pesan: upd.pesan };

  await db("tagihan", {
    method: "PATCH",
    q: `id=eq.${tagihan.id}`,
    body: { status: "lunas", ditutup_at: kini, kasir: masuk.kasir },
  });

  /*
    POTONG STOK — titik kedua (dan terakhir) di seluruh sistem.

    Ditaruh SETELAH pesanan & tagihan ditandai lunas, sejajar dengan
    `tandaiLunas` di doku.ts. Kedua jalur pembayaran harus berperilaku
    identik: uang masuk → status lunas → stok keluar → HPP dikunci.

    Kegagalannya TIDAK dikembalikan sebagai galat: uang sudah diterima
    kasir dan tercatat. Menolak respons di sini akan membuat kasir
    mengira pembayaran gagal dan menagih tamu dua kali. Yang dilakukan
    adalah mencatatnya di log server, tempat pemilik bisa memeriksanya.
  */
  const potong = await potongStokPesanan(p.id, masuk.kasir);
  if (!potong.ok) {
    console.error("stok gagal dipotong setelah bayar tunai", p.id, potong.pesan);
  }

  await db("log_perubahan", {
    method: "POST",
    body: {
      siapa: masuk.kasir,
      aksi: "lunas_tunai",
      entitas: "pesanan",
      entitas_id: String(p.id),
      sebelum: { status_bayar: p.status_bayar },
      sesudah: { status_bayar: "lunas", total: tagihan.total, diterima, kembalian },
    },
  });

  return { ok: true, data: { pesanan: upd.data[0], kembalian } };
}

// ─────────────────────────────────────────────────────────────
// Penyapu kedaluwarsa
// ─────────────────────────────────────────────────────────────

/**
 * Batalkan pesanan yang lewat batas bayar.
 *
 * Dipanggil webhook cron Cloudflare (setiap menit) dan juga saat portal
 * kasir dibuka — yang kedua penting karena cron bisa gagal tanpa ada yang
 * melihat, sedangkan kasir membuka layarnya sepanjang jam buka.
 *
 * KENAPA HARUS ADA: tanpa ini, pesanan yang tak pernah dibayar menahan
 * meja berstatus `ada_pesanan` selamanya. Pelayan mendatangi meja kosong,
 * dan kasir melihat daftar yang makin panjang.
 *
 * Mengembalikan jumlah yang dibatalkan agar bisa dicatat di log cron.
 */
export async function sapuKedaluwarsa(sekarang: Date = new Date()): Promise<number> {
  const batas = sekarang.toISOString();

  const r = await db<Pesanan[]>("pesanan", {
    q:
      "select=*&status_bayar=eq.menunggu" +
      `&kedaluwarsa_at=lt.${encodeURIComponent(batas)}&limit=50`,
  });
  if (!r.ok) return 0;

  let dibatalkan = 0;
  for (const p of r.data) {
    /*
      ── DIPERIKSA ULANG DI SINI, BUKAN DIPERCAYAKAN PADA FILTER ────────

      Penyapu membatalkan pesanan. Salah membatalkan berarti tamu
      kehilangan pesanan yang sebenarnya masih dalam batas waktu — dan itu
      tidak bisa dibatalkan. Karena itu syaratnya diperiksa ULANG di sini,
      tidak diserahkan kepada string query.

      Bahayanya nyata, bukan teoretis: kalau filter `kedaluwarsa_at=lt.…`
      gagal diterjemahkan (timestamp salah encode, kolom null, PostgREST
      versi lain), yang dikembalikan adalah SEMUA pesanan berstatus
      "menunggu" — termasuk yang baru dibuat satu detik lalu. Tanpa
      pemeriksaan ini, seluruh antrean dibatalkan sekaligus.
    */
    const kedaluwarsa = p.kedaluwarsa_at ? new Date(p.kedaluwarsa_at) : null;
    if (!kedaluwarsa || Number.isNaN(kedaluwarsa.getTime())) continue;
    if (kedaluwarsa >= sekarang) continue;

    // Pesanan yang sudah dibayar di antara query dan loop ini tidak boleh
    // disentuh. Penjagaan ganda: penyapu berjalan tiap menit, sedangkan
    // webhook DOKU bisa masuk kapan saja.
    const bayar = await db<Pesanan[]>("pesanan", {
      q: `select=status_bayar&id=eq.${p.id}&limit=1`,
    });
    if (!bayar.ok || bayar.data[0]?.status_bayar !== "menunggu") continue;

    const upd = await db("pesanan", {
      method: "PATCH",
      q: `id=eq.${p.id}`,
      body: {
        status: "dibatalkan",
        status_bayar: "kedaluwarsa",
        alasan_batal: "Tidak dibayar sampai batas waktu.",
        dibatalkan_oleh: "sistem",
      },
    });
    if (!upd.ok) continue;

    if (p.tagihan_id) {
      /*
        ── DITUTUP, BUKAN "LUNAS" ──────────────────────────────────

        Sebelumnya tagihan pesanan kedaluwarsa ditandai `lunas`. Itu
        menyesatkan laporan: tagihan "lunas" yang tidak punya satu pun baris
        pembayaran membuat pendapatan terlihat lebih besar daripada uang
        yang benar-benar masuk — selisih yang baru ketahuan saat tutup
        harian, dan saat itu sudah sulit dilacak asalnya.

        Tabel tagihan hanya punya dua status yang dipakai (terbuka /
        lunas), jadi tidak ada status "batal". Yang benar: kembalikan ke
        'terbuka' lalu tutup waktunya. Kasir melihatnya sebagai tagihan
        yang sudah ditutup tanpa pembayaran — persis keadaannya.
      */
      await db("tagihan", {
        method: "PATCH",
        q: `id=eq.${p.tagihan_id}`,
        body: { status: "terbuka", ditutup_at: batas },
      });
    }

    /*
      Meja dikosongkan HANYA bila tidak ada pesanan aktif lain di meja itu.
      Tanpa syarat ini, satu pesanan kedaluwarsa mengosongkan meja yang
      masih dipakai tamu lain — pelayan lalu mengantar pesanan ke meja yang
      menurut sistem kosong.
    */
    const lain = await db<Pesanan[]>("pesanan", {
      q:
        `select=id&meja_id=eq.${p.meja_id}&id=neq.${p.id}` +
        "&status=in.(menunggu_konfirmasi,diterima,diproses,siap,diantar)&limit=1",
    });
    if (lain.ok && lain.data.length === 0) {
      await db("meja", { method: "PATCH", q: `id=eq.${p.meja_id}`, body: { status: "kosong" } });
    }

    dibatalkan++;
  }

  return dibatalkan;
}
