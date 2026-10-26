import { randomBytes } from "node:crypto";
import { apiUser, fail, ok, readJson, str } from "@/lib/api";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  adminStorage,
  bucketFor,
  storageConfigured,
  type BucketKind,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Langkah 1 dari unggah langsung (client-direct upload).
 *
 * Route ini TIDAK menerima file. Ia hanya memverifikasi bahwa pemanggil sudah
 * login, lalu menerbitkan signed upload URL berumur pendek untuk satu path acak.
 * Browser kemudian meng-PUT file-nya langsung ke Supabase Storage.
 *
 * Konsekuensinya: file tidak pernah melewati Vercel function, jadi batas body
 * 4.5 MB tidak berlaku dan tidak ada penulisan ke filesystem yang read-only.
 */
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;

  if (!storageConfigured()) {
    return fail(
      "Penyimpanan gambar belum dikonfigurasi di server. Hubungi administrator.",
      503,
    );
  }

  const body = await readJson(req);
  const kind: BucketKind = str(body?.kind, 10) === "proof" ? "proof" : "media";
  const contentType = str(body?.contentType, 60);
  const size = Number(body?.size);

  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) return fail("Format harus JPG, PNG, atau WebP.");
  if (!Number.isFinite(size) || size <= 0) return fail("Ukuran file tidak valid.");
  if (size > MAX_UPLOAD_BYTES) {
    return fail(`Ukuran file maksimal ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  }

  // Pelanggan hanya boleh mengunggah bukti transfer; foto unit/panorama khusus admin.
  if (kind === "media" && user.role !== "admin") {
    return fail("Anda tidak memiliki akses.", 403);
  }

  const bucket = bucketFor(kind);
  const path = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;

  try {
    const { data, error } = await adminStorage()
      .storage.from(bucket)
      // upsert: false — path selalu unik, jadi tidak akan menimpa file lain.
      .createSignedUploadUrl(path);
    if (error || !data?.token) {
      return fail(`Gagal membuat izin unggah: ${error?.message ?? "token kosong"}`, 502);
    }

    // `value` inilah yang disimpan ke database. Bentuknya tetap diawali
    // "/api/media/" agar validasi lama di route pembayaran tetap berlaku,
    // dan agar berkas privat tidak pernah bocor sebagai URL publik.
    return ok(
      {
        bucket,
        path,
        token: data.token,
        value: `/api/media/${kind}/${path}`,
        publicUrl: null,
      },
      201,
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal menyiapkan unggahan.", 502);
  }
}
