#!/usr/bin/env node
/**
 * Setup satu perintah untuk Supabase: membuat 6 tabel + bucket Storage + RLS.
 *
 * Menggabungkan dua langkah yang sebelumnya terpisah:
 *   1. `npm run db:push`            → di sini dijalankan sebagai migrasi Drizzle
 *   2. Menempel `supabase/setup.sql` di SQL Editor → di sini dieksekusi langsung
 *
 * Pemakaian:
 *   npm run setup
 *
 * Sumber kredensial (salah satu):
 *   - Jalur Vercel Marketplace: `npx vercel env pull .env.local` mengisi
 *     POSTGRES_URL_NON_POOLING / POSTGRES_URL secara otomatis.
 *   - Jalur manual: isi DIRECT_URL (session pooler, port 5432) di .env.local.
 *
 * Aman dijalankan berulang: migrasi dilewati bila 6 tabel sudah ada, dan
 * isi setup.sql bersifat idempotent (ON CONFLICT / IF EXISTS).
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Muat .env.local lalu .env. process.loadEnvFile tidak menimpa variabel yang
// sudah ter-set, jadi .env.local menang — sama seperti perilaku Next.js.
for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {
      /* file tidak terbaca — abaikan */
    }
  }
}

const TABLES = ["users", "sessions", "tour_scenes", "units", "reservations", "payments"];

// Utamakan koneksi non-pooling/session (5432): DDL tidak andal lewat
// transaction pooler (6543).
function resolveUrl() {
  const raw =
    process.env.DIRECT_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    "";
  if (!raw) return "";
  try {
    // Buang parameter `supa=...` bawaan integrasi yang tidak dikenal driver pg.
    const u = new URL(raw);
    if (u.searchParams.has("supa")) {
      u.searchParams.delete("supa");
      return u.toString();
    }
  } catch {
    /* biarkan pg yang melaporkan bila URL tidak valid */
  }
  return raw;
}

function sslFor(raw) {
  if (/[?&](sslmode|ssl)=/.test(raw)) return undefined; // hormati setelan di URL
  try {
    const host = new URL(raw).hostname;
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) return undefined;
  } catch {
    /* lanjut dengan TLS terverifikasi */
  }
  return { rejectUnauthorized: true };
}

async function main() {
  console.log("=== Setup Senja Rimba: tabel + bucket + RLS ===\n");

  const url = resolveUrl();
  if (!url) {
    console.error("Connection string tidak ditemukan. Pilih salah satu cara:\n");
    console.error("  A) Jalur mudah (Vercel Marketplace) — setelah Supabase dibuat dari");
    console.error("     dashboard Vercel dan terhubung ke project ini:\n");
    console.error("       npx vercel link");
    console.error("       npx vercel env pull .env.local\n");
    console.error("  B) Jalur manual — salin .env.example menjadi .env.local, lalu isi");
    console.error("     DIRECT_URL (session pooler, port 5432) dari dashboard Supabase.\n");
    console.error("Setelah itu jalankan lagi: npm run setup");
    process.exit(1);
  }

  let hostPort = "";
  try {
    const u = new URL(url);
    hostPort = `${u.hostname}:${u.port || 5432}`;
  } catch {
    /* hanya untuk tampilan */
  }
  console.log(`Menghubungkan ke ${hostPort || "database"} ...`);
  if (hostPort.endsWith(":6543")) {
    console.log(
      "Catatan: URL memakai port 6543 (transaction pooler). Migrasi idealnya lewat 5432 — lanjut mencoba, " +
        "bila gagal ganti ke DIRECT_URL / POSTGRES_URL_NON_POOLING.",
    );
  }

  const pool = new Pool({
    connectionString: url,
    ssl: sslFor(url),
    max: 1,
    connectionTimeoutMillis: 15_000,
  });

  try {
    // --- 1) Tabel -----------------------------------------------------------
    const { rows: found } = await pool.query(
      "select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)",
      [TABLES],
    );
    const existing = found.map((r) => r.table_name);

    if (existing.length === TABLES.length) {
      console.log("[1/2] 6 tabel sudah ada — migrasi dilewati.");
    } else if (existing.length === 0) {
      console.log("[1/2] Membuat 6 tabel (migrasi Drizzle)...");
      const db = drizzle(pool);
      await migrate(db, {
        migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
      });
      console.log("      Selesai.");
    } else {
      console.error(
        `\nHanya ${existing.length} dari 6 tabel ditemukan (${existing.join(", ")}).`,
      );
      console.error(
        "Ini biasanya berarti setup sebelumnya terputus di tengah. Jalankan `npm run db:push` " +
          "untuk menyelaraskan skema, lalu ulangi `npm run setup`.",
      );
      process.exitCode = 1;
      return;
    }

    // --- 2) Bucket + RLS -----------------------------------------------------
    console.log("[2/2] Membuat bucket Storage + mengunci RLS (supabase/setup.sql)...");
    const sql = readFileSync(new URL("../supabase/setup.sql", import.meta.url), "utf8");
    await pool.query(sql);
    console.log("      Selesai.");

    // --- Verifikasi ----------------------------------------------------------
    const t = await pool.query(
      "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename = any($1) and rowsecurity",
      [TABLES],
    );
    const b = await pool.query(
      "select id, public from storage.buckets where id in ('media', 'bukti-transfer') order by id",
    );
    console.log("\nHasil verifikasi:");
    console.log(`  - Tabel dengan RLS aktif : ${t.rows[0].n}/6`);
    console.log(
      `  - Bucket                 : ${
        b.rows.map((r) => `${r.id} (${r.public ? "publik" : "privat"})`).join(", ") || "-"
      }`,
    );

    console.log("\nSetup selesai ✅  Langkah berikutnya:");
    console.log("  1. Di Vercel: Deployments → ⋯ → Redeploy (atau git push untuk memicu deploy).");
    console.log("  2. Buka https://<url-anda>.vercel.app/api/health — harus sukses.");
    console.log("  3. Buat admin pertama: daftar lewat /daftar, lalu di SQL Editor jalankan:");
    console.log("     update public.users set role = 'admin' where email = 'email-anda@domain.com';");
  } catch (err) {
    console.error("\nGagal:", err instanceof Error ? err.message : err);
    console.error(
      "Periksa: project Supabase sudah aktif? URL memakai port 5432 (session/non-pooling)? " +
        "Password benar dan karakter khusus di dalamnya sudah di-URL-encode (@ → %40)?",
    );
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
