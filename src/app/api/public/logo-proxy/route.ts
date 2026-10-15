import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Same-origin proxy for shop logos so the QR poster canvas isn't tainted by cross-origin images.
const ALLOWED = [/\.googleapis\.com$/, /\.firebasestorage\.app$/, /^firebasestorage\.googleapis\.com$/, /\.googleusercontent\.com$/];
const MAX = 5 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  let u: URL;
  try { u = new URL(raw || ""); } catch { return new Response("Bad url", { status: 400 }); }
  if (u.protocol !== "https:" || !ALLOWED.some((r) => r.test(u.hostname))) return new Response("Host not allowed", { status: 400 });
  const r = await fetch(u, { redirect: "follow" }).catch(() => null);
  if (!r || !r.ok) return new Response("Fetch failed", { status: 502 });
  const type = r.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return new Response("Not an image", { status: 415 });
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX) return new Response("Too large", { status: 413 });
  return new Response(buf, { headers: { "content-type": type, "cache-control": "public, max-age=3600" } });
}
