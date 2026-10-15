/** Pulls a ticket code (BK-XXXXXX, or older refs like RM-48213) out of scanned text: a ticket URL (?code=…) or the bare code. */
export function parseTicketCode(text: string): string {
  const t = text.trim();
  try {
    const u = new URL(t);
    const q = u.searchParams.get("code") || u.searchParams.get("ref");
    if (q) return q.trim().toUpperCase();
  } catch { /* not a URL */ }
  const m = t.match(/\b(BK-[A-Z0-9]{6})\b/i) || t.match(/\b([A-Z]{2}-[A-Z0-9]{4,8})\b/i);
  return (m ? m[1]! : t).toUpperCase();
}
