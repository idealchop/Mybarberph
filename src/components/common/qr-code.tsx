"use client";
import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** Real, scannable QR (qrcode-generator) drawn as a crisp SVG in kit ink. */
export function QrCode({ value, size = 200, label, logo }: { value: string; size?: number; label?: string; logo?: string }) {
  const { n, cells } = useMemo(() => {
    const qr = qrcode(0, logo ? "H" : "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const cells: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c} ${r}h1v1h-1z`);
    return { n, cells: cells.join("") };
  }, [value, logo]);
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} role="img" aria-label={label ?? `QR code for ${value}`} shapeRendering="crispEdges" style={{ display: "block" }}>
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path d={cells} fill="#0A0A0A" />
      {logo ? (() => { const b = n * 0.22, x = (n - b) / 2, pad = b * 0.12; return (<g><rect x={x} y={x} width={b} height={b} rx={b * 0.22} fill="#fff" /><image href={logo} x={x + pad} y={x + pad} width={b - 2 * pad} height={b - 2 * pad} preserveAspectRatio="xMidYMid slice" clipPath={`inset(0 round ${b * 0.18}px)`} /></g>); })() : null}
    </svg>
  );
}
