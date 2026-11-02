import { badRequest, getCaller, json, unauthorized } from "@/lib/server/auth";
import { saveClaimAdjust } from "@/lib/server/remit";

export const dynamic = "force-dynamic";

/** Owner only (v1.0.40): { barberId, locationId, day, received } → saves that day's To claim amount (any amount). */
export async function PUT(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const b = (await req.json().catch(() => null)) as { barberId?: string; locationId?: string; day?: string; received?: number } | null;
  if (!b?.barberId || !b.locationId || typeof b.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.day)) return badRequest("barberId, locationId and day are required");
  if (typeof b.received !== "number" || !Number.isFinite(b.received) || b.received < 0 || b.received > 1_000_000_000) return badRequest("Enter a valid amount");
  try { return json({ adjust: await saveClaimAdjust(me.uid, b.barberId, b.locationId, b.day, Math.round(b.received)) }); }
  catch (e) { return badRequest((e as Error).message); }
}
