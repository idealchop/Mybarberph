# River Mobile: Home service API (v1)

Home service lets a River Mobile customer book a barber to come to their address. It is **only**
available through this partner API (not on the shop QR/Schedule pages). Same base URL, auth
(`x-api-key` / `Authorization: Bearer`, env `RIVER_MOBILE_API_KEY`) and conventions as
[river-mobile-api.md](./river-mobile-api.md): money in **centavos**, times in epoch ms, wall-clock
times in **Asia/Manila**.

Shops turn it on in **Settings → Services**: a "Home" switch per service, plus per location a flat
home fee (₱), max distance (km), which barbers do home visits, and days/hours.

## 1. Find shops offering home service
### `GET /home-service/shops?lat=&lng=&limit=50`
With `lat`/`lng`, only locations whose radius covers the customer are returned, nearest first.

```json
{ "shops": [ {
  "shopId": "uid", "shopName": "Bossing Barbershop", "logoUrl": null,
  "locationId": "home", "locationName": "San Antonio", "address": "…",
  "location": { "lat": 14.58, "lng": 121.06, "formattedAddress": "…" },
  "fee": 15000, "feePeso": 150, "radiusKm": 5, "distanceKm": 1.84,
  "services": [ { "id": "haircut", "name": "Haircut", "price": 25000, "durationMins": 30, "kind": "haircut" } ],
  "hours": { "days": ["mon","tue","wed","thu","fri","sat"], "from": "10:00", "to": "18:00", "timeZone": "Asia/Manila" },
  "barbers": [ { "id": "b-123", "name": "Jun", "photoUrl": "data:image/jpeg;base64,…" } ]
} ] }
```
`services[].price` excludes the home fee. Total charged = sum of chosen services + `fee`.

## 2. Free time slots
### `GET /shops/{shopId}/home-service/slots?locationId=home&date=YYYY-MM-DD&barberId=`
30-minute start times inside the location's home hours, at least 60 min from now, that still have a
free home barber (each visit blocks that barber for an hour). `barberId` is optional.

```json
{ "date": "2026-10-18", "timeZone": "Asia/Manila",
  "slots": [ { "time": "10:00", "scheduledAt": 1792288800000 }, { "time": "10:30", "scheduledAt": 1792290600000 } ] }
```

## 3. Create a home booking
### `POST /shops/{shopId}/home-bookings`
```json
{ "locationId": "home", "serviceIds": ["haircut"],
  "customerName": "Ana", "contact": "+639171234567",
  "address": "12 Mabini St, Brgy. San Antonio, Pasig", "lat": 14.581, "lng": 121.061, "notes": "Blue gate",
  "date": "2026-10-18", "time": "10:00",            // or "scheduledAt": 1792288800000
  "barberId": "b-123",                               // optional ("any barber" when omitted)
  "payWhere": "shop", "payPref": "cash",             // "shop" = pay the barber at the visit (cash|gcash); "online" = paid in River
  "externalId": "river-booking-123" }
```
Validation (`400 {"error": "<message>"}`): home service on for that location, every service enabled for
home, address within `radiusKm` of the location pin, the slot is free and within 14 days, and the barber
(if given) does home visits there. Response `201`:

```json
{ "booking": { "id": "river-…", "ref": "BK-7KQ2MD", "status": "requested", "price": 40000,
  "serviceName": "Haircut", "slotLabel": "Sat, Oct 18, 10:00 AM", "scheduledAt": 1792288800000,
  "barberId": "b-123", "barberName": "Jun",
  "homeService": { "address": "…", "lat": 14.581, "lng": 121.061, "distanceKm": 1.84, "fee": 15000, "step": "scheduled" } } }
```
The shop and that location's barbers get an SMS/email alert ("Home service" + address). The booking shows in
the owner's Queue → Online with a **Home** tag, the address, a map link and the fee in the total.

## 4. Status
### `GET /shops/{shopId}/bookings/{id}` (existing endpoint)
`status`: `requested` → `accepted` → `in_chair` → `done` | `declined`.
For home bookings, `homeService.step` is the customer-facing progress:
`scheduled` → `on_the_way` → `arrived` → `done` (or `declined`). The barber sets On the way / Arrived / Done
from their barber link. Poll every 15–30 s while a visit is active.

## What River Mobile needs to do
1. Get the `RIVER_MOBILE_API_KEY` for dev/prod from Barbers.ph (must also be set as an App Hosting secret).
2. Home-service flow: list (`/home-service/shops` with the customer's lat/lng) → pick location, services, optional
   barber → fetch `/slots` for a date → `POST /home-bookings` with the address + pin → poll status.
3. Show the total as services + `fee`, and the steps from `homeService.step`.
4. Handle `400` messages (out of range, slot taken) by re-fetching slots or showing the message.
