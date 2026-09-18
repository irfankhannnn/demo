# WhatsApp — channel strategy

> **Where the deal actually happens.** WhatsApp is the dominant channel of Mumbai broker life — two to three hours a day, most of their leads, the place they *receive* forwarded reels and *share* what impresses them (`../../10-audience-and-voice/market-research.md` §3.2, §5.1, §9.1). For RealEstateFlow, WhatsApp is the **warm-lead conversion, nurture and community engine**, not a discovery channel. This file is the strategy layer; the sibling files in this folder hold the copy and the cadence.
>
> **Handles:** WhatsApp number in the Instagram bio and on the site · community link · site `realestateflow.in`
> **Plugs into:** `../../20-content-engine/production-pipeline.md` · `../../20-content-engine/ctas/cta-library.md` (WHATSAPP and COMMUNITY categories) · the `nurture-bot` and `sdr` agents in `tools/claude-skills/agents/` · the CRM lead `source` field.

---

## Read this before you read anything else in this folder

**Two different WhatsApps are involved and the docs used to conflate them.**

1. **The product's WhatsApp.** `platform/whatsapp-platform/` is a **self-hosted Baileys service, linked by QR code**. It is not a Business Solution Provider and not the Meta Cloud API. Today it runs as the agency's own command channel — the owner talks to their AI Employee through it (`agency-app/web/src/pages/crm/AiEmployee.tsx`, `agency-app/api/routes/whatsappConversations.js`). There is no approved-template workflow, because template approval is a Cloud API concept. The direction of travel is the official Business Cloud API; the plan is `docs/realestateflow-vision/39-whatsapp-official-api-plan.md`. Chatwoot was considered and dropped.
2. **Our own marketing WhatsApp** — the number a prospect messages after an Instagram DM. **Which number that is has not been decided.**

> Open decision D29c — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

Everything below that assumes a Business-API template stack is therefore **aspirational**, and is marked where it appears. A self-hosted number has no template approval to hide behind, which makes opt-in and low volume the only things standing between us and a ban.

**Claims stay at the workflow level** (what the workflow does), never at the outcome level (what it earned someone). Opt-in is required for anything broadcast-shaped. See `../../10-audience-and-voice/claims-and-proof-policy.md`.

---

## 1. Audience

| Segment | Why WhatsApp | Language posture |
|---|---|---|
| **Agency owner** | "WhatsApp is my CRM" — runs the whole business here; wants a real human, not a bot | `hi-dominant`, **aap**, English for ROI |
| **Sales manager** | coordinates the floor, asks pricing and plan questions | `hi-dominant`, **aap/tum** |
| **Young broker** | fast text replies, hates calls | `mixed`, **tu/bhai** |
| **Warm IG/FB leads** | handed off after a keyword DM | match the tongue they opened in |

- **Behaviour rule (critical):** brokers want *"real banda, no bots"* (CTA-WHATSAPP-014). Lead with human warmth; automation is invisible plumbing, never the voice. Reply fast — they expect it.
- **India specifics:** WhatsApp *is* their CRM today, so our pitch is "WhatsApp ka kaam, system mein", not "replace WhatsApp". Voice notes out-trust text. Speed converts — reply inside five minutes. The old "15-min reply ≈ 60% close vs ~20% after an hour" line is an unsourced statistic and has been removed; keep the speed rule, drop the number.
- Mumbai only in M1.
  > Open decision D24 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

## 2. Messaging frequency

| Surface | Cadence | Window |
|---|---|---|
| **Status** (reel-style clips, tips) | 1–2/day | 8–9 AM, 6–8 PM |
| **Broadcast list** (opted-in leads and customers) | ≤2/week — value first, never spammy | mid-morning / early evening |
| **Community / group** | daily value, weekly Q&A (text or voice note) | evening |
| **1:1 replies** | within minutes in business hours; "subah reply" promise overnight | always |

> Over-messaging kills opt-in. Broadcast cadence is capped; 1:1 is unlimited and is where conversion happens. On a self-hosted number, volume is also a ban risk, so the cap is not only a courtesy.

## 3. Content mix (by CT-*)

WhatsApp reuses Instagram assets — it is a distribution surface, not an origination one — plus native 1:1 conversation.

| Surface | CT-* sourced | Notes |
|---|---|---|
| **Status** | CT-DRAMA, CT-DEMO, CT-MEME (top Instagram performers) | the shareable, validating clips travel best |
| **Broadcast** | CT-EDU, CT-NEWS (RERA), CT-DEMO | value drops and lead magnets, not pitches |
| **Community** | CT-EDU, CT-AUTHORITY | tips, build-in-public, member questions |
| **1:1** | n/a (live) | objection handling, pricing, demo booking, migration help |

