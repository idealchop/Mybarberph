import "server-only";

/**
 * Structured audit line for mutations that do not belong in the owner's activity feed
 * (community posts, photo uploads). Cloud Logging indexes the JSON on App Hosting, so
 * `jsonPayload.kind="audit"` finds every entry. Never put tokens, secrets or message bodies here.
 * Feed-worthy shop changes use logActivity() in ./activity.ts (shops/{shopId}/activity).
 */
export interface AuditEvent {
  action: string;
  /** Tenant (shop owner uid). */
  shopId: string;
  actor: { role: "owner" | "barber" | "customer" | "partner" | "system"; id?: string };
  resource?: { type: string; id: string };
  outcome?: "ok" | "denied";
}

export function auditLog(e: AuditEvent) {
  console.info(JSON.stringify({ severity: "INFO", kind: "audit", at: new Date().toISOString(), ...e }));
}
