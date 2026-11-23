import { json } from "@/lib/server/auth";
import { problemResponse, withRiver } from "@/lib/server/river";
import { checkInRiverOrder } from "@/lib/server/river-orders";
import { publicBooking } from "@/lib/server/shops";
import { toOrder } from "@/lib/river-status";

/**
 * POST /api/river/v1/orders/{id}/check-in { code?, shopId? } — same check-in as POST /shops/{shopId}/verify,
 * with the ticket reference as the code. Scope checkin:write + Idempotency-Key.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRiver(req, { scope: "checkin:write", write: true }, async (ctx) => {
    const body = (ctx.body && typeof ctx.body === "object" ? ctx.body : {}) as { code?: unknown; shopId?: unknown };
    const r = await checkInRiverOrder((await params).id, typeof body.code === "string" ? body.code : undefined, typeof body.shopId === "string" ? body.shopId : undefined);
    if (r.kind === "not_found") return problemResponse(404, "not_found");
    if (r.kind === "conflict") return problemResponse(409, "conflict");
    return json({ ...toOrder(r.booking), booking: publicBooking(r.booking) });
  });
}
