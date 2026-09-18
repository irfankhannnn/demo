# 14 - Metrics, Claims Audit & Review

---

## 1. What to measure

Most Instagram metrics are noise for a pre-launch B2B account. Track these seven and ignore the rest.

| Metric | Where | Target (30 days) | Why it matters |
|--------|-------|------------------|----------------|
| **Waitlist signups** | Your own sheet | **150-300** | ★ The only metric that matters. Everything else is a leading indicator of this. |
| Qualified DM conversations | DM inbox | 40-80 | Real agency owners who replied more than once |
| Followers | IG Insights | 1,200-2,500 | Only useful if they're the right people (§2.3) |
| **Saves per carousel** | IG Insights | 40+ | Truest signal for B2B utility content |
| **Profile visits per reel** | IG Insights | 3%+ of reach | Someone who taps your profile is a warm lead |
| Comments per post | Post | 15+ | Driven by the keyword mechanic; feeds reach |
| Reach from non-followers | IG Insights | 70%+ | If this drops, the content is preaching to the converted |

### What to ignore
Likes. Total impressions. Follower count as a headline. Watch-time percentage on a 10-second reel.
None of these predict revenue for this business.

### Weekly scoreboard (fill this every Sunday)

```
Week __  (dates ________)

Posts published        __ / 7
Followers              ____  (+____ this week)
Median reel views      ____
Best post              ____  (____ views, ____ saves)
Worst post             ____  (____ views)
Comments total         ____
Keyword comments       SYSTEM __ · KHATA __ · AUDIT __ · DEMO __
DMs sent               ____
DM replies received    ____
Waitlist signups       ____  (running total: ____)
Reach from non-followers  ____%

One thing that worked:
One thing that didn't:
One change for next week:
```

---

## 2. ★ Claims audit - read before publishing any number

We are pre-launch with no customers. That is exactly the situation where marketing invents numbers.
Every statistic below was checked. **Only the green ones may appear in a creative.**

### 2.1 Claims found in the existing brand documents - status

| Claim | Source | Status | Ruling |
|-------|--------|--------|--------|
| **"200+ Agencies · Mumbai · Delhi · Pune · Dubai"** | `brand-kit.md` trust bar | ❌ **FALSE** | We have zero customers. **Delete from every template.** Already removed from this pack. |
| **"32% of your leads get lost in WhatsApp every month"** | `brand-kit.md` hook variants | ⚠️ **UNSOURCED** | No primary source. Do not publish. Safe alternative in §2.2. |
| **"Aapki agency ₹20 lakh khoti hai har saal"** | `brand-kit.md` / messaging framework | ⚠️ **UNSOURCED** | A specific rupee figure with no basis is the most legally and reputationally exposed claim in the set. **Do not publish.** |
| **"80% of deals need 5+ follow-ups"** | Widely circulated sales folklore | ⚠️ **UNSOURCED** | No reliable primary source exists. Not used in this pack - P02 asks the reader to calculate their own numbers instead. |
| **"69% of new real estate entrants quit within 6 months"** | Single vendor blog | ⚠️ **SINGLE SOURCE** | Vendor content marketing, no methodology. Do not publish as fact. |
| **"Broker-free direct-to-builder searches up 180%"** | Single vendor blog | ⚠️ **SINGLE SOURCE** | Directionally consistent with RERA transparency, but the number is unverifiable. **R08 makes this argument qualitatively - no number - which is why it's safe.** |

### 2.2 The rule that replaces all of them

> **Never assert a loss figure. Make the viewer produce their own.**

This is not just safer - it converts better. A number you assert is an advertising claim the viewer
discounts. A number they calculate themselves is a fact they now believe.

| ❌ Don't say | ✅ Say instead |
|-------------|---------------|
| "You lose ₹20 lakh a year" | "Pichle mahine kitne leads aaye? Unme se kitno ka teesra follow-up hua? Dono number likho." |
| "32% of leads are lost in WhatsApp" | "Abhi batao - aapki agency mein kitni deal live hai? Sochna pada?" |
| "80% of deals need 5 follow-ups" | "Aap calculate karo: kitne leads, kitne follow-ups." |
| "Agencies waste 15 hours a week" | "Aaj 200 message ka reply diya. Ek deal aage badhi?" |

Every pain post in this pack is built this way. That is deliberate - do not "strengthen" a script by
adding a statistic.

### 2.3 Claims we ARE allowed to make (all verified against the codebase)

