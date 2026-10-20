import { CoinIcon } from "@river-apps/icons";
import { Wallet } from "lucide-react";
import { payChoices, type PayChoice } from "./pay-choices";
import type { PublicShop } from "./use-public-shop";

export type { PayChoice } from "./pay-choices";
const LABEL: Record<PayChoice, string> = { cash: "Cash", gcash: "GCash", maya: "Maya" };

/** Pay buttons for the booking form (see payChoices for which ones show). */
export function payOptions(shop: PublicShop | null | undefined): [PayChoice, string, React.ReactNode][] {
  return payChoices(shop).map((v) => [v, LABEL[v], v === "cash" ? <CoinIcon key={v} size={28} /> : <Wallet key={v} size={24} strokeWidth={1.75} />]);
}
