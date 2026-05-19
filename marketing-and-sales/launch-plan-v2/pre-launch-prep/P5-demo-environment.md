# P5 — Demo Environment (Mumbai Seed + Reset Cron + Deploy)

> **Type:** 🤖 AUTO + 🧍 MANUAL
> **Phase:** Pre-launch
> **Day / Block:** T-7 (script + cron) → T-2 (deploy)
> **Skill(s):** `codebase-analysis`
> **Estimated time:** 1h founder · 4h AI

## Objective
Spin up `demo.realestateflow.in` — a fully populated demo tenant (20 buyers, 15 owners, 10 Mumbai properties, 8 pipeline tasks, 5 simulated AI-Employee conversation transcripts, ₹12.5Cr pipeline) that resets daily at 03:00 IST, allowing prospects to click around without needing a signup.

## Why This Matters for RealEstateFlow
Cold outreach replies that ask "can I see it first" need a 30-second click-through, not a 10-minute signup flow. A live demo tenant with realistic Mumbai broker data turns "send me a deck" into "I just clicked through, let's book a call". Daily reset prevents tester data corruption.

## User Story
As a Mumbai broker who clicked a `/demo` link from cold outreach, I want a live, populated, no-signup-required demo of the CRM, so I can decide in 60 seconds whether to book a real call.

## Acceptance Criteria
- [ ] `server/scripts/seed-demo-tenant.js` exists (idempotent — re-running drops existing demo data and re-seeds)
- [ ] Seed tenant ID = `DEMO_REALESTATEFLOW`
- [ ] 20 buyers with realistic Mumbai context (locality, budget ₹50L-₹4Cr, status mix)
- [ ] 15 owners with realistic property listings
- [ ] 10 Mumbai properties: 1 each in Andheri (W), Bandra (W), Powai, Thane, Borivali (W), Goregaon (E), Lower Parel, Worli, Juhu, Vashi
- [ ] 8 pipeline tasks across stages: New / Contacted / Site Visit Scheduled / Negotiating / Closed-Won / Closed-Lost
- [ ] 5 simulated AI-Employee → buyer WhatsApp transcripts (English, realistic broker context, 8-15 messages each)
- [ ] Dashboard metrics: ₹12.5 Cr pipeline value, 8 active deals, 3 closing this month
- [ ] No real PII (all phones `9XXXXXXXXX`, emails `demo+{N}@realestateflow.in`)
- [ ] `--reset` flag drops + re-seeds in <30 seconds
- [ ] Cron `cron/reset-demo.yaml` runs daily at 03:00 IST (UTC 21:30 prev day)
- [ ] Demo deployed at `demo.realestateflow.in` (separate Cognito user pool with sandbox login `demo@realestateflow.in` / password printed at top of dashboard)
- [ ] Read-only flag on sensitive entities (e.g., Khata settlement actions show "Read-only in demo")
- [ ] Demo tenant has banner: "🟡 DEMO TENANT — data resets at 03:00 IST daily. Do not enter real data."
- [ ] Daily reset event posts to PostHog `demo_tenant_reset` so we know it ran
- [ ] Founder verifies demo loads on slow 4G mobile in <5s

## Manual Steps (🧍)

