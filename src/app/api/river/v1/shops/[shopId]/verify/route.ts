import { badRequest, json } from "@/lib/server/auth";
import { withRiver } from "@/lib/server/river";
import { publicBooking, verifyBooking } from "@/lib/server/shops";
import { isRiverSource, toOrder } from "@/lib/river-status";

/** POST { code } — check-in: verify a ticket code (e.g. BK-7K2Q9M) at this shop. Scope checkin:write + Idempotency-Key. */
export async function POST(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  return withRiver(req, { scope: "checkin:write", write: true }, async (ctx) => {
    const body = ctx.body as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code : "";
    if (!code.trim()) return badRequest("code is required");
    const r = await verifyBooking((await params).shopId, code);
    if (!r.ok) return json({ ok: false, reason: r.reason }, r.reason === "not_found" ? 404 : 409);
    return json({ ok: true, booking: publicBooking(r.booking), ...(isRiverSource(r.booking.source) ? { order: toOrder(r.booking) } : {}) });
  });
}
