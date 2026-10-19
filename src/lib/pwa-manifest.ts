/** Web app manifests (Jimboy, 2026-10-20). Owner app opens /home; a barber link installs as its own app. */
export const PWA_THEME = "#0A0A0A";
export const PWA_BACKGROUND = "#FFFFFF";

const ICONS = [
  { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/pwa/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
  { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

const base = { display: "standalone", orientation: "portrait", background_color: PWA_BACKGROUND, theme_color: PWA_THEME, icons: ICONS, lang: "en" };

export function ownerManifest() {
  return { ...base, id: "/home", name: "Barbers.ph", short_name: "Barbers.ph", description: "Run your barbershop: queue, sales and bookings.", start_url: "/home", scope: "/" };
}

/** Per-token manifest: the home-screen shortcut opens that barber's link and stays inside it. */
export function barberManifest(token: string, barberName: string) {
  const path = `/b/${encodeURIComponent(token)}`;
  const name = `Barbers.ph · ${barberName}`.slice(0, 60);
  return { ...base, id: path, name, short_name: barberName.slice(0, 12) || "Barbers.ph", description: "Your barber link: queue, walk-ins and your sales.", start_url: path, scope: path };
}
