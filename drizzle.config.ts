import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Konfigurasi Drizzle Kit.
 *
 * Sengaja berbentuk .ts (bukan .json) supaya bisa membaca environment
 * variable — file JSON statis tidak bisa, sehingga kredensial database
 * terpaksa di-hardcode di dalamnya.
 *
 * PENTING untuk Supabase: jalankan migrasi lewat koneksi SESSION (port 5432)
 * atau direct, bukan transaction pooler (port 6543). DDL dan beberapa perintah
 * Postgres native tidak andal di transaction mode.
 *
 *   DIRECT_URL  → untuk drizzle-kit (generate / migrate / push / studio)
 *   DATABASE_URL→ untuk aplikasi runtime (transaction pooler di Vercel)
 */
const url =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
