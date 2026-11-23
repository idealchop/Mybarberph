import { describe, expect, it } from "vitest";
import type { ChairRequest } from "@/lib/booking-types";
import { canCustomerCancel, isRiverSource, publicStatus, toOrder, webhookEventId, webhookEventType } from "@/lib/river-status";
import { buildWebhookEvent, deliverWebhook, emitStatusWebhook, sendWebhookOnce } from "@/lib/server/river-bridge/webhooks";
import { verifyRequest } from "@/lib/server/river-bridge/verify";
import { MemoryNonceStore } from "@/lib/server/river-bridge/nonce";
import { IDEMPOTENCY_KEY } from "@/lib/server/river-bridge/idempotency";
import { WEBHOOK_URL_DEV } from "@/lib/server/river-bridge/config";

const W1 = "test-webhook-secret-v1-0123456789";
const REQ = "test-request-secret-v1-0123456789";
const RUNTIME_SA = "firebase-app-hosting-compute@mybarberph.iam.gserviceaccount.com";
const cfg = { ok: true as const, url: WEBHOOK_URL_DEV, audience: WEBHOOK_URL_DEV, keyId: "barbers-to-bridge-dev-v1", secret: W1 };

const row = (status: ChairRequest["status"], source = "river_mobile"): ChairRequest => ({
  id: "river_mobile-abc123", shopId: "shop-uid-1", ref: "BK-7K2Q9M", channel: "online", status, contact: "+639171234567", customerLabel: "Ana",
  serviceId: "haircut", serviceName: "Haircut", price: 25000, slotLabel: "Now", payWhere: "shop", createdAt: 1, updatedAt: 1_700_000_000_000, source, customerRef: "cref-1",
});

describe("status mapping (mapping.md)", () => {
  it("TC-RB-MAP-01 internal → shared status; no invented ready", () => {
    expect(publicStatus("requested")).toBe("requested");
    expect(publicStatus("accepted")).toBe("accepted");
    expect(publicStatus("in_chair")).toBe("in_progress");
    expect(publicStatus("done")).toBe("completed");
    expect(publicStatus("declined")).toBe("declined");
    expect(publicStatus("cancelled")).toBe("cancelled");
    const all = (["requested", "accepted", "in_chair", "done", "declined", "cancelled"] as const).map(publicStatus);
    expect(all).not.toContain("ready");
  });
  it("TC-RB-MAP-02 river, river_mobile and older spellings are River Mobile tickets; qr is not", () => {
    for (const s of ["river", "river_mobile", "river_mobile_api", "river-mobile"]) expect(isRiverSource(s)).toBe(true);
    for (const s of ["qr", "manual", undefined, ""]) expect(isRiverSource(s)).toBe(false);
  });
  it("TC-RB-CANCEL-01 customer cancel only while requested or accepted", () => {
    expect(canCustomerCancel("requested")).toBe(true);
    expect(canCustomerCancel("accepted")).toBe(true);
    for (const s of ["in_chair", "done", "declined", "cancelled"] as const) expect(canCustomerCancel(s)).toBe(false);
  });
  it("TC-RB-MAP-03 Order shape", () => {
    expect(toOrder(row("in_chair", "river"))).toEqual({ orderId: "river_mobile-abc123", shopId: "shop-uid-1", reference: "BK-7K2Q9M", status: "in_progress", source: "river_mobile", totalCentavos: 25000, currency: "PHP", updatedAt: new Date(1_700_000_000_000).toISOString() });
  });
});

