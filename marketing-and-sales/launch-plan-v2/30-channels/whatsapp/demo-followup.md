# WhatsApp — demo follow-up

Convert demos into trials and paid, rescue no-shows, and handle objections fast. Sits between `lead-nurture.md` (which booked the demo) and `customer-success.md` (which onboards the trial). Pairs with `../../40-sales-and-conversion/demo-script.md`, `closing-script.md` and `objections.md`. The `sdr` and `nurture-bot` agents draft; a human sends.

**Used by:** `../../week-2-soft-launch/day-10-onboarding-calls.md` · `../../week-4-optimize-convert/day-23-followup-non-replies.md`, `day-24-reactivation-stalled-trials.md`, `day-26-trial-to-paid.md`.

> **The shape of the problem:** demo no-shows are a major funnel leak (`../../40-sales-and-conversion/customer-journey.md`). Reminders cut them; a recorded fallback rescues the rest. Post-demo, the first hour decides the deal — recap while it is warm, and end every message with one concrete next step and a slot.

> **Prices are never typed into this file.** `{{price_line}}`, `{{trial_line}}` and `{{ai_employee_disclosure}}` resolve from `../../pricing.json`. The replacement pricing proposal is `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`.

---

## 1. Pre-demo (cut no-shows)

| Touch | Timing | Message intent |
|---|---|---|
| Confirm | T-24h | confirm slot + ask what to show |
| Prep | T-3h | "ek lead ka number rakhna — live dikha dunga" |
| Reminder | T-1h | 1-line value reminder + join link |

**T-24h confirm:**
> "Kal {{time}} apna demo confirm hai ✅ Ek cheez batao — sabse pehle kya dekhna chahoge: *WhatsApp pe AI Employee*, *khata/commission*, ya *team hierarchy*? Main usi pe focus karunga, time waste nahi hoga."

> Open decision D26 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md
> (which AI capabilities marketing may demo; AI calling is not on the approved-claims list today)

**T-1h reminder:**
> "1 ghante mein milte hain {{name}} 🙌 Yeh {{pain}} solve karne wala part main aapke hi numbers pe dikhaunga. Link 👉 {{link}}. Phone pe bhi chalega, desktop ki zaroorat nahi."

## 2. No-show rescue (don't lose them)

| Touch | Timing | Message intent |
|---|---|---|
| Soft rescue | +10 min | "miss ho gaya? koi baat nahi — reschedule?" |
| Recorded fallback | +1 day | 90-second recorded walkthrough of their top pain |
| Last nudge | +3 days | "1 slot bacha hai is hafte — chahiye?" |

**+10 min:**
> "Lagta hai aaj busy ho gaye 🙂 Koi baat nahi — reschedule karein? 2 slots hain: {{a}} / {{b}}. Ya abhi ke abhi yeh 90-second recorded walkthrough dekh lo 👉 {{link}}, jo aapki {{pain}} pe hai."

**+1 day recorded fallback:**
> "{{name}}, jaldi mein? Yeh 90-second ka walkthrough dekh lo jab time mile 👉 {{link}}. Lead tracking aur WhatsApp AI Employee dono dikhaye hain. Sawaal ho toh yahin reply karo, main hoon."

## 3. Post-demo (within 1 hour — non-negotiable)

**Recap + price:**
> "Maza aaya baat kar ke {{name}} 🙌 3 cheezein jo seedha aapke kaam aayengi: 1) {{x — e.g. WhatsApp leads ek jagah}} 2) {{y — follow-up reminders}} 3) {{z — khata se commission clear}}. Aapke size ke liye **{{price_line}}**. {{trial_line}} shuru karein? 👉 {{trial}}"

If the demo showed the AI Employee, the recap must carry `{{ai_employee_disclosure}}` — it is a paid add-on from day one, with no trial and no refund. Saying so up front is a rule, not a style choice.

**Objection raised in demo** (route to `objections.md`), e.g. "team won't use it":
> "Aapne poocha tha team adoption ka — isliye onboarding mein main khud aapki team ke saath 1 call karta hoon. 2-min training, sab WhatsApp jaisa hi feel hota hai. Yeh tension main lega 🤝"

## 4. Follow-up cadence (post-demo, if not yet converted)

| Touch | Timing | Intent |
|---|---|---|
| T+1 | next day | "setup mein help chahiye? main guide kar dun" |
| T+3 | +3 days | ROI math / case study for their segment |
| T+5 | +5 days | address remaining objection + risk-reversal |
| T+7 | +7 days | limited offer / decision nudge (soft) |

**T+3 ROI math:**
> "Ek chhota hisaab {{name}}: aap mahine ~{{N}} leads handle karte ho. Aap batao — inme se kitne ko teesra follow-up gaya? Jo number aaye, usse apna average commission multiply karo. {{trial_line}} mein khud farak dekho."

The arithmetic is theirs, with their inputs. Do not supply a leakage percentage; we have not measured one.

**T+7 decision nudge:**
> "Koi rush nahi, par is hafte free setup + onboarding slot khula hai — main personally aapki sheet migrate kar deta hoon. Bas haan bol do, baaki main sambhal lunga 🙂"

## 5. Branch logic
- **Converts to trial** → tag Trial → hand off to `customer-success.md` Day 0.
- **Wants to think** → T+3 / T+5 / T+7 cadence; if silent after T+7, move to `founder-broadcast.md`.
- **Hard no / wrong fit** → thank them, leave the door open, stop the sequence (compliance).

The Pune/Marathi branch is parked with the rest of the Pune scope (D24).

## 6. Rules
End **every** message with one clear next step + a slot. Never feature-dump in follow-up (the demo did that). One objection at a time. Recap must tie to *their* stated pains, not a generic feature list. Human tone, opt-out honoured.

## 7. Metrics

No-show rate (target <25%), no-show → rescheduled rate, **demo → trial** (target ~40%), **demo → paid**, average follow-ups to close, objection types logged (feeds `../../40-sales-and-conversion/objections.md`). Definitions in `../../50-measurement/metric-dictionary.md`. High no-shows means the T-24h and T-1h reminders need strengthening; a low demo → trial rate means the post-demo recap and risk reversal need sharpening.
