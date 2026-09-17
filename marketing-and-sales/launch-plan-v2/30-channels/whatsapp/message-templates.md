# WhatsApp — message templates

**The copy-paste library** for every WhatsApp touch, organised by funnel stage. Brand copy is 70% English / 30% romanized Hindi. Personalise `{{name}}`, `{{slot}}`, `{{founder}}`. **One CTA each. Human tone, no bot-speak.** These power the sequences in `lead-nurture.md`, `demo-followup.md`, `customer-success.md` and `referral.md`.

> **Read first — the policy that actually applies to us.**
>
> The June draft said "only approved template messages may initiate outside the 24-hour window". That is a **WhatsApp Cloud API** rule. Today the product's WhatsApp is a **self-hosted Baileys service, QR-linked, not a BSP** (`services/whatsapp-platform/`), and which number talks to prospects is undecided. So:
>
> - **If we send via the Cloud API:** opt-in required, approved templates outside the 24-hour customer-service window, free-form inside it.
> - **If we send from a self-hosted linked number:** there is no template approval at all, which means **opt-in and low volume are the only things protecting the number from a ban**.
>
> Either way: honour STOP within 24 hours, never cold-blast, money always in ₹/lakh/crore, and reference only features that exist (`../../10-audience-and-voice/product-truth.md`).
>
> The official-API plan is `docs/realestateflow-vision/39-whatsapp-official-api-plan.md`.
>
> Open decision D29c — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

> **Prices and offers are tokens, never literals.** `{{price_line}}`, `{{trial_line}}`, `{{ai_employee_disclosure}}`, `{{referrer_reward}}` and `{{referee_reward}}` resolve at send time from `../../pricing.json` (and, for the reward tokens, from a referral programme that does not exist yet). There is no Free plan and no "Starter" tier — the tiers are Solo, Team, Team+ and the AI Employee add-on. The replacement pricing proposal is `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`.

> **What the AI may be said to do** is limited to the approved-claims list. AI calling is not on it today; the WhatsApp AI Employee is the M1 wedge.
>
> Open decision D26 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 1. LEAD — first touch and qualify

**L1 — first touch (<5 min):**
> "Hi {{name}} 🙌 RealEstateFlow se {{founder}}. Aapne {{reel}} pe interest dikhaya. Quick: abhi leads WhatsApp/Excel pe ya kisi system pe? Bata do, main exact dikhata hoon kaise help hoga."

**L2 — qualify (team size):**
> "{{name}}, ek cheez batao — aap solo ho ya team ke saath? Uske hisaab se main sahi plan aur setup suggest karunga (solo ke liye {{trial_line}})."

**L3 — product nudge:**
> "60 second ka recording 👉 {{link}}. WhatsApp pe AI Employee nayi lead ko khud handle karta hai — qualify karke aapko sirf garam leads deta hai. Apne ek lead pe try karna ho toh batao 😊"

**L4 — pipeline audit offer:**
> "Free 10-min pipeline audit? Main aapke saath baith ke ginta hoon ki kitni leads bina teesre follow-up ke reh gayi. Kal {{slot1}} ya {{slot2}}?"

**L5 — lead-source pain (WhatsApp):**
> "Bahut log bolte hain 'leads WhatsApp mein kho jaate hain' — 200 message ke neeche dab jaate hain. RealEstateFlow har lead ek jagah rakhta hai, har lead pe next step ke saath. Dikhau kaise?"

## 2. QUALIFY — match the plan and route

**Q1 — solo → trial route:**
> "Solo ke liye best: seedha trial pe leads daalo. {{trial_line}} 👉 {{trial}}. Main setup mein guide kar dunga."

**Q2 — team → demo route:**
> "Team ke liye main ek 90-second live walkthrough dikhata hoon — team hierarchy, member access aur khata. Kal {{slot1}} ya {{slot2}}, kaunsa theek hai?"

**Q3 — budget-conscious:**
> "Budget ki tension? {{price_line}}. Ek bachi hui deal ka commission hi mahine ka kharcha nikaal deta hai — hisaab apne numbers pe kar ke dekho. Pehle trial pe try karo, fir decide."

