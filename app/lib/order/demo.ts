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
  PilihanMenu,
} from "./tipe";
import {
  ATURAN_BAWAAN,
  bacaPilihan,
  hitungTagihan,
  nomorPesanan,
  periksaPilihan,
} from "./aturan";

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

/*
  Menu cadangan bila database tidak bisa dibaca sama sekali.

  Isinya SALINAN menu asli Nabawi (126 item, 6 kategori) — bukan hidangan
  karangan. Dulu di sini ada Harira, Tajine, dan Couscous dengan harga
  yang tidak pernah dijual Nabawi. Itu berbahaya: pelanggan bisa memesan
  makanan yang tidak ada, lalu kecewa saat kasir menolak.

  Disalin, bukan dibaca dari database, karena berkas ini justru dipakai
  ketika database tidak terjangkau. Kalau menu asli berubah (harga naik,
  menu baru), salinan ini HARUS ikut diperbarui — sumber kebenarannya
  supabase/migrations/20261102000000_menu_nabawi.sql.
*/
export const MENU_CONTOH: { kategori: KategoriMenu[]; menu: Menu[] } = {
  kategori: [
    { id: 1, nama: "Makanan Utama", urutan: 1 },
    { id: 2, nama: "Camilan & Pastry", urutan: 2 },
    { id: 3, nama: "Kopi", urutan: 3 },
    { id: 4, nama: "Non-Kopi", urutan: 4 },
    { id: 5, nama: "Cheese & Milkshake", urutan: 5 },
    { id: 6, nama: "Jus & Dessert", urutan: 6 }
  ],
  menu: [
    { id: 1, nama: "Nasi Goreng Kebuli", deskripsi: "", harga: 40000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 1 },
    { id: 2, nama: "Nasi Goreng Oriental", deskripsi: "", harga: 40000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 2 },
    { id: 3, nama: "Rice Bowl Chicken", deskripsi: "Pilihan rasa: Sambal Matah, BBQ, Gravy, Salted Egg.", harga: 50000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 3, pilihan: [{ nama: "Sambal Matah", tambah: 0 }, { nama: "BBQ", tambah: 0 }, { nama: "Gravy", tambah: 0 }, { nama: "Salted Egg", tambah: 5000 }] },
    { id: 4, nama: "Paket Nasi Liwet (Personal)", deskripsi: "Paket personal. Termasuk ayam, tempe, tahu, ikan asin, lalap, sayur asem, sambal.", harga: 85000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 4 },
    { id: 5, nama: "Nasi Liwet Kastrol 2 Pax", deskripsi: "Paket untuk 2 orang. Termasuk ayam, tempe, tahu, ikan asin, lalap, sayur asem, sambal.", harga: 188000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 5 },
    { id: 6, nama: "Nasi Liwet Kastrol 4 Pax", deskripsi: "Paket untuk 4 orang. Termasuk ayam, tempe, tahu, ikan asin, lalap, sayur asem, sambal.", harga: 375000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 6 },
    { id: 7, nama: "Nasi Liwet (Porsi Nasi Saja)", deskripsi: "", harga: 15000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 7 },
    { id: 8, nama: "Nasi Putih", deskripsi: "", harga: 12000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 8 },
    { id: 9, nama: "Ayam Balado", deskripsi: "", harga: 62000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 1 },
    { id: 10, nama: "Ayam Goreng Mentega", deskripsi: "", harga: 58000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 2 },
    { id: 11, nama: "Ayam Goreng Bawang Putih", deskripsi: "", harga: 58000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 3 },
    { id: 12, nama: "Sop Iga", deskripsi: "", harga: 80000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 1 },
    { id: 13, nama: "Sop Iga Bakar", deskripsi: "", harga: 90000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 2 },
    { id: 14, nama: "Daging Sapi Mercon", deskripsi: "", harga: 70000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 3 },
    { id: 15, nama: "Daging Sapi Teriyaki", deskripsi: "", harga: 75000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 4 },
    { id: 16, nama: "Udang Goreng Tepung", deskripsi: "", harga: 65000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 1 },
    { id: 17, nama: "Udang Balado", deskripsi: "", harga: 75000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 2 },
    { id: 18, nama: "Udang Asam Manis", deskripsi: "", harga: 67000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 3 },
    { id: 19, nama: "Gurame Bakar Minang", deskripsi: "", harga: 145000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 1 },
    { id: 20, nama: "Gurame Bakar Kecap", deskripsi: "", harga: 130000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 2 },
    { id: 21, nama: "Gurame Pecak", deskripsi: "", harga: 136000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 3 },
    { id: 22, nama: "Wagyu Meltique", deskripsi: "Pilihan saus: Mushroom, BBQ, Black Pepper.", harga: 130000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 1, pilihan: [{ nama: "Mushroom", tambah: 0 }, { nama: "BBQ", tambah: 0 }, { nama: "Black Pepper", tambah: 0 }] },
    { id: 23, nama: "Crispy Chicken Steak", deskripsi: "Pilihan saus: Mushroom, BBQ, Black Pepper.", harga: 55000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 2, pilihan: [{ nama: "Mushroom", tambah: 0 }, { nama: "BBQ", tambah: 0 }, { nama: "Black Pepper", tambah: 0 }] },
    { id: 24, nama: "Crispy Chicken Burger", deskripsi: "", harga: 55000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 1 },
    { id: 25, nama: "Beef Burger", deskripsi: "", harga: 65000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 2 },
    { id: 26, nama: "Spaghetti Carbonara", deskripsi: "", harga: 50000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 1 },
    { id: 27, nama: "Spaghetti Bolognese", deskripsi: "", harga: 50000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 2 },
    { id: 28, nama: "Spaghetti Aglio Olio Tuna", deskripsi: "", harga: 50000, kategori_id: 1, foto_url: null, tersedia: true, urutan: 3 },
    { id: 29, nama: "Tumis Kangkung", deskripsi: "", harga: 25000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 1 },
    { id: 30, nama: "Karedok", deskripsi: "", harga: 30000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 2 },
    { id: 31, nama: "Lotek", deskripsi: "", harga: 30000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 3 },
    { id: 32, nama: "Sayur Asem", deskripsi: "", harga: 20000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 4 },
    { id: 33, nama: "Jengkol / Pete Asin Balado", deskripsi: "", harga: 50000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 5 },
    { id: 34, nama: "Telor Barendo", deskripsi: "", harga: 20000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 6 },
    { id: 35, nama: "Mix Platter (Sosis, Kentang, Onion Ring)", deskripsi: "", harga: 65000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 1 },
    { id: 36, nama: "Chicken Bite", deskripsi: "", harga: 35000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 2 },
    { id: 37, nama: "Cireng Isi Ayam Mozarella", deskripsi: "", harga: 30000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 3 },
    { id: 38, nama: "Tahu Isi", deskripsi: "", harga: 30000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 4 },
    { id: 39, nama: "Singkong Goreng Original", deskripsi: "", harga: 25000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 5 },
    { id: 40, nama: "Singkong Goreng Keju", deskripsi: "", harga: 30000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 6 },
    { id: 41, nama: "Pisang Goreng Original", deskripsi: "", harga: 25000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 7 },
    { id: 42, nama: "Pisang Goreng Keju / Coklat", deskripsi: "", harga: 30000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 8 },
    { id: 43, nama: "Bakwan Sayur", deskripsi: "", harga: 25000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 9 },
    { id: 44, nama: "Bakwan Jagung", deskripsi: "", harga: 25000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 10 },
    { id: 45, nama: "Tempe Mendoan", deskripsi: "", harga: 25000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 11 },
    { id: 46, nama: "French Fries", deskripsi: "", harga: 25000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 12 },
    { id: 47, nama: "Onion Ring", deskripsi: "", harga: 25000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 13 },
    { id: 48, nama: "Mini Croffle Original", deskripsi: "", harga: 10000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 1 },
    { id: 49, nama: "Mini Croffle (Choco / Cheese)", deskripsi: "", harga: 15000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 2 },
    { id: 50, nama: "Choco Soft Cookie", deskripsi: "", harga: 23000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 3 },
    { id: 51, nama: "Fudgy Brownies", deskripsi: "", harga: 23000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 4 },
    { id: 52, nama: "Almond Croissant Original", deskripsi: "", harga: 25000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 5 },
    { id: 53, nama: "Almond Croissant (Choco / Cheese)", deskripsi: "", harga: 35000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 6 },
    { id: 54, nama: "Cinnamon Roll Original", deskripsi: "", harga: 23000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 7 },
    { id: 55, nama: "Cinnamon Roll (Choco / Cheese)", deskripsi: "", harga: 33000, kategori_id: 2, foto_url: null, tersedia: true, urutan: 8 },
    { id: 56, nama: "Sundae Ice Cream", deskripsi: "", harga: 29000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 1 },
    { id: 57, nama: "Banana Split", deskripsi: "", harga: 37000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 2 },
    { id: 58, nama: "Additional +1 Scoop Ice Cream", deskripsi: "Tambahan satu scoop es krim.", harga: 15000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 3 },
    { id: 59, nama: "Flavoured Latte Panas / Dingin", deskripsi: "Pilihan rasa: Vanilla, Caramel, Hazelnut, Rum, Banana, Cotton Candy, Butter Scotch.", harga: 35000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 1, pilihan: [{ nama: "Vanilla", tambah: 0 }, { nama: "Caramel", tambah: 0 }, { nama: "Hazelnut", tambah: 0 }, { nama: "Rum", tambah: 0 }, { nama: "Banana", tambah: 0 }, { nama: "Cotton Candy", tambah: 0 }, { nama: "Butter Scotch", tambah: 0 }] },
    { id: 60, nama: "Banana Irish Cream Dingin", deskripsi: "", harga: 35000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 2 },
    { id: 61, nama: "Tiramisu Latte Dingin", deskripsi: "", harga: 35000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 3 },
    { id: 62, nama: "Irish Cream Latte Dingin", deskripsi: "", harga: 35000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 4 },
    { id: 63, nama: "Jamaican Mocha Dingin", deskripsi: "", harga: 35000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 5 },
    { id: 64, nama: "Tropical On The Rock Dingin", deskripsi: "", harga: 35000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 6 },
    { id: 65, nama: "Avocado Coffee Dingin", deskripsi: "", harga: 35000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 7 },
    { id: 66, nama: "Cold Brew Martini Dingin", deskripsi: "", harga: 35000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 8 },
    { id: 67, nama: "Kopi Susu Nabawi Panas / Dingin", deskripsi: "", harga: 37000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 9 },
    { id: 68, nama: "Mocca Latte Panas", deskripsi: "", harga: 33000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 10 },
    { id: 69, nama: "Mocca Latte Dingin", deskripsi: "", harga: 36000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 11 },
    { id: 70, nama: "Coffee Latte Panas", deskripsi: "", harga: 30000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 12 },
    { id: 71, nama: "Coffee Latte Dingin", deskripsi: "", harga: 32000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 13 },
    { id: 72, nama: "Cappuccino Panas", deskripsi: "", harga: 30000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 14 },
    { id: 73, nama: "Cappuccino Dingin", deskripsi: "", harga: 32000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 15 },
    { id: 74, nama: "Manual Brew Panas", deskripsi: "", harga: 30000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 16 },
    { id: 75, nama: "Manual Brew Dingin", deskripsi: "", harga: 32000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 17 },
    { id: 76, nama: "Piccolo", deskripsi: "", harga: 29000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 18 },
    { id: 77, nama: "Long Black Panas", deskripsi: "", harga: 26000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 19 },
    { id: 78, nama: "Long Black Dingin", deskripsi: "", harga: 28000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 20 },
    { id: 79, nama: "Americano Panas", deskripsi: "", harga: 26000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 21 },
    { id: 80, nama: "Americano Dingin", deskripsi: "", harga: 28000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 22 },
    { id: 81, nama: "Espresso (Single Shot)", deskripsi: "Satu shot.", harga: 26000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 23 },
    { id: 82, nama: "Espresso (Double Shot)", deskripsi: "Dua shot.", harga: 28000, kategori_id: 3, foto_url: null, tersedia: true, urutan: 24 },
    { id: 83, nama: "Happy Puppy", deskripsi: "", harga: 47000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 1 },
    { id: 84, nama: "Mojito Lychee", deskripsi: "", harga: 37000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 2 },
    { id: 85, nama: "Mojito Strawberry", deskripsi: "", harga: 37000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 3 },
    { id: 86, nama: "Strawberry Candy", deskripsi: "", harga: 37000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 4 },
    { id: 87, nama: "Blue Pororo", deskripsi: "", harga: 35000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 5 },
    { id: 88, nama: "Kiwi Hime", deskripsi: "", harga: 35000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 6 },
    { id: 89, nama: "Sunset Paradise", deskripsi: "", harga: 35000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 7 },
    { id: 90, nama: "Verde Island", deskripsi: "", harga: 35000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 8 },
    { id: 91, nama: "Yellow Breeze", deskripsi: "", harga: 35000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 9 },
    { id: 92, nama: "Cheese Latte", deskripsi: "", harga: 40000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 1 },
    { id: 93, nama: "Matcha Cheese", deskripsi: "", harga: 40000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 2 },
    { id: 94, nama: "Choco Cheese", deskripsi: "", harga: 40000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 3 },
    { id: 95, nama: "Strawberry Cheese", deskripsi: "", harga: 40000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 4 },
    { id: 96, nama: "Taro Cheese", deskripsi: "", harga: 40000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 5 },
    { id: 97, nama: "Red Velvet Cheese", deskripsi: "", harga: 40000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 6 },
    { id: 98, nama: "Cheese Tea", deskripsi: "", harga: 30000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 7 },
    { id: 99, nama: "Red Velvet Latte Panas", deskripsi: "", harga: 35000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 1 },
    { id: 100, nama: "Red Velvet Latte Dingin", deskripsi: "", harga: 37000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 2 },
    { id: 101, nama: "Matcha Latte Panas", deskripsi: "", harga: 35000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 3 },
    { id: 102, nama: "Matcha Latte Dingin", deskripsi: "", harga: 37000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 4 },
    { id: 103, nama: "Taro Latte Panas", deskripsi: "", harga: 35000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 5 },
    { id: 104, nama: "Taro Latte Dingin", deskripsi: "", harga: 37000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 6 },
    { id: 105, nama: "Klepon Latte", deskripsi: "", harga: 35000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 7 },
    { id: 106, nama: "Chocolate Panas", deskripsi: "", harga: 33000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 8 },
    { id: 107, nama: "Chocolate Dingin", deskripsi: "", harga: 35000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 9 },
    { id: 108, nama: "Lychee Tea Dingin", deskripsi: "", harga: 27000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 10 },
    { id: 109, nama: "Lemon Tea Panas", deskripsi: "", harga: 25000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 11 },
    { id: 110, nama: "Lemon Tea Dingin", deskripsi: "", harga: 26000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 12 },
    { id: 111, nama: "Ginger Tea", deskripsi: "", harga: 25000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 13 },
    { id: 112, nama: "Strawberry Tea Dingin", deskripsi: "", harga: 25000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 14 },
    { id: 113, nama: "Sweet Black Tea Panas", deskripsi: "", harga: 17000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 15 },
    { id: 114, nama: "Sweet Black Tea Dingin", deskripsi: "", harga: 18000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 16 },
    { id: 115, nama: "Black Tea Panas", deskripsi: "", harga: 10000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 17 },
    { id: 116, nama: "Black Tea Dingin", deskripsi: "", harga: 12000, kategori_id: 4, foto_url: null, tersedia: true, urutan: 18 },
    { id: 117, nama: "Strawberry Milkshake", deskripsi: "", harga: 40000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 1 },
    { id: 118, nama: "Chocolate Milkshake", deskripsi: "", harga: 40000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 2 },
    { id: 119, nama: "Vanilla Milkshake", deskripsi: "", harga: 40000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 3 },
    { id: 120, nama: "Oreo Milkshake", deskripsi: "", harga: 40000, kategori_id: 5, foto_url: null, tersedia: true, urutan: 4 },
    { id: 121, nama: "Mango Juice", deskripsi: "", harga: 30000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 1 },
    { id: 122, nama: "Avocado Juice", deskripsi: "", harga: 30000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 2 },
    { id: 123, nama: "Sirsak Juice", deskripsi: "", harga: 30000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 3 },
    { id: 124, nama: "Dragon Fruit Juice", deskripsi: "", harga: 30000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 4 },
    { id: 125, nama: "Orange Juice", deskripsi: "", harga: 25000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 5 },
    { id: 126, nama: "Mineral Bottle", deskripsi: "Air mineral botol.", harga: 10000, kategori_id: 6, foto_url: null, tersedia: true, urutan: 6 }
  ],
};

