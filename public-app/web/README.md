# RealEstateFlow Homes — marketplace-web

The consumer side of the RealEstateFlow marketplace: a mobile-first "AI
property matching" portal. A buyer describes what they want in plain words
("2 BHK Andheri, under 80 lakh, near metro"); the app sends that to
marketplace-api, which turns it into a structured intent, scores every
published listing from partner agencies against it, and returns ranked matches
with a one-line reason each. Buyers can then chat with the agency, say "I'm
interested", book a site visit, save homes and re-run searches.

It is a static Vite SPA. All data comes from two services built against
`docs/public-app/api/API-CONTRACT.md`:

| Service | Env var | Local |
|---|---|---|
| marketplace-api (`public-app/api`) | `VITE_MARKETPLACE_API_URL` | `http://localhost:3006` |
| marketplace-authentication (`public-app/auth`) | `VITE_MARKETPLACE_AUTH_URL` | `http://localhost:3007` |

## Pages

| Route | What it does |
|---|---|
| `/` | Hero with the AI search box (city chip from `GET /cities`, example prompts), "How matching works", "New in <city>" rail (`GET /listings?sort=newest&limit=8`), partner agencies strip, broker CTA. |
| `/search` | URL-state driven. With `q` → `POST /search/ai`: assistant strip (message, editable/removable intent chips, follow-up chips), match badge + "why" per card, city picker when `needsCity`. Without `q` → `GET /listings` with cursor infinite scroll. Filter rail (desktop) / sheet (mobile): Buy/Rent, BHK, price (₹80 L / ₹1.2 Cr / ₹45k), locality, property type, furnishing. Sort. Save search. |
| `/p/:slug/:propertyId` | Gallery + lightbox (`/i/:slug/:id/:index`), price + key facts, description, amenities, documents, Google Maps embed (only with key + lat/lng), agency card (phone masked until login), Chat / I'm interested / Book a site visit, Save, Share (Web Share API → `/share/p/...`, clipboard fallback), Similar homes. 404 → "This listing is no longer available". Sticky bottom CTA bar on mobile. |
| `/agency/:slug` | Agency header + its listings. The contract has no per-agency listing route, so the page fetches `GET /listings` for the top 6 cities (cached 5 min) and filters by `agencySlug` client-side. |
| `/me/saved` | Saved homes (`GET /me/saved`), remove. |
| `/me/searches` | Saved searches: list, run (rebuilds the `/search` URL), delete. |
| `/me/enquiries` | Thread list with unread badges and status pills (`listing_removed`, `agency_closed`). |
| `/me/enquiries/:threadId` | Chat: buyer right / agency left / system chips for ping and visit_request (with date + time). Polls every 5 s with `since`, marks read on open, optimistic composer. |
| `/me/profile` | Name + email (`PATCH /auth/profile`), verified phone, logout, delete account with confirm (`DELETE /auth/me`). |
| `/auth/callback` | Google OAuth return (`POST /auth/token`). |

## Auth design

- Access token lives **in memory only** (`AuthContext`). On load the app calls
  `POST /auth/refresh` with `credentials: 'include'` to restore the session
  from the httpOnly `mp_refresh` cookie; the fetch wrapper refreshes once on
  any 401 and retries, then drops the session if that also fails.
- **Phone OTP is the primary login.** Google is a secondary sign-in.
- Chat, ping, site visit and save are gated by `requireAuth()`: the user must be
  logged in **and** have `name` + `phone`. The modal walks phone → OTP → name
  (if `isNew`).
- The auth service only stores a phone that came through OTP and the contract
  has no link-identity endpoint, so a Google user without a phone is shown a
  "Verify your phone" step using the same OTP endpoints; the tokens from
  `confirm` replace the session (the user continues as the phone-keyed
  account). Account linking by phone match is a server-side concern — if the
  auth service adds it, nothing here changes. See the note at the top of
  `src/contexts/AuthContext.tsx`.

## Stack

React 18 · TypeScript (strict) · Vite 5 · Tailwind 3 · react-router-dom 7 ·
@tanstack/react-query 5 · lucide-react · framer-motion (subtle only) ·
Vitest + Testing Library. No UI kit — primitives live in `src/components/ui`.

```
src/
  config/env.ts            base URLs, image/share URL helpers
  types/api.ts             contract types (§2, §3)
  services/api.ts          fetch wrapper: bearer, refresh-on-401, {error,details}
  services/auth.ts         marketplace-authentication client + Google PKCE storage
  services/marketplace.ts  marketplace-api client + query keys
  contexts/                Auth, City, Toast
  lib/format.ts            ₹80 L / ₹1.2 Cr / ₹45k/mo, relative time, phone masking
  lib/searchState.ts       /search URL-state reducer + intent chips
  hooks/                   useSaved, useInfiniteListings
  components/ui            Button, Chip, Input, Sheet, Modal, Badge, Skeleton, States
  components/{layout,search,listing,property,auth}
  pages/                   Home, Search, PropertyDetail, Agency, AuthCallback, NotFound, me/*
```

## Env

Copy `.env.sample` → `.env.local` for local dev; `.env.dev.sample` /
`.env.prod.sample` → `.env.dev` / `.env.prod` for deploys.

```
VITE_SITE_NAME=RealEstateFlow Homes
VITE_MARKETPLACE_API_URL=       # no trailing slash
VITE_MARKETPLACE_AUTH_URL=
VITE_GOOGLE_MAPS_EMBED_KEY=     # optional — blank hides the map
VITE_HCAPTCHA_SITE_KEY=         # optional — reserved for the anonymous search guard
```

## Local dev

```bash
npm install
cp .env.sample .env.local
npm run dev            # http://localhost:5174
npm test               # vitest (format, search-state reducer, auth refresh flow)
npm run typecheck      # tsc --noEmit
npm run build
```

`TEST_OTP_ENABLED=true` on marketplace-authentication short-circuits SMS in dev.

## Deploy

`infra/` holds the S3 + CloudFront stack and scripts (see `infra/README.md`);
`infra/cicd/public-app/web/deploy.sh` at the repo root wraps it with numbered
builds and rollback. The public domain is a placeholder — leave the `WEB_*`
domain vars blank to serve from `*.cloudfront.net`.

```bash
./infra/deploy.sh dev
../../infra/cicd/public-app/web/deploy.sh dev
```

## Design notes

"Bazaar Signal" v3 on a light paper ground
(`marketing-and-sales/creative/realestateflow-launch/brand-kit.md`):

- Paper `#FBF2E4` background, ink `#1C1512` text, marigold `#FF7A1A` for every
  primary action, **gulal `#FF3D7F` only for AI moments** (match badge, "why this
  matches", assistant strip, unread badges), tulsi `#1FAA59` only for
  success/verified. One accent per card.
- Unbounded 800 for headings and prices, Manrope for everything else,
  `tabular-nums` on numbers.
- 16 px card radius, soft layered shadows, shimmer skeletons, 44 px touch
  targets, visible focus rings, `prefers-reduced-motion` respected, sticky
  bottom CTA bar on the property page, filter sheet on mobile / rail on desktop.
- Copy is 70/30 English/romanised Hindi and never says "AI-powered" without
  saying what the model actually does ("How matching works").
- Lighthouse a11y ≥ 90 target: semantic landmarks, labelled controls, dialog
  focus trapping, contrast-checked palette.
