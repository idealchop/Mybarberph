import { json, notFound } from "@/lib/server/auth";
import { withRiver } from "@/lib/server/river";
import { getPublicShop } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** GET — one listed shop. Scope shops:read. */
export async function GET(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  return withRiver(req, { scope: "shops:read" }, async () => {
    const shop = await getPublicShop((await params).shopId);
    return shop ? json({ shop }) : notFound("Shop not found");
  });
}
