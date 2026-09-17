# Analytics Setup Checklist — RealEstateFlow

**Architecture:** LP = PostHog + GA4 + Meta + LinkedIn + Hotjar · CRM = PostHog only · Server = PostHog + Sentry  
**Last updated:** 2026-06-11

---

## 1. PostHog (LP + CRM + Server)

- [ ] Create project at [posthog.com](https://posthog.com) — name: RealEstateFlow
- [ ] Select **EU region** (document in Privacy Policy)
- [ ] Copy project API key → `phc_XXXXX`
- [ ] **LP env** (`creative/landing-pages/.env`): `POSTHOG_KEY=phc_XXXXX`
- [ ] **CRM env** (`agency-app/web/.env`): `VITE_POSTHOG_KEY=phc_XXXXX`, `VITE_POSTHOG_HOST=https://eu.i.posthog.com`
- [ ] **Lambda env:** `POSTHOG_KEY_SERVER=phc_XXXXX`
- [ ] Enable session replay; mask sensitive inputs
- [ ] Create dashboard per `posthog-dashboard.md`
- [ ] Save Mumbai launch funnel (8 steps)

---

## 2. Google Analytics 4 (LP only)

- [ ] Create GA4 property: RealEstateFlow Marketing
- [ ] Copy Measurement ID → `G-XXXXXXXXXX`
- [ ] **LP env only:** `GA4_ID=G-XXXXXXXXXX`
- [ ] Configure conversions: `sign_up`, `generate_lead`, `purchase`
- [ ] Link to Google Ads (if running ads)
- [ ] **Verify:** GA4 script NOT in `app.realestateflow.in` source

---

## 3. Meta Pixel (LP only)

- [ ] Create Pixel in Meta Events Manager
- [ ] Copy Pixel ID → `1234567890`
- [ ] **LP env only:** `META_PIXEL_ID=1234567890`
- [ ] Configure events: `Lead`, `Subscribe`, `Purchase`
- [ ] Verify domain realestateflow.in in Business Manager
- [ ] **Verify:** No `fbq()` in CRM SPA

---

## 4. LinkedIn Insight Tag (LP only)

- [ ] Create Insight Tag in Campaign Manager
- [ ] Copy Partner ID → `XXXX`
- [ ] **LP env only:** `LINKEDIN_PARTNER_ID=XXXX`
- [ ] Configure conversions: `signup_completed`, `subscription_started`
- [ ] **Verify:** No LinkedIn tag in CRM SPA

---

## 5. Hotjar (LP only)

- [ ] Create project at hotjar.com
- [ ] Copy Site ID + SV → `HOTJAR_ID=XXXXXXX`, `HOTJAR_SV=6`
- [ ] **LP env only**
- [ ] Gate behind **functional** cookie consent
- [ ] **Verify:** No Hotjar in CRM SPA

---

## 6. Sentry (CRM + Server only)

- [ ] Create project: `realestateflow-spa` (React)
- [ ] Create project: `realestateflow-server` (Node/Lambda)
- [ ] Copy DSNs
- [ ] **CRM env:** `VITE_SENTRY_DSN=https://...@sentry.io/...`
- [ ] **Lambda env:** `SENTRY_DSN_SERVER=https://...@sentry.io/...`
- [ ] Set sample rate: errors 100%, transactions 10%
- [ ] **Verify:** No Sentry on static LPs

---

## 7. Cookie Consent Integration

- [ ] LP banner deployed (`cookie-banner.html`)
- [ ] CRM banner deployed (`CookieConsentBanner.tsx`)
- [ ] `localStorage.cookieConsent` shared schema
- [ ] Reject → no GA4/Pixel/LinkedIn/Hotjar network calls on LP
- [ ] Reject → PostHog `disable_session_recording: true`
- [ ] Run `tests/cookie-consent.spec.ts` — green

---

## 8. LP Build & Deploy

- [ ] Copy `.env.example` → `.env` with all IDs
- [ ] Run `npm run build:lps`
- [ ] Inspect built HTML — IDs injected, no `{{PLACEHOLDER}}`
- [ ] Deploy to Netlify
- [ ] Visit `/` incognito → accept cookies → verify PostHog + GA4 in network tab
- [ ] Visit `/` incognito → reject → verify only PostHog restricted mode

---

## 9. CRM Deploy

- [ ] `analytics.ts` initialised in `main.tsx`
- [ ] `posthog.identify()` in `App.tsx` post-login
- [ ] UTM capture in signup flow (`sessionStorage`)
- [ ] All CRM events from catalogue fire (spot-check 5 events)
- [ ] **Verify:** Network tab shows PostHog only — no GA4/Pixel/LinkedIn

---

## 10. Server Events

- [ ] `agency-app/api/lib/posthog.js` wired in lambda-handler
- [ ] Billing webhook fires: `razorpay_payment_succeeded`, `subscription_paid`, `seat_added`
- [ ] Grievance route fires: `grievance_received`
- [ ] AI Employee SOP fires: `ai_employee_provisioned`

---

## 11. Cross-Domain Attribution Test

Single test session:

1. Visit `realestateflow.in/?utm_source=lp-main&utm_campaign=launch`
2. Click primary CTA → land on `app.realestateflow.in/signup?utm_...`
3. Complete signup
4. PostHog Live Events → confirm same user stitched: `page_view` → `signup_completed`
5. `identify` traits include `utm_source=lp-main`

---

## 12. Playwright Verification

- [ ] Run `tests/analytics.spec.ts`
- [ ] LP: accept → all trackers load
- [ ] LP: reject → restricted PostHog only
- [ ] CRM: signup → PostHog events, no ad trackers
- [ ] Log results to `00-DECISIONS-LOG.md`

---

## Env Var Summary

| Variable | LP | CRM | Lambda |
|----------|----|----|--------|
| `POSTHOG_KEY` / `VITE_POSTHOG_KEY` | ✅ | ✅ | ✅ |
| `GA4_ID` | ✅ | ❌ | ❌ |
| `META_PIXEL_ID` | ✅ | ❌ | ❌ |
| `LINKEDIN_PARTNER_ID` | ✅ | ❌ | ❌ |
| `HOTJAR_ID` | ✅ | ❌ | ❌ |
| `VITE_SENTRY_DSN` | ❌ | ✅ | ❌ |
| `SENTRY_DSN_SERVER` | ❌ | ❌ | ✅ |

---

## Sign-Off

| Check | Date | Pass? |
|-------|------|-------|
| PostHog funnel live (8 steps) | | ☐ |
| Cookie consent gates trackers | | ☐ |
| Cross-domain stitch verified | | ☐ |
| Playwright green | | ☐ |
