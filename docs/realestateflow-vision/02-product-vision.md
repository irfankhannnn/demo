# 02 — Product Vision: RealEstateFlow

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Pillars kept; interface/phase table and phased ambition updated to what is built and to Phase A/B/C; Telegram, portal posting via browser automation and a tenant marketing agent dropped; pricing points to doc 38.

> **First written:** 2026-06-12 · **Owners:** Product + Architecture
> **Reading order:** Start here or at `01-current-state-analysis.md`. This document defines *what we are building and why*. The architecture documents (03–17) define *how*.

---

## 1. The One-Sentence Vision

> **RealEstateFlow is the AI-powered operating system for real estate agencies — it captures every conversation across every channel, converts conversations into qualified leads, and executes the agency's daily operations (follow-ups, site visits, listings, marketing, calling) through AI agents that the agency commands from WhatsApp, voice, or a dashboard.**

## 2. What RealEstateFlow Is NOT

This is the most important framing decision, because the current codebase *looks like* several of these things:

| RealEstateFlow is NOT… | Why this matters |
|---|---|
| **A CRM** | The CRM is one subsystem — the *system of record*. Value is created by the agents that act on the records, not the records themselves. |
| **A chatbot** | Conversations are a *channel*, not the product. Every conversation must terminate in a CRM outcome: a lead, a qualification, an appointment, a sale. |
| **A WhatsApp bot** | WhatsApp is today's dominant interface in the Indian market, but the platform must be channel-agnostic (Instagram, Facebook, web chat, voice, mobile app). |
| **A marketing tool** | Marketing automation is one engine among eight. It feeds the acquisition funnel; it is not the funnel. |

## 3. What RealEstateFlow IS: An Agency Operating System

A real estate agency in India/Dubai runs on roughly a dozen repeating operational loops. RealEstateFlow's goal is to automate the majority of each loop, with humans handling exceptions and relationships:

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                    REALESTATEFLOW AGENCY OS                         │
 │                                                                     │
 │  INTERFACES        ENGINES (AI-EXECUTED LOOPS)        SYSTEM OF     │
 │                                                       RECORD        │
 │  WhatsApp ───┐    1. Lead Acquisition Engine     ┌── CRM Core       │
 │  Voice ──────┤    2. Lead Qualification Engine   │   (Leads,        │
 │  Dashboard ──┼──▶ 3. Lead Scoring Engine     ◀──┼─  Contacts,      │
 │  Mobile ─────┘    4. Lead Assignment Engine      │   Pipeline,      │
 │                   5. AI Sales Assistant          │   Inventory,     │
 │  CHANNELS         6. Follow-Up Automation        │   Tasks,         │
 │  IG DM/Comments   7. AI Voice System             │   Visits,        │
 │  FB Msg/Comments  8. Social Publishing           │   Teams,         │
 │  WhatsApp         9. Portal Lead Ingestion       │   Documents)     │
 │  Website Chat        (99acres, MagicBricks…)     │                  │
 │  Property pages                                  └── Knowledge      │
 │  Phone (PSTN)    10. Knowledge & RAG System          Base (RAG)     │
 └─────────────────────────────────────────────────────────────────────┘
