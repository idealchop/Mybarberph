"use client";
import { Avatar, Input } from "@river-apps/ui";
import { ChevronLeft, Clock, MapPin, Phone, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/common/button";
import { PoweredBy } from "./shop-brand";
import type { PublicShop } from "./use-public-shop";

type ReviewList = { rating: { avg: number | null; count: number }; reviews: { rating: number; comment: string; name: string; at: number; source: string }[] };

/** Small star line: ★ 4.8 (12). Hidden until there's a review. */
export function StarLine({ rating, className = "" }: { rating?: { avg: number | null; count: number } | null; className?: string }) {
  if (!rating?.count || rating.avg == null) return <span className={`text-[12px] font-semibold text-muted ${className}`}>No reviews yet</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-[12.5px] font-bold ${className}`} aria-label={`Rated ${rating.avg} of 5 from ${rating.count} review${rating.count === 1 ? "" : "s"}`}>
      <Star size={13} fill="#F5B301" stroke="#F5B301" aria-hidden />{rating.avg.toFixed(1)}<span className="font-semibold text-muted">({rating.count})</span>
    </span>
  );
}

function deviceId() {
  const k = "bp.deviceId";
  let v = localStorage.getItem(k);
  if (!v || !/^[a-z0-9]{12,64}$/.test(v)) {
    const a = "abcdefghijklmnopqrstuvwxyz0123456789";
    const r = crypto.getRandomValues(new Uint8Array(24));
    v = Array.from(r, (x) => a[x % a.length]).join("");
    localStorage.setItem(k, v);
  }
  return v;
}

const when = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

/** Shop profile for customers (Jimboy, 2026-10-21): details, star summary, reviews, and leave a review here. */
export function ShopProfileView({ shop, onBack, onRated }: { shop: PublicShop; onBack: () => void; onRated?: (r: ReviewList["rating"]) => void }) {
  const [data, setData] = useState<ReviewList | null>(null);
  const [stars, setStars] = useState(0);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let live = true;
    fetch(`/api/public/shops/${encodeURIComponent(shop.id)}/reviews`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setData(d); }).catch(() => undefined);
    return () => { live = false; };
  }, [shop.id]);
  const submit = async () => {
    if (!stars || busy) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/public/shops/${encodeURIComponent(shop.id)}/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating: stars, comment, name, deviceId: deviceId() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn’t send your review.");
      setData({ rating: d.rating, reviews: d.reviews });
      onRated?.(d.rating);
      setMsg("Thanks! Your review is posted.");
      setComment("");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const rating = data?.rating ?? shop.rating;
  const cover = shop.photoUrls?.[0];
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas pb-6">
      <div className="relative h-[168px] overflow-hidden bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={cover} alt="" className="size-full object-cover opacity-90" /> : null}
        <button type="button" onClick={onBack} aria-label="Back" className="absolute left-3 top-3 inline-flex size-11 items-center justify-center rounded-full bg-surface/95 shadow-card"><ChevronLeft size={24} strokeWidth={1.9} /></button>
      </div>
      <div className="relative z-[1] -mt-10 px-4">
        <Avatar name={shop.name} src={shop.logoUrl || undefined} preset="sky" size={76} decorative={false} className="ring-4 ring-canvas" />
        <h1 className="mt-2 text-[24px] font-extrabold leading-tight tracking-[-0.03em]">{shop.name}</h1>
        <StarLine rating={rating} className="mt-0.5" />
        <ul className="mt-3 grid gap-2 rounded-card bg-surface px-4 py-3 text-[13.5px] font-semibold shadow-card">
          {shop.address || shop.area ? <li className="flex gap-2"><MapPin size={16} className="mt-0.5 flex-none text-muted" aria-hidden />{shop.address || shop.area}</li> : null}
          {shop.hours ? <li className="flex gap-2"><Clock size={16} className="mt-0.5 flex-none text-muted" aria-hidden />{shop.hours}</li> : null}
          {shop.phone ? <li className="flex gap-2"><Phone size={16} className="mt-0.5 flex-none text-muted" aria-hidden /><a href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`} className="underline decoration-grey-300 underline-offset-[3px]">{shop.phone}</a></li> : null}
        </ul>
        {shop.about ? <p className="mt-3 whitespace-pre-wrap px-1 text-[14px] font-medium text-ink-2">{shop.about}</p> : null}

        <section aria-label="Leave a review" className="mt-5 rounded-card bg-surface px-4 py-4 shadow-card">
          <b className="text-[16px]">Leave a review</b>
          <div role="radiogroup" aria-label="Stars" className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setStars(n)} className="inline-flex size-11 items-center justify-center rounded-full active:scale-95">
                <Star size={30} strokeWidth={1.6} fill={n <= stars ? "#F5B301" : "none"} stroke={n <= stars ? "#F5B301" : "#C9CED6"} />
              </button>
            ))}
          </div>
          <div className="mt-2 grid gap-2.5">
            <Input label="Your name (optional)" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold">Comment (optional)</span>
              <textarea value={comment} maxLength={300} rows={3} onChange={(e) => setComment(e.target.value)} placeholder="How was your cut?" className="rounded-[14px] bg-grey-100 px-3 py-2.5 text-[15px] font-medium outline-none" />
            </label>
          </div>
          {msg ? <p className="mt-2 text-[13px] font-semibold" role="status">{msg}</p> : null}
          <Button className="mt-3" fullWidth loading={busy} disabled={!stars || busy} onClick={() => void submit()}>{busy ? "Posting…" : "Post review"}</Button>
        </section>

        <section aria-label="Reviews" className="mt-5">
          <h2 className="px-1 text-[13px] font-bold text-muted">Reviews</h2>
          {!data ? <p className="mt-2 px-1 text-[13px] font-semibold text-muted">Loading reviews…</p> : data.reviews.length === 0 ? (
            <p className="mt-2 rounded-card bg-surface px-4 py-5 text-center text-[13.5px] font-semibold text-muted shadow-card">No reviews yet. Be the first.</p>
          ) : (
            <ul className="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
              {data.reviews.map((r, i) => (
                <li key={`${r.at}-${i}`} className="border-b border-line px-4 py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-2"><b className="text-[14px]">{r.name}</b><small className="text-[12px] font-semibold text-muted">{when(r.at)}{r.source === "visit" ? " · after a visit" : ""}</small></div>
                  <span className="text-[14px] text-[#F5B301]" aria-label={`${r.rating} of 5 stars`}>{"★".repeat(r.rating)}<span className="text-grey-300">{"★".repeat(5 - r.rating)}</span></span>
                  {r.comment ? <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] font-medium text-ink-2">{r.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <PoweredBy />
    </main>
  );
}
