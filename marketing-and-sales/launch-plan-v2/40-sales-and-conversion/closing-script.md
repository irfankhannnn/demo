# Closing script

Convert a warm, demoed lead into a paying customer. SMB brokers close **fast** when the ROI and the risk reversal are clear. Pairs with `demo-script.md` before and `onboarding-script.md` after.

**Used by:** `../week-4-optimize-convert/day-26-trial-to-paid.md`, `day-27-pitch-refinement.md`, `day-29-revenue-retention-audit.md`.

> **Plans and prices come from `../pricing.json` only** — it is the single source of truth and the README forbids restating it anywhere else. Use `{{price_line}}`, `{{trial_line}}` and `{{ai_employee_disclosure}}`. The replacement pricing proposal is `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`.

> **Mindset:** you are not selling, you are removing the last bit of risk so a clearly painful problem gets solved today. Always close on a concrete action plus the trial, never on "soch ke batao".

---

## Pre-close checklist (all must be ✓)
- [ ] **Pain confirmed** — they nodded at the pain mirror.
- [ ] **Fix demoed** — they saw the wow and their one feature.
- [ ] **Objection handled** — no live blocker remaining (`objections.md`).
- [ ] **Right plan identified** — matched to team size (see the plan guidance below).
- [ ] **Decision-maker engaged** — owner on the call, OR champion armed to pitch owner.

If any box is empty → don't close yet. Fill it first.

---

## Closing techniques (pick by read)

### 1. Assumptive (default — for Hot owners)
> "Aapko lead tracking aur {{the wow they saw}} pasand aaya. Aapke {{team size}} ke liye {{price_line}}. Aaj shuru karein toh main khud aapke pehle 10 leads import kar deta hoon aur pehla follow-up set kar deta hoon — kal subah se hi farak dikhega. Bas apni list bhejo, theek hai?"

### 2. Summary close (for analytical/owner who wants the recap)
> "Toh seedha hisaab — aapne khud bataya {{their number}} leads bina follow-up ke reh jaate hain, aur ek deal ka commission {{their figure}} hai. {{price_line}} plus GST. AI follow-up karega, khata clear rahega, team dikhegi. Ek bhi bacha hua deal saal bhar ka cost cover kar deta hai. Shuru karein?"

Both numbers in that close are theirs, taken from the qualification call. Never supply a leakage percentage or an annual loss figure — we have not measured either.

### 3. Risk-reversal close (for hesitant / burned-before)
> "Aise karo — main risk hi nikaal deta hoon. {{trial_line}}, no credit card, kabhi bhi cancel, data kabhi bhi export. Aur first-time subscribers ke liye 30 din money-back. Aapko kuch lagana nahi abhi — pasand na aaye toh chhod do. Itne mein toh haan ho sakti hai na?"

If the AI Employee add-on is part of the deal, the risk reversal does not cover it, and you say so in the same breath: `{{ai_employee_disclosure}}` — paid from day one, no trial, no refund, because the manual setup cost is already spent.

### 4. Urgency close (HONEST urgency only)
> "Bhai abhi {{season/Diwali/launch}} hai — leads ka flood aa raha hai. Har din bina system = leak. Aaj on karo, main personally setup karunga is hafte. Agle hafte bahut late ho jayega."
> *(Only real urgency: festival/launch lead-flood, limited onboarding-slot, time-bound extended-trial. **Never fake scarcity** — brokers smell it.)*

### 5. Alternative-choice close (assumes yes, picks the *how*)
> "Toh shuru karte hain — Solo se shuru karein ya Team (3 log)? Aur AI Employee abhi add karein ya baad mein? Leads aaj import karun ya kal subah?"
> *(The choice is between two yeses, never between yes and no.)*

---

## Handling "let me think about it" / "soch ke batata hoon"
Isolate the real blocker — "think about it" is never the real reason:
> "Bilkul, sochna chahiye. Bas yeh batao — soch kis cheez pe hai? Price, team adoption, ya kuch aur? Taaki main woh exact clear kar dun."

Then:
- **Price →** the ROI arithmetic on their numbers, plus the trial ("paisa baad mein, abhi trial pe shuru").
- **Team adoption →** "ek agent ko bhi trial pe dekhne do — woh khud bolega easy hai" (`objections.md` #3).
- **Authority ("partner se poochna hai") →** arm them + set a **specific** follow-up slot, don't leave open.
- **Genuinely not now →** "koi baat nahi — free pe leads daal ke rakho, jab ready ho AI on kar lena." (foot in door) → `followup-script.md`.

---

## Plan-selection guidance

Plans are priced by **seats**, not by lead volume. There is no lead cap to sell against.

| Signal | Plan | Why |
|---|---|---|
| One person | **Solo** (1 member) | unlimited properties, full CRM |
| Team of up to three | **Team** | everything in Solo, plus hierarchy, member-level activity and a shared khata |
| Four or more | **Team+** | prorated per-additional-member billing on top of Team |
| High inbound volume, WhatsApp chaos | **+ AI Employee add-on** | one instance per agency, concierge setup, and the disclosure every time it is named |

Exact prices come from `../pricing.json` at the moment you quote them — never from this table. Note that `pricing.json` and the CRM's own plan config **disagree on Team+**, and that the whole model is being re-planned; see `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`. Check before quoting Team+.

**Default recommendation:** a demoed team owner goes to **Team**; a solo broker starts on the **Solo trial**; the AI Employee is added only when their inbound volume justifies it. Enterprise is out of M1 scope.

---

## Negotiation / discount guardrails
- **Lead with value, not a discount.** The first answer to "kuch kam karo" is "{{trial_line}} se start karo — paisa tab jab faayda dikhe."
- **No random percentage off.** If you must move, offer **annual billing — 20% off Solo, Team and Team+, not the AI Employee add-on** — or an extended trial. Never a permanent lower price.
- **Never discount below plan integrity** — it cheapens the product and trains brokers to haggle.
- **Trade, do not give:** every concession buys something — an annual commitment, a written testimonial once they are a real customer, a referral introduction.
- Anchor every number on their own ROI: "{{price_line}} vs ek deal ka commission jo aapne abhi bataya — discount ki baat hi kahan."

---

## Post-close handoff (momentum is everything)
1. **Immediately** trigger `onboarding-script.md` Day 0 — import ten leads together, on the same call or chat. Do not let a gap kill the momentum.
2. Send the WhatsApp welcome (`../30-channels/whatsapp/customer-success.md`) and confirm the onboarding slot.
3. Update the lead stage, plan and MRR; log it to the pipeline (`pipeline-manager`) and record the originating `OPP-*` in the tracking sheet.
4. After the **first activation win**, ask for a **review**. Ask for a **referral** too — but note that the referral programme is gated: there is no referral system in the product and the reward is undecided (`../30-channels/whatsapp/referral.md`, D29b). Never ask before the win.

What counts as that first win is itself open — the plan's activation event and this script's "first AI call" are not the same thing.

> Open decision D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md
