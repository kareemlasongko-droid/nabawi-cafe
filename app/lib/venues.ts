/**
 * Sumber data Virtual Tour 360.
 *
 * Alur: Supabase (tabel `tour_venues`) -> kalau gagal -> salinan lokal.
 *
 * Kenapa ada salinan lokal? Supabase bisa di-pause (proyek ini pernah
 * berstatus INACTIVE saat dicek) atau jaringan sedang putus. Tanpa
 * fallback, seluruh halaman tour akan kosong hanya karena satu request
 * gagal. Salinan ini juga membuat build Vercel tetap berhasil walau env
 * belum diisi.
 *
 * Saat Supabase hidup, SELALU data Supabase yang dipakai — termasuk kalau
 * pemilik menambah atau mengubah tempat lewat dashboard.
 */

import { supabaseSelect } from "./supabase";

export type Aksen = "forest" | "clay" | "cream";

export type Venue = {
  slug: string;
  urutan: number;
  nama: string;
  kategori: string;
  ringkasan: string;
  deskripsi: string;
  panoramaUrl: string;
  petaX: number;
  petaY: number;
  aksen: Aksen;
  fasilitas: string[];
  jamBuka: string | null;
  durasiMenit: number;
};

/** Bentuk baris apa adanya dari PostgREST (snake_case, numeric sebagai string). */
type BarisSupabase = {
  slug: string;
  urutan: number;
  nama: string;
  kategori: string;
  ringkasan: string;
  deskripsi: string;
  panorama_url: string;
  peta_x: string | number;
  peta_y: string | number;
  aksen: string;
  fasilitas: string[] | null;
  jam_buka: string | null;
  durasi_menit: number;
};

const AKSEN_SAH: Aksen[] = ["forest", "clay", "cream"];

function rapikanAksen(nilai: string): Aksen {
  return (AKSEN_SAH as string[]).includes(nilai) ? (nilai as Aksen) : "forest";
}

function dariBaris(b: BarisSupabase): Venue {
  return {
    slug: b.slug,
    urutan: b.urutan,
    nama: b.nama,
    kategori: b.kategori,
    ringkasan: b.ringkasan,
    deskripsi: b.deskripsi,
    panoramaUrl: b.panorama_url,
    petaX: Number(b.peta_x),
    petaY: Number(b.peta_y),
    aksen: rapikanAksen(b.aksen),
    fasilitas: b.fasilitas ?? [],
    jamBuka: b.jam_buka,
    durasiMenit: b.durasi_menit,
  };
}

/**
 * Salinan lokal — isinya SAMA dengan yang ada di Supabase saat ini.
 * Dipakai hanya kalau Supabase tidak bisa dihubungi.
 */
