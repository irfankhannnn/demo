# Internal Operations — GTM, Marketing, Content (Phase 4+)

> **Scope:** Foundational team productivity & go-to-market automation. Implemented **after** core product (Phases 0–3) reaches stability and agency features are production-ready.

---

## Overview

This folder contains the architecture and implementation plans for the **internal GTM and content operations system** — the machinery that runs Cloudberry's business, distinct from what we sell to agency tenants.

**Key principle:** The **product** (what agencies buy) is the RealEstateFlow AI Agency OS (Phases 0–3). The **operations** (how we run the company) are in this folder. They are separate systems with different audiences, constraints, and deployment models.

---

## Why Separate from Phases 0–3?

| Dimension | Product (Phases 0–3) | Operations (Phase 4+) |
|---|---|---|
| **Audience** | Real estate agency tenants (paying customers) | Cloudberry team (internal ops) |
| **Constraint** | Compliance (DPDP, DLT, financial), multi-tenant isolation | Team productivity, no compliance burden |
| **Agents** | 10 domain-bounded agents (Lead Router, Sales Asst, Voice, etc.) | 20 GTM personas across 6 teams |
| **Data** | Tenant's CRM (leads, contacts, properties) | Content repos, campaign data, research, analytics |
| **MCP Tools** | 11 business domain servers (Lead, Property, Visit, etc.) | Marketing/Content/Scheduling MCPs (Higgsfield, Meta-Ads, Blotato, etc.) |
| **Skills** | Productized (become MCP tools); business rules in tool layer | Internal tooling; stay in skill scripts; not productized |
| **Autonomy** | Start conservative (Level 0 approval queue); graduate with evals | High (agents run research, drafts, campaigns autonomously) |
| **Infra** | Lambda/Fargate (cost-sensitive, serverless); Cognito + RBAC | Same (cost efficiency) but no multi-tenancy requirements |

---

## Folder Structure

```
realestateflow-vision/internal-operations/
├── README.md (this file)
├── 31-internal-ops-overview.md — What operations system is, phases, teams, data flow
├── 32-marketing-agent-architecture.md — Marketing Agent (Strands T2), campaign playbooks, creative MCPs
├── 33-content-creation-pipeline.md — Remotion + image/video/voice gen workflows; Hinglish content rules
├── 34-gtm-skills-analysis.md — Existing 60+ skills; which stay as-is, which become productized
├── 35-internal-mcp-servers.md — 7 internal MCPs: Content, Campaign, Analytics, Scheduling, Research, Workspace, Events
├── 36-team-agent-coordination.md — 20 personas × 6 teams; workstreams, hand-offs, communication protocol
└── phase-4-detailed-implementation.md — Week-by-week plan for ops launch
```

---

## What's In This Folder

### Strategic Documents (31–35)

**31 — Internal Ops Overview**
- What internal ops system is: AI-powered business machinery, separate from product
- 7 teams × 20 agent personas + 60+ skills
- Governance model: agent autonomy by team + domain
- Data sources: content repos, Razorpay, PostHog, Brevo, Google Sheets (sales pipeline)
- Deployment: same AWS infra; Cognito M2M for agent auth

**32 — Marketing Agent Architecture**
- Strands T2 agent (full framework, planning, memory, multi-turn)
- Lifecycle: brief → research → script → content gen → campaign creation → scheduling → publish → measure ROI
- Tools: Marketing MCP (Higgsfield, Meta-Ads, Blotato, Remotion bridges)
- Approval gates: human review before publishing to IG/FB/TikTok (legal risk)
- Closed-loop: Meta lead form → CRM → tracks ROAS per campaign

**33 — Content Creation Pipeline**
- Image: Higgsfield (Nano Banana Pro, Gemini 3) → Remotion stills
- Video: Remotion (React-based) → 15–30s reels; FFmpeg post-process
- Voice: ElevenLabs TTS (Hindi/English/Hinglish)
- Text: Claude for copy (Hinglish tone: 70% English, 30% romanized Hindi)
- Workflow: prompt → LLM draft → human edit → asset → queue in Blotato → schedule → publish

**34 — GTM Skills Analysis**
- Existing 60+ skills (brand-strategy, video-production, remotion-video, ugc-scripts, voiceover-gen, landing-page, seo-blog, etc.)
- Which are **internal only** (stay as skill scripts): strategy, competitor research, engineering, market intel
- Which are **migration candidates** for product (productized): lead-enrichment, nurture, outreach, pipeline-tracking
- Which are **new** (design in Phase 4): AI-powered brand messaging, hypothesis testing, competitive analysis

