# Implementation — User Stories

Format: *As a … I want … so that …* + acceptance.

## EP-1 Attribution
- **Owner** — see where each lead came from (IG reel, FB ad, referral) so I know what marketing works. *Acceptance:* lead detail shows source + campaign + contentRef.
- **Marketer** — UTM + `contentRef (OPP-*)` captured so I can tie demos back to specific content. *Acceptance:* web signup persists UTM; dashboard groups demos by OPP-*.
- **SDR** — see source + engaged content so my first message is relevant. *Acceptance:* lead card shows originating reel/keyword.

## EP-2 Event Ingest / Engine
- **System** — one endpoint to receive all marketing events so every channel normalizes into one funnel. *Acceptance:* `/api/marketing/events` accepts & stores `MKT_EVENT`, signature-verified, idempotent.
- **Marketer** — configurable per-tenant rules ("on Trial Inactive → win-back"). *Acceptance:* rule CRUD; engine evaluates on each event.

## EP-3 Inbound Capture
- **Lead** — comment a keyword and get an instant helpful DM. *Acceptance:* keyword → auto-DM <1 min.
- **SDR** — inbound DMs/comments/lead-ads auto-create attributed leads so nothing is missed. *Acceptance:* lead created with source + contentRef.
- **Owner** — qualified inbound gets an AI call within minutes. *Acceptance:* qualified signal triggers `ai-calling-service`.

## EP-4 Sequences
- **Trial user** — a 7-day onboarding drip that gets me to my first AI call. *Acceptance:* enrollment on `trial_started`; Day-2 AI nudge; stops on activation.
- **Warm lead** — consent-based nurture I can stop anytime. *Acceptance:* opt-out cancels enrollment.
- **Demo booker** — reminders so I don't no-show. *Acceptance:* T-24h/T-1h reminders fire.

## EP-5 Scoring
- **SDR** — leads ranked by score so I work the hottest first. *Acceptance:* `GET /leads?sort=score`; badge on list.
- **CS/Owner** — health + activation scores to save at-risk customers. *Acceptance:* nightly scores; at-risk list.

## EP-6 Referral
- **Happy customer** — a referral link + reward to invite peers easily. *Acceptance:* unique code; reward on referee paid.
- **Owner** — see referral-driven customers + payouts. *Acceptance:* referral report.

## EP-7 Dashboard
- **Owner/Founder** — funnel (reach→DM→demo→trial→paid→referral) with CAC/LTV + which `OPP-*` drove demos, so I invest where it works. *Acceptance:* live dashboard with date range + drill-down by source/content.
