import { isNetworkError } from "@/lib/offline-queue";

/**
 * Why a barber link failed to load. Only `revoked` means the server rejected the token
 * (unknown, replaced, or the barber was turned off). The other two are "we don't know yet".
 */
export type BarberLinkFailure = "revoked" | "offline" | "unavailable";

/** What to do with the phone's copy of this link after a failed load. */
export type BarberLoadAction = "revoke" | "cache" | "keep" | "error";

/**
 * A 404 (or `not_found`) is the server saying this token does not resolve.
 * Timeouts and transport failures are not that, even when the phone still shows signal.
 */
export function classifyBarberLinkError(e: unknown, online: boolean): BarberLinkFailure {
  const err = e as { status?: number; body?: { code?: string } } | null;
  const status = typeof err?.status === "number" ? err.status : undefined;
  if (status === 404 || err?.body?.code === "not_found") return "revoked";
  if (!online) return "offline";
  if (isNetworkError(e) || (status != null && status >= 500)) return "unavailable";
  return "unavailable";
}

/**
 * Revocation wins over any saved copy: a turned-off link must not keep working from this phone.
 * A transient failure keeps the open snapshot, or the last saved copy, and never counts as revocation.
 * With nothing saved, the caller still has to show an error (the screen copy is separate).
 */
export function settleBarberLoad(
  e: unknown,
  opts: { online: boolean; hasCache: boolean; hasShop: boolean },
): { failure: BarberLinkFailure; action: BarberLoadAction } {
  const failure = classifyBarberLinkError(e, opts.online);
  if (failure === "revoked") return { failure, action: "revoke" };
  if (opts.hasShop) return { failure, action: "keep" };
  if (opts.hasCache) return { failure, action: "cache" };
  return { failure, action: "error" };
}
