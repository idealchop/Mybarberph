import { badRequest, json } from "@/lib/server/auth";
import { publicBooking, saveFeedback } from "@/lib/server/shops";

/** Customer feedback after a finished visit. The booking id is the customer's receipt. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const b = (await req.json().catch(() => null)) as { shop?: string; rating?: number; comment?: string } | null;
  if (!b?.shop) return badRequest("shop is required");
  try { return json({ booking: publicBooking(await saveFeedback(b.shop, (await params).id, Number(b.rating), String(b.comment ?? ""))) }); } catch (e) { return badRequest((e as Error).message); }
}