**35 — Internal MCP Servers** (7 total)
- **Content MCP** — Git-based prompts, templates, brand kit, style guide
- **Campaign MCP** — Razorpay data, conversion funnels, lead sources, budget allocation
- **Analytics MCP** — PostHog events, Brevo email metrics, Google Analytics, conversion attribution
- **Scheduling MCP** — Blotato queue, publish calendar, best-time-to-post AI
- **Research MCP** — SerpAPI (competitor search), Perplexity (trend research), Reddit/Twitter sentiment
- **Workspace MCP** — Google Sheets (sales pipeline, roadmap), Slack (message sending for alerts), Notion (docs)
- **Events MCP** — Calendar (launches, webinars), signup tracking, feedback loops

**36 — Team Agent Coordination**
- 6 teams: Product & Eng, Market Intel, Creative, Growth, Sales, Operations
- 20 agent personas (architect, sentry, pr-commander, trend-hunter, etc.)
- Workstreams: product releases, competitive tracking, campaign planning, content sprints, lead gen, reporting
- Hand-off protocol: agent A outputs → agent B inputs (e.g., researcher → copywriter → designer → media buyer)

---

## Timeline: When This Launches

**Phase 0–1 (Weeks 1–13):** Focus entirely on product foundation + WhatsApp wedge. Internal ops stay manual (founder + small team).

**Phase 2–3 (Weeks 14–20):** Parallel track: internal ops agents spin up in beta (internal-only tools, no customer-facing impact).

**Phase 4 (Weeks 21–32, Q3 2026+):** Full internal ops system live.
- Marketing Agent: autonomous campaign planning + content gen + scheduling
- Content Pipeline: fully automated image/video/copy generation
- 20 agent personas: running GTM, content, research, sales support
- Analytics loop: daily dashboard of campaign performance, pipeline health, agency churn

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Separate folder from Phases 0–3** | No coupling to product release cycle; internal ops can iterate faster; different RBAC/compliance |
| **Same AWS infra** | Cost efficiency; leverage existing Lambda, Cognito, DynamoDB infrastructure |
| **Strands T2 agents** (vs. T0/T1) | Internal tasks (research, planning, multi-step workflows) benefit from planning + memory; cheaper to iterate |
| **Blotato for scheduling** | Own scheduling logic (timing optimization, format adaptation per platform); integrate via MCP |
| **Hinglish content rule** | Product is for Indian agencies; founder teams use Hinglish for community/brand resonance |
| **Google Sheets as sync source** | Non-technical team members (growth, sales) manage pipeline in Sheets; agents read + write via MCP |
| **No productization of ops skills** | Founder's competitive advantage is ops execution; don't leak internal playbooks into product UI |

---

## Governance

**Agent Autonomy by Team:**

- **Product & Eng:** Level 0 (drafts only, architect reviews)
- **Market Intel:** Level 1–2 (agents write research autonomously; human validates before publishing)
- **Creative:** Level 0–1 (human always edits copy/design before asset creation)
- **Growth (Media Buyer):** Level 1 (agent plans campaigns; human approves budget + target before launch)
- **Sales & Nurture:** Level 2 (agents send outreach; recorded in Brevo; team monitors for spam complaints)
- **Operations:** Level 2 (agents update pipeline + analytics dashboards autonomously; human checks daily)

**Decision-making:**
- Agent proposes → human approves (default)
- Autonomy graduation: tracked eval pass rates + zero-incident track record (6–8 weeks per workflow)

---

## Handoff to Product Team

When core product (Phases 0–3) reaches GA and internal ops system is stable:

1. **Productize select skills** (lead-enrichment, nurture, outreach, pipeline-tracking) → become paid tiers / add-ons
2. **Market the internal system** → agencies can rent Cloudberry's GTM agents as a service (premium tier)
3. **Data moat** → proprietary playbooks + eval results become source of competitive advantage

This is the long-term monetization path: sell the product first (Phases 0–3); then sell the operations system (Phase 4+) to mature agencies.

---

## Next Steps

1. **Confirm scope** — are the 7 internal MCPs the right set? Any gaps?
2. **Prioritize Phase 4 launches** — which team/workstream goes first? Likely: Marketing Agent (high ROI for customer acquisition)
3. **Spike Strands integration** — confirm Strands SDK works for internal ops tasks (more complex than Phase 1 T0/T1)
4. **Design approval gates** — which workflows need human review? Where's the legal risk?
