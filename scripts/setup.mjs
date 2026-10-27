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

// Buang parameter yang mengganggu driver dari connection string:
// - `supa=...` bawaan integrasi Vercel Marketplace (tidak dikenal driver pg);
// - parameter TLS (sslmode/ssl/sslrootcert/sslcert/sslkey) — driver pg
//   menjadikan parameter URL sebagai pengganti opsi `ssl` dari kode,
//   sehingga harus dibuang agar setelan TLS dari sslFor() yang berlaku.
function cleanUrl(raw) {
  try {
    const u = new URL(raw);
    for (const p of ["supa", "sslmode", "ssl", "sslrootcert", "sslcert", "sslkey"]) {
      u.searchParams.delete(p);
    }
    return u.toString();
  } catch {
    return raw; // biarkan pg yang melaporkan bila URL tidak valid
  }
}

// Bila host adalah Supabase pooler, turunkan varian port 5432 (session mode —
// DDL tidak andal lewat transaction pooler 6543, dan koneksi direct
// db.<ref>.supabase.co hanya punya IPv6 sehingga sering tidak terhubung dari
// cloud builder). Hasilnya null bila tidak relevan / port sudah 5432.
function sessionVariant(cleaned) {
  try {
    const u = new URL(cleaned);
    if (!u.hostname.endsWith("pooler.supabase.com")) return null;
    if ((u.port || "5432") === "5432") return null;
    u.port = "5432";
    return u.toString();
  } catch {
    return null;
  }
}

// Daftar kandidat koneksi, dari yang paling sesuai DDL ke terakhir:
//   1. DIRECT_URL / POSTGRES_URL_NON_POOLING (5432) apa adanya;
//   2. varian session 5432 turunan dari URL pooler (POSTGRES_URL/DATABASE_URL);
//   3. URL runtime apa adanya (umumnya 6543) sebagai upaya terakhir.
// URL yang sama persis tidak diulang.
function connectionCandidates() {
  const seen = new Set();
  const candidates = [];
  const add = (source, raw) => {
    if (!raw) return;
    const cleaned = cleanUrl(raw);
    if (seen.has(cleaned)) return;
    seen.add(cleaned);
    candidates.push({ source, url: cleaned });
  };
  add("DIRECT_URL", process.env.DIRECT_URL);
  add("POSTGRES_URL_NON_POOLING", process.env.POSTGRES_URL_NON_POOLING);
  for (const [source, raw] of [
    ["POSTGRES_URL", process.env.POSTGRES_URL],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ]) {
    const sv = raw ? sessionVariant(cleanUrl(raw)) : null;
    if (sv) add(`${source} (port→5432)`, sv);
  }
  add("POSTGRES_URL", process.env.POSTGRES_URL);
  add("DATABASE_URL", process.env.DATABASE_URL);
  return candidates;
}

// Cerminkan logika TLS runtime (src/db/index.ts): Supabase memakai CA
// privat, jadi tanpa CA dari DATABASE_SSL_CA koneksi dienkripsi tanpa
// verifikasi sertifikat; host lain tetap terverifikasi penuh.
function sslFor(raw) {
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    /* fallback: perlakukan seperti host remote */
  }
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) return undefined;
  if (process.env.DATABASE_SSL === "disable") return undefined;
  if (process.env.DATABASE_SSL === "no-verify") return { rejectUnauthorized: false };
  const ca = process.env.DATABASE_SSL_CA;
  if (ca && ca.trim()) {
    return { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true };
  }
  if (host === "supabase.co" || host.endsWith(".supabase.co") || host.endsWith(".supabase.com")) {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

async function main() {
  console.log("=== Setup Senja Rimba: tabel + bucket + RLS ===\n");

  const candidates = connectionCandidates();
  if (candidates.length === 0) {
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

  // Coba kandidat satu per satu; pakai yang pertama berhasil connect.
  let pool = null;
  let lastError = null;
  for (const { source, url } of candidates) {
    let hostPort = "";
    try {
      const u = new URL(url);
      hostPort = `${u.hostname}:${u.port || 5432}`;
    } catch {
      /* hanya untuk tampilan */
    }
    const attempt = new Pool({
      connectionString: url,
      ssl: sslFor(url),
      max: 1,
      connectionTimeoutMillis: 10_000,
    });
    try {
      await attempt.query("select 1");
      console.log(`Terhubung via ${source} → ${hostPort || "database"}`);
      if (hostPort.endsWith(":6543")) {
        console.log(
          "Catatan: koneksi terpilih memakai port 6543 (transaction pooler). " +
            "Lanjut — bila DDL gagal, sediakan koneksi 5432 (DIRECT_URL / POSTGRES_URL_NON_POOLING).",
        );
      }
      pool = attempt;
      break;
    } catch (err) {
      lastError = err;
      console.log(
        `  ✗ ${source} (${hostPort || "?"}) gagal: ${err instanceof Error ? err.message : String(err)}`,
      );
      await attempt.end().catch(() => {});
    }
  }

  if (!pool) {
    console.error(
      "\nSemua kandidat koneksi gagal. Error terakhir:",
      lastError instanceof Error ? lastError.message : lastError,
    );
    console.error(
      "Periksa: project Supabase aktif dan tidak ter-pause? Password benar dan karakter " +
        "khususnya sudah di-URL-encode (@ → %40)? Bila memakai integrasi Marketplace, " +
        "pastikan resource Storage terhubung ke project Vercel ini.",
    );
    process.exit(1);
  }

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
