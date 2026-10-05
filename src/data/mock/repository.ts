import type { BarbersRepository, Page, ScanResult, TransactionQuery } from "../repository";
import type { Barber, Feedback, KioskTicketDraft, MessageTemplate, PaymentMethod, Service, Shop, Ticket, Transaction, Voucher, IncomingBooking } from "../types";
import * as seed from "./seed";

const clone = <V,>(v: V): V => structuredClone(v);

/**
 * In-memory implementation backed by ./seed. State lives as long as the JS module
 * (per browser tab on the client, per server process on the server). Nothing is persisted.
 */
export class MockBarbersRepository implements BarbersRepository {
  private db = clone({
    shop: seed.shop, barbers: seed.barbers, chairs: seed.chairs, services: seed.services, styles: seed.haircutStyles,
    tickets: seed.tickets, waitlist: seed.waitlist, incoming: seed.incomingBookings, visits: seed.verifiedVisits,
    notifications: seed.partnerNotifications, transactions: seed.transactions, customers: seed.customers,
    customerVisits: seed.customerVisits, vouchers: seed.vouchers, templates: seed.messageTemplates, messageLog: seed.messageLog,
    feedback: [] as Feedback[],
  });
  private nextQueue = 36;

  async getShop() { return clone(this.db.shop); }
  async updateShopSettings(patch: Partial<Shop["settings"]>) {
    this.db.shop.settings = { ...this.db.shop.settings, ...patch };
    return clone(this.db.shop);
  }
  async updateShopTier(tier: import("../types").Tier) {
    this.db.shop.tier = tier;
    this.db.shop.billingPlan = tier === "paid" ? "monthly_950" : "partner";
    this.db.shop.billingStatus = "active";
    return clone(this.db.shop);
  }
  async updateShopProfile(patch: Partial<Pick<import("../types").Shop, "name" | "phone" | "address" | "city" | "hours" | "location">>) {
    Object.assign(this.db.shop, patch);
    return clone(this.db.shop);
  }
  async updateShopBilling(input: { billingPlan: import("../types").BillingPlan; billingStatus?: import("../types").BillingStatus }) {
    const { tierForPlan } = await import("@/lib/billing");
    this.db.shop.billingPlan = input.billingPlan;
    this.db.shop.billingStatus = input.billingStatus ?? "active";
    this.db.shop.tier = tierForPlan(input.billingPlan);
    return clone(this.db.shop);
  }
  async listBarbers() { return clone(this.db.barbers); }
  async getBarber(id: string) { return clone(this.db.barbers.find((b) => b.id === id)); }
  async saveBarber(barber: Barber) { return this.upsert(this.db.barbers, barber); }
  async listChairs() { return clone(this.db.chairs); }
  async listServices() { return clone(this.db.services); }
  async saveService(service: Service) { return this.upsert(this.db.services, service); }
  async listHaircutStyles() { return clone(this.db.styles); }

  async listTickets() { return clone(this.db.tickets); }
  async addWalkIn(input: { customerName: string; serviceId: string; barberId?: string }) {
    const svc = this.db.services.find((s) => s.id === input.serviceId);
    const n = this.nextQueue++;
    const t: Ticket = {
      id: `t-a${n}`, referenceId: `A-${String(n).padStart(3, "0")}`, kind: "walk_in", source: "staff", status: "waiting", queueNumber: n,
      customerName: input.customerName || "Walk-in", customerAvatar: "peach", requestedBarberId: input.barberId, barberId: input.barberId,
      serviceIds: [input.serviceId], serviceLabel: svc?.name ?? "Haircut", createdAt: seed.DEMO_NOW,
      estimatedWaitMins: 10 + this.db.tickets.filter((x) => x.status === "waiting").length * 5,
    };
    this.db.tickets.push(t);
    return clone(t);
  }
  async startTicket(ticketId: string, chairId: string) {
    return this.patchTicket(ticketId, { status: "in_service", chairId, startedAt: seed.DEMO_NOW, progressPct: 5, nextUp: false });
  }
  async finishTicket(ticketId: string) { return this.patchTicket(ticketId, { status: "awaiting_confirmation", progressPct: 100 }); }
  async listWaitlist() { return clone(this.db.waitlist); }
  async textWaitlist(entryId: string) {
    const e = this.db.waitlist.find((w) => w.id === entryId);
    if (!e) throw new Error("Waitlist entry not found");
    e.texted = true;
    return clone(e);
  }

