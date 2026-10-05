/**
 * Sample data for the demo (every screen shows a "Sample data" tag). Mirrors the approved mockups.
 * Shop clock for the demo: Sunday, Oct 4 2026, 6:40 PM (Asia/Manila). All money is in centavos.
 */
import type {
  Barber, Chair, Customer, CustomerVisit, DailySales, HaircutStyle, IncomingBooking, Insight, Membership,
  MembershipPlan, MessageLog, MessageTemplate, PartnerNotification, ReferralStats, SalesSummary, Service, Shop,
  Ticket, Transaction, VerifiedVisit, Voucher, WaitlistEntry,
} from "../types";

const P = (pesos: number) => pesos * 100;
export const DEMO_NOW = "2026-10-04T18:40:00+08:00";
const at = (hhmm: string, day = "2026-10-04") => `${day}T${hhmm}:00+08:00`;

export const shop: Shop = {
  id: "kanto-kings", name: "Kanto Kings Barbershop", slug: "kanto-kings-marikina", city: "Marikina",
  address: "28 J.P. Rizal St, Concepcion Uno, Marikina City", phone: "+63 917 555 0142",
  hours: [{ day: "Mon–Fri", open: "10:00 AM", close: "9:00 PM" }, { day: "Sat–Sun", open: "9:00 AM", close: "9:00 PM" }],
  timezone: "Asia/Manila", tier: "paid", billingPlan: "monthly_950", billingStatus: "active", ownerName: "Jimboy",
  location: { lat: 14.6507, lng: 121.1029, formattedAddress: "28 J.P. Rizal St, Concepcion Uno, Marikina City" },
  shopPhotos: [],
  coverPhoto: undefined,
  settings: {
    queueMode: "per_barber", kioskEnabled: true, tipsEnabled: true, requireScanVerification: true, autoAcceptScans: false,
    emailOwnerOnScan: true, smsOwnerOnScan: false, confirmCompleteTimeoutMins: 15, acceptingRiverMobile: true,
  },
};

export const haircutStyles: HaircutStyle[] = [
  { id: "st-skin-fade", name: "Skin fade", kind: "fade", tags: ["fade", "popular"] },
  { id: "st-low-fade", name: "Low fade", kind: "fade", tags: ["fade"] },
  { id: "st-taper", name: "Taper", kind: "crew", tags: ["classic"] },
  { id: "st-crew", name: "Crew cut", kind: "crew", tags: ["classic"] },
  { id: "st-undercut", name: "Undercut", kind: "twoblock", tags: ["modern"] },
  { id: "st-two-block", name: "Two-block", kind: "twoblock", tags: ["modern", "korean"] },
  { id: "st-buzz", name: "Buzz cut", kind: "buzz", tags: ["short"] },
  { id: "st-pompadour", name: "Pompadour", kind: "pompadour", tags: ["classic", "styled"] },
  { id: "st-kids", name: "Kids’ cut", kind: "crew", tags: ["kids"] },
  { id: "st-beard", name: "Beard trim", kind: "beard", tags: ["beard"] },
];

const svc = (s: Omit<Service, "showInKiosk" | "showInPartnerApps" | "active"> & Partial<Service>): Service =>
  ({ showInKiosk: true, showInPartnerApps: s.category !== "addon", active: true, ...s });

export const services: Service[] = [
  svc({ id: "sv-skin-fade", styleId: "st-skin-fade", name: "Skin fade", kind: "fade", category: "haircut", price: P(250), durationMins: 30, isDefault: true, badge: "Most popular" }),
  svc({ id: "sv-fade-beard", name: "Fade + beard", kind: "beard", category: "haircut", price: P(400), durationMins: 45, isDefault: false }),
  svc({ id: "sv-crew", styleId: "st-crew", name: "Crew cut", kind: "crew", category: "haircut", price: P(200), durationMins: 25, isDefault: true }),
  svc({ id: "sv-two-block", styleId: "st-two-block", name: "Two-block", kind: "twoblock", category: "haircut", price: P(300), durationMins: 40, isDefault: true }),
  svc({ id: "sv-pompadour", styleId: "st-pompadour", name: "Pompadour", kind: "pompadour", category: "haircut", price: P(350), durationMins: 40, isDefault: true }),
  svc({ id: "sv-classic", styleId: "st-taper", name: "Classic cut", kind: "crew", category: "haircut", price: P(200), durationMins: 25, isDefault: true }),
  svc({ id: "sv-undercut", styleId: "st-undercut", name: "Undercut", kind: "twoblock", category: "haircut", price: P(250), durationMins: 30, isDefault: true }),
  svc({ id: "sv-buzz", styleId: "st-buzz", name: "Buzz cut", kind: "buzz", category: "haircut", price: P(150), durationMins: 15, isDefault: true }),
  svc({ id: "sv-skin-fade-beard", name: "Skin fade + beard trim", kind: "beard", category: "haircut", price: P(450), durationMins: 50, isDefault: false }),
  svc({ id: "sv-hot-towel", name: "Haircut + hot towel", kind: "crew", category: "haircut", price: P(380), durationMins: 40, isDefault: false }),
  svc({ id: "sv-kids", styleId: "st-kids", name: "Kids’ cut", kind: "crew", category: "kids", price: P(180), durationMins: 20, isDefault: true }),
  svc({ id: "sv-senior", name: "Senior cut", kind: "crew", category: "senior", price: P(150), durationMins: 20, isDefault: true }),
  svc({ id: "sv-beard", styleId: "st-beard", name: "Beard trim", kind: "beard", category: "beard", price: P(150), durationMins: 15, isDefault: true }),
  svc({ id: "ad-beard-design", name: "Beard design", kind: "beard", category: "addon", price: P(100), durationMins: 10, isDefault: false }),
  svc({ id: "ad-hair-tattoo", name: "Hair tattoo line", kind: "fade", category: "addon", price: P(80), durationMins: 10, isDefault: false }),
  svc({ id: "ad-wash", name: "Extra wash & style", kind: "pompadour", category: "addon", price: P(60), durationMins: 10, isDefault: false }),
];

