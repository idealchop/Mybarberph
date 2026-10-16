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
/** PH mobile → +63XXXXXXXXXX (Brevo wants digits with country code). Other numbers pass through. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "");
  if (/^\+639\d{9}$/.test(d)) return d;
  if (/^639\d{9}$/.test(d)) return `+${d}`;
  if (/^09\d{9}$/.test(d)) return `+63${d.slice(1)}`;
  if (/^9\d{9}$/.test(d)) return `+63${d}`;
  return /^\+\d{8,15}$/.test(d) ? d : null;
}

/** Brevo transactional SMS + email, enabled when BREVO_API_KEY is set. */
function brevoProvider(key: string): NotifyProvider {
  const call = async (path: string, body: unknown) => {
    const r = await fetch(`https://api.brevo.com/v3${path}`, { method: "POST", headers: { "api-key": key, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`brevo ${path} ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`);
  };
  return {
    async sms(to, text) {
      const recipient = normalizePhone(to);
      if (!recipient) throw new Error("brevo sms: invalid number");
      await call("/transactionalSMS/sms", { sender: "BarbersPH", recipient: recipient.replace(/^\+/, ""), content: text, type: "transactional" });
    },
    async email(to, subject, text) {
      await call("/smtp/email", { sender: { email: "customers@riverph.com", name: "Barbers.ph" }, to: [{ email: to }], subject, textContent: text });
    },
  };
}

const provider = () => custom ?? (process.env.BREVO_API_KEY ? brevoProvider(process.env.BREVO_API_KEY) : envProvider());
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
export async function notifyNewOnlineBooking(shopId: string, b: { ref: string; customerLabel?: string; serviceName?: string; slotLabel?: string; locationId?: string; shopName?: string; homeAddress?: string }) {
  try {
    const p = provider();
    if (!p.sms && !p.email) return;
    const { owner, barbers } = await contactsFor(shopId, b.locationId || "home");
    const text = `${b.shopName ? `${b.shopName}: ` : ""}New ${b.homeAddress ? "Home service" : "online"} booking ${b.ref} from ${b.customerLabel || "Customer"}, ${b.serviceName || "Service"}${b.slotLabel ? `, ${b.slotLabel}` : ""}${b.homeAddress ? `. Address: ${b.homeAddress}` : ""}. Open Barbers.ph to accept.`;
    const subject = `${b.homeAddress ? "Home service" : "New booking"} ${b.ref}${b.shopName ? ` · ${b.shopName}` : ""}`;
    const to = [owner, ...barbers];
    const phones = [...new Set(to.map((c) => c.phone?.trim()).filter(Boolean) as string[])];
    const emails = [...new Set(to.map((c) => c.email?.trim()).filter(Boolean) as string[])];
    const results = await Promise.allSettled([
      ...(p.sms ? phones.map((n) => p.sms!(n, text)) : []),
      ...(p.email ? emails.map((e) => p.email!(e, subject, text)) : []),
    ]);
    for (const r of results) if (r.status === "rejected") console.error("[notify]", (r.reason as Error)?.message ?? r.reason);
  } catch (e) { console.error("[notify] failed", (e as Error)?.message); /* alerts are best-effort */ }
}
