# Day 05 — Helpdesk + Status Page + Uptime Monitors

> **Type:** 🤖 + 🧍
> **Phase:** Week 1
> **Skill(s):** `revops` + `copywriting`
> **Estimated time:** 2h founder + 2h AI

## Objective
Embed Crisp helpdesk on all 5 LPs + the CRM SPA, configure 6 saved replies, set up BetterStack uptime monitors + public status page (`status.realestateflow.in`), wire BetterStack incidents to founder email + WhatsApp via Crisp/Slack/SNS bridge.

## Why This Matters for RealEstateFlow
A Mumbai broker hitting any friction needs a 1-click chat path. Crisp handles 2 seats free. Status page builds trust during inevitable Week-3-4 hiccups. Uptime monitors catch issues before customers complain.

## User Story
As founder, I want a chat widget + public status page + uptime monitors live on Day 5, so any friction surfaces in <60 seconds and customers can self-check status during incidents.

## Acceptance Criteria
- [ ] Crisp account created with workspace = RealEstateFlow
- [ ] Crisp embed snippet added to all 5 LPs + CRM SPA `index.html`
- [ ] 6 saved replies configured: pricing-question, demo-request, refund-question, AI-Employee-question, technical-issue, general
- [ ] Founder mobile receives Crisp push notifications (test message reaches founder within 30s)
- [ ] Crisp business hours set: Mon-Fri 09:00-19:00 IST + Sat 10:00-14:00; off-hours auto-reply: "We're off the clock — we'll WhatsApp you within 12h. For urgent: founder@realestateflow.in"
- [ ] BetterStack account created
- [ ] 6 uptime monitors active: `realestateflow.in/`, `/pricing`, `/demo`, `api.realestateflow.in/health`, `app.realestateflow.in/`, `/api/billing/webhook` (HEAD check)
- [ ] Public status page at `status.realestateflow.in` (CNAME via Cloudflare → BetterStack)
- [ ] Status page footer of CRM SPA links to status page
- [ ] BetterStack incidents → push notification to founder + Crisp pinned message + (optional) Slack/Discord webhook
- [ ] All 6 monitors green for 1h continuous
- [ ] On-call rotation = founder (only); document escalation if founder unreachable >2h: contractor on-call number
- [ ] Status page tested with 1 deliberate downtime (5-min stop the API in dev) — incident raised + resolved automatically

## Manual Steps (🧍)

1. **Crisp signup** at https://crisp.chat. Workspace name = RealEstateFlow. Plan = Free 2 seats.
2. **Configure 6 saved replies** from the AI Prompt output below.
3. **Embed Crisp**: copy widget snippet → paste into all 5 LP `<head>` (P15 already has slot) + SPA `index.html`. Redeploy.
4. **Test** from incognito on mobile + desktop. Send test message → confirm push lands on founder mobile.
5. **Set business hours** in Crisp settings.
6. **BetterStack signup** at https://uptime.betterstack.com. Free tier (10 monitors).
7. **Create 6 monitors** — each configured per AI Prompt output.
8. **Provision public status page**: BetterStack → Status Page → custom domain `status.realestateflow.in`. Add CNAME in Cloudflare → BetterStack target.
9. **Configure incident notifications**: BetterStack → Integrations → Email + (optional) Slack webhook. Founder personal email + WhatsApp-via-Crisp-API integration if set up.
10. **Test downtime**: stop dev API for 5 min, observe incident creation + resolution on status page.
11. **Add status link** to CRM SPA footer + LP footer (small text).
12. **Daily standup**.
13. **Tick ACs**.

## AI Prompt (🤖)

