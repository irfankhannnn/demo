# Growth Dashboard — KPI System (Phase 13)

The single scoreboard for the whole GTM OS. Metrics flow from Content → Attention → Distribution → Sales, instrumented by Automation OS (`MKT_EVENT` + scoring + attribution). North-star first, then the funnel, then efficiency.

## North-Star Metric
> **Qualified demos booked per week** (leading indicator of revenue; honest reflection of content→conversation→demo working).
Secondary north-star (lagging): **New paying customers / month**.

## The Funnel (the spine)
| Stage | Metric | Target (Mo3) | Source |
|---|---|---|---|
| Reach | reel reach, hook rate (>45%), hold rate (>55%) | growing | IG/MKT_EVENT |
| Engagement | saves, shares, comments, follows | rising | IG |
| Conversations | **DMs started**, DM→WhatsApp rate (40%) | 40+/mo | DM events |
| Demos | **demos booked**, no-show rate (<25%) | 20+/mo | CRM/calendar |
| Trials | trials started, trial activation (week-1, 3/4 milestones) | 10+/mo | product |
| Paid | trial→paid (25–35%), new customers | predictable | billing/CRM |
| Referrals | referrals sent, referral % of new customers (20%+) | 20%+ | REFERRAL |

## Engagement & Attention KPIs
Reach · hook rate · hold rate · saves/reach · shares/reach · comments/reach · DM rate · follower growth · returning-viewer %.

## Conversion KPIs
DM→WhatsApp · WhatsApp→demo · demo→trial · trial→paid · paid→referral. (Targets in `sales-os/customer-journey.md`.)

## Efficiency KPIs
| Metric | Definition |
|---|---|
| **CAC** | total acquisition spend ÷ new customers (by channel) |
| **LTV** | avg revenue/customer × gross margin × avg lifetime (months) |
| **LTV:CAC** | target ≥ 3:1 |
| **Payback period** | CAC ÷ monthly gross profit per customer (target < 6 mo) |
| **CPL / effective CAC by channel** | CPL ÷ trial-to-paid (see channel-cac-analysis skill) |

## Content ROI (the Content OS loop)
Per `OPP-*`/series: reach → DMs → demos → paid attributed. Identify which frameworks/characters/hooks drive demos → produce more (feeds oracle/ab-optimizer). This closes the loop from `content-os` to revenue.

## Retention/health
Activation rate, week-1 milestones, login frequency, churn, NPS, customer health score distribution.

## Dashboard layout (maps to implementation/ui-requirements)
1. North-star + funnel (with drop-off %). 2. Attribution by source + by content `OPP-*`. 3. CAC/LTV/payback. 4. Cohort retention. 5. Channel efficiency. 6. This-week ops (demos, no-shows, at-risk trials).

## Cadence
Daily: reach/DMs/demos. Weekly: full funnel + content ROI (founder review per founder-engine). Monthly: CAC/LTV/cohorts + roadmap re-prioritization.

## Instrumentation dependency
Requires EP-1 (attribution) + EP-2 (events) + EP-7 (dashboard) from `implementation/`. Until built, track manually in a sheet using the same metric definitions.
