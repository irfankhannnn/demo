# 38 — Pricing: properties, Contacts and AI credits

> **Status (17 Sep 2026):** **Proposed — awaiting founder approval.** This is the plan for founder decisions D4 (plan structure and the Team+ contradiction), D5 (launch offer) and D6 (credits). It replaces the June token-pricing design in doc 30, which now only documents the credit metering as built. Nothing here is live: no price in the code changes until this is approved.

Every number about what exists today was checked against the code on this branch.

---

## 1. Why this needs fixing now

**Five live price lists disagree.** Team+ alone has four definitions: ₹1,999 + ₹500 per extra seat with unlimited members (`marketing-and-sales/launch-plan-v2/pricing.json:62-76`, and the contractual legal page `agency-app/landing-pages/legal/terms/index.html:117`), ₹4,999 for up to 10 members (`agency-app/web/src/lib/plans.ts:29-35`, `agency-app/landing-pages/pricing/index.html:42-43`), ₹4,999 for 5 seats on the server (`agency-app/api/subscriptionService.js:110`), and "Pro ₹5,999" in the Content OS sales scripts. Credit packs show ₹499/₹1,799/₹3,999 in the app (`BuyCreditsModal.tsx:17-21`) but charge ₹500/₹2,000/₹5,000 (`agency-app/api/creditConfig.js:51-62`). The AI Employee is ₹7,999 in the product and ₹5,000 in older marketing, and its description promises Telegram, which has no code.

**Almost nothing is enforced.** Seats are the only plan limit that exists server-side (`platform/auth/src/controllers/inviteController.ts:115-121`). There is no property limit, no lead limit, and the paywall after trial expiry is a frontend modal only (`PaywallModal.tsx:73-74`). The webhook never records which plan was bought (`routes/billing.js:259-267`), so a paying Team customer would still look like `plan:'solo'` with 1 seat and 1,000 credits.

**The credit meter measures the wrong thing.** One inbound WhatsApp message costs a flat 15 credits (₹15) whether it ran one Gemini call or six (`agents/agentRuntime.js:633-644`), while the things that genuinely cost money — Instagram DM analysis, embeddings, call intelligence, MCP tool calls — cost nothing. Purchased credits are wiped at the next monthly reset because the reset sets the balance rather than topping it up (`creditService.js:185-229`).

**And searching costs credits today.** Asking the AI Employee "3BHK Andheri dikhao" charges 15 credits because the whole turn is charged up front, even though the search itself is free to run. That is exactly backwards: search is what makes the CRM sticky.

---

## 2. The model

Four things, and only four, decide what an agency pays.

| | What it measures | Why |
|---|---|---|
| **Seats** | people who log in | the usual SaaS fence, already enforced |
| **Active properties** | inventory under management | a fair proxy for the size of the business; costs us almost nothing, so it is a value fence, not a cost fence |
| **Contacts** | **leads your workspace actually reached this month** | the outcome the agency is buying, and the only thing that costs us real money per unit |
| **AI credits** | AI voice minutes and AI work beyond what a Contact includes | voice is 20–30× the cost of a chat message, so it cannot sit inside a flat allowance |

**Searching, storing and viewing are never charged.** Not property search, not semantic matching, not embeddings, not the CRM itself. An agency can put its whole inventory in, search it all day, and pay nothing extra.

### 2.1 Exact definitions (so this is implementable)

**Active property** — a `PROPERTY` item whose `status` is not `archived` (`crmDynamodbService.js:1170-1172`, `archiveProperty` at `:1832-1834`). Sold and rented properties still count, because they are still being managed (rent roll, khatabook, documents). Archived properties are free and unlimited, and nothing is ever deleted. Counted by a per-tenant counter item, updated on create and on archive/unarchive — never by scanning the table.

**Contact** — one lead that your workspace reached, once per calendar month, on the **first outbound touch**, whoever makes it:
- counts: a WhatsApp message sent to the lead (AI or human), an Instagram DM reply, an AI voice call that connects, a manual call logged, an email sent through the CRM;
- does not count: a lead arriving, being stored, qualified, scored, assigned, searched or viewed; a lead that messages you that you never answer; failed sends; dry-run and test sends; internal notes; messages to your own staff;
- one lead touched twenty times in a month is **one** Contact. The same lead next month is a new Contact.

What one Contact includes, at no extra charge: AI qualification and scoring of that lead, up to **25 AI messages** across channels in that month, follow-up drafting, and the WhatsApp message fees for those conversations under fair use. Beyond 25 AI messages, each further message costs 1 credit.

