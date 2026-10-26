import { db } from "@/db";
import { units } from "@/db/schema";
import { apiAdmin, fail, int, ok, readJson, str } from "@/lib/api";
import { UNIT_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export function parseUnit(body: Record<string, unknown> | null) {
  if (!body) return { error: "Data tidak valid." } as const;
  const name = str(body.name, 120);
  const type = str(body.type, 20);
  if (name.length < 3) return { error: "Nama minimal 3 karakter." } as const;
  if (!UNIT_TYPES.some((t) => t.value === type)) return { error: "Tipe unit tidak valid." } as const;
  const price = int(body.price);
  const capacity = int(body.capacity, 1);
  const quantity = int(body.quantity, 1);
  if (price < 0) return { error: "Harga tidak boleh negatif." } as const;
  if (capacity < 1) return { error: "Kapasitas minimal 1." } as const;
  if (quantity < 1) return { error: "Jumlah unit minimal 1." } as const;
  const facilities = Array.isArray(body.facilities)
    ? (body.facilities as unknown[]).map((f) => str(f, 60)).filter(Boolean).slice(0, 20)
    : [];
  const sceneId = body.sceneId ? int(body.sceneId) : null;
  return {
    value: {
      name,
      type,
      description: str(body.description, 2000),
      price,
      capacity,
      quantity,
      imageUrl: str(body.imageUrl, 500),
      facilities,
      sceneId: sceneId && sceneId > 0 ? sceneId : null,
      isActive: body.isActive === false ? false : true,
    },
  } as const;
}

export async function POST(req: Request) {
  const admin = await apiAdmin();
  if (admin instanceof Response) return admin;
  const parsed = parseUnit(await readJson(req));
  if (parsed.error !== undefined) return fail(parsed.error);
  const [row] = await db.insert(units).values(parsed.value).returning();
  return ok(row, 201);
}
