# Claims and proof policy

> **Status (17 Sep 2026):** The hard rule for every public word RealEstateFlow publishes. Extracted from `marketing-and-sales/realestateflow/content-strategy-first-month/14-METRICS-CLAIMS-REVIEW.md` and made enforceable across the playbook. This is the file that stops the fabricated proof in the June drafts from coming back.

Every content doc in `20-content-engine/`, `30-channels/` and `40-sales-and-conversion/` links here. If a draft breaks a rule below, the draft changes — not the rule.

---

## 1. The situation you are writing from

RealEstateFlow is **pre-launch with zero customers**. There are no paying agencies, no testimonials, no case studies, no results, no adoption numbers, no retention numbers. The "200+ Agencies · Mumbai · Delhi · Pune · Dubai" trust bar that appears in older brand documents is **false** and has been removed from the month-1 pack; delete it wherever it resurfaces.

The founder does not appear on camera. Video is fronted by an AI presenter.

---

## 2. Banned outright

| Banned | Why |
|---|---|
| Any customer count ("200+ agencies", "500+ agencies", "trusted by…") | We have none. |
| Any testimonial, quote, review or named agency story | We have none, and a fabricated one is unrecoverable. |
| Any case study with a result ("cut lead leakage to near-zero", "closed 4x more", "site visits doubled") | Invented. |
| Any adoption or retention statistic ("95% active after month 1", "2-week onboarding", "99.9% uptime") | No users, no SLA in the repo. |
| Asserted loss figures — "₹20 lakh a year", "32% of leads lost in WhatsApp", "80% of deals need 5 follow-ups", "69% quit in 6 months", "₹50K/day leak" | Unsourced. The rupee figures are the most legally exposed claims in the set. |
| The AI presenter claiming to be a broker, an owner, a customer, or the founder | It is not one. Presenting it as one is the same lie as a fake testimonial. |
| The founder on camera in a reel, vlog, live, podcast or interview | Standing decision. Text, LinkedIn posts and voice-over are fine. |
| Certification, compliance or security claims not backed by a document in the repo | None exist. |
| Features that do not exist: portal sync (MagicBricks/99acres/Housing), Facebook Messenger sync, Google Ads lead sync, a lead-leakage / ROI calculator, a "Broker Follow-up Tracker" lead magnet, Telegram | Verified absent. The calculator on `agency-app/landing-pages/agency-owners/index.html` is a placeholder. |
| Tier names that exist in no pricing source: Free, Starter, Growth, Pro, Enterprise, "free plan", "50 leads free", "lifetime", "no expiry" | Invented. |

---

## 3. The rule that replaces asserted statistics

> **Never assert a loss figure. Make the viewer produce their own.**

It is safer and it converts better — a number the viewer calculates is a fact they already believe.

| Do not say | Say instead |
|---|---|
| "You lose ₹20 lakh a year" | "Pichle mahine kitne leads aaye? Unme se kitno ka teesra follow-up hua? Dono number likho." |
| "32% of leads are lost in WhatsApp" | "Abhi batao — aapki agency mein kitni deal live hai? Sochna pada?" |
| "80% of deals need 5 follow-ups" | "Aap calculate karo: kitne leads, kitne follow-ups." |
| "Agencies waste 15 hours a week" | "Aaj 200 message ka reply diya. Ek deal aage badhi?" |

Do not "strengthen" a script by adding a statistic. That is the failure mode this section exists to stop.

---

## 4. Approved claims (green — every one verified in code)

| Claim | Verified in |
|---|---|
| The AI understands Hinglish: `kharidar`, `kirayedar`, `makan`, `malik`, `sampark`, `milan`, `kitne`, `dikhao` | `agency-app/api/agents/domainRouter.js` |
| It runs real CRM operations from WhatsApp — leads, buyers, owners, tenants, contacts, properties, meetings, notes, documents | `agency-app/api/shared/toolDefinitions.js` |
| Daily brief, pipeline summary, priority leads, follow-up summary, business health, next-action suggestions | tool definitions, as above |
| Khata Book: To Give / To Take, per party, per property, with categories and settlement status | `agency-app/web/src/types/khata.ts` |
| Khata categories: Brokerage, Maintenance, Deep Cleaning, Repair, Security Deposit, Rent, Utility Bills | `khata.ts`, as above |
| Reminders on Khata entries, wired to notifications | `agency-app/api/notificationDynamodbService.js` |
| Connect your own WhatsApp number by QR — no Meta Business API needed | `platform/whatsapp-platform/` (Baileys) |

Everything else a creative wants to claim must first be added to `10-audience-and-voice/product-truth.md` with a repo path, and then added to this table by the founder.

**Features that are built but are NOT on the approved list yet** — AI calling, AI follow-up calls, the hosted Instagram lead service, public property pages, the AI Assistant, team analytics, credits. They exist (see `product-truth.md`), but marketing may not lead with them until the founder promotes them here.

> Open decision D26 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 5. What you may use as proof instead

1. **Screen recordings of the real product.** The CRM, the WhatsApp inbox, the AI Employee handling a sample lead. This is the strongest proof we have and it is honest.
2. **Build-in-public notes.** "Yeh hum abhi bana rahe hain" is credible and pre-launch-appropriate.
3. **Specific, checkable capability claims** from §4 — they beat any statistic.
4. **RERA and legal facts**, which are public and verifiable.
5. **Clearly labelled hypotheticals.** A dramatised skit is honest when it is labelled as fiction and names no agency, city or result.

Real customer proof becomes available only after a real customer gives written permission. The first realistic moment for that is after the Day-28 NPS round.

---

## 6. Mandatory disclosures

- **Every creative that shows or names the WhatsApp AI Employee** must carry its price and no-trial line, resolved from `pricing.json`. Do not remove it to tighten a script — without it the free-CRM-trial message implies the AI is free, and the first billing conversation is where trust dies.
- **The Instagram bio and the pinned post must say "AI presenter."**
- **A dramatised skit** carries an on-screen "dramatised" label.
- The Instagram lead service is **dev-only, prod not deployed, Meta App Review pending**. No creative may promise automated DM handling as if it were live.

---

## 7. Pre-publish checklist (six items, all must pass)

1. Is every number on screen either from §4, or something the viewer calculates themselves?
2. Does anything imply we have customers, results, traction or reviews that we do not have?
3. Does every feature shown actually work today, and is it in `product-truth.md` with a repo path?
4. Is any price or trial term resolved from `pricing.json` rather than typed in by hand?
5. If the AI presenter speaks, does it stay the brand's narrator — never a broker, owner, customer or the founder?
6. If the AI Employee appears, is the price and no-trial disclosure on screen?

Any "no" means the asset does not ship. There is no exception for a hero post.
