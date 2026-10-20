"use client";

/** Editors open as their own full-screen page (one back button; Jimboy, 2026-10-21). */
export function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-canvas" role="dialog" aria-modal="true">
      <div className="mx-auto w-full max-w-[402px] px-4 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-4 lg:max-w-[560px] lg:px-[30px] lg:pt-6">{children}</div>
    </div>
  );
}
