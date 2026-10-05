import "server-only";

/**
 * Firestore-backed BarbersRepository (Admin SDK).
 * Scoped to one shop. Tips are stored but excluded from sales totals (SmartRefill pattern).
 */
import type { Firestore } from "firebase-admin/firestore";
import type { BarbersRepository, Page, ScanResult, TransactionQuery } from "../repository";
import type {
  Barber, Centavos, Chair, Customer, CustomerVisit, DailySales, Feedback, HaircutStyle, IncomingBooking,
  Insight, KioskTicketDraft, Membership, MembershipPlan, MessageLog, MessageTemplate, PartnerNotification,
  PaymentMethod, ReferralStats, SalesSummary, Service, Shop, Ticket, Transaction, VerifiedVisit, Voucher, WaitlistEntry,
} from "../types";
import { paths } from "./paths";

const manilaNow = () => {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
};

const dateKeyManila = () => manilaNow().slice(0, 10);

export class FirestoreBarbersRepository implements BarbersRepository {
  constructor(private db: Firestore, private shopId: string) {}

  private shopRef() { return this.db.doc(paths.shop(this.shopId)); }
  private col(name: string) { return this.shopRef().collection(name); }

  async getShop(): Promise<Shop> {
    const snap = await this.shopRef().get();
    if (!snap.exists) throw new Error("Shop not found");
    const data = snap.data() as Omit<Shop, "id">;
    const tier = data.tier === "partner" ? "partner" : "paid";
    const billingPlan = data.billingPlan
      ?? (tier === "partner" ? "partner" : "monthly_950");
    const billingStatus = data.billingStatus ?? "active";
    return { id: snap.id, ...data, tier, billingPlan, billingStatus };
  }

  async updateShopSettings(patch: Partial<Shop["settings"]>): Promise<Shop> {
    const shop = await this.getShop();
    const settings = { ...shop.settings, ...patch };
    await this.shopRef().update({ settings });
    return { ...shop, settings };
  }

  async updateShopTier(tier: import("../types").Tier): Promise<Shop> {
    const billingPlan = tier === "paid" ? "monthly_950" : "partner";
    await this.shopRef().update({ tier, billingPlan, billingStatus: "active" });
    return this.getShop();
  }

