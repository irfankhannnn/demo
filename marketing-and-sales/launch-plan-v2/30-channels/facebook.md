# Facebook

**Facebook = broker groups (trust seeding and lead listening) + a page (reach overflow) + Lead Ads, later.** Indian brokers and owners live in Facebook groups for project leads and CP networking — it is where trust is built before they ever DM.

> Open decision D23 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md
> (Facebook organic is in the month-1 pack alongside Instagram; group participation and the page are the parts that run now.)

## Audience

- Agency owners 35–55 — active in broker and CP groups, deal-hunting, peer-trust driven.
- Brokers in CP groups (lead exchange, project leads).
- Lead-ad audiences: interest-based only. **Lookalike audiences need a seed list of real customers, which we do not have.**

Mood: community, deal-hunting, "show me you're legit."

## Posting frequency

- **Page:** 4–5/week (cross-post Instagram reels plus one or two native posts).
- **Groups:** daily genuine participation — answer a question, never spam.
- **Ads:** **none in M1.** No paid ads run before the PMF gate in `../00-PLAN-OVERVIEW.md` §4. From M2, if the gate is met, promote creatives that already proved themselves organically.

## Content mix (by CT-*)

| Surface | CT-* | Note |
|---|---|---|
| Page feed | CT-DRAMA / CT-EDU / CT-DEMO | cross-post the winning Instagram reels |
| Groups | CT-EDU / CT-AUTHORITY | give value, soft-mention, let the profile sell |
| Lead ads (post-PMF) | CT-DEMO / CT-AI | promote proven organic creatives |

CT-CASE and CT-PROOF do not appear anywhere on this channel yet: zero customers, zero testimonials (`../10-audience-and-voice/claims-and-proof-policy.md`).

## CTA strategy

- Page: comment keyword / DM / demo (CTA-DEMO, CTA-DM).
- Groups: a helpful answer → profile → DM. Never a hard pitch. Occasionally drop a free tool (CTA-LEAD-MAGNET) — once that tool exists.
- Ads (post-PMF): instant-form lead capture → WhatsApp follow-up within 5 minutes (CTA-WHATSAPP).

## Lead capture

Group DMs and Messenger today. Facebook **Lead Ads** with instant forms (name, phone, "current lead tool?") arrive with paid, post-PMF.

**What the CRM records:** a lead carries `source` and `sourceAdapter` (`apps/crm/server/leadIngestion.js`). There is no `leadSource` field and **`/api/marketing/events` is not built** — no route for it exists anywhere in `apps/` or `services/`. Until it does, record the group or campaign in the CRM lead source field and keep the detail in the tracking sheet. The Conversions API work sits in `../60-automation/tooling-stack.md` as design only.

## Group strategy (the real engine)

1. Join the top 10–15 Mumbai broker and CP groups. (Pune after the PMF gate — D24.)
2. Daily: answer **one** lead-management, follow-up or commission question with genuinely useful advice.
3. Build name recognition; let your profile and bio do the converting.
4. Weekly: share a free resource (follow-up tracker, leakage audit) — value, not an ad. Build the resource before you promise it.
5. Track which groups produce DMs and double down.

## Repurposing

Instagram reels → Facebook reels and feed (1:1) · Instagram carousels → Facebook image posts · LinkedIn hot-takes → Facebook page text posts.

Group "success stories" are post-launch only, and only with a customer's written permission.

## Publishing workflow

```
production pipeline → publish to IG + FB → group participation stays manual (authenticity)
→ inbound DM → WhatsApp nurture (30-channels/whatsapp/lead-nurture.md)
```

The Blotato MCP is configured in `.mcp.json` and can schedule Facebook feed posts; group participation and replies are manual whatever we decide.

> Open decision D22 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

## Metrics

Group DMs started, page reach (overflow), DMs → demo. Once paid opens: lead-ad CPL, lead-ad → demo rate, cost per qualified lead by group and by ad. Definitions in `../50-measurement/metric-dictionary.md`; results in `../50-measurement/weekly-scorecard.md`.
