# Metric Dictionary — THE Canonical Definitions

**Single source of truth for every Growth-Platform metric.** Each metric has a stable ID (`M-*`), a definition, an exact formula, a unit, a data source/event, an owner, and a target. **All six dashboards reference metrics by ID — never redefine here.** This is the canonical superset of the legacy `../../growth-dashboard.md`; that doc now points here.

Conventions: events are `MKT_EVENT` rows (`type`, `channel`, `occurredAt`, `leadRef`, `contentRef`, `campaignId`); scores live in `SCORE`; spend in `CAMPAIGN.spend`. All counts are `TENANT#`-scoped and use **`occurredAt`** (provider time), not ingest time. Funnel types come from the verified enum in `database-requirements.md`.

---

## 0. North-Star

| ID | Metric | Definition | Formula | Unit | Source/event | Owner | Target (Mo3) |
|---|---|---|---|---|---|---|---|
| **M-NS1** | Qualified demos / week | Demos booked by a scored lead — leading revenue indicator | `count(type=demo_booked AND lead.leadScore≥40) per ISO week` | demos/wk | `demo_booked` ⋈ `SCORE` | Founder | **20+/wk** |
| **M-NS2** | New paying customers / month | Lagging north-star | `count(type=paid) per calendar month` | customers/mo | `paid` / billing | Founder | predictable, growing |

---

## 1. Funnel spine (reach → … → expansion)

| ID | Metric | Formula | Unit | Source/event | Target |
|---|---|---|---|---|---|
| **M-F1** | Reach | `sum(impressions)` of published content in range | count | IG insights ⋈ `content_published` | growing |
| **M-F2** | DMs started | `count(type=dm)` | count | `dm` | rising |
| **M-F3** | Demos booked | `count(type=demo_booked)` | count | `demo_booked` | 20+/mo |
| **M-F4** | Demos completed | `count(type=demo_completed)` | count | `demo_completed` | — |
| **M-F5** | Trials started | `count(type=trial_started)` | count | `trial_started` | 10+/mo |
| **M-F6** | Activated trials | `count(type=customer_activated)` | count | `customer_activated` (3/4 milestones) | — |
| **M-F7** | Paid | `count(type=paid)` | count | `paid` | predictable |
| **M-F8** | Referrals converted | `count(type=referral_converted)` | count | `referral_converted` / `REFERRAL` | 20%+ of paid |
| **M-F9** | Expansion events | `count(type=paid WHERE plan_upgrade=true)` | count | `paid` (upgrade flag) | rising |

**Stage drop-off (derived):** `M-D{a→b} = 1 − (count_b / count_a)` between adjacent stages. Surfaced by `/dashboard/funnel.dropoff`.

---

## 2. Conversion rates (stage-to-stage)

| ID | Metric | Formula | Unit | Target |
|---|---|---|---|---|
| **M-C1** | DM → WhatsApp opt-in | `wa_optins / dms` | % | 40% |
| **M-C2** | WhatsApp → demo | `demos_booked / wa_conversations` | % | 25% |
| **M-C3** | Demo → trial | `trials_started / demos_completed` | % | 45% |
| **M-C4** | Trial → activation | `customer_activated / trials_started` | % | >40% |
| **M-C5** | Trial → paid | `paid / trials_started` | % | 25–35% |
| **M-C6** | Paid → referral sent | `referral_sent / new_customers` | % | 50% sent |
| **M-C7** | No-show rate | `no_shows / demos_booked` | % | <25% |

---

## 3. Engagement / attention

| ID | Metric | Formula | Unit | Source | Target |
|---|---|---|---|---|---|
| **M-E1** | Hook rate | `3s_views / impressions` | % | IG / `content_published` | >45% |
| **M-E2** | Hold rate | `avg_watch / video_length` | % | IG | >55% |
| **M-E3** | Saves/reach | `saves / reach` | % | IG | >1.5% |
| **M-E4** | Shares/reach | `shares / reach` | % | IG | >1% |
| **M-E5** | Comments/reach | `comments / reach` | % | `comment` | >0.5% |
| **M-E6** | DM rate | `dms / reach` | % | `dm` | rising |
| **M-E7** | Follower growth | `net_new_follows / week` | count/wk | IG | +1k/mo early |
| **M-E8** | Returning-viewer % | `repeat_viewers / total_viewers` | % | IG | rising |

