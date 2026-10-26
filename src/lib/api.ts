import "server-only";
import { getCurrentUser, type SessionUser } from "@/lib/auth";

export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function ok(data: unknown = { ok: true }, status = 200) {
  return Response.json(data, { status });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function apiUser(): Promise<SessionUser | Response> {
  const user = await getCurrentUser();
  if (!user) return fail("Silakan masuk terlebih dahulu.", 401);
  return user;
}

export async function apiAdmin(): Promise<SessionUser | Response> {
  const user = await getCurrentUser();
  if (!user) return fail("Silakan masuk terlebih dahulu.", 401);
  if (user.role !== "admin") return fail("Anda tidak memiliki akses.", 403);
  return user;
}

export function str(v: unknown, max = 500) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function int(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function isISODate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
