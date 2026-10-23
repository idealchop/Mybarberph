import { riverIconSrc, type RiverIconName } from "@/components/common/river-icon";

/** Barbers.ph 3D icons: Home (barbershop), Queue (barber ticket), Moments (sparkle with scissors). */
const NAME: Record<string, RiverIconName> = { home: "home", queue: "orders", moments: "moments" };

/** Inactive items are muted (greyscale, faded); the active item is full colour. */
export function NavIcon3D({ name, size, active }: { name: string; size: number; active?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={riverIconSrc(NAME[name] ?? "home", size)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      className={`nav-3d block shrink-0 object-contain transition-[filter,opacity] ${active ? "" : "opacity-60 grayscale-[0.85]"}`}
      style={{ width: size, height: size }}
    />
  );
}
