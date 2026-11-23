import "server-only";

/**
 * River Mobile → Barbers.ph partner API auth. Since v1.0.51 every /api/river/v1 route (except /health)
 * goes through the River Bridge two-factor check (Google OIDC + HMAC, bridge-kit) in ./river-bridge.
 * The old shared RIVER_MOBILE_API_KEY is no longer accepted anywhere.
 */
export { withRiver, problemResponse, MAX_BODY_BYTES, type RiverCtx } from "./river-bridge/partner";
