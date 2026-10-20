/** Version + build of the running deploy (inlined by next.config; /api/version reports the same). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
