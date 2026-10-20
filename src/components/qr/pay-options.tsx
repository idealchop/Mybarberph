import { CoinIcon } from "@river-apps/icons";
import { QrCode } from "lucide-react";
import { payChoices, type PayChoice } from "./pay-choices";
import type { PublicShop } from "./use-public-shop";

export type { PayChoice } from "./pay-choices";

/** Pay buttons for the booking form. */
export function payOptions(_shop?: PublicShop | null): [PayChoice, string, React.ReactNode][] {
  return payChoices().map((v) => [v, v === "cash" ? "Cash" : "Online", v === "cash" ? <CoinIcon key={v} size={28} /> : <QrCode key={v} size={22} strokeWidth={1.9} />]);
}