**AI credit** — ₹1, whole numbers, deducted atomically as today (`creditService.js:101-158`). After this change credits pay for:

| Action | Credits | Note |
|---|---|---|
| AI voice call | **15 per started minute** | unchanged; this is the one genuinely expensive action |
| AI message beyond the 25 included in a Contact | 1 | today it is 15 per message with no allowance |
| AI message to somebody who is not a lead (staff commands, testing) | 1 | |
| Property search, matching, embeddings, call transcription and notes | **0** | bundled |
| Creating or updating any record | 0 | unchanged |

---

## 3. The proposed price list

Monthly, ₹, plus 18% GST. Annual pays for 10 months.

| | **Solo** ₹999 | **Team** ₹1,999 | **Team+** ₹4,999 |
|---|---|---|---|
| Seats | 1 | 3 | 10 |
| Extra seat | — | ₹500/month | ₹500/month |
| Active properties | 100 | 500 | 2,000 |
| Extra properties | ₹499 per 250/month | ₹499 per 250 | ₹499 per 250 |
| **Contacts included / month** | **50** | **100** | **250** |
| Extra Contacts | ₹12 each (pack of 50 = ₹600) | ₹12 each | ₹10 each (pack of 50 = ₹500) |
| AI credits / month | 300 | 900 | 3,000 |
| WhatsApp numbers | 1 | 1 | 3 |
| Instagram accounts | 1 | 2 | 5 |
| Public property pages | ✓ | ✓ | ✓ |
| MCP / API access | — | ✓ | ✓ |

**AI Employee add-on — ₹7,999/month** (no trial, no refund, as today): switches the AI on across WhatsApp, Instagram and voice, includes the concierge setup, **250 extra Contacts** and **3,000 AI credits** (≈200 AI call-minutes) each month.

**Credit packs** (one-time, never expire): 500 credits ₹500 · 2,000 credits ₹2,000 · 5,000 credits ₹5,000. This is what the server already charges; the app's ₹499/₹1,799/₹3,999 labels are wrong and get fixed.

**This settles D4** in favour of ₹4,999 for 10 seats — the number the app, the pricing page and the home page already show — with the ₹500 extra seat from the legal page kept. The legal terms and refund pages have to be updated to match, and there are no customers on the old wording.

**No free plan.** The Content OS sales scripts invented Free / Growth / Pro tiers with lead caps; those are dropped.

### 3.1 What it looks like on a real bill

| Agency | Usage | Monthly |
|---|---|---|
| Solo broker, Andheri | 80 properties, 40 leads contacted, no AI calls | **₹999** |
| 4-person agency | 300 properties, 160 contacts, 20 AI call-minutes | ₹1,999 + 1 seat ₹500 + 60 contacts ₹720 = **₹3,219** |
| 12-person agency with the AI Employee | 1,800 properties, 600 contacts, 150 AI call-minutes | ₹4,999 + 2 seats ₹1,000 + AI Employee ₹7,999 + 100 contacts ₹1,000 = **₹14,998** |

### 3.2 Does it pay for itself?

Cost per contacted lead, at Meta's India list rates and Gemini 3.8 Flash pricing (both read 17 Sep 2026; detail in doc 39 §5):

| Cost | Per contacted lead |
|---|---|
| WhatsApp messages (service + utility + 2 marketing) | ≈ ₹2.40 |
| AI messages (~8 turns × ~₹0.50) | ≈ ₹4.00 |
| Qualification, scoring, embeddings, storage | ≈ ₹0.20 |
| **Total** | **≈ ₹6.60** |

So an extra Contact at ₹12 carries about 45% gross margin, and a plan used to its full Contact allowance costs us roughly 30% of the subscription (Solo ₹330 of ₹999; Team ₹660 of ₹1,999; Team+ ₹1,650 of ₹4,999). Most agencies will not use the whole allowance.

AI voice is the tight one: Exotel plus ElevenLabs Agents runs roughly ₹8–10 a minute, so 15 credits (₹15) a minute is a sensible floor — do not discount it. **Open item:** confirm the real ElevenLabs per-minute rate on our plan; `docs/agency-app/ai-calling/EXOTEL-ELEVENLABS-SETUP-BRIEF.md:85-90` quotes only the LLM part.

### 3.3 Launch offer (D5)

Until public launch, one offer, for the first **50 agencies**:
- 2 months free, no card;
- 6-month money-back guarantee;
- AI Employee at **₹5,000/month, price locked for 12 months**;
- founding badge and direct founder access.

