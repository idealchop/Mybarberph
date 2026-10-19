/** River Mobile 3D icons (river-mobile-ui assets/icons3d, ~300px PNG = 3x+ at nav sizes). */
const SRC: Record<string, string> = { home: "/icons3d/house.png", queue: "/icons3d/ticket.png", moments: "/icons3d/sparkle.png" };

/** Inactive items are muted (greyscale, faded); the active item is full colour. */
export function NavIcon3D({ name, size, active }: { name: string; size: number; active?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[name] ?? SRC.home}
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
