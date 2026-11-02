/**
 * v1.0.42 barber view wording (Jimboy, 2026-11-03: "For barbers view. Walkin > Customer"). Display text only:
 * stored data (channel "walk-in", customerLabel "Walk-in"), field names and the owner view are unchanged.
 */
export function barberText(s: string): string {
  return s
    .replace(/\bWalk-?ins\b/g, "Customers").replace(/\bwalk-?ins\b/gi, "customers")
    .replace(/\bWalk-?in\b/g, "Customer").replace(/\bwalk-?in\b/gi, "customer");
}

/** A visit's name on the barber view: the stored "Walk-in" placeholder (or nothing) reads "Customer". */
export function barberWho(label?: string | null): string {
  const t = (label ?? "").trim();
  return !t || /^walk-?in$/i.test(t) ? "Customer" : t;
}
