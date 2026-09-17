# Architecture

## Two services, one trust boundary

`property-pages-ms` is internet-facing, anonymous, and crawler-visible. The
CRM backend (`agency-app/api/`) holds the real DynamoDB tables and the S3 documents
bucket, including title deeds, occupancy certificates, tax receipts, owner
phone numbers, and full addresses.

`property-pages-ms`'s Lambda role (`public-app/property-pages/infra/cfn-property-pages.yaml`,
resource `PagesLambdaRole`) grants exactly one permission: `GetItem`/`PutItem`/
`UpdateItem` on its own `GuardTable`. No CRM table ARN, no S3 ARN. It reaches
CRM data only over HTTPS, through `agency-app/api/routes/publicPagesInternal.js`,
authenticated with a shared key (`x-api-key`, compared via
`crypto.timingSafeEqual`) plus an explicit `x-tenant-id` header — never a
user JWT. A full compromise of the public service therefore yields nothing
beyond what that internal API is willing to serialize: already-public
listings, nothing more, because it was never issued credentials to reach
anything else.

## The allowlist serialiser

`agency-app/api/publicListingService.js`'s `toPublicProperty()` and `toPublicAgency()`
build a **new** object naming every field they emit. They never spread the
stored item and never delete fields after the fact.

This matters because the PROPERTY item also carries `titleDeedS3Key`,
`occupancyCertificateUrl`, `propertyTaxReceiptUrl`, `ownerPhone`, and
`ownerSnapshot` on the same row. A blocklist leaks silently the day someone
adds a column to the Property model; an allowlist fails the opposite way —
a forgotten field is just missing from the page. Locality is included
(`area`, `city`, `buildingName`); street `address` and `flatNumber` are not
— a listing shows roughly where a property is, not which door to knock on.

## Two independent publish gates

A property is servable only when **both** hold (`isPubliclyVisible()`):

1. `publicVisibility === 'public'` — an agent deliberately published it.
2. `status` is in `{'available', 'for-sale', 'for-rent'}`.

Gate 2 exists because `publicVisibility` is sticky: closing a deal sets
`status` to `sold`/`rented` but doesn't necessarily clear `publicVisibility`,
so without it a sold property would stay live indefinitely. Both lookup
functions return "not found" rather than a distinct "unpublished" — a
private listing is indistinguishable from one that never existed.

## Tenant addressing

Two modes, both live at once (`public-app/property-pages/middleware/resolveTenant.js`):

- **Subdomain** — `<agency-slug>.<PUBLIC_PAGES_BASE_DOMAIN>`, read from
  `X-Forwarded-Host`, which a CloudFront Function (`PreserveHostFunction`)
  populates from the viewer's real `Host` before CloudFront rewrites it to
  the API Gateway origin.
- **Path fallback** — `/t/<agency-slug>/...`, gated by `PATH_TENANT_FALLBACK`
  (default on). The wildcard cert and DNS record are manual, out-of-band
  steps, so this is what makes the flow testable on a raw CloudFront URL
  before either exists. `req.url` is rewritten to strip the prefix so every
  downstream route reads as if mounted at the root; `req.urlPrefix` carries
  the prefix back into every generated link.

Trusting `X-Forwarded-Host` would normally be a vulnerability, but it only
ever selects which agency's already-public listings to render — there's no
per-tenant authorization being bypassed.

## Asset delivery: redirect indirection, not embedded presigned URLs

`GET /i/:propertyId/:index` and `/d/:propertyId/:index` ask the CRM's
internal API for a fresh presigned S3 URL (900s expiry) and issue a `302` to
it, cached at the edge for `ASSET_CACHE_SECONDS` (default 300s) — well under
the signature's lifetime. Presigned URLs are never embedded in the HTML: an
`<img src>` carrying one breaks the moment the *page* is cached longer than
the signature lives, which is the point of a CDN in front of it. Indirecting
through a stable path lets the HTML cache for minutes while each asset
request still gets a live signature.

## DynamoDB indexes in play

| Index | Table | Used for |
|---|---|---|
| `search-index` (GSI3) | CRM table | `listPublicProperties()` queries `GSI3PK = TENANT#<id>#SEARCH`, `begins_with(GSI3SK, 'PROPERTY#')` — the same partition `getLeads` writes to. No new GSI needed; every PROPERTY item has carried GSI3 since `createProperty` was first committed. `publicVisibility`/`status` apply as a `FilterExpression` after the key condition. |
| `agencySlug-index` (new) | AgencyConfigTable | `getTenantIdByAgencySlug()` — resolves a subdomain to a tenant without a table scan, on every inbound request including crawlers. |
| `marketplace-index` / GSI4 (new, **unused**) | CRM table | Reserved for the not-yet-built `properties.realestateflow.in` marketplace. Partitioned by city, not one `PUBLIC#` bucket — a single partition holding every listing nationally would be the hottest key in the table (capped at 3000 RCU), and city is the first filter a buyer applies anyway. Sparse by design: only a listing opted into the marketplace would carry `GSI4PK`. Nothing in the codebase sets that attribute yet. |

## Request flow

```
Visitor (browser, or an in-app browser inside Instagram/WhatsApp)
  |
  |  GET https://sunrise-realty.pages.realestateflow.in/property/3bhk-.../prop-1
  v
CloudFront (PagesDistribution)
  - PreserveHostFunction: copies Host -> X-Forwarded-Host
  - cache key includes X-Forwarded-Host (else one tenant's cached page could
    serve under another tenant's name)
  v
API Gateway (REGIONAL, {proxy+}) --AWS_PROXY-->  PagesLambda
  |
  |  resolveTenant: X-Forwarded-Host, or /t/<slug>/ fallback -> agency slug
  |  abuseGuard: page-view / session-mint / booking throttle
  |    (its own GuardTable — no CRM table access from here)
  v
crmClient.js  --HTTPS, x-api-key + x-tenant-id-->
  v
agency-app/api/routes/publicPagesInternal.js   (CRM backend, "agency-app/api/")
  |
  |  publicListingService.js: toPublicProperty / toPublicAgency (allowlist)
  |  siteVisitBooking.js: bookSiteVisit -> ingestLead() + createMeeting()
  v
CRM DynamoDB (search-index GSI3, agencySlug-index)  +  S3 (presigned URL only)
```

The booking write (`POST /visit`) follows the same path one level deeper:
the pages Lambda mints and later burns a signed session token itself (no CRM
call needed for that), then calls `POST /site-visits` on the internal API,
which calls `bookSiteVisit()`. That function creates a lead (via the
existing `ingestLead()`, reused verbatim including its phone dedupe) and,
unconditionally, a meeting — even when the phone matches an existing lead,
because a calendar commitment has to reach the agency regardless of dedupe.
