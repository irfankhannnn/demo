# Phase 1 — Gap Analysis & Audit

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/design-only-backlog.md`.

Comprehensive audit of the existing system (Content OS + Attention/Distribution/Sales/Automation OS) before building the Growth Platform. Purpose: find what's missing, duplicated, or conflicting, and prioritise. This document drives the `growth-platform/` build.

---

## 1. What exists today (baseline)

| Layer | State | Strength | Limit |
|---|---|---|---|
| **Content OS** | Mature | 25 frameworks, 9 characters, 1,000 hooks, 500 CTAs, 520 scored OPP-*, factory, prompts | Generation only — no closed loop to revenue |
| **Attention OS** | Good | scroll-stop model, content→conversation, virality, retention | No instrumentation of the metrics it defines |
| **Distribution OS** | Good | IG/WA/LinkedIn/YouTube/FB + founder engine, subsystems | Publishing is manual/Blotato; no per-channel attribution rollup |
| **Sales OS** | Good | objections, qualification, demo/follow-up/closing/onboarding, journey | Playbooks are human SOPs; not yet productized/automated |
| **Automation OS** | Designed, not built | architecture, 9 automations, integrations, MKT_EVENT model | Spec only; nothing shipped in product; scoring/referral/dashboard described thinly |

**Codebase reality (verified):** Express+Lambda, DynamoDB single-table (`PK/SK/GSI`, `TENANT#`, `EntityType`), `notificationDynamodbService` (scheduled notifications), `ai-calling-service` (Exotel+ElevenLabs), RBAC (Admin/Member). **Leads have no source/UTM/attribution/score today** — the central gap.

---

## 2. Gaps (ranked by leverage)

### P0 — Blocks everything (build first)
| Gap | Why critical | Fix → |
|---|---|---|
| **No attribution** on leads (source/UTM/campaign/contentRef) | Can't see which content/channel creates customers; flying blind | `attribution/` |
| **No event backbone** (`MKT_EVENT`) | No funnel, no automation triggers, no content ROI | `attribution/`, `automations/` |
| **No scoring** (lead/activation/health) | Can't prioritise leads or predict churn | `lead-scoring/`, `customer-scoring/`, `activation/` |

### P1 — Converts attention to revenue
| Gap | Why | Fix → |
|---|---|---|
| **No content-attribution engine** (content→customer) | Can't decide what to make more of | `attribution/content-attribution.md` |
| **No activation system** (milestones/score/aha) | Trials don't convert without engineered activation | `activation/` |
| **No referral engine** (codes/rewards/tracking) | Cheapest CAC channel unbuilt | `referrals/` |
| **No automation runtime** (only SOPs) | Manual = slow speed-to-lead, no win-back | `automations/` |

### P2 — Scales & retains
| Gap | Why | Fix → |
|---|---|---|
| **No customer health/risk/expansion scoring** | Churn invisible until too late | `customer-scoring/` |
| **No dashboard suite** (only 1 KPI doc) | No role-based decision surfaces | `analytics/` |
| **No campaign system** (paid/organic structure + UTM) | Paid spend untracked to revenue | `campaigns/` |
| **No AI agent operating model** to run it | System can't self-operate at scale | `ai-agents/` |

### P3 — Operational polish
| Gap | Why | Fix → |
|---|---|---|
| Onboarding is a Sales-OS human SOP, not product-led | activation depends on it | `onboarding/` |
| Retention is described in Attention OS (content) but not lifecycle (product) | churn prevention | `retention/` |
| Engineering work scattered across `implementation/` + `automation-os/` | needs consolidated epics/backlog/roadmaps | `implementation/` |

---

## 3. Duplicates (consolidate, don't re-create)
- **Attribution** appears in `marketing-and-sales/launch-plan-v2/60-automation/README.md`, `implementation/technical-design.md`, `growth-dashboard.md` → growth-platform `attribution/` becomes the **single source of truth**; older files link to it.
- **Scoring** mentioned in `implementation/technical-design.md` + Sales OS → consolidate definitions in `lead-scoring/` + `customer-scoring/` + `activation/`.
- **Workflows** in `automation-os/workflow-map.md` (9) overlap Phase 13 (12) → `automations/workflow-catalog.md` supersedes and extends; `automation-os/workflow-map.md` gets a pointer.
- **Roadmaps**: `marketing-and-sales/launch-plan-v2/month-2-plus/README.md` exists → extend to 180 in `implementation/roadmaps/`; keep one canonical.
- **Dashboards**: `growth-dashboard.md` (KPI defs) → becomes the metric dictionary; `analytics/` adds role-specific dashboards referencing it.

**Rule:** growth-platform owns the *engineering/operational* truth; existing OS docs own *strategy/content*. Cross-link, never fork definitions.

---

## 4. Conflicts (resolve)
| Conflict | Resolution |
|---|---|
| "WhatsApp as in-code feature" (some content) vs business-memory caveat (workflow-level only) | Keep WhatsApp at workflow/integration level; in-product = WhatsApp Business API integration, not a native CRM feature claim |
| Trial→paid targets differ slightly across Sales OS vs dashboard | Canonicalise in `analytics/` metric dictionary; others reference it |
| "500+ agencies" vs "200+ brokerages" proof numbers | Use defensible lower number publicly; flag `[VERIFY]` (already noted in business-memory §6) |
| Phase numbering across specs | growth-platform uses its own Phase 1–15; maps old phases via this doc |

---

## 5. Missing metrics (to define in analytics/)
North-star (qualified demos/wk + new customers/mo), per-channel CAC + effective CAC, LTV, LTV:CAC, payback, activation rate, week-1 milestone rate, health/risk/expansion scores, referral %, content→customer ROI by `OPP-*`, cohort retention, NRR/expansion. All get formulas + data source + event in `analytics/metric-dictionary`.

---

## 6. Missing engineering (to spec in implementation/)
Attribution fields + `MKT_EVENT` + ingest route + rules engine + sequence orchestration + scoring service + referral entity + dashboard API/UI + webhooks (IG/WhatsApp/Meta Lead Ads) + SQS/EventBridge + GSIs + observability. Consolidated into epics/features/user-stories/technical-designs/coding-backlog/roadmaps.

---

## 7. Build order (drives Phase 2+)
```
P0 Attribution + Events  →  P1 Content-attribution + Activation + Automation runtime
   →  P1 Referrals  →  P2 Customer health + Lead scoring + Dashboards + Campaigns
   →  P2 AI agents (operate it)  →  P3 Onboarding/Retention product-led  →  Roadmaps
```
Never build scoring/dashboards before attribution + events exist. Each subsystem ships independently, multi-tenant, consent-safe.

---

## 8. Success definition
The Growth Platform is "done" when RealEstateFlow can trace **a published reel (`OPP-*`) → engagement → DM → demo → trial → activation → paid → referral → expansion**, with every step measured, scored, and automatable inside the product — and a role-based dashboard shows where money is made and lost.
