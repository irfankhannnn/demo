# marketplace-web — design notes

Consumer SPA for the marketplace (`apps/marketplace/marketplace-web/`). The
service README next to the code covers setup and deploy; this file records the
product/design decisions.

- **Positioning**: "AI property matching" — every AI mention says what it does
  (reads your budget, BHK and locality; ranks listings from partner agencies;
  explains why each matched). Never bare "AI-powered" (brand-kit rule).
- **Brand**: Bazaar Signal on a light paper ground — paper `#FBF2E4`, ink
  `#1C1512`, marigold `#FF7A1A` primary, gulal `#FF3D7F` reserved for AI
  moments (match badge, "why" line), tulsi `#1FAA59` for success. Unbounded
  display + Manrope body. Tone 70/30 English/romanised Hindi.
- **Routes**: `/`, `/search`, `/p/:agencySlug/:propertyId`, `/agency/:slug`,
  `/me/saved`, `/me/enquiries[/:threadId]`, `/me/searches`, `/me/profile`,
  `/auth/callback`. Listing URLs carry the agency slug because the CRM item
  key needs the tenant, resolved server-side via `agencySlug-index`.
- **Auth**: phone OTP is primary (consumer pool in marketplace-authentication),
  Google secondary. Access token in memory only; refresh through the httpOnly
  cookie on load and on 401. Chat / ping / visit / save require a signed-in
  profile with name + phone, because each becomes a CRM lead the agent must
  be able to call.
- **Images** are never S3 URLs in the bundle: `<api>/i/:slug/:id/:index`
  302-redirects to a short-lived presigned URL minted by the CRM.
- **Chat** is 5-second polling on the open thread with a `since` cursor; the
  thread schema does not change if WebSockets are added later.
- **SEO**: SPA plus server-rendered share pages on marketplace-api
  (`/share/p/...`) for OG unfurls and a `sitemap.xml` fed by the CRM.
- **Domain**: placeholder. `WebDomainName`, `AcmCertificateArn`, `HostedZoneId`
  are all empty in dev; CloudFront aliases and the Route53 record are only
  created when all three are set.
