# Day 06 — Landing Pages Deploy + Welcome Drip

> **Type:** 🤖 + 🧍
> **Phase:** Week 1
> **Skill(s):** `landing-page` + `email-sequence`
> **Estimated time:** 2h founder + 4h AI

## Objective
Final-deploy all 12 LPs to production at `realestateflow.in` + activate the welcome email drip in Brevo (T+0, T+1, T+3, T+7 from signup) so any signup gets nurtured automatically.

## Why This Matters for RealEstateFlow
P15 produced LP drafts; Day 6 is the deploy + smoke + welcome drip activation. After Day 6, anyone landing on the domain has a full brand experience + auto-nurture even if you sleep.

## User Story
As founder, I want all 12 LPs live + welcome drip running, so Day 9 beta invitees + Day 17 cold prospects + organic traffic all see the same crisp brand and get auto-nurtured.

## Acceptance Criteria
- [ ] All 12 URLs return 200: `/`, `/agency-owners`, `/agents`, `/ai-employee`, `/demo`, `/pricing`, `/about`, `/grievance`, `/vs/sell-do`, `/vs/zoho-crm`, `/vs/excel-spreadsheet`, `/legal/{terms,privacy,refund,cookies}`
- [ ] Lighthouse mobile ≥90 on all 4 categories for each page
- [ ] OG cards verified via opengraph.xyz for each page
- [ ] All real placeholders replaced (no `XXXX`, `YOUR_`, `hello@`, `9999999999` left)
- [ ] Cookie banner shows on first visit
- [ ] Forms post to Netlify Forms; submissions visible in Netlify dashboard
- [ ] Analytics events fire on each page (P10 verification)
- [ ] Schema validates on each page (P16)
- [ ] Sitemap submitted to GSC + Bing + Brave (P16)
- [ ] Welcome drip in Brevo: 4 emails (T+0 / T+1 / T+3 / T+7 from signup) + activation email when user adds first record
- [ ] Trigger automation: Brevo workflow listens to `/webhooks/brevo/signup` (or PostHog → Brevo via Zapier-equiv) → enqueues drip
- [ ] Drip emails English, on-brand, 3-paragraph max, 1 CTA each
- [ ] Founder personal "open" rate target ≥40% by Day 14
- [ ] Domain map at Cloudflare: `realestateflow.in` + `www` + `app` + `api` + `demo` + `status` all resolve correctly
- [ ] HSTS preload enabled if 14-day clean run holds

## Manual Steps (🧍)

1. **Verify P15 build** completed; `dist/` folder has all 12 pages.
2. **Deploy via Netlify CLI**: `netlify deploy --prod --dir=creative/landing-pages/dist --site=realestateflow-prod`. Confirm site URL.
3. **Custom domain**: in Netlify settings → Domain management → add `realestateflow.in` + `www.realestateflow.in`. Update Cloudflare CNAME records.
4. **HTTPS verify**: Cloudflare SSL/TLS = Full (strict). Wait for cert propagation (~15 min).
5. **Run Lighthouse mobile** (`npm run lighthouse:all` or PageSpeed Insights API) on all 12 URLs. Capture report.
6. **Run OG previews** via opengraph.xyz for each URL.
7. **Submit sitemap** to GSC, Bing Webmaster, Brave Search Webmaster.
8. **Brevo welcome drip**: log into Brevo → Automations → Create new workflow.
   - Trigger: `Contact added to list "Trial Signups"`
   - Step 1 (T+0, instant): "Welcome to RealEstateFlow" email
   - Step 2 (T+1, +24h): "Have you tried adding your first buyer?" email
   - Step 3 (T+3, +72h): "Mumbai broker quick wins (5-min read)" email
   - Step 4 (T+7, +168h): "How are you finding it? Reply to this email" — direct founder reply path
9. **Wire signup → Brevo**: in `apps/crm/server/routes/auth.js` registration handler, on success POST to Brevo `/contacts` API with list ID `Trial Signups` (env `BREVO_TRIAL_LIST_ID`).
10. **Activation email** triggered when PostHog event `feature_first_use` fires (via Brevo Webhook integration or zap).
11. **Smoke test** by registering a real test trial; expect T+0 email within 60s.
12. **Daily standup** + tick ACs.

## AI Prompt (🤖)