  async listIncomingBookings() { return clone(this.db.incoming); }
  async acceptBooking(id: string) { return this.patchBooking(id, "accepted"); }
  async declineBooking(id: string) { return this.patchBooking(id, "declined"); }
  /** Mock scan: an empty code means "the customer standing at the counter" (the one marked "here", else the next accepted booking). */
  async verifyScan(code: string): Promise<ScanResult> {
    const ref = code.trim().toUpperCase();
    const b = ref
      ? this.db.incoming.find((x) => x.referenceId === ref && x.status !== "declined")
      : this.db.incoming.find((x) => x.status === "here") ?? this.db.incoming.find((x) => x.status === "accepted");
    if (!b) return { ok: false, reason: "not_found" };
    b.status = "verified";
    this.db.visits.unshift({
      id: `vv-${b.id}`, customerName: b.customerName, referenceId: b.referenceId, serviceLabel: b.serviceLabel,
      barberName: this.db.barbers.find((x) => x.id === b.barberId)?.nickname, at: seed.DEMO_NOW, atLabel: "Today 6:40 PM", status: "verified",
    });
    return { ok: true, booking: clone(b) };
  }
  async listVerifiedVisits() { return clone(this.db.visits); }
  async listPartnerNotifications() { return clone(this.db.notifications); }

  async createKioskTicket(draft: KioskTicketDraft) {
    const svcs = this.db.services.filter((s) => draft.serviceIds.includes(s.id));
    const n = this.nextQueue++;
    const barberId = draft.barberId === "any" ? "b-jm" : draft.barberId;
    const ahead = this.db.tickets.filter((t) => t.status === "waiting" && t.barberId === barberId).length;
    const t: Ticket = {
      id: `t-a${n}`, referenceId: `A-${String(n).padStart(3, "0")}`, kind: "walk_in", source: "kiosk", status: "waiting", queueNumber: n,
      customerName: draft.customerName || "Walk-in guest", customerAvatar: "sky", requestedBarberId: draft.barberId === "any" ? undefined : barberId,
      barberId, chairId: this.db.barbers.find((b) => b.id === barberId)?.defaultChairId, serviceIds: draft.serviceIds,
      serviceLabel: svcs.map((s) => s.name).join(" + ") || "Haircut", createdAt: seed.DEMO_NOW, estimatedWaitMins: 4 + ahead * 8,
    };
    this.db.tickets.push(t);
    return clone(t);
  }
  async confirmCompleted(ticketId: string) {
    return this.patchTicket(ticketId, { status: "completed", completedAt: seed.DEMO_NOW, progressPct: 100 });
  }
  async recordPayment(ticketId: string, input: { method: PaymentMethod; tip: number }) {
    const t = this.db.tickets.find((x) => x.id === ticketId);
    if (!t) throw new Error("Ticket not found");
    const subtotal = this.db.services.filter((s) => t.serviceIds.includes(s.id)).reduce((a, s) => a + s.price, 0);
    const txn: Transaction = {
      id: `tx-${t.id}`, referenceId: t.referenceId, ticketId, customerName: t.customerName, customerAvatar: t.customerAvatar,
      fromRiverMobile: t.source === "partner", serviceLabel: t.serviceLabel, barberId: t.barberId ?? "b-jm", chairId: t.chairId ?? "c-4",
      subtotal, tip: input.tip || undefined, total: subtotal, paymentMethod: input.method, completedAt: seed.DEMO_NOW,
    };
    this.db.transactions.unshift(txn);
    t.status = "paid";
    return clone(txn);
  }
  async submitFeedback(feedback: Feedback) {
    this.db.feedback.push(feedback);
    const t = this.db.transactions.find((x) => x.ticketId === feedback.ticketId);
    if (t) t.rating = feedback.rating;
  }

