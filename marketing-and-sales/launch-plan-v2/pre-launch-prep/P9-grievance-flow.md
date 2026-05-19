# P9 — Grievance Officer Flow + /grievance Page (DPDP Compliance)

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-5
> **Skill(s):** `codebase-analysis` + `copywriting`
> **Estimated time:** 0.5h founder · 4h AI

## Objective
Build a public `/grievance` page + backend route + DynamoDB table + admin triage UI + auto-acknowledgement email so RealEstateFlow satisfies DPDP Act 2023 Grievance Officer disclosure requirements and gives users a working channel to exercise their rights (access, correction, erasure, portability).

## Why This Matters for RealEstateFlow
DPDP Act 2023 requires every Data Fiduciary to (a) appoint a Grievance Officer, (b) display contact details prominently, and (c) respond within reasonable time (we commit to 7 working days). Without this, we cannot lawfully accept payment, cannot pass enterprise due-diligence, and risk penalties.

## User Story
As a user (or third party) wanting to exercise my DPDP rights or report a grievance against RealEstateFlow's data handling, I want a public form linked from every page footer that submits in <30 seconds and emails the Grievance Officer with a tracking ID, so I have a clear path to resolution within 7 working days.

## Acceptance Criteria
- [ ] Public route `server/routes/grievance.js` accepts POST with `{name, email, phone (optional), category, description}` (rate-limited 5/IP/hour)
- [ ] DynamoDB table `Grievances`: PK `grievanceId`, sort `createdAt`, attrs: `name, email, phone, category, description, status, assignedTo, resolvedAt, resolutionNotes, internalNotes`
- [ ] Categories enum: `data_access` · `data_correction` · `data_deletion` · `data_export` · `account_security` · `billing` · `service_complaint` · `other`
- [ ] Status enum: `new` · `acknowledged` · `in_progress` · `resolved` · `escalated`
- [ ] Auto-acknowledgement email sent via Brevo within 60s of submission with: tracking ID `GR-{6-digit}`, "Response SLA 7 working days as per DPDP Act 2023", category, founder/Grievance-Officer name, link to status check (future feature, optional)
- [ ] Notification email to `info@realestateflow.in` (Grievance Officer mailbox) on every new submission
- [ ] Public page `real-estate-crm-app/src/pages/Grievance.tsx` (also rendered as static HTML at `creative/landing-pages/main/legal/grievance/index.html` for LP footer link) with: form, category dropdown, expected SLA, GO contact block, link back to Privacy Policy
- [ ] Admin view `real-estate-crm-app/src/pages/admin/GrievanceList.tsx` (founder-only role gate): table of all grievances, filters (status, category, date), detail drawer, status update dropdown, internal notes textarea, "Send response" button (drafts email via Brevo with templated reply)
- [ ] LP footer of all 5 LPs + CRM SPA footer shows: "Grievance Officer: {{NAME}} — info@realestateflow.in — Response SLA 7 working days" linking to `/grievance`
- [ ] Privacy Policy footer links to `/grievance` (P1 dependency)
- [ ] `Schema.org ContactPoint` JSON-LD added to homepage `<head>` (P16)
- [ ] Spam protection: hCaptcha or Cloudflare Turnstile widget (free tier) on form; honeypot field
- [ ] Submission triggers PostHog event `grievance_received` (server-side) for funnel monitoring
- [ ] Playwright test `tests/grievance.spec.ts` validates form submission → 200 + tracking ID + email landing in test inbox

## AI Prompt (🤖)