export function demoBuatPesanan(masuk: {
  meja: string;
  sesi: string;
  nama: string | null;
  items: { menu_id: number; jumlah: number; catatan: string | null; pilihan: string[] }[];
  menu: Menu[];
}) {
  const t = toko();
  const meja = t.meja.find((m) => m.nomor === masuk.meja);
  if (!meja) return { ok: false as const, pesan: "Nomor meja tidak dikenali." };

  const peta = new Map(masuk.menu.map((m) => [m.id, m]));

  // Menu yang ditandai habis harus ditolak di sini juga. Tanpa pemeriksaan
  // ini mode demo menerima menu habis, sehingga perilakunya berbeda dari
  // mode sungguhan dan bug seperti itu lolos dari pengujian.
  /*
    Pilihan diperiksa dengan fungsi yang SAMA dengan jalur database
    (`periksaPilihan`). Kalau di sini hanya dilakukan salinan logika,
    mode demo akan menerima pilihan yang ditolak produksi — dan uji
    otomatis akan melaporkannya lulus.
  */
  /*
    Pilihan disimpan PER ITEM, bukan per menu_id.

    Sempat salah di sini: `Map<menu_id, pilihan>` membuat item kedua menimpa
    item pertama. Dua Wagyu dengan saus BBQ dan Mushroom tersimpan dua-duanya
    sebagai Mushroom, lalu struk menggabungkannya jadi "2× Wagyu — Mushroom".
    Tamu memesan dua rasa berbeda dan menerima dua yang sama, dengan struk
    yang seolah membenarkannya. Karena itu di sini dipakai indeks item.
  */
  const pilihanItem: PilihanMenu[][] = [];
  const tambahanItem: number[] = [];

  for (const it of masuk.items) {
    const mnu = peta.get(it.menu_id);
    if (mnu && !mnu.tersedia) {
      return { ok: false as const, pesan: `${mnu.nama} sedang habis. Hapus dari keranjang.` };
    }
    const tersedia = bacaPilihan(mnu?.pilihan);
    const cek = periksaPilihan(tersedia, it.pilihan);
    if (!cek.ok) {
      return { ok: false as const, pesan: `${mnu?.nama ?? "Menu"}: ${cek.pesan}` };
    }
    pilihanItem.push(cek.pilihan);
    tambahanItem.push(cek.tambah);
  }

  const itemFinal = masuk.items.map((i, urutan) => {
    const m = peta.get(i.menu_id);
    return {
      id: t.urutItem++,
      pesanan_id: 0,
      menu_id: i.menu_id,
      nama_saat_pesan: m?.nama ?? `Menu ${i.menu_id}`,
      jumlah: i.jumlah,
      harga_satuan: (m?.harga ?? 0) + (tambahanItem[urutan] ?? 0),
      catatan: i.catatan,
      pilihan: pilihanItem[urutan] ?? [],
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

  const peta = new Map<
    string,
    { nama: string; pilihan: PilihanMenu[]; jumlah: number; harga_satuan: number; harga_baris: number }
  >();
  for (const i of t.items) {
    if (!pesananSah.has(i.pesanan_id)) continue;
    // Sama seperti jalur database: pilihan ikut jadi kunci penggabungan,
    // supaya dua saus berbeda tidak menyatu jadi satu baris struk.
    const pilihan = bacaPilihan(i.pilihan);
    const label = pilihan.map((p) => p.nama).sort().join(",");
    const kunci = `${i.nama_saat_pesan}|${i.harga_satuan}|${label}`;
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
