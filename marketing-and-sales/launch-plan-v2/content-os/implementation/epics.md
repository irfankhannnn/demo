# Implementation — Epics

| ID | Epic | Goal | Automation OS phase |
|---|---|---|---|
| **EP-1** | **Lead Attribution & Source Tracking** | Every lead carries source, UTM, campaign, content (`OPP-*`) | A (Measure) |
| **EP-2** | **Marketing Event Ingest & Automation Engine** | Ingest IG/FB/WhatsApp/web events → route to rules | A→B |
| **EP-3** | **Inbound Capture & Auto-Response** | DMs/comments/lead-ads → attributed leads + keyword auto-reply + AI auto-qualify | B |
| **EP-4** | **Lifecycle Sequences** (nurture/onboarding/win-back/demo reminders) | Automated, consent-safe multi-touch on scheduled engine | B |
| **EP-5** | **Scoring** (lead, activation, customer health) | Prioritize leads; predict activation/churn | C |
| **EP-6** | **Referral System** | Track referral codes, attribution, rewards | C |
| **EP-7** | **Marketing/Growth Dashboard** | Funnel, attribution, CAC/LTV, cohort retention, content ROI | A→C |

## Dependency order
EP-1 → EP-2 → EP-3/EP-4 → EP-5/EP-6 → EP-7 (dashboard grows across all).

## Success metric per epic
EP-1: 100% leads attributed. EP-2: events ingested w/ <1s routing. EP-3: speed-to-lead <5 min. EP-4: week-1 activation +X%. EP-5: scores on every lead/customer. EP-6: referral % of new customers tracked. EP-7: live funnel + content-`OPP-*` ROI.
