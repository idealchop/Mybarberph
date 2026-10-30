import { badRequest, json, notFound } from "@/lib/server/auth";
import { claimedBookingIds } from "@/lib/server/remit";
import { barberAccess, chairLink, getBooking, linkBarber, putBooking, WalkInLimitError } from "@/lib/server/shops";

/**
 * A barber link creates its own walk-ins and updates only its own visits, or accepts an open one waiting at its
 * location (see barberAccess). Another barber's visit answers 404, the same as a visit that doesn't exist.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const link = await chairLink(token);
  if (!link) return notFound("This link was replaced or turned off.");
  const body = (await req.json().catch(() => null)) as { booking?: Record<string, unknown> } | null;
  if (!body?.booking || body.booking.id !== id) return badRequest("booking.id must match the URL");
  const me = await linkBarber(link.shopId, link.chairId);
  if (!me) return notFound("This link was replaced or turned off.");
  const prev = await getBooking(link.shopId, id);
  if (prev && !barberAccess(prev, me)) return notFound("This visit is with another barber.");
  // Owner-claimed cash is locked for the barber (the claim's total must not change under the owner).
  if (prev?.status === "done" && (await claimedBookingIds(link.shopId)).has(id)) return json({ error: "The owner already claimed this cut. Ask the owner to change it.", code: "locked" }, 409);
  try { return json({ booking: await putBooking(link.shopId, body.booking, me) }); } catch (e) { return e instanceof WalkInLimitError ? json({ error: e.message, code: "plan_limit", limit: "walk-ins" }, 402) : badRequest((e as Error).message); }
}
