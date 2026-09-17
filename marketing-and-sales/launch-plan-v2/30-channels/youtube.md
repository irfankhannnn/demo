# YouTube — parked

> **Not in scope.** The month-1 organic pack covers Instagram and Facebook only. Nothing below runs until the channel scope is reopened, and reopening it costs editor time we do not have — the human editor handles about three videos a week and Instagram already consumes that.
>
> Open decision D23 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md
>
> Kept as a ready playbook so that reopening the channel is a decision, not a rewrite.

**YouTube = long-tail SEO, depth and a repurposing reservoir.** Shorts mirror Instagram reels for reach; long-form builds searchable authority and supports bottom-funnel research ("real estate CRM India review", "best CRM for property dealers").

## Audience

- Brokers researching tools (high intent, longer sessions).
- Owners evaluating CRMs before a demo.
- New joiners learning the trade (top-of-funnel discovery).

## Posting frequency

- **Shorts:** 4–5/week (repurpose Instagram reels 1:1).
- **Long-form:** 1/week, or one a fortnight. Consistency beats volume.

## Content mix (by CT-*)

| Format | CT-* | Examples |
|---|---|---|
| Shorts | CT-DRAMA / CT-EDU / CT-AI | repurposed reels |
| Tutorials / walkthroughs | CT-DEMO `[REC]` | "RealEstateFlow setup in 10 min", "WhatsApp AI Employee walkthrough", "Khata settlement explained" |
| Education | CT-EDU | "How Mumbai brokers stop lead leakage", "WhatsApp → CRM migration" |
| Authority | CT-AUTHORITY | building in public, market takes. The founder never appears on camera; use the AI presenter or a screen recording |

The June draft listed an "AI calling demo" tutorial and a "how [agency] doubled site visits" case study. AI calling is not on the approved-claims list, and there is no agency — both are removed. Case-study videos return only with a paying customer's written permission.

> Open decision D26 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

## CTA strategy

Description link, pinned comment and end screen → demo or trial. Cards to related videos for session time. CTAs: DEMO, TRIAL, FOLLOW (subscribe).

## Lead capture

SEO titles and descriptions with the demo link; lead magnets in the description (CTA-LEAD-MAGNET, once built); an end-screen demo CTA; a pinned comment with the link. A lead created from here carries `source` in the CRM — there is no `leadSource` field, so the campaign detail goes in the tracking sheet.

## SEO targets

"real estate CRM India", "CRM for real estate brokers", "WhatsApp AI for real estate", "MagicBricks / 99acres lead management", "best CRM for property dealers Mumbai", "broker follow-up software". Use Hinglish and English title variants.

## Repurposing engine (one long-form → a week of content)

- One long-form tutorial → 3–4 Shorts + 1 Instagram carousel + 1 LinkedIn document + 1 blog post + 3 WhatsApp broadcast tips.
- Instagram reels → Shorts, batched weekly.
- A long-form interview with a customer is post-launch, with permission.

## Publishing workflow

Render in `marketing-and-sales/video-projects/my-video/` (Remotion) or edit → upload → optimise title, description, tags and thumbnail → pin the demo CTA → add the end screen and cards → cross-link. Schedule natively in YouTube Studio. The render script is `tools/claude-skills/scripts/render-remotion.ps1`.

## Metrics

Shorts views, long-form watch time and retention, search impressions and CTR for the target keywords, description-link clicks, YouTube → demo. Definitions in `../50-measurement/metric-dictionary.md`.
