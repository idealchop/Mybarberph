import { badRequest, json, notFound } from "@/lib/server/auth";
import { BARBER_KEYS, chairLink, putState } from "@/lib/server/shops";

export async function PUT(req: Request, { params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  const link = await chairLink(token);
  if (!link) return notFound("This link was replaced or turned off.");
  if (!BARBER_KEYS.has(key)) return badRequest("Not allowed");
  const body = (await req.json().catch(() => null)) as { value?: unknown } | null;
  if (typeof body?.value !== "string") return badRequest("value must be a JSON string");
  try { await putState(link.shopId, key, body.value); } catch (e) { return badRequest((e as Error).message); }
  return json({ ok: true });
}
