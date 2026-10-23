/**
 * Barbers.ph 3D icons: barber-specific art drawn in the River 3D style (River UI kit docs/icons/ICON-STYLE.md;
 * the generic river-kit-pack is only the style reference). Files live in public/icons3d/barbers/{128,256}/<concept>.webp,
 * listed in public/icons3d/barbers/manifest.json. Small functional glyphs stay as lucide line icons.
 */
export const BARBER_3D_ICONS = [
  "home", "orders", "moments", "services", "haircut", "beard", "shave", "hair-wash", "kids-cut", "styling", "chair", "pole",
  "staff", "customers", "bookings", "qr", "reports", "payments", "trophy", "waiting-area", "location", "install", "billing",
  "rewards", "empty-queue", "empty-bookings",
] as const;
export type Barber3dIconName = (typeof BARBER_3D_ICONS)[number];
/** Kept for existing imports. */
export const RIVER_ICONS = BARBER_3D_ICONS;
export type RiverIconName = Barber3dIconName;

/** 128px file up to 64px on screen (2x), 256px above. */
export function riverIconSrc(name: Barber3dIconName, size = 48): string {
  return `/icons3d/barbers/${size <= 64 ? 128 : 256}/${name}.webp`;
}
export const barberIconSrc = riverIconSrc;

export function RiverIcon({ name, size = 40, className = "", title }: { name: Barber3dIconName; size?: number; className?: string; title?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={riverIconSrc(name, size)} alt={title ?? ""} aria-hidden={title ? undefined : true} role={title ? "img" : undefined} width={size} height={size} draggable={false}
      className={`block shrink-0 object-contain ${className}`} style={{ width: size, height: size }} />
  );
}
