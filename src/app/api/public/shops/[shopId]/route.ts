import { json, notFound } from "@/lib/server/auth";
import { getPublicShop } from "@/lib/server/shops";

export async function GET(_req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const shop = await getPublicShop((await params).shopId);
  return shop ? json({ shop }) : notFound("Shop not found");
}
