"use client";
import { HOME_LOCATION_ID } from "@/lib/shop-locations";
import { Input } from "@river-apps/ui";
import { isOnlineChoice } from "@/components/qr/pay-choices";
import { payMethodLabel } from "@/lib/pay-split";
import { Button } from "@/components/common/button";
import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { markDone, type ChairRequest } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { TransactionSheet } from "./transaction-sheet";
import { useShopMenu } from "@/lib/shop-services";
import { useCloud } from "@/lib/cloud";
import { lockedAmount } from "@/lib/menu-amount";
import { PayQr } from "@/components/qr/pay-qr";
import { useShopProfile } from "@/lib/shop-profile";
import { TIP_CHIPS, customerName } from "@/lib/income-split";

const EVT = "barbers-complete-cut";

/** Opens the "Confirm payment" popup for a cut; on confirm it's marked done and its order details open. */
export function completeCut(row: ChairRequest) {
  window.dispatchEvent(new CustomEvent<ChairRequest>(EVT, { detail: row }));
}

export function CompleteFlowHost() {
  const [row, setRow] = useState<ChairRequest | null>(null);
  const [details, setDetails] = useState<ChairRequest | null>(null);
  const [done, setDone] = useState<ChairRequest | null>(null);
  // Pause live CSS animations while the page is hidden (battery).
  useEffect(() => {
    const sync = () => { if (document.hidden) document.documentElement.dataset.hidden = "1"; else delete document.documentElement.dataset.hidden; };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  useEffect(() => {
    const on = (e: Event) => setRow((e as CustomEvent<ChairRequest>).detail);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return (
    <>
      {row ? <CompletePaymentSheet key={row.id} row={row} onClose={() => setRow(null)} onDone={(r) => { setRow(null); setDone(r); }} /> : null}
      {done ? <CompletedToast key={done.id} row={done} onClose={() => setDone(null)} onDetails={() => { setDetails(done); setDone(null); }} /> : null}
      {details ? <TransactionSheet row={details} onClose={() => setDetails(null)} /> : null}
    </>
  );
}

function CompletePaymentSheet({ row, onClose, onDone }: { row: ChairRequest; onClose: () => void; onDone: (r: ChairRequest) => void }) {
  const onlinePaid = Boolean(row.paid) && row.payWhere === "online";
  // Barber link: the amount is the shop's menu price; only the owner can change it (the server enforces this too).
  const barber = useCloud().mode === "barber";
  const { haircut, treatments } = useShopMenu(row.locationId || HOME_LOCATION_ID);
  const menu = [haircut, ...treatments];
  // Default amount: the booked amount, else the menu prices (this shop) of the services on the visit. Never empty.
  const names = (row.serviceName || "").split(" · ");
  const menuTotal = Math.round((menu.filter((m) => names.includes(m.name)).reduce((s, m) => s + (m.price ?? 0), 0) || (haircut.price ?? 0)) * 100);
  const base = barber ? lockedAmount(row, menu) : row.price || menuTotal;
  const [adjust, setAdjust] = useState(false);
  const [paid, setPaid] = useState(true);
  // Customer chose Online (shop QR) when booking: default the collection to GCash (the e-wallet bucket), not cash.
  const prefersQr = isOnlineChoice(row.payPref);
  const [m, setM] = useState<"cash" | "gcash">(prefersQr ? "gcash" : "cash");
  const method = adjust ? m : prefersQr ? "gcash" : "cash";
  const isPaid = adjust ? paid : true;
  const [amount, setAmount] = useState(String(base / 100));
  const [busy, setBusy] = useState(false);
  // Tip (Jimboy, 2026-10-21): one-tap ₱20 / ₱50 / ₱100 or a custom amount. 100% the barber's, saved on the visit.
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState<string | null>(null);
  const tipCents = customTip != null ? Math.max(0, Math.round(Number(customTip) * 100) || 0) : tip;
  const { profile } = useShopProfile();
  const qr = profile.payQrUrl || "";
  const typed = Math.round(Number(amount) * 100);
  const cents = !barber && adjust && typed > 0 ? typed : base;
  /** One tap: paid at the default amount (cash unless the customer chose GCash). Change it after in order details. */
  const confirm = () => {
    if (busy) return;
    setBusy(true);
    const price = onlinePaid ? row.price : cents;
    markDone(row.id, onlinePaid ? (tipCents ? { price: row.price, paid: true, method: "cash", tip: tipCents } : undefined) : { price, paid: isPaid, method, tip: tipCents });
    onDone({ ...row, tip: tipCents || undefined, status: "done", completedAt: Date.now(), price, paid: onlinePaid || isPaid, payMethod: onlinePaid ? row.payMethod : isPaid ? method : undefined, chairLabel: undefined, seatLabel: row.seatLabel || row.chairLabel });
  };
  const adjustLabel = barber ? (adjust ? "Use default" : "Update information") : adjust ? "Use default" : "Adjust";
  const hint = adjust
    ? (isPaid ? `Saved as paid by ${method === "gcash" ? "GCash" : "cash"}.${method === "cash" ? " Cash counts toward the barber’s remit." : ""}` : "Saved as not paid. Mark it paid later in the order details.")
    : barber ? "Paid in cash by default at the shop’s menu price. Tap Update information to mark it not paid or switch to GCash." : "Paid in cash by default. Tap Adjust to change the amount, mark it not paid, or switch to GCash.";
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pay-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div className="relative z-[1] w-full max-w-[440px] rounded-t-[28px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-card sm:rounded-[28px]">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-grey-100"><X size={16} strokeWidth={2.2} /></button>
        <p className="text-[12.5px] font-bold text-muted">Complete · {row.ref}</p>
        <p className="mt-1 pr-10 text-[13.5px] font-semibold text-muted">{[customerName(row), row.serviceName, row.barberName].filter(Boolean).join(" · ")}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="pay-title" className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(onlinePaid ? row.price : cents)}</h2>
            <p className="mt-1.5 text-[13.5px] font-bold">{onlinePaid ? "Already paid online" : isPaid ? `Paid · ${method === "gcash" ? "GCash" : "Cash"}` : "Not paid yet"}{tipCents ? <span className="text-muted"> · + {peso(tipCents)} tip</span> : null}</p>
          </div>
          {onlinePaid || barber ? null : <button type="button" onClick={() => setAdjust(!adjust)} className="text-[13px] font-bold underline decoration-grey-300 underline-offset-[3px]">{adjustLabel}</button>}
        </div>
        {adjust && !onlinePaid ? (
          <div className="mt-3">
            {barber ? null : <Input label="Amount (₱)" inputMode="decimal" value={amount} autoFocus onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />}
            <p className={`${barber ? "" : "mt-3 "}text-[12px] font-bold text-muted`}>Payment</p>
            <Seg label="Payment status" value={paid ? "paid" : "unpaid"} onChange={(v) => setPaid(v === "paid")} options={[["paid", "Paid"], ["unpaid", "Not paid"]]} />
            {paid ? <>
              <p className="mt-3 text-[12px] font-bold text-muted">Method</p>
              <Seg label="Payment method" value={m} onChange={(v) => setM(v as "cash" | "gcash")} options={[["cash", "Cash"], ["gcash", "GCash"]]} />
            </> : null}
          </div>
        ) : null}
        {!onlinePaid && isPaid && method === "gcash" && qr ? <div className="mt-3"><PayQr url={qr} shopName={profile.name} /></div> : null}
        <div className="mt-4">
          <p className="text-[12px] font-bold text-muted">Tip <span className="font-semibold">· goes to the barber</span></p>
          <div role="radiogroup" aria-label="Tip" className="mt-1.5 grid grid-cols-5 gap-1.5">
            {([0, ...TIP_CHIPS] as number[]).map((v) => {
              const on = customTip == null && tip === v * 100;
              return <button key={v} type="button" role="radio" aria-checked={on} onClick={() => { setCustomTip(null); setTip(v * 100); }}
                className={`h-10 rounded-pill text-[13.5px] font-bold tabular-nums ${on ? "bg-ink text-on-ink" : "bg-grey-100 text-ink"}`}>{v ? `₱${v}` : "None"}</button>;
            })}
            <button type="button" role="radio" aria-checked={customTip != null} onClick={() => setCustomTip(customTip ?? "")}
              className={`h-10 rounded-pill text-[13.5px] font-bold ${customTip != null ? "bg-ink text-on-ink" : "bg-grey-100 text-ink"}`}>Other</button>
          </div>
          {customTip != null ? <div className="mt-2"><Input label="Tip (₱)" inputMode="decimal" autoFocus value={customTip} onChange={(e) => setCustomTip(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))} /></div> : null}
        </div>
        {onlinePaid ? null : <p className="mt-3 text-[12.5px] font-semibold text-muted">{hint}</p>}
        <Button data-auth="action" className="mt-5" fullWidth loading={busy} onClick={confirm}>Confirm &amp; complete</Button>
        {barber && !onlinePaid ? (
          <button type="button" onClick={() => setAdjust(!adjust)} className="mx-auto mt-3 block text-[13.5px] font-bold text-ink-2 underline decoration-grey-300 underline-offset-[3px]">{adjustLabel}</button>
        ) : null}
      </div>
    </div>
  );
}

function Seg({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div role="radiogroup" aria-label={label} className="mt-1.5 grid grid-cols-2 rounded-pill bg-grey-100 p-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`h-9 rounded-pill text-[13.5px] font-bold transition ${value === v ? "bg-surface text-ink shadow-card" : "text-muted"}`}>{l}</button>
      ))}
    </div>
  );
}

