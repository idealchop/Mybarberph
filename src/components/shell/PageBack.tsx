"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/** Back chevron on the page title line. Uses history, then a known page if this tab was opened directly. */
export function PageBack({ fallback = "/home" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink"
    >
      <ChevronLeft size={26} strokeWidth={1.75} />
    </button>
  );
}