---

## 4. Efficiency — CAC / LTV / payback (per channel)

| ID | Metric | Definition | Formula | Unit | Source | Owner | Target |
|---|---|---|---|---|---|---|---|
| **M-EF1** | CPL | Cost per lead | `CAMPAIGN.spend(ch) / leads(ch)` | ₹ | `CAMPAIGN.spend` ÷ GSI6 | media-buyer | benchmark |
| **M-EF2** | CAC | Cost to acquire a customer | `spend(ch) / paid(ch)` | ₹ | spend ÷ `paid` by `campaignId` | media-buyer | falling |
| **M-EF3** | **Effective CAC** | CAC adjusted by trial-to-paid | `CPL / trialToPaid(ch)` (see `channel-cac-analysis` skill) | ₹ | M-EF1 ÷ M-C5 | growth-strategist | lowest wins budget |
| **M-EF4** | Blended CAC | All-channel | `total_spend / total_paid` | ₹ | all campaigns | Founder | falling |
| **M-EF5** | LTV | Lifetime value | `ARPA × gross_margin × avg_lifetime_months` | ₹ | billing | Founder | grow |
| **M-EF6** | **LTV:CAC** | Unit economics | `M-EF5 / M-EF2` | ratio | derived | Founder | **≥ 3:1** |
| **M-EF7** | Payback period | Months to recover CAC | `CAC / monthly_gross_profit_per_customer` | months | derived | Founder | **< 6 mo** |
| **M-EF8** | ARPA | Avg revenue per account | `MRR / active_customers` | ₹/mo | billing | Founder | grow |

ARPA tiers ground on pricing (`01-business-memory.md §5`): Free ₹0, Starter ₹999, Growth ₹2,999, Pro ₹5,999.

---

## 5. Revenue (recurring)

| ID | Metric | Formula | Unit | Source | Target |
|---|---|---|---|---|---|
| **M-R1** | MRR | `Σ active_subscription_amount` | ₹/mo | billing | growing |
| **M-R2** | ARR | `MRR × 12` | ₹/yr | derived | growing |
| **M-R3** | New MRR | `Σ amount(new paid this month)` | ₹ | `paid` | growing |
| **M-R4** | Expansion MRR | `Σ Δamount(upgrades)` | ₹ | `paid` upgrade | rising |
| **M-R5** | Churned MRR | `Σ amount(cancelled)` | ₹ | billing | <5% of MRR |
| **M-R6** | **NRR** | Net revenue retention | `(start_MRR + expansion − contraction − churn) / start_MRR` | % | M-R1/4/5 | **>100%** |
| **M-R7** | Quick ratio | `(new+expansion) / (churn+contraction)` | ratio | derived | >4 |

---

## 6. Activation & retention

| ID | Metric | Definition | Formula | Unit | Source | Target |
|---|---|---|---|---|---|---|
| **M-A1** | Activation rate | Trials hitting ≥3/4 wk-1 milestones | `customer_activated / trial_started` | % | `customer_activated` | >40% |
| **M-A2** | Wk-1 milestone rate | Per-milestone completion | `count(milestone_hit[m]) / trials` | % | `milestone_hit` | login/data/AI-call/day-3 ≥3/4 |
| **M-A3** | Time-to-activate | Median hrs trial→activation | `median(activated_at − trial_started_at)` | hours | events | falling |
| **M-A4** | Login frequency | Active days in window | `active_days / 28` | ratio | login events | rising |
| **M-A5** | Monthly churn | `churned / start_of_month_customers` | % | billing | <5% |
| **M-A6** | Cohort retention | Retained by signup week | `retained_at_D{n} / cohort_size` (cohort=signup_week) | % | `/dashboard/cohorts` | D30 ≥58% |
| **M-A7** | NPS | `promoters% − detractors%` | score | survey | >40 |

---

## 7. Scores (0–100, computed in `scoringService.js`)

