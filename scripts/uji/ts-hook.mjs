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
export async function resolve(specifier, context, next) {
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
