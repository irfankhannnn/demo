# Property Pages

`property-pages-ms` is a standalone Express-on-Lambda microservice that
server-renders public, tenant-branded property listing pages and a site-visit
booking flow. It has no direct access to CRM data — every read and write goes
through `agency-app/api/routes/publicPagesInternal.js`, a dedicated internal API on
the main CRM backend.

## Three surfaces

| Surface | Status | What it is |
|---|---|---|
| Per-agency branded pages | Built | `<slug>.pages.realestateflow.in/...` (or `/t/<slug>/...` before DNS is wired) — one agency's listings, styled with that agency's brand color and logo. |
| Instagram / ManyChat visit CTA | Built | A visitor comments on an agency's Instagram post, ManyChat DMs them a link into the booking flow (`/visit/<propertyId>`), prefilled with whatever ManyChat knows about them. |
| Consumer marketplace (`properties.realestateflow.in`) | **Not built** | Cross-tenant, city-sharded search across every agency's listings. The DynamoDB GSI it will need (`marketplace-index`) already exists in `agency-app/api/infra/cfn-backend.yaml`, but nothing writes to it or reads from it yet. |

## Documents in this folder

1. `01-ARCHITECTURE.md` — how the two services fit together, the allowlist
   serialiser, tenant addressing, asset delivery, and which DynamoDB indexes
   are in play.
2. `02-MANYCHAT-SETUP.md` — the operator runbook for wiring an agency's
   Instagram account to the booking flow through ManyChat. Read this before
   onboarding any agency's Instagram.
3. `03-PRICING.md` — ManyChat's pricing tiers, what we do and don't need to
   build ourselves, and rough AWS cost order-of-magnitude for this feature.
4. `04-SECURITY.md` — the abuse-control design for the public booking
   endpoint: rate limiting, captcha, session tokens, and their known gaps.
