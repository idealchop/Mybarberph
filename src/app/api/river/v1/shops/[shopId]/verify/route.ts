import { badRequest, json } from "@/lib/server/auth";
import { riverAuth } from "@/lib/server/river";
import { publicBooking, verifyBooking } from "@/lib/server/shops";

/** POST { code } — verify a ticket code (e.g. BK-7K2Q9M) at this shop. Marks it verified. */
export async function POST(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const denied = riverAuth(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  if (!body?.code?.trim()) return badRequest("code is required");
  const r = await verifyBooking((await params).shopId, body.code);
  return json(r.ok ? { ok: true, booking: publicBooking(r.booking) } : { ok: false, reason: r.reason }, r.ok ? 200 : r.reason === "declined" ? 409 : 404);
}
