"use client";
import qrcode from "qrcode-generator";

/** Print-ready A5 poster (300 dpi, 1748×2480) for one location's booking QR. Black on white, 5 mm margins. */
export async function makeQrPoster({ url, shopName, place, logoUrl }: { url: string; shopName: string; place?: string; logoUrl?: string }): Promise<Blob> {
  const W = 1748, H = 2480, M = 150;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#0A0A0A"; g.lineWidth = 6; round(g, M / 2, M / 2, W - M, H - M, 64); g.stroke();
  const font = (w: number, px: number) => `${w} ${px}px "Plus Jakarta Sans", Inter, system-ui, -apple-system, sans-serif`;
  const center = (t: string, y: number, f: string, color = "#0A0A0A") => { g.font = f; g.fillStyle = color; g.textAlign = "center"; g.fillText(fit(g, t, W - M * 3), W / 2, y); };

  const logo = await load(logoUrl || "/icon-192.png").catch(() => (logoUrl ? load("/icon-192.png").catch(() => null) : null));
  void shopName; void place;
  center("Scan to join the waitlist", 560, font(800, 104));
  center("Book your haircut, no app needed", 650, font(600, 54), "#3A3A40");

  // QR, quiet zone included.
  const qr = qrcode(0, "H"); qr.addData(url); qr.make();
  const n = qr.getModuleCount(), Q = 1200, cell = Math.floor(Q / (n + 8)), size = cell * (n + 8), qx = (W - size) / 2, qy = 760;
  g.fillStyle = "#fff"; g.fillRect(qx, qy, size, size);
  g.lineWidth = 4; g.strokeStyle = "#E4E4E8"; round(g, qx - 20, qy - 20, size + 40, size + 40, 48); g.stroke();
  g.fillStyle = "#0A0A0A";
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) g.fillRect(qx + (col + 4) * cell, qy + (r + 4) * cell, cell, cell);

  if (logo) {
    const bx = Math.round(n * 0.22) * cell, x0 = qx + (size - bx) / 2, y0 = qy + (size - bx) / 2, pad = bx * 0.12;
    g.fillStyle = "#fff"; round(g, x0, y0, bx, bx, bx * 0.22); g.fill();
    g.save(); round(g, x0 + pad, y0 + pad, bx - 2 * pad, bx - 2 * pad, bx * 0.16); g.clip();
    const w = bx - 2 * pad, s2 = Math.max(w / logo.width, w / logo.height);
    g.drawImage(logo, x0 + pad + (w - logo.width * s2) / 2, y0 + pad + (w - logo.height * s2) / 2, logo.width * s2, logo.height * s2); g.restore();
  }
  center("Open your camera · point at the code", qy + size + 110, font(600, 44), "#6B6B73");
  // Footer: River icon + solid "Barbers.ph" wordmark, "Powered by River Apps" below.
  const icon = await load("/icon-192.png").catch(() => null);
  g.font = font(800, 52); const word = "Barbers.ph"; const tw = g.measureText(word).width, iw = 64, fx = (W - (tw + iw + 20)) / 2, fy = H - M - 90;
  if (icon) g.drawImage(icon, fx, fy - 50, iw, iw);
  g.fillStyle = "#0A0A0A"; g.textAlign = "left"; g.fillText(word, fx + iw + 20, fy);
  center("Powered by River Apps", fy + 62, font(600, 34), "#6B6B73");
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn’t make the poster."))), "image/png"));
}

function round(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fit(g: CanvasRenderingContext2D, t: string, max: number) { let s = t; while (g.measureText(s).width > max && s.length > 4) s = s.slice(0, -2); return s === t ? t : `${s.trimEnd()}…`; }
function load(src: string) { return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