CT-PROOF and CT-CASE do not appear: there are no customers and no testimonials to distribute.

## 4. CTA strategy

WhatsApp is mid- and bottom-funnel — categories skew **WHATSAPP · COMMUNITY · DM · TRIAL · DEMO**.

| Goal | Category | Example IDs |
|---|---|---|
| Start the 1:1 | **WHATSAPP** | CTA-WHATSAPP-003 ("Hi"), CTA-WHATSAPP-014 ("real banda") |
| Pricing / plan | **WHATSAPP** keyword | CTA-WHATSAPP-005, CTA-WHATSAPP-039 ("PRICE") |
| Migration help | **WHATSAPP** keyword | CTA-WHATSAPP-029 (send sheet screenshot), CTA-WHATSAPP-043 |
| Convert | **TRIAL · DEMO** | CTA-WHATSAPP-016 ("TRIAL"), CTA-WHATSAPP-021 (demo slot) |
| Join belonging | **COMMUNITY** | CTA-COMMUNITY-013 |

## 5. Lead capture

1. **Keyword reply:** inbound "Hi" / "DEMO" / "PRICE" / "TRIAL" → reply → route to a human, record the source on the CRM lead.
2. **IG/FB → WhatsApp hand-off:** warm DM leads move here for objection handling and pricing. This is the conversion step (`../instagram/dm-workflows.md` §5).
3. **Broadcast opt-in:** every helpful 1:1 ends by offering opt-in to value broadcasts (tips, RERA updates).
4. **Community join:** funnel engaged leads into the agent community.
5. **Migration capture:** "send your current sheet screenshot, we'll migrate it free" (CTA-WHATSAPP-029) — a high-intent bottom-funnel signal.

**Click-to-WhatsApp ads are post-PMF.** No paid ads run in M1; they open only if the PMF gate in `../../00-PLAN-OVERVIEW.md` §4 is met.

> `nurture-bot` runs objection-handling sequences; `sdr` handles warm outbound; `pipeline-manager` tracks Lead → Demo → Trial → Paid. All three draft, a human sends.

## 6. Repurposing

| From → To | What |
|---|---|
| **IG Reel → WhatsApp Status** | top drama, demo and meme clips (the forward-worthy ones) |
| **IG Carousel → WhatsApp doc/image** | EDU checklists and lead magnets sent in 1:1 or broadcast |
| **RERA/news reel → broadcast text + clip** | timely Maharashtra updates |
| **Product recording → 1:1 drop** | sent during objection handling, in place of a testimonial we do not have |
| **Founder note → community message** | warmth and mission (`../founder-presence.md`) |
| **WhatsApp group pain points → IG meme/reel** | reverse flow: harvest real broker complaints as content fuel |

## 7. Publishing workflow

```
IG/FB asset published → select top performers → push to Status (manual)
                     → value drops posted to Broadcast (≤2/wk, opted-in only)
Inbound keyword → reply → human hand-off (nurture-bot / sdr draft) → CRM lead → pipeline
```

- **Status and broadcast** are posted manually. No scheduling tool in our stack publishes WhatsApp Status.
- **Compliance:** opt-in required for broadcasts; honour opt-out immediately; never cold-blast. **Template approval applies only on the Cloud API.** If we send from a self-hosted linked number there is no template gate, and opt-in plus low volume are the only protection against a number ban.
- **Language:** match the lead's tongue; brand copy stays 70% English / 30% romanized Hindi (`../../10-audience-and-voice/language-and-tone.md`). Never bot-speak; one natural slang touch at most.
- **Quality gate:** human-first tone, a single clear next step, ₹/lakh/crore, RERA-safe, source recorded, opt-in respected, and every claim on the approved list.
- **The rest of the folder:** broadcast architecture (`founder-broadcast.md`), community rules (`community.md`), drip and template copy (`lead-nurture.md`, `demo-followup.md`, `customer-success.md`, `referral.md`, `message-templates.md`). This file governs what and why; those govern how.

## 8. Metrics

| Metric | Definition | Target |
|---|---|---|
| **Speed-to-lead** | first reply after hand-off | < 5 min |
| **DM → WhatsApp** | hand-offs that reply | 40% (`../../40-sales-and-conversion/customer-journey.md`) |
| **WhatsApp → demo** | leads booking a demo | 30% |
| **Broadcast read rate** | reads ÷ sent | > 70% |
| **Opt-out rate** | unsubscribes ÷ list per month | < 2% |
| **Status views → DM** | inbound from Status | track |

Definitions live in `../../50-measurement/metric-dictionary.md`. A lead's `source` is recorded on the CRM record; the finer detail (which keyword, which `OPP-*`) goes in the tracking sheet, because the lead schema has no field for it. Slow speed-to-lead is the second-biggest funnel leak — fix it first.
