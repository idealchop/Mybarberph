"use client";
import { Button } from "@/components/common/Button";
import { ArrowUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PageBack } from "@/components/shell/PageBack";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { useShopLocations } from "@/lib/shop-locations";
import { useTier } from "@/lib/tier";
import { useCompanion, type CompanionMessage } from "./useCompanion";

const STARTERS = [
  "Kumusta benta this week vs last week?",
  "Sino pinakamalakas na barber this month?",
  "Ilan suki ang hindi na bumabalik?",
  "Paano ko mapapataas average ticket ko?",
  "My goal is ₱50k a month. Kaya ba?",
];

/**
 * Companion mark: an original glyph derived from the River smile. A bold, round-capped smile
 * (the River curve, simplified to one stroke) with a four-point spark above its right corner.
 * Ink colour, no tile. Drawn on a 32-unit grid with one stroke weight so it stays crisp at 20-40px.
 */
export function CompanionMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className={className} fill="none">
      <path className="cm-smile" d="M5 14.5C8.2 21.6 13 24 16.4 24c3.6 0 7.4-2.4 10.1-7.6" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
      <path className="cm-spark" d="M24.5 3.5c.45 2.7 1.3 3.55 4 4-2.7.45-3.55 1.3-4 4-.45-2.7-1.3-3.55-4-4 2.7-.45 3.55-1.3 4-4Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

/** The Companion's face. "idle" breathes softly; "thinking" waves the smile and twinkles the spark; "still" for small inline use. */
export function CompanionAvatar({ size = 36, state = "idle" }: { size?: number; state?: "idle" | "thinking" | "still" }) {
  return (
    <span aria-hidden className={`companion-face companion-${state} inline-flex flex-none items-center justify-center text-ink`} style={{ width: size, height: size }}>
      <CompanionMark size={size} />
    </span>
  );
}

function Bubble({ m }: { m: CompanionMessage }) {
  if (m.role === "user") {
    return <div className={`companion-enter ml-auto max-w-[82%] whitespace-pre-wrap rounded-[18px] rounded-br-[6px] bg-ink px-3.5 py-2.5 text-[14px] font-medium text-on-ink ${m.pending ? "opacity-70" : ""}`}>{m.text}</div>;
  }
  const tag = m.role === "tip" ? "Monday tips" : m.role === "alert" ? "Heads up" : "";
  return (
    <div className="companion-enter flex max-w-[90%] items-end gap-2">
      <CompanionAvatar size={28} state="still" />
      <div className={`whitespace-pre-wrap rounded-[18px] rounded-bl-[6px] px-3.5 py-2.5 text-[14px] font-medium shadow-card ${m.role === "alert" ? "bg-grey-100" : m.role === "tip" ? "bg-surface ring-1 ring-ink/15" : "bg-surface"}`}>
        {tag ? <b className="mb-1 block text-[11.5px] uppercase tracking-[0.04em] text-muted">{tag}</b> : null}
        {m.text.replace(/\*\*(.+?)\*\*/g, "$1")}
        {m.locked ? <Link href="/settings/billing" className="mt-2 block text-[13px] font-bold underline underline-offset-[3px]">See plans</Link> : null}
      </div>
    </div>
  );
}

function dayLabel(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });
}

