/**
 * The AI Companion is shown only where COMPANION_ENABLED=1 (apphosting.dev.yaml for now).
 * next.config copies it to NEXT_PUBLIC_COMPANION_ENABLED at build time for the browser.
 */
export const companionEnabled = () => (process.env.COMPANION_ENABLED ?? process.env.NEXT_PUBLIC_COMPANION_ENABLED) === "1";
