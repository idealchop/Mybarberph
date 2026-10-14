import { json, notFound } from "@/lib/server/auth";
import { riverAuth } from "@/lib/server/river";
import { getPublicShop } from "@/lib/server/shops";

export async function GET(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const denied = riverAuth(req);
  if (denied) return denied;
  const shop = await getPublicShop((await params).shopId);
  return shop ? json({ shop }) : notFound("Shop not found");
}
