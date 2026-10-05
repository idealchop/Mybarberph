import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { seedDemoShop } from "@/data/firebase/seed-shop";
import { SESSION_COOKIE } from "@/lib/firebase/session";

export const runtime = "nodejs";

/**
 * Ensures the signed-in user has a shop membership.
 * Uses the session cookie (minted right after phone/Google/email sign-in).
 * First-time users get a seeded Paid demo shop.
 */
export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const session = jar.get(SESSION_COOKIE)?.value;
    if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const decoded = await adminAuth().verifySessionCookie(session, true);
    const uid = decoded.uid;
    const email = (typeof decoded.email === "string" && decoded.email) || null;
    const phone = (typeof decoded.phone_number === "string" && decoded.phone_number) || null;
    const displayName =
      (typeof decoded.name === "string" && decoded.name) ||
      email?.split("@")[0] ||
      (phone ? `Owner ${phone.slice(-4)}` : "Owner");

    const body = (await req.json().catch(() => ({}))) as { shopName?: string };
    const userRef = adminDb().collection("users").doc(uid);
    const existing = await userRef.get();
    const shopIds = (existing.data()?.shopIds as string[] | undefined) ?? [];

    if (shopIds.length) {
      const shopId = shopIds[0]!;
      const shop = await adminDb().collection("shops").doc(shopId).get();
      return NextResponse.json({ ok: true, shopId, tier: shop.data()?.tier ?? "paid", existing: true });
    }

    const memberships = await adminDb()
      .collectionGroup("members")
      .where("uid", "==", uid)
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (!memberships.empty) {
      const shopId = memberships.docs[0]!.ref.parent.parent!.id;
      const shop = await adminDb().collection("shops").doc(shopId).get();
      await userRef.set({ email, phone, displayName, shopIds: [shopId] }, { merge: true });
      return NextResponse.json({ ok: true, shopId, tier: shop.data()?.tier ?? "paid", existing: true });
    }

    const shopName = (body.shopName || "My Barbershop").trim() || "My Barbershop";
    const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "shop";
    const shopId = `${slug}-${uid.slice(0, 6)}`;

    await seedDemoShop(
      adminDb(),
      { uid, email: email || `${uid}@users.barbers.ph`, displayName },
      { shopId, shopName, tier: "paid" },
    );
    if (phone) await userRef.set({ phone }, { merge: true });

    return NextResponse.json({ ok: true, shopId, tier: "paid", existing: false });
  } catch (err) {
    console.error("ensure-shop", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not open shop" }, { status: 500 });
  }
}