```

**The defining product property:** every engine reads from and writes to the same system of record (CRM + Inventory + Knowledge Base), and every AI response is grounded in that record — never hallucinated.

## 4. Who It's For

### Primary ICP
- **Long-term vision:** Indian real estate agencies, 2–50 agents, in metro + tier-1/2 cities, selling primary (builder projects) and secondary inventory. Dubai brokerages as a possible later market.
- **Current positioning source:** `marketing-and-sales/realestateflow/BRAND-POSITIONING.md` §4.1 says brokers/agencies with 2–15 members in Mumbai, Thane, Navi Mumbai and Pune. `marketing-and-sales/launch-plan-v2/00-DECISIONS-LOG.md` sets M1 city scope to Mumbai only.

> Open decision D24 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md (launch city, language and ICP; the numbers above are not final).

### Personas
| Persona | Daily reality | What RealEstateFlow does for them |
|---|---|---|
| **Agency Owner** | Drowning in unattributed leads, leaking follow-ups, no visibility | Command the agency from WhatsApp ("kal ke site visits dikhao"), see pipeline & team analytics, trust that no lead is dropped |
| **Team Lead / Sales Manager** | Manually distributing leads, chasing agents for updates | Automated assignment with rules, automated follow-up nudges, exception queues |
| **Agent (RM)** | 100+ WhatsApp chats, leads from 5 portals, forgets follow-ups | AI drafts replies, qualifies new leads before they reach the agent, schedules site visits, logs everything automatically |
| **Marketing person (often the owner)** | Posting manually, paying agencies for reels | One-command campaign generation: creatives, reels, captions, scheduling, lead-form sync |

## 5. The Eight Product Pillars

### Pillar 1 — CRM & Sales (System of Record)
Lead management, contact management, pipeline management, task management, follow-ups, site-visit management, opportunity tracking, team management, sales reporting, analytics. **Current state:** substantially built (see `01-current-state-analysis.md`). The domain API agents call exists: one tool registry (`apps/crm/server/shared/toolDefinitions.js`, 72 tools) run in-process by `apps/crm/server/skillInvoker.js`, exposed as `POST /api/crm/agent/tool` and through the MCP server. Consolidation of older route handlers is ongoing.

### Pillar 2 — Lead Acquisition Engine (Conversations → Revenue)
Every public and private conversation surface becomes a lead source: Instagram DMs and comments, Facebook messages and comments, WhatsApp, website chat, property pages, portal leads, lead-ad forms. The engine: captures → identifies/merges contact → opens a conversation thread → hands off to qualification. **Built:** one ingestion point (`apps/crm/server/leadIngestion.js`) fed by ManyChat, the Instagram service (dev) and property-page visit bookings. **Not built:** customer WhatsApp (planned on the official Cloud API, `39`), Facebook, website chat, lead ads, portal adapters. This is **not a chatbot feature**; it is the revenue front door. Detail: `08-social-lead-acquisition-engine.md`.

### Pillar 3 — Qualification, Scoring & Assignment
Conversational qualification (budget, timeline, location, configuration, purpose), progressive profiling across sessions, enrichment, intent detection → a deterministic + AI-assisted scoring model (Hot/Warm/Cold) → rule-based assignment (round-robin, region, project, team, lead-quality). Detail: `09`, `10`, `11`. **Built:** EventBridge `lead.created` → qualifier (Hot/Warm/Cold) → `lead.qualified` → router (`apps/crm/server/scripts/lead-qualifier-handler.js`, `lead-router-handler.js`). The founder is building a next-generation lead engine separately; these docs will be updated when it lands.

### Pillar 4 — AI Sales Assistant & Follow-Up Automation
Grounded answers about projects, pricing, payment plans, brochures, floor plans; site-visit and call scheduling; automated nurture journeys (brochure delivery, inventory updates, offers, visit reminders). Always grounded in CRM + Inventory + Knowledge Base. Detail: `09`, plus `14-rag-and-knowledge-architecture.md`. **Built:** the agency-facing agent (WhatsApp command channel, web chat), a daily follow-up cron with draft/autosend modes, and AI follow-up calls. **Planned:** WhatsApp nurture journeys on the official API, an Instagram DM assistant (drafts first, auto later), brochure and floor-plan tools.

### Pillar 5 — AI Voice System
Inbound answering, outbound qualification and follow-up calls, appointment scheduling — in English/Hindi/Hinglish, on Indian telephony (DLT/TRAI compliant). **Built:** outbound calls (`services/ai-calling-service`, ElevenLabs + Exotel) and follow-up call jobs (`services/followup-agent-service`). Launch is outbound only, with consent captured at lead intake and DLT registration before any bulk calls; inbound comes later. Detail: `12-voice-architecture.md`.

### Pillar 6 — Social Publishing
Tenant publishing to Instagram/Facebook with reporting back into lead acquisition, **after Meta App Review**. A tenant-facing AI marketing agent (content and campaign generation) is **dropped**; the Higgsfield/Remotion/Meta tooling stays internal founder tooling. Detail: `13-marketing-architecture.md`.

### Pillar 7 — Portal Lead Ingestion
Bring portal leads (MagicBricks, 99acres, Housing.com, builder portals) into the CRM as new adapters on the existing ingestion pipeline. **Posting listings to portals via browser automation is dropped** (account-block and ToS risk). Detail: `07-automation-platform.md`.

### Pillar 8 — Knowledge & Future Property Experience
Tenant-scoped knowledge bases (property, sales, agency, marketing knowledge) powering all agents via RAG. **Built:** DynamoDB vector search with Titan v2 embeddings for property matching and agency policies, with tenant id required on every search. Future: 3D tours, Gaussian splatting walkthroughs as a premium listing experience. Detail: `14`, with the future-state property experience in `03-future-state-architecture.md §9`.

## 6. Interface Strategy: "WhatsApp-First, Dashboard-Complete"

| Interface | Role | Phase |
|---|---|---|
| **WhatsApp** | The agency's *command line* ("show today's hot leads", "follow up with everyone who saw Lodha Park") and, later, customer conversations. | Command line: **built** (self-hosted Baileys, `services/whatsapp-platform`, + agent runtime). Customer-facing: **Phase C** on the official WhatsApp Business Cloud API (`39`) |
| **Dashboard** | Full CRM, analytics, configuration, billing, web chat with the agent. The trust surface. | Built |
| **Voice** | Outbound calls for customers now; inbound later; voice command for agents later. | Outbound: built. Inbound: Phase C |
| **Mobile app** | Agent-on-the-go: visits, check-ins, lead capture at site. | Capacitor app built; store launch in prep (`docs/launch/MOBILE_LAUNCH_YOUR_TASKS.md`) |

## 7. Product Principles

1. **Grounded, never hallucinated.** Every customer-facing AI answer must cite CRM/Inventory/KB data. If the system doesn't know, it says so and creates a task for a human.
2. **Human-in-the-loop by default, autonomous by earned trust.** Agencies start with approval queues (AI drafts, human sends) and graduate workflows to full autonomy per-tenant, per-workflow.
3. **Every conversation ends in a CRM outcome.** Lead created/updated, score changed, task created, visit booked, or explicitly closed with a reason.
4. **Tenant isolation is sacred.** Data, credentials, agent memory, automation runs, and billing are isolated per tenant (see `15-security-architecture.md`).
5. **Channel-agnostic core, channel-native experience.** One conversation engine; per-channel adapters respect each platform's rules (24h windows, template policies, comment etiquette).
6. **Sell outcomes, not tokens.** Customers never pay per token. Current (pre-launch) pricing is in `marketing-and-sales/launch-plan-v2/pricing.json` and CRM `apps/crm/real-estate-crm-app/src/lib/plans.ts`, which disagree on Team+; it is being replaced by the proposal in `38-pricing-plan-contacts-and-credits.md`. Credit metering as built: `30`.
7. **Evolve, don't rewrite.** The existing Lambda/DynamoDB/Express stack is the foundation; we strangle it into the target architecture incrementally (see `18-migration-strategy.md`).
8. **Never delete CRM data.** Archive instead of delete, in every design.
9. **No fake proof.** The product is pre-launch; no invented customers, testimonials or metrics.

## 8. North-Star Metric & Supporting Metrics

**North star: Qualified Conversations per Tenant per Week** — conversations (any channel) that reach "qualified lead" state with budget+timeline+requirement captured.

Supporting:
- Time-to-first-response (target < 60s on all channels, 24/7)
- Lead → Site Visit conversion rate
- Follow-up SLA compliance (% leads touched within policy)
- % of agency operations executed by AI (automation rate)
- Tenant 90-day retention; AI credit utilization (engagement proxy)

## 9. Where the Product Wins (Competitive Positioning)

| Competitor class | Examples (India) | RealEstateFlow's edge |
|---|---|---|
| Real-estate CRMs | Sell.Do, LeadRat, Privyr, B2B builder CRMs | They record; we *execute*. AI employee + omnichannel acquisition + voice. |
| WhatsApp automation tools | AiSensy, Interakt, Wati | They broadcast; we run grounded sales conversations tied to inventory & pipeline. |
| Horizontal CRMs | Zoho, HubSpot, Kommo | Vertical depth: site visits, projects/towers/units inventory, portal lead ingestion, RERA-aware docs, Hinglish voice. |
| Marketing agencies | Local social agencies | 10x cheaper, always-on, closed-loop to actual leads. |

**Moat thesis:** the compounding asset is the *tenant's operational graph* — conversations × inventory × outcomes — which makes every engine smarter and switching painful, plus the integration lattice (portals, Meta, telephony, DLT compliance) that is tedious to replicate.

## 10. Phased Ambition (summary — full roadmap in `21-roadmap.md`, no dates)

**Already built:** CRM core, agent runtime (WhatsApp command channel + web chat), one tool registry and MCP server, lead ingestion (ManyChat, Instagram, property pages), qualification/scoring/assignment, Instagram DMs and comments (dev), outbound AI voice + follow-up calls, knowledge search, credits, Capacitor mobile app.

- **Phase A — M1 launch:** launch what is built; before taking payment, close grace-period enforcement, API throttling/access logs/CORS, and key rotation. ADMIN/MEMBER roles. Voice outbound only.
- **Phase B — Hardening:** MANAGER role and member lead scoping before selling Team plans; cursor pagination; CRM audit log (archive, not delete); E2E tests in CI; WAF after first customers; DLT before bulk calls.
- **Phase C — Growth:** customer WhatsApp on the official Cloud API and WhatsApp nurture journeys; Instagram DM assistant (draft first, auto later); inbound voice; portal lead ingestion; brochure/floor-plan tools; tenant social publishing after Meta App Review. Later: analytics suite, 3D property experience pilots.

**Dropped:** Telegram, portal posting via browser automation, tenant marketing agent. **Considered, not adopted:** a Strands/AgentCore migration (see `04`).

## 11. Explicit Non-Goals (next 18 months)

- Building a consumer-facing property portal (we serve agencies, not home-buyers directly).
- Payments/escrow between buyers and agencies.
- Building our own foundation models or fine-tuning at scale.
- iBuying, mortgage origination, or transaction management beyond document handling.
- Replacing the agent — the product makes agents superhuman; it does not disintermediate them.
