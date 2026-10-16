import { badRequest, json } from "@/lib/server/auth";
import { createHomeBooking, type HomeBookingInput } from "@/lib/server/home-service";
import { riverAuth } from "@/lib/server/river";
import { publicBooking } from "@/lib/server/shops";

/** POST — create a home-service booking for a River Mobile customer (shows in the shop's Queue → Online with a Home tag). */
export async function POST(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const denied = riverAuth(req);
  if (denied) return denied;
  const b = (await req.json().catch(() => null)) as HomeBookingInput | null;
  if (!b) return badRequest("JSON body required");
  try {
    const row = await createHomeBooking((await params).shopId, b);
    return json({ booking: publicBooking(row) }, 201);
  } catch (e) { return badRequest((e as Error).message); }
}
