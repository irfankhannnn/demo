# Onboarding playbook (7-day + 30-day)

Activation in week one predicts retention. Drive to the first real moment fast, then to habit, then to advocacy. Pairs with `../30-channels/whatsapp/customer-success.md` and `../50-measurement/activation-definition.md`. Every feature named here is checked against `../10-audience-and-voice/product-truth.md`.

**Used by:** `../week-2-soft-launch/day-10-onboarding-calls.md`, `day-13-checkin-drip.md` · `../week-4-optimize-convert/day-24-reactivation-stalled-trials.md`, `day-26-trial-to-paid.md`.

> ## Two candidate "ahas", and we have not picked one
>
> This playbook was written around **first live AI call by Day 2**. The launch plan defines M1 activation differently: the owner connects WhatsApp and the **AI Employee handles at least one inbound lead within 7 days** (`../00-PLAN-OVERVIEW.md`).
>
> They are not interchangeable. A trial user **cannot** reach the AI Employee milestone — it is a paid add-on with no trial (`../pricing.json`). An AI call, by contrast, runs on the trial's included credit allowance (`agency-app/api/creditConfig.js`), so a trial user can reach it on day two.
>
> Day 2 below therefore lists **both**, and you pick the one the customer can actually reach. Do not quietly settle this in a script.
>
> Open decision D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 7-Day playbook (day-by-day)

| Day | Action (exact) | Message (Hinglish) | Aha / milestone |
|---|---|---|---|
| **0** | Import 10 real leads *together* on the close call; set up agency + admin login | "Welcome bhai! 🙌 Abhi aapke 10 leads daal dete hain — apni list bhejo." | "Sab ek jagah" |
| **1** | Set first follow-up reminders on those leads | "Aaj 3 leads pe reminder laga dete hain — ab koi follow-up nahi bhulega." | "Ab nahi bhulega" |
| **2** | **AI Employee customers:** connect WhatsApp by QR, let the AI Employee take one real inbound lead. **Trial customers:** run AI calling on one real lead | "Ready? Aaj ek real lead pe try karte hain. Dekhna kamaal 👇" | 🌟 **The first real moment** (see D27) |
| **3** | Invite the team and set roles (agencies); solo adds properties | "Team ko invite kar do — Member role mein woh delete nahi kar sakte, control aapke paas." (Solo is one seat — inviting needs Team.) | Control / hierarchy |
| **4** | Add properties/inventory + match a buyer to a property | "Ek client ka requirement daalo — dekho property turant match ho jaati hai." | "Turant share" |
| **5** | Set up khata/settlement for one deal | "Commission ka hisaab daal do — kiska kitna paisa, ek screen, zero jhagda." | "Hisaab clear" |
| **6** | Light-touch check; nudge any unused core feature | "Kaisa chal raha hai? Koi cheez atki ho toh bata do, 5 min mein clear." | Friction removal |
| **7** | **Week-1 review call** — show their own dashboard numbers | "Ek hafte mein {{X}} leads organized, {{Y}} handled, {{Z}} follow-ups. Yeh raha aapka data 👇" | 📈 **Proof of value** |

**Solo vs agency split:** solo skips the Day 3 team invite — a Solo plan has one seat — and goes deeper on property and buyer matching instead. An agency leans on Day 3 (hierarchy and member access) and the Day 7 team-adoption review.

**Optional Day 0–2 steps for the features that exist and this playbook never mentioned:** connect Instagram so DMs and comments become CRM leads (dev only, Meta App Review pending); publish the first property page with a site-visit booking link; connect WhatsApp.

---

## Activation milestones (target **3 of 4** in week 1)
1. ✅ **10+ leads added** — an organised pipeline exists
2. ✅ **First follow-up reminder set**
3. 🌟 **The first real moment** — first AI Employee-handled lead, or first AI call. Weight this heaviest
4. ✅ **Team member invited** (agency) **or** a buyer matched to a property (solo)

Three of four by Day 7 counts as activated and green.

There is no activation-scoring service to feed. The marketing-event engine was designed in June and never built — there is no `MKT_EVENT` store and no `/api/marketing/events`. Today these are PostHog events plus the weekly sheet (`../50-measurement/posthog-event-map.md`, `../50-measurement/design-only-backlog.md`).

---

## Health signals (watch daily)

