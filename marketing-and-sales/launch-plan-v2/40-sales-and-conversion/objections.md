# Objections

The objections Mumbai brokers actually raise against adopting a CRM: the verbatim line in Hinglish, the emotional root underneath it, two or three response variants, the reframe, a proof point tied to a **real feature** (`../10-audience-and-voice/product-truth.md`), and the next move. Mirror the winners in content (`FW-OBJECTION`, `FW-MYTH`) and in DMs (`dm-to-demo.md`).

**Used by:** `../week-3-public-launch/day-19-cold-day2-iterate.md` · `../week-4-optimize-convert/day-23-followup-non-replies.md`, `day-26-trial-to-paid.md`, `day-27-pitch-refinement.md`.

> **Golden rule:** an objection is rarely a no. It is a request for safety. Empathise first, never argue, reframe to ROI or risk, and end with one low-friction next step. Pricing detail goes to DM or WhatsApp, never into a public comment thread.

> **Two hard constraints on every line in this file.**
>
> 1. **We have zero customers.** No "Andheri ke ek owner", no "ek agency ne 100 buyers ko call karwaya", no adoption percentage, no ₹ figure for what someone else recovered. The June draft leaned on all four. Every one of them is replaced by something the prospect can verify for themselves — which, conveniently, persuades better (`../10-audience-and-voice/claims-and-proof-policy.md`).
> 2. **Prices come from `../pricing.json`** via `{{price_line}}`, `{{trial_line}}` and `{{ai_employee_disclosure}}`. There is no Free plan, no "50 leads" cap, no Starter and no Growth tier. The tiers are Solo, Team, Team+ and the AI Employee add-on; the trial is 14 days without a card; there is a 30-day money-back window for first-time subscribers; annual billing is 20% off. The replacement pricing proposal is `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`.

---

## The Feel–Felt–Found template

The classic version of this template needs a third party who already bought. We do not have one, so the "found" beat points at the risk reversal instead of at a customer:

> "Samajh sakta hoon **(feel)** — aapko lagta hai {{objection}}. Bahut brokers yahi sochte hain **(felt)**. Isliye trial 14 din free hai aur first-time subscribers ke liye 30 din money-back **(found)** — aap khud apne leads pe dekho, mere kehne pe mat jao."

*(Marathi rapport opener, parked with the rest of the Pune scope — D24: "Mala kalta — ho, pratyek broker la asach vatta suruvatila.")*

> Open decision D24 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 1. "CRM bahut mahanga hai" (cost)

- **Root:** fear of wasted spend, cash-flow anxiety — every rupee counts.
- **Responses:**
  - "Mahanga kya hai — aapka ek deal kitne ka commission deta hai? *(let them answer)* {{price_line}} mein agar mahine ka ek leak lead bhi bach gaya, paisa wasool."
  - "Aap admin staff ko kitna dete ho? Yeh usse compare karke dekho — hisaab khud karta hai."
  - "{{trial_line}} se start karo. Faayda dikhe tabhi paisa lagana — aur first-time subscribers ke liye 30 din money-back hai."
- **Reframe:** it is not a cost, it is insurance against the leads that quietly go missing.
- **Proof:** the trial, the money-back window, and khata book auto-calculating settlements. All in `../pricing.json` and in the product.
- **Next move:** "Main aapke abhi ke lead volume pe hisaab nikaal deta hoon — 2 min." Do that arithmetic manually, with their numbers. The lead-leakage calculator on the site is still a placeholder (`agency-app/landing-pages/agency-owners/index.html`), so do not send them to it.

## 2. "Time nahi hai naya tool seekhne ka" (time)

- **Root:** operational exhaustion — twelve-hour days already, no bandwidth for one more thing.
- **Responses:**
  - "Seekhne mein minutes lagte hain. Aur follow-up calls AI karega — woh ghante aapke wapas."
  - "Setup main khud kar dunga WhatsApp pe — aapko sirf dekhna hai."
