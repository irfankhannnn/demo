# WhatsApp — customer success

Onboard, activate and retain paying customers over WhatsApp; reduce churn; earn referrals honestly. Sits after `demo-followup.md` and pairs with `../../40-sales-and-conversion/onboarding-script.md` and `../../50-measurement/customer-health.md`.

> **The window that matters:** the first seven days decide retention. A customer who hits **3 of 4 activation milestones in week 1** retains; one who never imports their leads churns. Channel: WhatsApp, because that is where they already are and where they reply fastest.

> **What counts as the "aha" is not settled.** This playbook was written around "first AI call by Day 2". The launch plan's M1 activation event is different: the owner connects WhatsApp and the AI Employee handles at least one inbound lead within 7 days (`../../00-PLAN-OVERVIEW.md`). A trial user cannot reach that one, because the AI Employee is a paid add-on with no trial (`../../pricing.json`); an AI call, by contrast, is reachable inside the trial's included credits.
>
> Open decision D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md
>
> Until it closes, Day 2 below lists **both** milestones and you pick the one the customer can actually reach. See `../../50-measurement/activation-definition.md`.

---

## 1. Onboarding sequence (first 7 days = activation window)

| Day | Goal (1 action) | Feature | Milestone |
|---|---|---|---|
| **Day 0** | Welcome + add 10 leads | Lead Management | Leads added |
| **Day 1** | Import existing WhatsApp/Excel leads | Lead import | Bulk imported |
| **Day 2** | **AI Employee customers:** connect WhatsApp by QR and let the AI Employee handle one real inbound lead. **Everyone else:** run AI calling on one real lead, or set the first follow-up reminder | AI Employee / AI Calling | First AI Employee-handled lead, *or* first AI call |
| **Day 3** | Invite the team and set roles (agencies) | Team hierarchy + member access (Solo is 1 seat — inviting needs Team) | Member invited |
| **Day 5** | Set up khata / first settlement | Khata Book | Khata entry |
| **Day 7** | Week-1 win check-in + show dashboard | Analytics | Reviewed numbers |

## 2. Verbatim onboarding messages

**Day 0 — welcome:**
> "Welcome to RealEstateFlow {{name}}! 🎉 Aaj sirf ek kaam: apne *10 active leads* daal do (manual ya import). 5 min lagega. Help chahiye toh yahin reply karo — main saath hoon. Chalo shuru karte hain 💪"

**Day 1 — import:**
> "{{name}}, aaj apni purani sheet ya WhatsApp ke leads import kar lete hain — taaki sab ek jagah ho. Screenshot ya file bhejo, main migrate karwa deta hoon. Spreadsheet ko aaj retire karte hain 🙂"

**Day 2 — the first real moment.**

*AI Employee customers:*
> "Aaj wala step ✨ Apna WhatsApp QR se connect karo. Uske baad jo bhi inbound lead aayegi, AI Employee khud handle karega — qualify karke aapko sirf garam leads dega. Ek lead pe hone do, fir batao kaisa laga!"

*Everyone else:*
> "Aaj wala step ✨ Ek lead choose karo aur uspe *AI calling* chalao. AI call karega, qualify karega, recording aur transcript de dega — aap sirf hot leads uthao. Trial ke free credits isi ke liye hain. Try karke batao!"

Note for whoever sends this: AI call minutes are billed in credits, and a trial tenant has a monthly allowance by default (`agency-app/api/creditConfig.js`).

**Day 3 — team invite:**
> "Ab team ko andar lao 👥 Members invite karo, role set karo (Admin sab dekhe, Member delete na kar paaye). Isse poori team ek dashboard mein dikhegi — kaun kaunsa lead chala raha hai, saaf."

Solo is a single seat, so inviting a member prompts an upgrade to Team. Say that before they hit the wall.

**Day 7 — week-1 check-in:**
> "Ek hafta ho gaya 🎯 Aapne is hafte **{{X}} leads** add kiye, **{{Y}} follow-ups** set kiye, **{{Z}}** handle hue. Yeh dekho aapka dashboard 👇 Koi sawaal?"

Every number here comes from their own CRM counts. Do not promise "lead leakage ~zero next month" — that is a result we cannot underwrite.

## 3. Activation milestones (health signals)

Track four: **leads added · first follow-up reminder set · first AI Employee-handled lead or first AI call · team member invited.** Three of four in week one indicates retention.

There is no `MKT_EVENT` store and no marketing-event endpoint — that engine was designed and never built. Today these are tracked in PostHog and the weekly sheet; see `../../50-measurement/posthog-event-map.md` and `../../50-measurement/customer-health.md`. A customer who hits all four is a candidate for §6.

## 4. Ongoing cadence (post-activation)

| Cadence | Action | Example |
|---|---|---|
| Weekly | Proactive tip matched to their usage | "Aap khata kam use kar rahe — yeh 1-min mein commission clear karta hai 👇" |
| Monthly | Usage review | "Is mahine: {{X}} leads, {{Y}} follow-ups, {{Z}} visits. Pichhle se {{±%}}." |
| On a win | Celebrate whatever they tell you about | "Deal band ho gayi! 🥳 Yeh wali energy chahiye thi 🔥" |
| Always | Fast support reply | answer in minutes during business hours |

## 5. Churn prevention (branch logic)

| Signal | Trigger | Action |
|---|---|---|
| No login 48h (trial) | win-back | "Setup adhoora? Main 10-min call pe poora kar deta hoon" |
| No login 7d (paid) | personal nudge | founder/CS message + offer help call |
| Low feature adoption | targeted tutorial | send the 1 mini-clip for the unused feature |
| Negative feedback | escalate | route to founder/`nurture-bot`; fix + follow up |
| Renewal approaching | value recap | show ROI delivered before renewal date |

**7-day inactivity nudge:**
> "{{name}}, miss kiya aapko 🙂 Kahin setup pe atke toh nahi? 10 min do, main aapke saath baith ke leads import kar deta hoon aur pehla follow-up set kar deta hoon — fir system khud chalega. Kab free ho?"

## 6. Turn customers into advocates

Activated and happy (milestones hit, positive replies, a deal they tell you about) → **referral ask** (`referral.md`) and a **case-study request**. A case study needs the customer's **written permission** before any of it is published, and it stays their words and their numbers. Until then there is no CT-CASE content and no Wins group to feed. The loop: success → real proof → referral → new lead.

## 7. Metrics

Activation rate (≥3 of 4 milestones in week 1), week-1 milestones hit, login frequency, feature-adoption breadth, monthly churn, NPS (the CRM has an NPS surface), expansion (plan upgrades, AI Employee add-on). Definitions in `../../50-measurement/metric-dictionary.md`.

A low Day-2 rate means the first real moment is being missed — make the Day-2 message more concrete or offer to do it together on a call. Which milestone that Day-2 rate should count is D27.
