export type ChairStatus = "requested" | "accepted" | "in_chair" | "done" | "declined";
export type PayWhere = "online" | "shop";
export type Channel = "walk-in" | "online";
/** How a visit was paid. Online bookings paid through the status page are "online". */
export type PayMethod = "cash" | "gcash" | "online";

export interface ChairRequest {
  id: string;
  shopId: string;
  ref: string;
  channel: Channel;
  status: ChairStatus;
  contact: string;
  customerLabel: string;
  serviceId: string;
  serviceName: string;
  price: number;
  slotLabel: string;
  payWhere: PayWhere;
  /** Set while the customer is in a chair. Cleared when the cut is finished. */
  chairLabel?: string;
  /** Chair that finished the visit. Kept after the seat is free. */
  seatLabel?: string;
  /** When Accept sat them down. The barber timer starts here. */
  startedAt?: number;
  /** When the cut was marked done. */
  completedAt?: number;
  /** Shop this visit belongs to. Missing means the first shop. */
  locationId?: string;
  /** Online visits are paid from the status page. Pay-at-the-chair visits are paid when the shop taps Done. */
  paid?: boolean;
  /** Where an online booking came from: the shop QR page or River Mobile. */
  source?: string;
  /** River Mobile's own id for this booking. */
  externalId?: string;
  /** How it was paid (cash, GCash at the shop, or online). */
  payMethod?: PayMethod;
  /** Owner's note on this visit. */
  notes?: string;
  /** How the customer said they'd pay at booking (QR page). */
  payPref?: "cash" | "gcash";
  /** Customer's rating after the visit (1–5) and optional comment. */
  rating?: number;
  feedback?: string;
  feedbackAt?: number;
  /** Barber who did the cut (snapshot at the time; for salary and remittance). */
  barberId?: string;
  barberName?: string;
  /** When the shop scanned the customer's code. */
  verifiedAt?: number;
  createdAt: number;
  updatedAt: number;
}