  async getSalesSummary() { return clone(seed.salesSummary); }
  async listTransactions(q: TransactionQuery = {}): Promise<Page<Transaction>> {
    const s = q.search?.trim().toLowerCase();
    const all = this.db.transactions.filter((t) =>
      (!q.barberId || t.barberId === q.barberId) && (!q.chairId || t.chairId === q.chairId) &&
      (!q.paymentMethod || t.paymentMethod === q.paymentMethod) &&
      (!s || t.customerName.toLowerCase().includes(s) || t.referenceId.toLowerCase().includes(s)));
    const pageSize = q.pageSize ?? 10;
    const page = Math.max(1, q.page ?? 1);
    return { items: clone(all.slice((page - 1) * pageSize, page * pageSize)), total: all.length, page, pageSize };
  }
  async listDailySales(days: 7 | 14 | 30) { return clone([...seed.dailySalesEarlier, ...seed.dailySales].slice(-days)); }
  async getBarberStatsToday() { return clone(seed.barberStatsToday); }
  async listInsights() { return clone(seed.insights); }

  async listCustomers() { return clone(this.db.customers); }
  async saveCustomer(customer: import("../types").Customer) { return this.upsert(this.db.customers, customer); }
  async getCustomer(id: string) { return clone(this.db.customers.find((c) => c.id === id)); }
  async listCustomerVisits(customerId: string) {
    const known = this.db.customerVisits[customerId];
    if (known) return clone(known);
    const c = this.db.customers.find((x) => x.id === customerId);
    if (!c) return [];
    const fav = this.db.barbers.find((b) => b.id === c.favoriteBarberId)?.nickname ?? "Any barber";
    return Array.from({ length: Math.min(c.visitCount, 4) }, (_, i) => ({
      id: `${customerId}-v${i}`, dateLabel: i === 0 ? "Today" : ["Sep 19", "Aug 30", "Aug 9"][i - 1]!, serviceLabel: i % 2 ? "Classic cut" : "Skin fade",
      barberName: fav, amount: i % 2 ? 20000 : 25000, tip: i === 0 ? 2000 : undefined, paymentMethod: (i % 2 ? "cash" : "gcash") as PaymentMethod,
      discountLabel: c.discount && i === 0 ? c.discount.label : undefined, rating: 5 - (i % 2),
    }));
  }
  async listMembershipPlans() { return clone(seed.membershipPlans); }
  async listMemberships() { return clone(seed.memberships); }

  async listVouchers() { return clone(this.db.vouchers); }
  async saveVoucher(voucher: Voucher) { return this.upsert(this.db.vouchers, voucher); }
  async getReferralStats() { return clone(seed.referralStats); }
  async listMessageTemplates() { return clone(this.db.templates); }
  async saveMessageTemplate(template: MessageTemplate) { return this.upsert(this.db.templates, template); }
  async listMessageLog() { return clone(this.db.messageLog); }
  async sendMessage(input: { templateId?: string; to: string; customerName: string; body: string; ticketId?: string }) {
    const log = {
      id: `ml-${Date.now()}`, templateName: input.templateId ?? "custom",
      toMasked: input.to, customerName: input.customerName, at: seed.DEMO_NOW, status: "sent" as const,
    };
    this.db.messageLog.unshift(log);
    return clone(log);
  }

  private upsert<V extends { id: string }>(list: V[], item: V): V {
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = clone(item); else list.push(clone(item));
    return clone(item);
  }
  private async patchTicket(id: string, patch: Partial<Ticket>) {
    const t = this.db.tickets.find((x) => x.id === id);
    if (!t) throw new Error(`Ticket ${id} not found`);
    Object.assign(t, patch);
    return clone(t);
  }
  private async patchBooking(id: string, status: IncomingBooking["status"]) {
    const b = this.db.incoming.find((x) => x.id === id);
    if (!b) throw new Error(`Booking ${id} not found`);
    b.status = status;
    return clone(b);
  }
}
