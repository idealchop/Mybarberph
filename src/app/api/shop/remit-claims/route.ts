import { badRequest, getCaller, json, unauthorized } from "@/lib/server/auth";
import { logActivity, OWNER } from "@/lib/server/activity";
import { peso } from "@/lib/format";
import { claimRemit, remitSummary } from "@/lib/server/remit";

export const dynamic = "force-dynamic";

/** Owner only: unclaimed barber remit + recent claims. ?loc=<id|all> */
export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  return json(await remitSummary(me.uid, new URL(req.url).searchParams.get("loc") || "all"));
}

/** Owner only: { barberId, locationId, day? } → claims all of that barber's unclaimed cash at that location. */
export async function POST(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const b = (await req.json().catch(() => null)) as { barberId?: string; locationId?: string; day?: string; received?: number } | null;
  if (!b?.barberId || !b.locationId) return badRequest("barberId and locationId are required");
  try {
    const day = typeof b.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.day) ? b.day : undefined;
    const received = typeof b.received === "number" && Number.isFinite(b.received) && b.received >= 0 && b.received <= 10_000_000 ? b.received : undefined;
    if (b.received !== undefined && received === undefined) return badRequest("Enter a valid amount");
    const claim = await claimRemit(me.uid, b.barberId, b.locationId, me.email || me.phone || me.uid, day, received);
    await logActivity(me.uid, { type: "remit_claimed", actor: OWNER, locationId: claim.locationId, amount: claim.amount, text: `Owner claimed ${peso(claim.adjusted ? claim.received ?? claim.amount : claim.amount)}${claim.adjusted ? ` (adjusted from ${peso(claim.expected ?? 0)})` : ""} cash from ${claim.barberName}${day ? ` for ${day}` : ""} · ${claim.bookingIds.length} haircut${claim.bookingIds.length === 1 ? "" : "s"}` });
    return json({ claim: { ...claim, count: claim.bookingIds.length, bookingIds: undefined } });
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