These are green. They're specific, checkable, and stronger than any statistic.

| Claim | Verified in |
|-------|-------------|
| The AI understands Hinglish: `kharidar`, `kirayedar`, `makan`, `malik`, `sampark`, `milan`, `kitne`, `dikhao` | `agency-app/api/agents/domainRouter.js` |
| It runs real CRM operations from WhatsApp - leads, buyers, owners, tenants, contacts, properties, meetings, notes, documents | `agency-app/api/shared/toolDefinitions.js` |
| Daily brief, pipeline summary, priority leads, follow-up summary, business health, next-action suggestions | tool definitions |
| Khata Book: To Give / To Take, per party, per property, with categories and settlement status | `agency-app/web/src/types/khata.ts` |
| Khata categories: Brokerage, Maintenance, Deep Cleaning, Repair, Security Deposit, Rent, Utility Bills | `khata.ts` |
| Reminders on Khata entries, wired to notifications | `agency-app/api/notificationDynamodbService.js` |
| Connect your own WhatsApp number by QR - no Meta Business API needed | `platform/whatsapp-platform/` (Baileys) |
| 2 months free CRM, no credit card · 6-month money-back · AI Employee ₹5,000/mo, no free trial | Approved offer terms |

### 2.4 Mandatory disclosures

**Every creative that shows or names the WhatsApp AI Employee must state:**
> WhatsApp AI Employee: optional add-on, ₹5,000/month, no free trial.

Present in: R14, R16, C06, P04, R18. **Do not remove it to tighten a script.** The free-CRM-trial
message will otherwise imply the AI is free, and the first billing conversation will be the moment
that trust dies.

**The AI presenter:** add "AI presenter" to the Instagram bio and pinned post. See `04` §7.

### 2.5 The pre-publish check

Before any asset goes out, three questions:

1. **Is every number on screen either from §2.3, or something the viewer calculates themselves?**
2. **Does anything imply we have customers, results, or traction we don't have?**
3. **Does any feature shown actually work today?**

If the answer to any of these is wrong, the asset does not ship. No exceptions for a hero post.

---

## 3. Weekly review ritual

**Every Sunday, 30 minutes.** Non-negotiable - this is what makes month 2 better than month 1.

1. Fill the scoreboard in §1
2. Identify the week's **best and worst** post. For each ask: *was it the hook, the pillar, or the
   format?*
3. Read every comment from the week. **Copy any sentence a real agency owner wrote about their own
   problem into a running "voice of customer" file.** This is the highest-value output of month 1 -
   it is the raw material for month 2's scripts, the landing page, and the ad copy.
4. Check the pillar mix against `03` §1. If Chaos Mirror is over-indexing on reach, shift week 2's
   ratio.
5. Adjust next week's calendar. **The calendar is a plan, not a contract.**

---

## 4. Decision gates

### End of week 2 - is the audience right?
- Are the followers actual agency owners? Check 20 profiles by hand.
- If they're home buyers or salaried agents: hooks are too generic. Get more specific about
  *running an agency* - team, money, employees - and less about property.

### End of week 3 - is the product landing?
- Did R09 (thesis) and R10 (demo) hold watch time as well as the pain reels?
- If product content drops off a cliff, the audience isn't problem-aware yet. Extend the pain
  phase into week 4 and push the AI Employee reveal to month 2. **Better to delay the reveal than
  to burn it on an unready audience.**

### End of week 4 - did it convert?
- Under 50 waitlist signups: the content worked but the CTA didn't. The offer or the DM flow is the
  problem, not the creative.
- 150+ signups: start month 2 with the first real proof content and onboard the Founding 50.

---

## 5. What month 2 should be (do not build this yet)

Recorded here so month 1's outputs get captured rather than lost:

- **Real proof.** The Founding 50 are onboarding - capture screen recordings, real quotes, real
  before/afters. **With written permission.** This replaces Build in Public as the trust pillar.
- **"WhatsApp Se Puchho" becomes weekly.** It's the flagship series; give it a fixed Friday slot.
- **Voice-of-customer scripts.** Every post built from a sentence a real broker actually wrote in
  your comments or DMs.
- **Ganesh Chaturthi** - a major Mumbai/Pune moment falling in September. **Verify the exact 2026
  date** and plan the month-2 opener around it.
- **Paid amplification** - take the top 3 organic performers from month 1 into the Meta ads plan
  rather than making new ad creative. That plan is separate, as agreed.
