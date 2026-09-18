# 30 — Channels

**Where the content goes.** Layer 2 (`../20-content-engine/`) decides how a piece gets made; this layer decides where it lands, under whose handle, on what cadence, and what each platform will and will not let us do.

Read `../10-audience-and-voice/brand-constants.md` and `../10-audience-and-voice/claims-and-proof-policy.md` first. Nothing in this folder restates a brand token, a price or an approved claim — they are cited, never copied.

---

## Channel scope

Two things are undecided and they gate most of this table: **which channels we run** and **how we publish to them**. The "Status" column is therefore honest rather than aspirational — a channel marked *pending* has a full playbook here and no decision behind it.

| Channel | Status now | Handle / surface | Who publishes | Scheduling | Gating decision |
|---|---|---|---|---|---|
| **Instagram** (`instagram/`) | **In scope** — the primary channel | `@realestateflow` | founder | feed posts schedulable; Stories, broadcast and replies manual | D22 (scheduling), D23 (handle confirmation) |
| **Facebook** (`facebook.md`) | **In scope** — page + broker groups, organic only | RealEstateFlow page | founder | feed posts schedulable; group participation always manual | D22 |
| **WhatsApp** (`whatsapp/`) | **In scope** for 1:1 hand-off; broadcast and community pending | number in the IG bio | founder | manual, always | **D29c** — which number talks to prospects |
| **LinkedIn** (`linkedin.md`) | **Pending** — recommended, founder text and comments only | founder profile (primary), company page (secondary) | founder | feed posts schedulable; comments and DMs manual | D23 |
| **YouTube** (`youtube.md`) | **Parked** — playbook kept, nothing runs | — | — | — | D23 |
| **Telegram** | **Dropped.** No code, no plan. Remove it from any copy you find | — | — | — | settled |

> Open decisions D22 and D23 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

Also in this folder, cutting across channels:

- `founder-presence.md` — the founder's own thesis and daily cadence. **The founder never appears on camera**; their voice is text, audio and in person.
- `virality-and-retention.md` — how a stranger arrives (shares, saves, franchises, trend-jacking) and why they stay (profile as a landing page, theme days, retention loops).

The month-1 organic pack (`marketing-and-sales/realestateflow/content-strategy-first-month/`) is Instagram and Facebook only. **Where a file here disagrees with the month-1 pack about M1, the month-1 pack wins** — it is newer and it is what is actually being shipped.

---

## Publishing SOP

```
20-content-engine produces the asset (REF-<TYPE><NN>-<slug>-v<N>, under marketing-and-sales/creative/)
   → pre-publish check (below)
   → publish to the channel at its peak slot
   → first 60 minutes: reply to every comment and DM, pin the CTA comment
   → log OPP-*, CTA-*, channel and time in the tracking sheet
   → route buying intent to 40-sales-and-conversion/
```

**Scheduling.** The Blotato MCP is configured in `.mcp.json` and can schedule Instagram, Facebook and LinkedIn feed posts. Every Content OS doc written in June said "manual upload via Meta Business Suite", which is a stale instruction rather than a decision — the tool is wired either way. Stories, the broadcast channel, WhatsApp and every reply stay manual whichever option wins, because scheduling tools are bad at conversation.

**Pre-publish check** (every piece, every channel):

1. Every claim is on the approved list — `../10-audience-and-voice/claims-and-proof-policy.md`.
2. No customer, testimonial, count of agencies, or unsourced % or ₹ figure. We have zero customers.
3. Prices, trial and refund language come from tokens resolved against `../pricing.json` — never typed in.
4. Brand-kit v3 tokens and type; no hardcoded hex.
5. Subtitles burned in; safe zones respected.
6. Where a face appears, it is the AI presenter and the profile carries the disclosure. The founder is not on camera.
7. One CTA, on the month-1 keyword set where a keyword is used: **SYSTEM · KHATA · AUDIT · DEMO**.

---

## Meta platform limits that bind every Instagram doc here

These are not style preferences; they are what the API will and will not do.

- **24-hour window.** Free-form DMs to a person are only possible within 24 hours of their last message. Anything later needs them to write first.
- **One private reply per comment**, and only within 7 days of that comment.
- **The Instagram service is real and is not live.** Comment keyword rules, private replies, DM reading, enquiry scoring and the CRM hand-off are built (`agency-app/instagram-api/services/ruleMatcher.js`). It is deployed to dev, **still in Meta Development Mode with App Review pending**, and `INSTA_DRY_RUN_SENDS` is on in dev. Until App Review passes, a person sends every reply by hand, within 15 minutes.
- **Graph API only.** We never browse or scrape instagram.com, and never drive it with browser automation. The account-block risk is not worth it, and the API does what we need.
- **Draft first.** Replies are drafted and reviewed before they send. Nothing auto-sends unreviewed.

**What the CRM actually stores.** A lead created from Instagram carries `source: 'Instagram'`, `sourceAdapter: 'instagram'`, `externalRef` and `reelRef` (`agency-app/api/leadIngestion.js`), and emits an EventBridge `lead.created` that runs AI qualification. There is **no** `leadSource`, `contentRef` or `utm` field on a lead, and **`/api/marketing/events` does not exist** — several June docs assumed it did. So the `OPP-*` that drove a lead lives in the tracking sheet until a content-reference field ships. See `../50-measurement/attribution-today.md`.

## WhatsApp reality

The product's WhatsApp is a **self-hosted Baileys service, QR-linked** (`platform/whatsapp-platform/`), used today as the agency's own command channel to its AI Employee. It is not a BSP and not the Cloud API, so **approved-template rules do not apply to it** — which also means there is no template gate protecting the number, and opt-in plus low volume are the only things that do. The official plan is `docs/realestateflow-vision/39-whatsapp-official-api-plan.md`. Chatwoot was considered and dropped. Which number talks to prospects is **D29c** and is not settled here.

## No paid ads in M1

Facebook Lead Ads, click-to-WhatsApp ads, LinkedIn lead-gen forms and boosted posts are all post-PMF. They open only if the gate in `../00-PLAN-OVERVIEW.md` §4 is met. Several files in this folder carry a full paid playbook; every one of them is marked.
