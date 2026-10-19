"use client";
import { Card } from "@river-apps/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { companionEnabled } from "@/lib/companion-flag";
import { CompanionAvatar } from "./companion-screen";

/** Home entry point only: no preview text, no chat. The conversation lives on /companion. */
export function CompanionCard({ className }: { className?: string }) {
  if (!companionEnabled()) return null;
  return (
    <Link href="/companion" className={`block rounded-card ${className ?? ""}`} aria-label="Open Companion">
      <Card padding="none" className="flex items-center gap-3 px-4 py-3.5">
        <CompanionAvatar size={40} state="idle" />
        <b className="min-w-0 flex-1 text-[15px]">Companion</b>
        <ChevronRight size={20} strokeWidth={2} className="flex-none text-muted" aria-hidden />
      </Card>
    </Link>
  );
}
