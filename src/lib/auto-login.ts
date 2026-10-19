/**
 * Which pages open the sign-in sheet by themselves for a signed-out visitor (once per visit).
 * Public/guest pages never do: booking and schedule (/book), the customer's ticket, barber links (/b/…),
 * Moments, privacy, terms and map credits. Most of these live outside the shop shell; listing them here keeps
 * the rule in one place if they move.
 */
const GUEST_PAGES = ["/book", "/b", "/moments", "/privacy", "/terms", "/settings/map-credits", "/ticket"];

export function autoOpensLogin(pathname: string): boolean {
  const p = pathname.split("?")[0]!.replace(/\/+$/, "") || "/";
  return !GUEST_PAGES.some((g) => p === g || p.startsWith(`${g}/`));
}

let shown = false;
/** True the first time per page load (a "visit"); later calls return false. */
export function takeAutoLoginTurn(): boolean {
  if (shown) return false;
  shown = true;
  return true;
}
/** Tests only. */
export function resetAutoLoginTurn() { shown = false; }