| Signal | Green | Yellow | Red |
|---|---|---|---|
| Login frequency | daily | every 2–3 days | no login 48h+ |
| Leads added | 10+ | 3–9 | 0 |
| First real moment reached | yes (Day 2–3) | by Day 5 | never |
| Team active (agency) | 2+ members | 1 | only owner |
| Replies to your nudges | warm | slow | silent |

Any **Red** → trigger the matching stall-recovery play below.

---

## Engineering the first real moment

The product lives or dies on Day 2. Make it foolproof:

- **Pre-stage the lead** with the broker so it happens on someone real and recognisable.
- **Do it live, with them watching.** Do not send instructions and hope. Screen share, or be on a WhatsApp call.
- **Narrate what is happening:** "Dekho — AI khud budget pooch raha hai, transcript ban raha hai, lead qualify ho rahi hai."
- **Connect it to their own arithmetic:** "Yeh aapke {{N}} leads pe chala do — aap batao kitne ghante bachenge." Let them do the sum.
- **Capture the reaction.** A testimonial needs their **written permission** before it appears anywhere; until then it is a note in the account record, not content.

If Day 2 does not happen, **that is the number-one escalation**, ahead of everything else.

Two honesty notes for this moment: AI call minutes are billed in credits and a trial includes a monthly allowance — say so rather than letting them discover it. And the automated follow-up agent calls only inside the tenant's business hours, so do not promise overnight calling.

---

## Stall-recovery plays

| Stall | Trigger | Play |
|---|---|---|
| No login 48h | health = red | Personal WhatsApp nudge + offer a 10-min setup call: "Bhai 10 min do, main khud set kar deta hoon." |
| Leads imported but the Day-2 moment never happened | Day 4, milestone 3 missing | "Aapne abhi tak try nahi kiya — yeh toh main feature hai. Abhi 2 min mein on kar dun?" |
| Owner active, team not (agency) | only the owner logs in | Offer a **30-minute team training**; handle objection 3 in `objections.md` ("team nahi seekhegi"). |
| Used once, then silent | usage dropped after Day 2 | Send their *own* early numbers as proof + one quick win they haven't tried (khata/matching). |
| Confusion / "samajh nahi aaya" | support messages | Send a short walkthrough video for that exact feature — the training videos promised in `../pricing.json`. Never reply with a wall of text. |
| At-risk by Day 5 (multi-red) | health score low | **Escalate to founder** for a personal call — high-touch save. |

Rule: **proactive, not reactive** — reach out *before* they get stuck, in peak windows (6–8 AM / 12–1 PM / 6–8 PM).

---

## 30-day playbook (habit → expansion)

| Week | Focus | Actions |
|---|---|---|
| **Week 1 (Day 0–7)** | Activation | 7-day playbook above → 3/4 milestones |
| **Week 2 (Day 8–14)** | Habit | Daily lead entry becomes the default; run the AI on a *batch*; close the first khata settlement; show pipeline movement. |
| **Week 3 (Day 15–21)** | Depth | Full team active (agency); buyer–property matching in real deals; Dashboard/analytics review — "kahan leads atak rahe." |
| **Week 4 (Day 22–30)** | Value proof + expansion | **30-day ROI review** using their own counts. If they are on Solo and inviting agents → Team. If inbound volume is high → the AI Employee add-on, with its disclosure. Ask for a review; the referral ask is gated. |

**Day-30 ROI review verbatim:**
> "Ek mahina ho gaya 🙌 Dekho — {{X}} leads organized, {{Y}} handled, {{Z}} follow-ups jo warna bhool jaate. Aap batao — inme se kitne warna nikal jaate? Aapke ek do broker dost hain jinko yeh chahiye?"

Counts come from their CRM. Whether a deal was "saved" is their judgement to make, not our claim to insert.

---

## Success → advocacy transition
After the **first clear win** — a recovered deal, or simply "ab chaos nahi":

1. **Capture the moment** as a short quote. Peer proof is the strongest trust signal in this market, and it is also the thing we have none of — so this is how the first one gets made. It is publishable only with **written permission**.
2. **Ask for a review** (Google, peer WhatsApp groups) — `../30-channels/whatsapp/customer-success.md`.
3. **Ask for a referral** — `../30-channels/whatsapp/referral.md`. Note the gate: there is no referral system in the product and the reward is undecided (D29b), so this is a manual, personal ask and a manually issued reward.
4. Hand over to the ongoing customer-success cadence: monthly value review, expansion watch.

Never ask for the referral before the win. The win earns the ask.
