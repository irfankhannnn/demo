# 08 — Social Lead Acquisition & Conversion Engine

> **Scope:** turning conversations on every public/private channel into leads, opportunities, appointments, site visits, and revenue. This is the revenue front door — **not a chatbot feature.** Research (WhatsApp/IG/Chatwoot, channel rules, India compliance) verified June 2026 (`20`).

---

## 1. What This Engine Does

```
 Conversation (any channel)  →  Contact resolved/merged  →  Conversation thread
   →  Intent + grounded reply (Sales Assistant, 04)  →  Qualification (09)
   →  Scoring (10)  →  Assignment (11)  →  Appointment / Site Visit
   →  CRM outcome + events  →  Revenue
```

Every conversation **must end in a CRM outcome** (lead created/updated, score, task, visit, or closed-with-reason). The engine is the L2 channel adapters + L3 conversation backbone from `03 §3`.

## 2. Channels & How Each Is Captured

| Channel | Mechanism | Notes / rules |
|---|---|---|
| **WhatsApp** | Cloud API webhooks (inbound), templates (outbound) | Primary in India. 24h service window; per-message pricing (see §4). Multi-tenant via Embedded Signup. |
| **Instagram DMs** | Messaging API webhooks | 24h window; `human_agent` tag extends to 7d for genuine human support. |
| **Instagram comments** | Comment webhook → **private reply (DM)** | One automated private reply per comment — classic "comment to DM" play for real estate posts/reels. |
| **Facebook Messages** | Messenger Platform webhooks | Same windowing model as IG. |
| **Facebook comments** | Page feed webhook → private reply / public reply | Comment-to-DM on listing posts/ads. |
| **Telegram** | Bot API (webhook/long-poll) | Cheapest/easiest; no 24h restriction. |
| **Website chat** | Embeddable widget → our webhook | Owns its own session; full control. |
| **Meta Lead Ads** | Lead form retrieval API + webhook | High-intent inbound; sync to CRM + trigger instant follow-up. |
| **Portal leads** | Official push/email (`07`) | Pull, dedupe, route. |
| **Future** | New L2 adapter only | Channel-agnostic core. |

## 3. Build vs Buy the Inbox: use Chatwoot as omnichannel infrastructure

**Decision: adopt Chatwoot (Community Edition, MIT, self-hosted) as the omnichannel ingestion + human-agent inbox layer, and put our agent/AI logic on top of it** — rather than building per-channel webhook plumbing from scratch.

Why:
- Chatwoot CE already speaks **WhatsApp, Messenger, Instagram, Telegram, website chat, email, SMS, X** — exactly our channel list — with a unified conversation model, agent assignment, webhooks, and bot APIs.
- MIT license, **self-hosted = full data ownership** (important for DPDP, `15`), runs on our AWS.
- Gives agencies a **human-agent inbox for free** (the human-in-the-loop surface from `04 §6`) where AI drafts and humans approve.

Caveats (design around them):
- Chatwoot CE accounts share one deployment/DB → **logical, not hard, tenant isolation.** For strict isolation we run **per-tenant or per-shard Chatwoot instances**, or keep Chatwoot as a stateless channel-gateway and treat *our* CRM/Conversation store as the system of record (preferred — Chatwoot holds transient inbox state, CRM holds truth).
- SLA management, audit logs, custom dashboards are Enterprise-only → we provide those in our own dashboard, not Chatwoot's.
- Chatwoot does **not** bypass Meta API approvals/window rules — those still apply.

**Architecture:** Chatwoot receives channel events → forwards to our **Conversation Orchestrator** (via Chatwoot webhooks / agent-bot) → our agents reply through Chatwoot's send APIs → outcomes written to *our* CRM. If we later outgrow Chatwoot, the L2 adapter boundary (`03`) means we can swap to raw Cloud API webhooks without touching agents.

*(Alternative if we want zero third-party inbox: implement L2 adapters directly against each platform's webhooks. More control, more maintenance. Recommended only if Chatwoot's shared-DB model proves limiting.)*

## 4. WhatsApp Economics & Multi-Tenant Onboarding (critical detail)

- **Pricing (per-message, since 1 Jul 2025):** charged per **delivered template** by **category** and **country**. **Service conversations are free; all free-form replies within an open 24h window are free; Utility templates are free inside the 24h window.** Only **Marketing** and **Authentication** templates (and Utility outside 24h) cost money. India indicative: Marketing ~₹0.78–0.86/msg, Utility/Auth ~₹0.13/msg (verify on live rate card). **Implication:** keep conversations inside the 24h service window (respond fast — our <60s SLA helps) and prefer Utility over Marketing templates to minimize cost.
- **Multi-tenant onboarding:** use **Embedded Signup** so each agency connects its **own WABA/number** under our Meta app via an OAuth flow. Choose the business model: **Tech Provider** (agencies pay Meta directly — simplest, no credit risk for us) vs **Solution Partner/BSP** (we hold the credit line and bill agencies — more margin, more ops). **Recommendation:** start as **Tech Provider** (or via an existing BSP like the already-integrated **AiSensy**, or Gupshup/Interakt) to avoid carrying Meta billing; revisit BSP economics at scale. The existing AiSensy integration is a pragmatic Phase-1 on-ramp.

## 5. Conversation → CRM Outcome Pipeline (detail)

1. **Ingest & dedupe** (Redis idempotency on message id).
2. **Resolve contact** (CRM/Contact MCP `resolve_contact_by_phone`/handle) — merge across channels into one Contact (multi-identity model already exists in auth/CRM).
3. **Open/append Conversation thread** (Conversations/Messages store, `03 §7`), tagged with channel + source (ad id, post id, portal).
4. **Route** (Conversation Router, Haiku): new-lead vs existing-customer vs spam vs human-needed.
5. **Respond** (Sales Assistant, grounded) — within channel rules; draft-or-send per autonomy level.
6. **Qualify → Score → Assign** (`09`/`10`/`11`) inline.
7. **Convert intent to outcome:** create/update Lead, book Visit, create Task, or close-with-reason. Attribution (UTM/ad/post/portal) stamped for ROI.
8. **Emit events** (LeadCreated/Qualified/VisitBooked) for follow-up journeys and analytics.

## 6. Compliance (DPDP + Meta policy)
- **DPDP Act 2023:** capture consent for lead data, store purpose, support data-access/deletion (the grievance flow already exists). Self-hosting Chatwoot + our CRM keeps PII in our controlled AWS (`15`).
- **Meta platform policies:** respect automation rules, 24h windows, template approval/quality ratings; don't spam comments. Quality rating (Green/Yellow/Red) governs messaging limits — protect it.
- **WhatsApp opt-in** required for proactive outreach; capture and record it.

## 7. KPIs
Time-to-first-response (<60s target, 24/7), capture rate (conversations→leads), qualification rate, conversation→visit rate, channel-level CAC and ROI (via attribution), WhatsApp quality rating, cost-per-conversation.

## 8. Phasing
- **P1:** WhatsApp (via AiSensy/Embedded Signup) + Website chat + Meta Lead Ads, on Chatwoot, with Router + Sales Assistant + qualification, approval-queue autonomy.
- **P2:** Instagram DMs + comment-to-DM, Facebook messages/comments.
- **P3:** Telegram, portal-lead ingestion, full attribution/ROI analytics, graduated autonomy.
