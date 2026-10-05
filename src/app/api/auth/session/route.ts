import { NextResponse } from "next/server";
import { createSessionCookie, SESSION_COOKIE } from "@/lib/firebase/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };
    if (!idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    const { cookie, expiresIn } = await createSessionCookie(idToken);
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
    console.error("session", err);
    return NextResponse.json({ error: "Could not create session" }, { status: 401 });
  }
}
