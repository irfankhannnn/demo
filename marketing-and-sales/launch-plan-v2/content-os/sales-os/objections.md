# Sales OS — Objections Playbook

The objections Mumbai/Pune brokers actually raise against adopting a CRM — the verbatim line (Hinglish), the *real* emotional root underneath it, 2–3 response variants, the reframe, a proof point tied to a **real feature** (see `01-business-memory.md` §3), and the next-step move. Mirror the winners in content (`FW-OBJECTION` / `FW-MYTH`) and DMs (`content-to-conversation.md`). Grounded in market research §8.

> **Golden rule:** An objection is rarely a "no." It's a request for safety. Empathise first, never argue, reframe to ROI or risk, end with one low-friction next step. Pricing detail → DM/WhatsApp, never public comments.

---

## The Feel–Felt–Found template (use for any objection)

> "Samajh sakta hoon **(feel)** — aapko lagta hai {{objection}}. Bahut brokers ne yahi socha tha **(felt)** — Andheri ke ek owner ne bhi bola tha exactly yeh. Par try karne ke baad unhone dekha **(found)** ki {{specific result}}. Aap khud ek hafta dekh lo, no risk."

Marathi rapport opener for Pune: *"Mala kalta — ho, pratyek broker la asach vatta suruvatila."* ("I understand — yes, every broker feels this at first.")

---

## 1. "CRM bahut mahanga hai" (cost)
- **Root:** Fear of wasted spend, cash-flow anxiety — "har rupee counts."
- **Responses:**
  - "Mahanga kya hai — ek missed deal ₹2–20L ka hota hai. ₹999/mo mein agar mahine ka ek leak lead bhi bach gaya, paisa wasool."
  - "Aap admin staff ko ₹20K/mo dete ho. Yeh ₹999 se ₹2,999 mein woh saara hisaab khud karta hai."
  - "Free plan se start karo — ₹0. Jab faayda dikhe tabhi paisa lagana."
- **Reframe:** Cost nahi — **insurance** against leakage (research: ~30–40% leads leak = ₹15–25L/yr).
- **Proof:** Free plan (₹0, 50 leads) + ROI math; Khata Book auto-calculates settlements (no admin needed).
- **Next move:** "Main aapke abhi ke lead volume pe exact ROI nikal deta hoon — 2 min." → leak-calculator handoff.

## 2. "Time nahi hai naya tool seekhne ka" (time)
- **Root:** Operational exhaustion — already 12-hr days, no bandwidth for "one more thing."
- **Responses:**
  - "Seekhne mein 10 min. Aur AI calling toh aapka time *bachata* hai — 10 ghante/hafta follow-up calls AI karega."
  - "Setup main khud kar dunga WhatsApp pe — aapko sirf dekhna hai."
- **Reframe:** Yeh time *kharchta* nahi, time *deta* hai. Tool jo 2 ghante/din wapas de.
- **Proof:** AI Calling (Exotel + ElevenLabs) handles follow-up calls; onboarding takes ~10 min guided import.
- **Next move:** Book a 10-min guided setup slot → `onboarding-script.md`.

## 3. "Meri team nahi seekhegi" (team won't learn)
- **Root:** Past tech failure + fear of team pushback + "main dictator lagunga."
- **Responses:**
  - "Aapki team WhatsApp chalati hai na? Yeh utna hi asaan — Hinglish, mobile-first. Naya joiner 1 din mein chalata hai."
  - "Member role mein woh delete nahi kar sakte — galti ka dar nahi. Bas leads aur follow-ups."
  - "95% users month 1 mein active rehte hain. Main team ko 30-min mein train kar deta hoon."
- **Reframe:** Adoption "feature count" pe nahi, simplicity pe depend karta hai — yeh deliberately simple hai.
- **Proof:** Mobile-first Hinglish UI; RBAC (Member = no-delete); speech-to-text input for non-typers.
- **Next move:** "Apne ek agent ko bhi demo pe bula lo — woh khud bolega easy hai."

## 4. "Mera kaam toh chal raha hai" ("we're fine")
- **Root:** Status-quo bias — "if it ain't broken." Doesn't *see* the leakage.
- **Responses:**
  - "Chal raha hai aur **badh** raha hai — alag baat hai. Roz kitne leads silently leak ho rahe, pata hai?"
  - "Aapke saamne wala broker bhi 'fine' tha — jab tak uska agent leke nahi bhaga."
