import { badRequest, getCaller, json, unauthorized } from "@/lib/server/auth";
import { ensureShop, putState, STATE_KEYS } from "@/lib/server/shops";

export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const { key } = await params;
  if (!STATE_KEYS[key]) return badRequest("Unknown key");
  const body = (await req.json().catch(() => null)) as { value?: unknown } | null;
  if (typeof body?.value !== "string") return badRequest("value must be a JSON string");
  try { JSON.parse(body.value); } catch { return badRequest("value is not JSON"); }
  await ensureShop(me.uid);
  try { await putState(me.uid, key, body.value); } catch (e) { return badRequest((e as Error).message); }
  return json({ ok: true });
}
