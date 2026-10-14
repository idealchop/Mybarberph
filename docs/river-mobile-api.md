# River Mobile partner API (v1)

Base URL: `https://<backend host>/api/river/v1` (dev: `barbers-ph-dev`, prod: `barbers-ph`).

## Auth
Send the shared key as `x-api-key: <key>` or `Authorization: Bearer <key>`.
The server compares it against `RIVER_MOBILE_API_KEY` (App Hosting secret).
If the server has no key, every call returns `503 {"error":"not_configured"}`. A wrong key returns `401`.

Money is in **centavos** (`95000` = ₱950). Times are epoch milliseconds. Only shops that have set
a name and at least one service (`listed`) are visible.

## Endpoints

### `GET /shops?lat=&lng=&radiusKm=25&limit=50`
Listed shops. With `lat`/`lng`: only pinned shops within `radiusKm` (max 200), nearest first, with `distanceKm`.

```json
{ "shops": [ { "id": "uid", "name": "", "address": "", "area": "", "phone": "", "about": "",
  "hours": "Mon–Sat 9 AM–8 PM", "location": { "lat": 14.55, "lng": 121.02, "formattedAddress": "…" },
  "photoUrls": ["https://firebasestorage.googleapis.com/..."], "logoUrl": null, "branches": [],
  "services": [ { "id": "haircut", "name": "Haircut", "durationMins": 30, "price": 25000, "kind": "haircut" } ],
  "plan": "partner", "updatedAt": 0, "distanceKm": 1.2 } ] }
```

### `GET /shops/{shopId}`
One shop profile (same shape). `404` if missing or unlisted.

### `POST /shops/{shopId}/bookings`
Creates a booking ticket. It shows in the shop's Queue → Online as `requested`.

```json
{ "customerName": "Ana", "contact": "+639171234567", "serviceIds": ["haircut"],
  "slotLabel": "Today 3:00 PM", "locationId": "optional-branch-id", "externalId": "river-booking-123" }
```
`customerName` is required. `serviceIds` defaults to the first service. Response `201`:
```json
{ "booking": { "id": "river-…", "shopId": "uid", "ref": "BK-7KQ2MD", "status": "requested",
  "serviceName": "Haircut", "price": 25000, "paid": false, "verifiedAt": null, "createdAt": 0, "updatedAt": 0 } }
```
Payment is always at the chair for River bookings. No payment is taken through this API.

### `GET /shops/{shopId}/bookings/{id}`
Ticket status. Statuses: `requested` → `accepted` → `in_chair` → `done`, or `declined`.
Only bookings created through River (`source: river`) are returned.

### `POST /shops/{shopId}/verify`
Partner Scan: verify a ticket code at the shop.
Body `{ "code": "BK-7KQ2MD" }`. Returns `200 { "ok": true, "booking": {…} }` and sets `verifiedAt`; a
`requested` booking becomes `accepted`. Returns `404 {"ok":false,"reason":"not_found"}` or `409 … "declined"`.
Shop owners can also verify in the app (Queue → Find ticket), which calls `/api/shop/verify`.

## Errors
`{ "error": "<code>" }` with `400` (bad input), `401`, `404`, `503 not_configured`.
