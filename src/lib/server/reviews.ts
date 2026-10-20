import "server-only";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Shop reviews (Jimboy, 2026-10-21). shops/{id}/reviews/{reviewId} { rating, comment, name, at, source }.
 * The shop doc keeps ratingCount + ratingSum for the small star line on customer pages.
 *   - "profile" reviews are left on the shop profile; one per device (dev_<deviceId>), a new one replaces it.
 *   - "visit" reviews mirror the rating a customer gives after a finished visit (visit_<bookingId>).
 */
export interface Review { id: string; rating: number; comment: string; name: string; at: number; source: "profile" | "visit" }

const shop = (id: string) => adminDb().collection("shops").doc(id);
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n) : "");

export function cleanReview(b: unknown): { rating: number; comment: string; name: string; deviceId: string } | string {
  const x = (b ?? {}) as Record<string, unknown>;
  const rating = Number(x.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Pick 1 to 5 stars.";
  const deviceId = clip(x.deviceId, 64);
  if (!/^[a-z0-9]{12,64}$/.test(deviceId)) return "Refresh the page and try again.";
  return { rating, comment: clip(x.comment, 300), name: clip(x.name, 40), deviceId };
}

/** Writes a review and moves the shop's count/sum in the same transaction (a replaced review moves the sum only). */
export async function writeReview(tx: Transaction, shopId: string, id: string, r: Omit<Review, "id">) {
  const ref = shop(shopId).collection("reviews").doc(id);
  const prev = (await tx.get(ref)).data() as Review | undefined;
  tx.set(ref, { ...r, id });
  tx.set(shop(shopId), { ratingCount: FieldValue.increment(prev ? 0 : 1), ratingSum: FieldValue.increment(r.rating - (prev?.rating ?? 0)) }, { merge: true });
}

export async function saveProfileReview(shopId: string, r: { rating: number; comment: string; name: string; deviceId: string }) {
  if (!/^[\w-]{6,128}$/.test(shopId)) throw new Error("Shop not found");
  const s = await shop(shopId).get();
  if (!s.exists) throw new Error("Shop not found");
  await adminDb().runTransaction((tx) => writeReview(tx, shopId, `dev_${r.deviceId}`, { rating: r.rating, comment: r.comment, name: r.name, at: Date.now(), source: "profile" }));
}

export async function listReviews(shopId: string) {
  if (!/^[\w-]{6,128}$/.test(shopId)) return null;
  const [s, q] = await Promise.all([shop(shopId).get(), shop(shopId).collection("reviews").orderBy("at", "desc").limit(20).get()]);
  if (!s.exists) return null;
  const d = s.data() as { ratingCount?: number; ratingSum?: number };
  return { rating: ratingSummary(d), reviews: q.docs.map((x) => { const r = x.data() as Review; return { rating: r.rating, comment: r.comment, name: r.name || "Customer", at: r.at, source: r.source }; }) };
}

export function ratingSummary(d: { ratingCount?: number; ratingSum?: number }) {
  const count = Math.max(0, Number(d.ratingCount) || 0);
  return { count, avg: count ? Math.round(((Number(d.ratingSum) || 0) / count) * 10) / 10 : null };
}
