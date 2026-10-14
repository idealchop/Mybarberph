"use client";
import { Button } from "@river-apps/ui";
import { ArrowUp, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

export function CompanionAvatar({ size = 36 }: { size?: number }) {
  return (
    <span aria-hidden className="inline-flex flex-none items-center justify-center rounded-full bg-ink text-on-ink" style={{ width: size, height: size }}>
      <Sparkles size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </span>
  );
}

function Bubble({ m }: { m: CompanionMessage }) {
  if (m.role === "user") {
    return <div className={`ml-auto max-w-[82%] whitespace-pre-wrap rounded-[18px] rounded-br-[6px] bg-ink px-3.5 py-2.5 text-[14px] font-medium text-on-ink ${m.pending ? "opacity-70" : ""}`}>{m.text}</div>;
  }
  const tag = m.role === "tip" ? "Monday tips" : m.role === "alert" ? "Heads up" : "";
  return (
    <div className="flex max-w-[90%] items-end gap-2">
      <CompanionAvatar size={28} />
      <div className={`whitespace-pre-wrap rounded-[18px] rounded-bl-[6px] px-3.5 py-2.5 text-[14px] font-medium shadow-card ${m.role === "alert" ? "bg-grey-100" : "bg-surface"}`}>
        {tag ? <b className="mb-1 block text-[11.5px] uppercase tracking-[0.04em] text-muted">{tag}</b> : null}
        {m.text.replace(/\*\*(.+?)\*\*/g, "$1")}
        {m.locked ? <Link href="/settings/billing" className="mt-2 block text-[13px] font-bold underline underline-offset-[3px]">See plans</Link> : null}
      </div>
    </div>
  );
}

export function CompanionScreen() {
  const c = useCompanion();
  const { requireAuth } = useAuthGate();
  const { tier } = useTier();
  const shops = useShopLocations();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [c.messages.length, c.busy]);

  function submit(value = text) {
    const v = value.trim();
    if (!v) return;
    if (!c.signedIn) { requireAuth(); return; }
    setText("");
    void c.send(v, shops.viewingAll ? "all" : shops.scopeId ?? undefined);
  }

  const intro: CompanionMessage = { id: "intro", role: "assistant", createdAt: 0, text: "Hi boss! Ako si Companion. I read your shop’s bookings and sales so I can answer questions about your numbers, and I know the barbershop business here in the Philippines. Every Monday 7 AM I’ll send tips. Ano gusto mong malaman?" };
  const rows = [intro, ...c.messages];
  const left = c.quota && !c.quota.unlimited ? `${c.quota.remaining} of ${c.quota.limit} questions left this month` : "";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-[720px] flex-col pb-2">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-2 bg-canvas/95 px-4 backdrop-blur">
        <PageBack fallback="/home" />
        <CompanionAvatar size={36} />
        <span className="flex min-w-0 flex-col leading-[1.2]">
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
        {rows.map((m) => <Bubble key={m.id} m={m} />)}
        {c.busy ? <div className="flex items-center gap-2 text-[13px] font-semibold text-muted"><CompanionAvatar size={28} /> Nag-iisip…</div> : null}
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
      <form className="sticky bottom-[calc(env(safe-area-inset-bottom)+72px)] mx-4 mt-3 flex items-end gap-2 rounded-[22px] bg-surface p-1.5 pl-4 shadow-card lg:bottom-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea
          aria-label="Message Companion" rows={1} value={text} maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={c.signedIn ? "Itanong mo kahit ano…" : "Sign in to ask Companion"}
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] font-medium outline-none placeholder:text-muted"
        />
        <button type="submit" aria-label="Send" disabled={c.busy} className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-ink text-on-ink disabled:opacity-50">
          <ArrowUp size={18} strokeWidth={2.2} />
        </button>
      </form>
    </div>
  );
}
