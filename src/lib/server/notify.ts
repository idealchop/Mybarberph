import "server-only";
import { loadState } from "@/lib/server/shops";

/**
 * Outbound alerts (SMS / email) behind a pluggable provider. Nothing is sent until a provider is
 * configured via env; no provider or secret is hardcoded here.
 *
 *   NOTIFY_SMS_WEBHOOK_URL    POST {to, text}            (any SMS gateway / relay you run)
 *   NOTIFY_EMAIL_WEBHOOK_URL  POST {to, subject, text}   (any email relay)
 *   NOTIFY_WEBHOOK_TOKEN      optional bearer token for both
 * Or call setNotifyProvider() at startup with your own implementation.
 */
export interface NotifyProvider {
  sms?(to: string, text: string): Promise<void>;
  email?(to: string, subject: string, text: string): Promise<void>;
}

let custom: NotifyProvider | null = null;
export function setNotifyProvider(p: NotifyProvider | null) { custom = p; }

function envProvider(): NotifyProvider {
  const token = process.env.NOTIFY_WEBHOOK_TOKEN;
  const post = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`notify ${r.status}`);
  };
  const sms = process.env.NOTIFY_SMS_WEBHOOK_URL, mail = process.env.NOTIFY_EMAIL_WEBHOOK_URL;
  return {
    ...(sms ? { sms: (to: string, text: string) => post(sms, { to, text }) } : {}),
    ...(mail ? { email: (to: string, subject: string, text: string) => post(mail, { to, subject, text }) } : {}),
  };
}
const provider = () => custom ?? envProvider();
export const notifyConfigured = () => { const p = provider(); return Boolean(p.sms || p.email); };

interface Contact { phone?: string; email?: string }

async function contactsFor(shopId: string, locationId: string): Promise<{ owner: Contact; barbers: Contact[] }> {
  const st = await loadState(shopId, ["barbers.shop-profile", "barbers.shop-chairs"]);
  const parse = (k: string) => { try { return JSON.parse(st[k] || "null"); } catch { return null; } };
  const prof = (parse("barbers.shop-profile") ?? {}) as { notifyPhone?: string; notifyEmail?: string };
  const chairs = (Array.isArray(parse("barbers.shop-chairs")) ? parse("barbers.shop-chairs") : []) as { phone?: string; email?: string; active?: boolean; locationId?: string }[];
  return {
    owner: { phone: prof.notifyPhone, email: prof.notifyEmail },
    barbers: chairs.filter((c) => c.active !== false && (c.locationId || "home") === locationId).map((c) => ({ phone: c.phone, email: c.email })),
  };
}

/** New online booking → owner (and that location's active barbers). Never throws; no-op without a provider. */
export async function notifyNewOnlineBooking(shopId: string, b: { ref: string; customerLabel?: string; serviceName?: string; slotLabel?: string; locationId?: string; shopName?: string }) {
  try {
    const p = provider();
    if (!p.sms && !p.email) return;
    const { owner, barbers } = await contactsFor(shopId, b.locationId || "home");
    const text = `New booking ${b.ref}: ${b.customerLabel || "Customer"} · ${b.serviceName || "Service"}${b.slotLabel ? ` · ${b.slotLabel}` : ""}. Open Barbers.ph to accept.`;
    const subject = `New booking ${b.ref}${b.shopName ? ` · ${b.shopName}` : ""}`;
    const to = [owner, ...barbers];
    const phones = [...new Set(to.map((c) => c.phone?.trim()).filter(Boolean) as string[])];
    const emails = [...new Set(to.map((c) => c.email?.trim()).filter(Boolean) as string[])];
    await Promise.allSettled([
      ...(p.sms ? phones.map((n) => p.sms!(n, text)) : []),
      ...(p.email ? emails.map((e) => p.email!(e, subject, text)) : []),
    ]);
  } catch { /* alerts are best-effort */ }
}
