import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { attachDatabasePool } from "@vercel/functions/db-connections";

/**
 * URL database runtime.
 *
 * `POSTGRES_URL` adalah nama yang disinkronkan otomatis oleh integrasi
 * Supabase di Vercel Marketplace (transaction pooler). Kode menerima kedua
 * nama agar jalur Marketplace berjalan tanpa set env manual, sementara
 * `DATABASE_URL` tetap dipakai untuk setup manual/lokal.
 */
function resolveDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) return undefined;
  try {
    // Connection string dari integrasi bisa membawa parameter `supa=...`
    // yang tidak dikenal driver `pg` — buang agar tidak dikirim ke server.
    const u = new URL(raw);
    if (u.searchParams.has("supa")) {
      u.searchParams.delete("supa");
      return u.toString();
    }
  } catch {
    // Bukan URL valid — biarkan `pg` yang melaporkan errornya nanti.
  }
  return raw;
}

const databaseUrl = resolveDatabaseUrl();

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required — set DATABASE_URL atau POSTGRES_URL (integrasi Vercel Marketplace)",
  );
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Menentukan konfigurasi TLS.
 *
 * Latar belakang yang membuat fungsi ini perlu ada:
 * - Supabase menerima koneksi non-SSL secara default, jadi tanpa penanganan
 *   eksplisit lalu lintas ke database berjalan tanpa enkripsi.
 * - `pg` 8.x (lewat pg-connection-string >= 2.10) memperlakukan
 *   `sslmode=require` sebagai `verify-full`, BUKAN sekadar "encrypt" seperti
 *   libpq. Selain itu, bila `sslmode` ada di dalam URL, `pg` MENIMPA seluruh
 *   objek `ssl` yang kita kirim di kode. Karena itu keduanya tidak boleh
 *   dicampur — URL yang menang.
 * - Host pooler Supabase (*.pooler.supabase.com) memakai sertifikat dari CA
 *   publik sehingga verifikasi penuh berhasil. Host direct
 *   (db.<ref>.supabase.co) memakai CA internal Supabase dan akan gagal
 *   diverifikasi — itu salah satu alasan memakai pooler.
 */
function buildSslConfig(raw: string): PoolConfig["ssl"] {
  // Bila pengguna sudah menyetel sslmode/ssl di URL, hormati itu apa adanya.
  const hasSslParam = /[?&](sslmode|ssl|sslrootcert|sslcert|sslkey)=/.test(raw);
  if (hasSslParam) return undefined;

  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    host = "";
  }

  // Koneksi lokal (development) biasanya tanpa TLS.
  const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  if (isLocal) return undefined;

  const mode = (process.env.DATABASE_SSL || "").toLowerCase();
  if (mode === "disable" || mode === "off" || mode === "false") return undefined;
  // Escape hatch untuk penyedia bersertifikat CA privat yang tidak bisa
  // diverifikasi. Hindari dipakai bila tidak benar-benar perlu.
  if (mode === "no-verify") return { rejectUnauthorized: false };

  // Default: enkripsi + verifikasi sertifikat terhadap CA publik.
  return { rejectUnauthorized: true };
}

const poolConfig: PoolConfig = {
  connectionString: databaseUrl,
  // Per-instance. Vercel men-scale-out jumlah instance, jadi nilai besar di
  // sini dikalikan jumlah instance. Jangan diset ke 1: pada Fluid Compute itu
  // justru menurunkan concurrency tanpa mengurangi total koneksi.
  max: num(process.env.PGPOOL_MAX, 10),
  // Singkat agar instance yang membeku cepat melepas koneksi ke Postgres.
  idleTimeoutMillis: num(process.env.PGPOOL_IDLE_MS, 10_000),
  // Gagal cepat alih-alih menumpuk antrean saat database penuh.
  connectionTimeoutMillis: num(process.env.PGPOOL_CONNECT_TIMEOUT_MS, 5_000),
};

const ssl = buildSslConfig(databaseUrl);
if (ssl) poolConfig.ssl = ssl;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function createPool(): Pool {
  const p = new Pool(poolConfig);
  // Mencegah error koneksi yang tidak tertangani menjatuhkan proses.
  p.on("error", (err) => {
    console.error("[db] idle client error:", err.message);
  });
  return p;
}

export const pool = globalForDb.__arenaNextJsPostgresqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

// Di Vercel, ini menahan function sebentar setelah request selesai agar
// koneksi idle sempat ditutup sebelum instance dibekukan — mengurangi
// kebocoran koneksi ke Postgres. No-op di luar Vercel.
try {
  attachDatabasePool(pool);
} catch (err) {
  console.warn("[db] attachDatabasePool dilewati:", err instanceof Error ? err.message : err);
}

export const db = drizzle(pool);
