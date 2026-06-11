# 05 — Deployment & Pre-launch Verification

All deployment tasks run after the corresponding coding PRs are merged and env vars are populated.

---

## DEPLOY-01: Add Tagged Extension Blocks to Shared Files (Pre-coding Setup)
**Priority:** Critical — Must happen before ANY coding agent starts (see `03-ANTI-CONFLICT-RULES.md`)
**Status:** [x] Completed — 2026-06-11 (pre-existing; verified)

Tagged blocks confirmed in `server/server.js` (`LAUNCH ROUTES IMPORTS` / `MOUNTS`) and `real-estate-crm-app/src/App.tsx` (`LAUNCH PUBLIC/PROTECTED ROUTES`, `LAUNCH LAYOUT COMPONENTS`).

**PR Reference:** `cursor/pending-tasks-consolidation-492f`

Add two tagged comment blocks to `server/server.js`:
```javascript
// === [LAUNCH ROUTES IMPORTS] ===
// === [/LAUNCH ROUTES IMPORTS] ===
```
And:
```javascript
// === [LAUNCH ROUTES MOUNTS] ===
// === [/LAUNCH ROUTES MOUNTS] ===
```

Add three tagged comment blocks inside `<Routes>` in `real-estate-crm-app/src/App.tsx`:
```tsx
{/* === [LAUNCH PUBLIC ROUTES] === */}{/* === [/LAUNCH PUBLIC ROUTES] === */}
{/* === [LAUNCH PROTECTED ROUTES] === */}{/* === [/LAUNCH PROTECTED ROUTES] === */}
{/* === [LAUNCH LAYOUT COMPONENTS] === */}{/* === [/LAUNCH LAYOUT COMPONENTS] === */}
```

**References:** `coding-agent-brief/00-MASTER-BRIEF.md §11-12` · `coding-agent-brief/03-ANTI-CONFLICT-RULES.md §Rule 1`

---

## DEPLOY-02: Fill LP Placeholder Values Before Build
**Priority:** Critical — Build fails or produces broken LPs without these

Create `creative/landing-pages/.env` (from `.env.example`) and fill:
```
POSTHOG_KEY=phc_...
GA4_ID=G-...
META_PIXEL_ID=...
LINKEDIN_PARTNER_ID=...
HOTJAR_ID=...
FOUNDER_HANDLE=your-cal-handle
WHATSAPP_NUMBER=919XXXXXXXXX
FOUNDER_NAME=...
COMPANY_LEGAL_NAME=...
GSTIN=...
CIN=...
```

Also update any remaining `{{PLACEHOLDER}}` tokens in LP HTML files (PR-I agents leave documented stubs).

**References:** `coding-agent-brief/prompts/PR-I-landing-pages.md` AC §4 · `pre-launch-prep/P15-landing-pages-rewrite.md` Manual Steps §1

---

## DEPLOY-03: Run LP Build + Deploy to Netlify
**Priority:** Critical — Required before Day 6

- `cd creative/landing-pages/build && npm install && npm run build:lps`
- Verify no placeholder strings in `dist/`: `grep -r "XXXX\|YOUR_\|hello@\|9999999999" dist/`
- Deploy: `netlify deploy --prod --dir=creative/landing-pages/dist`
- In Netlify dashboard: add custom domain `realestateflow.in` + `www.realestateflow.in`
- Update Cloudflare CNAME to point to Netlify site URL
- Wait for HTTPS cert (~15 min)
- Verify all 12 URLs return 200

**References:** `team-work/ZEESHAN-tasks.md` ZEE-013-T2/T3 · `week-1-foundation/day-06-landing-pages-deploy.md` Manual Steps §1-6

---

## DEPLOY-04: Run Lighthouse + OG Verification on All 12 LPs
**Priority:** High — Lighthouse mobile ≥90 required before public launch

- Run PageSpeed Insights (or `npm run lighthouse:all`) on each of the 12 LP URLs
- Fix any category below 90 (usually: image optimization, unused CSS, LCP preload)
- Verify OG previews at opengraph.xyz for each URL
- Verify schema validation at validator.schema.org for each page

**References:** `pre-launch-prep/P15-landing-pages-rewrite.md` AC · `pre-launch-prep/P16-seo-aeo-master.md` AC

---

## DEPLOY-05: Deploy CRM SPA to Netlify
**Priority:** Critical

- `cd real-estate-crm-app && npm run build`
- Deploy to Netlify: separate site for `app.realestateflow.in`
- Set all CRM env vars in Netlify site settings: `VITE_POSTHOG_KEY`, `VITE_SENTRY_DSN`, `VITE_RAZORPAY_KEY_ID`, `VITE_HCAPTCHA_SITE_KEY`, `VITE_IS_DEMO=false`, `VITE_API_URL=https://api.realestateflow.in`
- Custom domain `app.realestateflow.in` → update Cloudflare CNAME
- Verify login flow works on production domain

**References:** `real-estate-crm-app/netlify.toml` · `coding-agent-brief/00-MASTER-BRIEF.md §9`

---

## DEPLOY-06: Deploy Demo SPA
**Priority:** High — Required before cold outreach links to demo.realestateflow.in

- Build CRM SPA with `VITE_IS_DEMO=true` + demo Cognito pool env vars
- Deploy to separate Netlify site; custom domain `demo.realestateflow.in`
- Run seed script once: `node server/scripts/seed-demo-tenant.js --reset`
- Smoke test: login with `demo@realestateflow.in`, confirm populated data + DemoBanner visible

**References:** `team-work/FOUNDER-tasks.md` FND-007-T5/T6 · PR-A output

---

## DEPLOY-07: Deploy API Lambda + Update Function Configuration
**Priority:** Critical

- Deploy server bundle to Lambda in `ap-south-1`
- Update Lambda env vars with all server secrets (Razorpay, Brevo, AiSensy, hCaptcha, PostHog, Sentry)
- Smoke test: `curl https://api.realestateflow.in/api/health` → 200

**References:** `server/DEPLOYMENT-GUIDE.md` · `coding-agent-brief/00-MASTER-BRIEF.md §9`

---

## DEPLOY-08: Submit Sitemap to Search Engines
**Priority:** Medium — SEO foundation; do on Day 6 after LPs live

- Google Search Console: verify `realestateflow.in` property → submit `realestateflow.in/sitemap.xml` → request indexing for top 5 pages
- Bing Webmaster Tools: same
- Brave Search Webmaster: same
- ahrefs Webmaster Tools (free): add for backlink monitoring baseline

**References:** `team-work/MADHU-tasks.md` MAD-007-T5/T6 · `pre-launch-prep/P16-seo-aeo-master.md` Manual Steps §5-6

---

## DEPLOY-09: Full Pre-launch Smoke Test (T-1)
**Priority:** Critical

- `aws sts get-caller-identity` → returns founder ARN
- `aws dynamodb describe-table --table-name Grievances` → ACTIVE
- `dig realestateflow.in` → resolves via Cloudflare
- `curl https://api.realestateflow.in/api/health` → 200
- Visit `realestateflow.in` incognito → loads → cookie banner → form submits → analytics fires
- Visit `app.realestateflow.in` → login → PostHog Live Events shows `signup_started`
- Grievance form submit → tracking ID returned + email lands in `info@realestateflow.in`
- Sentry test event → appears in dashboard

**References:** `pre-launch-prep/P18-cloud-infra-checklist.md` Track F · `team-work/FOUNDER-tasks.md` FND-002-T11
