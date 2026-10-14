import "server-only";
import { adminAuth } from "@/lib/firebase/admin";

export interface Caller { uid: string; email: string | null; phone: string | null; name: string | null }

/** Verifies the Firebase ID token sent as `Authorization: Bearer <token>`. */
export async function getCaller(req: Request): Promise<Caller | null> {
  const header = req.headers.get("authorization") || "";
  const m = /^Bearer (.+)$/.exec(header);
  if (!m) return null;
  try {
    const d = await adminAuth().verifyIdToken(m[1] ?? "");
    return { uid: d.uid, email: d.email ?? null, phone: d.phone_number ?? null, name: (d.name as string | undefined) ?? null };
  } catch {
    return null;
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export const unauthorized = () => json({ error: "Sign in to continue." }, 401);
export const badRequest = (error: string) => json({ error }, 400);
export const notFound = (error = "Not found") => json({ error }, 404);
