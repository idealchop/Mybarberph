import { Check } from "lucide-react";
import { cn } from "@river-apps/ui";
import type { ChairRequest } from "@/lib/booking-types";

/** Paid cash with an amount: the money the barber hands over and the owner claims. */
export const isCashCut = (r: ChairRequest) => Boolean(r.paid) && (r.payMethod ?? "cash") === "cash" && (r.price || 0) > 0;
export const payText = (r: ChairRequest) => (!r.paid ? "Unpaid" : r.payMethod === "gcash" ? "GCash" : r.payMethod === "online" ? "Online" : "Cash");

/** Claim state of a day: "claimed" when every paid cut (cash and GCash, v1.0.25) is claimed, "open" when some is not, null when none. */
export function dayClaimState(rows: ChairRequest[], claimed: (id: string) => boolean): "claimed" | "open" | null {
  const cash = rows.filter((r) => Boolean(r.paid) && (r.price || 0) > 0);
  if (!cash.length) return null;
  return cash.every((r) => claimed(r.id)) ? "claimed" : "open";
}

/** One small tag per record (owner day sheet and barber History): cash claimed (green) / to claim (amber), else the payment method (neutral). */
export function ClaimTag({ r, claimed }: { r: ChairRequest; claimed: boolean }) {
  const base = "inline-flex h-6 flex-none items-center gap-1 rounded-pill px-2 text-[11px] font-bold";
  if (isCashCut(r)) return claimed
    ? <span className={cn(base, "bg-[#E7F6EC] text-[#0B7A3E]")}><Check size={11} strokeWidth={3} aria-hidden />Cash<span className="sr-only"> claimed</span></span>
    : <span className={cn(base, "bg-[#FFF1D6] text-[#8A5A00]")}><i aria-hidden className="size-1.5 rounded-full bg-[#D97706]" />Cash<span className="sr-only"> to claim</span></span>;
  return <span className={cn(base, r.paid ? "bg-grey-200 text-ink-2" : "bg-[#FDE8E8] text-[#B42318]")}>{payText(r)}</span>;
}
