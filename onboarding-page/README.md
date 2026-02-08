# Onboarding Page (Local)

Creates a new **tenantId** + stores tenant admin credentials into the **AgencyConfig** DynamoDB table so the tenant can log into the CRM.

This is a small local web app (static HTML) + local Express backend.

## What it writes
It creates/overwrites a single DynamoDB item in `AGENCY_CONFIG_DYNAMODB_TABLE_NAME`:

- `TenantId` (partition key)
- `adminUsername`
- `adminPasswordHash` (bcrypt)
- `createdAt`, `updatedAt`
- (optional) `agencyName`, `contactEmail`, `contactPhone` if enabled

This matches the CRM backend login logic in `server/routes/auth.js` which checks tenant-specific admin credentials from AgencyConfig when `x-tenant-id` is provided.

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
copy .env.example .env
```

Make sure your AWS credentials work locally via AWS CLI / profile.
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

1) Use the created `tenantId`
2) In CRM UI, send it as request header `x-tenant-id: <tenantId>`
3) Login with the created username/password

## Notes

- This tool **overwrites** the tenant config if the same `tenantId` is generated again.
- Passwords are **not stored in plaintext**.
