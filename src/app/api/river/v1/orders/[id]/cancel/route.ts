import { json } from "@/lib/server/auth";
import { problemResponse, withRiver } from "@/lib/server/river";
import { cancelRiverOrder } from "@/lib/server/river-orders";
import { publicBooking } from "@/lib/server/shops";
import { toOrder } from "@/lib/river-status";

/**
 * POST /api/river/v1/orders/{id}/cancel { reason? , shopId? } — customer cancel while requested or accepted.
 * Already cancelled → 200 (same order). Started, done or declined → 409. Scope orders:write + Idempotency-Key.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRiver(req, { scope: "orders:write", write: true }, async (ctx) => {
    const body = (ctx.body && typeof ctx.body === "object" ? ctx.body : {}) as { reason?: unknown; shopId?: unknown };
    if (body.reason !== undefined && (typeof body.reason !== "string" || body.reason.length > 200)) return problemResponse(400, "invalid_request");
    const r = await cancelRiverOrder((await params).id, body.reason as string | undefined, typeof body.shopId === "string" ? body.shopId : undefined);
    if (r.kind === "not_found") return problemResponse(404, "not_found");
    if (r.kind === "conflict") return problemResponse(409, "conflict");
    return json({ ...toOrder(r.booking), booking: publicBooking(r.booking) });
  });
}
