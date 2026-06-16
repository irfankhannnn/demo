# 31 — Internal Operations System Overview

> **Phase:** 4 (after core product Phases 0–3 launch) · **Duration:** Weeks 21–32 (Q3 2026+) · **Team:** 8–12 people + 20 agent personas · **Status:** Architecture & sequencing design

---

## What Is This System?

The **internal operations system** is the AI-powered machinery Cloudberry runs to acquire, convert, and retain customers. It is **not part of what we sell** — it is how we build the business.

**Example flows:**
- Marketing team: brief agent → agent researches competitor, writes campaign copy, designs banner, creates reel, schedules on IG/FB, reports ROAS
- Sales team: lead scoring ML model runs on CRM → agent identifies hot prospects → drafts outreach → sends WhatsApp → monitors reply rate
- Operations team: daily dashboard agent wakes up, pulls Razorpay revenue, pipeline velocity, churn rate, publishes to Slack + Sheets
- Product team: customer feedback researcher monitors Reddit/Twitter/ProductHunt → extracts themes → drafts feature bullets for roadmap meeting

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Internal Operations Layer                     │
│                                                                   │
│  20 Agent Personas × 6 Teams                                     │
│  ├─ Product & Engineering (architect, sentry, pr-commander)      │
│  ├─ Market Intelligence (trend-hunter, deep-researcher, oracle)  │
│  ├─ Creative (brand-strategist, designer, video, voice, copy)   │
│  ├─ Growth (media-buyer, ab-optimizer, lead-scraper)            │
│  ├─ Sales & Nurture (sdr, nurture-bot)                          │
│  └─ Operations (pipeline-manager, analytics, finance-tracker)    │
│                           ↓                                       │
│  7 Internal MCP Servers  (Content, Campaign, Analytics, etc.)    │
│                           ↓                                       │
│  External Tools          (Higgsfield, Meta-Ads, Blotato,        │
│                           Razorpay, PostHog, Brevo, etc.)       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    Cloudberry's GTM
              (content, leads, campaigns, decisions)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Product Layer (Phases 0–3)                    │
│                                                                   │
│  10 Agent Personas (Router, Sales Asst, Qualifier, Scorer, etc.) │
│  ├─ Tenant-facing (agencies buy these)                           │
│  ├─ 11 Business Domain MCP Servers                               │
│  ├─ Conversation backbone (EventBridge + SQS)                    │
│  └─ Multi-tenant CRM + Subscriptions                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Key property:** Operations agents have access to **different data** than product agents:
- Operations: Razorpay (revenue), PostHog (usage), Brevo (email), Google Sheets (sales pipeline), Slack (team)
- Product: Tenant CRM (leads, contacts, properties), conversation history, audit log

Both systems are in the same AWS account, same Lambda infra, same Cognito (but different role/policy).

---

## 6 Teams & 20 Agent Personas

### Team 1: Product & Engineering (The Builders)
| Persona | Role | Autonomy | Primary Tools |
|---|---|---|---|
| **architect** | Codebase analysis, module planning, tech debt tracking | Level 0 (draft only) | Git, GitHub Issues, Slack |
| **sentry** | Security scanning, vulnerability detection, dependency audits | Level 0 | GitHub Security, SAST tools, Slack |
| **pr-commander** | PR review, performance regression detection, test coverage | Level 1 (auto-approves docs-only PRs) | GitHub, Slack, Analytics |

**Workstream:** Product release cycle. Architect spikes features; sentry scans; pr-commander gates merges.

---

### Team 2: Market Intelligence (The Strategists)
| Persona | Role | Autonomy | Primary Tools |
|---|---|---|---|
| **trend-hunter** | Social listening, competitor tracking, feature gap analysis | Level 1–2 | Twitter, Reddit, Hacker News, Research MCP |
| **deep-researcher** | ICP firmographic mapping, cohort analysis, market sizing | Level 1 | SerpAPI, Perplexity, Google Sheets, Research MCP |
| **oracle** | Predictive: churn risk, feature ROI, TAM expansion | Level 0–1 | PostHog, Razorpay, Postgres analytics | 

**Workstream:** Monthly competitive snapshot. Trend-hunter monitors, deep-researcher investigates, oracle scores opportunities.

---

