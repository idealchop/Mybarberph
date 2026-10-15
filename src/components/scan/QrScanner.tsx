"use client";
import { useEffect, useRef, useState } from "react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Live camera QR scanner. Uses the native BarcodeDetector when present, else jsQR on canvas frames
 * (works on iOS Safari: playsinline + muted + getUserMedia rear camera, HTTPS only).
 */
export function QrScanner({ onResult, paused = false, className }: { onResult: (text: string) => void; paused?: boolean; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onResult);
  useEffect(() => { cb.current = onResult; }, [onResult]);
  const [state, setState] = useState<"starting" | "on" | "denied" | "unavailable">("starting");

  useEffect(() => {
    if (paused) return;
    let stream: MediaStream | null = null;
    let raf = 0, live = true, last = "", lastAt = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) { setState("unavailable"); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e) {
        if (!live) return;
        setState((e as DOMException)?.name === "NotAllowedError" || (e as DOMException)?.name === "SecurityError" ? "denied" : "unavailable");
        return;
      }
      if (!live) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = video.current!;
      v.srcObject = stream; v.setAttribute("playsinline", "true"); v.muted = true;
      await v.play().catch(() => undefined);
      setState("on");
      let detector: Detector | null = null;
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      if (BD) { try { detector = new BD({ formats: ["qr_code"] }); } catch { detector = null; } }
      const jsQR = detector ? null : (await import("jsqr")).default;
      let busy = false;
      const tick = async () => {
        if (!live) return;
        raf = requestAnimationFrame(() => void tick());
        if (busy || v.readyState < 2 || !v.videoWidth) return;
        busy = true;
        try {
          let text = "";
          if (detector) {
            const r = await detector.detect(v);
            text = r[0]?.rawValue ?? "";
          } else if (jsQR && ctx) {
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? "";
          }
          const now = Date.now();
          if (text && (text !== last || now - lastAt > 2500)) { last = text; lastAt = now; navigator.vibrate?.(40); cb.current(text); }
        } catch { /* keep scanning */ } finally { busy = false; }
      };
      void tick();
    })();
    return () => { live = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [paused]);

  return (
    <div className={`relative aspect-square w-full overflow-hidden rounded-card bg-ink ${className ?? ""}`}>
      <video ref={video} playsInline muted autoPlay className="absolute inset-0 size-full object-cover" aria-label="Camera view for scanning a ticket QR" />
      {state === "on" && !paused ? <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-[24px] border-[3px] border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" /> : null}
      {paused || state !== "on" ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13.5px] font-semibold text-on-ink" role="status">
          {paused ? "Camera paused" : state === "starting" ? "Starting camera…" : state === "denied" ? "Camera access is off. Allow the camera for this site in your browser settings, or type the ticket code below." : "This browser can’t open the camera here. Type the ticket code below."}
        </div>
      ) : null}
    </div>
  );
}
