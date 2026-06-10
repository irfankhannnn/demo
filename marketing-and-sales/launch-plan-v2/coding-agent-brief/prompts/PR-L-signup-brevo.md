# Agent Prompt — PR-L: Signup → Brevo Wire-up + UTM Attribution

**Branch to create:** `cursor/pr-5l-signup-brevo-8e67`
**Base branch:** `main` (after Batch 4 is merged)
**Batch:** 5 (Day 5) — single PR in this batch

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md`
2. `server/routes/auth.js` — find the registration/signup handler
3. `real-estate-crm-app/src/pages/PhoneLogin.tsx` — the signup entry point
4. `real-estate-crm-app/src/App.tsx` — understand where RegisterAdmin sits in the flow
5. `real-estate-crm-app/src/pages/RegisterAdmin.tsx` — the final registration completion page

---

## What to Build

### 1. Update `server/routes/auth.js` — registration handler

Find the POST handler that creates a new user/agency (the final registration step after OTP). Add after successful registration:

```js
// Import at top
import axios from 'axios';
import { serverTrack } from '../lib/posthog.js';

// After successful user creation, add to Brevo Trial Signups list:
if (process.env.BREVO_API_KEY && process.env.BREVO_TRIAL_LIST_ID) {
  try {
    await axios.post(
      'https://api.brevo.com/v3/contacts',
      {
        email: userEmail,
        firstName: userName || undefined,
        phone: userPhone || undefined,
        listIds: [parseInt(process.env.BREVO_TRIAL_LIST_ID)],
        attributes: {
          SIGNUP_DATE: new Date().toISOString(),
          PLAN: 'trial',
          PHONE: userPhone,
        },
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (brevoErr) {
    // Email failure must NOT fail signup — log + continue
    console.error('[Brevo] contact add failed:', brevoErr.message);
  }
}

// Fire PostHog server-side signup_completed event
await serverTrack(userId, 'signup_completed', {
  tenantId,
  role: userRole,
  utm_source: req.body.utm_source || undefined,
});
```

**Only add this block to the registration success path. Do not touch any other handler in auth.js.**

### 2. Update `real-estate-crm-app/src/pages/PhoneLogin.tsx`

On mount, capture UTM params from the URL and store in sessionStorage:

```typescript
import { useEffect } from 'react';
import { trackEvent } from '../lib/analytics';

// Inside the component, add useEffect:
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const utmCampaign = params.get('utm_campaign');
  const utmMedium = params.get('utm_medium');

  // Store for cross-domain attribution (used post-signup in identifyUser)
  if (utmSource) sessionStorage.setItem('utm_source', utmSource);
  if (utmCampaign) sessionStorage.setItem('utm_campaign', utmCampaign);
  if (utmMedium) sessionStorage.setItem('utm_medium', utmMedium);

  // Fire signup_started with UTM source
  if (utmSource) {
    trackEvent('signup_started', { utm_source: utmSource, utm_campaign: utmCampaign || undefined });
  }
}, []); // Only on mount
```

**Only add this useEffect. Do not restructure the component or change its existing logic.**

### 3. Update `real-estate-crm-app/src/pages/RegisterAdmin.tsx`

After successful agency registration (the final step of onboarding), clear the UTM sessionStorage:

```typescript
// In the success handler after registration completes:
// Also pass UTM to the server registration request body
const utm_source = sessionStorage.getItem('utm_source');

// In the API call body, add:
// body: { ...existingFields, utm_source: utm_source || undefined }

// After identifyUser is called (from App.tsx initAuth, which fires after registration):
// Clear UTM sessionStorage — attribution captured
sessionStorage.removeItem('utm_source');
sessionStorage.removeItem('utm_campaign');
sessionStorage.removeItem('utm_medium');
```

**Only add UTM pass-through to the existing registration request + sessionStorage cleanup.**

---

## What NOT to Touch

- Any other handler in `server/routes/auth.js` — only the registration success path
- `server/routes/billing.js` (PR-F)
- `server/routes/grievance.js` (PR-B)
- Any LP files
- Any components not listed above

---

## Acceptance Criteria

- [ ] New trial signup → Brevo contact added to Trial Signups list within 60s
- [ ] Brevo failure (bad key) → signup still completes; error logged only
- [ ] LP CTA with `utm_source=lp-main` → PhoneLogin.tsx reads param → stores in sessionStorage
- [ ] sessionStorage.utm_source cleared after successful registration
- [ ] PostHog `signup_completed` server event fires after registration

---

## PR Description Template

```
PR-L: Signup → Brevo wire-up + UTM cross-domain attribution

Batch 5 | Day 5
Depends on: Batch 4 merged

Files modified:
- server/routes/auth.js — Brevo contact add + PostHog signup_completed in registration handler
- real-estate-crm-app/src/pages/PhoneLogin.tsx — UTM capture on mount + signup_started event
- real-estate-crm-app/src/pages/RegisterAdmin.tsx — UTM pass-through to API + sessionStorage cleanup

Source task: ZEE-013 (week-1-foundation/day-06-landing-pages-deploy.md)
```
