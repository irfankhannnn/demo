# Retention System — RealEstateFlow (Lifecycle, Not Content)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/customer-health.md`.

Product-lifecycle retention for a B2B real-estate CRM: in-product engagement loops, habit formation, dormant re-engagement, feature-adoption expansion, retention metrics, early-warning health, and automation triggers. This is *lifecycle* retention (the gap-analysis §2 P3 item) — distinct from Attention-OS *content* retention. Builds on activation (`activation/`) and the customer health score (`technical-design.md` §4.3). Channels reuse `SCHEDULED_NOTIFICATION` + WhatsApp/email/in-app/AI-call (consent-gated). Features per `01-business-memory.md` §3.

---

## 1. Retention model — activation → habit → expansion → advocacy

```
ACTIVATED ──► HABIT (daily core loop) ──► EXPANSION (breadth + plan) ──► ADVOCACY (referral)
 (handoff from         │                        │                          │
  activation/)    SCORE→CUSTOMER          feature adoption            referral.md
                  health score           paywall-upgrade-cro
```

On `customer_activated` (or trial→paid), the entity's SCORE flips `SK=SCORE#LEAD → SCORE#CUSTOMER`; `healthScore` (retention risk) takes over from `activationScore` (`technical-design.md` §4.3 weights). Health is the retention north-star input.

---

## 2. Engagement loops (in-product habit formation)

The retention engine = repeatable daily loops tied to a real broker job-to-be-done. Each loop has a trigger, action, and reward inside the product.

| Loop | Trigger (in-product) | Action | Reward (perceived value) | Feature | Habit metric |
|---|---|---|---|---|---|
| **Daily lead loop** | new enquiry / morning login | log + assign + set follow-up | "kuch miss nahi hua" | Lead Mgmt, Follow-ups | logins/wk, follow-ups set/wk |
| **AI-call loop** | leads needing follow-up | fire AI calls on a batch | "10 ghante wapas" — hot leads surfaced | AI Calling | AI calls/wk, batch size |
| **Pipeline-review loop** | weekly | dashboard "kahan atke" | clarity, control | Dashboards | dashboard views/wk |
| **Khata loop** | deal milestone | log commission/settlement | "hisaab clear, zero jhagda" | Khata | khata entries/mo |
| **Team-visibility loop** (agency) | daily | see who's working what | accountability | Hierarchy/RBAC | members active/wk |

**Habit threshold:** a customer who runs the daily lead loop + AI-call loop ≥3 days/week by week 2 retains strongly (matches activation habit signal). Nudges (below) re-arm whichever loop has gone quiet.

---

## 3. Retention metrics (B2B CRM-appropriate)

A field broker doesn't open a CRM hourly; B2B DAU is the wrong vanity metric — **WAU and login frequency** are the truth signals.

| Metric | Formula | Target | Source event |
|---|---|---|---|
| **WAU/MAU** (stickiness) | active(7d)/active(28d) | ≥ 0.5 | `login` |
| **Login frequency** | distinct login days / 28d | ≥ 12 | `login` |
| **Core-action WAU** | did daily-lead OR AI-call loop in 7d | ≥ 70% of paid | loop events |
| **Feature breadth** | distinct modules used / 28d | ≥ 4 | feature events |
| **AI-call adoption trend** | AI calls this 28d vs prior | rising | `first_ai_call`+call events |
| **Monthly logo churn** | churned / start-of-month | < 5% | `paid` lapse |
| **GRR** | retained MRR / start MRR | ≥ 90% | MRR/plan |
| **NRR (expansion)** | (start + expansion − churn − contraction)/start MRR | ≥ 105% | plan upgrades |
| **DAU** (context only) | active(1d) | not a target | `login` |

All computed nightly by `scoringService` + dashboard read models (`GSI-EventType`). Canonical defs live in `analytics/metric-dictionary`; this file references them.

---

## 4. Customer health score → early-warning (retention risk)

Reuses `technical-design.md` §4.3 — `healthScore` 0–100, stored on `SCORE` (`SK=SCORE#CUSTOMER`), band on `GSI-ScoreBand`.

| Signal | Weight | Direction |
|---|---|---|
| Login frequency (28d) | 30 | ↑ healthier |
| Feature breadth | 20 | ↑ healthier |
| AI-calling usage trend | 20 | rising = healthier |
| Support/objection flags | 15 | more = lower |
| Days since last login | 15 | decay |

