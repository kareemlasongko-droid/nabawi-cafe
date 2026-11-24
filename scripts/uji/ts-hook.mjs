/**
 * Mendaftarkan loader untuk uji: impor tanpa ekstensi ("./db") diperlakukan
 * sebagai "./db.ts", seperti yang dilakukan bundler Next di kode aplikasi.
 *
 * Node bisa menjalankan TypeScript langsung (--experimental-strip-types),
 * tapi tidak menebak ekstensi. Kode aplikasi tidak boleh diubah hanya demi
 * alat uji, jadi penyesuaiannya ditaruh di sini.
 *
 * Pakai: node --experimental-strip-types --import ./scripts/uji/ts-hook.mjs <berkas-uji>
 */
import { register } from "node:module";

const kode = `
import { pathToFileURL } from "node:url";

/*
  Dua penyesuaian, keduanya hanya untuk alat uji:

  1. Impor tanpa ekstensi ("./db") → "./db.ts", seperti bundler Next.
  2. Alias "@/..." → berkas di akar repo. Tanpa ini, komponen React tidak
     bisa dirender di Node untuk diuji — padahal komponen itulah yang
     memuat teks dan alur yang perlu diperiksa (mis. pilihan metode
     pembayaran), bukan hanya fungsi lib.
*/
export async function resolve(specifier, context, next) {
  const akar = process.env.UJI_AKAR ?? process.cwd();

  if (specifier.startsWith("@/")) {
    const jalur = akar + "/" + specifier.slice(2);
    try {
      return await next(jalur, context);
    } catch {
      return next(jalur + ".ts", context);
    }
  }

  try {
    return await next(specifier, context);
  } catch (e) {
    if (specifier.startsWith(".") && !/\\.[a-z]+$/i.test(specifier)) {
      return next(specifier + ".ts", context);
    }
    throw e;
  }
}
`;

register("data:text/javascript," + encodeURIComponent(kode));
