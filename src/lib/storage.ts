import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Konfigurasi Supabase Storage (sisi server).
 *
 * Kenapa tidak menulis file ke disk lokal?
 * Vercel menjalankan function di filesystem READ-ONLY — satu-satunya lokasi yang
 * bisa ditulis adalah /tmp (ephemeral, tidak dibagi antar instance). Karena itu
 * semua unggahan dikirim langsung dari browser ke Supabase Storage memakai
 * signed upload URL, sehingga file tidak pernah melewati function dan batas
 * 4.5 MB body Vercel tidak berlaku.
 */

/** Bucket publik: foto unit, foto panorama 360°, gambar konten. */
export const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "media";

/** Bucket privat: bukti transfer. Hanya pemilik reservasi & admin yang bisa membuka. */
export const PROOF_BUCKET = process.env.SUPABASE_PROOF_BUCKET || "bukti-transfer";

export type BucketKind = "media" | "proof";

export function bucketFor(kind: BucketKind) {
  return kind === "proof" ? PROOF_BUCKET : MEDIA_BUCKET;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Apakah storage sudah dikonfigurasi? Dipakai untuk memberi pesan error yang jelas. */
export function storageConfigured() {
  return Boolean(supabaseUrl && serviceRoleKey);
}

let cached: SupabaseClient | null = null;

/**
 * Client dengan service_role key. HANYA boleh dipakai di server — key ini
 * bypass RLS dan tidak boleh pernah masuk ke bundle browser.
 */
export function adminStorage(): SupabaseClient {
  if (!storageConfigured()) {
    throw new Error(
      "Supabase Storage belum dikonfigurasi. Set NEXT_PUBLIC_SUPABASE_URL dan " +
        "SUPABASE_SERVICE_ROLE_KEY (lihat .env.example), lalu buat bucket '" +
        MEDIA_BUCKET +
        "' (public) dan '" +
        PROOF_BUCKET +
        "' (private).",
    );
  }
  if (!cached) {
    cached = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Batas aplikasi. Supabase Free sendiri membatasi 50 MB per file. */
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024;