export const barbers: Barber[] = [
  { id: "b-caloy", name: "Carlo “Caloy” Santos", nickname: "Caloy", avatar: "sky", specialty: "Fades · beard design", defaultChairId: "c-2",
    serviceIds: ["sv-skin-fade", "sv-fade-beard", "sv-crew", "sv-two-block", "sv-pompadour", "sv-skin-fade-beard", "sv-hot-towel", "sv-beard", "ad-beard-design", "ad-hair-tattoo", "ad-wash"],
    recommendedServiceIds: ["sv-skin-fade", "sv-fade-beard", "sv-crew", "sv-two-block", "sv-pompadour"],
    rating: { avg: 4.9, count: 1200 }, cutsLabel: "1.2k cuts", status: "in_chair", etaMins: 12, commissionPct: 40, active: true },
  { id: "b-ruben", name: "Ruben Dizon", nickname: "Ruben", avatar: "mint", specialty: "Classic & senior cuts", defaultChairId: "c-1",
    serviceIds: ["sv-classic", "sv-senior", "sv-crew", "sv-skin-fade", "sv-beard", "sv-buzz", "ad-wash"],
    recommendedServiceIds: ["sv-classic", "sv-senior", "sv-crew", "sv-skin-fade", "sv-buzz"],
    rating: { avg: 4.8, count: 3400 }, cutsLabel: "3.4k cuts", status: "in_chair", etaMins: 9, commissionPct: 40, active: true },
  { id: "b-tin", name: "Kristine “Tin” Lopez", nickname: "Tin", avatar: "butter", specialty: "Kids’ cuts · two-block", defaultChairId: "c-3",
    serviceIds: ["sv-kids", "sv-two-block", "sv-crew", "sv-classic", "sv-beard", "sv-undercut", "ad-wash"],
    recommendedServiceIds: ["sv-kids", "sv-two-block", "sv-crew", "sv-undercut", "sv-classic"],
    rating: { avg: 5.0, count: 860 }, cutsLabel: "860 cuts", status: "in_chair", etaMins: 4, commissionPct: 35, active: true },
  { id: "b-jm", name: "JM Villanueva", nickname: "JM", avatar: "lilac", specialty: "Undercut · pompadour", defaultChairId: "c-4",
    serviceIds: ["sv-undercut", "sv-pompadour", "sv-two-block", "sv-skin-fade", "sv-buzz", "ad-hair-tattoo", "ad-wash"],
    recommendedServiceIds: ["sv-undercut", "sv-pompadour", "sv-two-block", "sv-skin-fade", "sv-buzz"],
    rating: { avg: 4.7, count: 540 }, cutsLabel: "540 cuts", status: "available", etaMins: 0, commissionPct: 35, active: true },
];

export const chairs: Chair[] = [
  { id: "c-1", label: "Chair 1", number: 1, art: "clipper", status: "occupied", barberId: "b-ruben", currentTicketId: "t-a027", active: true },
  { id: "c-2", label: "Chair 2", number: 2, art: "scissors", status: "occupied", barberId: "b-caloy", currentTicketId: "t-rm479", active: true },
  { id: "c-3", label: "Chair 3", number: 3, art: "scissors", status: "occupied", barberId: "b-tin", currentTicketId: "t-a028", active: true },
  { id: "c-4", label: "Chair 4", number: 4, art: "pole", status: "free", barberId: "b-jm", active: true },
];

