import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { listNotifications, markNotificationsRead } from "@/lib/server/activity";
import { remitSummary } from "@/lib/server/remit";

export const dynamic = "force-dynamic";

/** Owner: notifications + unread count. ?count=1 returns only the count (bell badge). */
export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const countOnly = Boolean(new URL(req.url).searchParams.get("count"));
  // The bell badge only needs the count; the remit reminder is checked when the list is opened.
  const r = countOnly ? null : await remitSummary(me.uid, "all").catch(() => null);
  const remit = r ? { total: r.total, barbers: r.unclaimed.length, oldest: Math.min(Date.now(), ...r.unclaimed.map((u) => u.oldest)) } : undefined;
  const data = await listNotifications(me.uid, remit);
  return json(countOnly ? { unread: data.unread } : data);
}

/** Owner: mark read. { ids?: string[] } (omit ids = mark all read) */
export async function POST(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const b = (await req.json().catch(() => null)) as { ids?: string[] } | null;
  await markNotificationsRead(me.uid, Array.isArray(b?.ids) ? b.ids.filter((x) => typeof x === "string") : undefined);
  return json({ ok: true });
}
