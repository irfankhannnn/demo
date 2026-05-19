# Decisions Log

Append-only log of every locked decision during the launch. New entries go to the top. Each entry: **YYYY-MM-DD** · **Decision** · **Owner** · **Rationale** · **Linked file/PR**.

> Keep entries terse. If a decision changes later, append a new entry rather than editing the old one (history matters).

---

## 2026-MM-DD · Pricing locked at ₹999 / ₹1,999 + ₹500 / ₹7,999 AI Employee · Founder · Replaces v1 ₹3,000-based model from `creative/landing-pages/` · Linked: `pricing.json`, master plan v2 §0.3

## 2026-MM-DD · Trial = 14 days, no card, AI Employee excluded · Founder · Aligns with master plan v2 §0.3 · Linked: `pricing.json`

## 2026-MM-DD · Refund window = 1 month, first-time subscribers only · Founder · Anti-abuse: deny if >100 records exported or >50 outbound WhatsApp during trial · Linked: `pre-launch-prep/P1-legal-foundation.md`

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