type T = Omit<Ticket, "kind"> & Partial<Pick<Ticket, "kind">>;
const tk = (t: T): Ticket => ({ kind: "walk_in", ...t });
export const tickets: Ticket[] = [
  tk({ id: "t-a027", referenceId: "A-027", source: "kiosk", status: "in_service", queueNumber: 27, customerId: "cu-miguel", customerName: "Miguel Ramos", customerAvatar: "mint", barberId: "b-ruben", chairId: "c-1", serviceIds: ["sv-skin-fade"], serviceLabel: "Skin fade", createdAt: at("18:10"), startedAt: at("18:31"), progressPct: 70, minsLeft: 9 }),
  tk({ id: "t-rm479", referenceId: "RM-479", kind: "appointment", source: "partner", status: "in_service", queueNumber: 0, customerId: "cu-paolo", customerName: "Paolo Cruz", customerAvatar: "lilac", barberId: "b-caloy", chairId: "c-2", serviceIds: ["sv-hot-towel"], serviceLabel: "Cut + hot towel", createdAt: at("17:40"), startedAt: at("18:22"), progressPct: 35, minsLeft: 22 }),
  tk({ id: "t-a028", referenceId: "A-028", source: "kiosk", status: "in_service", queueNumber: 28, customerId: "cu-jose", customerName: "Jose Bautista", customerAvatar: "sky", barberId: "b-tin", chairId: "c-3", serviceIds: ["sv-beard"], serviceLabel: "Beard trim", createdAt: at("18:15"), startedAt: at("18:36"), progressPct: 88, minsLeft: 4 }),
  tk({ id: "t-a031", referenceId: "A-031", source: "kiosk", status: "waiting", queueNumber: 31, customerName: "Enzo Garcia", customerAvatar: "butter", chairId: "c-4", serviceIds: ["sv-skin-fade"], serviceLabel: "Skin fade", createdAt: at("18:37"), estimatedWaitMins: 3, nextUp: true }),
  tk({ id: "t-rm482", referenceId: "RM-482", source: "partner", status: "waiting", queueNumber: 0, customerName: "Bea Aquino’s son", customerAvatar: "indigo", requestedBarberId: "b-tin", barberId: "b-tin", serviceIds: ["sv-kids"], serviceLabel: "Kids’ cut", createdAt: at("18:31"), estimatedWaitMins: 9 }),
  tk({ id: "t-a032", referenceId: "A-032", source: "kiosk", status: "waiting", queueNumber: 32, customerName: "Ramon dela Cruz", customerAvatar: "peach", requestedBarberId: "b-caloy", barberId: "b-caloy", serviceIds: ["sv-fade-beard"], serviceLabel: "Fade + beard", createdAt: at("18:26"), estimatedWaitMins: 14 }),
  tk({ id: "t-a033", referenceId: "A-033", source: "staff", status: "waiting", queueNumber: 33, customerName: "Kevin Tan", customerAvatar: "rose", requestedBarberId: "b-ruben", barberId: "b-ruben", serviceIds: ["sv-classic"], serviceLabel: "Classic cut", createdAt: at("18:21"), estimatedWaitMins: 19 }),
  tk({ id: "t-a034", referenceId: "A-034", source: "kiosk", status: "waiting", queueNumber: 34, customerName: "Jay-R Manalo", customerAvatar: "mint", serviceIds: ["sv-crew"], serviceLabel: "Crew cut", createdAt: at("18:16"), estimatedWaitMins: 24 }),
  tk({ id: "t-a035", referenceId: "A-035", source: "kiosk", status: "waiting", queueNumber: 35, customerName: "Migs Torres", customerAvatar: "sky", requestedBarberId: "b-jm", barberId: "b-jm", serviceIds: ["sv-buzz"], serviceLabel: "Buzz cut", createdAt: at("18:12"), estimatedWaitMins: 28 }),
  tk({ id: "t-a026", referenceId: "A-026", source: "kiosk", status: "paid", queueNumber: 26, customerId: "cu-mark", customerName: "Mark Villanueva", customerAvatar: "sky", barberId: "b-jm", chairId: "c-4", serviceIds: ["sv-undercut"], serviceLabel: "Undercut", createdAt: at("17:50"), completedAt: at("18:28") }),
  tk({ id: "t-a025", referenceId: "A-025", source: "kiosk", status: "paid", queueNumber: 25, customerId: "cu-arnel", customerName: "Arnel Santos", customerAvatar: "mint", barberId: "b-ruben", chairId: "c-1", serviceIds: ["sv-senior"], serviceLabel: "Senior cut", createdAt: at("17:45"), completedAt: at("18:20") }),
  tk({ id: "t-a024", referenceId: "A-024", source: "kiosk", status: "paid", queueNumber: 24, customerName: "Jerome Pascual", customerAvatar: "butter", barberId: "b-tin", chairId: "c-3", serviceIds: ["sv-classic"], serviceLabel: "Classic cut", createdAt: at("17:30"), completedAt: at("18:05") }),
  tk({ id: "t-a023", referenceId: "A-023", source: "kiosk", status: "paid", queueNumber: 23, customerName: "Nathan Lee", customerAvatar: "peach", barberId: "b-tin", chairId: "c-3", serviceIds: ["sv-kids"], serviceLabel: "Kids’ cut", createdAt: at("17:20"), completedAt: at("17:52") }),
  tk({ id: "t-a022", referenceId: "A-022", source: "staff", status: "paid", queueNumber: 22, customerName: "Dennis Flores", customerAvatar: "rose", barberId: "b-ruben", chairId: "c-1", serviceIds: ["sv-beard"], serviceLabel: "Beard trim", createdAt: at("17:05"), completedAt: at("17:31") }),
];

