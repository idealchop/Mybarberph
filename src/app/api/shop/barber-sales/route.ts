import { getCaller, json, unauthorized } from "@/lib/server/auth";
import { barberSales } from "@/lib/server/barber-sales";

export const dynamic = "force-dynamic";

/** Owner: per-barber sales. ?range=week|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD&loc=<id|all> */
export async function GET(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const sp = new URL(req.url).searchParams;
  return json(await barberSales(me.uid, { range: sp.get("range"), from: sp.get("from"), to: sp.get("to"), loc: sp.get("loc") }));
}
