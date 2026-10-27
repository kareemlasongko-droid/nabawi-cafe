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
 * Menentukan konfigurasi TLS. Urutan keputusan (pertama yang cocok menang):
 *
 * 1. Host lokal                       → tanpa TLS (development).
 * 2. DATABASE_SSL=disable             → tanpa TLS.
 * 3. DATABASE_SSL=no-verify           → enkripsi, sertifikat tidak diverifikasi.
 * 4. DATABASE_SSL_CA terisi (PEM)     → enkripsi + verifikasi terhadap CA tsb.
 * 5. Host Supabase tanpa CA di atas   → enkripsi tanpa verifikasi.
 * 6. Host lain                        → enkripsi + verifikasi CA publik.
 *
 * Kenapa ada langkah 5: sertifikat Supabase — direct (db.<ref>.supabase.co)
 * MAUPUN pooler (*.pooler.supabase.com) — berantai ke root CA privat Supabase
 * yang tidak ada di trust store Node, jadi verifikasi terhadap CA publik
 * selalu gagal dengan SELF_SIGNED_CERT_IN_CHAIN (terverifikasi live lewat
 * /api/health, 2026-10-27). Unduh sertifikat CA dari dashboard Supabase
 * (Database → SSL → Download certificate) dan isi DATABASE_SSL_CA untuk
 * naik ke langkah 4 kapan saja tanpa mengubah kode.
 *
 * Parameter TLS di connection string sudah dibuang resolveDatabaseUrl(),
 * karena selama `sslmode` dkk. ada di URL, pg MENIMPA objek `ssl` dari kode.
 * Perlu diingat juga: pg 8.x memperlakukan sslmode=require sebagai
 * verify-full, bukan "encrypt saja" seperti libpq.
 */
function buildSslConfig(raw: string): PoolConfig["ssl"] {
  let host = "";
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    host = "";
  }

  // 1) Koneksi lokal (development) biasanya tanpa TLS.
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) return undefined;

  const mode = (process.env.DATABASE_SSL || "").toLowerCase();
  // 2) Dimatikan eksplisit.
  if (mode === "disable" || mode === "off" || mode === "false") return undefined;
  // 3) Enkripsi tanpa verifikasi, atas permintaan eksplisit.
  if (mode === "no-verify") return { rejectUnauthorized: false };

  // 4) Verifikasi penuh terhadap CA kustom (mis. root CA Supabase).
  //    Nilai env boleh berisi PEM asli atau dengan newline ter-escape (\n).
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n").trim();
  if (ca) return { ca, rejectUnauthorized: true };

  // 5) Host Supabase tanpa CA di atas: enkripsi tanpa verifikasi, karena
  //    verifikasi terhadap CA publik pasti gagal (CA privat Supabase).
  const isSupabaseHost = host.endsWith(".supabase.co") || host.endsWith(".supabase.com");
  if (isSupabaseHost) {
    console.warn(
      "[db] TLS ke Supabase tanpa verifikasi sertifikat (DATABASE_SSL_CA belum di-set). " +
        "Isi DATABASE_SSL_CA dengan sertifikat CA dari dashboard Supabase untuk verifikasi penuh.",
    );
    return { rejectUnauthorized: false };
  }

  // 6) Default: enkripsi + verifikasi sertifikat terhadap CA publik.
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
