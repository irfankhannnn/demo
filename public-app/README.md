# public-app/

The consumer-facing marketplace: people searching for property, with AI-assisted
search over listings that agencies publish from `agency-app/`.

| Folder | Status | What it is |
|---|---|---|
| `property-pages/` | live | Public, tenant-branded property pages (server-rendered Express on Lambda + CloudFront). Reads CRM data through `agency-app/api`'s internal API (`/api/internal/public-pages/*`). |
| `web/` | built | Consumer marketplace SPA (Vite + React): AI search, listing detail, chat, "I'm interested", site visits, saved. S3 + CloudFront. |
| `api/` | built | Marketplace API (Express on Lambda, own REST API + own table). AI intent parsing and "why it matches", chat threads, saved listings and searches, share pages, sitemap. Reads listings through `agency-app/api`'s `/api/internal/marketplace/*`. |
| `auth/` | built | Consumer auth: its own Cognito pool (phone OTP first, Google second) and its own tables. Separate from `platform/auth`, which serves agency users. |

Rules that apply here:

- Nothing in `public-app/` reads an `agency-app/` table, and nothing here keeps a
  copy of listings or agencies. `agency-app/api` stays the single owner: it marks a
  listing as visible by setting sparse index keys on its own PROPERTY item and
  serves cross-agency reads and vector search over its internal API. `public-app/api`
  owns consumer data only (profiles, saved items, threads, messages, guard counters).
  This replaced the earlier event-fed read-model plan, because a second copy of
  listings would need its own delete and unpublish handling.
- Enquiries, pings and visit requests go back to the CRM through the same internal
  API and become leads there (`source: 'Marketplace'`).
- Abuse control is hCaptcha + the guard table; consumer routes need the consumer JWT.

Contract for every cross-service call: `docs/public-app/api/API-CONTRACT.md`.

Deploy wrappers: `infra/cicd/public-app/<name>/deploy.sh`. Design docs: `docs/public-app/<name>/`.
