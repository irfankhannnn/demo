# 04 — Landing-Page Copy Delta

Maps to master-prompt **§4**. The master prompt's copy is UK/GBP/Rightmove. The existing `pre-launch-prep/P15-landing-pages-rewrite.md` already specs RealEstateFlow LPs in English + INR. This file gives the **copy blocks to add or adjust in P15**, rewritten in RealEstateFlow voice (per `01` brand-voice principles) and India context.

> **Apply target:** all blocks below land in `creative/landing-pages/main/index.html` (and where noted, persona LPs) via the P15 build pipeline. Pricing/trust wording must continue to pull from `pricing.json` (no hard-coded numbers). Backlog refs: E03-01..04.

> **Voice rules (from `01`):** outcome-first, anti-jargon, confident-but-approachable, India-local (WhatsApp, GST, data-in-India, DPDP, Mumbai localities, ₹/lakh/crore). Every claim backed by a number or a specific outcome. No paragraph > 3 lines.

---

## 4.1 — Hero (🔁 CHANGE: keep H1, add trust row)

**Keep the P15 H1** ("Hire an AI Employee for Your Real Estate Agency.") and sub-head. **Add the master-prompt trust-signal row**, localised:

- **Primary CTA:** `Start 14-day Free Trial — no card`
- **Secondary CTA:** `See it qualify a buyer →` (links `/demo`)
- **Trust row (NEW):** `✓ No setup fee · ✓ Works with your WhatsApp + portals · ✓ Live in 24h (concierge)`

> Localisation: master's "Live in 48 hours" → **"Live in 24h"** to match the AI Employee concierge 24h SLA (`pricing.json`, `P11`).

---

## 4.2 — Problem / Agitation (➕ ADD: new section, 3 pain cards)

P15 has no explicit problem section. Add this block above the solution split.

**Headline:** The old way is costing you deals

**Body (≤3 lines):**
> Every WhatsApp enquiry you miss after 8pm is a site visit your competitor books instead. Every hour spent re-typing leads into Excel is an hour not spent closing. Mumbai brokers don't lose because they're slow agents — they lose because the workflow is broken.

**Three pain cards:**
1. **Leads go cold in minutes.** A buyer contacted within 5 minutes is far likelier to convert *(industry benchmark)*. Most brokers reply in hours — or after the property's gone.
2. **Your "CRM" is a WhatsApp graveyard.** 300+ unread chats, no follow-up SLA, leads buried under broadcast groups. Data goes in; deals don't come out.
3. **Your tools don't talk to each other.** Portal, WhatsApp, calls, Khata book, Excel — all separate, all manual, all costing you time and money.

