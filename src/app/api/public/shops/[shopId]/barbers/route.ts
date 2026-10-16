import { json, notFound } from "@/lib/server/auth";
import { getPublicShop, publicBarbers } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** Active barbers (name + photo) at one location, for the customer Schedule page. */
export async function GET(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const shopId = (await params).shopId;
  const shop = await getPublicShop(shopId);
  if (!shop) return notFound("Shop not found");
  const loc = new URL(req.url).searchParams.get("loc") || "home";
  return json({ barbers: await publicBarbers(shopId, loc) });
}
