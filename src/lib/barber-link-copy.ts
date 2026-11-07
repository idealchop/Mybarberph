/**
 * The text placed on the clipboard for a barber link: the absolute URL and nothing else.
 * Call `writeBarberLinkUrl` from the tap handler itself, before any await, so iOS still
 * treats it as a user gesture. The promise may settle later; the call must not.
 */
export function barberLinkUrl(origin: string, path: string): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${base}${path}`;
}

/** True when the clipboard string is a single absolute URL with no extra characters. */
export function isUrlOnly(value: string): boolean {
  return /^https?:\/\/\S+$/.test(value);
}

export function writeBarberLinkUrl(url: string): Promise<boolean> {
  if (!isUrlOnly(url)) return Promise.resolve(false);
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  const write = clipboard?.writeText;
  if (!write) return Promise.resolve(false);
  try {
    return Promise.resolve(write.call(clipboard, url)).then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}
