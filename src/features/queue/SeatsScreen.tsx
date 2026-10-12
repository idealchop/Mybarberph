"use client";

import { Topbar } from "@river-apps/ui";
import { PageBack } from "@/components/shell/PageBack";
import { SeatList } from "@/features/settings/SeatList";
import { useScopedRequests, type ChairRequest } from "@/lib/chair-bookings";
import { chairLocation, useShopChairs, type ShopChair } from "@/lib/shop-chairs";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";

function seatHolders(chairs: ShopChair[], rows: ChairRequest[]) {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.status !== "in_chair" || !row.chairLabel) continue;
    const chair = chairs.find((item) => item.label === row.chairLabel && chairLocation(item) === (row.locationId || HOME_LOCATION_ID));
    if (chair) map[chair.label] = row.customerLabel || "In use";
  }
  return map;
}

/** Chairs for the open shop, opened from the In chair card. */
export function SeatsScreen() {
  const shops = useShopLocations();
  const { chairs, ready } = useShopChairs();
  const { rows } = useScopedRequests();
  const inUse = rows.filter((row) => row.status === "in_chair").length;
  const place = shops.viewingAll ? "All locations" : shops.enabled && shops.branch ? shops.branch.name : undefined;

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        leading={<PageBack fallback="/queue" />}
        title="In chair"
        subtitle={ready ? `${inUse} in use${place ? ` · ${place}` : ""}` : "Loading"}
      />
      {!ready ? null : shops.viewingAll ? shops.branches.map((branch) => {
        const mine = chairs.filter((chair) => chairLocation(chair) === branch.id);
        return (
          <section key={branch.id} className="mt-5">
            <p className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">{branch.name}</p>
            {mine.length === 0 ? (
              <p className="mt-2 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No chairs yet. Add them in Services.</p>
            ) : (
              <SeatList chairs={mine} holders={seatHolders(mine, rows)} />
            )}
          </section>
        );
      }) : chairs.length === 0 ? (
        <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No chairs yet. Add them in Services.</p>
      ) : (
        <SeatList chairs={chairs} holders={seatHolders(chairs, rows)} />
      )}
    </div>
  );
}
