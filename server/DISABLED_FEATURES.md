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

### 3. AI Calling
- **Service:** `ai-calling-service/` (standalone microservice)
- **Server internal route:** `routes/aiCallingInternal.js`
- **Frontend:** `src/services/aiCallingApi.ts` (deleted), AI Calling pages in `src/pages/crm/AICalling/` (deleted)
- **Re-enable steps:**
  1. Restore AI Calling pages from git history if needed
  2. Recreate `src/services/aiCallingApi.ts` with correct types and token key (`auth_id_token`)
  3. Deploy `ai-calling-service/` CloudFormation stack
  4. Uncomment `aiCallingInternalRoutes` in `server/server.js`
  5. Uncomment AI Calling pages and routes in frontend `App.tsx`
  6. Set `VITE_AI_CALLING_ENABLED=true` and `VITE_AI_CALLING_API_URL`

## Notes
- Do not delete the underlying route files unless the feature is permanently retired.
- All disabled features were functional before being commented out.
