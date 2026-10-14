"use client";
import { Card } from "@river-apps/ui";
import Link from "next/link";
import { CompanionAvatar } from "./CompanionScreen";
import { useCompanion } from "./useCompanion";

/** Home card: the latest tip or alert, or an invitation to ask. */
export function CompanionCard({ className }: { className?: string }) {
  const c = useCompanion();
  const latest = [...c.messages].reverse().find((m) => m.role === "tip" || m.role === "alert");
  const body = latest ? latest.text.replace(/^Magandang umaga! Your Monday tips for this week:\s*/i, "").split("\n").filter(Boolean)[0] : "Ask about your sales, barbers, or how to get more suki. Taglish okay!";
  return (
    <Link href="/companion" className={`block rounded-card ${className ?? ""}`} aria-label="Open Companion">
      <Card padding="none" className="flex items-start gap-3 px-4 py-3.5">
        <CompanionAvatar size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <b className="text-[14.5px]">Companion</b>
            <span className="text-[11.5px] font-bold text-muted">{latest ? (latest.role === "alert" ? "Alert" : "This week’s tip") : "AI · Beta"}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[13px] font-medium text-muted">{body}</span>
          <span className="mt-2 inline-flex h-8 items-center rounded-pill bg-ink px-3 text-[12.5px] font-bold text-on-ink">Ask Companion</span>
        </span>
      </Card>
    </Link>
  );
}
