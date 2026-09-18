# Instagram — DM workflows

> **RealEstateFlow · `@realestateflow`**
> The DM is where **attention becomes a qualified conversation** — the bridge from a reel, story or comment to a WhatsApp demo. Stories open DMs (`stories.md` §4), comments route to DMs (`comments.md` §4), keywords trigger DMs. This file is the funnel inside the inbox. Works with `../../40-sales-and-conversion/dm-to-demo.md`, the sales scripts (`../../40-sales-and-conversion/qualification.md`, `objections.md`, `demo-script.md`) and `../whatsapp/`.

**Audience reality:** brokers prefer typing over calls, reply fast to value, hate being sold to in public, and live on WhatsApp. So: deliver value first, qualify in ≤2 questions, never lead with pricing, move richer chats to WhatsApp quickly. Brand copy 70% English / 30% romanized Hindi.

**Used by:** `../../week-2-soft-launch/day-09-craft-send-invites.md` · `../../week-3-public-launch/day-17-cold-outreach-prep.md`, `day-18-execute-cold-day1.md`, `day-19-cold-day2-iterate.md` · `../../week-4-optimize-convert/day-23-followup-non-replies.md`, `day-26-trial-to-paid.md`. Those day files set *when, to whom and how many*; this file sets *what to say*.

---

## 1. Keyword table

Each keyword (used as the comment-bait or story-bait CTA) triggers a reply. The **month-1 keyword set is `SYSTEM` · `KHATA` · `AUDIT` · `DEMO`** — keep public CTAs on those four. The rest of the table is the fuller set to grow into.

**How the reply is actually sent.** Keyword rules are built: `agency-app/instagram-api` matches a comment or DM against the tenant's rules (`services/ruleMatcher.js`) and can send a private reply. The service is Graph API only — never browser automation or scraping — and is still in Meta **Development Mode** with `INSTA_DRY_RUN_SENDS` on in dev, so it cannot reach real followers until App Review passes. Until then a person sends each of these manually. Replies are drafted first and reviewed before sending, never auto-sent blind.

**Meta's limits:** free-form DMs only inside the 24-hour window; one private reply per comment, within 7 days of that comment.

> Open decision D23 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

| Keyword | Reply (verbatim) | Then routes to |
|---|---|---|
| **DEMO** | "90-second walkthrough dekho 👉 {realestateflow.in/demo/}. Waise team size kitni hai aapki? 🙌" | qualify (`CTA-DEMO-001`) |
| **AUDIT** | "Yeh raha Leakage Audit 👉 {link}. Abhi leads kahan track karte ho — WhatsApp ya koi system?" | qualify (`CTA-LEAD-MAGNET-005`) |
| **KHATA** | "Commission/khata book ka quick clip 👉 {link}. Abhi hisaab Excel pe ya diary pe?" | qualify |
| **SYSTEM** | "Pura system 90 second mein samajh aa jayega 👉 {link}. Abhi konsa tool use karte ho?" | qualify |
| **AI** | "AI Employee WhatsApp pe kaise kaam karta hai — 60-second recording 👉 {clip}. Aapke inbound leads roz kitne aate hain?" | qualify |
| **TRIAL** | "{{trial_line}} 👉 {app.realestateflow.in/signup}. Setup mein help chahiye toh batao, saath karte hain." | onboarding |
| **PRICE** | "{{price_line}} — aur AI Employee add-on ho toh {{ai_employee_disclosure}}. Aapki agency ke hisaab se kaunsa sahi hai, team size batao." | qualify |
| **GUIDE** | "Agency Setup Guide 👇 {link}. Kitne agents hain team mein?" | qualify |
| **SETUP** | "Onboarding steps + free migration 👉 {link}. Apni current sheet ka screenshot bhejo, shift karwa deta hoon." | onboarding |
| **DASHBOARD** | "Owner dashboard ka 60-second tour 👉 {link}. Aap owner ho ya team handle karte ho?" | qualify |

