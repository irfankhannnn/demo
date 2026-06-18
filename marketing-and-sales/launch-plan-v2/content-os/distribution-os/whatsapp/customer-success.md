# WhatsApp — Customer Success Strategy

Onboard, activate, and retain paying customers via WhatsApp; reduce churn; manufacture referral-ready fans. Sits after `demo-followup.md` and pairs with Sales OS `onboarding-script.md`, `retention-analyst`, and Automation OS customer-health-scoring (`automation-os/workflow-map.md` seq 6–8).

> **The window that matters:** the first 7 days decide retention. A customer who hits **3 of 4 activation milestones in week 1** retains strongly; one who never imports leads churns. The product's "aha" is **AI calling on a real lead** (`business-memory §3.6`) — get them there by Day 2. Channel: WhatsApp, because that's where they already live and reply fast.

---

## 1. Onboarding sequence (first 7 days = activation window)

| Day | Goal (1 action) | Feature | Milestone |
|---|---|---|---|
| **Day 0** | Welcome + add 10 leads | Lead Management | Leads added |
| **Day 1** | Import existing WhatsApp/Excel leads | Lead import | Bulk imported |
| **Day 2** | Turn on AI calling for 1 real lead | AI Calling (aha) | First AI call |
| **Day 3** | Invite team + set roles (agencies) | Team / RBAC | Member invited |
| **Day 5** | Set up khata / first settlement | Khata Book | Khata entry |
| **Day 7** | Week-1 win check-in + show dashboard | Analytics | Reviewed numbers |

## 2. Verbatim onboarding messages

**Day 0 — welcome:**
> "Welcome to RealEstateFlow {{name}}! 🎉 Aaj sirf ek kaam: apne *10 active leads* daal do (manual ya import). 5 min lagega. Help chahiye toh yahin reply karo — main saath hoon. Chalo shuru karte hain 💪"

**Day 1 — import:**
> "{{name}}, aaj apni purani sheet ya WhatsApp ke leads import kar lete hain — taaki sab ek jagah ho. Screenshot ya file bhejo, main migrate karwa deta hoon. Spreadsheet ko aaj retire karte hain 🙂"

**Day 2 — AI calling (the aha):**
> "Aaj wala magic ✨ Ek lead choose karo aur uspe *AI calling* on karo. AI khud call karega, qualify karega, recording + transcript de dega — aap sirf hot leads uthao. 1 lead pe try karo, fir batao kaisa laga!"

**Day 3 — team invite:**
> "Ab team ko andar lao 👥 Members invite karo, role set karo (Admin sab dekhe, Member delete na kar paaye). Isse aapko *poori team ek dashboard* mein dikhegi — kaun kaunsa lead chala raha hai, saaf."

**Day 7 — week-1 win:**
> "Ek hafta ho gaya 🎯 Aapne is hafte **{{X}} leads** add kiye, **{{Y}} follow-ups** set kiye, **{{Z}} AI calls**. Yeh dekho aapka dashboard 👇 Aise hi chala toh agle mahine lead leakage ~zero. Koi sawaal?"

## 3. Activation milestones (health signals)
Track 4: **leads added · first follow-up reminder set · first AI call made · team member invited.** 3/4 in week 1 = strong retention. Feed each as a `MKT_EVENT` to customer-health-scoring (`automation-os/workflow-map.md`). Customer who hits all 4 → trigger §6 advocacy.

## 4. Ongoing cadence (post-activation)

| Cadence | Action | Example |
|---|---|---|
| Weekly | Proactive tip matched to their usage | "Aap khata kam use kar rahe — yeh 1-min mein commission clear karta hai 👇" |
| Monthly | Usage review | "Is mahine: {{X}} leads, {{Y}} follow-ups, {{Z}} visits. Pichhle se {{±%}}." |
| On a win | Celebrate (deal closed via app) | "Deal closed via RealEstateFlow! 🥳 Yeh wali energy chahiye thi 🔥" |
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
> "{{name}}, miss kiya aapko 🙂 Kahin setup pe atke toh nahi? 10 min do, main aapke saath baith ke leads import + 1 AI call set kar deta hoon — fir system khud chalega. Kab free ho?"

## 6. Turn customers into advocates
Activated + happy (hit milestones, positive reply, closed a deal via app) → **referral ask** (`referral.md`) + **case-study request** (CT-CASE / CT-PROOF). Best wins become content (with consent) and feed the community Wins group. The loop: success → proof → referral → new lead.

## 7. Metrics (→ `growth-dashboard.md`)
Activation rate (≥3/4 milestones in wk1), week-1 milestones hit, login frequency, feature-adoption breadth, monthly churn, NPS, expansion (free→paid, plan upgrades). Low Day-2 AI-call rate = the aha is being missed → make Day-2 message more concrete / offer to do it on a call.