describe("webhook events", () => {
  it("TC-RB-WH-01 one event per status change; none for requested, unchanged or non-River tickets", () => {
    expect(webhookEventType(undefined, "requested")).toBeNull();
    expect(webhookEventType("requested", "requested")).toBeNull();
    expect(webhookEventType("requested", "accepted")).toBe("order.accepted");
    expect(webhookEventType("accepted", "in_chair")).toBe("order.in_progress");
    expect(webhookEventType("in_chair", "done")).toBe("order.completed");
    expect(webhookEventType("requested", "declined")).toBe("order.declined");
    expect(webhookEventType("accepted", "cancelled")).toBe("order.cancelled");
    expect(buildWebhookEvent(row("requested"), row("accepted", "qr"))).toBeNull();
    const ev = buildWebhookEvent(row("requested"), row("in_chair", "river"))!;
    expect(ev).toEqual({ id: "barbers.river_mobile-abc123.in_progress", type: "order.in_progress", occurredAt: new Date(1_700_000_000_000).toISOString(),
      data: { orderId: "river_mobile-abc123", reference: "BK-7K2Q9M", status: "in_progress", shopId: "shop-uid-1", customerRef: "cref-1" } });
    expect(IDEMPOTENCY_KEY.test(ev.id)).toBe(true);
    expect(webhookEventId("x".repeat(80), "done").length).toBeLessThanOrEqual(128);
    expect(JSON.stringify(ev)).not.toContain("+639171234567");
  });

  it("TC-RB-WH-02 signed with the webhook secret + runtime OIDC token (aud = webhook URL); the Bridge's verifier accepts it", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fetchFake = (async (url: string, init: RequestInit) => { captured = { url, init }; return new Response(null, { status: 204 }); }) as unknown as typeof fetch;
    const audiences: string[] = [];
    const ev = buildWebhookEvent(row("requested"), row("accepted"))!;
    const r = await sendWebhookOnce(cfg, ev, { fetch: fetchFake, mintIdToken: async (aud) => { audiences.push(aud); return "h.p.s"; } });
    expect(r).toBe("ok");
    expect(audiences).toEqual([WEBHOOK_URL_DEV]);
    expect(captured!.url).toBe(WEBHOOK_URL_DEV);
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe(ev.id);
    expect(headers["X-River-Key-Id"]).toBe("barbers-to-bridge-dev-v1");
    expect(headers["X-River-Signature"]).toMatch(/^v1=[0-9a-f]{64}$/);
    const bridgeVerify = (secret: string) => verifyRequest(
      { method: "POST", pathWithQuery: "/bridge/hooks/barbers", headers, rawBody: String(captured!.init.body), secure: true },
      { audience: WEBHOOK_URL_DEV, secrets: [{ keyId: "barbers-to-bridge-dev-v1", secret }], allowedEmails: [RUNTIME_SA], oidc: { verify: async (_t, aud) => ({ email: RUNTIME_SA, audience: aud }) }, nonces: new MemoryNonceStore(), allowKeyFallback: false, requireHttps: true },
    );
    expect((await bridgeVerify(W1)).ok).toBe(true);
    // The request-direction secret must not validate a webhook.
    expect((await bridgeVerify(REQ)).ok).toBe(false);
  });

  it("TC-RB-WH-03 retries with backoff on 5xx/network, stops on 4xx, fresh nonce each try", async () => {
    const statuses = [503, 0, 204];
    const nonces: string[] = [];
    const fetchFake = (async (_u: string, init: RequestInit) => {
      nonces.push((init.headers as Record<string, string>)["X-River-Nonce"]!);
      const s = statuses.shift()!;
      if (s === 0) throw new Error("network");
      return new Response(null, { status: s });
    }) as unknown as typeof fetch;
    const waits: number[] = [];
    const ok = await deliverWebhook(cfg, buildWebhookEvent(row("accepted"), row("done"))!, { fetch: fetchFake, mintIdToken: async () => "h.p.s", sleep: async (ms) => { waits.push(ms); }, log: () => undefined }, [0, 2000, 10000, 30000]);
    expect(ok).toBe(true);
    expect(waits).toEqual([2000, 10000]);
    expect(new Set(nonces).size).toBe(3);

    let calls = 0;
    const bad = (async () => { calls++; return new Response(null, { status: 400 }); }) as unknown as typeof fetch;
    expect(await deliverWebhook(cfg, buildWebhookEvent(row("accepted"), row("done"))!, { fetch: bad, mintIdToken: async () => "h.p.s", sleep: async () => undefined, log: () => undefined })).toBe(false);
    expect(calls).toBe(1);
  });

  it("TC-RB-WH-04 nothing is sent when webhooks are not configured (prod)", async () => {
    let calls = 0;
    const fetchFake = (async () => { calls++; return new Response(null, { status: 204 }); }) as unknown as typeof fetch;
    await emitStatusWebhook(row("requested"), row("accepted"), { fetch: fetchFake, mintIdToken: async () => "h.p.s", config: { ok: false, reason: "not_dev_stage" } });
    expect(calls).toBe(0);
    await emitStatusWebhook(row("requested"), row("accepted"), { fetch: fetchFake, mintIdToken: async () => "h.p.s", config: cfg, log: () => undefined });
    expect(calls).toBe(1);
  });
});
