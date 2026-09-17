# Qualification

Qualify fast so effort goes to real buyers. Deliberately **lightweight** for SMB brokers — no heavy BANT interrogation; brokers smell a sales process and bounce. Pairs with the DM hand-off (`dm-to-demo.md` §5) and `../30-channels/whatsapp/lead-nurture.md`. Grounded in the buying behaviour and pain ranking in `../10-audience-and-voice/icp-and-personas.md`.

**Used by:** `../week-2-soft-launch/day-09-craft-send-invites.md` · `../week-3-public-launch/day-17-cold-outreach-prep.md`, `day-18-execute-cold-day1.md` · and, indirectly, every day file that books a demo.

> **Philosophy:** brokers do not fill in forms — they have conversations. Qualify by listening, not quizzing. The questions below should feel like a friend asking, not a CRM intake.

> **The lead already carries an AI score.** `lead.created` fires an EventBridge event that runs the AI lead qualifier (`apps/crm/server/scripts/lead-qualifier-handler.js`), so every lead arrives with a temperature. Read that first, then apply your own band below. The two are independent readings, not a hierarchy.

> **Sales is founder-run.** There is no SDR until MRR reaches ₹2L, so every route below is work the founder personally does or does not do. That is the real constraint on how many Hot leads the funnel can absorb.

> **Prices are tokens.** `{{price_line}}` and `{{trial_line}}` resolve from `../pricing.json`. There is no Free plan, no Starter and no Growth tier; the tiers are Solo, Team, Team+ and the AI Employee add-on. Replacement proposal: `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`.

---

## 1. The discovery questions (with WHY)

Ask in DM/WhatsApp, woven into chat — not as a numbered list.

| # | Question (Hinglish) | WHY we ask |
|---|---|---|
| 1 | "Team kitni badi hai — aap solo ho ya kuch agents hain?" | Routes the plan (Solo = 1 seat, Team = up to 3, Team+ above that) and the path — self-serve or demo — and decides whether hierarchy and member access matter. |
| 2 | "Abhi leads kaise sambhalte ho — WhatsApp, Excel, ya koi CRM?" | Measures pain depth + switching cost + whether they've been burned before (objection #10). |
| 3 | "Mahine mein kitne leads aate hain roughly?" | An urgency signal, the input for the ROI arithmetic, and the main indicator of whether the AI Employee add-on is worth ₹7,999 to them. Plans are not capped by lead volume — they are priced by seats. |
| 4 | "Sabse badi headache kya hai — leads leak, follow-up bhool jaana, team visibility, commission ka hisaab, Instagram se aane wali leads, ya site-visit no-shows?" | Picks the **one pain** the demo will mirror. Never demo every feature. |
| 5 (optional) | "Kuch hua recently jisse laga ki system chahiye?" | Surfaces the **buying trigger** — the emotional fuel for urgency. |

