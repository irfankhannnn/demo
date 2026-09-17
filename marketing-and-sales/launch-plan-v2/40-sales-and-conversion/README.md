# 40 — Sales and conversion

**How a follower becomes a paying agency.** Layer 3 (`../30-channels/`) gets attention and opens a conversation; this layer runs the conversation from the first DM to a signed, onboarded, retained customer.

Read `../10-audience-and-voice/claims-and-proof-policy.md` before writing a single line of sales copy. It is the reason most of the "proof" in these scripts was rewritten: **we have zero customers, so there is no peer story to tell.** What replaces it is arithmetic the prospect does on their own numbers — which is harder to write and considerably harder to argue with.

---

## Who sells

**The founder.** There is no SDR until MRR reaches ₹2L, and no plan to hire one before that. Every route in these scripts is work one person personally does, which is the real ceiling on how many Hot leads this funnel can absorb. Design the cadence around that, not around an imaginary team.

The `sdr`, `nurture-bot` and `pipeline-manager` agents in `tools/claude-skills/agents/` **draft**; a human reviews and sends.

## The cadence

| | |
|---|---|
| **Demo windows** | Tuesday to Friday, 11:00–17:00 IST |
| **Booking** | Cal.com |
| **Speed to lead** | first reply within 5 minutes; every inbound gets a human answer the same session |
| **Daily outbound caps** | 20 cold emails · 15 cold WhatsApps · 10 LinkedIn DMs. The week-3 and week-4 day files set the actual numbers per day; these are the ceilings |
| **Demo length** | 10–15 minutes full, or the 90-second walkthrough for a curiosity lead |
| **Follow-up** | 7 touches over 21 days, then break-up and long-term nurture |

## The script for each stage

```
Instagram / Facebook / LinkedIn
   → dm-to-demo.md        the DM funnel: keyword, value, two questions, hand-off
   → qualification.md     score, route, decide who gets a demo
   → demo-script.md       one pain, one wow, the trial ask
   → objections.md        what they say back, and what to say to it
   → closing-script.md    plan selection, risk reversal, discount guardrails
   → onboarding-script.md 7-day activation, then the 30-day habit
   → followup-script.md   runs alongside all of it, whenever they go quiet
customer-journey.md sits over the whole thing as the map, with the drop-off analysis.
```

## The day-file contract

The week folders and these scripts answer different questions, and neither replaces the other:

- **The day files win on *when*, *to whom* and *how many*.** They carry the daily caps, the channel mix, the cohort lists and the acceptance criteria. They are the schedule.
- **These scripts win on *what to say*.** Call structure, objection handling, the closing sequence. Nothing in the day files replaces them.

So each side points at the other. Every outreach day file carries one `> **Script:**` line in its header block, and every script carries a `**Used by:**` footer naming the day files that call it.

| Day file | Script it runs on |
|---|---|
| `../week-2-soft-launch/day-09-craft-send-invites.md` | `qualification.md` · `../30-channels/whatsapp/lead-nurture.md` |
| `../week-2-soft-launch/day-10-onboarding-calls.md` | `demo-script.md` · `onboarding-script.md` · `../30-channels/whatsapp/customer-success.md` |
| `../week-2-soft-launch/day-13-checkin-drip.md` | `followup-script.md` · `../30-channels/whatsapp/message-templates.md` |
| `../week-3-public-launch/day-17-cold-outreach-prep.md` | `qualification.md` · `objections.md` |
| `../week-3-public-launch/day-18-execute-cold-day1.md` | `qualification.md` · `../30-channels/whatsapp/message-templates.md` |
| `../week-3-public-launch/day-19-cold-day2-iterate.md` | `objections.md` · `followup-script.md` |
| `../week-4-optimize-convert/day-23-followup-non-replies.md` | `followup-script.md` · `../30-channels/whatsapp/message-templates.md` |
| `../week-4-optimize-convert/day-24-reactivation-stalled-trials.md` | `onboarding-script.md` · `../30-channels/whatsapp/customer-success.md` |
| `../week-4-optimize-convert/day-26-trial-to-paid.md` | `closing-script.md` · `objections.md` |
| `../week-4-optimize-convert/day-27-pitch-refinement.md` | `demo-script.md` · `objections.md` |
| `../week-4-optimize-convert/day-29-revenue-retention-audit.md` | `customer-journey.md` · `closing-script.md` |

`../30-channels/whatsapp/*` and `../30-channels/instagram/dm-workflows.md` sit in the same relationship to the day files and follow the same contract.

---

## Three things every file in this folder obeys

**1. Prices come from `../pricing.json`, through tokens.** `{{price_line}}`, `{{trial_line}}`, `{{ai_employee_disclosure}}` — resolved when you send, never typed into a script. The tiers are **Solo, Team, Team+ and the AI Employee add-on**; there is no Free plan, no Starter, no Growth, and no lead-count caps, because plans are priced by seats. The trial is 14 days with no card; there is a 30-day money-back window for first-time subscribers; annual billing is 20% off and does not apply to the add-on. `pricing.json` and the CRM's own plan config **disagree on Team+** — check before quoting it. The whole model is being re-planned in `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`.

**2. No invented proof.** No named customer, no "an Andheri owner told us", no adoption percentage, no ₹ figure for what someone else recovered, no unsourced conversion statistic. The June drafts of these seven scripts contained all of those. What replaced them: the risk reversal (trial, money-back, cancel any time), a live demo on the prospect's own lead, and arithmetic built from numbers they supply. A real testimonial becomes available the moment a paying customer gives **written permission**, and not before.

**3. Say what the product does, not what it might.** Every capability named in a script is checked against `../10-audience-and-voice/product-truth.md`. Notably: the CRM interface is **English** (the AI speaks Hinglish on calls, and there is speech-to-text for people who dislike typing); the automated follow-up agent calls **only inside the tenant's business hours**; the Instagram capture service is built but still in Meta Development Mode; AI call minutes are metered in credits.

---

## The two open questions this layer runs into constantly

**What is the demo's wow, and what counts as activation?** These scripts were written around a live AI call — a call as the wow, "first AI call by Day 2" as the aha. The launch plan's wedge is the **WhatsApp AI Employee**, with activation defined as the owner connecting WhatsApp and the AI Employee handling an inbound lead within 7 days. The catch is that a trial user cannot reach the AI Employee milestone at all: it is a paid add-on with no trial, while AI call minutes are covered by the trial's credit allowance. An activation metric a free-trial user cannot hit is not an activation metric.

Both readings are carried, side by side and flagged, in `demo-script.md` §4, `onboarding-script.md`, `customer-journey.md` and `../30-channels/whatsapp/customer-success.md`.

> Open decisions D26 (which AI features marketing may show) and D27 (what counts as activation) — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

**Which WhatsApp number talks to prospects?** Today the product's WhatsApp is a self-hosted Baileys service used as the agency's own command channel, not a Business-API sender — so no approved-template workflow, and no template gate protecting the number either. Everything in these scripts that goes out over WhatsApp inherits that.

> Open decision D29c — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md · plan: `docs/realestateflow-vision/39-whatsapp-official-api-plan.md`

## Measurement

Every metric these scripts mention is defined once, in `../50-measurement/metric-dictionary.md`, and reported in `../50-measurement/weekly-scorecard.md`. The conversion rates in `customer-journey.md` are **planning assumptions, not measured results** — there is no funnel history yet. Replace each with the real number as soon as there is one.
