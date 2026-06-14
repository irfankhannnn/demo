# 02 — Product Vision: RealEstateFlow

> **Status:** Final draft for review · **Date:** 2026-06-12 · **Owners:** Product + Architecture
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
| **A WhatsApp bot** | WhatsApp is today's dominant interface in the Indian market, but the platform must be channel-agnostic (Instagram, Facebook, Telegram, web chat, voice, mobile app). |
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
 │  FB Msg/Comments  8. AI Marketing System         │   Teams,         │
 │  WhatsApp         9. Browser Automation          │   Documents)     │
 │  Telegram            (Portals: 99acres,          │                  │
 │  Website Chat         MagicBricks…)              └── Knowledge      │
 │  Phone (PSTN)    10. Knowledge & RAG System          Base (RAG)     │
 └─────────────────────────────────────────────────────────────────────┘
```

**The defining product property:** every engine reads from and writes to the same system of record (CRM + Inventory + Knowledge Base), and every AI response is grounded in that record — never hallucinated.

## 4. Who It's For

### Primary ICP (from `.brand/positioning.md` and current GTM)
- **Indian real estate agencies**, 2–50 agents, in metro + tier-1/2 cities (Mumbai, Pune, Bangalore, Hyderabad, NCR), selling primary (builder projects) and secondary inventory.
- Secondary market: **Dubai brokerages** (already reflected in current CRM data model).

### Personas
| Persona | Daily reality | What RealEstateFlow does for them |
|---|---|---|
| **Agency Owner** | Drowning in unattributed leads, leaking follow-ups, no visibility | Command the agency from WhatsApp ("kal ke site visits dikhao"), see pipeline & team analytics, trust that no lead is dropped |
| **Team Lead / Sales Manager** | Manually distributing leads, chasing agents for updates | Automated assignment with rules, automated follow-up nudges, exception queues |
| **Agent (RM)** | 100+ WhatsApp chats, leads from 5 portals, forgets follow-ups | AI drafts replies, qualifies new leads before they reach the agent, schedules site visits, logs everything automatically |
| **Marketing person (often the owner)** | Posting manually, paying agencies for reels | One-command campaign generation: creatives, reels, captions, scheduling, lead-form sync |

## 5. The Eight Product Pillars

### Pillar 1 — CRM & Sales (System of Record)
Lead management, contact management, pipeline management, task management, follow-ups, site-visit management, opportunity tracking, team management, sales reporting, analytics. **Current state:** substantially built (see `01-current-state-analysis.md`); needs consolidation into a clean domain API that agents can call.

### Pillar 2 — Lead Acquisition Engine (Conversations → Revenue)
Every public and private conversation surface becomes a lead source: Instagram DMs and comments, Facebook messages and comments, WhatsApp, Telegram, website chat, portal leads, lead-ad forms. The engine: captures → identifies/merges contact → opens a conversation thread → hands off to qualification. This is **not a chatbot feature**; it is the revenue front door. Detail: `08-social-lead-acquisition-engine.md`.

### Pillar 3 — Qualification, Scoring & Assignment
Conversational qualification (budget, timeline, location, configuration, purpose), progressive profiling across sessions, enrichment, intent detection → a deterministic + AI-assisted scoring model (Hot/Warm/Cold) → rule-based assignment (round-robin, region, project, team, lead-quality). Detail: `09`, `10`, `11`.

### Pillar 4 — AI Sales Assistant & Follow-Up Automation
Grounded answers about projects, pricing, payment plans, brochures, floor plans; site-visit and call scheduling; automated nurture journeys (brochure delivery, inventory updates, offers, visit reminders). Always grounded in CRM + Inventory + Knowledge Base. Detail: `09`, plus `14-rag-and-knowledge-architecture.md`.

### Pillar 5 — AI Voice System
Inbound answering, outbound qualification and follow-up calls, appointment scheduling — in English/Hindi/Hinglish, on Indian telephony (DLT/TRAI compliant). Builds on the existing Exotel + ElevenLabs calling service. Detail: `12-voice-architecture.md`.

### Pillar 6 — AI Marketing System
Content generation (posts, reels, creatives), campaign generation, publishing to Instagram/Facebook, and closed-loop reporting back into lead acquisition. Builds on the existing marketing automation system (Higgsfield/Remotion/Meta MCPs). Detail: `13-marketing-architecture.md`.

### Pillar 7 — Browser Automation (Portal Operations)
Automated listing posting and lead retrieval for MagicBricks, 99acres, Housing.com, builder portals — multi-tenant, credential-isolated, queue-based, audited. Detail: `07-automation-platform.md`.

### Pillar 8 — Knowledge & Future Property Experience
Tenant-scoped knowledge bases (property, sales, agency, marketing knowledge) powering all agents via RAG. Future: 3D tours, Gaussian splatting walkthroughs as a premium listing experience. Detail: `14`, with the future-state property experience in `03-future-state-architecture.md §9`.

## 6. Interface Strategy: "WhatsApp-First, Dashboard-Complete"

| Interface | Role | Phase |
|---|---|---|
| **WhatsApp** | The agency's *command line*. Both customer-facing conversations AND the agency's own interface to its AI employee ("show today's hot leads", "follow up with everyone who saw Lodha Park"). | Now (exists in `ai-employee/`) — formalize |
| **Dashboard** | Full CRM, analytics, configuration, audit, billing. The trust surface. | Now — exists, needs consolidation |
| **Voice** | Inbound/outbound calls for customers; later voice command for agents. | Phase 2–3 |
| **Mobile app** | Agent-on-the-go: visits, check-ins, lead capture at site. | Phase 4 (future) |

## 7. Product Principles

1. **Grounded, never hallucinated.** Every customer-facing AI answer must cite CRM/Inventory/KB data. If the system doesn't know, it says so and creates a task for a human.
2. **Human-in-the-loop by default, autonomous by earned trust.** Agencies start with approval queues (AI drafts, human sends) and graduate workflows to full autonomy per-tenant, per-workflow.
3. **Every conversation ends in a CRM outcome.** Lead created/updated, score changed, task created, visit booked, or explicitly closed with a reason.
4. **Tenant isolation is sacred.** Data, credentials, agent memory, automation runs, and billing are isolated per tenant (see `15-security-architecture.md`).
5. **Channel-agnostic core, channel-native experience.** One conversation engine; per-channel adapters respect each platform's rules (24h windows, template policies, comment etiquette).
6. **Sell outcomes, not tokens.** Customers buy plans and credits denominated in business units (conversations, minutes, listings, creatives) — never tokens (see `17-cost-and-billing-architecture.md`).
7. **Evolve, don't rewrite.** The existing Lambda/DynamoDB/Express stack is the foundation; we strangle it into the target architecture incrementally (see `18-migration-strategy.md`).

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
| Horizontal CRMs | Zoho, HubSpot, Kommo | Vertical depth: site visits, projects/towers/units inventory, portal automation, RERA-aware docs, Hinglish voice. |
| Marketing agencies | Local social agencies | 10x cheaper, always-on, closed-loop to actual leads. |

**Moat thesis:** the compounding asset is the *tenant's operational graph* — conversations × inventory × outcomes — which makes every engine smarter and switching painful, plus the integration lattice (portals, Meta, telephony, DLT compliance) that is tedious to replicate.

## 10. Phased Ambition (summary — full roadmap in `21-roadmap.md`)

- **Phase 0 (now):** Stabilize CRM core + auth/RBAC; formalize what exists (WhatsApp AI employee, AI calling, marketing system) behind a single platform API.
- **Phase 1:** Lead Acquisition Engine GA (WhatsApp + Meta Lead Ads + website chat) with qualification, scoring, assignment; approval-queue autonomy.
- **Phase 2:** AI Sales Assistant grounded on Knowledge/RAG; Follow-up Automation journeys; Instagram/Facebook DMs & comments.
- **Phase 3:** Voice GA (inbound + compliant outbound); Marketing system GA; portal browser automation beta.
- **Phase 4:** Agentic operations at scale (AgentCore migration where justified), mobile app, analytics suite, 3D property experience pilots.

## 11. Explicit Non-Goals (next 18 months)

- Building a consumer-facing property portal (we serve agencies, not home-buyers directly).
- Payments/escrow between buyers and agencies.
- Building our own foundation models or fine-tuning at scale.
- iBuying, mortgage origination, or transaction management beyond document handling.
- Replacing the agent — the product makes agents superhuman; it does not disintermediate them.