### Team 3: Creative Production (The Content Factory)
| Persona | Role | Autonomy | Primary Tools |
|---|---|---|---|
| **brand-strategist** | Brand identity, Hinglish manifesto, tagline direction | Level 0 | Content MCP, Slack, Figma |
| **nano-designer** | Ad banners, carousel images, TikTok thumbnails | Level 0 | Higgsfield MCP, Remotion, Slack |
| **motion-engineer** | Reels, short-form videos (Remotion + ElevenLabs + FFmpeg) | Level 0 | Remotion, ElevenLabs, Blotato, Slack |
| **ugc-planner** | UGC script direction, actor/voice casting, storyboards | Level 0 | Content MCP, Slack, Google Docs |
| **orator** | Voiceovers (ElevenLabs), subtitle generation, regional dubs | Level 0–1 | ElevenLabs MCP, Blotato, Slack |
| **landing-page-builder** | Static HTML/CSS landing pages, conversion optimization | Level 0 | Content MCP, Figma, Vercel, Slack |
| **seo-content-writer** | Blog posts, SEO keyword targeting, editorial calendar | Level 0–1 | Content MCP, Workspace MCP (Sheets), Slack |

**Workstream:** Campaign sprints. Brand-strategist sets direction; team produces assets in parallel; motion-engineer orchestrates video delivery.

---

### Team 4: Growth & Ad Ops (The Scalers)
| Persona | Role | Autonomy | Primary Tools |
|---|---|---|---|
| **media-buyer** | Meta/Google Ads campaigns, budget allocation, audience testing | Level 1 | Meta-Ads MCP, Analytics MCP, Slack |
| **ab-optimizer** | ROAS/CPA monitoring, creative rotations, winner scaling | Level 1–2 | Analytics MCP, Campaign MCP, Slack |
| **lead-scraper** | Lead generation (Google Maps, B2B databases), enrichment | Level 1 | Research MCP, Razorpay (credits tracking), Slack |

**Workstream:** Campaign performance loop. Media-buyer launches; ab-optimizer monitors daily; lead-scraper feeds prospecting list.

---

### Team 5: Sales & Lead Nurture (The Converters)
| Persona | Role | Autonomy | Primary Tools |
|---|---|---|---|
| **sdr** | Outbound prospecting (WhatsApp, email, LinkedIn), objection handling | Level 2 | Workspace MCP (Sheets + Slack), Brevo, AiSensy |
| **nurture-bot** | Automated follow-ups, trial signup → paid conversion sequences | Level 2 | Workspace MCP, Brevo, Analytics MCP |

**Workstream:** Pipeline management. SDR sends outreach; nurture-bot follows up; operations pipeline-manager tracks conversion.

---

### Team 6: Operations (The Trackers)
| Persona | Role | Autonomy | Primary Tools |
|---|---|---|---|
| **pipeline-manager** | CRM pipeline tracking, daily/weekly summaries, velocity metrics | Level 2 | Workspace MCP (Sheets), Razorpay MCP, Analytics MCP, Slack |
| **finance-tracker** | Revenue tracking, cohort LTV, CAC, runway calculation | Level 1 | Razorpay MCP, Campaign MCP, Workspace MCP, Slack |
| **analytics-reporter** | Dashboards, KPI snapshots, monthly business review deck | Level 1 | Analytics MCP, PostHog, Google Sheets, Slack |

**Workstream:** Daily/weekly health checks. Trackers wake up, pull data, push summaries to Slack + dashboards.

---

## Data Sources & MCP Interfaces

### Operational Data (What the MCPs connect to)

| Data Source | Owned By | How Accessed | Via MCP |
|---|---|---|---|
| **Razorpay** | Revenue engine | REST API (verified webhook + balance) | Campaign MCP (spend), Finance MCP (revenue) |
| **PostHog** | Product analytics | REST API | Analytics MCP (events, funnels, cohorts) |
| **Brevo** | Email / SMS outreach | REST API | (future: Brevo MCP for list mgmt, campaigns) |
| **Google Sheets** | Sales pipeline, roadmap, planning | Google Sheets API | Workspace MCP (read/write) |
| **Slack** | Team communication | Slack API | Workspace MCP (alerts, summaries) |
| **Meta Ads** | Paid campaigns | Meta Marketing API | (external: Meta-Ads MCP) |
| **Blotato** | Social scheduling | Blotato API | Scheduling MCP (queue, post) |
| **Git repo** | Content templates, prompts, brand kit | S3 (via Content MCP) | Content MCP (read templates) |

### Agents' Read/Write Patterns

**Read:**
- Analytics agent reads PostHog (daily stats)
- SDR reads Sheets (prospect list) + Brevo (email history)
- Trend-hunter reads Research MCP (competitor feeds)

**Write:**
- Pipeline-manager writes Sheets (move deals)
- Media-buyer writes Campaign MCP (log ad spend)
- Motion-engineer writes Blotato (queue video)

---