export const incomingBookings: IncomingBooking[] = [
  { id: "ib-48213", referenceId: "RM-48213", customerName: "Andrei Mendoza", avatar: "indigo", serviceLabel: "Skin fade + beard trim", price: P(450), arrivingAt: at("19:15"), arrivingLabel: "Today, 7:15 PM", barberId: "b-caloy", status: "here", receivedAgo: "2 min ago" },
  { id: "ib-48220", referenceId: "RM-48220", customerName: "Nico Fernandez", avatar: "mint", serviceLabel: "Classic cut", price: P(200), arrivingAt: at("19:45"), arrivingLabel: "7:45 PM", barberId: "b-ruben", status: "accepted", receivedAgo: "18 min ago" },
  { id: "ib-48231", referenceId: "RM-48231", customerName: "Jun Pascual", avatar: "butter", serviceLabel: "Kids’ cut", price: P(180), arrivingAt: at("20:30"), arrivingLabel: "8:30 PM", barberId: "b-tin", status: "accepted", receivedAgo: "41 min ago" },
  { id: "ib-48240", referenceId: "RM-48240", customerName: "Rey Castillo", avatar: "peach", serviceLabel: "Undercut", price: P(250), arrivingAt: at("10:30", "2026-10-05"), arrivingLabel: "Tomorrow, 10:30 AM", status: "pending", receivedAgo: "Just now" },
];

export const verifiedVisits: VerifiedVisit[] = [
  { id: "vv-1", customerName: "Paolo Cruz", referenceId: "RM-48190", serviceLabel: "Haircut + towel", barberName: "Caloy", at: at("18:22"), atLabel: "Today 6:22 PM", status: "verified" },
  { id: "vv-2", customerName: "Carlos Medina", referenceId: "RM-48177", serviceLabel: "Skin fade + beard", barberName: "Caloy", at: at("18:20"), atLabel: "Today 6:20 PM", status: "verified" },
  { id: "vv-3", customerName: "Vincent Reyes", referenceId: "RM-48175", serviceLabel: "Haircut + towel", barberName: "Caloy", at: at("17:40"), atLabel: "Today 5:40 PM", status: "verified" },
  { id: "vv-4", customerName: "Patrick Uy", referenceId: "RM-48172", serviceLabel: "Pompadour + wash", barberName: "Caloy", at: at("16:47"), atLabel: "Today 4:47 PM", status: "completed" },
  { id: "vv-5", customerName: "Leo Bautista", referenceId: "RM-48150", serviceLabel: "Skin fade", barberName: "Ruben", at: at("15:10", "2026-10-03"), atLabel: "Sat 3:10 PM", status: "completed" },
  { id: "vv-6", customerName: "Marco Diaz", referenceId: "RM-48141", serviceLabel: "Two-block", barberName: "Tin", at: at("13:05", "2026-10-03"), atLabel: "Sat 1:05 PM", status: "completed" },
  { id: "vv-7", customerName: "Allan Ramos", referenceId: "RM-48133", serviceLabel: "Classic cut", at: at("11:40", "2026-10-03"), atLabel: "Sat 11:40 AM", status: "no_show" },
  { id: "vv-8", customerName: "Bryan Co", referenceId: "RM-48120", serviceLabel: "Undercut", barberName: "JM", at: at("18:15", "2026-10-02"), atLabel: "Fri 6:15 PM", status: "completed" },
  { id: "vv-9", customerName: "Dino Reyes", referenceId: "RM-48112", serviceLabel: "Skin fade", barberName: "Caloy", at: at("16:30", "2026-10-02"), atLabel: "Fri 4:30 PM", status: "completed" },
  { id: "vv-10", customerName: "Sam Torres", referenceId: "RM-48101", serviceLabel: "Kids’ cut", barberName: "Tin", at: at("17:20", "2026-10-01"), atLabel: "Thu 5:20 PM", status: "completed" },
  { id: "vv-11", customerName: "Ely Gomez", referenceId: "RM-48094", serviceLabel: "Classic cut", barberName: "Ruben", at: at("11:05", "2026-10-01"), atLabel: "Thu 11:05 AM", status: "completed" },
  { id: "vv-12", customerName: "Ivan Morales", referenceId: "RM-48087", serviceLabel: "Two-block", barberName: "JM", at: at("19:10", "2026-09-30"), atLabel: "Wed 7:10 PM", status: "completed" },
  { id: "vv-13", customerName: "Rico Mercado", referenceId: "RM-48079", serviceLabel: "Fade + beard", barberName: "Caloy", at: at("15:45", "2026-09-29"), atLabel: "Tue 3:45 PM", status: "completed" },
];

