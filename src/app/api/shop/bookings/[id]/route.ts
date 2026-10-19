import { badRequest, getCaller, json, unauthorized } from "@/lib/server/auth";
import { deleteBooking, ensureShop, putBooking, WalkInLimitError } from "@/lib/server/shops";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { booking?: Record<string, unknown> } | null;
  if (!body?.booking || body.booking.id !== id) return badRequest("booking.id must match the URL");
  await ensureShop(me.uid);
  try { return json({ booking: await putBooking(me.uid, body.booking) }); } catch (e) { return e instanceof WalkInLimitError ? json({ error: e.message, code: "plan_limit", limit: "walk-ins" }, 402) : badRequest((e as Error).message); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  await deleteBooking(me.uid, (await params).id);
  return json({ ok: true });
}
