/**
 * The data contract between the UI and a backend.
 *
 * Today `MockBarbersRepository` (./mock) implements it in memory. A Firebase implementation
 * (Firestore + Cloud Functions `barbersApi`, see the Barbers.ph plan §3) should implement the
 * same interface; pages and components only ever talk to `getRepository()` from "@/data".
 */
import type {
  Barber, Centavos, Chair, Customer, CustomerVisit, DailySales, Feedback, HaircutStyle, IncomingBooking, Insight,
  KioskTicketDraft, Membership, MembershipPlan, MessageLog, MessageTemplate, PartnerNotification, PaymentMethod,
  ReferralStats, SalesSummary, Service, Shop, Ticket, Transaction, VerifiedVisit, Voucher, WaitlistEntry,
} from "./types";

export interface TransactionQuery {
  barberId?: string;
  chairId?: string;
  paymentMethod?: PaymentMethod;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }

/** Result of scanning a River Mobile QR at the shop (Partner API, plan §4.5). */
export type ScanResult =
  | { ok: true; booking: IncomingBooking }
  | { ok: false; reason: "not_found" | "expired" | "other_shop" };

export interface BarbersRepository {
  /* shop & setup */
  getShop(): Promise<Shop>;
  updateShopSettings(patch: Partial<Shop["settings"]>): Promise<Shop>;
  listBarbers(): Promise<Barber[]>;
  getBarber(id: string): Promise<Barber | undefined>;
  saveBarber(barber: Barber): Promise<Barber>;
  listChairs(): Promise<Chair[]>;
  listServices(): Promise<Service[]>;
  saveService(service: Service): Promise<Service>;
  listHaircutStyles(): Promise<HaircutStyle[]>;

  /* queue */
  listTickets(): Promise<Ticket[]>;
  addWalkIn(input: { customerName: string; serviceId: string; barberId?: string }): Promise<Ticket>;
  startTicket(ticketId: string, chairId: string): Promise<Ticket>;
  finishTicket(ticketId: string): Promise<Ticket>;
  listWaitlist(): Promise<WaitlistEntry[]>;
  textWaitlist(entryId: string): Promise<WaitlistEntry>;

  /* River Mobile (Partner API) */
  listIncomingBookings(): Promise<IncomingBooking[]>;
  acceptBooking(id: string): Promise<IncomingBooking>;
  declineBooking(id: string): Promise<IncomingBooking>;
  verifyScan(code: string): Promise<ScanResult>;
  listVerifiedVisits(): Promise<VerifiedVisit[]>;
  listPartnerNotifications(): Promise<PartnerNotification[]>;

  /* kiosk (POS 2) */
  createKioskTicket(draft: KioskTicketDraft): Promise<Ticket>;
  confirmCompleted(ticketId: string): Promise<Ticket>;
  recordPayment(ticketId: string, input: { method: PaymentMethod; tip: Centavos }): Promise<Transaction>;
  submitFeedback(feedback: Feedback): Promise<void>;

  /* sales & growth */
  getSalesSummary(): Promise<SalesSummary>;
  listTransactions(query?: TransactionQuery): Promise<Page<Transaction>>;
  listDailySales(days: 7 | 14 | 30): Promise<DailySales[]>;
  getBarberStatsToday(): Promise<Record<string, { cuts: number; sales: Centavos; tips: Centavos }>>;
  listInsights(): Promise<Insight[]>;

  /* customers */
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  listCustomerVisits(customerId: string): Promise<CustomerVisit[]>;
  listMembershipPlans(): Promise<MembershipPlan[]>;
  listMemberships(): Promise<Membership[]>;

  /* vouchers & messages */
  listVouchers(): Promise<Voucher[]>;
  saveVoucher(voucher: Voucher): Promise<Voucher>;
  getReferralStats(): Promise<ReferralStats>;
  listMessageTemplates(): Promise<MessageTemplate[]>;
  saveMessageTemplate(template: MessageTemplate): Promise<MessageTemplate>;
  listMessageLog(): Promise<MessageLog[]>;
}
