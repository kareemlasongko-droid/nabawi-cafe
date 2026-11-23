/**
 * Konfigurasi build @opennextjs/cloudflare.
 *
 * Isinya sengaja MINIMAL. Setiap override di sini (cache, tag, queue)
 * menambah satu hal yang harus benar sebelum halaman pertama tampil, dan
 * repo ini belum membutuhkannya:
 *   · tidak ada halaman ISR/statis yang perlu cache lintas permintaan
 *     (semua route data memakai `dynamic = "force-dynamic"`);
 *   · /menu sengaja dinamis.
 *
 * Kalau nanti cache dibutuhkan, tambahkan `incrementalCache` di sini DAN
 * binding `NEXT_INC_CACHE_R2_BUCKET` di wrangler.jsonc — keduanya harus
 * berpasangan; satu tanpa yang lain gagal saat runtime, bukan saat build.
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
