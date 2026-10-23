"use client";
import { RiverIcon, type Barber3dIconName } from "@/components/common/river-icon";

/** Stored service icon keys (kept stable for saved menus) mapped to the Barbers.ph 3D set. */
export type BarberIconName = "scissors" | "clipper" | "pole" | "razor" | "towel" | "ticket" | "gift" | "qr" | "trophy" | "shop" | "beard" | "kids" | "styling";

export const BARBER_ICON_ART: Record<BarberIconName, Barber3dIconName> = {
  clipper: "haircut", scissors: "services", pole: "pole", razor: "shave", towel: "hair-wash", ticket: "orders",
  gift: "rewards", qr: "qr", trophy: "trophy", shop: "home", beard: "beard", kids: "kids-cut", styling: "styling",
};

/** Barber service/feature icon (3D WebP from public/icons3d/barbers). */
export function BarberIcon({ name, size = 32, title, className }: { name: BarberIconName; size?: number; title?: string; className?: string }) {
  return <RiverIcon name={BARBER_ICON_ART[name] ?? "services"} size={size} title={title} className={className} />;
}