export const partnerNotifications: PartnerNotification[] = [
  { id: "n-1", title: "Andrei Mendoza is here", body: "RM-48213 · Fade + beard. Scan their code to verify.", atLabel: "2 min ago", unread: true },
  { id: "n-2", title: "New River Mobile booking", body: "Rey Castillo · Undercut · Tomorrow 10:30 AM", atLabel: "Just now", unread: true },
  { id: "n-3", title: "Booking confirmed", body: "Nico Fernandez · Classic cut · 7:45 PM", atLabel: "18 min ago", unread: true },
  { id: "n-4", title: "Visit verified", body: "Paolo Cruz · Haircut + towel", atLabel: "6:22 PM", unread: false },
];

type Tx = Omit<Transaction, "total" | "subtotal" | "id"> & { price: number; tipP?: number };
const tx = ({ price, tipP, ...t }: Tx): Transaction => ({ id: `tx-${t.referenceId.toLowerCase()}`, subtotal: P(price), total: P(price), tip: tipP ? P(tipP) : undefined, ...t });
export const transactions: Transaction[] = [
  tx({ referenceId: "A-026", ticketId: "t-a026", customerName: "Mark Villanueva", customerAvatar: "sky", fromRiverMobile: false, serviceLabel: "Undercut", barberId: "b-jm", chairId: "c-4", price: 250, tipP: 30, paymentMethod: "gcash", rating: 5, completedAt: at("18:36") }),
  tx({ referenceId: "A-025", ticketId: "t-a025", customerName: "Arnel Santos", customerAvatar: "mint", fromRiverMobile: false, serviceLabel: "Senior cut", barberId: "b-ruben", chairId: "c-1", price: 150, paymentMethod: "cash", rating: 5, completedAt: at("18:28") }),
  tx({ referenceId: "RM-477", customerName: "Carlos Medina", customerAvatar: "lilac", fromRiverMobile: true, serviceLabel: "Skin fade + beard", barberId: "b-caloy", chairId: "c-2", price: 450, tipP: 50, paymentMethod: "gcash", rating: 5, completedAt: at("18:20") }),
  tx({ referenceId: "A-024", ticketId: "t-a024", customerName: "Jerome Pascual", customerAvatar: "butter", fromRiverMobile: false, serviceLabel: "Classic cut", barberId: "b-tin", chairId: "c-3", price: 200, tipP: 20, paymentMethod: "cash", rating: 4, completedAt: at("18:05") }),
  tx({ referenceId: "A-023", ticketId: "t-a023", customerName: "Nathan Lee", customerAvatar: "peach", fromRiverMobile: false, serviceLabel: "Kids’ cut", barberId: "b-tin", chairId: "c-3", price: 180, paymentMethod: "maya", completedAt: at("17:52") }),
  tx({ referenceId: "RM-475", customerName: "Vincent Reyes", customerAvatar: "indigo", fromRiverMobile: true, serviceLabel: "Haircut + hot towel", barberId: "b-caloy", chairId: "c-2", price: 380, tipP: 100, paymentMethod: "card", rating: 5, completedAt: at("17:40") }),
  tx({ referenceId: "A-022", ticketId: "t-a022", customerName: "Dennis Flores", customerAvatar: "rose", fromRiverMobile: false, serviceLabel: "Beard trim", barberId: "b-ruben", chairId: "c-1", price: 150, tipP: 20, paymentMethod: "cash", rating: 4, completedAt: at("17:31") }),
  tx({ referenceId: "A-021", customerName: "Ivan Morales", customerAvatar: "sky", fromRiverMobile: false, serviceLabel: "Two-block cut", barberId: "b-jm", chairId: "c-4", price: 300, paymentMethod: "gcash", rating: 5, completedAt: at("17:18") }),
  tx({ referenceId: "A-020", customerName: "Rico Mercado", customerAvatar: "mint", fromRiverMobile: false, serviceLabel: "Skin fade", barberId: "b-ruben", chairId: "c-1", price: 250, tipP: 30, paymentMethod: "cash", rating: 3, completedAt: at("17:02") }),
  tx({ referenceId: "RM-472", customerName: "Patrick Uy", customerAvatar: "lilac", fromRiverMobile: true, serviceLabel: "Pompadour + wash", barberId: "b-caloy", chairId: "c-2", price: 350, tipP: 50, paymentMethod: "gcash", rating: 5, completedAt: at("16:47") }),
];

