import "server-only";

/**
 * Writes the demo shop (Kanto Kings) into Firestore for a new owner.
 * Reuses the mock seed so the UI has barbers, chairs, services, sample customers,
 * a few queue tickets, sales, and simulated River Mobile bookings immediately.
 */
import type { Firestore } from "firebase-admin/firestore";
import * as seed from "../mock/seed";
import { paths } from "./paths";

export interface SeedOwner {
  uid: string;
  email: string;
  displayName?: string;
}

function stripId<T extends { id: string }>(item: T): Omit<T, "id"> {
  const { id, ...rest } = item;
  void id;
  return rest;
}

export async function seedDemoShop(
  db: Firestore,
  owner: SeedOwner,
  opts: { shopId?: string; shopName?: string; tier?: "partner" | "paid" } = {},
): Promise<{ shopId: string }> {
  const shopId = opts.shopId ?? seed.shop.id;
  const shop = {
    ...stripId(seed.shop),
    id: undefined,
    name: opts.shopName ?? seed.shop.name,
    ownerUid: owner.uid,
    tier: opts.tier ?? "paid",
    ownerName: owner.displayName || seed.shop.ownerName,
  };
  delete (shop as { id?: string }).id;

  const batch = db.batch();
  const shopRef = db.doc(paths.shop(shopId));
  batch.set(shopRef, shop);
  batch.set(db.doc(paths.member(shopId, owner.uid)), {
    uid: owner.uid,
    shopId,
    role: "owner",
    status: "active",
    email: owner.email,
    createdAt: seed.DEMO_NOW,
  });
  batch.set(db.doc(paths.user(owner.uid)), {
    email: owner.email,
    displayName: owner.displayName || owner.email.split("@")[0],
    shopIds: [shopId],
    createdAt: seed.DEMO_NOW,
  });

  const writeAll = <T extends { id: string }>(col: string, items: T[]) => {
    for (const item of items) {
      batch.set(shopRef.collection(col).doc(item.id), stripId(item));
    }
  };

  writeAll("barbers", seed.barbers);
  writeAll("chairs", seed.chairs);
  writeAll("services", seed.services);
  writeAll("haircut_styles", seed.haircutStyles);
  writeAll("tickets", seed.tickets);
  writeAll("waitlist", seed.waitlist);
  writeAll("incoming_bookings", seed.incomingBookings);
  writeAll("verified_visits", seed.verifiedVisits);
  writeAll("partner_notifications", seed.partnerNotifications);
  writeAll("transactions", seed.transactions);
  writeAll("customers", seed.customers);
  writeAll("vouchers", seed.vouchers);
  writeAll("message_templates", seed.messageTemplates);
  writeAll("message_log", seed.messageLog);
  writeAll("membership_plans", seed.membershipPlans);
  writeAll("memberships", seed.memberships);
  writeAll("insights", seed.insights);

  for (const day of [...seed.dailySalesEarlier, ...seed.dailySales]) {
    const id = day.label.replace(/\s+/g, "-").toLowerCase();
    batch.set(shopRef.collection("daily_sales").doc(id), day);
  }

  for (const [customerId, visits] of Object.entries(seed.customerVisits)) {
    for (const v of visits) {
      batch.set(shopRef.collection("customer_visits").doc(v.id), { ...stripId(v), customerId });
    }
  }

  batch.set(db.doc(paths.counter(shopId)), { dateKey: "2026-10-04", nextNumber: 36 });

  await batch.commit();
  return { shopId };
}