```
Read inputs:
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md`
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`
- `marketing-and-sales/research/buyer-personas-summary.md`
- All deployed LPs

Produce 4 outputs:

## 1. `marketing-and-sales/launch-implement/week-1/day-06-deploy-checklist.md`
Step-by-step deploy checklist with:
- Pre-deploy: build pipeline runs clean, no warnings, all placeholders replaced (grep for `XXXX|YOUR_|hello@`)
- Deploy: netlify CLI command, expected duration, post-deploy verification
- Custom domain: Cloudflare CNAME records, HTTPS verification
- Smoke tests: list of 12 URLs + expected 200 + Lighthouse score gate
- Rollback plan: previous Netlify deploy ID + 1-click rollback

## 2. `marketing-and-sales/launch-implement/week-1/day-06-welcome-drip.md`
4 welcome emails. Each: subject, preheader, body (markdown), CTA URL, expected open-rate, expected CTR. Voice: founder direct + Mumbai broker context. No buzzwords.

- **Email 1 (T+0)** — "Welcome to RealEstateFlow — let's add your first buyer in 90 seconds"
  Body: 3 paragraphs. (1) Welcome + 1-line wedge. (2) "Your first task: add a buyer in the CRM. Here's a 90-sec Loom." (3) "Hit reply if you get stuck. — {{Founder}}"
  CTA: "Start adding buyers →" `app.realestateflow.in/buyers/new`

- **Email 2 (T+1, 24h)** — "Have you tried the AI Employee?"
  Body: (1) Yesterday's recap (1 line). (2) Today's nudge: try the AI Employee status page; if interested in adding it, here's the 90-sec Loom + ₹7,999 add-on description. (3) Quick win: list your top 3 active buyers + see how the CRM auto-tracks updates.
  CTA: "See how AI Employee works →" `realestateflow.in/ai-employee`

- **Email 3 (T+3, 72h)** — "5 things Mumbai brokers do in their first week with RealEstateFlow"
  Body: 5 bullet quick wins (e.g., "Add 10 buyers from your WhatsApp", "Tag properties by Andheri/Bandra/Powai", "Set up Khata book for 1 active deal", "Schedule a site visit from CRM", "Review weekly analytics every Friday").
  CTA: "Open the CRM →"

- **Email 4 (T+7, 168h)** — "How's RealEstateFlow working for you?"
  Body: (1) "It's been a week — what's working, what's broken?" (2) Direct WhatsApp/email founder. (3) "If you're loving it, would you upgrade to a plan?" (Solo plan link).
  CTA: "Reply to this email" + "Pick a plan →" `realestateflow.in/pricing`

Save email bodies as Brevo-importable HTML at `marketing-and-sales/launch-implement/week-1/day-06-emails/{1,2,3,4}.html`.

## 3. `marketing-and-sales/launch-implement/week-1/day-06-brevo-workflow.md`
Brevo workflow JSON spec or step-by-step UI clicks:
- Trigger: Contact added to list "Trial Signups"
- Conditions: not already paying, trialDaysLeft > 7
- Steps: 4 emails with delays
- Pause condition: contact upgrades (move to "Paying Customers" list, exit workflow)
- A/B test setup: 50/50 split on Email 1 subject line ("Welcome to RealEstateFlow" vs "Add your first buyer in 90 seconds")

## 4. `marketing-and-sales/launch-implement/week-1/day-06-post-deploy-verification.md`
Acceptance test playbook the founder runs after deploy:
- All 12 URLs return 200 (curl loop)
- Lighthouse run on each (PageSpeed API or local)
- OG card preview on each (opengraph.xyz)
- Cookie banner shows on first visit
- Form submit → Netlify dashboard sees submission
- Trial signup → Brevo Welcome workflow triggers within 60s
- PostHog Live Events shows `page_view` + `cta_click` + `signup_completed` for the test session

Stop. Do not auto-deploy (founder runs CLI).
```

## Inputs
- P15 dist folder
- Brevo API key + list IDs
- Netlify account
- Cloudflare access

## Outputs
- 12 LPs live at custom domain
- Brevo welcome drip live
- Documents at `marketing-and-sales/launch-implement/week-1/day-06-*.md` + emails

## Success Criterion
All 12 URLs 200 + Lighthouse ≥90 + welcome drip fires for test signup within 60s.

## Fallback / Plan B
If Lighthouse <90 on a page, deploy without that page first; fix and redeploy by Day 7. If Brevo workflow fails, send Email 1 manually via founder's mailbox until fixed.

## Risks
| Risk | Mitigation |
|---|---|
| Custom domain SSL fails | Cloudflare DNS-only TXT validation; alt: Let's Encrypt direct on Netlify |
| Welcome drip lands in spam | DKIM/DMARC verified (P3); test with mailtester before launch |
| Form submit fails silently | Honeypot test + Netlify dashboard check |
| Lighthouse <90 from images | Image preload + WebP fallback (P15 covers) |
| Brevo workflow fires duplicate | Idempotency: check `is_in_workflow` flag |

## India / Mumbai-Specific Notes
- All emails English; subject ≤50 chars per inbox preview convention
- Founder mailbox is `founder@realestateflow.in` (warm)
- Indian inbox providers slower; budget +6h SLA for Email 1 if delivery dragged

## Dependencies
- **Blocks:** Day 9 beta invites (LPs need to be live), Day 17 cold outreach (LPs need to convert)
- **Depends on:** P15, P16, P3, P10

## Connected Skills
- `landing-page` — verify deploy
- `email-sequence` — drip
- `seo-audit` — Lighthouse pass
- `analytics-tracking` — verify firing
