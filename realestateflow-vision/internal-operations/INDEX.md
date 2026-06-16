# Internal Operations — Document Index

> **Audience:** GTM, product, operations teams (internal use only) · **Phase:** 4 (after Phases 0–3) · **Status:** Architecture & detailed implementation plans

---

## Quick Navigation

### What Is This?
Start here if you're new:
- **README.md** — Overview: what internal ops is, how it differs from product, team structure, why Phase 4

### Strategic Architecture (Planning/Design)
For leaders deciding roadmap + budget:
- **31-internal-ops-overview.md** — System architecture, 6 teams × 20 agents, data sources, autonomy model, governance
- **32-marketing-agent-architecture.md** — Marketing Agent (T2 Strands), brief→launch→ROI workflow, approval gates
- **33-content-creation-pipeline.md** — Image/video/voice/text workflows; Hinglish content rules; Remotion + ElevenLabs
- **34-gtm-skills-analysis.md** — Existing 60+ skills; which stay internal, which productize, migration paths
- **35-internal-mcp-servers.md** — 7 internal MCPs: Content, Campaign, Analytics, Scheduling, Research, Workspace, Events

### Team Coordination & Execution
For team leads running operations:
- **36-team-agent-coordination.md** — 6 teams in detail; workstreams; hand-offs; communication protocol
- **phase-4-detailed-implementation.md** — Week-by-week plan; resource allocation; dependencies; launch sequence

---

## Document Matrix

| Doc | Purpose | Audience | Length | Dependencies |
|---|---|---|---|---|
| README.md | Overview; product vs. ops distinction | All | 2 min | — |
| 31 | Architecture; teams; autonomy model | Leaders, team leads | 15 min | README |
| 32 | Marketing Agent design + workflow | Product, Growth, Creative | 20 min | 31 |
| 33 | Content creation (image/video/voice) | Creative, Growth | 15 min | 31 |
| 34 | Skills analysis; migration paths | Engineering, Product | 10 min | Vision doc 06 |
| 35 | 7 internal MCPs; tool definitions | Engineering | 15 min | 31, 34 |
| 36 | Team workstreams; hand-offs; comms | Team leads | 10 min | 31 |
| phase-4 | Week-by-week implementation plan | Project manager, leads | 30 min | All above |

---

## Key Decisions (TL;DR)

| Decision | Rationale |
|---|---|
| **Phase 4, not Phase 0** | Focus on product first (Phases 0–3). Ops can iterate independently once product is stable. |
| **Separate folder from product** | No coupling; different RBAC, compliance, data, deployment model. |
| **20 agents × 6 teams** | Mirrors GTM org structure; distributed decision-making; easier handoffs. |
| **T2 (Strands framework)** | Internal workflows (research, planning, multi-step) need memory + planning; cheaper iteration than Phase 1 T0/T1. |
| **Conservative autonomy (Level 0 default)** | Humans approve before publish/send/launch; graduate with evidence. |
| **No productization of ops skills** | Founder's competitive advantage is ops execution; don't leak playbooks into product UI. |

---

## How to Use This Folder

### For Product Planning
- Read README + 31 → understand how ops feeds product roadmap
- Read 34 → which skills become productized? (lead-enrichment, nurture, outreach → product add-ons?)
- Use for ROI calculation: ops cost vs. acquisition value

### For GTM / Marketing
- Read 32 → Marketing Agent workflow; approval gates; reporting
- Read 33 → content production pipeline; Hinglish rules
- Use as playbook for campaign sprints

### For Engineering
- Read 31 (data sources) + 35 (MCPs) → design internal APIs + event schemas
- Read 34 + 35 → which existing product MCPs can ops read from?
- Implementation: Phase 4 spikes Strands integration (Week 21)

### For Operations / Finance
- Read 31 (teams + autonomy) + 36 (workstreams) → staffing, dependencies, critical paths
- Read phase-4 → week-by-week plan; resource allocation
- Use for hiring: which roles do we need? (Designer, motion engineer, SDR, etc.)

---

## Relationship to Phases 0–3 (Product)

### What's Different

| Dimension | Phases 0–3 (Product) | Phase 4 (Operations) |
|---|---|---|
| **Tenancy** | Multi-tenant (agencies) | Single-tenant (Cloudberry) |
| **Risk** | High (revenue-impacting, compliance-heavy) | Low (internal use only) |
| **Autonomy** | Conservative (approval queue default) | Higher (Level 1–2 typical) |
| **Iteration speed** | Slow (QA gates, backward compatibility) | Fast (no customer impact) |
| **Data** | Tenant CRM (leads, contacts, properties) | Ops data (Razorpay, PostHog, Sheets) |
| **Agents** | 10 domain-bounded agents (Router, Sales Asst, Voice, etc.) | 20 GTM personas (cross-functional) |

### Data Sharing (One-Way)

```
Product (Phases 0–3) writes:
  ├─ Subscription events (trial signup, conversion, churn)
  ├─ Feature usage (LLM tokens, leads processed, agents called)
  └─ Revenue (Razorpay webhooks)
       ↓
Operations (Phase 4) reads:
  ├─ Analytics MCP (PostHog product funnel, cohort retention)
  ├─ Campaign MCP (revenue attribution, CAC)
  └─ Workspace MCP (Sheets: sales pipeline, roadmap)
       ↓
Operations agents generate:
  └─ Campaigns, content, research, reports (one-way; no write-back to product)
```

Operations does **not write to tenant CRM** — it reads product metrics only.

---

## Critical Path for Phase 4

1. **Week 1–2:** Spike Strands Agents SDK integration (can we call other agents from main agent?)
2. **Week 3–4:** Build 7 internal MCPs (MCP-ify Razorpay, PostHog, Google Sheets, Blotato, etc.)
3. **Week 5–6:** Marketing Agent MVP (brief → strategy → content draft; no auto-publishing yet)
4. **Week 7–8:** Creative pipeline (Higgsfield + Remotion integration; voice generation)
5. **Week 9–10:** Approval flow + human integration (manager reviews campaign before launch)
6. **Week 11–12:** Launch 3 real campaigns; validate ROAS, approval workflow, daily optimization

---

## File Ownership (Internal)

| File | Owner | Edit Permission |
|---|---|---|
| README.md | Product Manager | All team leads |
| 31, 32, 33, 35 | Product / Engineering | PM + eng lead |
| 34 | Engineering + Product | Architect + PM |
| 36 | Operations Lead | Team leads |
| phase-4 | Project Manager | PM + exec |

Changes require async approval (Slack thread or GitHub PR comment) from owner.

---

## Contact / Questions

- **Product decisions:** @cto
- **GTM roadmap:** @growth-lead
- **Engineering spikes:** @architect
- **Operations planning:** @ops-manager
