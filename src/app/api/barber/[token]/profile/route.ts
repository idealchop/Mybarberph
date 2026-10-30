import { json, notFound } from "@/lib/server/auth";
import { barberProfile } from "@/lib/server/barber-sales";
import { chairLink, cleanBarberSelf, linkBarber, updateBarberSelf } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

/** The barber's own read-only profile on their link: ?range=today|7d|all. Only their own share + tips; rank as a position. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await chairLink((await params).token);
  if (!link) return notFound("This link was replaced or turned off.");
  const me = await linkBarber(link.shopId, link.chairId);
  if (!me) return notFound();
  return json(await barberProfile(link.shopId, { range: new URL(req.url).searchParams.get("range"), barberId: me.barberId, chairId: link.chairId, locationId: me.locationId }));
}

/** The barber edits their own name, photo, mobile and email (v1.0.27). Anything else (share %, Active, location, services) is rejected. */
export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await chairLink((await params).token);
  if (!link) return notFound("This link was replaced or turned off.");
  let patch;
  try { patch = cleanBarberSelf(await req.json().catch(() => null)); } catch (e) { return json({ error: (e as Error).message, code: "invalid" }, 400); }
  try { return json({ ok: true, saved: await updateBarberSelf(link.shopId, link.chairId, patch) }); } catch (e) { return json({ error: (e as Error).message }, 404); }
}
