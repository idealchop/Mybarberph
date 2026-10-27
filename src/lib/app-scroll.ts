/**
 * Shop app scrolling (v1.0.18): the shop screens scroll inside ONE element (#app-scroll), not the window,
 * so the bottom tab bar can be a plain flex child. Use these instead of window.scrollY / window.scrollTo.
 */
export const APP_SCROLL_ID = "app-scroll";

export function appScroller(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.getElementById(APP_SCROLL_ID);
}

/** Current scroll position (inner scroller when present, else the window). */
export function appScrollTop(): number {
  const el = appScroller();
  return el ? el.scrollTop : typeof window === "undefined" ? 0 : window.scrollY;
}

/** Scroll height of whatever scrolls the page. */
export function appScrollHeight(): number {
  const el = appScroller();
  return el ? el.scrollHeight : document.documentElement.scrollHeight;
}

export function appScrollTo(top: number, behavior: ScrollBehavior = "auto") {
  const el = appScroller();
  if (el) el.scrollTo({ top, behavior });
  else window.scrollTo({ top, behavior });
}
