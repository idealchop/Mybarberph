/** 3D "chart increasing" (Fluent 3D set) — the Sales icon everywhere. */
export function SalesIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons3d/chart-up.png" alt="" aria-hidden width={size} height={size} draggable={false} className={`block flex-none object-contain ${className}`} style={{ width: size, height: size }} />;
}
