# public-app/

The consumer-facing marketplace: people searching for property, with AI-assisted
search over listings that agencies publish from `agency-app/`.

| Folder | Status | What it is |
|---|---|---|
| `property-pages/` | live | Public, tenant-branded property pages (server-rendered Express on Lambda + CloudFront). Reads CRM data through `agency-app/api`'s internal API today; moves to the event-fed read model below. |
| `web/` | planned | Consumer frontend (search, AI chat, enquiry) |
| `listings-api/` | planned | Search read model. Consumes `listing.published` / `listing.unpublished` from the bus into its own table; serves `GET /public/listings`; publishes `enquiry.created`. |

Rules that apply here:

- Nothing in `public-app/` reads an `agency-app/` table. Data arrives as events
  (`platform/contracts/events/`) and is stored in tables this folder owns.
- Public routes are served under the `/public/*` gateway prefix, unauthenticated
  or with an optional consumer JWT; abuse control is hCaptcha + the guard table.

Deploy wrappers: `infra/cicd/public-app/<name>/deploy.sh`. Design docs: `docs/public-app/<name>/`.
