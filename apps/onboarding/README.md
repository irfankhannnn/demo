# Onboarding Page (Local)

Creates a new **tenantId** + writes a tenant record into the **AgencyConfig** DynamoDB table so the tenant's admin can log into the CRM via Google or Phone OTP.

This is a small local web app (static HTML) + local Express backend.

## What it writes
It creates/overwrites a single DynamoDB item in `AGENCY_CONFIG_DYNAMODB_TABLE_NAME`
— server's consolidated AgencyConfig table (current env-first naming, e.g.
`prod-realestateflow-agencies` / `dev-realestateflow-agencies` — see `server/ddb.js`):

- `TenantId` (partition key)
- `agencyName`
- `status` (`ACTIVE`)
- `notificationSettings` (defaults, matching every other code path that creates this item)
- `createdAt`, `updatedAt`
- `adminEmail` and/or `adminPhone` — at least one required

There is no password. Authentication is entirely handled by the
`reality-flow-authentication` microservice (AWS Cognito, Google OAuth or
Phone OTP) — `server/routes/auth.js`'s old JWT/username-password login was
removed. On the admin's first successful login, `reality-flow-authentication`'s
`resolveUser()` looks this tenant up by `adminEmail`/`adminPhone` (via the
`adminEmail-index`/`adminPhone-index` GSIs on server's consolidated AgencyConfig
table) and auto-provisions the admin user — see
`reality-flow-authentication/src/utils/resolveUser.ts`.

## Run locally

### Option A (recommended): reuse `server/node_modules` (no npm install here)

This repo already has a working backend in `server/` with the AWS SDK dependencies installed.
To avoid npm registry timeouts, `onboarding-page` is configured to reuse the same dependencies.

1) Install dependencies once (in `server/`)

```bash
npm install
```

2) Configure env (in `onboarding-page/`)

```bash
copy .env.sample .env
```

Set `AGENCY_CONFIG_DYNAMODB_TABLE_NAME` to the target environment's table —
double-check `prod-realestateflow-agencies` vs
`dev-realestateflow-agencies`; writing to the wrong one is a real
mistake, not a cosmetic one, since this account has both a prod and (mostly
placeholder) dev environment. Make sure your AWS credentials work locally via AWS CLI / profile.
For example (PowerShell):

```powershell
$env:AWS_PROFILE="default"
aws sts get-caller-identity
```

3) Start onboarding backend (no npm install)

```bash
node server/index.js
```

### Option B: install inside `onboarding-page/` (only if your npm network works)

1) Install

```bash
npm install
```

2) Start

```bash
npm run dev
```

## AWS credentials

This tool uses the AWS SDK default credential chain (same as `server/`).
Recommended local setup:

1) Ensure AWS CLI works: `aws sts get-caller-identity`
2) Run with a profile in your terminal: `AWS_PROFILE=default` (or your SSO profile)

Open:

- http://localhost:5055

## CRM login after onboarding

There's nothing to manually configure on login — the tenant's admin just logs
into the CRM with the exact `adminEmail` (via Google) or `adminPhone` (via
Phone OTP) that was passed to this tool. `reality-flow-authentication` looks
up the tenant by that email/phone (`AdminEmailIndex`/`AdminPhoneIndex` on
AgencyConfig) and auto-provisions the admin user on that first login; the
frontend then reads `tenantId` off the authenticated profile and sends it as
`x-tenant-id` on every request automatically (`real-estate-crm-app/src/config/tenant.ts`)
— nobody types a tenantId by hand.

## Notes

- This tool **overwrites** the tenant config if the same `tenantId` is generated again — each run generates a fresh random `tenantId`, so re-running for the same agency creates a second, separate tenant rather than updating the first. To update an existing tenant, edit the AgencyConfig item directly instead.
- There is no password anywhere in this flow.
