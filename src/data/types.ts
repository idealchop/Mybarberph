/**
 * Barbers.ph domain types.
 *
 * These mirror the Firestore data model in OVERVIEW_AND_PLAN.md (rev 3, §3.3) so the mock data
 * layer can be swapped for a Firebase implementation without touching the UI.
 * Money is always in centavos (integer). Times are ISO strings in Asia/Manila.
 */
import type { AvatarPreset } from "@river-apps/icons";

export type Centavos = number;
export type Tier = "partner" | "paid";

/** Commercial plan on the shop. Partner is free; the other two unlock Paid features. */
export type BillingPlan = "partner" | "monthly_950" | "lifetime_10000";
export type BillingStatus = "active" | "pending" | "canceled";

export interface ShopLocation {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
}

export interface Shop {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  /** Map pin for River Mobile proximity. Optional until the owner sets it in Settings. */
  location?: ShopLocation;
  /** Public gallery URLs (Firebase Storage). First or coverPhoto is featured on River Mobile. */
  shopPhotos?: string[];
  /** Featured shop image on River Mobile. Should be one of shopPhotos when set. */
  coverPhoto?: string;
  phone: string;
  hours: { day: string; open: string; close: string }[];
  timezone: "Asia/Manila";
  tier: Tier;
  /** Which commercial plan the shop is on (drives tier). */
  billingPlan: BillingPlan;
  billingStatus: BillingStatus;
  ownerName: string;
  settings: {
    queueMode: "single" | "per_barber";
    kioskEnabled: boolean;
    tipsEnabled: boolean;
    requireScanVerification: boolean;
    autoAcceptScans: boolean;
    emailOwnerOnScan: boolean;
    smsOwnerOnScan: boolean;
    confirmCompleteTimeoutMins: number;
    acceptingRiverMobile: boolean;
  };
}

/** Icon used for a chair's 3D tile. */
export type ChairArt = "clipper" | "scissors" | "pole";

export interface Barber {
  id: string;
  name: string;
  nickname: string;
  avatar: AvatarPreset;
  photoUrl?: string;
  specialty: string;
  defaultChairId?: string;
  serviceIds: string[];
  recommendedServiceIds: string[];
  rating: { avg: number; count: number };
  cutsLabel: string;
  status: "in_chair" | "available" | "off";
  /** Estimated wait for a new walk-in (from the queue service; drives the kiosk and River Mobile ETAs). */
  etaMins?: number;
  commissionPct?: number;
  active: boolean;
}

export interface Chair {
  id: string;
  label: string;
  number: number;
  art: ChairArt;
  status: "free" | "occupied" | "out_of_service";
  barberId?: string;
  currentTicketId?: string;
  active: boolean;
}

export type HaircutKind = "fade" | "crew" | "pompadour" | "twoblock" | "buzz" | "beard";

/** Default catalog entry (`haircut_styles`). */
export interface HaircutStyle {
  id: string;
  name: string;
  kind: HaircutKind;
  tags: string[];
}

export interface Service {
  id: string;
  styleId?: string;
  name: string;
  kind: HaircutKind;
  category: "haircut" | "beard" | "addon" | "kids" | "senior";
  price: Centavos;
  durationMins: number;
  showInKiosk: boolean;
  showInPartnerApps: boolean;
  isDefault: boolean;
  badge?: string;
  active: boolean;
}

export type CustomerType = "walk_in" | "regular" | "member" | "vip";
export type CustomerSource = "kiosk" | "staff" | "web" | "partner:river-mobile";

export interface Customer {
  id: string;
  name: string;
  avatar: AvatarPreset;
  phone?: string;
  type: CustomerType;
  /** "personal" = known person with contact details; "walk_in" = anonymous walk-in record. */
  kind: "personal" | "walk_in";
  source: CustomerSource;
  consent: { sms: boolean; marketing: boolean };
  visitCount: number;
  totalSpent: Centavos;
  lastVisitAt?: string;
  favoriteBarberId?: string;
  discount?: { label: string; pct: number };
  membershipId?: string;
  notes?: string;
}

export type TicketStatus =
  | "pending_verification"
  | "waiting"
  | "called"
  | "in_service"
  | "awaiting_confirmation"
  | "completed"
  | "paid"
  | "rejected"
  | "cancelled"
  | "no_show";

export type TicketSource = "kiosk" | "staff" | "web" | "partner";