```
You are a senior full-stack engineer (Node/Express + React/TypeScript). Read these inputs to learn conventions:
- `server/routes/leads.js` (route pattern: validateToken + extractTenantId)
- `server/tenantMiddleware.js` (tenant scoping)
- `server/crmDynamodbService.js` (DynamoDB service patterns — note: Grievances table is PUBLIC, no tenantId)
- `server/server.js` (where to mount the new route)
- `server/awsClientWrapper.js` (DDB client)
- `real-estate-crm-app/src/App.tsx` (existing routes — add /grievance public route + /admin/grievances private route)
- `real-estate-crm-app/src/pages/PhoneLogin.tsx` (auth conventions)
- `marketing-and-sales/launch-plan-v2/pricing.json` (no direct dependency, but check brand)
- `marketing-and-sales/creative/landing-pages/main/index.html` (footer convention to extend)

Produce these files:

## 1. `server/grievanceDynamodbService.js` — new service module
Mirrors patterns in `crmDynamodbService.js` but for the public `Grievances` table:
- `createGrievance({name, email, phone, category, description, ip, userAgent})` → returns `{grievanceId, createdAt}`
- `getGrievanceById(grievanceId)`
- `listGrievances({status?, category?, fromDate?, toDate?, limit, offset})` (admin only)
- `updateGrievance(grievanceId, {status, assignedTo, resolutionNotes, internalNotes, resolvedAt})`
- Use ULID or UUIDv7 for grievanceId; cosmetic `GR-{first-6-chars}` for user-facing tracking ID
- Auto-set createdAt = ISO timestamp, status = 'new'

## 2. `server/routes/grievance.js` — Express route
- POST `/api/grievance` (PUBLIC — no validateToken, no tenantId)
  - Rate-limit 5/IP/hour via `express-rate-limit` (add to `server/server.js` deps if not present)
  - Validate body: name 1-100 chars, email valid format, phone optional 10-digit Indian, category in enum, description 10-2000 chars
  - hCaptcha verify (server-side `siteverify`)
  - Honeypot: reject if `body.middle_name` is filled
  - Create record
  - Send acknowledgement email via Brevo (template ID env-driven)
  - Send notification email to `info@realestateflow.in`
  - Capture PostHog event `grievance_received` server-side
  - Return `{ trackingId: 'GR-XXXXXX', message: 'Received. Expect a response within 7 working days.' }`
- GET `/api/admin/grievances` (PRIVATE — validateToken + role check `role === 'founder'` or `role === 'admin'`)
  - Pagination, filters as listGrievances
- PATCH `/api/admin/grievances/:id` (PRIVATE — same gate)

Mount in `server.js`: `app.use('/api', grievanceRoutes)`.

## 3. `real-estate-crm-app/src/pages/Grievance.tsx` — public React page
- Tailwind, mobile-first, follows brand kit (#22C55E + #0F3A66)
- Form with: name, email, phone (optional), category dropdown (with descriptions), description textarea (with char counter), hCaptcha widget, submit button
- Honeypot hidden field `middle_name` (CSS hidden + tabindex=-1)
- On submit: POST to `/api/grievance`; show tracking ID + acknowledgement message + close-window CTA
- Sidebar: GO name, postal address, email, SLA, link to Privacy Policy
- Footer: link back to homepage, links to /legal/{terms,privacy,refund,cookies}

## 4. `real-estate-crm-app/src/pages/admin/GrievanceList.tsx` — admin React page
- Route `/admin/grievances`, gated by `role === 'founder' || role === 'admin'` (refer to `App.tsx initAuth` for role pattern)
- Table: tracking ID, date, name, email, category, status badge, assigned-to, action buttons
- Filters: status, category, date range, free-text search on email/description
- Detail drawer (right side, slide-in): full grievance, internal notes, resolution notes, status dropdown, assigned-to picker (founders/admins), "Send response" button → opens templated Brevo email composer (see template below)
- Status badges colored: new=red, acknowledged=yellow, in_progress=blue, resolved=green, escalated=red-bordered

## 5. `real-estate-crm-app/src/pages/admin/GrievanceList.tsx` — response templates
Three Brevo templates (saved in Brevo dashboard, IDs hardcoded in code):
- `grievance_acknowledgement` — sent automatically on creation
- `grievance_resolved` — sent on status=resolved with resolutionNotes
- `grievance_escalated` — sent if SLA missed (>7 working days)

## 6. `infra/dynamodb/Grievances.tf` (or CloudFormation YAML or just markdown spec depending on infra style — check `server/infra/` for existing patterns)
Table definition:
- PK: `grievanceId` (string)
- Sort: `createdAt` (string ISO)
- GSI: `status-createdAt-index` for admin filtering
- GSI: `email-createdAt-index` for user dedup checks
- BillingMode: PAY_PER_REQUEST
- PointInTimeRecovery: enabled
- StreamSpecification: NEW_IMAGE (for future analytics pipeline)

## 7. `tests/grievance.spec.ts` — Playwright
- Visit /grievance, fill form, submit, assert tracking ID in response, assert page shows acknowledgement
- Hit `/api/grievance` 6 times in 1h from same IP, assert 6th call returns 429
- Honeypot test: fill middle_name, assert 400

## 8. `marketing-and-sales/launch-implement/pre-launch/09-grievance/grievance-handling-sop.md`
Internal SOP for founder/admin to triage:
- New grievance arrives → acknowledged automatically (60s)
- Triage within 24h: assign category if mis-tagged, set status to in_progress, contact submitter via email if more info needed
- Resolve within 7 working days: update resolutionNotes, set status=resolved, send resolved-email
- Escalate to legal if: data-deletion request involves audit trail, regulator complaint, suspected data breach
- Append all decisions to `00-DECISIONS-LOG.md`

## 9. Update LP footer + CRM SPA footer
Update `creative/landing-pages/main/index.html` footer (and the other 4 LPs in P15) + `real-estate-crm-app/src/components/Footer.tsx` (or wherever footer lives) to include the GO disclosure block.

Stop here. Do not deploy. Do not run hCaptcha signup (founder does manually).
```