```
Read inputs:
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md`
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md` (FAQ source)
- `marketing-and-sales/launch-implement/pre-launch/01-legal/refund.md`

Produce:

## 1. `marketing-and-sales/launch-implement/week-1/day-05-crisp-saved-replies.md`
6 saved replies, each with: shortcut keyword (e.g., `/pricing`), title, body (≤500 chars, English, on-brand), follow-up CTA. Cover:
1. **Pricing question** — recap Solo/Team/Team+/AI Employee, link to /pricing, "Want a 15-min walkthrough? cal.com/{{HANDLE}}"
2. **Demo request** — link cal.com + 90-sec Loom; offer to send transcripts of demo tenant
3. **Refund question** — 1-month money-back (Solo/Team/Team+); AI Employee no-refund; link to /legal/refund
4. **AI Employee question** — what it does, 24h SLA, no trial reasoning, link to /ai-employee
5. **Technical issue** — apologize, ask for screenshot + browser/device info, status page link, ETA reply
6. **General** — thank-you + auto-route to right skill if escalated

## 2. `marketing-and-sales/launch-implement/week-1/day-05-betterstack-monitors.md`
6 monitor configs. For each: URL, method (HEAD/GET), expected status, check interval (30s for /health, 60s for LPs), regions (Mumbai + Bangalore + Singapore for triangulation), incident-trigger threshold (2 consecutive failures), expected response time SLA (<2s).

## 3. `marketing-and-sales/launch-implement/week-1/day-05-status-page-spec.md`
Status page setup:
- Title: "RealEstateFlow Status"
- Subtitle: "All systems operational"
- Components: Website, API, Demo Tenant, Razorpay Webhook, Email Delivery
- Subscribe-to-incidents CTA (BetterStack handles)
- Incident template (when raising manually): title, severity, customer-facing description, ETA, last-update timestamp
- "Resolved" template
- Past 90-day uptime widget on the page
- Incident postmortem template at `marketing-and-sales/launch-implement/incidents/template.md` for future use

## 4. `marketing-and-sales/launch-implement/week-1/day-05-on-call-runbook.md`
Founder on-call runbook:
- Reachability: phone always on; mobile push enabled for Crisp + BetterStack + Sentry
- Triage: severity scale (P0 down/data-loss · P1 degraded · P2 minor)
- Response SLA: P0 <15 min ack · P1 <2h · P2 <24h
- Communication: status page + Crisp pin + (if P0) email all paying customers from `founder@`
- Escalation: if founder unreachable >2h → contractor (placeholder name + phone) — to be hired M2+

Stop. Do not auto-create accounts (manual).
```

## Inputs
- Crisp + BetterStack accounts (founder signs up manually)
- Pricing/legal copy from earlier files
- All deployed surfaces (P15)

## Outputs
- Crisp embed live on 6 surfaces
- 6 saved replies in Crisp
- 6 BetterStack monitors live
- Public status page at `status.realestateflow.in`
- `marketing-and-sales/launch-implement/week-1/day-05-*.md` files

## Success Criterion
All monitors green 1h+; test push works; status page resolves; saved replies usable.

## Fallback / Plan B
If Crisp embed conflicts with cookie consent, gate Crisp behind functional consent (Crisp counts as functional). If BetterStack status-page custom-domain fails, use BetterStack subdomain `realestateflow.betteruptime.com` temporarily.

## Risks
| Risk | Mitigation |
|---|---|
| Crisp push not reaching founder | Test on Day 5 + weekly thereafter |
| Status page gives false-positive (false outage) | 2-consecutive-failure threshold; multi-region |
| Founder unreachable | Document escalation; M2 contractor |
| Saved replies feel robotic | Founder personalizes 1st response per chat |

## India / Mumbai-Specific Notes
- Business hours align with Mumbai broker workflow (Mon-Fri 09-19, Sat 10-14)
- Multi-region monitor includes Mumbai (latency baseline)
- Crisp supports Hindi/Marathi if expanded later

## Dependencies
- **Blocks:** Day 9+ beta tester support flow
- **Depends on:** Day 3 deploy (everything live)

## Connected Skills
- `revops` — helpdesk + on-call
- `copywriting` — saved replies