export interface Ticket {
  id: string;
  referenceId: string;
  kind: "walk_in" | "appointment";
  source: TicketSource;
  status: TicketStatus;
  queueNumber: number;
  customerId?: string;
  customerName: string;
  customerAvatar: AvatarPreset;
  requestedBarberId?: string;
  barberId?: string;
  chairId?: string;
  serviceIds: string[];
  serviceLabel: string;
  createdAt: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedWaitMins?: number;
  progressPct?: number;
  minsLeft?: number;
  /** Highlighted "next up" in the live queue. */
  nextUp?: boolean;
}

export type PaymentMethod = "cash" | "gcash" | "maya" | "card";

export interface Transaction {
  id: string;
  referenceId: string;
  ticketId?: string;
  customerName: string;
  customerAvatar: AvatarPreset;
  fromRiverMobile: boolean;
  serviceLabel: string;
  barberId: string;
  chairId: string;
  subtotal: Centavos;
  discount?: { label: string; amount: Centavos };
  tip?: Centavos;
  total: Centavos;
  paymentMethod: PaymentMethod;
  rating?: number;
  completedAt: string;
}

export interface SalesSummary {
  dayLabel: string;
  sales: Centavos;
  salesDeltaLabel: string;
  tips: Centavos;
  tippers: number;
  transactions: number;
  walkIns: number;
  online: number;
  avgTicket: Centavos;
  highestLabel: string;
  avgRating: number;
  ratingsCount: number;
  paymentMix: { method: PaymentMethod; amount: Centavos }[];
  closesAt: string;
}

export interface DailySales { label: string; sales: Centavos }

export interface Insight {
  id: string;
  title: string;
  body: string;
  emphasis: "high" | "medium" | "low";
  action?: { label: string; kind: "send_voucher" | "open_chair" | "create_combo" };
}

export interface Voucher {
  id: string;
  code: string;
  kind: "voucher" | "referral" | "first_visit";
  description: string;
  discountType: "fixed" | "percent";
  value: number;
  maxRedemptions?: number;
  redemptionCount: number;
  usedThisMonth: number;
  validUntil?: string;
  active: boolean;
  partnerRedeemable: boolean;
}

export interface ReferralStats { month: string; redeemedToday: number; referrals: number; referralGoal: number }

export type TemplateKey = "on_queue" | "next_up" | "thank_you" | "feedback_request" | `custom_${string}`;

export interface MessageTemplate {
  id: string;
  key: TemplateKey;
  name: string;
  channel: "sms";
  body: string;
  trigger: string;
  enabled: boolean;
  isDefault: boolean;
  sentThisMonth: number;
}

export interface MessageLog {
  id: string;
  templateName: string;
  toMasked: string;
  customerName: string;
  at: string;
  status: "sent" | "delivered" | "failed";
}

export interface WaitlistEntry {
  id: string;
  name: string;
  avatar: AvatarPreset;
  wants: string;
  texted: boolean;
}

/** A River Mobile booking or queue ticket arriving through the Partner API. */
export interface IncomingBooking {
  id: string;
  referenceId: string;
  customerName: string;
  avatar: AvatarPreset;
  serviceLabel: string;
  price: Centavos;
  arrivingAt: string;
  arrivingLabel: string;
  barberId?: string;
  status: "pending" | "accepted" | "here" | "verified" | "declined";
  receivedAgo: string;
}

export interface VerifiedVisit {
  id: string;
  customerName: string;
  referenceId: string;
  serviceLabel: string;
  barberName?: string;
  at: string;
  atLabel: string;
  status: "verified" | "completed" | "no_show";
}

export interface PartnerNotification {
  id: string;
  title: string;
  body: string;
  atLabel: string;
  unread: boolean;
}

export interface CustomerVisit {
  id: string;
  dateLabel: string;
  serviceLabel: string;
  barberName: string;
  amount: Centavos;
  tip?: Centavos;
  paymentMethod: PaymentMethod;
  discountLabel?: string;
  rating?: number;
}

export interface MembershipPlan {
  id: string;
  name: string;
  price: Centavos;
  period: "monthly" | "yearly";
  benefits: string[];
  members: number;
}

export interface Membership {
  id: string;
  customerId: string;
  planId: string;
  status: "active" | "expired";
  endsAtLabel: string;
  creditsRemaining?: number;
}

export interface Feedback {
  ticketId: string;
  barberId?: string;
  rating: number;
  tags: string[];
  comment?: string;
}

export interface KioskTicketDraft {
  barberId: string | "any";
  serviceIds: string[];
  customerName?: string;
  phone?: string;
  smsConsent?: boolean;
}
