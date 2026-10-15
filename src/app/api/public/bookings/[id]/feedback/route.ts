import { badRequest, json } from "@/lib/server/auth";
import { logActivity } from "@/lib/server/activity";
import { publicBooking, saveFeedback } from "@/lib/server/shops";

/** Customer feedback after a finished visit. The booking id is the customer's receipt. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const b = (await req.json().catch(() => null)) as { shop?: string; rating?: number; comment?: string } | null;
  if (!b?.shop) return badRequest("shop is required");
  try {
    const saved = await saveFeedback(b.shop, (await params).id, Number(b.rating), String(b.comment ?? ""));
    if (saved.feedbackAt && Date.now() - saved.feedbackAt < 10_000) {
      await logActivity(b.shop, { type: "feedback", actor: { name: saved.customerLabel || "Customer", role: "customer" }, locationId: saved.locationId || "home", ref: saved.ref,
        text: `${saved.customerLabel || "A customer"} rated ${saved.ref} ${"★".repeat(saved.rating || 0)}${saved.feedback ? ` · “${saved.feedback.slice(0, 80)}”` : ""}` }, true);
    }
    return json({ booking: publicBooking(saved) });
  } catch (e) { return badRequest((e as Error).message); }
}
