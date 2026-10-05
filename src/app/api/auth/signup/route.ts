import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { seedDemoShop } from "@/data/firebase/seed-shop";
import { createSessionCookie, SESSION_COOKIE } from "@/lib/firebase/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: string; shopName?: string; email?: string };
    if (!body.idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    const decoded = await adminAuth().verifyIdToken(body.idToken);
    const uid = decoded.uid;
    const email = body.email || decoded.email;
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    const existing = await adminDb().collection("users").doc(uid).get();
    if (existing.exists && (existing.data()?.shopIds as string[] | undefined)?.length) {
      // Already provisioned (e.g. Google re-login) — just refresh session
      const { cookie, expiresIn } = await createSessionCookie(body.idToken);
      const res = NextResponse.json({ ok: true, shopId: (existing.data()!.shopIds as string[])[0], existing: true });
      res.cookies.set(SESSION_COOKIE, cookie, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
        maxAge: Math.floor(expiresIn / 1000), path: "/",
      });
      return res;
    }

    const shopName = (body.shopName || "My Barbershop").trim() || "My Barbershop";
    const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "shop";
    const shopId = `${slug}-${uid.slice(0, 6)}`;

    const { shopId: id } = await seedDemoShop(adminDb(), {
      uid, email, displayName: decoded.name || email.split("@")[0],
    }, { shopId, shopName, tier: "paid" });

    const { cookie, expiresIn } = await createSessionCookie(body.idToken);
    const res = NextResponse.json({ ok: true, shopId: id });
    res.cookies.set(SESSION_COOKIE, cookie, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      maxAge: Math.floor(expiresIn / 1000), path: "/",
    });
    return res;
  } catch (err) {
    console.error("signup", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Signup failed" }, { status: 500 });
  }
}