/* Earlier transactions of the day (pages 2–5 of the sales record), generated deterministically. */
const EARLY_NAMES = ["Leo Bautista", "Marco Diaz", "Allan Ramos", "Bryan Co", "Gio Santos", "Ken Uy", "Paul Reyes", "Joey Tan", "Ram Lopez", "Noel Cruz", "Ben Ong", "Carl Lim"];
const PRESETS = ["sky", "mint", "butter", "lilac", "peach", "rose", "indigo"] as const;
const SVC: [string, number][] = [["Skin fade", 250], ["Classic cut", 200], ["Crew cut", 200], ["Undercut", 250], ["Kids’ cut", 180], ["Two-block cut", 300], ["Beard trim", 150], ["Fade + beard", 400]];
const METHODS = ["cash", "gcash", "cash", "maya", "gcash", "card"] as const;
for (let i = 0; i < 36; i++) {
  const mins = 16 * 60 + 35 - i * 13;
  const b = barbers[i % 4]!;
  const [name, price] = SVC[i % SVC.length]!;
  const rm = i % 5 === 2;
  transactions.push(tx({
    referenceId: rm ? `RM-${471 - i}` : `A-${String(Math.max(1, 19 - i)).padStart(3, "0")}${i >= 19 ? "B" : ""}`,
    customerName: EARLY_NAMES[i % EARLY_NAMES.length]!, customerAvatar: PRESETS[i % PRESETS.length]!, fromRiverMobile: rm,
    serviceLabel: name, barberId: b.id, chairId: b.defaultChairId ?? "c-1", price, tipP: i % 3 === 0 ? 20 : undefined,
    paymentMethod: METHODS[i % METHODS.length]!, rating: i % 4 === 3 ? undefined : 4 + (i % 2),
    completedAt: at(`${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`),
  }));
}

export const salesSummary: SalesSummary = {
  dayLabel: "Sunday, Oct 4", sales: P(18450), salesDeltaLabel: "+7% vs last Sunday", tips: P(2180), tippers: 29,
  transactions: 46, walkIns: 31, online: 15, avgTicket: P(401), highestLabel: "Highest ₱650 · Chair 2", avgRating: 4.8, ratingsCount: 38,
  paymentMix: [{ method: "cash", amount: P(7750) }, { method: "gcash", amount: P(7010) }, { method: "maya", amount: P(2210) }, { method: "card", amount: P(1480) }],
  closesAt: "9:00 PM",
};

const days = (rows: [string, number][]): DailySales[] => rows.map(([label, pesos]) => ({ label, sales: P(pesos) }));
export const dailySales = days([["21", 11200], ["22", 9400], ["23", 10800], ["24", 12100], ["25", 15600], ["26", 20900], ["27", 17300],
  ["28", 11900], ["29", 10200], ["30", 11500], ["1", 13400], ["2", 16800], ["3", 22400], ["4", 18450]]);
export const dailySalesEarlier = days([["5", 9800], ["6", 10400], ["7", 11800], ["8", 13900], ["9", 15200], ["10", 19800], ["11", 16900],
  ["12", 10100], ["13", 9900], ["14", 11200], ["15", 12800], ["16", 15900], ["17", 21100], ["18", 17600], ["19", 10800], ["20", 10300]]);

export const barberStatsToday: Record<string, { cuts: number; sales: number; tips: number }> = {
  "b-caloy": { cuts: 14, sales: P(5850), tips: P(720) }, "b-ruben": { cuts: 12, sales: P(4900), tips: P(560) },
  "b-tin": { cuts: 11, sales: P(4250), tips: P(540) }, "b-jm": { cuts: 9, sales: P(3450), tips: P(360) },
};

export const insights: Insight[] = [
  { id: "in-1", title: "Sat 3–6 PM is full.", body: "Opening Chair 4 earlier could add about ₱3,200 a week.", emphasis: "high", action: { label: "Open Chair 4 earlier", kind: "open_chair" } },
  { id: "in-2", title: "18 regulars", body: "haven’t come back in 30+ days. Send them a ₱50-off comeback voucher.", emphasis: "medium", action: { label: "Send comeback voucher", kind: "send_voucher" } },
  { id: "in-3", title: "Skin fade is 38% of cuts.", body: "Try a ₱400 fade + beard trim combo.", emphasis: "low", action: { label: "Create combo", kind: "create_combo" } },
];