- **Reframe:** this does not spend time, it returns time.
- **Proof:** AI calling (`agency-app/ai-calling/`) handles follow-up calls inside business hours; onboarding is free and we do the first import with you (`../pricing.json`).
- **Next move:** book a 10-minute guided setup slot → `onboarding-script.md`.

Note what changed: the old line promised "onboarding takes ~10 min guided import". Nobody has measured that. "We do the first import with you" is both true and a better offer.

## 3. "Meri team nahi seekhegi" (team won't learn)

- **Root:** a past tech failure, fear of pushback, "main dictator lagunga".
- **Responses:**
  - "Aapki team WhatsApp chalati hai na? Yeh utna hi asaan — mobile-first, tap-based. Naya joiner ek din mein chala leta hai."
  - "Member role mein woh delete nahi kar sakte — galti ka dar nahi. Bas leads aur follow-ups."
  - "Main team ko 30 min mein khud train kar deta hoon — free onboarding."
- **Reframe:** adoption depends on simplicity, not on feature count, and this is deliberately simple.
- **Proof:** mobile-first, tap-based flows; roles (Member cannot delete); speech-to-text for people who do not like typing (`agency-app/web/src/components/SpeechToTextButton.tsx`).
- **Next move:** "Apne ek agent ko bhi demo pe bula lo — woh khud bolega easy hai."

The "95% users month 1 mein active rehte hain" line is gone. We have no users, so there is no retention rate.

## 4. "Mera kaam toh chal raha hai" (we're fine)

- **Root:** status-quo bias. They cannot see what is leaking.
- **Responses:**
  - "Chal raha hai aur badh raha hai — alag baat hai. Pichhle mahine ki leads mein se kitno ko teesra follow-up gaya? Ginke batao."
  - "Jo dikhta nahi, uska dard bhi nahi hota. Isliye pehle dikhate hain, fir decide karna."
- **Reframe:** "fine" usually means bleeding slowly. The leak is invisible, which is exactly why it does not hurt.
- **Proof:** lead ownership and stages make it visible; the dashboard shows leads stuck per stage.
- **Next move:** "Ek hafta tracking on karo — hum dono dekhte hain kitne atke."

## 5. "WhatsApp/Excel se ho jaata hai" (current system works)

- **Root:** comfort and sunk cost.
- **Responses:**
  - "WhatsApp communication ke liye best hai. System business ke liye. Dono jodo — WhatsApp chhodo mat."
  - "Excel 50 leads tak theek. 200+ pe? Galti, duplicate, 'kisne overpay kiya' — yeh Excel nahi pakad sakta."
- **Reframe:** you are not replacing WhatsApp or Excel, you are organising their chaos.
- **Proof:** lead capture pulls scattered leads into one pipeline; the dashboard is the single source of truth.
- **Next move:** "Apni Excel mujhe bhejo — main usi se import karke dikha deta hoon farak."

## 6. "Data safe rahega? System down ho gaya toh?" (data safety)

- **Root:** control anxiety — data loss is business loss.
- **Responses:**
  - "Cloud backup AWS Mumbai region pe — aapke laptop se zyada safe. Phone khoye toh bhi data wahi ka wahi."
  - "Member role mein naya agent kuch delete nahi kar sakta — galti se bhi data nahi udega."
  - "Aapka data aapka — kabhi bhi export, no lock-in."
- **Reframe:** data on a phone or in Excel is at *more* risk — one crash and it is gone.
- **Proof:** AWS `ap-south-1`; permission guards (Member cannot delete); export any time.
- **Next move:** "Trust page bhej dun, fir trial pe khud dekho."

## 7. "AI sach mein kaam karega real estate ke liye?" (AI scepticism)

- **Root:** "AI is hype", fear the client will find it off-putting, doubt about quality.
- **Responses:**
  - "Real estate AI ke liye sabse easy case hai — sawaal fixed, objections fixed. Apne hi ek lead pe abhi live try karo, result khud dekho."
  - "AI aapko replace nahi karta — boring follow-up karta hai, closing aap karte ho."
