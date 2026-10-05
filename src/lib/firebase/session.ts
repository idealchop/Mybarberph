import "server-only";

import { cookies } from "next/headers";
import { adminAuth, adminDb } from "./admin";

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "bp_session";
const EXPIRES_MS = 1000 * 60 * 60 * 24 * 12; // 12 days (Firebase session cookie max is 14)

export type ShopRole = "owner" | "manager" | "barber" | "cashier";

export interface SessionContext {
  uid: string;
  email: string | null;
  shopId: string;
  role: ShopRole;
}

export async function createSessionCookie(idToken: string): Promise<{ cookie: string; expiresIn: number }> {
  const expiresIn = EXPIRES_MS;
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn });
  return { cookie, expiresIn };
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Verifies the session cookie and loads the user's active shop membership. */
export async function getSessionContext(): Promise<SessionContext | null> {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  if (!session) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    const uid = decoded.uid;
    const email = typeof decoded.email === "string" ? decoded.email : null;

    const userDoc = await adminDb().collection("users").doc(uid).get();
    let shopId = (userDoc.data()?.shopIds as string[] | undefined)?.[0];

    if (!shopId) {
      const memberships = await adminDb().collectionGroup("members").where("uid", "==", uid).where("status", "==", "active").limit(1).get();
      shopId = memberships.docs[0]?.ref.parent.parent?.id;
    }
    if (!shopId) return null;

    const member = await adminDb().collection("shops").doc(shopId).collection("members").doc(uid).get();
    const data = member.data();
    if (!member.exists || data?.status !== "active" || data?.shopId !== shopId) return null;

    return { uid, email, shopId, role: (data.role as ShopRole) || "owner" };
  } catch {
    return null;
  }
}