**Tokens, not prices.** `{{price_line}}`, `{{trial_line}}` and `{{ai_employee_disclosure}}` resolve from `../../pricing.json` at the moment you send. Never type a price into this file. The replacement pricing proposal is `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`.

**Assets must exist before the keyword ships.** The Leakage Audit, the follow-up tracker and the setup guide are not built yet — the on-site calculator is a placeholder (`agency-app/landing-pages/agency-owners/index.html`). A keyword that promises a file we cannot send is worse than no keyword.

Two keywords from the June draft are gone. `LEAK` promised a calculator that does not exist. `PUNE` promised "Pune ki local team" — there is no Pune team, and M1 is Mumbai only (D24).

---

## 2. The DM script flow

```
STEP 1 — GREET + DELIVER
  "Arre {{name}} 🙌 dekha aapne reel pe react kiya. Yeh raha jo maanga: {asset/link}."

STEP 2 — QUALIFY (max 2 Qs)
  Q1: "Aapki agency mein kitne agents hain — solo ya team?"
  Q2: "Abhi leads WhatsApp/Excel pe ya kisi system pe?"

STEP 3 — ROUTE (branch on answers)
  ├─ SOLO + curious        → TRIAL: "Solo ke liye {{trial_line}} 👉 {signup}. 5 min mein set."
  ├─ TEAM (2–8) + pain     → DEMO:  "Team ke liye 90-second walkthrough dikhata hoon — WhatsApp pe, aaj ya kal?"
  ├─ OWNER (8+) + control  → DEMO + DASHBOARD: "Owner dashboard zaroor dekho — team visibility ka game."
  └─ "bas dekh raha tha"   → NURTURE: drop value, no push; tag for follow-up; invite to the broadcast channel.

STEP 4 — HANDOFF (to WhatsApp)
  "WhatsApp pe bhej dun? Wahan AI Employee, inventory aur khata live dikhata hoon — type karna easy hai 🙂"

STEP 5 — CAPTURE + CREATE LEAD
  Get number → the Instagram service creates the CRM lead
  (source = 'Instagram', sourceAdapter = 'instagram', reel in reelRef)
  → log the originating OPP-* by hand in the tracking sheet
  → hand to ../../40-sales-and-conversion/qualification.md
```

The June draft routed solo brokers to a "free plan". There is no free plan — the tiers in `../../pricing.json` are Solo, Team, Team+ and the AI Employee add-on, with a free trial on the first three.

---

## 3. Qualification in the DM (the 2-question rule)

Never interrogate. Two questions maximum before you give value or route:

1. **Team size** (solo / 2–8 / 8+) → maps to the plan and the persona.
2. **Current tool** (WhatsApp / Excel / other CRM) → maps to pain depth and the migration offer.

Read the answer against the ICP (`../../10-audience-and-voice/icp-and-personas.md`): solo → trial; small team with pain → demo; owner with control anxiety → dashboard demo. Note that a solo beginner with no deal flow is explicitly *not* the target. Tag the persona so nurture and attribution know who this is.

---

## 4. Objection snippets (DM-sized)

| Objection | DM snippet (Hinglish) | Full ref |
|---|---|---|
| "Mahanga hoga" | "{{price_line}} — aur ek bachi hui deal ka commission hi saal bhar ka cost cover kar deta hai. Apne numbers pe hisaab kar ke dekho." | `../../40-sales-and-conversion/objections.md` |
| "Team nahi seekhegi" | "Bhai WhatsApp jaisa hi hai. Main aapki team ko 30 min mein khud train kar deta hoon — free onboarding." | same |
| "Hum theek hain abhi" | "Ek cheez check karo: pichhle mahine ki leads mein se kitno ko teesra follow-up gaya? Ginke batao." | same |
| "AI kaam karega?" | "Apne hi ek lead pe abhi try karo — AI Employee WhatsApp pe handle karega, aap khud judge karo." | same |
| "Pehle CRM try kiya, fail" | "Woh videshi workflow ke liye bane the. Yeh Indian broking agency ke liye bana hai — khata, commission, site visit sab andar." | same |

