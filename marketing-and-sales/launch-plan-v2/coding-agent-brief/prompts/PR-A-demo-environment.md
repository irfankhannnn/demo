# Agent Prompt — PR-A: Demo Environment

**Branch to create:** `cursor/pr-1a-demo-environment-8e67`
**Base branch:** `main`
**Batch:** 1 (Day 1) — runs in parallel with PR-B, PR-C, PR-D

---

## MANDATORY: Read First

Before writing a single line of code, read these files in full:
1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md`
2. `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md`
3. `server/crmDynamodbService.js` (lines 1-100 for DDB patterns)
4. `server/awsClientWrapper.js`
5. `server/tenantMiddleware.js`
6. `real-estate-crm-app/src/App.tsx` (lines 1-50 and 175-270 for route patterns)
7. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P5-demo-environment.md`
8. `marketing-and-sales/research/icp-report-mumbai-launch.md` (for Mumbai-realistic data)

---

## What to Build

### 1. `server/scripts/seed-demo-tenant.js`

Self-contained Node ES module. CLI: `node seed-demo-tenant.js [--reset] [--tenant=DEMO_REALESTATEFLOW]`

- Reads `DEMO_TENANT_ID` from `process.env.DEMO_TENANT_ID || 'DEMO_REALESTATEFLOW'`
- Uses `awsClientWrapper.js` for DDB — NEVER import DDB client directly
- If `--reset` flag: deletes all items where `tenantId == DEMO_TENANT_ID` from every CRM table
- Then seeds:
  - **20 buyers**: Andheri/Bandra/Powai/Thane/Borivali localities, budgets ₹50L-₹4Cr, statuses 5 hot/8 warm/5 cold/2 inactive, all phones `99X0000001-20`, emails `demo+buyer-N@realestateflow.in`
  - **15 owners**: Mumbai localities, mix resale + new construction
  - **10 properties**: 1BHK–4BHK, ₹65L–₹4.2Cr, 1 each in Andheri W, Bandra W, Powai, Thane W, Borivali W, Goregaon E, Lower Parel, Worli, Juhu, Vashi. All image URLs from `https://picsum.photos/seed/ref-{id}/400/300`
  - **8 pipeline leads**: stages: New×2, Contacted×2, Site Visit×1, Negotiating×2, Closed-Won×1 — each linked to a buyer + property
  - **5 Khata entries**: mix of paid/pending, amounts ₹25k–₹2.5L
  - **2 team members**: Hierarchy — "Demo Owner" + "Demo Agent"
  - **5 AI transcript blobs**: stored in Notifications table with `type: 'ai_transcript'`, realistic WhatsApp-style convos (8-15 messages each, English, Mumbai broker context). Topics: 2BHK Bandra search, 3BHK Powai upgrade, investor Lower Parel, rental Goregaon, NRI Dubai→Worli
- Idempotent: running twice doesn't duplicate
- Logs row counts at end
- Exits non-zero on any error
- Has JSDoc explaining how to extend

### 2. `server/scripts/reset-demo-tenant.js`

Thin wrapper: calls `--reset` on seed-demo-tenant.js. Designed to be invoked by Lambda cron.

### 3. `cron/reset-demo.yaml`

EventBridge rule + Lambda permissions spec:
```yaml
# Schedule: cron(30 20 * * ? *) UTC = 2:00 AM IST daily
# Target Lambda: invokes reset-demo-tenant.js --reset
# Timeout: 60 seconds
# Memory: 256MB
```

Include the matching `serverless.yaml` snippet format. Document IST timezone math.

### 4. `real-estate-crm-app/src/components/DemoBanner.tsx`

React component:
- Reads `import.meta.env.VITE_IS_DEMO` — returns null if not 'true'
- Yellow sticky banner: `🟡 DEMO TENANT — data resets daily at 2:00 AM IST. Do not enter real data.`
- Dismissable per session (sessionStorage flag), but reappears on new session
- Tailwind: yellow-100 bg, yellow-800 text, dismissable X button
- Accessible: `role="alert"`, keyboard accessible dismiss

---

## Where to Mount DemoBanner in App.tsx

Find the `{/* === [LAUNCH LAYOUT COMPONENTS] === */}` block in `real-estate-crm-app/src/App.tsx`.

Add exactly this inside that block:
```tsx
{/* PR-A */}
<DemoBanner />
```

Also add the import at the top of App.tsx:
```tsx
import DemoBanner from './components/DemoBanner';
```

**Only add these 2 lines. Do not touch anything else in App.tsx.**

---

## What NOT to Touch

- `server/server.js` — no route mounts needed (seed script is CLI-only)
- Any existing route files
- Any LP files
- Any other component files

---

## Acceptance Tests (manual verification)

1. `node server/scripts/seed-demo-tenant.js --tenant=DEMO_TEST` → no errors, logs row counts
2. `node server/scripts/seed-demo-tenant.js --reset --tenant=DEMO_TEST` → deletes + re-seeds, counts same
3. DemoBanner renders with `VITE_IS_DEMO=true` + hides with `VITE_IS_DEMO=false`
4. DemoBanner dismisses when X clicked; does NOT reappear on same-tab page navigation; DOES reappear after tab close + reopen

---

## PR Description Template

```
PR-A: Demo environment — seed script + cron + DemoBanner

Batch 1 | Day 1 | Parallel with PR-B, PR-C, PR-D

Files created:
- server/scripts/seed-demo-tenant.js — 20 buyers, 15 owners, 10 properties, 8 leads, 5 AI transcripts
- server/scripts/reset-demo-tenant.js — cron wrapper
- cron/reset-demo.yaml — EventBridge cron spec (2 AM IST daily)
- real-estate-crm-app/src/components/DemoBanner.tsx — VITE_IS_DEMO=true banner

Files modified:
- real-estate-crm-app/src/App.tsx — added DemoBanner to LAUNCH LAYOUT COMPONENTS block

Source task: ZEE-001 (pre-launch-prep/P5-demo-environment.md)
```
