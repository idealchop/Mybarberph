import { badRequest, json } from "@/lib/server/auth";
import { riverAuth } from "@/lib/server/river";
import { createPublicBooking, publicBooking } from "@/lib/server/shops";

/** POST — create a booking/ticket for a River Mobile customer. It shows in the shop's Queue → Online. */
export async function POST(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const denied = riverAuth(req);
  if (denied) return denied;
  const b = (await req.json().catch(() => null)) as (Record<string, string> & { serviceIds?: string[] }) | null;
  if (!b) return badRequest("JSON body required");
  if (!b.customerName?.trim()) return badRequest("customerName is required");
  try {
    const row = await createPublicBooking((await params).shopId, {
      serviceId: b.serviceId, serviceIds: b.serviceIds, contact: b.contact, customerLabel: b.customerName, slotLabel: b.slotLabel,
      payWhere: b.payWhere, locationId: b.locationId, externalId: b.externalId, source: "river",
    });
    return json({ booking: publicBooking(row) }, 201);
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
