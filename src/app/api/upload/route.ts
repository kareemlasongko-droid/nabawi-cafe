import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { apiUser, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX = 12 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("File tidak ditemukan.");
  const ext = TYPES[file.type];
  if (!ext) return fail("Format harus JPG, PNG, atau WebP.");
  if (file.size > MAX) return fail("Ukuran file maksimal 12 MB.");
  const dir = path.join(process.cwd(), "uploads");
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return ok({ url: `/api/media/${name}` }, 201);
}