At public launch this reverts to the standard 14-day trial, 30-day money-back and ₹7,999. The "2 months free / 6-month refund" language already in the ad and webinar material then stops being used. Whatever is chosen has to be written in exactly one place (`pricing.json`) and read from there by the app, the site and the legal pages.

---

## 4. The Contacts pipeline

Contacts only work if every channel emits the same event. The Instagram service already has the shape we want — intake, analysis, scoring, hand-off — so the CRM gets the same spine, with one new billable step.

```
intake            identity            qualify + score        assign
(adapters)   →   (dedupe by     →    (AI, free)        →   (router, free)
                  phone)
                                                              ↓
   outcome        conversation                          ►► CONTACT ◄◄
(visit/won/lost) ← (AI or human,  ←  first outbound touch: WhatsApp, Instagram,
                    25 AI msgs)       AI call, manual call, email  → billable
```

**The event.** One function, `recordContact(tenantId, leadId, channel, actorType)`, called from every outbound path. It writes:

- `PK = TENANT#<t>#CONTACTS#<yyyy-mm>`, `SK = LEAD#<leadId>`, with `ConditionExpression: attribute_not_exists(PK)` — so the first touch in a month wins and every later touch is a no-op. This is the same first-writer-wins trick the Instagram service uses for comments (`agency-app/instagram-api/services/dynamoService.js:439-457`).
- On a successful conditional write only: atomically increment `TENANT#<t>#CONTACTS#<yyyy-mm>` / `SK=SUMMARY` (`contactsUsed`, and a per-channel breakdown).
- A durable evidence row: tenant, lead, channel, actor (AI or the user id), timestamp, and the provider message id. **No TTL.** The credit ledger's 12-month TTL (`creditService.js:36-38`) already conflicts with keeping billing evidence; Contacts rows must be archived, never expired.

**Where it gets called.** The exact hook lines are listed in §4.1. The rule is that it goes at the point where a send **succeeded**, never where one was queued.

**Enforcement, in the right order:**
1. Under 80% of the allowance: nothing.
2. At 80%: in-app banner and one email to the admin.
3. At 100%: **AI-initiated outreach pauses** — the follow-up cron stops, bulk sends stop, and the owner is asked to top up or upgrade.
4. **A human replying to a lead is never blocked**, and neither is anything inbound. Refusing to let an agency answer a customer who just messaged them would cost them a deal to save us ₹6, and it would breach WhatsApp's policy expectation of a prompt human path.
5. Over-allowance touches are billed at the plan's extra-Contact rate on the next invoice (or drawn from a prepaid Contact pack).

**What the agency sees.** One "Usage" page: contacts used against included, properties used against included, credits left, the channel split, and the leads contacted this month. It replaces the current billing chart, which is `Math.random()` mock data (`pages/crm/BillingSettings.tsx:87-96`).

### 4.1 Hook points

Six call sites cover every channel that reaches CRM code with a lead id in scope:

| # | Channel | Hook | Args |
|---|---|---|---|
| 1 | AI voice call, on-demand and follow-up-agent (both funnel through this route) | `agency-app/api/routes/aiCallingInternal.js:539`, right after `updateLead(...)` in `PATCH /leads/:leadId/call-outcome` | `ai_call`, `ai` |
| 2 | AI call that books a site visit mid-call | `agency-app/api/routes/aiCallingInternal.js:399` | `ai_call`, `ai` |
| 3 | Manual click-to-call | `agency-app/api/routes/clickToCall.js:262` | `manual_call`, `human` |
| 4 | WhatsApp sent by a person from the CRM inbox | `agency-app/api/routes/whatsappConversations.js:141` | `whatsapp`, `human` |
| 5 | WhatsApp sent by the AI Employee | `agency-app/api/scripts/whatsapp-message-processor.js:242`, once per inbound message handled, not once per chunk | `whatsapp`, `ai` |
| 6 | Follow-up cron | `agency-app/api/scripts/lead-followup-cron.js` `sendViaWhatsApp()` (`:31-36`) and `sendViaEmail()` (`:38-43`) | `whatsapp` / `email`, `ai` |

Four things have to be fixed for those hooks to be correct:

