# Frontend documentation

## Stack

Next.js 16 App Router, React 19, Tailwind 4, River Apps UI kit (`vendor/river-apps-ui-kit`, git submodule, built by `npm run kit:build`), MapLibre map via `vendor/river-maps`.

## Routes

| Path | Who | Notes |
| :--- | :--- | :--- |
| `/` → `/home` | everyone | Guest-first home; sign-in sheet when an action needs an account |
| `/queue`, `/queue/new`, `/queue/seats` | owner | Live queue, walk-in, chairs. "Done today" list with a date chip |
| `/sales`, `/sales/detail`, `/sales/barbers`, `/sales/performance` | owner | Collected split Cash / GCash (+ Online / Other when present) |
| `/history`, `/scan`, `/qr` | owner | Visits list; ticket scan; shop QR |
| `/moments`, `/moments/profile` | owner | Community feed |
| `/companion` | owner | AI companion (flagged) |
| `/settings/**`, `/account` | owner | Profile, services, shops/locations, billing, activity log, map credits |
| `/b/[token]` | barber | Chair link: queue, history, own sales |
| `/book` | customer | Book / join queue; ticket status |
| `/privacy`, `/terms` | everyone | Legal (noindex while drafts) |

Each route has a `page.tsx` that renders one screen component from `src/features/<area>/` or `src/components/<area>/`.

## Folder rules

- `src/app` — routes only (pages, layouts, `robots.ts`, route handlers; no sitemap while every page is noindex).
- `src/features/<area>/` — screens and hooks per product area, kebab-case files, `index.ts` barrel.
- `src/components/<area>/` — shared UI (shell, auth sheet, transactions sheet, QR, map, legal).
- `src/lib/` — shared pure logic and the client data layer (`cloud.ts`, `session.ts`, `chair-bookings.ts`).
- The client never imports `src/lib/server/*` (`server-only`).

## Data access (FE/BE law)

The browser talks only to `/api/*` with `fetch` (`api()` in `src/lib/cloud.ts` attaches the Firebase ID token). No Firestore or Storage client SDK. See [hybrid-read-model.md](./hybrid-read-model.md).

## Browser storage

App state lives on the server. The browser keeps three small items, flagged in the compliance report as approved UX exceptions:

| Key | Storage | Why |
| :--- | :--- | :--- |
| `barbers.active-booking:{shopId}` (ticket id) | localStorage | Customer finds their queue ticket again after a refresh, without an account |
| `bp.authRedirect` | sessionStorage | Return path across the Google redirect sign-in, deleted right after |
| `bp.authTest` | localStorage | DEV-only opt-in for Firebase test phone numbers |

Firebase Auth's own persistence (IndexedDB) is the SDK default.

## Accessibility and SEO

- Every page has one `<h1>` (visible or `sr-only`) and a `<main>` landmark (`AppShell` from the UI kit for owner pages; own `<main>` on barber, booking, walk-in and legal pages).
- Icon-only buttons carry `aria-label`.
- `robots.ts`: non-prod hosts disallow all crawling; prod allows `/` and disallows `/api/`. Every page is `noindex` today (root layout `robots` metadata), including legal pages while their text is a draft. Making `/privacy` and `/terms` indexable is an open item for when the text is final.

## Style

Use the existing UI kit components (`StatCard`, `RangeChips`, sheets, pills) and tokens (`text-muted`, `bg-grey-*`, `font-extrabold` section labels). New UI in this pass (pay split lines, Done date chip) reuses them; no new visual language.