/** Shown after Confirm & complete: auto-closes after 3s; "View details" opens the order. */
function CompletedToast({ row, onClose, onDetails }: { row: ChairRequest; onClose: () => void; onDetails: () => void }) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => { const t = window.setTimeout(() => close.current(), 3200); return () => window.clearTimeout(t); }, []);
  const pay = !row.paid ? "Not paid yet" : row.payMethod === "online" ? "Paid online" : payMethodLabel(row);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[86] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]" role="status" aria-live="polite">
      <div className="pointer-events-auto w-full max-w-[420px] overflow-hidden rounded-[22px] bg-ink text-on-ink shadow-card">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-[#22c55e] text-white"><Check size={22} strokeWidth={3} /></span>
          <span className="min-w-0 flex-1">
            <b className="block text-[16px]">Cut completed</b>
            <small className="block truncate text-[12.5px] font-semibold text-on-ink-muted">{[customerName(row), row.serviceName, peso(row.price || 0), row.tip ? `${peso(row.tip)} tip` : "", pay].filter(Boolean).join(" · ")}</small>
          </span>
          <button type="button" onClick={onDetails} className="flex-none text-[13px] font-bold underline decoration-white/40 underline-offset-[3px]">View details</button>
        </div>
        <div className="h-1 bg-white/15"><div className="toast-progress h-full origin-left bg-[#22c55e]" /></div>
      </div>
    </div>
  );
}