- **Reframe:** the AI is a junior who never forgets a follow-up and never gets tired.
- **Proof:** run it live in the demo on their own lead — a call placed, transcribed and qualified, or the WhatsApp AI Employee taking an inbound lead.
- **Next move:** **the live demo on their own lead.** That is the single biggest wow, and it is proof they generate rather than proof we assert.

The old third response was "Ek agency ne 100 buyers ko AI se call karwaya, 30 qualify hue, 30 ghante bach gaye." That agency does not exist. Deleted.

> Open decision D26 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

## 8. "Lock-in ho jayega, baad mein phasunga" (lock-in)

- **Root:** regret anxiety — they will trap me.
- **Responses:**
  - "{{trial_line}}, no card, kabhi bhi export, kabhi bhi cancel. Aur first-time subscribers ke liye 30 din money-back. Phasne ka sawaal hi nahi."
  - "Hum lock-in se nahi, value se rokte hain. Pasand nahi aaya toh chhod do — data le jao."
- **Reframe:** no contract means we have to earn the business every month.
- **Proof:** trial without a card, export any time, the 30-day money-back window.
- **Next move:** start the trial today → `closing-script.md` risk reversal.

If the AI Employee is in the conversation, say the exception out loud: `{{ai_employee_disclosure}}` — paid from day one, no trial, no refund.

## 9. "Abhi market down hai, baad mein dekhenge" (market down)

- **Root:** budget anxiety, wait-and-watch.
- **Responses:**
  - "Down market mein toh har lead aur important. Leakage ab band karo, market ka wait mat karo."
  - "Jab market chalega tab sab system lagayenge — aap aage raho, abhi process tight karo."
- **Reframe:** a down market is exactly when the leak hurts most. Best time, not worst.
- **Proof:** lead ownership and automatic follow-up catch the deals that would otherwise drift.
- **Next move:** "{{trial_line}} pe start karo — commitment kuch nahi."

## 10. "Pehle bhi CRM try kiya, nahi chala" (tried before)

- **Root:** disappointment, "all SaaS is the same", sunk-cost regret.
- **Responses:**
  - "Woh videshi workflow ke liye bane the. Yeh Indian broking agency ke liye bana hai — buyer matching, site visit, khata, WhatsApp."
  - "Pehle wala kyun nahi chala — complex tha, team ne use nahi kiya? Yeh us galti ko fix karke bana hai."
- **Reframe:** the problem was not the category, it was the wrong product for this market.
- **Proof:** khata book, property and buyer matching, site-visit scheduling with booking, the WhatsApp AI Employee.
- **Next move:** a demo focused on khata and the AI capability — the things their old CRM did not have.

**If they name a competitor, you may answer about it in a 1:1 conversation.** Do not name one in published content: the month-1 rule is never to name a competitor in a post, caption or carousel.

## 11. "Main toh techie nahi hoon" (owner not techie)

- **Root:** embarrassment about being old-fashioned, generational insecurity.
- **Responses:**
  - "Agar WhatsApp chala lete ho, toh yeh bhi chala loge — usse bhi asaan."
  - "Phone/OTP se login, bol ke likh sakte ho (speech-to-text). Computer ki zaroorat hi nahi."
  - "Aapke bete ya manager ko bhi dikha do — woh excited ho jayega."
- **Reframe:** this was not built for techies, it was built for brokers.
- **Proof:** phone/OTP login, mobile-first, speech-to-text input.
- **Next move:** do the setup *with* them over a WhatsApp screen share. Never leave them alone with it.

## 12. "RERA / compliance ka kya?" (compliance)

- **Root:** legal worry. Real estate in India is compliance-sensitive and reputationally exposed.
- **Responses:**
  - "Aapka client data, KYC, documents — sab ek jagah organized, audit ke time turant nikal jaata hai."
  - "Khata book se commission ka transparent hisaab — dispute ya audit mein proof ready."
