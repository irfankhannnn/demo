# Prospect scoring (our own B2B pipeline)

How we rank the brokers and agencies **we** are selling to, so the next hour of outreach goes to the right name.

This scores RealEstateFlow's own prospects. It is **not** the CRM's lead scoring. A customer's buyer leads are scored in code by `agency-app/api/utils/leadRubric.js` (HOT / WARM / COLD from an AI call or from text) and, for Instagram enquiries, by `agency-app/instagram-api/services/leadAnalyst.js`. Those two are built and are not affected by anything on this page. The June document this replaces conflated the two populations throughout, which is how it came to claim "leads have no score today" while the CRM was scoring leads.

> **Design only as software — not built.** There is no prospect scoring service and no prospect record in the CRM. This runs as a column in the prospect sheet, scored by hand or by an agent reading the sheet.

Same three bands as the CRM, deliberately: **HOT / WARM / COLD**. The June model had four bands ("Cool"), which meant our own pipeline used a vocabulary the product did not. One vocabulary.

---

## 1. The four dimensions, 100 points

`score = FIT + SOURCE + INTENT + ENGAGEMENT`

### FIT — 30 points. Are they the M1 ICP?

The M1 ICP is **solo brokers and teams of three or fewer agents, in Mumbai** (`00-PLAN-OVERVIEW.md` §1). The June weights rewarded 8+ agent agencies and four cities, which is the opposite of the plan, so the weights are inverted here.

| Signal | Points |
|---|---|
| Solo broker or team of ≤3 agents | 12 |
| Team of 4-8 agents | 7 |
| Larger than 8 agents | 3 |
| Mumbai | 8 |
| Elsewhere | 0 |
| Speaking to the owner or decision maker | 8 |
| Speaking to a manager or champion | 4 |
| RERA registered | 2 |

> Open decision D24 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md — city scope beyond Mumbai. The plan's later cities (Pune, then Bangalore, Delhi, Hyderabad) score zero on the city line until M1 closes.

### SOURCE — 20 points. How warm was the channel?

| Source | Points |
|---|---|
| Referral from a customer or a broker we know | 20 |
| Asked for a demo directly | 20 |
| Inbound WhatsApp | 16 |
| Instagram DM | 14 |
| Instagram comment or profile visit | 7 |
| LinkedIn | 6 |
| Cold email or cold WhatsApp | 4 |
| Unknown | 0 |

These values are the vocabulary in [`metric-dictionary.md`](./metric-dictionary.md) §8 for prospects. Do not mix them with the CRM's tenant-lead `source` list.

### INTENT — 30 points. Did they signal buying?

Take the **highest** applicable tier, then add the trigger bonus.

| Signal | Points |
|---|---|
| Booked or asked for a demo | 30 |
| Asked about price, or "kitna", "demo dikhao" | 22 |
| Visited the pricing page in a session we can see | 18 |
| Soft interest — replied to a reel, "batao", "interested" | 10 |
| **Bonus:** a live trigger — lost a deal to slow follow-up, an agent just left, a payments or khata dispute | +10 |

The trigger bonus is additive because a trigger is independent of what they said. It is also the single most predictive thing on this page: a broker who just lost a deal because a follow-up slipped is the person this product is for.

### ENGAGEMENT — 20 points. How much, how recently?

| Signal | Points |
|---|---|
| Last contact within 24 hours | 10 |
| Within 72 hours | 6 |
| Within 7 days | 3 |
| Five or more exchanges with us | 6 |
| Three to four | 4 |
| One to two | 2 |
| Replied within five minutes of our message | 2 |
| Touched two or more different pieces of our content | 2 |

Recency tiers are exclusive; depth tiers are exclusive; the last two are additive.

## 2. Bands and what they mean for the day

| Band | Score | What happens |
|---|---|---|
| **HOT** | ≥70 | Contacted today. Demo offered in the next available Tue-Fri 11:00-17:00 slot. |
| **WARM** | 40-69 | Worked this week. One more piece of value before the demo ask. |
| **COLD** | <40 | Stays in the nurture list. No demo push. |

`M-NS1` (qualified demos per week) counts demos booked with a HOT or WARM prospect — see [`metric-dictionary.md`](./metric-dictionary.md) §0.

## 3. How to run it

Columns in the prospect sheet: name · handle or number · city · team size · source · last touch date · touch count · trigger y/n · FIT · SOURCE · INTENT · ENGAGEMENT · score · band · next action.

Rescore when something changes, not on a schedule. A sheet of 50 prospects takes ten minutes to re-sort.

The scripts that act on each band live in [`../40-sales-and-conversion/`](../40-sales-and-conversion/) — qualification, demo, objections, closing, follow-up. There is no SDR: the founder runs all of it until MRR reaches ₹2L (`00-DECISIONS-LOG.md`).

## 4. When this should become code

Two conditions together: more than ~200 live prospects, and prospects arriving faster than they can be scored by hand. The obvious implementation at that point is not a new service — it is running RealEstateFlow as its own tenant in its own CRM, so our prospects get `leadRubric.js` and, if they came through Instagram, `leadAnalyst.js` for free. That depends on Meta App Review passing so our own Instagram account can be connected.

> Open decision D29 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

Recorded with that trigger in [`design-only-backlog.md`](./design-only-backlog.md).
