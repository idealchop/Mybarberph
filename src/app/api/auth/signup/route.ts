import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { createSessionCookie, SESSION_COOKIE } from "@/lib/firebase/session";

export const runtime = "nodejs";

/** Email signup: mint session then defer shop creation to /api/auth/ensure-shop. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: string; shopName?: string; email?: string };
    if (!body.idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    await adminAuth().verifyIdToken(body.idToken);
    const { cookie, expiresIn } = await createSessionCookie(body.idToken);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor(expiresIn / 1000),
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("signup", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Signup failed" }, { status: 500 });
  }
}