export const vouchers: Voucher[] = [
  { id: "v-balik50", code: "BALIK50", kind: "voucher", description: "₱50 off comeback", discountType: "fixed", value: P(50), maxRedemptions: 100, redemptionCount: 31, usedThisMonth: 4, validUntil: "Oct 31", active: true, partnerRedeemable: false },
  { id: "v-kaibigan", code: "KAIBIGAN", kind: "referral", description: "Refer a friend · ₱100 each", discountType: "fixed", value: P(100), redemptionCount: 27, usedThisMonth: 3, active: true, partnerRedeemable: true },
  { id: "v-firstcut", code: "FIRSTCUT", kind: "first_visit", description: "20% off first visit", discountType: "percent", value: 20, redemptionCount: 64, usedThisMonth: 2, active: true, partnerRedeemable: true },
  { id: "v-lolo20", code: "LOLO20", kind: "voucher", description: "20% off for seniors (weekdays)", discountType: "percent", value: 20, redemptionCount: 12, usedThisMonth: 0, validUntil: "Dec 31", active: false, partnerRedeemable: false },
];

export const referralStats: ReferralStats = { month: "October", redeemedToday: 9, referrals: 27, referralGoal: 40 };

export const membershipPlans: MembershipPlan[] = [
  { id: "mp-suki", name: "Suki Monthly", price: P(799), period: "monthly", benefits: ["4 haircuts a month", "Priority in queue", "10% off add-ons"], members: 23 },
  { id: "mp-vip", name: "VIP Yearly", price: P(7999), period: "yearly", benefits: ["Unlimited haircuts", "Free beard trim", "Birthday freebie"], members: 6 },
];

export const memberships: Membership[] = [
  { id: "m-1", customerId: "cu-paolo", planId: "mp-suki", status: "active", endsAtLabel: "Nov 2", creditsRemaining: 2 },
  { id: "m-2", customerId: "cu-carlos", planId: "mp-vip", status: "active", endsAtLabel: "Mar 14, 2027" },
];

export const customers: Customer[] = [
  { id: "cu-paolo", name: "Paolo Cruz", avatar: "lilac", phone: "+63 917 555 0181", type: "member", kind: "personal", source: "partner:river-mobile", consent: { sms: true, marketing: true }, visitCount: 18, totalSpent: P(6840), lastVisitAt: at("18:22"), favoriteBarberId: "b-caloy", membershipId: "m-1", notes: "Likes a low taper, no gel." },
  { id: "cu-carlos", name: "Carlos Medina", avatar: "lilac", phone: "+63 918 555 0123", type: "vip", kind: "personal", source: "partner:river-mobile", consent: { sms: true, marketing: true }, visitCount: 31, totalSpent: P(13950), lastVisitAt: at("18:20"), favoriteBarberId: "b-caloy", membershipId: "m-2", discount: { label: "VIP 10%", pct: 10 } },
  { id: "cu-mark", name: "Mark Villanueva", avatar: "sky", phone: "+63 927 555 0110", type: "regular", kind: "personal", source: "kiosk", consent: { sms: true, marketing: false }, visitCount: 9, totalSpent: P(2250), lastVisitAt: at("18:36"), favoriteBarberId: "b-jm" },
  { id: "cu-arnel", name: "Arnel Santos", avatar: "mint", phone: "+63 939 555 0177", type: "regular", kind: "personal", source: "staff", consent: { sms: true, marketing: false }, visitCount: 22, totalSpent: P(3300), lastVisitAt: at("18:28"), favoriteBarberId: "b-ruben", discount: { label: "Senior 20%", pct: 20 } },
  { id: "cu-miguel", name: "Miguel Ramos", avatar: "mint", phone: "+63 915 555 0145", type: "regular", kind: "personal", source: "kiosk", consent: { sms: true, marketing: true }, visitCount: 6, totalSpent: P(1500), lastVisitAt: at("18:31"), favoriteBarberId: "b-ruben" },
  { id: "cu-jose", name: "Jose Bautista", avatar: "sky", type: "walk_in", kind: "walk_in", source: "kiosk", consent: { sms: false, marketing: false }, visitCount: 1, totalSpent: P(150), lastVisitAt: at("18:36") },
  { id: "cu-vincent", name: "Vincent Reyes", avatar: "indigo", phone: "+63 917 555 0199", type: "regular", kind: "personal", source: "partner:river-mobile", consent: { sms: true, marketing: false }, visitCount: 7, totalSpent: P(2660), lastVisitAt: at("17:40"), favoriteBarberId: "b-caloy" },
  { id: "cu-nathan", name: "Nathan Lee", avatar: "peach", type: "walk_in", kind: "walk_in", source: "kiosk", consent: { sms: false, marketing: false }, visitCount: 2, totalSpent: P(360), lastVisitAt: at("17:52") },
  { id: "cu-dennis", name: "Dennis Flores", avatar: "rose", phone: "+63 908 555 0133", type: "regular", kind: "personal", source: "staff", consent: { sms: true, marketing: true }, visitCount: 12, totalSpent: P(2400), lastVisitAt: at("17:31"), favoriteBarberId: "b-ruben" },
  { id: "cu-jerome", name: "Jerome Pascual", avatar: "butter", type: "walk_in", kind: "walk_in", source: "kiosk", consent: { sms: false, marketing: false }, visitCount: 1, totalSpent: P(200), lastVisitAt: at("18:05") },
  { id: "cu-gab", name: "Gab Navarro", avatar: "mint", phone: "+63 916 555 0102", type: "regular", kind: "personal", source: "web", consent: { sms: true, marketing: true }, visitCount: 5, totalSpent: P(1250), lastVisitAt: at("15:00", "2026-09-20"), favoriteBarberId: "b-tin" },
  { id: "cu-rafael", name: "Rafael Lim", avatar: "lilac", phone: "+63 917 555 0164", type: "regular", kind: "personal", source: "kiosk", consent: { sms: true, marketing: true }, visitCount: 14, totalSpent: P(3900), lastVisitAt: at("12:00", "2026-08-28"), favoriteBarberId: "b-caloy", notes: "Hasn’t visited in 37 days." },
];