- **Hooks 4, 5 and 6 only know a phone number**, not a lead id, and the WhatsApp conversation log normalises phones differently from the lead table. A shared `findLeadByPhone` on one normalisation has to come first.
- **Click-to-call fires on dial, not on answer**, because `agency-app/ai-calling` never calls back on completion for that path (`src/handlers/callOrchestration.js:383` is where the callback would go). Either accept "dialled" as the contact event or build the callback.
- **Instagram replies never reach the CRM at all** (`agency-app/instagram-api/services/instagramService.js:619-666`), so a small reverse call is needed before Instagram contacts can be counted.
- **Nothing existing can be reused as the ledger.** The CRM's `logContactActivity()` refuses to resolve a contact id when the subject is a lead (`crmDynamodbService.js:6709-6712`), so every lead activity log silently no-ops; the only per-lead trail is an unindexed `history[]` array on the lead item. The WhatsApp conversation log is indexed by phone and deletes itself after 90 days. The credit ledger's `actionType-index` is the best-shaped index but carries a lead id only for AI call minutes, and expires after 12 months.

Manual lead creation and note-writing must **not** call `recordContact` — entering a lead is not reaching a person.

---

## 5. Build order

**P0 — one price list.** Make `pricing.json` the only source, generate `plans.ts`, the pricing page and the landing partials from it, and update the legal terms and refund pages to match. Remove the Telegram promise. Fix the credit-pack labels to ₹500/₹2,000/₹5,000.

**P1 — make billing actually work** (this is a launch blocker regardless of the model):
- create Razorpay subscriptions server-side; today the app passes a plan id where Checkout expects a `sub_…` id, so seat-plan checkout cannot work (`PaywallModal.tsx:99-101`, `src/lib/razorpay.ts:90-91`);
- `subscription.activated` must write `plan`, `seatsPaid` and `paymentStatus`, and `subscription.charged` must clear grace (`routes/billing.js:259-290`);
- schedule the grace-expiry cron (it exists, unscheduled: `scripts/grace-period-expiry-cron.js`) and enforce read-only on the server, not just in the modal;
- monthly reset must top up the allowance bucket and **leave purchased credits alone**.

**P2 — the meters.** Property counter; the Contacts ledger and `recordContact` hooks; credit costs moved to config (`AGENT_ACTION_CREDITS` currently bypasses the admin editor: `creditConfig.js:85-91`); the free-search rule — a turn whose tools were all read-only lookups is refunded, using the tool-result array the refund path already inspects (`agentRuntime.js:98-100`).

**P3 — limits and UI.** Plan-limit middleware (properties, contacts, seats, channels) with the escalation order in §4; the real Usage page; low-balance and low-contact alerts.

**P4 — measure, then tune.** Log per-turn token usage (nothing logs it today — only a Gemini call count at `agentRuntime.js:536`), and reconcile WhatsApp costs from the status webhooks' `pricing.billable` field per tenant per month. Revisit the allowances after 3 months of real data.

---

## 6. Risks and anti-abuse

- **Contact gaming.** An agency could merge leads or re-create them to dodge the meter. Dedupe by normalised phone, count on the lead's canonical id, and count a merged lead once.
- **The ManyChat overlap.** Agencies using the ManyChat adapter already pay ManyChat per contact (`docs/public-app/property-pages/03-PRICING.md:11-17`). Say plainly in the pricing page what our Contact covers so it does not read as double billing.
- **WhatsApp fees are not flat.** Marketing templates cost 7.5× utility ones. Fair use for the bundled fees must cap marketing templates per Contact, or heavy broadcasters become unprofitable.
- **Naming collision.** "Contact" is already a CRM entity type. Use `contacted_lead` as the internal key and keep "Contacts" for the customer-facing word.
- **RBI e-mandate.** Recurring debits above ₹15,000 need additional authentication, so annual Team+ plus AI Employee cannot be collected as a simple mandate.
- **GST** is not computed anywhere in the order code today (`routes/subscriptions.js:184-193`), while every price is quoted "+ 18% GST".

---

## 7. What I need from you

1. **Contact allowances** — 50 / 100 / 250 a month. Too tight, about right, or too generous for a Mumbai agency?
2. **Property limits** — 100 / 500 / 2,000, with archived free. Does that match what agencies actually hold?
3. **Team price** — keep Team at ₹1,999, or raise it to ₹2,499 now that it carries 100 Contacts?
4. **Team+** — confirm ₹4,999 for 10 seats (this overrides the legal page's ₹1,999 + ₹500/seat).
5. **AI Employee** — ₹7,999 with 250 Contacts and 3,000 credits included, ₹5,000 for founding customers?
6. **AI voice** — keep 15 credits (₹15) a minute, and confirm the real ElevenLabs rate on our plan.
7. **Launch offer** — Founding 50 as in §3.3, and when the standard terms take over.
8. Anything that must **never** be metered, beyond search.