**Listening cues > answers:** A broker who says "abhi ek deal haath se nikal gaya" (#5) is hotter than one who answers all 4 neatly.

---

## 2. Scoring & routing matrix

Score each lead 0–2 on four axes; total drives the route.

| Axis | 0 | 1 | 2 |
|---|---|---|---|
| **Pain** | "we're fine" | mild ("thoda chaos hai") | acute ("deal/agent kho diya") |
| **Authority** | agent, no say | manager/champion | owner / decision-maker |
| **Volume** | <20 leads/mo | 20–100 | 100+ / multi-agent |
| **Trigger** | none | competitor pressure | lost deal / agent left / dispute |

| Total | Tier | Route |
|---|---|---|
| 6–8 | **Hot** | Priority **demo** within 24h + ROI/leak math (`demo-script.md`, `CTA-DEMO`) |
| 3–5 | **Warm** | Demo or guided trial; nurture cadence (`followup-script.md`) |
| 1–2 | **Cool** | Self-serve free trial, no card (`CTA-TRIAL`); light WhatsApp nurture |
| 0 | **Cold/curious** | Community and broadcast nurture (`../30-channels/whatsapp/community.md`), low effort |

---

## 3. Persona-specific qualification

**Agency owner (ADMIN, the economic buyer)**
- Qualify on: time lost to admin, leads going missing, the team-accountability gap, fear of an agent leaving with relationships.
- Key question: "Aap khud kitne ghante admin mein jaate hain roz?" Four to six hours is hot.
- Sell control and ROI. Closes fast when the ROI is clear — and the ROI has to be built from *their* numbers, because we have no customer results to cite.

**Sales manager / team lead (ADMIN or elevated MEMBER, the champion)**
- Qualify on: chasing agents for follow-ups, lead-assignment arguments, "no data on who is actually working".
- Key question: "Team ke follow-ups kaise track karte ho abhi?"
- Sell visibility without micromanagement, and **arm them to sell up to the owner** — they rarely sign the cheque.

**Agent / consultant (MEMBER, user and influencer)**
- Qualify on: admin work eating selling time; wants automatic follow-up, call records and their own numbers.
- Key question: "Follow-up ka reminder khud aa jaye toh?"
- Sell mobile and speed. Fast adopter, often a bottom-up champion who gets the owner to buy.

Roles in the product are ADMIN and MEMBER today; a MANAGER role and "members see only their own leads" are planned before Team plans are sold. Do not promise granular permissions that do not exist yet.

---

## 4. Lead-source-specific qualification

| Source (research §5) | What it tells you | Qualify angle |
|---|---|---|
| Instagram (our content) | Self-aware of the pain, warm | Ask which reel hit → demo that exact pain. The lead arrives with `source: 'Instagram'` and the reel in `reelRef` |
| WhatsApp inbound / referral | Highest trust, fast | Speed-to-lead; offer live demo same day |
| MagicBricks / 99acres / Housing | Volume buyer, response-time pain | Lead with automatic follow-up and the speed-to-lead arithmetic on their own numbers |
| Facebook / Google ads | Has ad spend, ROI-minded | Lead with attribution and "leads convert nahi ho rahe". *(We run no paid ads in M1 — this row is for inbound leads who buy ads themselves.)* |
| Cold/outbound | Low awareness | Heavier education, longer nurture |

---

## 5. Buying-trigger checklist (lean in hard when ANY present)

- [ ] Lost a big deal recently ("haath se nikal gaya")
- [ ] An agent left and took leads/relationships
- [ ] Scaling team (new hires incoming → need accountability)
- [ ] Commission dispute / "kiska kitna paisa" fight
- [ ] Competitor across the street using a system
- [ ] New project launch = lead flood incoming
- [ ] Family succession (son/junior taking over)

Each ticked box = move to **Hot**, compress timeline, lead with the matching pain story.

---

## 6. Disqualification criteria (gently exit)

Disqualify — or downgrade to long-term nurture — when **all** of these hold:
- No pain — genuinely "we're fine", with no trigger — AND
- No authority: cannot decide and will not champion — AND
- No budget appetite: will not even start the free trial.

Also park (not disqualify): **students/researchers**, **pure tyre-kickers**, **competitors snooping**. Be warm, send to community, move on. Never burn a brand impression — today's "no" is next quarter's "yes" after they lose a deal.

---

## 7. Sample qualifying conversations (Hinglish)

**WhatsApp — warm DM handoff (hot lead):**
> **You:** "Arre Rajesh bhai 🙌 aapne 'DEMO' kiya tha. Quick — team mein kitne agents ho?"
> **Lead:** "6 hain, par sab WhatsApp pe chalta hai, bahut chaos hai"
> **You:** "Samajh gaya. Mahine ka kitne leads aate hain?"
> **Lead:** "100-150, par half toh kahin kho jaate"
> **You:** "Yahi pakdunga main. Kuch hua recently jisse laga system chahiye?"
> **Lead:** "Haan ek Bandra deal nikal gaya, agent ne follow-up hi nahi kiya"
> → **Score: Pain 2 + Authority 2 + Volume 2 + Trigger 2 = 8 → HOT.** Book demo in 24h, mirror lead-leakage pain, lead with AI follow-up.

**DM — solo, low intent (cool lead):**
> **Lead:** "Kitne ka hai?"
> **You:** "Solo ho ya team? Aur abhi kaise manage karte ho?"
> **Lead:** "Akela hoon, Excel pe, thoda kaam hai bas"
> **You:** "Toh 14-din ka free trial start karo — no card. Uske baad {{price_line}}. Link bhej dun? Pasand aaye toh aage badhna."
> → **Cool → self-serve trial.** No demo effort spent.

**Marathi rapport (parked — Pune is out of M1 scope):**
> **You:** "Namaskar! Tumchi team kiti motthi aahe?"
> Switch to Hinglish once rapport is set; lead with the growth narrative.
>
> Open decision D24 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 8. Handoff contract (qualification → demo / trial)

When a lead is **Warm or above**, with a team, a current pain and the intent to see it:

1. **The lead record.** What the CRM actually stores is `source` (e.g. `Instagram`), `sourceAdapter`, `externalRef`/`reelRef`, and the AI score and temperature. Segment, persona, primary pain, buying trigger, your own score band and stage go where the schema has room, and otherwise into the tracking sheet. A lead created from Instagram already exists — do not create a duplicate.
2. **Log content attribution** — the originating `OPP-*`, reel and `FW-*` — in the tracking sheet. There is no `contentRef` field on a lead and `/api/marketing/events` does not exist (`dm-to-demo.md` §5).
3. **Route.** Hot and Warm → `demo-script.md`, book the slot (demo windows Tue–Fri 11:00–17:00). Cool → trial plus `followup-script.md`.
4. **Arm the champion** with a one-line internal pitch when the buyer is not the user.

**The output is a lead record, not a vibe.** If it is not written down with source, segment, pain and stage, the funnel cannot see it — which is the exact failure we sell brokers a fix for.
