import { badRequest, getCaller, json, unauthorized } from "@/lib/server/auth";
import { logActivity, OWNER } from "@/lib/server/activity";
import { verifyBooking } from "@/lib/server/shops";

/** Partner Scan: the shop scans a customer's booking code. */
export async function POST(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim();
  if (!code) return badRequest("Enter the booking code.");
  const r = await verifyBooking(me.uid, code);
  await logActivity(me.uid, { type: "qr_scanned", actor: OWNER, ref: code.toUpperCase(), text: r.ok ? `Owner scanned ticket ${code.toUpperCase()}` : `Owner scanned ${code.toUpperCase()} · no matching ticket` });
  return json(r);
}