## 3. DEMO — confirm, prep, rescue

**D1 — confirm (T-24h):**
> "Kal {{time}} apna demo confirm hai ✅ Kya specially dekhna chahoge — WhatsApp pe AI Employee, khata, ya team hierarchy?"

**D2 — prep (T-3h):**
> "Demo se pehle ek lead ka number ready rakhna — aapke hi lead pe live dikha dunga. 🔥"

**D3 — reminder (T-1h):**
> "1 ghante mein milte hain 🙌 Link 👉 {{link}}. Phone pe chalega, desktop nahi chahiye."

**D4 — no-show rescue (+10 min):**
> "Aaj ka demo miss ho gaya 🙂 Koi baat nahi. Reschedule? 2 slot: {{a}} / {{b}}. Ya yeh 90-second recorded walkthrough dekh lo 👉 {{link}}"

**D5 — recorded fallback (+1 day):**
> "{{name}}, jaldi mein the? Yeh 90-second walkthrough dekh lo jab time mile 👉 {{link}}. Lead tracking aur WhatsApp AI Employee dono hain."

**D6 — post-demo recap (within 1h):**
> "Maza aaya baat karke! 3 cheezein jo aapke kaam aayengi: 1) {{x}} 2) {{y}} 3) {{z}}. Aapke size ke liye {{price_line}}. {{trial_line}} shuru karein 👉 {{trial}}?"
>
> If the demo showed the AI Employee, append `{{ai_employee_disclosure}}` — paid from day one, no trial, no refund.

**D7 — objection: team won't use it:**
> "Aapne team adoption poocha — isliye onboarding mein main khud aapki team ke saath ek call karta hoon. 30 min mein training, WhatsApp jaisa hi feel hota hai. Yeh tension main lunga 🤝"

**D8 — ROI nudge (+3 days):**
> "Chhota hisaab: aap mahine ~{{N}} leads handle karte ho. Inme se kitno ko teesra follow-up gaya? Jo number aaye, usko apne average commission se multiply karo. {{trial_line}} mein khud farak dekho."

## 4. TRIAL — onboarding and activation

**T1 — Day 0 welcome:**
> "Welcome to RealEstateFlow {{name}}! 🎉 Aaj ka ek kaam: apne 10 active leads daal do. 5 min. Help chahiye toh reply karo."

**T2 — Day 1 import:**
> "Aaj purani sheet ya WhatsApp leads import karte hain — sab ek jagah. File ya screenshot bhejo, main migrate karwa deta hoon."

**T3 — Day 2, the first real moment:**
>
> *AI Employee customers:* "{{name}}, aaj wala step ✨ Apna WhatsApp QR se connect karo. Uske baad jo inbound lead aayegi, AI Employee khud handle karega. Ek lead pe hone do, fir batao kaisa laga."
>
> *Everyone else:* "{{name}}, aaj wala step ✨ Ek lead pe AI calling chalao — AI call karega, qualify karega, transcript dega. Trial ke free credits isi ke liye hain. 5 min lagega."
>
> Which of these two counts as activation is D27 — see `../../50-measurement/activation-definition.md`.

**T4 — Day 3 team invite:**
> "Ab team ko andar lao 👥 Members invite karo, role set karo. Poori team ek dashboard mein — kaun kaunsa lead chala raha hai, saaf. (Solo plan ek seat ka hai; team add karne ke liye Team chahiye.)"

**T5 — inactive (48h no login):**
> "Setup adhoora reh gaya? Koi baat nahi 🙂 10 min do, main aapke saath leads import kar deta hoon aur pehla follow-up set kar deta hoon. Kab free ho?"

## 5. ONBOARDING — feature deep-dives

**O1 — khata setup (Day 5):**
> "Commission ka hisaab clear karein? Khata book mein ek entry banao — kiska kitna paisa, settlement tak sab track. Setup karun saath mein?"

**O2 — follow-up reminders:**
> "Ek aadat daalo: har lead pe 'next follow-up date' set karo. System yaad dilayega — follow-up miss nahi hoga. Try karke batao."

