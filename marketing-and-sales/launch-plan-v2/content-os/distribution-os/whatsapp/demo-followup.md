# WhatsApp — Demo Follow-up Strategy

Convert demos into **trials/paid**, rescue **no-shows**, and kill objections fast. Sits between `lead-nurture.md` (which booked the demo) and `customer-success.md` (which onboards the trial). Pairs with Sales OS `demo-script.md`, `closing-script.md`, `objections.md`. Run by `sdr` + `nurture-bot`.

> **The math:** demo no-shows are the #3 funnel leak (`sales-os/customer-journey.md`). Reminders cut them; a recorded fallback rescues the rest. Post-demo, the first hour decides the deal — recap while it's warm, end every message with a concrete next step + slot.

---

## 1. Pre-demo (cut no-shows)

| Touch | Timing | Message intent |
|---|---|---|
| Confirm | T-24h | confirm slot + ask what to show |
| Prep | T-3h | "ek lead ka number rakhna — AI calling live dikha dunga" |
| Reminder | T-1h | 1-line value reminder + join link |

**T-24h confirm:**
> "Kal {{time}} apna demo confirm hai ✅ Ek cheez batao — sabse pehle kya dekhna chahoge: *AI calling*, *khata/commission*, ya *team dashboard*? Main usi pe focus karunga, time waste nahi hoga."

**T-1h reminder:**
> "1 ghante mein milte hain {{name}} 🙌 Yeh {{pain}} solve karne wala part main aapke hi numbers pe dikhaunga. Link 👉 {{link}}. Phone pe bhi chalega, desktop ki zaroorat nahi."

## 2. No-show rescue (don't lose them)

| Touch | Timing | Message intent |
|---|---|---|
| Soft rescue | +10 min | "miss ho gaya? koi baat nahi — reschedule?" |
| Recorded fallback | +1 day | 2-min recorded demo of their top pain |
| Last nudge | +3 days | "1 slot bacha hai is hafte — chahiye?" |

**+10 min:**
> "Lagta hai aaj busy ho gaye 🙂 Koi baat nahi — reschedule karein? 2 slots hain: {{a}} / {{b}}. Ya abhi ke abhi yeh 2-min recorded demo dekh lo 👉 {{link}}, jo aapki {{pain}} pe hai."

**+1 day recorded fallback:**
> "{{name}}, jaldi mein? Yeh 2-min ka demo dekh lo jab time mile 👉 {{link}}. AI calling + lead tracking dono dikhaye hain. Sawaal ho toh yahin reply karo, main hoon."

## 3. Post-demo (within 1 hour — non-negotiable)

**Recap + price:**
> "Maza aaya baat kar ke {{name}} 🙌 3 cheezein jo seedha aapke kaam aayengi: 1) {{x — e.g. WhatsApp leads ek jagah}} 2) {{y — AI follow-up calls}} 3) {{z — khata se commission clear}}. Aapke size ke liye **{{plan}} ₹{{price}}/mo**. Free trial shuru karein? Card nahi maangte 👉 {{trial}}"

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
> "Ek chhota hisaab {{name}}: aap mahine ~{{N}} leads handle karte ho. Agar 25% bhi follow-up gap se leak ho rahe hain, woh ~₹{{X}} lakh commission/saal hai. Trial bilkul free hai — ek hafta chala ke khud farak dekho."

**T+7 decision nudge:**
> "Koi rush nahi, par is hafte free setup + onboarding slot khula hai — main personally aapki sheet migrate kar deta hoon. Bas haan bol do, baaki main sambhal lunga 🙂"

## 5. Branch logic
- **Converts to trial** → tag Trial → handoff `customer-success.md` Day-0.
- **Wants to think** → T+3/T+5/T+7 cadence; if silent after T+7 → demote to `founder-broadcast.md`.
- **Hard no / wrong fit** → thank, leave door open, stop sequence (compliance).
- **Pune lead** → Marathi rapport line on T-24h + recap, mechanics in Hinglish.

## 6. Rules
End **every** message with one clear next step + a slot. Never feature-dump in follow-up (the demo did that). One objection at a time. Recap must tie to *their* stated pains, not a generic feature list. Human tone, opt-out honoured.

## 7. Metrics (→ `growth-dashboard.md`)
No-show rate (target <25%), no-show→rescheduled rate, **demo→trial** (target ~40%), **demo→paid**, avg follow-ups to close, objection types logged (feeds `objections.md`). High no-shows = strengthen T-24h/T-1h reminders; low demo→trial = sharpen the post-demo recap + risk-reversal.