export const VENUES_LOKAL: Venue[] = [
  {
    slug: "gerbang-maroko",
    urutan: 1,
    nama: "Gerbang Maroko",
    kategori: "Pintu Masuk",
    ringkasan: "Pintu utama bernuansa lengkung Maroko, titik awal perjalanan.",
    deskripsi:
      "Berdiri di ambang gerbang ini, pengunjung disambut lengkungan batu bata dan lentera kuningan khas Maroko. Suara air dari sungai terdengar samar di balik pepohonan, jadi suasana kota langsung mengendur begitu kaki menapak.",
    panoramaUrl: "/images/tour/gerbang-maroko.jpg",
    petaX: 50,
    petaY: 88,
    aksen: "clay",
    fasilitas: ["Area parkir", "Penyambut tamu", "Papan petunjuk"],
    jamBuka: "Setiap Hari 09.00 – 21.00",
    durasiMenit: 2,
  },
  {
    slug: "taman-riverside",
    urutan: 2,
    nama: "Taman Riverside",
    kategori: "Alam Terbuka",
    ringkasan: "Hamparan rumput tepi sungai dengan gazebo dan ayunan.",
    deskripsi:
      "Bagian paling lapang dari Nabawi Cafe. Rumput hijau menurun ke tepi sungai, dihiasi gazebo beratap jerami dan ayunan gantung di antara pohon. Tempat favorit untuk duduk lama tanpa memesan apa pun selain udara sore.",
    panoramaUrl: "/images/tour/taman-riverside.jpg",
    petaX: 26,
    petaY: 72,
    aksen: "forest",
    fasilitas: ["Gazebo", "Ayunan", "Pemandangan sungai", "Area piknik"],
    jamBuka: "Setiap Hari 09.00 – 21.00",
    durasiMenit: 4,
  },
  {
    slug: "teras-lentera",
    urutan: 3,
    nama: "Teras Lentera",
    kategori: "Semi Terbuka",
    ringkasan: "Deretan lentera kuningan yang menyala saat senja.",
    deskripsi:
      "Teras beratap rendah dengan puluhan lentera kuningan bergantung. Menjelang magrib lenteranya dinyalakan satu per satu, dan cahaya hangatnya memantul di lantai batu — momen yang paling sering difoto pengunjung.",
    panoramaUrl: "/images/tour/teras-lentera.jpg",
    petaX: 61,
    petaY: 66,
    aksen: "cream",
    fasilitas: ["Lentera kuningan", "Meja outdoor", "Colokan listrik"],
    jamBuka: "Setiap Hari 09.00 – 21.00",
    durasiMenit: 3,
  },
  {
    slug: "pendopo-utama",
    urutan: 4,
    nama: "Pendopo Utama",
    kategori: "Area Bersama",
    ringkasan: "Balai terbuka beratap tinggi untuk berkumpul.",
    deskripsi:
      "Balai besar dengan tiang kayu dan ukiran geometris Maroko. Dipakai untuk acara keluarga, komunitas, dan live music akhir pekan. Sirkulasi udaranya baik meski siang, karena sisi-sisinya dibiarkan terbuka.",
    panoramaUrl: "/images/tour/pendopo-utama.jpg",
    petaX: 50,
    petaY: 50,
    aksen: "forest",
    fasilitas: ["Kapasitas 60 orang", "Live music", "Proyektor"],
    jamBuka: "Setiap Hari 09.00 – 21.00",
    durasiMenit: 3,
  },
  {
    slug: "kafe-indoor",
    urutan: 5,
    nama: "Kafe Indoor",
    kategori: "Area Duduk",
    ringkasan: "Ruang ber-AC dengan kursi empuk dan rak buku.",
    deskripsi:
      "Ruang utama ber-AC dengan jendela tinggi menghadap taman. Ada rak buku, colokan di tiap meja, dan Wi-Fi kencang — banyak yang menjadikannya tempat kerja setengah hari.",
    panoramaUrl: "/images/tour/kafe-indoor.jpg",
    petaX: 42,
    petaY: 44,
    aksen: "clay",
    fasilitas: ["AC", "Wi-Fi", "Colokan listrik", "Rak buku", "Area non-rokok"],
    jamBuka: "Setiap Hari 09.00 – 21.00",
    durasiMenit: 3,
  },
  {
    slug: "bar-kopi",
    urutan: 6,
    nama: "Bar Kopi",
    kategori: "Counter",
    ringkasan: "Bar tempat biji kopi disangrai dan diseduh terbuka.",
    deskripsi:
      "Counter panjang dari kayu jati. Barista menyangrai dan menyeduh di depan tamu, jadi aroma kopi menyebar ke seluruh ruangan. Ada kursi bar untuk yang ingin mengobrol sambil menunggu.",
    panoramaUrl: "/images/tour/bar-kopi.jpg",
    petaX: 34,
    petaY: 38,
    aksen: "cream",
    fasilitas: ["Kursi bar", "Manual brew", "Biji kopi retail"],
    jamBuka: "Setiap Hari 09.00 – 21.00",
    durasiMenit: 3,
  },
  {
    slug: "dapur-terbuka",
    urutan: 7,
    nama: "Dapur Terbuka",
    kategori: "Counter",
    ringkasan: "Dapur kaca tempat hidangan Maroko dimasak.",
    deskripsi:
      "Dapur dengan dinding kaca sehingga tamu bisa melihat langsung proses memasak. Tagine, couscous, dan roti khobz dibuat di sini setiap hari mulai pukul sembilan pagi.",
    panoramaUrl: "/images/tour/dapur-terbuka.jpg",
    petaX: 58,
    petaY: 40,
    aksen: "forest",
    fasilitas: ["Dapur kaca", "Chef harian", "Pesanan khusus"],
    jamBuka: "Setiap Hari 09.00 – 21.00",
    durasiMenit: 2,
  },
  {
    slug: "dek-sungai",
    urutan: 8,
    nama: "Dek Sungai",
    kategori: "Alam Terbuka",
    ringkasan: "Dek kayu menjorok ke atas air, terbaik saat senja.",
    deskripsi:
      "Dek kayu yang menjorok beberapa meter ke atas sungai. Duduk di tepinya, kaki menggantung, sambil menunggu matahari turun di balik pohon — bagian yang paling sering disebut tamu sebagai alasan mereka kembali.",
    panoramaUrl: "/images/tour/dek-sungai.jpg",
    petaX: 18,
    petaY: 58,
    aksen: "clay",
    fasilitas: ["Dek kayu", "Pemandangan sungai", "Spot foto"],
    jamBuka: "Setiap Hari 16.00 – 21.00",
    durasiMenit: 4,
  },
  {
    slug: "galeri-seni",
    urutan: 9,
    nama: "Galeri Seni",
    kategori: "Budaya",
    ringkasan: "Karya seniman lokal dan kerajinan tangan Maroko.",
    deskripsi:
      "Ruang pamer kecil berisi karya seniman lokal, kain tenun, dan keramik Maroko. Karya yang dipajang berganti tiap bulan, dan sebagian bisa dibeli langsung di kasir.",
    panoramaUrl: "/images/tour/galeri-seni.jpg",
    petaX: 72,
    petaY: 52,
    aksen: "cream",
    fasilitas: ["Pameran bulanan", "Karya dijual", "Tur berpemandu"],
    jamBuka: "Setiap Hari 10.00 – 20.00",
    durasiMenit: 3,
  },
  {
    slug: "toko-suvenir",
    urutan: 10,
    nama: "Toko Suvenir",
    kategori: "Belanja",
    ringkasan: "Biji kopi, keramik, dan oleh-oleh khas Nabawi.",
    deskripsi:
      "Toko kecil di dekat pintu keluar. Isinya biji kopi sangrai sendiri, keramik Maroko, dan kain tenun. Tempat terakhir yang hampir selalu disinggahi tamu sebelum pulang.",
    panoramaUrl: "/images/tour/toko-suvenir.jpg",
    petaX: 82,
    petaY: 74,
    aksen: "forest",
    fasilitas: ["Biji kopi", "Keramik", "Kain tenun", "Kemasan hadiah"],
    jamBuka: "Setiap Hari 09.00 – 21.00",
    durasiMenit: 2,
  },
];

/**
 * Ambil semua tempat, urut sesuai `urutan`.
 * Tidak pernah melempar error: kalau Supabase gagal, kembalikan salinan lokal
 * supaya halaman tetap utuh.
 */
export async function ambilVenues(): Promise<{
  venues: Venue[];
  sumber: "supabase" | "lokal";
}> {
  try {
    const baris = await supabaseSelect<BarisSupabase>(
      "tour_venues",
      "select=slug,urutan,nama,kategori,ringkasan,deskripsi,panorama_url,peta_x,peta_y,aksen,fasilitas,jam_buka,durasi_menit&is_published=eq.true&order=urutan.asc",
    );

    if (baris.length === 0) {
      return { venues: VENUES_LOKAL, sumber: "lokal" };
    }

    return { venues: baris.map(dariBaris), sumber: "supabase" };
  } catch (e) {
    console.warn("[venues] Supabase tidak bisa dihubungi, memakai salinan lokal:", e);
    return { venues: VENUES_LOKAL, sumber: "lokal" };
  }
}

export async function ambilVenue(slug: string): Promise<Venue | undefined> {
  const { venues } = await ambilVenues();
  return venues.find((v) => v.slug === slug);
}
