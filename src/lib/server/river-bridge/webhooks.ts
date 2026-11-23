import "server-only";
import type { ChairRequest } from "@/lib/booking-types";
import { isRiverSource, publicStatus, webhookEventId, webhookEventType } from "@/lib/river-status";
import { webhookConfig, type WebhookConfig } from "./config";
import { signRequest } from "./sign";

/**
 * Signed status webhooks, Barbers.ph → River Bridge, on each status change of a River Mobile ticket.
 * Pushed from the write path (putBooking / verify / cancel): no polling.
 * Factor 1: this runtime's Google ID token, audience = the webhook URL. Factor 2: HMAC with the
 * webhook-direction secret (never the request secret). Idempotency-Key = event id.
 */
export interface WebhookEvent {
  id: string;
  type: string;
  occurredAt: string;
  data: { orderId: string; reference?: string; status: string; shopId?: string; customerRef?: string };
}

export function buildWebhookEvent(prev: ChairRequest | undefined, next: ChairRequest): WebhookEvent | null {
  if (!isRiverSource(next.source)) return null;
  const type = webhookEventType(prev?.status, next.status);
  if (!type) return null;
  const data: WebhookEvent["data"] = { orderId: next.id, reference: next.ref, status: publicStatus(next.status), shopId: next.shopId };
  if (next.customerRef) data.customerRef = next.customerRef;
  return { id: webhookEventId(next.id, next.status), type, occurredAt: new Date(next.updatedAt || Date.now()).toISOString(), data };
}

export interface DeliverDeps {
  fetch?: typeof fetch;
  mintIdToken?: (audience: string) => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: Record<string, unknown>) => void;
  now?: () => Date;
}

/** Backoff before each retry (first try is immediate). */
export const RETRY_DELAYS_MS = [2_000, 10_000, 30_000];

/** One signed POST. Returns "ok", "retry" (network/5xx/408/429) or "fail" (other 4xx). */
export async function sendWebhookOnce(cfg: Extract<WebhookConfig, { ok: true }>, event: WebhookEvent, deps: DeliverDeps = {}): Promise<"ok" | "retry" | "fail"> {
  const doFetch = deps.fetch ?? fetch;
  const mint = deps.mintIdToken ?? (await import("./google-oidc")).mintIdToken;
  const body = JSON.stringify(event);
  try {
    const token = await mint(cfg.audience);
    const signed = signRequest({ method: "POST", pathWithQuery: new URL(cfg.url).pathname, body, keyId: cfg.keyId, secret: cfg.secret, authorization: `Bearer ${token}`, idempotencyKey: event.id, now: deps.now?.() });
    const res = await doFetch(cfg.url, { method: "POST", headers: signed.headers, body, signal: AbortSignal.timeout(5000) });
    if (res.ok) return "ok";
    return res.status >= 500 || res.status === 408 || res.status === 429 ? "retry" : "fail";
  } catch {
    return "retry";
  }
}

/** Sends with retries and backoff. Logs the outcome (event id, type, status only). Never throws. */
/** `delays[i]` is the wait before attempt i (0 = send now). Each attempt is freshly signed (new nonce). */
export async function deliverWebhook(cfg: Extract<WebhookConfig, { ok: true }>, event: WebhookEvent, deps: DeliverDeps = {}, delays: number[] = [0, ...RETRY_DELAYS_MS], firstAttempt = 1): Promise<boolean> {
  const log = deps.log ?? ((l) => console.info(JSON.stringify(l)));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]! > 0) await sleep(delays[i]!);
    const r = await sendWebhookOnce(cfg, event, deps);
    log({ severity: r === "ok" ? "INFO" : "WARNING", type: "river_webhook", eventId: event.id, eventType: event.type, keyId: cfg.keyId, attempt: firstAttempt + i, result: r });
    if (r === "ok") return true;
    if (r === "fail") return false;
  }
  return false;
}

/**
 * Called after a booking write. No-op unless it is a River Mobile ticket whose public status changed
 * and webhooks are configured for dev. The first attempt is awaited; retries continue in the background.
 */
export async function emitStatusWebhook(prev: ChairRequest | undefined, next: ChairRequest, deps: DeliverDeps & { config?: WebhookConfig } = {}): Promise<void> {
  try {
    const event = buildWebhookEvent(prev, next);
    if (!event) return;
    const cfg = deps.config ?? webhookConfig();
    if (!cfg.ok) return;
    const first = await sendWebhookOnce(cfg, event, deps);
    const log = deps.log ?? ((l) => console.info(JSON.stringify(l)));
    log({ severity: first === "ok" ? "INFO" : "WARNING", type: "river_webhook", eventId: event.id, eventType: event.type, keyId: cfg.keyId, attempt: 1, result: first });
    if (first === "retry") void deliverWebhook(cfg, event, deps, RETRY_DELAYS_MS, 2).catch(() => undefined);
  } catch (e) {
    console.error("river webhook failed", (e as Error).message);
  }
}
