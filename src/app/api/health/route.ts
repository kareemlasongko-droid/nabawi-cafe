import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    await ensureSeed().catch(() => undefined);
    return Response.json({ ok: true });
  } catch (err) {
    // Sertakan ringkasan error untuk diagnosis. Aman: pesan error `pg`
    // tidak pernah memuat password/connection string — isinya seperti
    // "password authentication failed", "getaddrinfo ENOTFOUND ...",
    // atau "Tenant or user not found". Error asli dari pg biasanya ada
    // di `cause` karena Drizzle membungkusnya.
    const cause = (err as { cause?: { message?: string; code?: string } })?.cause;
    const message = cause?.message ?? (err as Error)?.message ?? "unknown error";
    const code = cause?.code ?? (err as { code?: string })?.code ?? null;
    return Response.json(
      { ok: false, error: String(message).slice(0, 300), code },
      { status: 500 },
    );
  }
}
