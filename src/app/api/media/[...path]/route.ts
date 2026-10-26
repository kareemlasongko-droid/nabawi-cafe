import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, reservations } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { bucketFor, storageConfigured, adminStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Umur signed URL untuk berkas privat (detik). */
const PROOF_URL_TTL = 300;

const notFound = (msg = "Berkas tidak ditemukan.") =>
  new Response(msg, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * Menyajikan gambar dari Supabase Storage.
 *
 * Bentuk URL yang disimpan di database:
 *   /api/media/media/<nama>   → bucket publik (foto unit & panorama 360°)
 *   /api/media/proof/<nama>   → bucket privat (bukti transfer)
 *
 * Route ini tidak mem-proxy byte gambar (itu akan membebani function dan kena
 * batas 4.5 MB response Vercel). Ia menjawab 302 ke URL Supabase, sehingga
 * browser mengambil gambarnya langsung dari CDN/storage.
 *
 * Prefix "/api/media/" sengaja dipertahankan agar nilai lama di kolom
 * proof_url / image_url tetap valid dan tidak perlu migrasi data.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const segments = (await ctx.params).path ?? [];
  const [kindRaw, ...rest] = segments;
  const objectPath = rest.join("/");

  if (!objectPath || !/^[\w.-]+$/.test(objectPath)) return notFound();

  // Nilai warisan dari versi penyimpanan-disk-lokal: tidak ada lagi berkasnya.
  if (kindRaw !== "media" && kindRaw !== "proof") {
    return notFound(
      "Berkas ini diunggah sebelum migrasi ke Supabase Storage dan tidak tersedia lagi. " +
        "Silakan unggah ulang.",
    );
  }

  if (!storageConfigured()) return notFound("Penyimpanan gambar belum dikonfigurasi di server.");

  const bucket = bucketFor(kindRaw);
  const storedValue = `/api/media/${kindRaw}/${objectPath}`;

  try {
    // ---- Bucket publik: cukup arahkan ke URL publik, tanpa autentikasi. ----
    if (kindRaw === "media") {
      const { data } = adminStorage().storage.from(bucket).getPublicUrl(objectPath);
      return redirect(data.publicUrl, "public, max-age=31536000, immutable");
    }

    // ---- Bucket privat: wajib login, lalu cek kepemilikan. ----
    const user = await getCurrentUser();
    if (!user) {
      return new Response("Silakan masuk terlebih dahulu.", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const [payment] = await db
      .select({ ownerId: reservations.userId, status: reservations.status })
      .from(payments)
      .innerJoin(reservations, eq(reservations.id, payments.reservationId))
      .where(eq(payments.proofUrl, storedValue))
      .limit(1);

    // Admin boleh membuka semua bukti. Pelanggan hanya miliknya sendiri.
    // Catatan: bila baris tidak ditemukan (mis. bukti diunggah tapi form belum
    // dikirim), pengunggah tetap diizinkan melihat pratinjau miliknya sendiri.
    if (user.role !== "admin" && payment && payment.ownerId !== user.id) {
      return new Response("Anda tidak memiliki akses.", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const { data, error } = await adminStorage()
      .storage.from(bucket)
      .createSignedUrl(objectPath, PROOF_URL_TTL);
    if (error || !data?.signedUrl) return notFound();

    // Jangan di-cache bersama: URL-nya per-pengguna dan berumur pendek.
    return redirect(data.signedUrl, "private, no-store");
  } catch {
    return notFound();
  }
}

function redirect(location: string, cacheControl: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": cacheControl },
  });
}
