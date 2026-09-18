# Marketplace — design notes

The consumer marketplace is the public, cross-agency "AI property matching"
portal (MagicBricks-style). Buyers describe what they want in plain English or
Hinglish, get ranked matches from every opted-in agency, and can chat, ping
("I'm interested") or request a site visit on any listing. The agency gets
the lead in its CRM and an alert on the channels it configured.

| Piece | Folder | Stack | Deploy |
|---|---|---|---|
| Consumer web | `apps/marketplace/marketplace-web/` | Vite + React 18 + Tailwind, S3 + CloudFront | `infra/cicd/marketplace-web/deploy.sh <env>` |
| Marketplace API | `apps/marketplace/marketplace-api/` | Express on Lambda, own REST API GW, own DynamoDB table | `infra/cicd/marketplace-api/deploy.sh <env>` |
| Consumer auth | `services/marketplace-authentication/` | TS Express on Lambda, own Cognito pool + tables | `infra/cicd/marketplace-authentication/deploy.sh <env>` |
| CRM changes | `apps/crm/server`, `apps/crm/real-estate-crm-app` | existing | existing `infra/cicd/server`, `infra/cicd/real-estate-crm-app` |

Contract for everything that crosses a service boundary: [`API-CONTRACT.md`](./API-CONTRACT.md).

## The one design rule: no copies of CRM data

The marketplace never mirrors properties or agencies. The CRM table stays the
single owner and single writer:

- **Visibility is a set of attributes on the CRM's own PROPERTY item**, set or
  removed by `apps/crm/server/marketplaceIndexing.js` at the end of every
  `createProperty` / `updateProperty`. Rule (all four): published (`publicVisibility === 'public'`),
  status ∈ {available, for-sale, for-rent}, not `marketplaceVisibility: 'unlisted'`,
  agency `marketplaceEnabled === true`. When true → SET `GSI4PK`, `GSI4SK`,
  `mktCityKey`, `mktLocalityKey`, `mktMode`, `mktListedAt`; when false → REMOVE all six.
- **Two sparse indexes on the CRM table** read those attributes:
  `marketplace-index` (GSI4, `CITY#<city>#<mode>` / `PRICE#<13 digits>#<id>`) for
  browsing, and `marketplace-vector-index` (HASH `mktCityKey`, inline
  `mktLocalityKey`/`mktMode`/`propertyType`) over the *same* `descriptionVector`
  the tenant-scoped index already uses. Nothing is re-embedded.
- **Deletes need nothing.** A deleted item is out of both indexes; an
  unpublished/sold/unlisted item loses its keys in the same write; an agency
  switching the marketplace off triggers `syncTenantMarketplaceKeys()` over its
  properties. There is no sync job and no second store to drift.
- **The marketplace reads through `/api/internal/marketplace/*`** on the CRM
  (own key `MARKETPLACE_INTERNAL_API_KEY`), exactly as `property-pages-ms`
  reads through `/api/internal/public-pages/*`. Reads are cached 60 s at the
  marketplace edge. Every payload passes `toPublicProperty()`'s allowlist.
- marketplace-api owns **only consumer data**: profiles, saved listings, saved
  searches, chat threads/messages, abuse counters. Threads keep a tiny display
  snapshot (title, agency name) so history renders after a listing is gone.

Why this over a read replica: the user's concern was duplicate data and what
happens on deletes. With attributes on the source item, "is it on the
marketplace?" has exactly one answer and it changes atomically with the CRM
write. See the memory of that decision in the plan history.

## Search path

1. Buyer types "2 bhk andheri under 80 lakh, near metro".
2. marketplace-api `modelGateway.parseIntent()` (Gemini Flash by default; Claude
   on Bedrock as the second adapter) → `{ cityKey: 'mumbai', mode: 'sale', bhk: 2, maxPrice: 8000000, locality: 'andheri', canonicalQuery }`.
   If the model is unavailable a deterministic heuristic (lakh/crore/k, rent words, BHK) fills in.
3. CRM `POST /api/internal/marketplace/search` → `embedText(canonicalQuery)` (Titan V2, inside the CRM) →
   `SearchVectors` on `marketplace-vector-index` partition `mumbai` with inline filters → over-fetch ×4,
   post-filter price/BHK, BatchGet full items, serialise → ranked listings with `matchScore`.
4. `modelGateway.explain()` writes one "why it matches" line per result + two follow-up refinements.

## Engagement path

Chat / ping / visit → marketplace-api writes the thread + message in its own
table → CRM `POST /enquiries|/messages|/pings|/site-visits` (x-tenant-id) →
`ingestLead()` (phone-deduped, `source: 'Marketplace'`, `sourceAdapter: 'marketplace'`)
→ `notifyMarketplaceActivity()` fans out in-app (deep link to the CRM
Marketplace Inbox) + email + WhatsApp + push per the agency's
`marketplaceNotifications` (Settings → Public pages in the CRM). Agents reply
from `/crm/marketplace/inbox`, which proxies to marketplace-api `/internal/*`.

## Operational notes

- Create the vector index once per environment, after the backend stack:
  `apps/crm/server/infra/create-vector-index.sh <env> marketplace` and wait for
  `check-vector-index.mjs` to report ACTIVE / not backfilling.
- Backfill keys for listings published before this shipped:
  `node apps/crm/server/scripts/backfill-marketplace-keys.js --dry-run` then without.
- The web domain is a placeholder (`MarketplaceWebDomainName` / `MARKETPLACE_WEB_ORIGIN`);
  dev runs on the CloudFront and API Gateway URLs until it is chosen.
- Cities offered are configuration (`MARKETPLACE_CITIES` on the CRM); there is no
  "distinct cities" index and a Scan for one would be the most expensive read in the system.
