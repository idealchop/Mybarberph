import { badRequest, json, notFound } from "@/lib/server/auth";
import { chairLink, linkBarber, putBooking, WalkInLimitError } from "@/lib/server/shops";

export async function PUT(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const link = await chairLink(token);
  if (!link) return notFound("This link has expired.");
  const body = (await req.json().catch(() => null)) as { booking?: Record<string, unknown> } | null;
  if (!body?.booking || body.booking.id !== id) return badRequest("booking.id must match the URL");
  try { return json({ booking: await putBooking(link.shopId, body.booking, await linkBarber(link.shopId, link.chairId)) }); } catch (e) { return e instanceof WalkInLimitError ? json({ error: e.message, limit: "walk-ins" }, 402) : badRequest((e as Error).message); }
}
