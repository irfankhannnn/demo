# property-pages-ms

Public, tenant-branded property pages and the site-visit booking flow.

An agency publishes a listing in the CRM; this service renders it at a URL the
agent can paste into WhatsApp or an Instagram DM. A visitor browses, taps
"Schedule a visit", and the booking becomes a CRM lead plus a meeting on the
agency's calendar.

Full documentation lives in [`docs/public-app/property-pages/`](../../docs/public-app/property-pages/):
architecture, the ManyChat setup runbook, pricing, and the security model.

## The one thing to know before changing anything

**This service holds no CRM database credentials.** Its Lambda role grants
access to exactly one DynamoDB table — its own rate-limit and nonce store. All
listing data arrives over HTTPS from the CRM's `/api/internal/public-pages/*`,
which serialises through an allowlist.

That is deliberate. The PROPERTY item in the CRM carries title deeds,
occupancy certificates, tax receipts and the owner's personal phone number. A
public web service that could read that table is one bug away from publishing
them. Widening the IAM policy in `infra/cfn-property-pages.yaml`, or reaching
for the CRM tables directly, removes the guarantee — don't, without a very
good reason and a matching change to the docs.

## Running locally

```bash
npm install
cp .env.sample .env          # fill in CRM_INTERNAL_API_DOMAIN_NAME/_BASE_PATH + the two secrets
                             # (locally the domain may be http://localhost:4000 with an empty base path)
npm run dev                  # http://localhost:3005
```

Local and test runs use an in-memory counter store (`NODE_ENV=development`, or
`GUARD_STORE=memory`). Real rate limiting needs DynamoDB — the in-memory store
is per-process and would be useless behind more than one Lambda container. It
exists because the booking path fails closed, so without it nothing is testable
off AWS.

Tenants resolve two ways:

| Mode | URL | When |
|---|---|---|
| Subdomain | `sunrise-realty.pages.realestateflow.in/` | Once the wildcard cert + DNS exist |
| Path | `<host>/t/sunrise-realty/` | Always. How you test before DNS is wired |

Both resolve the same tenant through the same lookup. The path form is not a
bypass of anything.

## Tests

```bash
npm test
```

40 tests covering HTML escaping, session-token forgery and replay, host
parsing, phone normalisation, and the booking flow end to end against a
stubbed CRM. `infra/deploy.sh` runs them before it packages anything.

## Deploying

```bash
# Preferred — build tracking, tagging, rollback, CloudFront invalidation
../../infra/cicd/public-app/property-pages/deploy.sh dev

# Direct
./infra/deploy.sh dev
```

Requires `.env.dev` or `.env.prod` (never a bare `.env` — the script refuses
to guess). A first CloudFront distribution takes 5-15 minutes.

**Prod note:** account `532404260898` is not verified for CloudFront. Set
`ENABLE_CLOUDFRONT=false` there until AWS Support clears it, or the stack fails
on the distribution.

## Layout

```
config/env.js            validated config; fails the cold start if misconfigured
middleware/              tenant resolution from subdomain or path
routes/pages.js          every public route; the POST handler's check order matters
services/abuseGuard.js   distributed rate limiting
services/sessionToken.js signed, single-use booking sessions
services/crmClient.js    the only door to CRM data
views/                   server-rendered HTML; esc() is not optional
```
