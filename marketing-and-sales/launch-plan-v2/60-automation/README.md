# 60 · Automation

What runs without us — and, honestly, what does not.

Two different things get called "automation" in this repo and the June 2026 documents merged them, which is why they read as if far more exists than does:

1. **Product automation** — what the CRM does for a paying agency. A lot of this is built and running.
2. **Our own go-to-market automation** — what runs RealEstateFlow's marketing and sales. Almost none of this is built, and at solo-founder scale most of it should not be.

This layer keeps them apart. Merged from `archive/content-os/automation-os/architecture.md` and `archive/content-os/growth-platform/automations/automation-architecture.md`.

---

## 1. Product automation that is built

| Flow | How it works | Where |
|---|---|---|
| Lead ingestion, one door | every automated lead enters through `ingestLead()`, which sets `source`, `sourceAdapter`, `externalRef`, `dedupeKey`, dedupes on normalised phone, and emits an EventBridge `lead.created` | `apps/crm/server/leadIngestion.js`, `docs/lead-adapter-architecture.md` |
| Lead qualification | EventBridge rule on `crm.leads` / `lead.created` → `lead-qualifier-handler`, which scores HOT/WARM/COLD against the shared rubric and emits `lead.qualified` | `apps/crm/server/infra/cfn-backend.yaml` (lead-qualifier rule), `scripts/lead-qualifier-handler.js`, `utils/leadRubric.js` |
| Lead routing | EventBridge rule on `lead.qualified` → `lead-router-handler` | `cfn-backend.yaml` (lead-router rule), `scripts/lead-router-handler.js` |
| Inbound WhatsApp | `whatsapp.incoming` / `message.received` → WhatsApp processor | `cfn-backend.yaml`, `scripts/whatsapp-message-processor.js`, `services/whatsapp-platform` |
| Instagram comments and DMs | Meta webhook → keyword rule matcher → lead analyst (rules + Gemini) → CRM hand-off | `apps/instagram/backend_insta_sol_ms/routes/webhooks.js`, `services/ruleMatcher.js`, `services/leadAnalyst.js`, `services/crmBridge.js` |
| AI follow-up calls | scheduled, retried twice 45 minutes apart inside the tenant's business hours, escalated to a human when needed | `services/followup-agent-service` |
| Scheduled jobs | nine EventBridge rules: credit reset, trial reminders, incomplete data, expiring agreements, team summary, escalation (every 6h), meeting reminders (every 5 min), lead follow-up | `cfn-backend.yaml` |
| Billing lifecycle | Razorpay webhooks drive provisioning, invoicing, failures, refunds, cancellations, seats | `apps/crm/server/routes/billing.js` |

The June design proposed SQS plus a new "automation engine" as the backbone for all of this. The shipped backbone is **EventBridge**, and it already carries domain events. SQS exists in the stack, but only for call recordings. Anything new should follow the EventBridge pattern rather than introduce a second bus.

## 2. Our own go-to-market automation

> **Design only — not built (17 Sep 2026).** There is no marketing rule engine, no sequence enrolment, no `MKT_EVENT` store and no `POST /api/marketing/events`. Zero hits across `apps/` and `services/`.

What actually runs our own funnel today:

| Job | How it runs now |
|---|---|
| Publishing content | by hand, or through the Blotato MCP — **open decision D22** |
| Replying to our own Instagram DMs and comments | by hand. Our own account is not connected to our own Instagram service; Meta App Review is pending (`docs/pending-items/instagram-service-status.md`) |
| Cold email | Instantly |
| Warm WhatsApp to prospects | AiSensy in the plan stack — **open decision D29c** |
| Cold WhatsApp | a personal number, capped at 15 a day |
| Demo booking | Cal.com |
| Transactional email to customers | Brevo |
| Trial nudges | the deployed trial-reminder cron — a product automation we get for free |
| Prospect scoring, health, referrals | a sheet — see [`../50-measurement/`](../50-measurement/) |

> Open decision D22 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

> Open decision D29 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

## 3. The rule that keeps this layer honest

**Before automating anything for our own go-to-market, check whether the product already does it for tenants.** Three of the June design's flagship workflows — comment keyword replies, DM to scored lead, AI call on a qualified lead — are already built as tenant features. The cheapest path to having them for ourselves is to connect `@realestateflow` as a tenant of our own product once App Review passes, not to build a second implementation in the marketing stack.

The second rule: **extend, do not parallel**. The trial email drip already exists as a scheduled Lambda. A second drip alongside it would double-message every trial.

## 4. What would come first, if anything

In cost order, smallest first:

1. Fire `lead_added` from `leadIngestion.js` so channel mix is queryable in PostHog.
2. Connect our own Instagram account after App Review, which turns manual DM triage into the built tenant flow.
3. Log every publish (`OPP-*` id → media id) — by hand at first, automatically if Blotato is adopted at D22.
4. Anything resembling a marketing rule engine. Only if 1-3 land and manual work is still the bottleneck.

## 5. Files in this layer

| File | What it answers |
|---|---|
| [`workflow-catalog.md`](./workflow-catalog.md) | For each of the twelve designed workflows: built, partly built, or design only? |
| [`tooling-stack.md`](./tooling-stack.md) | Which tool does what, what it costs us to run, and what is only an MCP. |

## 6. Two corrections worth carrying

- The June architecture named as a "verified gap" that CRM leads carry no source, campaign, attribution or score. Every lead has carried `source`, `sourceAdapter`, `externalRef`, `dedupeKey` and an AI temperature since the lead-adapter work. The real remaining gap is `utm_*` / `campaignId` / `contentRef` on the lead.
- It also placed the Instagram webhook inside the CRM (`/api/webhooks/instagram` on `apps/crm/server`). Instagram is a **separate microservice** (`apps/instagram/backend_insta_sol_ms`) that hands leads to the CRM over `POST /api/internal/adapters/leads`. The CRM's own `/api/webhooks/instagram/:webhookToken` is the ManyChat path, which is a different thing again.