- **Reframe:** "Fine" = bleeding slowly. Leakage invisible hai, isliye dard nahi hota — par ₹50K/din ja raha hai.
- **Proof:** Lead Management (ownership + stages) makes leakage *visible*; Dashboard shows leads stuck per stage.
- **Next move:** "Ek hafta tracking on karo — main dikhata hoon kitne leak ho rahe. Free."

## 5. "WhatsApp/Excel se ho jaata hai" (current system works)
- **Root:** Comfort + sunk cost ("isme time invest kiya hai").
- **Responses:**
  - "WhatsApp *communication* ke liye best hai. CRM *business* ke liye. Dono jodo — WhatsApp chhodo mat."
  - "Excel 50 leads tak theek. 200+ pe? Galti, duplicate, 'kisne overpay kiya' — yeh sab Excel nahi pakad sakta."
- **Reframe:** Tum WhatsApp/Excel replace nahi kar rahe — uska chaos organize kar rahe ho.
- **Proof:** Lead capture organizes scattered leads into one pipeline (`FW-WHATSAPP-CHAOS`); Dashboard = single source of truth.
- **Next move:** "Apni Excel mujhe bhejo — main usi se import karke dikha deta hoon farak."

## 6. "Data safe rahega? System down ho gaya toh?" (data safety)
- **Root:** Control anxiety — "data loss = business loss." Trust in tech.
- **Responses:**
  - "Cloud backup AWS pe — aapke laptop se zyada safe. Phone khoye toh bhi data wahi ka wahi."
  - "RBAC se naya agent kuch delete nahi kar sakta — galti se bhi data nahi udega."
  - "Aapka data aapka — kabhi bhi export, no lock-in."
- **Reframe:** Excel/phone par data *zyada* risk pe hai (ek crash = sab gaya).
- **Proof:** Cloud (AWS) backup; RBAC `PermissionGuard` (Member no-delete); data export anytime.
- **Next move:** "Trust page bhej dun, fir trial pe khud dekho."

## 7. "AI calling sach mein kaam karega real estate ke liye?" (AI skepticism)
- **Root:** "AI is hype" + fear client ko bura lagega + quality doubt.
- **Responses:**
  - "Real estate AI calling ke liye sabse easy case hai — script fixed, objections fixed. Apne hi lead pe live try karo abhi."
  - "AI aapko replace nahi karta — boring follow-up karta hai, aap closing karte ho."
  - "Ek agency ne 100 buyers ko AI se call karwaya, 30 qualify hue, 30 ghante bach gaye."
- **Reframe:** AI = aapka junior jo kabhi follow-up nahi bhulta, kabhi tired nahi hota.
- **Proof:** AI Calling live in demo — places call, transcribes, qualifies on a real/sample lead.
- **Next move:** **Live AI demo on their own lead** — the single biggest wow (`FW-AI` / `CTA-DEMO`).

## 8. "Lock-in ho jayega, baad mein phasunga" (lock-in)
- **Root:** Regret anxiety — "they'll trap me."
- **Responses:**
  - "Free plan, no card, kabhi bhi export, kabhi bhi cancel. Phasne ka sawaal hi nahi."
  - "Hum lock-in se nahi, value se rokte hain. Pasand nahi aaya toh chhod do — data le jao."
- **Reframe:** No-contract = humein *roz* earn karna padta hai aapka business.
- **Proof:** Free plan + no credit card + data export anytime.
- **Next move:** Start free trial today (zero commitment) → `closing-script.md` risk-reversal.

## 9. "Abhi market down hai, baad mein dekhenge" (market down)
- **Root:** Budget anxiety + "wait and watch."
- **Responses:**
  - "Down market mein toh **har** lead aur important. Leakage ab band karo, market ka wait mat karo."
  - "Jab market chalega tab sab CRM lagayenge — aap aage raho, abhi process tight karo."
- **Reframe:** Down market = exactly jab leakage sabse zyada chubhti hai. Best time, not worst.
- **Proof:** Lead Management + AI follow-up recover deals that would otherwise leak (`FW-LEAD-LEAKAGE`).
- **Next move:** "Free plan pe start — paisa tab lagana jab market lautega."

## 10. "Pehle bhi CRM try kiya, nahi chala" (tried before)
- **Root:** Disappointment + "all SaaS same" + sunk-cost regret.
- **Responses:**
  - "Woh Salesforce/Zoho US ke liye bana tha. Yeh Mumbai/Pune broker ke liye bana — buyer matching, site visit, khata, AI calling."
  - "Pehle wala kyun nahi chala — complex tha, team ne use nahi kiya? Yeh us galti ko fix karke bana hai."
