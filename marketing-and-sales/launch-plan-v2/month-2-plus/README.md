# Month 2+ — Scale & Expand

6 files for Month 2-6 strategic initiatives. Each is a high-level template; AI agents adapt to actual M1 results when triggering.

## Files

| ID | File | Title |
|---|---|---|
| 1 | `M2-paid-ads-readiness.md` | Meta retargeting + Google Search ads (₹100k M2) |
| 2 | `M2-pune-ramp.md` | Pune research + LP + 30 prospects |
| 3 | `M2-referral-program-scale.md` | Affiliate tier + Promoter automation |
| 4 | `M2-content-engine.md` | 12-week SEO + AEO + social cadence |
| 5 | `M2-partnerships-comarketing.md` | 3-5 strategic partners + joint webinar |
| 6 | `M2-hiring-plan.md` | First SDR / outbound contractor hire |

## Targets (targets, not forecasts)
- M2: 25-50 paying customers cumulative
- M2: MRR ₹40-80k
- M3: 50-100 paying customers
- M3: Pune launch live
- M3: First hire onboarded if MRR threshold met

Every number here is a target set before launch, with zero customers behind it. None of it may be used as proof — see [`../10-audience-and-voice/claims-and-proof-policy.md`](../10-audience-and-voice/claims-and-proof-policy.md).

## Phases after Month 1

The 30/60/90 roadmaps that used to live in `content-os/` are folded in here (`archive/content-os/roadmap-30-60-90.md`, and the obsolete 180-day version at `archive/content-os/growth-platform/implementation/roadmaps/roadmap-30-60-90-180.md`). They are re-expressed as **phases with no dates**, because the launch date is itself an open decision.

> Open decision D28 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

| Phase | Theme | What is in it |
|---|---|---|
| **A — M1 launch** | content live, conversations started, first customers | the week folders `week-1-foundation/` … `week-4-optimize-convert/`. Owned there, not here. |
| **B — hardening** | make what exists reliable before spending money on traffic | Instagram App Review through to prod · the pre-paid-launch security actions · schedule the grace-period cron · fire the four missing PostHog events ([`../50-measurement/posthog-event-map.md`](../50-measurement/posthog-event-map.md) §4) · extend the trial drip into days 1-3 |
| **C — growth** | scale what is proven | first paid spend (`M2-paid-ads-readiness.md`) · Pune (`M2-pune-ramp.md`) · referral programme beyond the manual version (`M2-referral-program-scale.md`) · SEO and content cadence (`M2-content-engine.md`) · partnerships (`M2-partnerships-comarketing.md`) · first hire (`M2-hiring-plan.md`) |
| **later than C** | only once C is compounding | the growth-platform designs in [`../50-measurement/design-only-backlog.md`](../50-measurement/design-only-backlog.md), each with its own trigger |

Phase C starts only if the PMF gate passes. The old roadmaps set follower-count and LTV:CAC gates (1k / 5k / 10k followers, LTV:CAC ≥3:1 by day 90); those are replaced by the gate in `00-PLAN-OVERVIEW.md` §4 — ≥3 paying, ≥40% activation, ≥10% cold reply, ≥1 promoter.

## Pre-requisites
- M1 PMF gate PASS or PARTIAL
- Day-29 audit signed
- Day-30 M2 strategy locked
- Vendor relationships intact

## How to consume

When Month 1 closes (Day 30), read the M2 strategy from `week-4-optimize-convert/day-30-month-2-strategy.md`. That doc + this folder's 6 files seed M2 Week 1's daily plan. AI agents author new day-by-day M2 task files in this folder as Cascade is asked to execute them.

## File-creation discipline

- Don't pre-author M2 day-by-day files — write them when M1 close-out informs them
- Save in this folder with naming `M2-week{N}-day-{title}.md`
- Reuse the same file template as M1 daily files (`00-FILE-TEMPLATE.md`)

## Status tracking

Each M2 initiative tracks here as it kicks off:
- ✅ Started · YYYY-MM-DD · {owner} · {summary of progress}