## Agent Autonomy Model

Starts **conservative** (humans approve everything); graduates to autonomy with evidence.

```
Level 0 — Suggest
  Agent drafts → human edits + approves → executes
  Default for: copy, design, social posts, outreach, financial decisions

Level 1 — Approve
  Agent composes → human one-tap approves → auto-executes
  For: research summaries, simple metric reports, campaign scheduling

Level 2 — Auto + Notify
  Agent acts autonomously → human notified → can undo
  For: pipeline updates, social posts (scheduled), follow-up emails, routine reports

Level 3 — Auto (Earned, Rare)
  Fully autonomous; no review needed
  Only for: simple metric calculations, scheduled task execution
```

**Graduation criteria (per workflow):**
- 30–50 successful executions with zero human intervention
- <2% error rate (evaluated monthly)
- Zero "bad outcomes" (spam complaints, incorrect data, policy violations)
- Agent evals pass (task completion, quality gates)

Example: Media-buyer campaign scheduling
- Weeks 1–2: Level 0 (agent drafts, human approves each campaign)
- Weeks 3–6: Level 1 (agent schedules, human approves once; auto-launches)
- Weeks 7–8: Level 2 (agent schedules autonomously; human reviews daily dashboard)
- Week 9+: Level 1–2 (human decides based on track record)

---

## Governance & Approval Gates

### High-Risk Actions (Always Level 0 or 1)

- **Financial:** Anything touching Razorpay (refunds, budget allocation, credits)
- **Legal:** Public commitments, terms/privacy changes, customer support escalations
- **Compliance:** Data access logs, regulatory responses
- **Public presence:** Blog posts, official social accounts, ads targeting specific groups

### Medium-Risk (Level 1 or higher)

- **Marketing:** Campaign briefs (brand fit), reel scripts (quality gate), email sequences (tone check)
- **Sales:** Prospect lists (data accuracy), outreach templates (objection handling), follow-up timing

### Low-Risk (Level 2+)

- **Operations:** Pipeline updates, metric calculations, routine reports, scheduled posts

---

## Success Metrics (Phase 4)

| Metric | Target | Owner |
|---|---|---|
| Time from brief to campaign live | <2 days | Creative + Growth |
| Campaign ROAS | >3:1 (payback) | Media-buyer + ab-optimizer |
| Lead cost | <$10/qualified lead | Lead-scraper + ab-optimizer |
| Sales pipeline velocity | +20% contacts → +10% conversion | SDR + nurture-bot |
| Content production cadence | 4 reels/week + 8 posts/week | Creative factory |
| Churn insights latency | <24h (trended) | Operations team |

---

## Technology Stack (Reuses Phases 0–3)

**Runtime:** AWS Lambda + Fargate (same as product)  
**Auth:** Cognito M2M (machine-to-machine for agents)  
**Framework:** Strands Agents SDK (T2 agents for complex workflows)  
**External APIs:** Meta, Blotato, Higgsfield, Razorpay, PostHog, Brevo, SerpAPI, Perplexity  
**Storage:** S3 (content templates), DynamoDB (audit log of agent actions), PostgreSQL (analytics)  
**Orchestration:** Step Functions (multi-step workflows, approvals, retries)

---

## Comparison: Operations vs. Product

| Aspect | Operations | Product |
|---|---|---|
| **Tenancy** | Single-tenant (Cloudberry only) | Multi-tenant (agencies) |
| **Agents** | 20 personas, T2 (Strands) | 10 domain agents, T0–T2 |
| **RBAC** | Simple (team-based) | Strict (tenant + user + role) |
| **Approval flow** | Human in loop, graduated autonomy | Approval queue, tenant-controlled |
| **Data** | Business ops (Razorpay, PostHog, etc.) | Tenant CRM (leads, etc.) |
| **Compliance** | Minimal (internal use) | High (DPDP, financial, DLT) |
| **Monetization** | Cost center (overhead) | Revenue driver (subscription + credits) |
| **Iteration speed** | Fast (no customer impact) | Measured (production constraints) |

---

## Why Phase 4, Not Phase 0?

1. **Dependency:** Operations agents need stable product APIs (MCP tools from Phase 1–3) to read metadata
2. **ROI:** Spend 3 weeks building ops is opportunity cost when Phase 1 (customer acquisition engine) is open
3. **Decoupling:** Ops can iterate independently; doesn't risk product release
4. **Hiring:** Ops team composition different (marketers, sales, ops) from product team (engineers)

**Decision:** Complete Phases 0–3, hit product-market fit with 10 agencies, then scale ops in parallel to 100 agencies.