- **Reframe:** a CRM *helps* compliance; scattered Excel and WhatsApp is the audit nightmare.
- **Proof:** document and KYC management (internal reference: `docs/ai_context_management_plan/KYC_IMPLEMENTATION_SUMMARY.md` — an internal path, never quoted to a prospect); khata settlement records.
- **Next move:** show documents, KYC and khata records in the demo. **Keep the claim at organise-and-store level — never promise legal certification.**

## 13. "English/typing problem hai team ko" (language barrier)

- **Root:** practical. Agents may be semi-literate in English and slow typists.
- **Responses:**
  - "UI simple English mein hai, par bol ke likh sakte ho — speech-to-text andar hai. Typing minimum."
  - "Number daalo, tap karo, ho gaya — paragraph likhne ki zaroorat nahi."
  - "Aur AI calls Hinglish mein karta hai, toh client se baat aapki bhasha mein hoti hai."
- **Reframe:** the tool takes taps, not essays, and the customer-facing conversation happens in their language.
- **Proof:** the CRM UI is **English** and has no translation layer today; speech-to-text exists; the AI agent speaks Hinglish on calls.
- **Next move:** demo a voice-note lead entry to an agent who does not like typing.

This is the objection the June draft got most wrong. It claimed four times over that "UI Hinglish mein hai". It is not — the interface is English (`agency-app/web/`). Saying otherwise sets up a first-login disappointment that costs more than the objection did.

## 14. "Main bahut chhota hoon CRM ke liye" (too small)

- **Root:** "CRM is a big-company thing", plus cost insecurity.
- **Responses:**
  - "Solo plan ek member ke liye hi bana hai — unlimited properties, pura CRM, {{price_line}}. Aur {{trial_line}}."
  - "Chhote ho isliye toh ek bhi lead leak afford nahi kar sakte. Bade waale leak kar lete hain, aap nahi."
- **Reframe:** small means the leak hurts most, which means the system matters most.
- **Proof:** the Solo tier in `../pricing.json` — one member, unlimited properties, full CRM.
- **Next move:** self-serve trial signup, no card (`CTA-TRIAL`).

Worth naming who is *not* the target: a solo beginner with no deal flow. `../10-audience-and-voice/icp-and-personas.md` excludes them, and a demo spent there is a demo not spent on an agency.

## 15. "Main toh [competitor] use karta hoon, theek hai" (competitor loyalty)

- **Root:** switching fatigue, loyalty, and doubt about whether the grass is greener.
- **Responses:**
  - "Badhiya — usme khata book aur WhatsApp AI Employee hai? Yeh do cheezein Indian broker ke liye banayi hain."
  - "Switch karne ki zaroorat nahi abhi — trial ke free credits pe AI calling alag try karke dekho, compare karo."
- **Reframe:** do not replace, fill the gap.
- **Proof:** khata book, the WhatsApp AI Employee, real-estate-specific matching and site-visit booking.
- **Next move:** offer a side-by-side trial and let the product win on feel. The trial includes a monthly credit allowance that covers a meaningful amount of AI calling (`agency-app/api/creditConfig.js`).

---

## Mid-conversation rules

1. **Isolate before resolving:** "Iske alawa aur koi cheez rok rahi hai?" Find the real blocker.
2. **Never stack:** answer one objection, re-ask for the next step, then handle the next if it comes.
3. **Empathy token first:** "Bilkul sahi sawaal hai…" or "Samajh sakta hoon…" before any answer.
4. **Money in ₹/lakh/crore, and the money is theirs.** Ask for their commission figure; do not supply one.
5. **Take price negotiation to DM or WhatsApp**, never into public comments.
6. **The default close on any objection** is the live demo on their own lead.
7. **Log recurring objections** from comments and DMs back into this file, and feed them into `FW-OBJECTION` content.
8. **Never invent a peer.** If you catch yourself about to say "ek owner ne bhi…", stop and use the risk reversal instead. Once we have a customer who says yes in writing, that changes — and only then.
