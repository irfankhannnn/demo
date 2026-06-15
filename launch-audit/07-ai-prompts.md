# 07 — Ready-to-run AI Prompts (per task)

Copy any block below into a fresh Devin/Claude session. Each prompt is self-contained: it names the **files/folders to load** as context and the **acceptance criteria**. Repo: `cloudberrysolutions/nabi-app-git-bkp`, base branch `auth_rbac_feature`.

---

## PROMPT 1 — Finalise legal pages (fill company details + apply lawyer edits)

```
Repo: cloudberrysolutions/nabi-app-git-bkp (branch auth_rbac_feature)

Context to load:
- marketing-and-sales/creative/landing-pages/legal/{terms,privacy,refund,cookies}/index.html  (rendered pages)
- marketing-and-sales/launch-implement/pre-launch/01-legal/{tos,privacy,refund,cookies,dpa-template}.md  (source drafts)
- marketing-and-sales/launch-implement/pre-launch/01-legal/_lawyer-handoff.md  (placeholder list + review checklist)
- marketing-and-sales/launch-plan-v2/pending-tasks/03-legal-and-compliance.md
- marketing-and-sales/creative/landing-pages/build/  (Vite + partials build)

Task:
1. Replace every bracketed placeholder in the 4 legal HTML pages and the source .md drafts with the real values:
   COMPANY_LEGAL_NAME, COMPANY_CIN, COMPANY_GSTIN, registered office address, Grievance Officer name, EFFECTIVE_DATE.
   (Get these values from the founder — do not invent them.)
2. Apply the lawyer's redlines from their review into BOTH the .md source and the HTML page.
3. Remove the amber "Draft for legal review" banner only after sign-off date is filled.
4. Run `cd build && npm run build:lps` and confirm all 4 legal pages build, still include {{> head-analytics}} and {{> cookie-banner}}, and have no remaining `[brackets]`.

Acceptance:
- No `<mark class="lf">` placeholders remain.
- Pages render valid HTML; legal nav + footer intact.
- Build passes; dist/legal/*/index.html contain posthog + cookieConsent markers.
```

---

## PROMPT 2 — Convert the marketing landing pages to Hinglish (homepage stays English)

```
Repo: cloudberrysolutions/nabi-app-git-bkp (branch auth_rbac_feature)

Context to load:
- .brand/brand-kit.md  (Hinglish tone: 70% English / 30% romanized Hindi)
- .brand/positioning.md  (ICP, personas)
- CLAUDE.md  (Hinglish convention §)
- marketing-and-sales/launch-plan-v2/updated-files/04-LANDING-PAGE-COPY-DELTA.md
- marketing-and-sales/creative/landing-pages/{agency-owners,agents,ai-employee,demo,pricing,about,vs}/index.html
- marketing-and-sales/creative/landing-pages/_partials/  (shared partials)
- marketing-and-sales/creative/landing-pages/build/

Task:
1. Rewrite the visible copy of ALL landing pages EXCEPT `main/` (homepage) and `legal/*` into Hinglish per brand-kit (70/30). Keep `main/index.html` and legal pages in English.
2. Keep all structure, CTAs (-> https://app.realestateflow.in/signup), schema JSON-LD, meta tags, and partial tags unchanged — translate copy only.
3. Keep meta title/description SEO-optimised; Hinglish in body, but keep primary keywords scannable.
4. Run `cd build && npm run build:lps`; verify 14 pages build and analytics/consent partials still inject.

Acceptance:
- Homepage + legal remain English; other LPs are Hinglish.
- No broken markup; build passes; CTAs still point to the CRM signup.
```

---

## PROMPT 3 — Add VideoObject schema + demo embed (after the demo video exists)

```
Repo: cloudberrysolutions/nabi-app-git-bkp (branch auth_rbac_feature)

Context to load:
- marketing-and-sales/launch-plan-v2/updated-files/05-SEO-AEO-CONTENT-DELTA.md  (§5.1 VideoObject)
- marketing-and-sales/creative/landing-pages/main/index.html  (hero "See it in action" placeholder)
- marketing-and-sales/creative/landing-pages/demo/index.html

Task:
1. Replace the "[DEMO VIDEO EMBED]" placeholder on main/ and /demo with the real YouTube/Loom embed URL.
2. Add VideoObject JSON-LD (name, description, thumbnailUrl, uploadDate, duration ISO-8601, embedUrl, transcript if available) to both pages.
3. Rebuild and validate JSON-LD parses.

Acceptance: VideoObject present + valid; video embeds render; build passes.
```

---

## PROMPT 4 — BUG-009: enforce seat cap in the invite-creation API

```
Repo: cloudberrysolutions/reality-flow-authentication  (NOT nabi-app-git-bkp — this is the separate auth service)

Context to load:
- The invite-creation handler/route (search for "invite" / "createInvite" / "seats").
- In nabi-app-git-bkp for reference: server/routes/subscriptions.js  (the /subscriptions/check-seat endpoint returning 402 when seatsUsed >= seatsPaid)
- marketing-and-sales/launch-plan-v2/coding-agent-brief/bugs/BUG-009.md

Task:
1. In the invite-creation handler, before persisting a new invite, re-check the seat cap server-side (call the billing check-seat endpoint or replicate the seatsUsed >= seatsPaid check against the Subscriptions table).
2. Return HTTP 402 with `{ error: "Seat limit reached" }` when over cap. Cover pending invites in the count.
3. Add a unit/integration test that a 4th invite on a 3-seat plan is rejected.

Acceptance: direct API call to the invite endpoint cannot exceed paid seats; test passes; backward compatible for under-cap invites.
```

---

## PROMPT 5 — Deploy infra + populate prod env (operational runbook)

```
Repo: cloudberrysolutions/nabi-app-git-bkp (branch auth_rbac_feature)

Context to load:
- server/infra/launch-tables-cfn.yaml
- launch-audit/06-env-and-vendor-setup.md
- launch-audit/03-production-readiness.md
- server/.env.example, real-estate-crm-app/.env.example, marketing-and-sales/creative/landing-pages/.env.example

Task (requires AWS creds + vendor accounts — see doc 06):
1. `aws cloudformation deploy --template-file server/infra/launch-tables-cfn.yaml --stack-name realestateflow-launch-tables --capabilities CAPABILITY_NAMED_IAM --region ap-south-1`
2. Map stack outputs to the DynamoDB table-name env vars.
3. Set server env vars in the Lambda/host; set VITE_* in Netlify (CRM site) and LP build env in Netlify (LP site).
4. Redeploy backend, CRM, and LP; run the smoke checks in doc 03.

Acceptance: 7 tables exist; webhook signature verifies a Razorpay test event; LP pages load PostHog + consent; CRM logs in.
```