## Manual Steps (🧍 — run after AI Prompt completes)

1. **Sign up for hCaptcha** at `https://www.hcaptcha.com/` (free tier — 100k verifications/month). Get sitekey + secret.
2. **Add env vars** to `server/.env` and Lambda config: `HCAPTCHA_SECRET`, `BREVO_API_KEY`, `BREVO_GRIEVANCE_ACK_TEMPLATE_ID`, `BREVO_GRIEVANCE_NOTIFY_TEMPLATE_ID`.
3. **Create Brevo templates** — log into Brevo, Templates → Create New, paste the 3 templates from prompt output. Copy template IDs into env vars above.
4. **Create DynamoDB `Grievances` table** via CloudFormation/Terraform from `infra/dynamodb/Grievances.tf` OR manually via AWS console. Verify GSI active.
5. **Deploy server changes** + SPA build. Verify `/grievance` URL returns 200 and form works in test mode.
6. **Verify role gate** on `/admin/grievances` — log in as non-admin user, confirm 403; log in as founder, confirm 200.
7. **End-to-end test**: submit grievance from incognito → tracking ID returned → email lands in `info@` mailbox + acknowledgement email lands in test customer inbox → grievance shows up in `/admin/grievances` with status=new.
8. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## Inputs
- Server route conventions
- DynamoDB schema conventions
- React Router + role gate patterns from `App.tsx`
- hCaptcha account
- Brevo account + API key
- Founder name + postal address (for GO block)

## Outputs
- `server/routes/grievance.js`
- `server/grievanceDynamodbService.js`
- `real-estate-crm-app/src/pages/Grievance.tsx`
- `real-estate-crm-app/src/pages/admin/GrievanceList.tsx`
- `infra/dynamodb/Grievances.tf` (or equivalent)
- `tests/grievance.spec.ts`
- `marketing-and-sales/launch-implement/pre-launch/09-grievance/grievance-handling-sop.md`
- Updated footers in 5 LPs + CRM SPA

## Success Criterion
End-to-end test: anonymous form submission returns tracking ID, lands in DDB + email + admin UI within 60 seconds. SOP doc exists for founder.

## Fallback / Plan B
If hCaptcha integration fails, swap to Cloudflare Turnstile (also free, easier UX). If Brevo template send fails, fall back to plain SES with a hardcoded HTML template.

## Risks
| Risk | Mitigation |
|---|---|
| Spam submissions overwhelm `info@` | hCaptcha + rate limit + honeypot + email-domain blocklist |
| Founder misses 7-day SLA | Automated escalation email at Day 5 + Slack/WhatsApp ping |
| Cross-tenant leak (this is public, not tenant-scoped) | Public table is by design; admin route role-gated |
| GDPR-style "delete my account" via grievance | Documented in SOP — execute via existing admin tools, log in resolutionNotes |
| Submitter forgets tracking ID | Acknowledgement email contains it; status check page (future) optional |

## India / Mumbai-Specific Notes
- **DPDP Act 2023:** GO contact must be displayed prominently — covered by footer disclosure
- **7-day SLA** is RealEstateFlow's voluntary commitment; DPDP says "reasonable time"
- **Postal address** for GO is mandatory — registered office (Mumbai) suffices
- **Mumbai jurisdiction** — referenced in Privacy Policy + ToS

## Dependencies
- **Blocks:** P1 Privacy Policy footer link, all 5 LPs deployment, Razorpay live (compliance posture)
- **Depends on:** Brevo account active (P3), hCaptcha account (manual signup), Founder name + address (manual input)

## Connected Skills
- `codebase-analysis` — server route + DDB service
- `copywriting` — form copy + email templates + SOP
- `pr-review` — review the PR before merge
- `analytics-tracking` — `grievance_received` event spec
