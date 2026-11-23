import { badRequest, json } from "@/lib/server/auth";
import { homeSlotsFor } from "@/lib/server/home-service";
import { withRiver } from "@/lib/server/river";

export const dynamic = "force-dynamic";

/** GET …/home-service/slots?locationId=&date=YYYY-MM-DD&barberId= — free 30-minute start times (Asia/Manila). Scope shops:read. */
export async function GET(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  return withRiver(req, { scope: "shops:read" }, async () => {
    const q = new URL(req.url).searchParams;
    const date = q.get("date") || "";
    try {
      const slots = await homeSlotsFor((await params).shopId, q.get("locationId") || "home", date, q.get("barberId") || undefined);
      return json({ date, timeZone: "Asia/Manila", slots });
    } catch (e) { return badRequest((e as Error).message); }
  });
}
