import { badRequest, json } from "@/lib/server/auth";
import { withRiver } from "@/lib/server/river";
import { rememberRiverOrder } from "@/lib/server/river-orders";
import { createPublicBooking, publicBooking } from "@/lib/server/shops";
import { RIVER_MOBILE_SOURCE, toOrder } from "@/lib/river-status";

type Body = Record<string, unknown> & { serviceIds?: string[]; customer?: { ref?: string; name?: string; phoneE164?: string } };
const s = (v: unknown) => (typeof v === "string" ? v : undefined);

/** POST — create a ticket for a River Mobile customer (source river_mobile). It shows in the shop's Queue → Online as requested. Scope orders:write + Idempotency-Key. */
export async function POST(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  return withRiver(req, { scope: "orders:write", write: true }, async (ctx) => {
    const b = ctx.body as Body | null;
    if (!b || typeof b !== "object") return badRequest("JSON body required");
    const customer = b.customer && typeof b.customer === "object" ? b.customer : undefined;
    const name = (s(b.customerName) ?? s(customer?.name) ?? "").trim();
    if (!name) return badRequest("customerName is required");
    try {
      const shopId = (await params).shopId;
      const row = await createPublicBooking(shopId, {
        serviceId: s(b.serviceId), serviceIds: Array.isArray(b.serviceIds) ? b.serviceIds.filter((x): x is string => typeof x === "string") : undefined,
        contact: s(b.contact) ?? s(customer?.phoneE164), customerLabel: name, slotLabel: s(b.slotLabel),
        payWhere: s(b.payWhere), locationId: s(b.locationId), externalId: s(b.externalId) ?? s(b.externalRef), customerRef: s(customer?.ref),
        source: RIVER_MOBILE_SOURCE,
      });
      await rememberRiverOrder(shopId, row.id);
      return json({ booking: publicBooking(row), order: toOrder(row) }, 201);
    } catch (e) {
      return badRequest((e as Error).message);
    }
  });
}
