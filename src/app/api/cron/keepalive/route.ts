import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Menjaga database Supabase paket Free tetap hidup.
 *
 * Supabase mem-pause project Free yang tidak menerima permintaan database
 * selama 7 hari berturut-turut, dan project yang di-pause membuat seluruh situs
 * error sampai di-resume manual dari dashboard. Route ini dipanggil terjadwal
 * (lihat "crons" di vercel.json) untuk menghasilkan aktivitas database mingguan.
 *
 * Vercel mengirim header `Authorization: Bearer <CRON_SECRET>` pada pemanggilan
 * terjadwal. Bila CRON_SECRET tidak di-set, route hanya menerima permintaan
 * dengan query `?key=` yang cocok — supaya tidak bisa dipanggil orang asing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const header = req.headers.get("authorization");
    const url = new URL(req.url);
    const queryKey = url.searchParams.get("key");
    const authorized = header === `Bearer ${secret}` || queryKey === secret;
    if (!authorized) {
      return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
    }
  } else if (process.env.VERCEL) {
    // Berjalan di Vercel tanpa CRON_SECRET: jangan biarkan endpoint terbuka.
    return Response.json(
      { error: "CRON_SECRET belum di-set. Tambahkan sebagai environment variable." },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      purpose: "keepalive",
      durationMs: Date.now() - startedAt,
      at: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Koneksi database gagal.",
      },
      { status: 500 },
    );
  }
}
