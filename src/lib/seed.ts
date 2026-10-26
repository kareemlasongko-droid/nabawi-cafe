import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { payments, reservations, tourScenes, units, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { addDaysISO, todayISO } from "@/lib/constants";

let seeding: Promise<void> | null = null;

export function ensureSeed() {
  if (!seeding) {
    seeding = runSeed().catch((e) => {
      seeding = null;
      throw e;
    });
  }
  return seeding;
}

async function runSeed() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(424242)`);
    const existing = await tx.execute(sql`select count(*)::int as c from users`);
    if (Number((existing.rows[0] as { c: number }).c) > 0) return;

    const adminPass = hashPassword("admin123");
    const custPass = hashPassword("demo123");

    const [admin, budi, sari, rizky, dewi] = await tx
      .insert(users)
      .values([
        { name: "Admin Senja Rimba", email: "admin@senjarimba.id", passwordHash: adminPass, phone: "0812-3456-7890", role: "admin" },
        { name: "Budi Santoso", email: "budi@contoh.id", passwordHash: custPass, phone: "0813-1122-3344", role: "customer" },
        { name: "Sari Wulandari", email: "sari@contoh.id", passwordHash: custPass, phone: "0857-2200-8811", role: "customer" },
        { name: "Rizky Pratama", email: "rizky@contoh.id", passwordHash: custPass, phone: "0821-9087-4455", role: "customer" },
        { name: "Dewi Anggraini", email: "dewi@contoh.id", passwordHash: custPass, phone: "0878-5566-1290", role: "customer" },
      ])
      .returning();
    void admin;

    // ---- Tur 360 ----
    const sc = await tx
      .insert(tourScenes)
      .values([
        {
          title: "Lobi & Cafe Utama",
          description: "Ruang cafe berinterior kayu hangat dengan jendela besar menghadap hutan pinus. Tempat favorit untuk menikmati kopi Lembang dan kue buatan dapur kami.",
          category: "Cafe",
          imageUrl: "/tour/lobby-cafe.jpg",
          sortOrder: 1,
        },
        {
          title: "Teras Senja",
          description: "Dek kayu terbuka dengan pemandangan lembah dan matahari terbenam. Pesan meja lebih awal untuk akhir pekan!",
          category: "Cafe",
          imageUrl: "/tour/teras-senja.jpg",
          sortOrder: 2,
        },
        {
          title: "Kolam Renang Infinity",
          description: "Kolam infinity menghadap perbukitan, buka setiap hari pukul 07.00 – 19.00 untuk tamu menginap.",
          category: "Kolam",
          imageUrl: "/tour/kolam-renang.jpg",
          sortOrder: 3,
        },
        {
          title: "Taman Resort",
          description: "Taman tropis dengan jalur batu, gazebo, dan deretan villa di antara pepohonan.",
          category: "Taman",
          imageUrl: "/tour/taman-resort.jpg",
          sortOrder: 4,
        },
        {
          title: "Interior Villa Keluarga",
          description: "Kamar tidur utama villa dengan tempat tidur king, pintu kaca menuju balkon, dan pemandangan hutan.",
          category: "Kamar",
          imageUrl: "/tour/kamar-villa.jpg",
          sortOrder: 5,
        },
      ])
      .returning();
    const [lobi, teras, kolam, taman, kamar] = sc;

    const hs = (rows: [number, string, number, number][]) =>
      rows.map(([targetId, label, yaw, pitch]) => ({ targetId, label, yaw, pitch }));
    const setHotspots = async (id: number, h: ReturnType<typeof hs>) => {
      await tx.update(tourScenes).set({ hotspots: h }).where(sql`id = ${id}`);
    };
    await setHotspots(lobi.id, hs([[teras.id, "Ke Teras Senja", 95, -8], [taman.id, "Ke Taman Resort", -80, -6]]));
    await setHotspots(teras.id, hs([[lobi.id, "Kembali ke Cafe", -100, -8], [kolam.id, "Ke Kolam Renang", 60, -10]]));
    await setHotspots(kolam.id, hs([[teras.id, "Ke Teras Senja", -120, -8], [taman.id, "Ke Taman Resort", 110, -8]]));
    await setHotspots(taman.id, hs([[kolam.id, "Ke Kolam Renang", -60, -8], [kamar.id, "Masuk Villa Keluarga", 40, -4], [lobi.id, "Ke Cafe Utama", 160, -8]]));
    await setHotspots(kamar.id, hs([[taman.id, "Keluar ke Taman", 170, -4]]));

    // ---- Unit ----
    const un = await tx
      .insert(units)
      .values([
        {
          name: "Kamar Deluxe Hutan",
          type: "kamar",
          description: "Kamar luas 32 m² dengan balkon pribadi menghadap hutan pinus, tempat tidur king, dan bathtub air hangat. Sarapan untuk 2 orang termasuk.",
          price: 850000, capacity: 2, quantity: 6,
          imageUrl: "/img/kamar-deluxe.jpg",
          facilities: ["Sarapan 2 orang", "Wi-Fi cepat", "Air hangat", "Balkon pribadi", "Smart TV"],
          sceneId: kamar.id,
        },
        {
          name: "Kamar Superior Taman",
          type: "kamar",
          description: "Kamar nyaman 24 m² dengan akses langsung ke taman tropis. Pilihan hemat untuk pasangan maupun solo traveler.",
          price: 625000, capacity: 2, quantity: 8,
          imageUrl: "/img/kamar-2.jpg",
          facilities: ["Sarapan 2 orang", "Wi-Fi cepat", "Air hangat", "Teras taman"],
          sceneId: taman.id,
        },
        {
          name: "Villa Keluarga Pinus",
          type: "villa",
          description: "Villa 2 kamar tidur dengan ruang keluarga, dapur kecil, dan teras luas. Cocok untuk liburan keluarga hingga 6 orang.",
          price: 2100000, capacity: 6, quantity: 3,
          imageUrl: "/img/taman-hotel.jpg",
          facilities: ["2 kamar tidur", "Dapur kecil", "Sarapan 6 orang", "Parkir pribadi", "Akses kolam"],
          sceneId: kamar.id,
        },
        {
          name: "Villa Private Pool",
          type: "villa",
          description: "Villa premium dengan kolam renang pribadi dan pemandangan perbukitan. Pilihan terbaik untuk bulan madu dan perayaan spesial.",
          price: 3250000, capacity: 4, quantity: 2,
          imageUrl: "/img/villa-kolam.jpg",
          facilities: ["Kolam pribadi", "Butler layanan kamar", "Sarapan 4 orang", "Bathtub outdoor", "Dekorasi romantis"],
          sceneId: kolam.id,
        },
        {
          name: "Meja Teras Senja",
          type: "meja",
          description: "Meja di dek kayu terbuka dengan pemandangan matahari terbenam. Biaya reservasi dihitung sebagai deposit dan dipotong dari total tagihan.",
          price: 75000, capacity: 4, quantity: 12,
          imageUrl: "/img/hero-resort.jpg",
          facilities: ["Pemandangan senja", "Lampu gantung", "Area merokok"],
          sceneId: teras.id,
        },
        {
          name: "Meja Lounge Indoor",
          type: "meja",
          description: "Meja di dalam cafe berpendingin udara, nyaman untuk bekerja atau berkumpul. Tersedia colokan listrik dan Wi-Fi.",
          price: 50000, capacity: 6, quantity: 8,
          imageUrl: "/img/cafe-interior.jpg",
          facilities: ["Ber-AC", "Colokan listrik", "Wi-Fi cepat"],
          sceneId: lobi.id,
        },
        {
          name: "Aula Rimba (Gathering & Pernikahan)",
          type: "aula",
          description: "Aula semi-terbuka berkapasitas hingga 80 orang dengan taman di sekelilingnya. Untuk gathering, lamaran, dan resepsi intim.",
          price: 5500000, capacity: 80, quantity: 1,
          imageUrl: "/img/kopi-kue.jpg",
          facilities: ["Sound system", "Proyektor", "Katering opsional", "Dekorasi dasar"],
          sceneId: taman.id,
          isActive: true,
        },
      ])
      .returning();
    const [deluxe, superior, villaK, villaP, mejaT, mejaL, aula] = un;

    // ---- Reservasi ----
    type R = {
      user: number; unit: typeof deluxe; inOff: number; nights: number; qty: number; guests: number;
      status: string; notes?: string; time?: string; adminNote?: string; created: number;
      pay?: { bank: string; sender: string; status: string };
    };
    const single = (u: typeof deluxe) => u.type === "meja" || u.type === "aula";
    const list: R[] = [
      { user: budi.id, unit: deluxe, inOff: 5, nights: 2, qty: 1, guests: 2, status: "dikonfirmasi", notes: "Mohon kamar lantai atas.", created: -4, pay: { bank: "BCA", sender: "Budi Santoso", status: "diterima" } },
      { user: budi.id, unit: mejaT, inOff: 2, nights: 1, qty: 2, guests: 6, status: "menunggu_konfirmasi", time: "17:30", notes: "Ulang tahun anak, mohon dekat railing.", created: -1, pay: { bank: "Mandiri", sender: "Budi S", status: "menunggu" } },
      { user: budi.id, unit: villaK, inOff: 20, nights: 3, qty: 1, guests: 5, status: "menunggu_pembayaran", created: 0 },
      { user: budi.id, unit: superior, inOff: -30, nights: 2, qty: 1, guests: 2, status: "selesai", created: -40, pay: { bank: "BCA", sender: "Budi Santoso", status: "diterima" } },
      { user: sari.id, unit: villaP, inOff: 9, nights: 2, qty: 1, guests: 2, status: "dikonfirmasi", notes: "Bulan madu, mohon dekorasi bunga.", created: -6, pay: { bank: "BRI", sender: "Sari Wulandari", status: "diterima" } },
      { user: sari.id, unit: mejaL, inOff: 1, nights: 1, qty: 1, guests: 3, status: "menunggu_konfirmasi", time: "10:00", created: 0, pay: { bank: "BCA", sender: "Sari W", status: "menunggu" } },
      { user: rizky.id, unit: aula, inOff: 45, nights: 1, qty: 1, guests: 60, status: "menunggu_pembayaran", notes: "Gathering kantor, 60 orang.", created: 0 },
      { user: rizky.id, unit: deluxe, inOff: 14, nights: 1, qty: 2, guests: 4, status: "ditolak", adminNote: "Bukti transfer tidak sesuai nominal. Silakan buat reservasi ulang.", created: -8, pay: { bank: "Mandiri", sender: "Rizky P", status: "ditolak" } },
      { user: rizky.id, unit: mejaT, inOff: -12, nights: 1, qty: 1, guests: 4, status: "selesai", time: "18:00", created: -15, pay: { bank: "BCA", sender: "Rizky Pratama", status: "diterima" } },
      { user: dewi.id, unit: superior, inOff: 3, nights: 3, qty: 1, guests: 2, status: "dikonfirmasi", created: -3, pay: { bank: "BCA", sender: "Dewi Anggraini", status: "diterima" } },
      { user: dewi.id, unit: villaK, inOff: -20, nights: 2, qty: 1, guests: 6, status: "selesai", created: -30, pay: { bank: "Mandiri", sender: "Dewi A", status: "diterima" } },
      { user: dewi.id, unit: mejaL, inOff: -3, nights: 1, qty: 1, guests: 2, status: "dibatalkan", time: "15:00", created: -6 },
    ];

    let seq = 1;
    for (const r of list) {
      const checkIn = addDaysISO(todayISO(), r.inOff);
      const nights = single(r.unit) ? 1 : r.nights;
      const checkOut = single(r.unit) ? checkIn : addDaysISO(checkIn, nights);
      const total = r.unit.price * nights * r.qty;
      const createdAt = new Date(Date.now() + r.created * 86400000 - seq * 3600000);
      const [res] = await tx
        .insert(reservations)
        .values({
          code: `SR-${String(240100 + seq * 7)}`,
          userId: r.user,
          unitId: r.unit.id,
          checkIn,
          checkOut,
          arrivalTime: r.time ?? "",
          guests: r.guests,
          qty: r.qty,
          totalPrice: total,
          status: r.status,
          notes: r.notes ?? "",
          adminNote: r.adminNote ?? "",
          createdAt,
        })
        .returning();
      if (r.pay) {
        await tx.insert(payments).values({
          reservationId: res.id,
          bank: r.pay.bank,
          senderName: r.pay.sender,
          amount: total,
          paidAt: addDaysISO(todayISO(), Math.min(0, r.created)),
          proofUrl: "",
          note: "",
          status: r.pay.status,
          createdAt,
        });
      }
      seq++;
    }
  });
}