- **Reframe:** Problem CRM-category nahi thi — wrong CRM thi. India-built ≠ US-built.
- **Proof:** RE-specific features — Khata Book, property/buyer matching, site-visit scheduling, Hinglish UI.
- **Next move:** RE-specific demo focused on khata + AI (cheezein jo purane CRM mein thi hi nahi).

## 11. "Main toh techie nahi hoon" (owner not techie)
- **Root:** Shame of being "old-fashioned" + generational insecurity.
- **Responses:**
  - "Agar WhatsApp chala lete ho, toh yeh bhi chala loge — usse bhi asaan."
  - "Phone/OTP se login, bolke type karo (speech-to-text). Computer ki zaroorat hi nahi."
  - "Aapke bete/manager ko bhi dikha do — woh excited ho jayega, succession bhi set."
- **Reframe:** Yeh techies ke liye nahi — *brokers* ke liye bana hai.
- **Proof:** Phone/OTP login, mobile-first, speech-to-text input — no laptop, no jargon.
- **Next move:** Do the setup *with* them on WhatsApp screen-share; never leave them alone with it.

## 12. "RERA / compliance ka kya?" (RERA / compliance)
- **Root:** Legal worry — RE in India is compliance-sensitive; reputational risk.
- **Responses:**
  - "Aapka client data, KYC, documents — sab ek jagah organized, audit ke time turant nikal jaata hai."
  - "Khata book se commission ka transparent hisaab — dispute ya audit mein proof ready."
- **Reframe:** CRM *helps* compliance — scattered Excel/WhatsApp audit mein nightmare hai.
- **Proof:** Document/KYC management (`KYC_IMPLEMENTATION_SUMMARY.md`); Khata settlement records.
- **Next move:** Show document/KYC + khata records in demo. (Keep claims at organize-and-store level — no legal certification promise.)

## 13. "English/typing problem hai team ko" (language barrier)
- **Root:** Practical — agents semi-literate in English, slow typists.
- **Responses:**
  - "UI Hinglish mein hai, aur bol ke bhi likh sakte ho (speech-to-text). Typing minimum."
  - "Number daalo, tap karo, ho gaya — paragraph likhne ki zaroorat nahi."
- **Reframe:** Tool aapki bhasha bolta hai, aapko English seekhne ki zaroorat nahi.
- **Proof:** Hinglish UI + speech-to-text button (`SpeechToTextButton.tsx`); tap-based flows.
- **Next move:** Demo a voice-note lead entry to a non-typing agent.

## 14. "Main bahut chhota hoon CRM ke liye" ("too small for CRM")
- **Root:** "CRM = bade logon ki cheez" + cost insecurity.
- **Responses:**
  - "Solo broker ke liye **Free plan** banaya hi isliye hai — 50 leads, 2 users, ₹0."
  - "Chhote ho isliye toh ek bhi lead leak afford nahi kar sakte. Bade waale leak kar lete hain, aap nahi."
- **Reframe:** Chhota = leakage sabse zyada chubhti hai = CRM sabse zyada zaroori.
- **Proof:** Free plan (solo); single-user lead + follow-up + buyer matching.
- **Next move:** Self-serve Free signup, no card (`CTA-TRIAL`).

## 15. "Main toh [competitor] use karta hoon, theek hai" (competitor loyalty)
- **Root:** Switching fatigue + loyalty + "grass greener?" doubt.
- **Responses:**
  - "Badhiya — usme khata book aur AI calling hai? Yeh do cheezein India broker ke liye banayi hain."
  - "Switch karne ki zaroorat nahi abhi — free pe AI calling alag try karke dekho, compare karo."
- **Reframe:** Replace nahi — jo gap hai (AI + khata + Hinglish) woh fill karo.
- **Proof:** Khata Book + AI Calling + RE-specific matching = differentiators most generic CRMs lack.
- **Next move:** Offer side-by-side AI-calling trial; let the product win on feel.

---

## Mid-conversation rules
1. **Isolate before resolving:** "Iske alawa aur koi cheez rok rahi hai?" — find the *real* blocker.
2. **Never stack:** Answer one objection, re-ask for the next step, then handle the next if it comes.
3. **Empathy token first:** "Bilkul sahi sawaal hai…" / "Samajh sakta hoon…" before any answer.
4. **Money in ₹/lakh/crore**, always. Quantify pain ("₹20L/yr leak") > features.
5. **Take price negotiation to DM/WhatsApp**, never public comments.
6. **Default close on every objection:** the **live AI-calling demo on their own lead**.
7. **Log recurring objections** from comments/DMs back into this file + feed `FW-OBJECTION` content.
