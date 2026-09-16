# Distribution OS — WhatsApp

> **Where the deal actually happens.** WhatsApp is the dominant channel of Mumbai/Pune broker life — 2–3 hrs/day, 50–70% of their leads, the place they *receive* forwarded reels and *share* testimonials (`02-market-research §3.2, §5.1, §9.1`). For RealEstateFlow, WhatsApp is the **warm-lead conversion + nurture + community engine**, not a discovery channel. This file is the **strategy layer**; the **deep execution system** (broadcast list architecture, community/group setup, drip sequences, template messages, auto-reply keyword flows, opt-in compliance, status calendar) lives in **`distribution-os/whatsapp/`** — cross-reference it.
>
> **Handles:** WhatsApp Business (number in IG bio + site) · community link · site `realtyflow.in`
> **Plugs into:** `10-content-factory` · `08-cta-library.md` WHATSAPP + COMMUNITY categories · `nurture-bot` / `sdr` agents · CRM lead source `whatsapp`.

---

## 1. Audience

| Segment | Why WhatsApp | Language posture |
|---|---|---|
| **Agency Owner ("Priya")** | "WhatsApp is my CRM" — runs whole business here; wants real human, not bots | `hi-dominant`, **aap**, English for ROI |
| **Sales Manager** | coordinates floor, pricing/plan questions | `hi-dominant`, **aap/tum** |
| **Young Broker ("Arjun")** | fast text replies, hates calls | `mixed`/`mr-dominant` (Pune), **tu/dada** |
| **Warm IG/FB leads** | handed off after a keyword DM | match origin tongue |

- **Behaviour rule (critical):** brokers want *"real banda, no bots"* (CTA-WHATSAPP-014). Lead with human warmth; automation is invisible plumbing, never the voice. Reply fast (they expect it). English+Hindi both offered.
- **India specifics:** WhatsApp *is* their CRM today (50–70% of leads flow through it, `02-market-research §5.1`) — so our pitch is "WhatsApp ka kaam, system mein", not "replace WhatsApp". Voice notes out-trust text. Speed converts: 15-min reply ~60% close vs ~20% after an hour. ₹/lakh/crore, never $.

## 2. Posting / Messaging Frequency

| Surface | Cadence | Window |
|---|---|---|
| **Status** (reel-style clips, proof, tips) | 1–2/day | 8–9 AM, 6–8 PM (`§3.1` phone-usage peaks) |
| **Broadcast list** (opted-in leads/customers) | ≤2/week — value-first, never spammy | mid-morning / early evening |
| **Community/group** | daily value, weekly live Q&A | evening |
| **1:1 replies** | within minutes in business hours; "subah reply" promise overnight | always |

> Over-messaging kills opt-in. Broadcast cadence is capped; 1:1 is unlimited and is where conversion happens.

## 3. Content Mix (by CT-*)

WhatsApp reuses IG assets (it is a *distribution* surface, not an origination one) plus native 1:1 conversation.

| Surface | CT-* sourced | Notes |
|---|---|---|
| **Status** | CT-DRAMA, CT-PROOF, CT-CASE, CT-MEME (top IG performers) | the shareable, validating clips travel best |
| **Broadcast** | CT-EDU, CT-NEWS (RERA), CT-DEMO | value drops + lead-magnets, not pitches |
| **Community** | CT-EDU, CT-FOUNDER, CT-PROOF | tips, founder presence, member wins |
| **1:1** | n/a (live) | objection handling, pricing, demo booking, migration help |

## 4. CTA Strategy (by CTA category)

WhatsApp is mid/bottom-funnel — categories skew **WHATSAPP · COMMUNITY · DM · TRIAL · DEMO**.

| Goal | Category | Example IDs |
|---|---|---|
| Start the 1:1 | **WHATSAPP** | CTA-WHATSAPP-003 ("Hi"), CTA-WHATSAPP-014 ("real banda") |
| Pricing / plan | **WHATSAPP** keyword | CTA-WHATSAPP-005, CTA-WHATSAPP-039 ("PRICE") |
| Migration help | **WHATSAPP** keyword | CTA-WHATSAPP-029 (send sheet screenshot), CTA-WHATSAPP-043 |
| Convert | **TRIAL · DEMO** | CTA-WHATSAPP-016 ("TRIAL"), CTA-WHATSAPP-021 (demo slot) |
| Join belonging | **COMMUNITY** | CTA-COMMUNITY-013 (WhatsApp community), CTA-COMMUNITY-010 (Pune) |
| Pune geo | mr-dominant | CTA-WHATSAPP-023 ("PUNE" → local team) |

