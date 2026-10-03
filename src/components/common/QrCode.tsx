"use client";
import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** Real, scannable QR (qrcode-generator) drawn as a crisp SVG in kit ink. */
export function QrCode({ value, size = 200, label }: { value: string; size?: number; label?: string }) {
  const { n, cells } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const cells: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c} ${r}h1v1h-1z`);
    return { n, cells: cells.join("") };
  }, [value]);
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} role="img" aria-label={label ?? `QR code for ${value}`} shapeRendering="crispEdges" style={{ display: "block" }}>
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path d={cells} fill="#0A0A0A" />
    </svg>
  );
}
