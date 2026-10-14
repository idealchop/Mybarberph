import { badRequest, json, notFound } from "@/lib/server/auth";
import { getBooking, publicBooking } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** Status page polling. The booking id is the customer's unguessable receipt. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const shop = new URL(req.url).searchParams.get("shop");
  if (!shop) return badRequest("shop is required");
  const b = await getBooking(shop, (await params).id);
  return b ? json({ booking: publicBooking(b) }) : notFound("Booking not found");
}