export function CompanionScreen() {
  const c = useCompanion();
  const { requireAuth } = useAuthGate();
  const { tier } = useTier();
  const shops = useShopLocations();
  const [text, setText] = useState("");
  const top = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ h: number; y: number } | null>(null);
  const lastId = c.messages[c.messages.length - 1]?.id;

  // New messages (and the first load) scroll to the bottom.
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [lastId, c.busy]);
  // Older pages are prepended without moving what the owner is reading.
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    window.scrollTo(0, a.y + (document.documentElement.scrollHeight - a.h));
  }, [c.messages.length]);
  // Scrolling near the top loads the previous page.
  useEffect(() => {
    const el = top.current;
    if (!el || !c.hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      anchor.current = { h: document.documentElement.scrollHeight, y: window.scrollY };
      void c.loadOlder().then((added) => { if (!added) anchor.current = null; });
    }, { rootMargin: "200px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [c.hasMore, c.loadOlder, c]);

  function submit(value = text) {
    const v = value.trim();
    if (!v) return;
    if (!c.signedIn) { requireAuth(); return; }
    setText("");
    void c.send(v, shops.viewingAll ? "all" : shops.scopeId ?? undefined);
  }

  const intro: CompanionMessage = { id: "intro", role: "assistant", createdAt: 0, text: "Hi boss! Ako si Companion. I read your shop’s bookings and sales so I can answer questions about your numbers, and I know the barbershop business here in the Philippines. Every Monday 7 AM I’ll send tips right here. Ano gusto mong malaman?" };
  const left = c.quota && !c.quota.unlimited ? `${c.quota.remaining} of ${c.quota.limit} questions left this month` : "";

  // Day separators between messages from different Manila days.
  const items: ({ kind: "day"; key: string; label: string } | { kind: "msg"; m: CompanionMessage })[] = [];
  let prevDay = "";
  for (const m of c.hasMore ? c.messages : [intro, ...c.messages]) {
    const d = m.createdAt ? new Date(m.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) : "";
    if (d && d !== prevDay) { items.push({ kind: "day", key: `d-${d}`, label: dayLabel(m.createdAt) }); prevDay = d; }
    items.push({ kind: "msg", m });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-2 bg-canvas/95 px-4 backdrop-blur">
        <PageBack fallback="/home" />
        <CompanionAvatar size={36} state={c.busy ? "thinking" : "idle"} />
        <span className="flex min-w-0 flex-1 flex-col leading-[1.2]">
          <b className="text-[16px]">Companion</b>
          <small className="truncate text-[12px] font-semibold text-muted">{left || (tier === "paid" ? "Unlimited · tips, alerts and goals" : "Your shop’s business buddy")}</small>
        </span>
      </header>
      {c.goals.length ? (
        <div className="mx-4 mb-1 flex flex-wrap gap-1.5">
          {c.goals.map((g) => <span key={g.id} className="rounded-pill bg-grey-100 px-2.5 py-1 text-[12px] font-bold">🎯 {g.text}</span>)}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 px-4 pt-2" aria-live="polite">
        <div ref={top} aria-hidden className="h-px" />
        {c.loadingOlder ? <p className="self-center text-[12.5px] font-semibold text-muted">Loading earlier messages…</p> : null}
        {c.signedIn && !c.ready ? <p className="text-[13px] font-semibold text-muted">Loading chat…</p> : items.map((it) => it.kind === "day"
          ? <p key={it.key} className="self-center pt-1 text-[11.5px] font-bold text-muted">{it.label}</p>
          : <Bubble key={it.m.id} m={it.m} />)}
        {c.busy ? <div className="companion-enter flex items-center gap-2 text-[13px] font-semibold text-muted" role="status"><CompanionAvatar size={32} state="thinking" /> <span>Nag-iisip</span><span className="companion-dots" aria-hidden><i /><i /><i /></span></div> : null}
        {c.upgrade ? (
          <div className="rounded-card bg-surface px-4 py-3.5 shadow-card">
            <b className="block text-[14px]">Monthly limit reached</b>
            <p className="mt-1 text-[13px] font-medium text-muted">{c.upgrade}</p>
            <Button href="/settings/billing" size="sm" className="mt-2.5">See plans</Button>
          </div>
        ) : null}
        {c.error ? <p className="text-[13px] font-semibold">{c.error}</p> : null}
        {c.messages.length === 0 && c.ready ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => submit(s)} className="rounded-pill bg-surface px-3 py-2 text-left text-[13px] font-semibold shadow-card">{s}</button>
            ))}
          </div>
        ) : null}
        <div ref={end} />
      </div>
      <div className="sticky bottom-0 z-10 mt-auto bg-canvas/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 backdrop-blur">
      <form className="flex items-end gap-2 rounded-[22px] bg-surface p-1.5 pl-4 shadow-card" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea
          aria-label="Message Companion" rows={1} value={text} maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => window.setTimeout(() => end.current?.scrollIntoView({ block: "end" }), 250)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={c.signedIn ? "Itanong mo kahit ano…" : "Sign in to ask Companion"}
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] font-medium outline-none placeholder:text-muted"
        />
        <button type="submit" aria-label="Send" disabled={c.busy} className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-ink text-on-ink disabled:opacity-50">
          <ArrowUp size={18} strokeWidth={2.2} />
        </button>
      </form>
      </div>
    </div>
  );
}
