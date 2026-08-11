# Disabled Features — Re-enablement Guide

## Why These Are Disabled
These features were disabled before launch to reduce surface area. The code is preserved in the repository but routes are not mounted.

## Features

### 1. Real Estate Management (Developers, Projects, Areas)
- **Server routes:** `routes/developers.js`, `routes/projects.js`, `routes/realEstateAreas.js`
- **Frontend pages:** `DeveloperList`, `DeveloperDetails`, `ProjectList`, `ProjectDetails`, `RealEstateAreaList`, `RealEstateAreaDetails`
- **Re-enable steps:**
  1. Uncomment imports in `server/server.js`
  2. Uncomment route mounts in `server/server.js`
  3. Uncomment imports in `real-estate-crm-app/src/App.tsx`
  4. Uncomment Routes in `real-estate-crm-app/src/App.tsx`

### 2. Buildings/Flats Hierarchy
- **Server routes:** `routes/areasBuildings.js`, `routes/flats.js`, `routes/areas.js`, `routes/publicAreas.js`
- **Re-enable steps:**
  1. Uncomment imports and route mounts in `server/server.js`

### 3. AI Calling — RE-ENABLED (Lead Temperature migration)
- **Status:** `routes/aiCallingInternal.js` is repaired and mounted at `/api/internal`
  (see `server.js`), reused for Hot/Warm/Cold qualification calls. The route's
  disable-comment previously closed mid-handler, leaving dangling code — it has
  been rewritten from scratch against the current `crmDynamodbService.js`
  export surface, not just uncommented.
- **Service:** `ai-calling-service/` (standalone microservice) — still needs its
  own CloudFormation stack deployed per tenant that opts in (`agencyConfig.aiEmployeeEnabled`).
- **Frontend:** the browser never talks to ai-calling-service directly — no
  `aiCallingApi.ts` or `VITE_AI_CALLING_*` env vars needed. `services/api.ts`
  gained one method, `triggerQualifyCall(leadId)`, which calls the CRM's own
  `POST /crm/leads/:id/qualify-call`; the CRM server proxies to
  ai-calling-service using `AI_CALLING_SERVICE_URL` server-side. The original
  full AI Calling page set (`src/pages/crm/AICalling/`) remains deleted and
  out of scope — the qualification flow lives inside the existing Lead
  Drawer/Lead Details pages instead of standalone pages, with no live
  call-status polling (the lead's temperature updates once the call-outcome
  webhook lands; refresh to see it).
- **Remaining steps to go live per tenant:**
  1. Deploy `ai-calling-service/` CloudFormation stack (`ai-calling-service/cfn-template.yaml`)
     — note its `WEBHOOK_BASE_URL` env var isn't wired in that template yet;
     add it before relying on live intent webhooks (pre-existing gap, not
     introduced by this migration).
  2. Set the new `AiCallingInternalApiKey` / `AiCallingServiceUrl` CFN
     parameters (`server/infra/cfn-backend.yaml`) — or `AI_CALLING_INTERNAL_API_KEY`
     / `AI_CALLING_SERVICE_URL` in `server/.env` for local dev
  3. Turn on `agencyConfig.aiEmployeeEnabled` for the tenant

## Notes
- Do not delete the underlying route files unless the feature is permanently retired.
- All disabled features were functional before being commented out.
