"use client";
/**
 * Install Barbers.ph (owner Settings › Install app, and the barber link). One layout on every phone:
 * big icon, title, stats row (placeholders until real ratings: src/lib/app-stats.ts), three feature lines with 3D icons,
 * full-width "Install the app" and "Rate & send feedback" (Jimboy, 2026-10-20).
 * Android/Chrome/Edge: the browser's own install prompt. iPhone/iPad can't install from a page, so the button
 * dims the screen and points at Safari's Share button ("Tap Share, then Add to Home Screen"); tap anywhere
 * closes it. Opened from the home screen (standalone): Installed, plus a one-time welcome (PwaHost).
 */
import { CheckCircle2, Loader2, Share, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthGate } from "@/components/auth/auth-gate-provider";
import { displayStats, type FeedbackSummary } from "@/lib/app-stats";
import { api } from "@/lib/cloud";
import { useSession } from "@/lib/session";
import { Button } from "@/components/common/button";
import { usePwaInstall } from "@/lib/pwa";

/** art: a small 3D icon (~30px) from the app's own set (BarberIcon, CoinIcon, /icons3d). */
export interface InstallFeature { art: React.ReactNode; text: string }

/** A /icons3d PNG at feature-line size. */
export function Icon3d({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={30} height={30} className="size-[30px] object-contain" />;
}

/** token set = barber link (rates as that link); unset = owner (rates with their sign-in). */
export function InstallPanel({ features, token }: { features: InstallFeature[]; token?: string }) {
  const pwa = usePwaInstall(token);
  const [guide, setGuide] = useState<null | "ios" | "safari" | "menu">(null);
  const [rating, setRating] = useState(false);
  const fb = useFeedback(token);
  const stats = displayStats(fb.summary);
  const installed = pwa.state === "installed";

  async function onInstall() {
    if (pwa.platform === "prompt") await pwa.install();
    else setGuide(pwa.platform === "ios-safari" ? "ios" : pwa.platform === "ios-other" ? "safari" : "menu");
  }

  return (
    <div className="flex flex-col items-center px-2 pb-6 pt-6 text-center">
      <div className="flex w-full items-center justify-center rounded-[32px] bg-grey-100 py-9">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pwa/icon-512.png" alt="Barbers.ph app icon" width={156} height={156} className="size-[156px] rounded-[36px] shadow-card" />
      </div>
      <h1 className="mt-6 text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em]">{installed ? "Installed!" : "Install Barbers.ph"}</h1>
      {installed || pwa.state !== "idle" ? (
        <p className="mt-2 max-w-[320px] text-[14.5px] font-semibold text-muted" aria-live="polite">
          {installed ? "Find Barbers.ph on your home screen." : pwa.state === "installing" ? "Installing… this takes a few seconds." : "Not installed. You can try again any time."}
        </p>
      ) : null}

      <dl className="mt-4 grid w-full grid-cols-2 divide-x divide-line rounded-[16px] bg-surface py-2.5 shadow-card" aria-label="App stats">
        <div><dt className="sr-only">Rating</dt><dd className="flex items-center justify-center gap-1 text-[17px] font-extrabold"><span>{stats.rating}</span><Star size={15} className="fill-current" aria-label="stars" /></dd><dd className="text-[11.5px] font-semibold text-muted">{stats.real ? "Average rating" : "Rating"}</dd></div>
        <div><dt className="sr-only">{stats.countLabel}</dt><dd className="text-[17px] font-extrabold">{stats.count}</dd><dd className="text-[11.5px] font-semibold text-muted">{stats.countLabel}</dd></div>
      </dl>

      {installed ? null : (
        <ul className="mt-4 flex w-full flex-col gap-2.5 text-left">
          {features.map(({ art, text }) => (
            <li key={text} className="flex items-center gap-3 text-[14px] font-semibold">
              <span aria-hidden className="inline-flex size-[30px] flex-none items-center justify-center">{art}</span>
              <span className="min-w-0">{text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 w-full">
        {installed ? (
          <p className="flex h-12 items-center justify-center gap-2 rounded-pill bg-grey-100 text-[15px] font-bold"><CheckCircle2 size={18} aria-hidden /> Installed</p>
        ) : pwa.state === "installing" ? (
          <Button fullWidth disabled><Loader2 size={18} className="animate-spin" aria-hidden /> Installing…</Button>
        ) : (
          <Button fullWidth onClick={() => onInstall()}>Install the app</Button>
        )}
      </div>
      <button type="button" onClick={() => setRating(true)} className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-bold text-muted hover:underline">
        <Star size={14} aria-hidden /> {fb.mine ? `You rated ${fb.mine.rating} ★ · Edit` : "Rate & send feedback"}
      </button>
      {guide ? <InstallHint kind={guide} onClose={() => setGuide(null)} /> : null}
      {rating ? <RateSheet fb={fb} token={token} onClose={() => setRating(false)} /> : null}
    </div>
  );
}

type Mine = { rating: number; comment: string } | null;
function useFeedback(token?: string) {
  const { user } = useSession();
  const uid = user?.uid;
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [mine, setMine] = useState<Mine>(null);
  useEffect(() => {
    let live = true;
    api(`/api/feedback${token ? `?token=${encodeURIComponent(token)}` : ""}`)
      .then((r: { summary: FeedbackSummary; mine: Mine }) => { if (live) { setSummary(r.summary); setMine(r.mine); } })
      .catch(() => {});
    return () => { live = false; };
  }, [token, uid]);
  async function submit(rating: number, comment: string) {
    const r = (await api("/api/feedback", { method: "POST", body: JSON.stringify({ token, rating, comment }) })) as { summary: FeedbackSummary };
    setSummary(r.summary); setMine({ rating, comment });
  }
  return { summary, mine, submit, signedIn: !!uid };
}

function RateSheet({ fb, token, onClose }: { fb: ReturnType<typeof useFeedback>; token?: string; onClose: () => void }) {
  const { requireAuth } = useAuthGate();
  const [stars, setStars] = useState(fb.mine?.rating ?? 0);
  const [comment, setComment] = useState(fb.mine?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const needsLogin = !token && !fb.signedIn;

  async function send() {
    if (!stars) { setError("Tap a star to rate."); return; }
    setBusy(true); setError("");
    try { await fb.submit(stars, comment.trim()); setDone(true); }
    catch (e) { setError((e as Error).message || "Couldn't send. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="rate-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div className="relative z-[1] w-full max-w-[440px] rounded-t-[28px] bg-surface px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 text-left shadow-card sm:rounded-[28px]">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-grey-100"><X size={18} aria-hidden /></button>
        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 size={40} className="mx-auto" aria-hidden />
            <h2 id="rate-title" className="mt-3 text-[20px] font-extrabold tracking-[-0.02em]">Thank you!</h2>
            <p className="mt-1 text-[14px] font-semibold text-muted">Your feedback helps us make Barbers.ph better.</p>
            <Button className="mt-5" fullWidth onClick={onClose}>Done</Button>
          </div>
        ) : needsLogin ? (
          <>
            <h2 id="rate-title" className="pr-10 text-[20px] font-extrabold tracking-[-0.02em]">Rate Barbers.ph</h2>
            <p className="mt-2 text-[14px] font-semibold text-muted">Log in so we know which shop the rating is from.</p>
            <Button className="mt-5" fullWidth onClick={() => requireAuth()}>Sign up or log in</Button>
          </>
        ) : (
          <>
            <h2 id="rate-title" className="pr-10 text-[20px] font-extrabold tracking-[-0.02em]">Rate Barbers.ph</h2>
            <div role="radiogroup" aria-label="Rating" className="mt-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setStars(n)} className="inline-flex size-11 items-center justify-center">
                  <Star size={32} strokeWidth={1.75} className={n <= stars ? "fill-ink text-ink" : "text-subtle"} />
                </button>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} placeholder="Tell us what to improve (optional)" aria-label="Feedback"
              className="mt-4 w-full resize-none rounded-[16px] bg-grey-100 px-3.5 py-3 text-[14px] font-semibold outline-none placeholder:text-muted" />
            {error ? <p className="mt-2 text-[13px] font-semibold" role="alert">{error}</p> : null}
            <Button className="mt-4" fullWidth onClick={() => send()} disabled={busy}>{busy ? "Sending…" : "Submit"}</Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Lightweight pointer overlay. iPhone Safari's Share button sits in the bottom toolbar; iPad's is top right. */
function InstallHint({ kind, onClose }: { kind: "ios" | "safari" | "menu"; onClose: () => void }) {
  const ipad = typeof navigator !== "undefined" && (/iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
  const top = kind !== "ios" || ipad;
  const line = kind === "ios" ? <>Tap <Share size={16} className="mx-0.5 inline align-[-2px]" aria-label="Share" />, then <b>Add to Home Screen</b></>
    : kind === "safari" ? <>Open this page in <b>Safari</b> to install</>
    : <>Open the browser menu, then <b>Install app</b></>;
  return (
    <button type="button" onClick={onClose} aria-label="Close install hint" className="fixed inset-0 z-[80] cursor-default bg-ink/55 text-left">
      <span role="status" className={`absolute flex flex-col items-center gap-2 ${top ? "right-3 top-[max(10px,env(safe-area-inset-top))] flex-col-reverse items-end" : "inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))]"}`}>
        <span className="rounded-[16px] bg-surface px-4 py-3 text-[14.5px] font-semibold text-ink shadow-card">{line}</span>
        <span aria-hidden className={`text-[34px] leading-none text-surface ${top ? "mr-4 animate-bounce" : "animate-bounce"}`}>{top ? "↑" : "↓"}</span>
      </span>
    </button>
  );
}
