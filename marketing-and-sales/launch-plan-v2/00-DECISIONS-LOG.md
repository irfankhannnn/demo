# Decisions Log

Append-only log of every locked decision during the launch. New entries go to the top. Each entry: **YYYY-MM-DD** · **Decision** · **Owner** · **Rationale** · **Linked file/PR**.

> Keep entries terse. If a decision changes later, append a new entry rather than editing the old one (history matters).

> **This file holds LOCKED decisions only.** Open, unlocked decisions live in `00-OPEN-DECISIONS.md` (D22–D29, marketing). When one of those closes, append it here as a dated entry, delete its section there, and remove every inline `> Open decision D2x` note that cites it.

> **Dates:** every entry below `2026-09-17` carries the placeholder `2026-MM-DD` — dated logging was never turned on. Treat them all as locked before 2026-09-17, in the order shown.

---

## 2026-09-17 · Content OS merged into this playbook as one go-to-market playbook · Founder · `content-os/` had four competing entry points and duplicated the roadmap, KPIs, sales scripts and pricing. Flattened into six numbered reference layers (`10-` … `60-`); `README.md` is the only navigation root; retired files kept under `archive/content-os/` · `#scope` · Linked: `README.md`, `archive/content-os/README.md`

## 2026-09-17 · Growth Platform trimmed to a measurement layer on what already exists · Founder · We measure on PostHog + Razorpay + the NPS table + one sheet. We are not building a marketing data platform. Everything unbuilt is marked design-only and indexed with a build trigger · `#scope` `#stack` · Linked: `50-measurement/README.md`, `50-measurement/design-only-backlog.md`

## 2026-09-17 · Roadmap re-baselined as phases, not dates · Founder · No launch date is logged, so forward-looking work is Phase A (M1 launch) → Phase B (hardening) → Phase C (growth). The week folders keep their relative day numbers · `#operations` · Linked: `00-PLAN-OVERVIEW.md` §3, `month-2-plus/README.md`

## 2026-09-17 · Telegram dropped from the product and from all copy · Founder · There is no Telegram code in the repo; the wedge sentence claimed it · `#scope` · Linked: `00-PLAN-OVERVIEW.md` §1

## 2026-09-17 · Team = solo founder + AI agents + contractors; hire after a revenue trigger · Founder · Confirms and extends the existing "no SDR until MRR ≥ ₹2L" entry. Video work is capped by one part-time editor at about 3 videos a week · `#hire` `#operations` · Linked: `20-content-engine/README.md`, `40-sales-and-conversion/README.md`

---

## 2026-MM-DD · Pricing locked at the tiers held in `pricing.json` · Founder · Replaces the v1 ₹3,000-based model from `creative/landing-pages/` · Linked: `pricing.json`, master plan v2 §0.3
> Superseded in direction, not yet replaced: the pricing model is being re-planned (properties + AI credits + a "Contacts" unit). Proposal: `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`. Until it is accepted, `pricing.json` remains the live source.

## 2026-MM-DD · Trial = 14 days, no card, AI Employee excluded · Founder · Aligns with master plan v2 §0.3 · Linked: `pricing.json`

## 2026-MM-DD · Refund window = 30 days, first-time subscribers only (`pricing.json` wording; earlier entries said "1 month") · Founder · Anti-abuse: deny if >100 records exported or >50 outbound WhatsApp during trial · Linked: `pre-launch-prep/P1-legal-foundation.md`

## 2026-MM-DD · M1 city scope = Mumbai only · Founder · Defer Pune until Mumbai shows PMF (≥3 paying, ≥40% activation, ≥10% reply rate)

## 2026-MM-DD · Website language = English · Founder · Replaces existing Hinglish landing pages; ads/social stay multilingual (60/25/15 EN/Hinglish/Marathi)

## 2026-MM-DD · OpenClaw self-serve UI dropped from M1 · Founder · Concierge-only post-payment flow per `pre-launch-prep/P11-openclaw-concierge.md`

## 2026-MM-DD · S3 bucket name = cloudberry-real-estate-launch (corrected typo "estte") · Founder · Linked: `pre-launch-prep/P18-cloud-infra-checklist.md`

## 2026-MM-DD · Voice-overs = ElevenLabs only (no UGC voice artist hire) · Founder · Linked: `cross-cutting/asset-production-calendar.md`

## 2026-MM-DD · Founder mailbox `founder@realestateflow.in` is fresh; 21-day warm-up starts T-21 · Founder · Linked: `pre-launch-prep/P3-email-deliverability.md`

## 2026-MM-DD · Grievance Officer mailbox = `info@realestateflow.in` (already exists) · Founder · Linked: `pre-launch-prep/P9-grievance-flow.md`

## 2026-MM-DD · /enterprise landing page DROPPED from M1 · Founder · Re-add M3+ if pipeline justifies · Linked: `pre-launch-prep/P15-landing-pages-rewrite.md`

## 2026-MM-DD · No paid ads in M1 · Founder · Conflict resolution vs `MARKETING-MASTER-PLAN.md` · Ramp M2+ post-PMF gate

## 2026-MM-DD · No SDR hire until MRR ≥ ₹2L · Founder · Solo founder constraint, 6-day week

## 2026-MM-DD · No webinar in M1; first webinar Day 45 with real M1 customer · Founder · Linked: `month-2-plus/M2-webinar-day45.md`

---

## Template for new entries

```
## YYYY-MM-DD · [Decision in 1 line] · [Owner] · [Rationale, 1-2 sentences] · Linked: [file or PR]
```

## Reserved categories (use these tags so log is filterable)

- `#pricing` · `#legal` · `#geo` · `#language` · `#scope` · `#stack` · `#brand` · `#vendor` · `#operations` · `#sla` · `#hire`
