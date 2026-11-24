/**
 * GET/POST /api/order/jam-buka — jam buka cafe, dibaca dan diubah dari sini.
 *
 * ── KENAPA ADA ENDPOINT, BUKAN CUKUP DASHBOARD SUPABASE ─────────────
 *
 * Pemilik meminta jam 24 jam "sementara". Yang membuat itu berbahaya bukan
 * nilai 24 jam-nya, melainkan CARA mengubahnya: kalau satu-satunya jalan
 * adalah mengedit baris di dashboard Supabase, maka:
 *
 *   · salah ketik satu karakter (",", "-", titik) membuat nilai ditolak
 *     dan kafe diam-diam kembali ke jam lama;
 *   · tidak ada yang memberi tahu nilai itu TIDAK terbaca;
 *   · mengembalikannya ke jam normal menuntut orang yang sama hadir.
 *
 * Endpoint ini memvalidasi sebelum menyimpan, dan GET-nya melaporkan nilai
 * yang SEDANG BERLAKU beserta catatan bila nilai tersimpan tidak terbaca.
 */
import { NextResponse } from "next/server";
import { db, punyaEnvBaca, punyaKunciServer, PESAN_ENV_KOSONG } from "@/app/lib/order/db";
import { ambilJamBuka, bacaJamMingguan, CONTOH_24_JAM } from "@/app/lib/order/jam-buka";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!punyaEnvBaca()) {
    return NextResponse.json({ pesan: PESAN_ENV_KOSONG }, { status: 503 });
  }

  const aktif = await ambilJamBuka();

  return NextResponse.json({
    /* Nilai yang SEDANG BERLAKU — bukan sekedar isi kolom. */
    buka24Jam: aktif.buka24Jam,
    mentah: aktif.mentah,
    jam: aktif.jam,
    /* Kosong bila nilai tersimpan sah; berisi penjelasan bila tidak. */
    catatan: aktif.catatan,
    contoh24Jam: CONTOH_24_JAM,
  });
}

export async function POST(req: Request) {
  if (!punyaKunciServer()) {
    return NextResponse.json({ pesan: PESAN_ENV_KOSONG }, { status: 503 });
  }

  let badan: { nilai?: string };
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  const nilai = String(badan.nilai ?? "").trim();

  /*
    Divalidasi dengan fungsi yang SAMA yang membacanya nanti. Kalau
    validasi di sini dan pembacaan di `ambilJamBuka()` berbeda, akan ada
    nilai yang "berhasil disimpan" tetapi diabaikan saat dibaca — dan
    pemilik melihat jam yang tidak berubah tanpa penjelasan.
  */
  const jam = bacaJamMingguan(nilai);
  if (!jam) {
    return NextResponse.json(
      {
        pesan:
          'Format jam harus "HH.MM-HH.MM,HH.MM-HH.MM" — contoh 24 jam: ' + CONTOH_24_JAM,
      },
      { status: 400 }
    );
  }

  const r = await db("pengaturan", {
    method: "PATCH",
    q: "kunci=eq.jam_mingguan",
    body: { nilai },
  });

  if (!r.ok) {
    /*
      Baris belum ada. Ini terjadi pada database yang lebih lama dari
      migrasi. INSERT, bukan PATCH yang diam-diam tidak mengubah apa pun —
      PostgREST mengembalikan sukses untuk PATCH yang tidak mengenai baris,
      dan tanpa pemeriksaan ini pemilik mengira jamnya sudah tersimpan.
    */
    const ins = await db("pengaturan", {
      method: "POST",
      body: { kunci: "jam_mingguan", nilai, keterangan: "Jam buka mingguan" },
    });
    if (!ins.ok) return NextResponse.json({ pesan: ins.pesan }, { status: 502 });
  } else {
    // PATCH "sukses" tetapi nol baris terkena juga mungkin: periksa hasilnya.
    const cek = await db<{ nilai: string }[]>("pengaturan", {
      q: "select=nilai&kunci=eq.jam_mingguan&limit=1",
    });
    if (!cek.ok || cek.data.length === 0 || cek.data[0].nilai !== nilai) {
      return NextResponse.json(
        { pesan: "Jam tidak tersimpan. Periksa izin tulis kunci server." },
        { status: 502 }
      );
    }
  }

  await db("log_perubahan", {
    method: "POST",
    body: {
      siapa: "admin",
      aksi: "ubah_jam_buka",
      entitas: "pengaturan",
      entitas_id: "jam_mingguan",
      sebelum: null,
      sesudah: { nilai },
    },
  });

  const aktif = await ambilJamBuka();
  return NextResponse.json({ ok: true, buka24Jam: aktif.buka24Jam, mentah: aktif.mentah });
}