| ID | Metric | Definition | Formula (signal weights) | Bands | Source | Target |
|---|---|---|---|---|---|---|
| **M-S1** | **Lead score** | Intent+fit+engagement | source 25 + recency 20 + depth 15 + intent-kw 20 + ICP-fit 15 + contactable 5 | Hot≥70 / Warm 40–69 / Cold<40 | `SCORE.leadScore` | hot leads prioritized |
| **M-S2** | **Activation score** | Trial wk-1 progress | login24h 20 + data-added 20 + profile 15 + first-AI-call 25 + day-3-return 20 | activated ≥3/4 core | `SCORE.activationScore` | >40% activated |
| **M-S3** | **Health score** | Retention risk (higher=healthier) | login-freq 30 + feature-breadth 20 + AI-usage-trend 20 − support-flags 15 − days-since-login 15 | Healthy≥70 / At-risk 40–69 / Critical<40 | `SCORE.healthScore` | shift to Healthy |
| **M-S4** | **Expansion score** | Upsell readiness | usage-vs-plan-limit + feature-ceiling-hits + seat-growth + health≥70 | Ready≥70 | `SCORE.signals` (derived) | rising expansion MRR |
| **M-S5** | **Referral score** | Advocacy likelihood | health + NPS-promoter + tenure + prior-referrals | Advocate≥70 | derived | feeds referral asks |

Full weight tables + algorithm: `../implementation/technical-designs/technical-designs.md §4`.

---

## 8. Content ROI — the `OPP-*` loop (most important)

| ID | Metric | Definition | Formula | Source | Target |
|---|---|---|---|---|---|
| **M-CR1** | Content leads | Leads attributed to a recipe | `count(distinct leadRef WHERE contentRef=OPP-x)` | `MKT_EVENT.contentRef` | — |
| **M-CR2** | Content demos | `count(type=demo_booked WHERE contentRef=OPP-x)` | events | — | — |
| **M-CR3** | Content paid | `count(type=paid WHERE contentRef=OPP-x)` | events | — | — |
| **M-CR4** | Content lead→demo | `M-CR2 / M-CR1` | % | derived | winners scale |
| **M-CR5** | Content demo→paid | `M-CR3 / M-CR2` | % | derived | winners scale |
| **M-CR6** | Content ROI rank | Rank `OPP-*` by paid-per-1k-reach | `M-CR3 / (reach/1000)` | derived | top feeds oracle/ab |

Output table: `/dashboard/attribution?groupBy=content`. Winners → `oracle`/`ab-optimizer` → Content OS makes more of that framework/character/hook.

---

## 9. Attribution (by source / channel)

| ID | Metric | Formula | Source |
|---|---|---|---|
| **M-AT1** | Leads by source | `count(LEAD GROUP BY leadSource)` | GSI6 |
| **M-AT2** | Paid by source | `count(type=paid GROUP BY leadSource)` | events ⋈ LEAD |
| **M-AT3** | Source conversion | `M-AT2(src) / M-AT1(src)` | derived |
| **M-AT4** | Channel mix | `paid(channel) / total_paid` | events |

Source enum (canonical): `instagram_dm, instagram_comment, instagram_bio, facebook_ads, facebook_group, whatsapp, linkedin, youtube, referral, founder, lead_magnet, web, unknown` (`database-requirements.md §1`).

---

## 10. Ops / speed

| ID | Metric | Formula | Target |
|---|---|---|---|
| **M-O1** | Speed-to-lead | `median(first_auto_touch − inbound_event)` | <5 min |
| **M-O2** | Event routing latency | `p95(routed − ingested)` | <1s |
| **M-O3** | At-risk trials (today) | `count(trial AND healthScore<40 OR no-login-48h)` | minimize |
| **M-O4** | DLQ depth | SQS DLQ message count | 0 |

---

## 11. Metric → dashboard map

| Dashboard | Primary metrics |
|---|---|
| Executive | M-NS1, M-NS2, M-R1/2/6, M-EF4/6/7, M-AT4 |
| Marketing | M-F1–F8, M-E1–E8, M-AT1–4, M-EF1–3, M-CR1–6 |
| Sales | M-S1, M-F2–F4, M-C1–C3, M-C7, M-O1 |
| Customer Success | M-S3/4/5, M-A5, M-R5/6, M-O3 |
| Product | M-S2, M-A1–A4, M-A6, M-F5/F6 |
| Growth | full loop M-NS1→M-F9, M-A6, M-EF3/6, M-CR6, experiment lift |

Cross-refs: `dashboard-strategy.md`, six dashboard docs, `../implementation/technical-designs/technical-designs.md` (algorithms), `../implementation/api-requirements` (read-models).
