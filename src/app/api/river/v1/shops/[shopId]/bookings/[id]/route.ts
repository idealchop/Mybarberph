import { json, notFound } from "@/lib/server/auth";
import { riverAuth } from "@/lib/server/river";
import { getBooking, publicBooking } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** GET — booking/ticket status (requested → accepted → in_chair → done | declined). */
export async function GET(req: Request, { params }: { params: Promise<{ shopId: string; id: string }> }) {
  const denied = riverAuth(req);
  if (denied) return denied;
  const { shopId, id } = await params;
  const b = await getBooking(shopId, id);
  return b && b.source === "river" ? json({ booking: publicBooking(b) }) : notFound("Booking not found");
}