## 5. Lead Capture Strategy

1. **Keyword auto-reply** (deep system): inbound "Hi"/"DEMO"/"PRICE"/"TRIAL"/"PUNE" → instant template reply → routes to human + tags CRM source `whatsapp-keyword`.
2. **IG/FB → WhatsApp handoff:** warm DM leads pushed here for objection-handling + pricing (the conversion step).
3. **Click-to-WhatsApp ads** (Meta): FB/IG lead ads with WhatsApp destination — see `facebook.md` lead-ads tie-in.
4. **Broadcast opt-in:** every helpful 1:1 ends by offering opt-in to value broadcasts (tips/RERA updates).
5. **Community join:** funnel engaged leads into the agent community (retention + soft nurture, network effect).
6. **Migration capture:** "send your current sheet screenshot, we'll migrate free" (CTA-WHATSAPP-029) — high-intent BOFU signal.

> `nurture-bot` runs objection-handling sequences here; `sdr` handles warm outbound; pipeline-manager tracks Lead→Demo→Trial→Paid by WhatsApp touch.

## 6. Repurposing Strategy

| From → To | What |
|---|---|
| **IG Reel → WhatsApp Status** | top drama/proof/meme clips (the forward-worthy ones) |
| **IG Carousel → WhatsApp doc/image** | EDU checklists, lead-magnets sent in 1:1/broadcast |
| **RERA/News Reel → broadcast text + clip** | timely Maharashtra updates |
| **Customer testimonial → 1:1 proof drop** | sent during objection-handling ("here's a Mumbai broker like you") |
| **Founder note → community message** | warmth + mission (see `founder-brand.md`) |
| **WhatsApp group pain points → IG meme/Reel** | reverse flow: harvest real broker complaints as content fuel |

## 7. Publishing Workflow (Content Factory + Manual Upload)

```
IG/FB asset published → select top performers → push to Status (manual)
                     → value drops posted to Broadcast (≤2/wk)
Inbound keyword → auto-reply template → human handoff (nurture-bot/sdr) → CRM tag → pipeline
```

- **Status/broadcast:** post WhatsApp Status/broadcast manually; for 1:1 conversation and keyword flows, the **deep system in `distribution-os/whatsapp/`** defines the WhatsApp Business API / auto-reply tooling and template library.
- **Compliance:** opt-in required for broadcasts; honour opt-out; no cold blasting (kills the channel). Templates approved per WhatsApp Business policy.
- **Language:** match the lead's tongue (Pune → Marathi handshake, then Hinglish/English for product mechanics, `03-language-strategy §8`). Never bot-speak; one natural slang touch max.
- **Quality gate:** human-first tone, single clear next step, ₹/lakh/crore, RERA-safe, source tagged, opt-in respected.
- **Deep system handoff:** broadcast-list architecture (`whatsapp/founder-broadcast.md`), community rules (`whatsapp/community.md`), full drip/template copy (`whatsapp/lead-nurture.md`, `demo-followup.md`, `customer-success.md`, `referral.md`, `message-templates.md`), keyword-flow logic, and opt-in compliance all live in **`distribution-os/whatsapp/`** — this file governs *what & why*, that folder governs *how at scale*.

## 8. Metrics (→ `growth-dashboard.md`)

| Metric | Definition | Target |
|---|---|---|
| **Speed-to-lead** | first reply after handoff | <5 min |
| **DM→WhatsApp** | handoffs that reply | 40% (`customer-journey.md`) |
| **WhatsApp→demo** | leads booking a demo | 30% |
| **Broadcast read rate** | reads ÷ sent | >70% |
| **Opt-out rate** | unsubs ÷ list/mo | <2% |
| **Status views→DM** | inbound from Status | track |

Every WhatsApp lead is tagged by source (`whatsapp-keyword`, `ig-dm-handoff`, `fb-click-to-wa`) so pipeline-manager attributes which CT-*/CTA-* fed it. Slow speed-to-lead is the #2 funnel leak (`customer-journey.md`) — fix it first.
