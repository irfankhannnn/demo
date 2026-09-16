# EPIC-12 Completion Report — PR-L: Signup → Brevo Wire-up + UTM Attribution

## Implemented Features
- `apps/crm/server/routes/auth.js` — `POST /api/auth/post-registration` endpoint: adds new trial user to Brevo "Trial Signups" list (via BREVO_API_KEY + BREVO_TRIAL_LIST_ID env vars), passes UTM attribution attributes
- `PhoneLogin.tsx` — UTM capture useEffect: reads `utm_source`, `utm_campaign`, `utm_medium` from URL query params (LP deep-links), stores in sessionStorage for cross-page attribution
- `RegisterAdmin.tsx` — UTM pass-through: reads from sessionStorage, includes in registration API body, fire-and-forget call to `/api/auth/post-registration`, clears sessionStorage after capture

## Files Modified
1. `apps/crm/server/routes/auth.js` — added POST /post-registration with Brevo contact creation
2. `apps/crm/real-estate-crm-app/src/pages/PhoneLogin.tsx` — added UTM capture useEffect
3. `apps/crm/real-estate-crm-app/src/pages/RegisterAdmin.tsx` — added UTM pass-through + Brevo hook call + sessionStorage cleanup

## Architecture Decision
- Auth.js on this server was previously empty (Cognito external microservice handles auth)
- Added a `post-registration` hook endpoint that the frontend calls after successful Cognito registration
- This is fire-and-forget — Brevo failure does NOT block the signup flow
- UTM attributes stored as Brevo contact custom attributes for campaign attribution

## Known Constraints
- BREVO_API_KEY and BREVO_TRIAL_LIST_ID must be set in production env for Brevo integration to work
- PostHog server-side `signup_completed` event deferred (serverTrack requires PostHog server SDK from PR-E)
- ZEE-013-T2 through T6 (LP deploy, Lighthouse, smoke test) are operational tasks requiring production access
