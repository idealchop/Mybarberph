import { json, notFound } from "@/lib/server/auth";
import { withRiver } from "@/lib/server/river";
import { getBooking, publicBooking } from "@/lib/server/shops";
import { isRiverSource, toOrder } from "@/lib/river-status";

export const dynamic = "force-dynamic";

/** GET — River Mobile ticket status. `booking.status` is Barbers.ph's word; `order.status` is the shared contract status. Scope orders:read. */
export async function GET(req: Request, { params }: { params: Promise<{ shopId: string; id: string }> }) {
  return withRiver(req, { scope: "orders:read" }, async () => {
    const { shopId, id } = await params;
    const b = await getBooking(shopId, id);
    return b && isRiverSource(b.source) ? json({ booking: publicBooking(b), order: toOrder(b) }) : notFound("Booking not found");
  });
}
