import type { ChairRequest } from "@/lib/booking-types";

const pesoText = (c?: number) => `₱${((c || 0) / 100).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
const payText = (b: Partial<ChairRequest>) => (!b.paid ? "not paid" : b.payMethod === "gcash" ? "GCash" : b.payMethod === "online" ? "online" : "cash");

/** Human lines for the details that changed between two saves of the same visit ("Name: Walk-in → Jay"). */
export function editChanges(a: Partial<ChairRequest>, b: Partial<ChairRequest>): string[] {
  const out: string[] = [];
  const txt = (v?: string) => (v ?? "").trim();
  const pair = (k: string, x: string, y: string) => { if (x !== y) out.push(`${k}: ${x || "none"} → ${y || "none"}`); };
  pair("Name", txt(a.customerLabel), txt(b.customerLabel));
  pair("Phone", txt(a.contact), txt(b.contact));
  pair("Service", txt(a.serviceName), txt(b.serviceName));
  if ((a.price || 0) !== (b.price || 0)) out.push(`Amount: ${pesoText(a.price)} → ${pesoText(b.price)}`);
  pair("Payment", payText(a), payText(b));
  if ((a.tip || 0) !== (b.tip || 0)) out.push(`Tip: ${pesoText(a.tip)} → ${pesoText(b.tip)}`);
  pair("Barber", txt(a.barberName), txt(b.barberName));
  if (txt(a.notes) !== txt(b.notes)) out.push(txt(b.notes) ? "Notes updated" : "Notes removed");
  return out;
}