export const customerVisits: Record<string, CustomerVisit[]> = {
  "cu-paolo": [
    { id: "cv-1", dateLabel: "Today, 6:22 PM", serviceLabel: "Cut + hot towel", barberName: "Caloy", amount: P(380), paymentMethod: "gcash", discountLabel: "Suki credit", rating: 5 },
    { id: "cv-2", dateLabel: "Sep 20, 4:10 PM", serviceLabel: "Skin fade", barberName: "Caloy", amount: P(250), tip: P(30), paymentMethod: "gcash", rating: 5 },
    { id: "cv-3", dateLabel: "Sep 6, 5:45 PM", serviceLabel: "Skin fade", barberName: "Caloy", amount: P(250), paymentMethod: "cash", rating: 4 },
    { id: "cv-4", dateLabel: "Aug 23, 3:30 PM", serviceLabel: "Fade + beard", barberName: "Ruben", amount: P(400), tip: P(50), paymentMethod: "maya", rating: 5 },
  ],
};

export const waitlist: WaitlistEntry[] = [
  { id: "w-1", name: "Gab Navarro", avatar: "mint", wants: "Wants Tin · after 7 PM", texted: false },
  { id: "w-2", name: "Luis Ocampo", avatar: "sky", wants: "Any barber · Haircut", texted: false },
  { id: "w-3", name: "Rafael Lim", avatar: "lilac", wants: "Wants Caloy · Fade", texted: true },
];

export const messageTemplates: MessageTemplate[] = [
  { id: "mt-on-queue", key: "on_queue", name: "On queue", channel: "sms", trigger: "When a ticket is created", enabled: true, isDefault: true, sentThisMonth: 412,
    body: "Hi {{customerName}}! You’re #{{queueNumber}} at Kanto Kings. About {{waitMins}} min wait with {{barberName}}. We’ll text you when you’re next." },
  { id: "mt-next-up", key: "next_up", name: "You’re next", channel: "sms", trigger: "When the ticket is called", enabled: true, isDefault: true, sentThisMonth: 389,
    body: "{{customerName}}, you’re next! Please head to {{barberName}}’s chair at Kanto Kings." },
  { id: "mt-thank-you", key: "thank_you", name: "Thank you", channel: "sms", trigger: "When the visit is completed", enabled: true, isDefault: true, sentThisMonth: 377,
    body: "Salamat, {{customerName}}! Hope you love your cut. Rate {{barberName}} here: {{feedbackLink}}" },
  { id: "mt-comeback", key: "custom_comeback", name: "Comeback offer", channel: "sms", trigger: "Manual · 30+ days since last visit", enabled: true, isDefault: false, sentThisMonth: 18,
    body: "Miss ka na namin, {{customerName}}! Show code BALIK50 for ₱50 off your next cut at Kanto Kings." },
  { id: "mt-birthday", key: "custom_birthday", name: "Birthday treat", channel: "sms", trigger: "On the customer’s birthday", enabled: false, isDefault: false, sentThisMonth: 0,
    body: "Happy birthday, {{customerName}}! Your next beard trim is on us this week." },
];

export const messageLog: MessageLog[] = [
  { id: "ml-1", templateName: "On queue", toMasked: "+63 9•• ••• 0145", customerName: "Miguel Ramos", at: "6:10 PM", status: "delivered" },
  { id: "ml-2", templateName: "Thank you", toMasked: "+63 9•• ••• 0110", customerName: "Mark Villanueva", at: "6:37 PM", status: "delivered" },
  { id: "ml-3", templateName: "Thank you", toMasked: "+63 9•• ••• 0177", customerName: "Arnel Santos", at: "6:29 PM", status: "sent" },
  { id: "ml-4", templateName: "You’re next", toMasked: "+63 9•• ••• 0133", customerName: "Kevin Tan", at: "6:38 PM", status: "delivered" },
  { id: "ml-5", templateName: "Comeback offer", toMasked: "+63 9•• ••• 0164", customerName: "Rafael Lim", at: "2:00 PM", status: "failed" },
];
