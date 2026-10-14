import { badRequest, getCaller, json, unauthorized } from "@/lib/server/auth";
import { verifyBooking } from "@/lib/server/shops";

/** Partner Scan: the shop scans a customer's booking code. */
export async function POST(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim();
  if (!code) return badRequest("Enter the booking code.");
  return json(await verifyBooking(me.uid, code));
}