**O3 — property inventory:**
> "Apni properties daal do — client poochhe '2BHK', aap turant page share karoge, aur site visit seedha CRM mein book ho jayega. Add karein?"

## 6. SUCCESS — wins and reviews

**S1 — week-1 check-in (Day 7):**
> "Ek hafte mein {{X}} leads add, {{Y}} follow-ups set 👏 Yeh raha aapka dashboard. Sawaal?"
>
> Numbers come from their own CRM counts. Do not append a promise about next month.

**S2 — monthly review:**
> "Is mahine: {{X}} leads, {{Y}} follow-ups, {{Z}} visits ({{±%}} pichhle se). Kya aur optimize karein? Main ek tip deta hoon 👇"

**S3 — celebrate a deal:**
> "Deal band ho gayi! 🥳 Yeh wali energy chahiye thi 🔥 Mubarak ho {{name}}!"

## 7. REFERRAL

Gated — see `referral.md`. Nothing here sends before there are paying, activated customers, and both reward tokens are unresolved (D29b).

**R1 — post-win ask:**
> "{{name}}, aapke network mein koi broker jo WhatsApp/Excel pe struggle kar raha ho? Unhe {{referee_reward}} milega aur aapko {{referrer_reward}} 🙌 Naam/number bhej do — unki permission ke saath."

**R2 — 1-tap share (write it for them):**
> "Bhai yeh CRM try kar — RealEstateFlow. Leads, follow-up, WhatsApp pe AI Employee, khata, sab ek jagah. Main use kar raha hoon, kaam ka hai 👉 {{ref-link}}"

## 8. WIN-BACK — paid churn risk

**W1 — 7-day inactive (paid):**
> "Miss kiya aapko {{name}} 🙂 Kahin atke toh nahi? 10 min do, main saath baith ke set kar deta hoon — fir system khud chalega. Kab free ho?"

**W2 — renewal value recap:**
> "Is saal aapne RealEstateFlow pe {{X}} leads track kiye aur {{Y}} follow-ups complete kiye 📊 Agle saal aur bada karein? Renewal slot ready hai."
>
> Counts only — leads tracked, follow-ups done, visits booked. We cannot compute "₹Y ka leakage bacha", so we do not claim it.

## 9. RE-ENGAGE — cold leads

**RE1 — soft re-engage:**
> "Koi pressure nahi {{name}} — bas yeh dekh lo: {{best clip}}. Jab ready ho, main yahan hoon 😊"

**RE2 — value-only revive:**
> "Ek free tip {{name}}: har lead pe next-action date likho, follow-up kabhi miss nahi hoga. Aur kuch chahiye toh awaaz dena 🙏"

## 10. Marathi variants — parked

M1 is Mumbai only, so the Marathi set is not in use. It is kept here, with the script cleaned up, for whenever Pune opens.

> Open decision D24 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

**M-L1 — first touch:**
> "Namaskar {{name}} 🙌 RealEstateFlow kadun {{founder}}. Sadhya leads WhatsApp var ki kuthlya system var? Sanga, mi exact dakhavto kasa fayda hoil."

**M-D1 — demo confirm:**
> "Udya {{time}} tumcha demo confirm aahe ✅ Kay aadhi baghaychay — AI Employee, khata, ki team hierarchy?"

**M-T3 — Day 2:**
> "{{name}}, aajcha step ✨ Ek lead var try kara — system swatahun call ani qualify karto. 5 min, try kara, sanga kasa vatla!"

**M-R1 — referral:**
> "{{name}}, tumchya olakhitil koni broker jo ajun Excel var aahe? Tyala {{referee_reward}} deto, ani tumhala {{referrer_reward}} 🙌"

---

## Usage rules

- **One CTA per message** — never stack two asks.
- **Match the honorific:** owners → aap / tumhi; young brokers → tu / tum.
- **Speed:** lead templates fire within 5 minutes; success and review messages are scheduled.
- **The 24-hour window** governs free-form messages on the Cloud API. On a self-hosted number there is no template gate — and no safety net either, so keep volume low and opt-in strict.
- Log which template ID drove the action in the tracking sheet (`../../50-measurement/attribution-today.md`); the CRM lead record has no field for it.
