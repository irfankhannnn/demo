# marketplace-authentication — design notes

Consumer authentication for the marketplace (`public-app/auth/`),
cloned from `platform/auth` and reduced to what a
property buyer needs. The service README next to the code covers endpoints,
local dev and deploy.

Why a separate service and pool rather than the CRM auth:

- **Different population, different identity.** Agency users are tenant
  members with roles; buyers are individuals with no tenant. Keeping them in
  one pool would mean every `TenantId` GSI, role check and invite flow has a
  "but not for consumers" branch.
- **Blast radius.** A leaked consumer token must not be able to reach any
  `/api/crm/*` route. Separate pool, separate JWKS, separate audience.
- **Phone-first.** The consumer pool declares `UsernameAttributes: [phone_number]`
  with email optional, so an OTP login needs no synthetic email (the CRM pool
  is email-required and works around it with a fake address).

What was kept from the original: Cognito `CUSTOM_AUTH` OTP with the three
trigger Lambdas (sha256 OTP, TTL, three attempts, `TEST_OTP_ENABLED` for dev),
Google PKCE, refresh via httpOnly cookie, `jwks-rsa` + `jsonwebtoken` verification,
rate limiting, internal-key middleware, deploy script with forced API
Gateway redeploy and the config-only allowlist.

What was dropped: tenants, roles, invites, contact linking, AgencyConfig and
Subscriptions lookups, and the tenant GSIs on the users table.

Added: `PATCH /auth/profile`, `DELETE /auth/me` (which asks marketplace-api to
delete the consumer's data and anonymise their messages), `POST /auth/logout`,
`GET /internal/users/:userId`.

Tables: `<env>-realestateflow-marketplace-auth-users` (PK `UserId`; GSIs
`SubIndex`, `PhoneIndex`, `EmailIndex`), `-identities` (PK `sub`, create-only),
`-otp` (PK `PhoneNumber`, TTL).
