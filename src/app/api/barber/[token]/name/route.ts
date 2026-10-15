import { badRequest, json, notFound } from "@/lib/server/auth";
import { chairLink, setBarberName } from "@/lib/server/shops";

/** The barber sets their own name on their chair link. */
export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await chairLink((await params).token);
  if (!link) return notFound("This link has expired.");
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  try { return json({ name: await setBarberName(link.shopId, link.chairId, String(body?.name ?? "")) }); } catch (e) { return badRequest((e as Error).message); }
}
