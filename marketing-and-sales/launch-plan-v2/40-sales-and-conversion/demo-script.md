# Demo script

Goal: make the broker **feel** their biggest pain solved, land one wow, then ask for the trial. Tailor it to the pain captured in `qualification.md`. Show only the two or three features tied to that pain — **never dump features.** Every feature named here is verified against `../10-audience-and-voice/product-truth.md`.

**Used by:** `../week-2-soft-launch/day-10-onboarding-calls.md` · `../week-3-public-launch/day-18-execute-cold-day1.md` · `../week-4-optimize-convert/day-26-trial-to-paid.md`, `day-27-pitch-refinement.md`.

> **The one rule:** one pain → one wow. Let them tap and drive if possible. Money in ₹/lakh/crore, and the ₹ figures are always *theirs*. Brand copy 70% English / 30% romanized Hindi.

> **Which capability is the wow is not settled.** This script was built around a live AI call. The launch plan's wedge is the WhatsApp AI Employee, and AI calling is not currently on the approved-claims list — but AI calling is what a *trial* user can actually reach, since it runs on the trial's included credits, while the AI Employee is a paid add-on with no trial. §4 below keeps both paths.
>
> Open decisions D26 and D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

> **Demo windows are Tue–Fri, 11:00–17:00 IST**, booked through Cal.com. Sales is founder-run; there is no SDR until MRR reaches ₹2L.

---

## Pre-demo (before the call)
- Re-read the lead record: persona, segment, primary pain, trigger, source — and the AI temperature the qualifier already assigned.
- Pre-load a **sample lead** with plausible data they will recognise.
- Have the chosen wow ready to fire live and test the audio. Keep it to **one screen, mobile view**.
- Send a WhatsApp 10 minutes before: *"Bhai 10 min mein judta hoon, link yeh raha. Apna ek real lead ready rakhna — usi pe live dikhaunga."*

---

## Minute-by-minute verbatim script

### 0:00–0:30 — Frame
> "{{name}} bhai, time ke liye shukriya. Main aaj feature dump nahi karunga — sirf woh dikhaunga jo aapki **{{pain}}** solve karta hai. 10 min, no fluff. Beech mein kabhi bhi rok ke sawaal pooch lena, theek hai?"

*(Marathi opener, parked with the rest of the Pune scope — D24: "Vel dilyabaddal dhanyavaad. Aaj fakt tumchi mukhya samasya solve karnari gosht dakhavto.")*

### 0:30–1:30 — Pain mirror (make them nod)
> "Aapne bola tha — leads WhatsApp pe aate hain, 200 chats, aur shaam tak yaad hi nahi rehta subah wala buyer kaun tha. Aur woh {{their own example}} jo nikal gaya — follow-up hi nahi hua. Sahi pakda na?"

Use *their* example, from the qualification call. A borrowed one breaks the nod.

