import { badRequest, getCaller, json, unauthorized } from "@/lib/server/auth";
import { claimRemit, remitSummary } from "@/lib/server/remit";

export const dynamic = "force-dynamic";

/** Owner only: unclaimed barber remit + recent claims. ?loc=<id|all> */
export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  return json(await remitSummary(me.uid, new URL(req.url).searchParams.get("loc") || "all"));
}

/** Owner only: { barberId, locationId } → claims all of that barber's unclaimed cash at that location. */
export async function POST(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const b = (await req.json().catch(() => null)) as { barberId?: string; locationId?: string } | null;
  if (!b?.barberId || !b.locationId) return badRequest("barberId and locationId are required");
  try {
    const claim = await claimRemit(me.uid, b.barberId, b.locationId, me.email || me.phone || me.uid);
    return json({ claim: { ...claim, count: claim.bookingIds.length, bookingIds: undefined } });
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
