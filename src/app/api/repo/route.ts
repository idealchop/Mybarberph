import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionContext } from "@/lib/firebase/session";
import { FirestoreBarbersRepository } from "@/data/firebase/repository";
import type { BarbersRepository } from "@/data";

export const runtime = "nodejs";

const ALLOWED = new Set<keyof BarbersRepository>([
  "getShop", "updateShopSettings", "listBarbers", "getBarber", "saveBarber", "listChairs",
  "listServices", "saveService", "listHaircutStyles", "listTickets", "addWalkIn", "startTicket",
  "finishTicket", "listWaitlist", "textWaitlist", "listIncomingBookings", "acceptBooking",
  "declineBooking", "verifyScan", "listVerifiedVisits", "listPartnerNotifications",
  "createKioskTicket", "confirmCompleted", "recordPayment", "submitFeedback", "getSalesSummary",
  "listTransactions", "listDailySales", "getBarberStatsToday", "listInsights", "listCustomers",
  "getCustomer", "listCustomerVisits", "listMembershipPlans", "listMemberships", "listVouchers",
  "saveVoucher", "getReferralStats", "listMessageTemplates", "saveMessageTemplate", "listMessageLog",
]);

export async function POST(req: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const body = (await req.json()) as { method?: string; args?: unknown[] };
    const method = body.method as keyof BarbersRepository | undefined;
    if (!method || !ALLOWED.has(method)) {
      return NextResponse.json({ error: "Unknown method" }, { status: 400 });
    }
    const repo = new FirestoreBarbersRepository(adminDb(), ctx.shopId);
    const fn = repo[method] as (...a: unknown[]) => Promise<unknown>;
    const result = await fn.apply(repo, body.args ?? []);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("repo", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Request failed" }, { status: 500 });
  }
}
