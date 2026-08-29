# 05 — Deployment & Pre-launch Verification

> **Scope:** The actual ship — build + push LP, CRM, demo, and the API Lambda, then smoke-test prod. All run **after** the vendor accounts exist (`02`) and env vars are filled (`01` INFRA-07). The application code is merged in PR #24; this file is pure deploy/ops.
> **Owner files to read:** `team-work/ZEESHAN-tasks.md` (`ZEE-013`, build/deploy support) and `team-work/FOUNDER-tasks.md` (`FND-002/007`, AWS).
>
> **Already done — no action needed (removed from this list):**
> - DEPLOY-01 tagged route-injection blocks — present + verified in `server/server.js` and `real-estate-crm-app/src/App.tsx`.
> - LP analytics/consent partials + Netlify CSP + homepage SEO/AEO — shipped in PR #24 (`npm run build:lps` verifies 14/14 pages carry PostHog/GA4/consent).

---

## DEPLOY-02: Fill LP `.env` Before Build
**Why:** The LP build injects analytics IDs + founder details at compile time; a missing value produces broken pages or dead CTAs.
**Priority:** Critical (P0) · **Read:** `team-work/ZEESHAN-tasks.md` → `ZEE-013`

**Steps** — copy `creative/landing-pages/.env.example` → `.env` and fill:
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
Then resolve any remaining `{{PLACEHOLDER}}` tokens in the LP HTML.

---

## DEPLOY-03: Build + Deploy LP to Netlify
**Why:** Ships the marketing site (`realestateflow.in`) — the top of the funnel every other task feeds.
**Priority:** Critical (P0) · **Read:** `team-work/ZEESHAN-tasks.md` → `ZEE-013`

**Steps**
```bash
cd marketing-and-sales/creative/landing-pages/build && npm ci && npm run build:lps
grep -r "XXXX\|YOUR_\|hello@\|9999999999" ../dist/   # must return nothing
netlify deploy --prod --dir=../dist
```
Then: add custom domain `realestateflow.in` (+ `www`) in Netlify → point the Cloudflare CNAME at the Netlify URL → wait for HTTPS (~15 min) → confirm all 12 URLs return 200.

---

## DEPLOY-04: Lighthouse + OG/Schema Verification (12 LPs)
**Why:** Mobile Lighthouse ≥ 90 and valid OG/schema are required before paid traffic — slow or unpreviewable pages tank ad quality scores and CTR.
**Priority:** High (P1) · **Read:** `team-work/ZEESHAN-tasks.md` → `ZEE-013`

**Steps**
1. Run PageSpeed Insights (or `npm run lighthouse:all`) on each of the 12 URLs; fix anything < 90 (usually image opt, unused CSS, LCP preload).
2. Verify OG previews at opengraph.xyz and schema at validator.schema.org for each page.

---

## DEPLOY-05: Build + Deploy CRM SPA to Netlify
**Why:** Ships `app.realestateflow.in` — the product itself; every LP CTA redirects here to sign up/log in.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-002`

**Steps**
1. `cd real-estate-crm-app && npm run build` → deploy to its **own** Netlify site.
2. Set CRM env in Netlify: `VITE_POSTHOG_KEY`, `VITE_SENTRY_DSN`, `VITE_RAZORPAY_KEY_ID`, `VITE_HCAPTCHA_SITE_KEY`, `VITE_IS_DEMO=false`, `VITE_API_URL=https://api.realestateflow.in`.
3. Custom domain `app.realestateflow.in` (Cloudflare CNAME) → verify login on the prod domain.

---

## DEPLOY-06: Deploy Demo SPA
**Why:** `demo.realestateflow.in` is the no-signup sandbox cold outreach links to; needs the demo Cognito pool (INFRA-02) + seed data.
**Priority:** High (P1) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-007`

**Steps**
1. Build the CRM with `VITE_IS_DEMO=true` + the `DEMO_*` pool vars → deploy to a separate Netlify site.
2. Seed once: `node server/scripts/seed-demo-tenant.js --reset`.
3. Smoke test: log in as `demo@realestateflow.in` → confirm populated data + the Demo banner.

---

## DEPLOY-07: Deploy API Lambda + Set Server Env
**Why:** The backend every app calls; without the server secrets the routes run but integrations no-op.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-002`

**Steps**
1. Deploy the server bundle to Lambda in `ap-south-1` (`server/DEPLOYMENT-GUIDE.md`).
2. Set all server secrets (Razorpay, Brevo, AiSensy, hCaptcha, PostHog, Sentry).
3. Smoke: `curl https://api.realestateflow.in/api/health` → 200.

---

## DEPLOY-08: Submit Sitemap to Search Engines
**Why:** Kicks off organic indexing the day the LPs go live — compounding SEO from Day 6.
**Priority:** Medium (P2) · **Read:** `team-work/MADHU-tasks.md` → `MAD-007`

**Steps** — submit `realestateflow.in/sitemap.xml` to Google Search Console, Bing Webmaster, Brave; add ahrefs Webmaster Tools for a backlink baseline; request indexing for the top 5 pages.

---

## DEPLOY-09: Full Pre-launch Smoke Test (T-1)
**Why:** Final go/no-go gate that proves the whole stack (DNS → API → DDB → analytics → email → Sentry) works end-to-end before customers arrive.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-002`

**Checklist**
```bash
aws sts get-caller-identity                                   # founder ARN
aws dynamodb describe-table --table-name Grievances           # ACTIVE
dig realestateflow.in                                         # resolves via Cloudflare
curl https://api.realestateflow.in/api/health                 # 200
```
- `realestateflow.in` (incognito) → loads → cookie banner → form submits → analytics fires.
- `app.realestateflow.in` → login → PostHog Live Events shows `signup_started`.
- Grievance form → tracking ID returned + email lands in `info@realestateflow.in`.
- Sentry test event → appears in dashboard.
