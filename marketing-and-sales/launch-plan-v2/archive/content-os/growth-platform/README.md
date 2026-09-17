# RealEstateFlow Growth Platform

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/README.md`.

> The **AI-powered Growth Platform** that turns the Content OS into a closed-loop, measured, automatable growth engine — from a published reel to an expanded customer.

This layer operationalizes the Content/Attention/Distribution/Sales/Automation OS into **production-ready, engineering-backed systems** grounded in the real stack (Express + AWS Lambda, DynamoDB single-table `PK/SK/GSI`+`TENANT#`, `notificationDynamodbService` scheduled engine, `ai-calling-service`, RBAC). It does **not** recreate existing work — it consolidates and builds on it (see `gap-analysis.md`).

## The lifecycle it powers
```
Content → Attention → Distribution → Conversation → Demo → Trial
   → Activation → Paid → Retention → Referral → Expansion
        (measured + scored + automatable at every step)
```

## Subsystems
| Folder | System | Phase | Key entities |
|---|---|---|---|
| `gap-analysis.md` | Audit + build order + dedup/conflict rules | 1 | — |
| `attribution/` | Multi-touch + content attribution (8 channels) | 3, 8 | TOUCHPOINT, ATTRIBUTION_PATH, MKT_EVENT |
| `activation/` | Activation framework, milestones, score, workflows | 4 | SCORE(activation), MKT_EVENT |
| `onboarding/` | Product-led + assisted onboarding | 4 | — |
| `retention/` | Lifecycle retention, dormancy, expansion | 4 | — |
| `lead-scoring/` | Lead scoring (FIT/SOURCE/INTENT/ENGAGEMENT) | 7 | SCORE(lead) |
| `customer-scoring/` | Health / Risk / Expansion / Referral scores | 5 | SCORE(customer) |
| `referrals/` | Referral engine, rewards, anti-abuse | 6 | REFERRAL, REFERRAL_CODE, REWARD_LEDGER |
| `campaigns/` | Paid + organic campaign tracking | — | CAMPAIGN |
| `automations/` | Automation runtime + 12 workflows | 9, 13 | RULE, RULE_RUN, SEQUENCE_ENROLLMENT |
| `integrations/` | Integration registry (extends automation-os) | — | — |
| `ai-agents/` | 6-agent operating model (AG-1..AG-6) | 10 | — |
| `analytics/` | Metric dictionary + 6 role dashboards | 11 | — |
| `implementation/` | Epics, features, stories, designs, backlog, roadmaps | 12, 14 | EP-1..EP-14 |
| `quality-review.md` | Cross-system consistency + conflict resolution | 15 | — |

## Single-source-of-truth map (no forked definitions)
- **Metrics** → `analytics/metric-dictionary.md` (everything references `M-*` IDs).
- **Data model / entities** → `implementation/technical-designs/technical-designs.md` (+ `../implementation/technical-design.md`).
- **Attribution** → `attribution/`.
- **Scoring** → `lead-scoring/` + `customer-scoring/` + `activation/`.
- **Workflows** → `automations/workflow-catalog.md` (supersedes `../automation-os/workflow-map.md`).
- **Roadmap** → `implementation/roadmaps/roadmap-30-60-90-180.md` (extends `marketing-and-sales/launch-plan-v2/month-2-plus/README.md`).
- **Epics** → `implementation/epics/epics.md` (EP-1..EP-14).

## How to use
1. Read `gap-analysis.md` (what's missing + build order).
2. Build in order: **attribution + events (P0) → content-attribution + activation + automation runtime (P1) → referrals (P1) → scoring + dashboards + campaigns (P2) → AI agents (P2) → onboarding/retention product-led (P3).**
3. Engineering pulls from `implementation/` (epics → features → stories → technical-designs → coding-backlog → roadmaps).
4. Operate via `ai-agents/` once instrumented.

## Done = (gap-analysis §8)
A reel (`OPP-*`) → engagement → DM → demo → trial → activation → paid → referral → expansion, fully **traceable, scored, and automatable** in-product, with role dashboards showing where money is made and lost, LTV:CAC ≥ 3:1 and NRR > 100%.
