# Hybrid read model

River AI Rules 01-plan allows realtime listeners or polling. Barbers.ph uses **polling only** — no Firestore listeners (there is no client Firestore SDK). Every poll pauses while the tab is hidden and refreshes once when it becomes visible.

| Data | Hook / module | Interval | Endpoint |
| :--- | :--- | :--- | :--- |
| Shop state + live queue (owner) | `src/lib/cloud.ts` | 15 s, 30 s after a quiet poll | `GET /api/shop?rev=` |
| Customer ticket status | `src/lib/chair-bookings.ts` | 3 s | `GET /api/public/bookings/:id` |
| Sales rows | `src/features/sales/use-sales-rows.ts` | 30 s (only when enabled) | `GET /api/shop/sales-rows` |
| Cash to claim | `src/features/sales/use-remit.ts` | 30 s | `GET /api/shop/remit-claims` (saved snap + changes, not every finished visit) |
| Notifications list | `src/features/activity/activity-screen.tsx` | 30 s | `GET /api/shop/notifications` |
| Notification badge | `src/features/activity/activity-screen.tsx` | 60 s | `GET /api/shop/notifications?count=1` |
| Barber link (queue, menu) | `src/lib/cloud.ts` | 15 s, 30 s after a quiet poll | `GET /api/barber/:token?rev=` |

Clock ticks (`setInterval` 1 s / 60 s in home, barber link and community) only re-render relative times; they don't fetch.

## Writes

Writes are explicit `PUT/POST/DELETE` calls. After a write the UI uses the server response, or the next poll of the paired GET brings the screen in line with the server (see [api-reference.md](./api-reference.md)).

## Cost note

Live polls send the shop's `queueRev`. When it matches, `/api/shop`, `/api/barber/:token` and `/api/shop/sales-rows` return `{ unchanged: true }` and do not read bookings. A quiet tab then waits 30 s instead of 15 s, and a visible tab or a new visit goes back to 15 s.

`GET /api/shop/remit-claims` reads `private/remitSnap` plus bookings and claims changed since that snap. The first read (or a Save / Claim) still scans every finished visit so old unclaimed days and edited amounts stay correct. There is no 8,000 cap.

A barber link reads the open queue plus that barber's cuts finished today (`barberId` + `completedAt`). Until that index in `firestore.indexes.json` is built, the link uses the older newest-150 / newest-300 window.
