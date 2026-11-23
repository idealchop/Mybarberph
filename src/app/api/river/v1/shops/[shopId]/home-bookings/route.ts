import { badRequest, json } from "@/lib/server/auth";
import { createHomeBooking, type HomeBookingInput } from "@/lib/server/home-service";
import { withRiver } from "@/lib/server/river";
import { rememberRiverOrder } from "@/lib/server/river-orders";
import { publicBooking } from "@/lib/server/shops";
import { toOrder } from "@/lib/river-status";

/** POST — home-service booking for a River Mobile customer (Queue → Online with a Home tag). Scope orders:write + Idempotency-Key. */
export async function POST(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  return withRiver(req, { scope: "orders:write", write: true }, async (ctx) => {
    const b = ctx.body as (HomeBookingInput & { customer?: { ref?: string } }) | null;
    if (!b || typeof b !== "object") return badRequest("JSON body required");
    try {
      const shopId = (await params).shopId;
      const row = await createHomeBooking(shopId, { ...b, customerRef: typeof b.customer?.ref === "string" ? b.customer.ref : b.customerRef });
      await rememberRiverOrder(shopId, row.id);
      return json({ booking: publicBooking(row), order: toOrder(row) }, 201);
    } catch (e) { return badRequest((e as Error).message); }
  });
}
