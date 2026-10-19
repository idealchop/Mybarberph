import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import type { FeedbackSummary } from "@/lib/app-stats";

/**
 * App ratings (Jimboy, 2026-10-20). appFeedback/{id}: one per owner (owner_{uid}) or barber link
 * (barber_{sha256(token)}); a later rating replaces the earlier one. appStats/feedback keeps count and sum
 * so the Install page never scans the collection. Rules deny all client access (catch-all); Admin SDK only.
 */
const db = () => adminDb();
const summaryRef = () => db().collection("appStats").doc("feedback");

export type FeedbackWho = { role: "owner"; shopId: string } | { role: "barber"; shopId: string; token: string };

export const feedbackId = (w: FeedbackWho) => w.role === "owner" ? `owner_${w.shopId}` : `barber_${createHash("sha256").update(w.token).digest("hex").slice(0, 32)}`;

export function cleanFeedback(b: unknown): { rating: number; comment: string } | string {
  const x = (b ?? {}) as { rating?: unknown; comment?: unknown };
  const rating = Number(x.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Pick 1 to 5 stars.";
  const comment = typeof x.comment === "string" ? x.comment.trim().slice(0, 500) : "";
  return { rating, comment };
}

export async function feedbackSummary(): Promise<FeedbackSummary> {
  const s = await summaryRef().get();
  const d = (s.exists ? s.data() : {}) as Partial<FeedbackSummary>;
  return { count: Number(d.count) || 0, sum: Number(d.sum) || 0 };
}

export async function myFeedback(w: FeedbackWho) {
  const s = await db().collection("appFeedback").doc(feedbackId(w)).get();
  if (!s.exists) return null;
  const d = s.data() as { rating: number; comment?: string };
  return { rating: d.rating, comment: d.comment || "" };
}

export async function saveFeedback(w: FeedbackWho, f: { rating: number; comment: string }) {
  const ref = db().collection("appFeedback").doc(feedbackId(w));
  const sumRef = summaryRef();
  await db().runTransaction(async (tx) => {
    const [prev, sum] = [await tx.get(ref), await tx.get(sumRef)];
    const p = prev.exists ? (prev.data() as { rating: number; createdAt?: number }) : null;
    const s = (sum.exists ? sum.data() : {}) as Partial<FeedbackSummary>;
    const now = Date.now();
    tx.set(ref, { role: w.role, shopId: w.shopId, rating: f.rating, comment: f.comment, createdAt: p?.createdAt ?? now, updatedAt: now });
    tx.set(sumRef, { count: (Number(s.count) || 0) + (p ? 0 : 1), sum: (Number(s.sum) || 0) + f.rating - (p?.rating ?? 0), updatedAt: now });
  });
  return feedbackSummary();
}