1. **Provision a separate Cognito User Pool** for demo (so demo logins don't pollute production user table). AWS Cognito console → Create user pool `realestateflow-demo`. Copy User Pool ID + Client ID.
2. **Create demo user** `demo@realestateflow.in` with permanent password `RealEstateDemo2026!` (or rotate quarterly).
3. **Provision DynamoDB tables** mirroring production (or use same tables with `tenantId = DEMO_REALESTATEFLOW`). Confirm `extractTenantId` middleware will scope correctly.
4. **Run AI Prompt below** to produce `seed-demo-tenant.js`, `cron/reset-demo.yaml`, and a deploy script.
5. **Test the seed locally**: `node server/scripts/seed-demo-tenant.js --reset --tenant=DEMO_REALESTATEFLOW`. Verify no errors, all 20+15+10+8+5 records created.
6. **Deploy demo CloudFront + Lambda** at `demo.realestateflow.in` (subdomain of main app). Use the same SPA bundle but inject `VITE_DEMO_MODE=true` env var so the SPA shows the demo banner + read-only mode flags.
7. **Configure CloudWatch Events** (or EventBridge) cron rule `rate(1 day)` at `cron(30 21 * * ? *)` (= 03:00 IST) → triggers Lambda that runs the seed script with `--reset`.
8. **Smoke test** at `demo.realestateflow.in` from incognito + slow-4G throttle: load <5s, click into Buyers / Properties / Khata / AI Employee transcript, verify all show data. Try writing a record — succeeds (we allow writes within tenant). Logout + log back in — data persists until 03:00 IST.
9. **Smoke test reset**: at 03:01 IST, log in and confirm data is fresh (counts match seed).
10. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## AI Prompt (🤖)

```
You are a senior Node.js/TypeScript backend engineer. Your task is to write a seed script + cron config for the RealEstateFlow demo tenant.

Read for context:
- `server/routes/leads.js` (route conventions: validateToken + extractTenantId)
- `server/routes/owners.js`, `server/routes/buyers.js`, `server/routes/tenants.js`, `server/routes/properties.js`, `server/routes/khata.js` (route patterns)
- `server/crmDynamodbService.js` (the 108KB service file — find each entity's create function and infer the data shape)
- `server/tenantMiddleware.js` (tenant scoping)
- `real-estate-crm-app/src/App.tsx` (frontend routes that demo data must populate)
- `marketing-and-sales/research/icp-report-mumbai-launch.md` (realistic Mumbai broker context)
- `marketing-and-sales/research/buyer-personas-summary.md` (Priya / Arjun / Suresh personas)

Produce these 4 files:

## 1. `server/scripts/seed-demo-tenant.js`
Self-contained Node ES module. CLI: `node seed-demo-tenant.js [--reset] [--tenant=DEMO_REALESTATEFLOW]`

Behaviour:
- Connects to DynamoDB via the same client wrapper as `awsClientWrapper.js`
- If `--reset`, deletes all items where `tenantId == DEMO_REALESTATEFLOW` from every CRM table (Tenants, Owners, Buyers, Properties, Leads, B2BLeads, Khata, KhataSettlements, Calendar, Hierarchy, RentedProperties, Notifications, AIEmployeeProvisioning, NPSResponses)
- Then idempotently seeds:
  - 20 buyers: Mumbai personas (mix of Priya/Arjun/Suresh archetypes, Andheri/Bandra/Powai/Thane localities, budgets ₹50L-₹4Cr, statuses: hot/warm/cold/inactive distribution 5/8/5/2)
  - 15 owners: Mumbai locality, mix of resale + new construction, contact status mix
  - 10 properties: 1BHK to 4BHK, ₹65L to ₹4.2Cr, 1 in each of Andheri W, Bandra W, Powai, Thane W, Borivali W, Goregaon E, Lower Parel, Worli, Juhu, Vashi. Realistic carpet area, asking price, society name (placeholder Mumbai-realistic names), 3 photos placeholder URLs from picsum.photos with seed `realestateflow-demo-{id}`
  - 8 pipeline tasks across 6 stages (New=2, Contacted=2, Site Visit Scheduled=1, Negotiating=2, Closed-Won=1, Closed-Lost=0). Each task linked to a buyer + property
  - 5 Khata book entries with mix of paid/pending/disputed
  - 2 simulated team members (Hierarchy view): "Demo Owner" + "Demo Agent"
  - 5 AI-Employee → buyer simulated WhatsApp transcript JSON blobs stored in Notifications or a new DemoTranscripts table (decide based on existing schema). Transcripts are 8-15 messages each, English, realistic Mumbai broker context. Topics: 2BHK Bandra search, 3BHK Powai upgrade, investor inquiry Lower Parel, rental Goregaon, NRI from Dubai inquiring about Worli high-rise.
- All phones placeholder `9{0-9}{8-digit-counter}` so e.g., `9991000001`
- All emails `demo+buyer-{N}@realestateflow.in`
- Logs row counts at end
- Exits non-zero on any error

Add JSDoc + inline comments explaining how to extend the seed.

## 2. `cron/reset-demo.yaml`
EventBridge rule + Lambda permissions. Markdown spec the founder pastes into AWS console + corresponding `serverless.yaml` snippet if applicable. Schedule: `cron(30 21 * * ? *)` UTC (= 03:00 IST). Target: invoke a Lambda that exec's `node /var/task/server/scripts/seed-demo-tenant.js --reset`.

## 3. `server/scripts/seed-demo-tenant-deploy.md`
Step-by-step deploy guide for the founder:
- Build the seed Lambda (or run via existing API Lambda in a separate handler)
- Set CloudWatch alarm if reset fails (Lambda error count >0 in 5 min window)
- Test invocation manually before scheduling
- Verify timezone math (UTC vs IST)

## 4. `real-estate-crm-app/src/components/DemoBanner.tsx`
React component showing the yellow "🟡 DEMO TENANT — data resets at 03:00 IST daily. Do not enter real data." banner at top of all pages when `VITE_DEMO_MODE === 'true'`. Tailwind-styled, dismissable per session, but reappears on next session.

Constraints:
- No fake AWS credentials in code; all from env / IAM role
- Idempotent (running twice doesn't duplicate)
- Total seed time <30 seconds on a t3.small
- Memory <512MB
- Output a single `node-trace.json` with elapsed time + row counts
```

## Inputs
- AWS access (DynamoDB + Cognito + Lambda + EventBridge)
- DynamoDB schema knowledge (from `server/crmDynamodbService.js`)
- Mumbai persona context (from `research/`)

## Outputs
- `server/scripts/seed-demo-tenant.js`
- `server/scripts/seed-demo-tenant-deploy.md`
- `cron/reset-demo.yaml`
- `real-estate-crm-app/src/components/DemoBanner.tsx`

## Success Criterion
`demo.realestateflow.in` loads in <5s on slow 4G, shows ₹12.5Cr pipeline + populated CRM, resets clean every 03:00 IST without manual intervention for 7 consecutive days.

## Fallback / Plan B
If EventBridge cron is finicky, fall back to GitHub Actions cron (`schedule: '30 21 * * *'`) calling a webhook in the API Lambda that runs the seed. Or a simple cron'd EC2 instance.

## Risks
| Risk | Mitigation |
|---|---|
| Demo tenant data leaks into prod | Strict `tenantId == DEMO_REALESTATEFLOW` filter on every operation |
| Reset fails silently | CloudWatch alarm on Lambda error count + Slack/email ping |
| Demo Cognito user gets brute-forced | Rate-limit at API Gateway (50 req/min/IP) + rotate password quarterly |
| Demo data perceived as real (legal risk) | Banner + email/phone obviously fake (`demo+`) + footer disclaimer |
| Cost overrun | Demo runs on smallest Lambda; DynamoDB on-demand billing only — est. <₹500/mo |

## India / Mumbai-Specific Notes
- All localities are real Mumbai areas with real-ish pricing tiers from `mumbai-positioning-strategy.md`
- All transcripts use English with occasional Hinglish ("aap", "bhai", "site visit") to feel authentic
- ap-south-1 region for Lambda + DynamoDB

## Dependencies
- **Blocks:** Cold outreach (links to `demo.realestateflow.in`), `/demo` LP (links to it)
- **Depends on:** AWS access (founder), `server/crmDynamodbService.js` (already in repo)

## Connected Skills
- `codebase-analysis` — write the seed script
- `pr-review` — sanity-check before merge
