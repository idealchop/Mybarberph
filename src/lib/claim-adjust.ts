/**
 * Adjusted claim (v1.0.34, Jimboy: "make the total amount editable in case of mismatch or error on the record").
 * The owner can enter the actual amount received when claiming a barber's day. The claim doc keeps the
 * expected owner share, the received amount and the difference. Sales records are never modified.
 */
export interface ClaimAdjust { expected: number; received: number; adjusted: boolean; difference: number }

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Parse what the owner typed ("1,250", "₱90", "90.5"). Returns null when it is not a usable peso amount. */
export function parseClaimAmount(text: string): number | null {
  const t = text.replace(/[₱,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const n = round2(Number(t));
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? n : null;
}

/** Expected vs received. `received` missing/invalid = the expected amount (no adjustment). */
export function claimAdjust(expected: number, received?: number | null): ClaimAdjust {
  const e = round2(Math.max(0, expected || 0));
  const r = typeof received === "number" && Number.isFinite(received) && received >= 0 ? round2(received) : e;
  return { expected: e, received: r, adjusted: r !== e, difference: round2(r - e) };
}

/** What a claim counts as claimed in reports: the received amount when adjusted, else the owner share. */
export function claimedValue(c: { amount: number; ownerShare?: number; received?: number; adjusted?: boolean }): number {
  if (c.adjusted && typeof c.received === "number") return c.received;
  return c.ownerShare ?? c.amount;
}

/** The adjustment shown on a day once claimed: sum of adjusted claims covering it. Null when nothing was adjusted. */
export function dayAdjustment(claims: { id: string; adjusted?: boolean; expected?: number; received?: number }[]): { expected: number; received: number } | null {
  const seen = new Set<string>();
  let expected = 0, received = 0, any = false;
  for (const c of claims) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    if (c.adjusted && typeof c.expected === "number" && typeof c.received === "number") { any = true; expected += c.expected; received += c.received; }
  }
  return any ? { expected: round2(expected), received: round2(received) } : null;
}

/**
 * v1.0.37: the claim amounts are centavos (like every amount shown with peso()), the input is pesos.
 * v1.0.34–36 put centavos straight into the input (₱50 due showed "5000") and saved typed pesos as centavos.
 */
export function claimInputText(centavos: number): string {
  const p = Math.round(Math.max(0, centavos || 0)) / 100;
  return Number.isInteger(p) ? String(p) : p.toFixed(2);
}

/** What the owner typed (pesos) → centavos, or null when it is not a usable amount. */
export function parseClaimCentavos(text: string): number | null {
  const p = parseClaimAmount(text);
  return p === null ? null : Math.round(p * 100);
}
