# Hybrid read model

River AI Rules 01-plan allows realtime listeners or polling. Barbers.ph uses **polling only** — no Firestore listeners (there is no client Firestore SDK). Every poll pauses while the tab is hidden and refreshes once when it becomes visible.

| Data | Hook / module | Interval | Endpoint |
| :--- | :--- | :--- | :--- |
| Shop state + today's queue (owner) | `src/lib/cloud.ts` | 15 s | `GET /api/shop` |
| Customer ticket status | `src/lib/chair-bookings.ts` | 3 s | `GET /api/public/bookings/:id` |
| Sales rows | `src/features/sales/use-sales-rows.ts` | 30 s (only when enabled) | `GET /api/shop/sales-rows` |
| Cash to claim | `src/features/sales/use-remit.ts` | 30 s | `GET /api/shop/remit-claims` |
| Notifications list | `src/features/activity/activity-screen.tsx` | 30 s | `GET /api/shop/notifications` |
| Notification badge | `src/features/activity/activity-screen.tsx` | 60 s | `GET /api/shop/notifications?count=1` |
| Barber link (queue, menu) | `src/features/barber/barber-self.tsx` | 30 s | `GET /api/barber/:token` |

Clock ticks (`setInterval` 1 s / 60 s in home, barber link and community) only re-render relative times; they don't fetch.

## Writes

Writes are explicit `PUT/POST/DELETE` calls. After a write the UI uses the server response, or the next poll of the paired GET brings the screen in line with the server (see [api-reference.md](./api-reference.md)).

## Cost note

`sales-rows` (up to 5,000 / 20,000 rows) and `remit-claims` (up to 8,000 done visits) re-read on every 30 s poll while Sales is open. That's fine at today's volume, but a busy shop leaving Sales open all day pays for those reads. The fix (pre-aggregated daily totals, or a longer interval) is a product/cost decision → open item.
