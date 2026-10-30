import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { barberDayCuts } from "@/lib/server/barber-sales";

export const dynamic = "force-dynamic";

/** Owner: one barber's finished cuts on one Manila day at one branch (?barberId&loc&date). Same source as the barber link History. */
export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const sp = new URL(req.url).searchParams;
  return json(await barberDayCuts(me.uid, { date: sp.get("date") || "", barberId: sp.get("barberId") || "", locationId: sp.get("loc") || "home" }));
}
