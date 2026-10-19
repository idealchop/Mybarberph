import { randomBytes } from "node:crypto";
import { auditLog } from "@/lib/server/audit";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, getCaller, json, notFound, unauthorized } from "@/lib/server/auth";
import { ensureShop } from "@/lib/server/shops";

export const dynamic = "force-dynamic";

const posts = () => adminDb().collection("community_posts");
const id = () => randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "x");

/** Public feed. `liked` / `reposted` / `mine` are filled in for the signed-in shop. */
export async function GET(req: Request) {
  const me = await getCaller(req);
  const snap = await posts().orderBy("createdAt", "desc").limit(60).get();
  return json({
    posts: snap.docs.map((d) => {
      const p = d.data();
      return {
        id: d.id, author: p.author, body: p.body, images: p.images ?? [], createdAt: p.createdAt,
        likes: (p.likedBy ?? []).length, reposts: (p.repostedBy ?? []).length, replies: p.replies ?? [],
        liked: me ? (p.likedBy ?? []).includes(me.uid) : false,
        reposted: me ? (p.repostedBy ?? []).includes(me.uid) : false,
        mine: me ? p.shopId === me.uid : false,
      };
    }),
  });
}

export async function POST(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const b = (await req.json().catch(() => null)) as { op?: string; id?: string; body?: string; images?: string[] } | null;
  if (!b?.op) return badRequest("op is required");
  const shop = await ensureShop(me.uid);
  if (!shop.name) return badRequest("Add your shop name in Settings before posting.");
  const author = { name: shop.name, meta: shop.area.split(",").pop()?.trim() || undefined, photoUrl: shop.logoUrl || undefined, shopId: me.uid };
  const text = (b.body ?? "").trim().slice(0, 2000);
  if (b.op === "post") {
    const images = (b.images ?? []).filter((u) => /^https:\/\//.test(u)).slice(0, 4);
    if (!text && !images.length) return badRequest("Write something or add a photo.");
    const pid = id();
    await posts().doc(pid).set({ shopId: me.uid, author, body: text, images, createdAt: Date.now(), likedBy: [], repostedBy: [], replies: [] });
    auditLog({ action: "community.post_created", shopId: me.uid, actor: { role: "owner", id: me.uid }, resource: { type: "post", id: pid } });
    return json({ id: pid }, 201);
  }
  if (!b.id) return badRequest("id is required");
  const ref = posts().doc(b.id);
  const snap = await ref.get();
  if (!snap.exists) return notFound();
  const p = snap.data()!;
  if (b.op === "like" || b.op === "repost") {
    const field = b.op === "like" ? "likedBy" : "repostedBy";
    const on = (p[field] ?? []).includes(me.uid);
    await ref.update({ [field]: on ? FieldValue.arrayRemove(me.uid) : FieldValue.arrayUnion(me.uid) });
    auditLog({ action: `community.${b.op}${on ? "_removed" : ""}`, shopId: me.uid, actor: { role: "owner", id: me.uid }, resource: { type: "post", id: b.id } });
    return json({ ok: true, on: !on });
  }
  if (b.op === "reply") {
    if (!text) return badRequest("Write a reply.");
    await ref.update({ replies: FieldValue.arrayUnion({ id: id(), author, body: text, createdAt: Date.now() }) });
    auditLog({ action: "community.reply_added", shopId: me.uid, actor: { role: "owner", id: me.uid }, resource: { type: "post", id: b.id } });
    return json({ ok: true });
  }
  if (b.op === "delete") {
    if (p.shopId !== me.uid) {
      auditLog({ action: "community.post_deleted", shopId: me.uid, actor: { role: "owner", id: me.uid }, resource: { type: "post", id: b.id }, outcome: "denied" });
      return json({ error: "Not your post", code: "forbidden" }, 403);
    }
    await ref.delete();
    auditLog({ action: "community.post_deleted", shopId: me.uid, actor: { role: "owner", id: me.uid }, resource: { type: "post", id: b.id } });
    return json({ ok: true });
  }
  return badRequest("Unknown op");
}
