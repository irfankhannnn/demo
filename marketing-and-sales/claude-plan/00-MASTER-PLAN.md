# Growth Intelligence System — Master Plan
> Status: PLANNING (not yet built) | Date: 2026-05-12

---

## The Core Insight

Your existing system (20 agents, 23 skills) is built for **marketing execution** — creating content,
running ads, writing emails. It answers "how do we produce things?"

The framework you shared asks a fundamentally different question: **"what should we do and why?"**

That is a **decision intelligence layer** — and it is completely absent from the current system.

Without it, your agents are skilled workers with no manager. They can create a beautiful landing page,
but can't tell you whether the headline should target Rajesh Bhai (agency owner) or Dev bhai (solo agent).
They can run Meta Ads, but can't tell you whether ₹1L should go to Mumbai or Pune.

This plan builds that missing layer.

---

## What We Are Building

Three capability layers on top of the existing execution system:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: DECISION INTELLIGENCE  (NEW - this plan)          │
│  growth-strategist | messaging-optimizer | experiment-brain  │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: DATA INTELLIGENCE      (NEW - this plan)          │
│  funnel-analyzer | channel-intel | retention-analyst         │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: EXECUTION              (EXISTS - 20 agents)        │
│  media-buyer | landing-page-builder | sdr | seo-writer ...   │
└─────────────────────────────────────────────────────────────┘
```

The new layers feed intelligence INTO the existing execution agents.
They do not replace them — they direct them.

---

## What Gets Built

### New Agents (3)
| Agent | Role | Priority |
|-------|------|----------|
| `growth-strategist` | Master brain — synthesizes all data into strategic direction | P0 |
| `experiment-designer` | Hypothesis generation + test design + winner analysis | P1 |
| `retention-analyst` | Cohort analysis, churn signal detection, win-back triggers | P1 |

### New Skills (7)
| Skill | Purpose | Priority |
|-------|---------|----------|
| `growth-intel` | Weekly growth synthesis: what's working, what isn't, what to do | P0 |
| `funnel-analysis` | Reads product analytics exports → finds activation failures, drop points | P0 |
| `messaging-optimizer` | Generates ICP-specific copy from real conversion data | P0 |
| `retention-analysis` | Cohort analysis, churn patterns, retention health score | P1 |
| `channel-cac-analysis` | CAC by channel, budget reallocation recommendations | P1 |
| `experiment-design` | Structured A/B hypotheses with scoring and statistical guidance | P1 |
| `competitive-intel` | Competitor positioning gaps, market movement alerts | P2 |

### Sub-Agents (how new agents call existing ones)
Documented in `04-TRIGGER-MAP.md`.

---

## What We Are NOT Building

- Real-time analytics dashboards (we use file exports from PostHog, not live APIs — Phase 1)
- LangGraph / n8n orchestration (Claude's agent system handles this)
- Separate data warehouse (ClickHouse, Qdrant) — file-based to start
- PhantomBuster social scraping (expensive, lower priority)
- Full autonomous GTM (Phase 3, after data proves what works)

Early stage means: **get the intelligence layer working first, then automate what's proven.**

---

## Files In This Plan

| File | Contents |
|------|----------|
| `00-MASTER-PLAN.md` | This file — overview and index |
| `01-GAP-ANALYSIS.md` | What exists vs. what's missing, prioritized |
| `02-ARCHITECTURE.md` | System design, data flow, layer interactions |
| `03-NEW-AGENTS.md` | Detailed specs for 3 new agents |
| `04-NEW-SKILLS.md` | Detailed specs for 7 new skills |
| `05-TRIGGER-MAP.md` | What calls what, when, under what conditions |
| `06-PHASES.md` | Phased build order with Go/No-Go criteria |

---

## The One-Sentence Goal

Build an AI system that can look at your product data, campaign data, and market data
and tell you: **who converts, why they churn, which channel to invest in, and what message to test next.**