Bands: **Healthy ≥70 · At-risk 40–69 · Critical <40**. Early-warning chain: recency decay in activation (`milestones-and-score.md` §5) is the *first* signal a converted customer is sliding — health scoring inherits it on Day 1 of paid, so churn risk is visible before a missed renewal (the core pain RealEstateFlow sells a fix for).

---

## 5. Re-engagement of dormant users

| Dormancy stage | Trigger | Action | Channel | Workflow |
|---|---|---|---|---|
| **Cooling** (no login 3–4d) | health drift | proactive tip matched to quiet loop ("aap khata kam use kar rahe 👇") | WhatsApp + in-app | `WF-RET-01` |
| **Dormant** (no login 7d, paid) | health at-risk | personal CS/founder nudge + help-call offer | WhatsApp + AI-call | `WF-RET-02` |
| **Deep dormant** (no login 14d+) | health critical | win-back: their own ROI recap + one quick win unused | WhatsApp + human | `WF-RET-03` |
| **Renewal-at-risk** | renewal ≤14d + at-risk | value recap (ROI in ₹) before renewal date | WhatsApp + email | `WF-RET-04` |
| **Involuntary** (payment fail) | dunning | retry + "card update" nudge | email + in-app | `WF-RET-05` |

All on `SCHEDULED_NOTIFICATION` + `SEQUENCE_ENROLLMENT` (`seqId=winback`/`post_activation`), consent-gated, idempotent (`stepToken`). Cancel on login resume. Copy backbone: `customer-success.md` §5 (branch logic + 7-day inactivity nudge verbatim).

---

## 6. Feature-adoption expansion (breadth → plan)

Expansion = grow breadth, then plan. Drives NRR ≥105%.

| Trigger | Adoption nudge | Expansion path | Metric |
|---|---|---|---|
| Uses leads+AI-call only | "khata try karo — commission clear" | breadth → stickier | feature breadth |
| Hitting Free 50-lead / 2-user cap | "limit aa gayi — Starter pe leads unlimited-ish" | Free→Starter (₹999) | free→paid rate |
| Agency hitting 5-user cap | "team badh rahi — Growth pe 15 users + AI matching" | Starter→Growth (₹2,999) | plan-upgrade rate |
| High AI-call volume | "Pro mein API + advanced analytics" | Growth→Pro (₹5,999) | NRR |

In-app upgrade prompts at the limit moment (`paywall-upgrade-cro`), not random — the customer has already felt the value. Pricing per `01-business-memory.md` §5.

---

## 7. Automation triggers (retention)

| ID | Trigger event | Condition | Action | Metric |
|---|---|---|---|---|
| `WF-RET-01` | health drift / 3–4d no login | healthy→drifting | matched loop-revival tip | reactivation rate |
| `WF-RET-02` | 7d no login (paid) | health at-risk | personal nudge + help call | dormant recovery |
| `WF-RET-03` | 14d+ no login | health critical | win-back + quick win | win-back rate |
| `WF-RET-04` | renewal ≤14d + at-risk | risk before renewal | ROI recap in ₹ | renewal rate |
| `WF-RET-05` | payment fail | dunning | retry + card-update | involuntary churn |
| `WF-RET-06` | breadth/limit signal | adoption gap | feature/upgrade nudge | NRR, breadth |
| `WF-RET-07` | first clear win (deal via app) | health healthy + positive | celebrate → referral ask | referrals/customer |

`WF-RET-07` is the advocacy handoff: referral ask **only after the win** (`referral.md`, `customer-success.md` §6) — never before. Best wins → testimonials/content (consent) feeding the loop: success → proof → referral → new lead.

---

## 8. Metrics ties & engineering

| Outcome | Metric | Engineering |
|---|---|---|
| Habit formed | core-action WAU ≥70% | loop events (EP-5) |
| Churn reduced | monthly churn <5%, GRR ≥90% | health score + WF-RET-01..05 (EP-4/5) |
| Expansion | NRR ≥105% | WF-RET-06 + paywall (EP-4) |
| Early warning | at-risk caught pre-renewal | recency decay → health (EP-5) |
| Advocacy | referrals/customer ≥0.2 | WF-RET-07 → `referrals/` (EP-4) |

Engineering: `scoringService` health recompute (EP-5), `GSI-ScoreBand` at-risk queue, WF-RET-* sequences on `SCHEDULED_NOTIFICATION` (EP-4), retention dashboard widget (EP-7). Every loop, nudge, and metric ties to a real feature, an event, and an engineering task — multi-tenant, consent-safe.
