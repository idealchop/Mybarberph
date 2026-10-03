"use client";
import { useState } from "react";
import { Keyboard, RotateCcw, ScanLine } from "lucide-react";
import { CheckIcon } from "@river-apps/icons";
import { Avatar, Button, cn, Input } from "@river-apps/ui";
import { CodeChip } from "@/components/common/ui";
import { getRepository, type IncomingBooking, type ScanResult } from "@/data";
import { peso } from "@/lib/format";

/**
 * River Mobile "Scan to verify" (Partner API `verifyScan`). The camera is mocked: a viewfinder with a
 * scan line, "Simulate scan" (reads the customer marked "here") and manual code entry.
 */
export function ScanVerify({ onVerified, onDone, tone = "light", barberLabel }: {
  onVerified?: (b: IncomingBooking) => void; onDone?: () => void; tone?: "light" | "phone"; barberLabel?: (id?: string) => string | undefined;
}) {
  const [state, setState] = useState<"idle" | "scanning" | ScanResult>("idle");
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState("");

  async function scan(c: string) {
    setState("scanning");
    await new Promise((r) => setTimeout(r, 650));
    const res = await getRepository().verifyScan(c);
    setState(res);
    if (res.ok) onVerified?.(res.booking);
  }

  if (typeof state === "object" && state.ok) {
    const b = state.booking;
    return (
      <div role="status" className="flex flex-col items-center text-center">
        <div className="relative flex h-[150px] w-full items-center justify-center">
          <i aria-hidden className="absolute size-[150px] rounded-full bg-[radial-gradient(circle,rgba(10,10,10,.07),rgba(10,10,10,0)_68%)]" />
          <CheckIcon size={104} className="relative" />
        </div>
        <h3 className="text-[24px] font-extrabold tracking-[-0.03em]">Visit verified</h3>
        <p className="mt-1 text-[14px] font-medium text-muted">River Mobile has been told. The visit counts for your shop.</p>
        <div className="mt-4 flex w-full items-center gap-3 rounded-[18px] bg-grey-100 p-3 text-left">
          <Avatar name={b.customerName} preset={b.avatar} size={44} />
          <span className="flex min-w-0 flex-1 flex-col leading-[1.3]"><b className="truncate text-[15px]">{b.customerName}</b>
            <span className="truncate text-[12.5px] font-medium text-muted">{b.serviceLabel} · {peso(b.price)}{barberLabel?.(b.barberId) ? ` · ${barberLabel(b.barberId)}` : ""}</span></span>
          <CodeChip>{b.referenceId}</CodeChip>
        </div>
        <div className="mt-4 flex w-full gap-2">
          <Button variant="secondary" className="flex-1" leadingIcon={<RotateCcw size={16} strokeWidth={1.75} />} onClick={() => { setState("idle"); setCode(""); }}>Scan another</Button>
          {onDone ? <Button className="flex-1" onClick={onDone}>Done</Button> : null}
        </div>
      </div>
    );
  }

  const failed = typeof state === "object" && !state.ok;
  return (
    <div className="flex flex-col">
      <div className={cn("relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-card", tone === "phone" ? "bg-[#111113]" : "bg-ink")}>
        <i aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,.10),rgba(255,255,255,0)_60%)]" />
        {/* mock camera feed: a blurred phone with a QR */}
        <div aria-hidden className="absolute left-1/2 top-1/2 h-[64%] w-[44%] -translate-x-1/2 -translate-y-1/2 rotate-[-6deg] rounded-[22px] bg-[#2a2a2e] p-2 opacity-90 blur-[0.4px]">
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-[16px] bg-[#f4f4f6]">
            <svg viewBox="0 0 21 21" className="w-[70%]" shapeRendering="crispEdges">
              {QR.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0A0A0A" />)}
            </svg>
            <span className="font-mono text-[9px] font-semibold text-[#3a3a3f]">RM-48213</span>
          </div>
        </div>
        {/* frame corners */}
        <div aria-hidden className="absolute inset-[14%]">
          {["left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-[18px]", "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-[18px]",
            "left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-[18px]", "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-[18px]"]
            .map((c) => <i key={c} className={cn("absolute size-10 border-white", c)} />)}
          {state === "scanning" || state === "idle" ? <i className="bp-scanline absolute inset-x-2 h-[2px] rounded-pill bg-white/90 shadow-[0_0_12px_rgba(255,255,255,.8)]" /> : null}
        </div>
        <span className="absolute inset-x-0 bottom-3 text-center text-[12px] font-semibold text-white/70">{state === "scanning" ? "Reading code…" : "Point at the customer’s River Mobile QR"}</span>
      </div>

      {failed ? (
        <p role="alert" className="mt-3 rounded-tile bg-grey-100 px-3 py-2.5 text-[13px] font-semibold">⚠︎ Code not found for this shop. Check the reference on their phone and try again.</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <Button size="lg" fullWidth disabled={state === "scanning"} leadingIcon={<ScanLine size={20} strokeWidth={1.75} />} onClick={() => scan("")}>
          {state === "scanning" ? "Scanning…" : "Simulate scan"}
        </Button>
        {manual ? (
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) scan(code); }}>
            <Input size="md" label="Reference code" placeholder="RM-48213" value={code} onChange={(e) => setCode(e.target.value)} containerClassName="flex-1" className="font-mono uppercase" autoFocus />
            <Button type="submit" variant="secondary" disabled={!code.trim() || state === "scanning"}>Verify</Button>
          </form>
        ) : (
          <Button variant="ghost" fullWidth leadingIcon={<Keyboard size={18} strokeWidth={1.75} />} onClick={() => setManual(true)}>Type the code instead</Button>
        )}
      </div>
    </div>
  );
}

/* A fixed 21×21 QR-like pattern (finder squares + noise) for the mock camera. */
const QR: [number, number][] = (() => {
  const cells: [number, number][] = [];
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const edge = x === 0 || y === 0 || x === 6 || y === 6; const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      if (edge || core) cells.push([ox + x, oy + y]);
    }
  };
  finder(0, 0); finder(14, 0); finder(0, 14);
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    const inFinder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
    if (!inFinder && ((x * 7 + y * 13 + x * y) % 5 === 0 || (x + y * 3) % 7 === 1)) cells.push([x, y]);
  }
  return cells;
})();