> 🇮🇳 Note: keep the "5-minute" claim **labelled as industry benchmark** (we don't have own data yet). Replace UK "21× more likely" only if a citable India/global stat is confirmed; otherwise keep generic.

---

## 4.3 — Solution split (🔁 CHANGE: adopt two-column AI Employee | CRM)

P15 has a 3-feature row; **upgrade it to the master-prompt two-column split** for sharper dual-product framing.

**Headline:** Meet your new AI Employee
**Sub-head:** Not a chatbot. Not a template. An AI that understands Indian broking — knows your listings, speaks your buyers' language, and represents your agency.

**Left — AI Employee:**
> - Answers every WhatsApp/Telegram lead in under 60 seconds — any hour
> - Qualifies buyers and sellers with smart conversational Q&A (English + Hinglish)
> - Books site visits straight into your calendar
> - Sends personalised follow-ups across WhatsApp + email
> - Escalates hot leads to the right agent instantly

**Right — Real Estate CRM:**
> - Every lead in one place — portals, WhatsApp, web, calls
> - AI lead scores updated in real time
> - Smart routing: right lead to the right agent, automatically
> - Khata book + settlement, always current — GST-ready
> - Pipeline forecasting: know your month before month-end

---

## 4.4 — Social proof (➕ ADD: stat bar + testimonial)

P15 only has testimonial placeholders. Add a **labelled stat bar** above them.

**Headline:** Built for teams that close deals, not manage software

**Stat bar (label every borrowed stat as benchmark):**
- **67%** avg. lift in conversion with AI-powered CRM *(industry benchmark)*
- **89%** of top agents will use AI CRM by end of 2026 *(industry benchmark)*
- **<60 sec** — our AI's average lead response time
- **24h** — from signup to a live AI Employee (concierge)

**Testimonial (placeholder until Day-14 swap, per P15):**
> *"We haven't missed a single after-hours WhatsApp enquiry since going live. The AI booked three site visits over one weekend while we were off."*
> — [Beta Agency Name], Mumbai

> 🇮🇳 Until real beta quotes land (week-2 `day-14-collect-testimonials.md`), keep "Mumbai-built · early-access launch" framing per P15 AC (no fake "200+ agencies").

---

## 4.5 — How It Works (🔁 CHANGE: localise 3 steps)

**Headline:** Up and running in three steps

1. **Connect your channels** — WhatsApp, Telegram, your website form, and portals (99acres, MagicBricks, Housing.com). ~15 minutes.
2. **Configure your AI** — tell it about your listings, your team, your localities. Plain language, no coding.
3. **Watch it work** — your AI qualifies leads, books site visits, and updates your CRM + Khata book in real time.

> 🇮🇳 Replaces master's "Rightmove, Zoopla" with Indian portals; adds Khata book.

---

## 4.6 — Pricing (✅ EXISTS — confirm trust line only)

`pricing.json` + P15 `/pricing` already cover the INR tiers (Solo ₹999 / Team ₹1,999 / Team+ +₹500 / AI Employee ₹7,999). **No copy change** beyond ensuring the trust line reads:

> All plans: 14-day free trial · no setup fee · 1-month money-back · GST invoices · data stays in India. *(AI Employee add-on: paid from day 1, concierge setup, no trial/refund.)*

> Do not import the master's "£X" table or "cancel anytime / no credit card" US-style line verbatim — the India trial/refund logic differs and is canonical in `pricing.json`.

---

## 4.7 — FAQ (🔁 CHANGE: add master Q&As, localised; AEO-ready)

P16 already requires FAQPage schema. **Add these 7 Q&As** (localised from master §4.7), 40–80 words each, written for AI-Overview citation (see `05`). These become FAQPage JSON-LD entries in P16.

**Q: What is an AI Employee for real estate?**
An AI Employee is an autonomous software agent built for real-estate workflows. It replies to new WhatsApp and portal leads within seconds, asks qualifying questions, answers property queries, books site visits, and follows up — without anyone lifting a finger. Unlike a basic chatbot, it understands context, remembers past chats, and hands off to a human agent at the right moment.

**Q: How is RealEstateFlow different from a normal CRM?**
A normal CRM stores data and waits for you to act. RealEstateFlow pairs an AI that actively works your leads with a CRM that gives you full pipeline visibility — plus a built-in Khata book and GST invoicing. The result: fewer dropped leads, faster replies, and a pipeline that updates itself.

**Q: Can the AI Employee handle WhatsApp enquiries?**
Yes — WhatsApp is the core. RealEstateFlow connects to the WhatsApp Business API, so every message (from a portal, your website, or WhatsApp directly) gets an instant, intelligent reply from the same AI that knows your listings and your team's availability. Telegram is supported too.

**Q: How long does setup take?**
Most teams are live within 24 hours. Connecting your WhatsApp and portals takes about 15 minutes; our concierge team configures your AI Employee within a 24-hour SLA and sends a Loom walkthrough on go-live.

**Q: Is my client data safe?**
Yes. Data is encrypted in transit and at rest, hosted in India (AWS Mumbai), and we are DPDP-compliant with a named Grievance Officer. Client conversations are stored securely and never used to train external AI models. Your data stays yours.

**Q: Which portals do you integrate with?**
We connect with 99acres, MagicBricks, and Housing.com, plus your website contact forms and WhatsApp. If a portal offers a webhook or feed, we can ingest it.

**Q: Do I need technical knowledge to use RealEstateFlow?**
No. It's built for brokers and agency owners, not developers. Setup is guided, AI configuration uses plain English, and chat + email support is available across all plans.

> 🇮🇳 Key swaps from master: GDPR→DPDP, "48 hours"→"24h", Rightmove/Zoopla→Indian portals, "7 days a week"→"chat + email support across all plans."

---

## 4.8 — CTA / Footer (🔁 CHANGE: adopt urgency CTA)

**Headline:** Your competitors are already using AI. Are you?
**Sub-head:** Every day without RealEstateFlow is a day of missed WhatsApp leads, slow replies, and lost site visits. Join the Mumbai teams closing more with less effort.
**CTA:** `Start your 14-day free trial`
**Under button:** No card required · 1-month money-back · cancel anytime.
**Footer:** keep P15 requirements — legal links (`/legal/*`), Grievance Officer block (`P9`), `info@realestateflow.in`, GST/CIN.

---

## 5. Apply targets

| Block | Target | Backlog |
|---|---|---|
| 4.1 trust row | `P15` `main` hero | E03-01 |
| 4.2 problem section | `P15` `main` (new section) | E03-02 |
| 4.3 solution split | `P15` `main` | E03-03 |
| 4.4 stat bar | `P15` `main` social proof | E03-04 |
| 4.5 how-it-works | `P15` `main` | E03-01 |
| 4.7 FAQ Q&As | `P15` FAQ + `P16` FAQPage schema | E03-06, E06-02 |
| 4.8 CTA | `P15` `main` footer CTA | E03-01 |

> All claims labelled where they are industry benchmarks; swap to first-party data once beta results land (week-2/week-4).