  async updateShopProfile(patch: Partial<Pick<Shop, "name" | "phone" | "address" | "city" | "hours" | "location" | "shopPhotos" | "coverPhoto">>): Promise<Shop> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) clean[k] = v;
    }
    if (Object.keys(clean).length) await this.shopRef().update(clean);
    return this.getShop();
  }

  async updateShopBilling(input: { billingPlan: import("../types").BillingPlan; billingStatus?: import("../types").BillingStatus }): Promise<Shop> {
    const { tierForPlan } = await import("@/lib/billing");
    const tier = tierForPlan(input.billingPlan);
    const billingStatus = input.billingStatus ?? "active";
    await this.shopRef().update({ billingPlan: input.billingPlan, billingStatus, tier });
    return this.getShop();
  }

  private async listCol<T extends { id: string }>(name: string): Promise<T[]> {
    const snap = await this.col(name).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  }

  async listBarbers() { return this.listCol<Barber>("barbers"); }
  async getBarber(id: string) {
    const snap = await this.col("barbers").doc(id).get();
    return snap.exists ? ({ id: snap.id, ...snap.data() } as Barber) : undefined;
  }
  async saveBarber(barber: Barber) {
    const { id, ...data } = barber;
    await this.col("barbers").doc(id).set(data, { merge: true });
    return barber;
  }
  async listChairs() { return this.listCol<Chair>("chairs"); }
  async listServices() { return this.listCol<Service>("services"); }
  async saveService(service: Service) {
    const { id, ...data } = service;
    await this.col("services").doc(id).set(data, { merge: true });
    return service;
  }
  async listHaircutStyles() { return this.listCol<HaircutStyle>("haircut_styles"); }

  async listTickets() { return this.listCol<Ticket>("tickets"); }

  private async nextQueueNumber(): Promise<number> {
    const ref = this.db.doc(paths.counter(this.shopId));
    return this.db.runTransaction(async (tx) => {
      const key = dateKeyManila();
      const snap = await tx.get(ref);
      const data = snap.data() as { dateKey?: string; nextNumber?: number } | undefined;
      const next = data?.dateKey === key ? (data.nextNumber ?? 1) : 1;
      tx.set(ref, { dateKey: key, nextNumber: next + 1 }, { merge: true });
      return next;
    });
  }

  async addWalkIn(input: { customerName: string; serviceId: string; barberId?: string }): Promise<Ticket> {
    const services = await this.listServices();
    const svc = services.find((s) => s.id === input.serviceId);
    const n = await this.nextQueueNumber();
    const waiting = (await this.listTickets()).filter((t) => t.status === "waiting").length;
    const t: Ticket = {
      id: `t-${dateKeyManila().replace(/-/g, "")}-${n}`,
      referenceId: `A-${String(n).padStart(3, "0")}`,
      kind: "walk_in", source: "staff", status: "waiting", queueNumber: n,
      customerName: input.customerName || "Walk-in", customerAvatar: "peach",
      requestedBarberId: input.barberId, barberId: input.barberId,
      serviceIds: [input.serviceId], serviceLabel: svc?.name ?? "Haircut",
      createdAt: manilaNow(), estimatedWaitMins: 10 + waiting * 5,
    };
    const { id, ...data } = t;
    await this.col("tickets").doc(id).set(data);
    return t;
  }

  async startTicket(ticketId: string, chairId: string): Promise<Ticket> {
    return this.patchTicket(ticketId, { status: "in_service", chairId, startedAt: manilaNow(), progressPct: 5, nextUp: false });
  }

  async finishTicket(ticketId: string): Promise<Ticket> {
    return this.patchTicket(ticketId, { status: "awaiting_confirmation", completedAt: manilaNow(), progressPct: 100 });
  }

  async listWaitlist() { return this.listCol<WaitlistEntry>("waitlist"); }
  async textWaitlist(entryId: string): Promise<WaitlistEntry> {
    const ref = this.col("waitlist").doc(entryId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Waitlist entry not found");
    await ref.update({ texted: true });
    return { id: snap.id, ...snap.data(), texted: true } as WaitlistEntry;
  }

  async listIncomingBookings() { return this.listCol<IncomingBooking>("incoming_bookings"); }
  async acceptBooking(id: string) { return this.patchBooking(id, "accepted"); }
  async declineBooking(id: string) { return this.patchBooking(id, "declined"); }

  async verifyScan(code: string): Promise<ScanResult> {
    const ref = code.trim().toUpperCase();
    const all = await this.listIncomingBookings();
    const b = ref
      ? all.find((x) => x.referenceId === ref && x.status !== "declined")
      : all.find((x) => x.status === "here") ?? all.find((x) => x.status === "accepted");
    if (!b) return { ok: false, reason: "not_found" };
    await this.col("incoming_bookings").doc(b.id).update({ status: "verified" });
    const barbers = await this.listBarbers();
    const visit: VerifiedVisit = {
      id: `vv-${b.id}-${Date.now()}`,
      customerName: b.customerName,
      referenceId: b.referenceId,
      serviceLabel: b.serviceLabel,
      barberName: barbers.find((x) => x.id === b.barberId)?.nickname,
      at: manilaNow(),
      atLabel: "Just now",
      status: "verified",
    };
    const { id, ...vdata } = visit;
    await this.col("verified_visits").doc(id).set(vdata);
    return { ok: true, booking: { ...b, status: "verified" } };
  }

  async listVerifiedVisits() { return this.listCol<VerifiedVisit>("verified_visits"); }
  async listPartnerNotifications() { return this.listCol<PartnerNotification>("partner_notifications"); }

  async createKioskTicket(draft: KioskTicketDraft): Promise<Ticket> {
    const services = await this.listServices();
    const barbers = await this.listBarbers();
    const svcs = services.filter((s) => draft.serviceIds.includes(s.id));
    const n = await this.nextQueueNumber();
    const barberId = draft.barberId === "any" ? barbers.find((b) => b.active)?.id : draft.barberId;
    const barber = barbers.find((b) => b.id === barberId);
    const ahead = (await this.listTickets()).filter((t) => t.status === "waiting" && t.barberId === barberId).length;
    const t: Ticket = {
      id: `t-kiosk-${dateKeyManila().replace(/-/g, "")}-${n}`,
      referenceId: `A-${String(n).padStart(3, "0")}`,
      kind: "walk_in", source: "kiosk", status: "waiting", queueNumber: n,
      customerName: draft.customerName || "Walk-in guest", customerAvatar: "sky",
      requestedBarberId: draft.barberId === "any" ? undefined : barberId,
      barberId, chairId: barber?.defaultChairId,
      serviceIds: draft.serviceIds,
      serviceLabel: svcs.map((s) => s.name).join(" + ") || "Haircut",
      createdAt: manilaNow(), estimatedWaitMins: 4 + ahead * 8,
    };
    const { id, ...data } = t;
    await this.col("tickets").doc(id).set(data);
    return t;
  }

  async confirmCompleted(ticketId: string): Promise<Ticket> {
    return this.patchTicket(ticketId, { status: "completed", completedAt: manilaNow(), progressPct: 100 });
  }

  async recordPayment(ticketId: string, input: { method: PaymentMethod; tip: Centavos }): Promise<Transaction> {
    const snap = await this.col("tickets").doc(ticketId).get();
    if (!snap.exists) throw new Error("Ticket not found");
    const t = { id: snap.id, ...snap.data() } as Ticket;
    const services = await this.listServices();
    const subtotal = services.filter((s) => t.serviceIds.includes(s.id)).reduce((a, s) => a + s.price, 0);
    // Tips are stored separately and excluded from `total` / sales totals.
    const txn: Transaction = {
      id: `tx-${t.id}`,
      referenceId: t.referenceId,
      ticketId,
      customerName: t.customerName,
      customerAvatar: t.customerAvatar,
      fromRiverMobile: t.source === "partner",
      serviceLabel: t.serviceLabel,
      barberId: t.barberId ?? "unknown",
      chairId: t.chairId ?? "unknown",
      subtotal,
      tip: input.tip || undefined,
      total: subtotal,
      paymentMethod: input.method,
      completedAt: manilaNow(),
    };
    const { id, ...data } = txn;
    await this.col("transactions").doc(id).set(data);
    await this.col("tickets").doc(ticketId).update({ status: "paid" });
    return txn;
  }

  async submitFeedback(feedback: Feedback): Promise<void> {
    const id = `fb-${feedback.ticketId}-${Date.now()}`;
    await this.col("feedback").doc(id).set(feedback);
    const txSnap = await this.col("transactions").where("ticketId", "==", feedback.ticketId).limit(1).get();
    if (!txSnap.empty) await txSnap.docs[0]!.ref.update({ rating: feedback.rating });
  }

  async getSalesSummary(): Promise<SalesSummary> {
    const txns = await this.listCol<Transaction>("transactions");
    const today = dateKeyManila();
    const todays = txns.filter((t) => t.completedAt.slice(0, 10) === today);
    const sales = todays.reduce((a, t) => a + t.total, 0); // tips excluded: total already excludes tip
    const tips = todays.reduce((a, t) => a + (t.tip ?? 0), 0);
    const tippers = todays.filter((t) => (t.tip ?? 0) > 0).length;
    const walkIns = todays.filter((t) => !t.fromRiverMobile).length;
    const online = todays.filter((t) => t.fromRiverMobile).length;
    const mix = new Map<PaymentMethod, number>();
    for (const t of todays) mix.set(t.paymentMethod, (mix.get(t.paymentMethod) ?? 0) + t.total);
    const rated = todays.filter((t) => t.rating);
    const avgRating = rated.length ? rated.reduce((a, t) => a + (t.rating ?? 0), 0) / rated.length : 0;
    const highest = todays.slice().sort((a, b) => b.total - a.total)[0];
    return {
      dayLabel: "Today",
      sales,
      salesDeltaLabel: todays.length ? `${todays.length} sales today` : "No sales yet today",
      tips,
      tippers,
      transactions: todays.length,
      walkIns,
      online,
      avgTicket: todays.length ? Math.round(sales / todays.length) : 0,
      highestLabel: highest ? `${highest.serviceLabel} ₱${(highest.total / 100).toLocaleString("en-PH")}` : "—",
      avgRating: Math.round(avgRating * 10) / 10,
      ratingsCount: rated.length,
      paymentMix: [...mix.entries()].map(([method, amount]) => ({ method, amount })),
      closesAt: "9:00 PM",
    };
  }

  async listTransactions(q: TransactionQuery = {}): Promise<Page<Transaction>> {
    const s = q.search?.trim().toLowerCase();
    const all = (await this.listCol<Transaction>("transactions"))
      .filter((t) =>
        (!q.barberId || t.barberId === q.barberId) &&
        (!q.chairId || t.chairId === q.chairId) &&
        (!q.paymentMethod || t.paymentMethod === q.paymentMethod) &&
        (!s || t.customerName.toLowerCase().includes(s) || t.referenceId.toLowerCase().includes(s)))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    const pageSize = q.pageSize ?? 10;
    const page = Math.max(1, q.page ?? 1);
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
  }

  async listDailySales(days: 7 | 14 | 30): Promise<DailySales[]> {
    const txns = await this.listCol<Transaction>("transactions");
    const byDay = new Map<string, number>();
    for (const t of txns) {
      const d = t.completedAt.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + t.total);
    }
    const out: DailySales[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
      const label = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" }).format(d);
      out.push({ label, sales: byDay.get(key) ?? 0 });
    }
    return out;
  }

  async getBarberStatsToday(): Promise<Record<string, { cuts: number; sales: Centavos; tips: Centavos }>> {
    const today = dateKeyManila();
    const txns = (await this.listCol<Transaction>("transactions")).filter((t) => t.completedAt.slice(0, 10) === today);
    const out: Record<string, { cuts: number; sales: Centavos; tips: Centavos }> = {};
    for (const t of txns) {
      const cur = out[t.barberId] ?? { cuts: 0, sales: 0, tips: 0 };
      cur.cuts += 1;
      cur.sales += t.total;
      cur.tips += t.tip ?? 0;
      out[t.barberId] = cur;
    }
    return out;
  }

  async listInsights(): Promise<Insight[]> {
    const stored = await this.listCol<Insight>("insights");
    if (stored.length) return stored;
    // Rule-based insights when nothing is stored (no Gemini key required).
    const txns = await this.listCol<Transaction>("transactions");
    const tickets = await this.listTickets();
    const services = await this.listServices();
    const out: Insight[] = [];
    const waiting = tickets.filter((t) => t.status === "waiting").length;
    if (waiting >= 4) {
      out.push({ id: "ins-wait", title: "Queue is building", body: `${waiting} customers are waiting. Open another chair or text the waitlist.`, emphasis: "high", action: { label: "Open queue", kind: "open_chair" } });
    }
    const byService = new Map<string, number>();
    for (const t of txns.slice(0, 40)) byService.set(t.serviceLabel, (byService.get(t.serviceLabel) ?? 0) + 1);
    const top = [...byService.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      out.push({ id: "ins-svc", title: `${top[0]} is your top cut`, body: `It showed up ${top[1]} times in recent sales. Keep it featured on the kiosk.`, emphasis: "medium" });
    }
    const tipShare = txns.filter((t) => (t.tip ?? 0) > 0).length;
    if (txns.length >= 5 && tipShare / txns.length < 0.25) {
      out.push({ id: "ins-tip", title: "Tips are low", body: "Fewer than 1 in 4 tickets left a tip. Prompt for tips at payment on the kiosk.", emphasis: "low" });
    }
    if (!out.length && services.length) {
      out.push({ id: "ins-welcome", title: "Your shop is live", body: "Complete a few walk-ins today — the dashboard fills in from real tickets and sales.", emphasis: "medium" });
    }
    return out;
  }
  async listCustomers() { return this.listCol<Customer>("customers"); }
  async getCustomer(id: string) {
    const snap = await this.col("customers").doc(id).get();
    return snap.exists ? ({ id: snap.id, ...snap.data() } as Customer) : undefined;
  }
  async saveCustomer(customer: Customer): Promise<Customer> {
    const { id, ...data } = customer;
    await this.col("customers").doc(id).set(data, { merge: true });
    return customer;
  }
  async listCustomerVisits(customerId: string): Promise<CustomerVisit[]> {
    const snap = await this.col("customer_visits").where("customerId", "==", customerId).get();
    if (!snap.empty) return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CustomerVisit);
    return [];
  }
  async listMembershipPlans() { return this.listCol<MembershipPlan>("membership_plans"); }
  async listMemberships() { return this.listCol<Membership>("memberships"); }
  async listVouchers() { return this.listCol<Voucher>("vouchers"); }
  async saveVoucher(voucher: Voucher) {
    const { id, ...data } = voucher;
    await this.col("vouchers").doc(id).set(data, { merge: true });
    return voucher;
  }
  async getReferralStats(): Promise<ReferralStats> {
    const vouchers = await this.listVouchers();
    const referrals = vouchers.filter((v) => v.kind === "referral").reduce((a, v) => a + (v.redemptionCount ?? 0), 0);
    return {
      month: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "long" }).format(new Date()),
      referrals,
      referralGoal: 40,
      redeemedToday: vouchers.reduce((a, v) => a + (v.usedThisMonth ?? 0), 0) > 0 ? Math.min(9, referrals) : 0,
    };
  }
  async listMessageTemplates() { return this.listCol<MessageTemplate>("message_templates"); }
  async saveMessageTemplate(template: MessageTemplate) {
    const { id, ...data } = template;
    await this.col("message_templates").doc(id).set(data, { merge: true });
    return template;
  }
  async listMessageLog() { return this.listCol<MessageLog>("message_log"); }

  async sendMessage(input: { templateId?: string; to: string; customerName: string; body: string; ticketId?: string }): Promise<MessageLog> {
    const { sendSms } = await import("@/lib/sms");
    const result = await sendSms({ to: input.to, body: input.body });
    const log: MessageLog = {
      id: `ml-${Date.now()}`,
      templateName: input.templateId ?? "custom",
      toMasked: input.to.replace(/(\d{2})\d+(\d{2})/, "$1••••$2"),
      customerName: input.customerName,
      at: manilaNow(),
      status: result.ok ? "sent" : "failed",
    };
    const { id, ...data } = log;
    await this.col("message_log").doc(id).set({ ...data, ticketId: input.ticketId, body: input.body, provider: result.provider, error: result.error });
    return log;
  }

  private async patchTicket(id: string, patch: Partial<Ticket>): Promise<Ticket> {
    const ref = this.col("tickets").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Ticket ${id} not found`);
    await ref.update(patch);
    return { id, ...snap.data(), ...patch } as Ticket;
  }

  private async patchBooking(id: string, status: IncomingBooking["status"]): Promise<IncomingBooking> {
    const ref = this.col("incoming_bookings").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Booking ${id} not found`);
    await ref.update({ status });
    return { id, ...snap.data(), status } as IncomingBooking;
  }
}