Keep it to ONE snippet, then offer the demo. Do not win the argument in the DM — win the demo booking.

The June draft's snippets asserted "ROI 30 din", "95% adoption month 1" and "roz ~₹50K leak". None of those is measured and we have no users; each is replaced by a question the broker answers from their own data. It also named a competitor, which the month-1 rules forbid.

---

## 5. Hand-off to WhatsApp script

```
"Yeh chat thodi limited hai bhai 😅 WhatsApp pe bhej dun?
 Wahan AI Employee ek lead pe live dikhata hoon + inventory share + khata —
 sab 5 min mein. Bas number do, abhi bhejta hoon link."
→ on number: create the lead, send the opener from ../whatsapp/message-templates.md, book the demo slot.
```

WhatsApp is the richer channel (file shares, voice notes, live demo). Move any conversation past "qualified + interested" there fast.

**Which WhatsApp number does this?** Today the product's WhatsApp is a self-hosted Baileys service (`platform/whatsapp-platform/`) used as the agency's own command channel, not a Business-API sender. Which number talks to prospects is not settled.

> Open decision D29c — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md
>
> The official-API plan is `docs/realestateflow-vision/39-whatsapp-official-api-plan.md`.

---

## 6. No-reply nudges (cadence)

Never spam. Two gentle nudges, then stop and let nurture take over. Every nudge has to sit inside Meta's 24-hour window, or it simply will not send.

| Timing | Nudge (Hinglish) |
|---|---|
| **+24h** | "Koi pressure nahi 🙂 bas yeh 60-second clip dekh lo — AI Employee ek lead kaise handle karta hai 👉 {clip}." |
| **+72h** | "{{name}} ek choti baat — {their-pain} ke liye yeh walkthrough dekho: {link}. Demo chahiye toh bolo." (outside the 24h window this needs them to message first) |
| **+7d** | Stop the DM. Add to the broadcast channel and the nurture sequence; revisit only if they re-engage. |

---

## 7. Do / don't

| Do | Don't |
|---|---|
| One ask per message | dump qualification, pricing and demo in one wall of text |
| Deliver the promised value first | open with a sales pitch |
| Sell the **demo**, not the price | paste the price list first |
| Move warm chats to WhatsApp fast | keep a hot lead stuck in IG DMs |
| Log the `OPP-*` in the tracking sheet | leave leads unattributed |
| Reply within the peak-hour window | let DMs sit overnight unanswered |
| Draft, review, then send | auto-send an unreviewed reply |

---

## 8. Lead attribution

A lead created from Instagram carries `source: 'Instagram'`, `sourceAdapter: 'instagram'`, `externalRef` and `reelRef` (`agency-app/api/leadIngestion.js`), and emits an EventBridge `lead.created` that runs AI qualification. There is **no** `leadSource`, `contentRef` or `utm` field on a lead, and `/api/marketing/events` is not built.

So: record the **originating `OPP-*`**, the `CTA-*`, persona, team size, current tool and route (TRIAL / DEMO / NURTURE) in the tracking sheet, keyed to the lead. That is how we learn which content books demos. See `../../40-sales-and-conversion/dm-to-demo.md`, `follower-to-demo.md` and `../../50-measurement/attribution-today.md`.

---

## 9. Metrics

| Metric | What it tells you | Target |
|---|---|---|
| DM threads / day | top-of-conversation volume | ≥ 10/day by Month 2 |
| Keyword-trigger fires | keyword pull | track per keyword |
| DM → qualified | conversation quality | track |
| DM → WhatsApp hand-off | funnel pull | **~40%** (`follower-to-demo.md`) |
| WhatsApp → demo | downstream | ~30% |
| Median first-reply time | responsiveness | same session |

> DMs are measured by **qualified hand-offs to WhatsApp and booked demos**, not message count. Definitions live in `../../50-measurement/metric-dictionary.md`.
