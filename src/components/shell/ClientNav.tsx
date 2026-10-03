"use client";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * The kit's Sidebar, MobileTabBar and Button(href) render plain <a href>. This wrapper turns
 * same-origin clicks into client-side navigations so in-memory mock state survives page changes.
 */
export function ClientNav({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  function onClick(e: MouseEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest("a");
    if (!a || a.target || a.hasAttribute("download")) return;
    const href = a.getAttribute("href");
    if (!href || href === "#" || href.startsWith("#")) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    router.push(url.pathname + url.search + url.hash);
  }
  return <div className={className} onClick={onClick}>{children}</div>;
}
