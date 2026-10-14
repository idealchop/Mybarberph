import { badRequest, json } from "@/lib/server/auth";
import { createPublicBooking, publicBooking } from "@/lib/server/shops";

/** Customer books from the shop QR page. No account needed. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as (Record<string, string> & { serviceIds?: string[] }) | null;
  if (!b?.shopId) return badRequest("shopId is required");
  if (!b.contact?.trim()) return badRequest("Leave an email or mobile number.");
  try {
    const row = await createPublicBooking(b.shopId, { serviceId: b.serviceId, serviceIds: b.serviceIds, contact: b.contact, customerLabel: b.customerLabel, slotLabel: b.slotLabel, payWhere: b.payWhere, locationId: b.locationId, source: "qr" });
    return json({ booking: publicBooking(row) }, 201);
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
