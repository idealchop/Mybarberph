import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { listActivity } from "@/lib/server/activity";

export const dynamic = "force-dynamic";

/** Owner: audit log. ?before=<ms>&loc=&role=&actor=&type= */
export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const sp = new URL(req.url).searchParams;
  const before = Number(sp.get("before")) || undefined;
  return json(await listActivity(me.uid, { before, loc: sp.get("loc") || undefined, role: sp.get("role") || undefined, actor: sp.get("actor") || undefined, type: sp.get("type") || undefined }));
}
