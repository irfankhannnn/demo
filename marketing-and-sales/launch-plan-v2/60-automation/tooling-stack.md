# Tooling stack

Every tool that touches the launch, what it is for, and whether it is wired into code or driven by hand. Merged from `archive/content-os/automation-os/integrations.md` and `archive/content-os/growth-platform/integrations/integrations.md`, both of which marked several already-shipped integrations as "new".

Status vocabulary: **in code** (something in `apps/` or `services/` calls it) · **operated** (a service we use, not integrated) · **MCP only** (available to an agent through `.mcp.json`, no product integration) · **planned** (named in `00-PLAN-OVERVIEW.md` §7, not yet in use).

---

## 1. Product integrations (what the CRM talks to)

| Tool | Purpose | Status | Where |
|---|---|---|---|
| Razorpay | subscriptions, payments, refunds, GST invoicing | in code | `agency-app/api/routes/billing.js`, `razorpayOrders.js`; commercial terms in `pricing.json` |
| PostHog | product and funnel analytics, client and server | in code | `src/lib/analytics.ts`, `agency-app/api/lib/posthog.js` |
| Instagram Graph API | comments, DMs, media, insights, keyword rules | in code, **dev only** | `agency-app/instagram-api`; prod blocked on Meta App Review |
| WhatsApp (self-hosted Baileys) | the product's WhatsApp channel and the AI Employee's transport | in code | `platform/whatsapp-platform`; inbound via EventBridge `whatsapp.incoming` and `agency-app/api/routes/webhooks.js` |
| Exotel + ElevenLabs | AI calling | in code | `agency-app/ai-calling`; metered in credits (`creditConfig.js`) |
| Follow-up agent | scheduling, retry and escalation of AI calls | in code | `agency-app/followup-agent` |
| ManyChat | property-page conversations | in code | `agency-app/api/routes/webhooks.js`, `docs/public-app/property-pages/02-MANYCHAT-SETUP.md` |
| Amazon SES | transactional email from the CRM | in code | `agency-app/api/emailService.js` |
| Brevo | transactional email in the launch stack, including trial emails | in code / planned | `agency-app/api/scripts/trial-reminder-cron.js`; stack choice in `00-PLAN-OVERVIEW.md` §7 |
| MCP server | 50+ CRM tools exposed to agents | in code | `platform/mcp` |
| AWS EventBridge | the domain event bus (`lead.created`, `lead.qualified`, `whatsapp.incoming`) and nine scheduled rules | in code | `agency-app/api/infra/cfn-backend.yaml` |

**SES and Brevo both exist.** SES sends from the CRM; the launch stack names Brevo for transactional mail and the trial cron already goes through it. That is a duplication worth resolving before paid launch, but it is a product decision, not a marketing one.

## 2. Marketing and sales tools (what we use to sell)

| Tool | Purpose | Status | Note |
|---|---|---|---|
| Blotato | scheduling posts to Instagram, Facebook, LinkedIn, TikTok, X | **MCP only** | no webhook, no publish log. **D22** decides whether we use it or publish by hand |
| Meta Business Suite | manual publishing and post insights | operated | the fallback, and today the only way we read our own insights |
| Meta Ads | paid campaigns | **MCP only**, unused | no paid ads in M1; Month 2 at the earliest, and only if the PMF gate passes |
| Higgsfield | image and video generation | MCP only | used by the content layer, see [`../20-content-engine/`](../20-content-engine/) |
| Instantly | cold email | planned | `00-PLAN-OVERVIEW.md` §7 |
| AiSensy | WhatsApp BSP for warm messages to prospects | planned | **D29c** — the alternative is a personal number, capped at 15 cold messages a day |
| Cal.com | demo booking | planned | demo windows Tue-Fri 11:00-17:00 IST |
| Crisp | helpdesk | planned | |
| GA4, Meta Pixel, LinkedIn Insight, Hotjar | landing-page measurement | in code, consent-gated | `agency-app/landing-pages/_partials/head-analytics.hbs` |
| Sentry, BetterStack | error tracking, uptime | planned | |
| Firecrawl | prospect research and scraping | operated | |
| Google Sheets | the prospect sheet, the weekly scorecard, the publish log | operated | deliberately — see [`../50-measurement/README.md`](../50-measurement/README.md) |

## 3. WhatsApp: which number, for what

This trips people up, so it is spelled out. There are three distinct WhatsApp paths and they must not be conflated:

| Path | What it is | Status |
|---|---|---|
| Tenant / AI Employee messaging | `platform/whatsapp-platform`, self-hosted Baileys, per tenant | in code |
| Warm messages to **our** prospects and customers | AiSensy BSP templates, consent-gated | planned, **D29c** |
| Cold outreach to prospects | a personal number, ≤15 a day | operated |

The June documents assumed a single "WhatsApp Business API (Gupshup/Twilio/Meta)" integration for all three. Direction for the official API is `docs/realestateflow-vision/39-whatsapp-official-api-plan.md`. Running our own brand number through Baileys carries a ban risk and is not the plan.

> Open decision D29c — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

## 4. What the June registries got wrong

Worth listing, because the same mistakes reappear whenever someone reads an archived file:

- Instagram Graph API marked "new" — it is a deployed microservice, dev-side.
- WhatsApp marked "new, via Gupshup/Twilio/Meta" — it is self-hosted Baileys today, with AiSensy as the marketing plan.
- Billing, SES and calendar marked "new/extend" — all three exist.
- A Blotato `content_published` webhook treated as available — it does not exist.
- Missing entirely: PostHog, ManyChat, AiSensy, Brevo, Instantly, Crisp, the MCP server, the follow-up service.
- SQS and EventBridge listed as new infrastructure — EventBridge carries domain events and nine crons already; SQS exists for call recordings.

## 5. Adding a tool

Before adding anything: does the product already do this, and could we use it on ourselves? The Instagram service, the follow-up agent and the trial drip are all things we would otherwise buy. Connecting `@realestateflow` as a tenant of our own CRM, once Meta App Review passes, replaces several rows in the table above with nothing.