*(Wait for the "haan, exactly." This nod is the whole demo. If they don't nod, re-qualify the pain before continuing.)*

### 1:30–4:00 — Lead management (the foundation)
**What to click/show:** Lead List → add a lead → assign to an agent → set stage → open Lead Detail.
> "Dekho — yeh raha aapka pura lead. Naam, number, requirement, kaunsa agent owner hai, aur abhi kis stage pe hai. *(tap)* Yeh lead iska, yeh uska. Ab koi nahi bol sakta 'mujhe pata nahi tha yeh mera lead tha.' Har lead ka ek malik, ek next step."

Show the **Dashboard** glance: "Aur yahan se aapko ek nazar mein — kitne leads aaye, kahan atke. Office ka hisaab ek click mein."

### 4:00–7:30 — The wow (pick one, live)

> Open decisions D26 and D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

**Path A — WhatsApp AI Employee** (the launch-plan wedge; a paid add-on, so frame it as the upsell, not the trial).
**What to show:** the AI Employee pages in the CRM (`agency-app/web/src/pages/crm/AiEmployee.tsx`), a WhatsApp thread where the AI Employee takes an inbound lead, qualifies it and writes it back.
> "Ab woh cheez jiske liye aaye ho. Yeh lead abhi WhatsApp pe aayi — dekho. AI Employee ne khud reply kiya, requirement poochi, aur lead system mein aa gayi, qualified. Aap subah uthe toh sirf garam leads."
>
> Add the disclosure the moment you name it: `{{ai_employee_disclosure}}` — paid from day one, no trial, no refund, and capped at a few new setups a week right now.

**Path B — AI calling** (inside the trial, since call minutes run on the trial's included credits).
**What to show:** `AICalling` → Start Call modal (route `/crm/ai-calling`) → fire a call on the sample lead → the transcript building live.
> "Yeh lead jo abhi banaya — main ispe AI se call lagwata hoon. **Live. Abhi.** *(tap Start Call)*"
>
> *(Speaker on. The AI dials, greets in Hinglish, asks qualifying questions.)*
>
> "Suno — AI khud baat kar raha hai. Budget pooch raha hai, possession timeline, area. Aur saath ke saath transcript ban raha hai."
>
> *(Call ends.)*
>
> "Bas. Yeh ek call. Ab socho — **100 leads. AI business hours mein follow-up karega, aur aapko sirf qualified leads milengi.** Jo ghante follow-up calls mein jaate the, woh wapas aapke."

Two things not to say. **Do not say the AI calls at night** — the automated follow-up agent runs only inside the tenant's business hours (`agency-app/followup-agent/README.md`). And mention the meter honestly: call minutes are billed in credits, and a trial includes a monthly allowance (`agency-app/api/creditConfig.js`).

**If they go quiet →** that is the buying moment. Go straight to the ask and skip the remaining features.

### 7:30–9:00 — The ONE more feature (pick by persona/pain)
Branch — show **only one**:

| If their pain / persona is… | Show this | Verbatim line |
|---|---|---|
| Forgotten follow-ups | **Follow-up reminders** (Calendar / ScheduleMeeting) | "Reminder set — ab koi follow-up nahi bhulega, system khud yaad dilayega." |
| Commission disputes / owner | **Khata Book / Settlement** | "Kiska kitna paisa — ek screen. Commission ka hisaab, zero jhagda. Audit ke time bhi ready." |
| Team visibility / manager | **Team hierarchy + member access** | "Har agent dikhega — kisne kitne calls, follow-ups kiye. Bina micromanage. Aur naya banda delete nahi kar sakta." (Roles today are Admin and Member; a Manager role is planned.) |
| Scattered inventory / agent | **Property + buyer matching** | "Client bola 2BHK — *(tap)* — turant property nikli, share kar do. Deal fast." |
| Instagram leads going nowhere | **Instagram → CRM capture** | "Aapki Instagram DM aur comments se lead seedha yahan aati hai, score ke saath." (Built, in Meta Development Mode — say that.) |
| Site-visit no-shows | **Property page + booking + follow-up call** | "Property page se client khud visit book karta hai, aur visit ke baad AI follow-up call jaata hai." |

### 9:00–10:00 — ROI moment
> "Maths simple hai. {{price_line}}, plus 18% GST. Aapka ek deal kitne ka commission deta hai? *(let them answer)* Agar saal mein ek bhi leak hua lead bach gaya, yeh tool nikal aaya. Ek admin staff kitna leta hai? Usse compare karke dekho."

Prices come from `../pricing.json` via the token — never typed here. Let them supply the commission figure; do not assert a range on their behalf.

### 10:00–11:00 — The ask (trial/close)
> "Chalo aise karte hain — aaj hi {{trial_line}} shuru karte hain, no card. Main khud aapke pehle 10 leads import kar deta hoon abhi, aur pehla follow-up set kar deta hoon — kal subah se hi farak dikhega. Theek hai? Bas mujhe woh Excel/WhatsApp list bhej do."

The trial is 14 days with no card, and there is a 30-day money-back window for first-time subscribers. Both come from `../pricing.json`. The AI Employee add-on has neither.

→ On yes: hand to `closing-script.md` plan selection + `onboarding-script.md` Day 0.
→ On objection: `objections.md`, isolate, resolve, **re-ask**.

---

## Discovery-led personalization branches

- **Owner:** lead with where leads go missing, the wow, khata and the dashboard — control. Close on ROI they calculated.
- **Manager:** lead with hierarchy, member access and follow-up tracking. Arm them to pitch the owner.
- **Agent:** lead with automatic follow-up, call records and their own numbers. They sell upward.
- **Burned-before lead:** open with khata and the AI capability — things their old CRM never had — to break the "all CRMs are the same" frame.
- **Pune lead:** growth framing and Marathi rapport. Parked (D24).

---

## Mid-demo objection handling (don't derail)
- Acknowledge in one line, park if not blocking: "Bilkul, woh main 1 min mein dikhata hoon — pehle yeh dekh lo."
- If it's a real blocker → jump to `objections.md`, resolve, return to flow.
- The common ones: "kitna time lagega seekhne", "team seekhegi?", "data safe?" — all in `objections.md`.

---

## Short demo — 2-minute variant (DM/`CTA-DEMO` curiosity, cold-ish viewer)
For the curiosity lead from a DM who is not ready for a full call. The month-1 pack calls this the **90-second walkthrough**, which is the length to aim for:
> **0:00–0:15 Frame:** "90 second mein dikhata hoon — apne hi lead pe."
> **0:15–1:15 Wow:** fire ONE live action on their lead. Show what it leaves behind.
> **1:15–1:30 Ask:** "Pasand aaya? {{trial_line}} on kar dun — main setup kar deta hoon."

Use it as a **hook to earn the full demo or the trial.** No other features. Just the wow and the ask.

---

## After the demo
- Send the post-demo recap on WhatsApp **within one hour** (`../30-channels/whatsapp/demo-followup.md`).
- Update the lead stage and log it to the pipeline (`pipeline-manager`).
- If it did not close on the call, start the `followup-script.md` cadence — Touch 1 is the recap.
