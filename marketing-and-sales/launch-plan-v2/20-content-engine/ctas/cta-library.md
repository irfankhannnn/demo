# CTA Library — 500 Instagram CTAs

**500 reusable Instagram CTAs** for RealEstateFlow, the Real Estate OS for Indian agency owners. Each has a stable ID `CTA-<CATEGORY>-NNN`. Machine-readable copy in [`ctas.json`](ctas.json) — the two files are one dataset in two formats and must be edited together.

> Voice: Hinglish 70/30 (70% English, 30% romanized Hindi — `CLAUDE.md`, brand kit v3). Action-oriented, low-friction, street-smart.

**Brand constants — do not restate them here.** Handle, domains, colours and fonts live in [`../../10-audience-and-voice/brand-constants.md`](../../10-audience-and-voice/brand-constants.md).
**Pricing.** Never hardcode a price in a CTA. Use the tokens `{{price_line}}`, `{{trial_line}}` and `{{ai_employee_disclosure}}`, resolved at publish time from [`../../pricing.json`](../../pricing.json), which is the single source of truth.
**Claims.** Every CTA must pass [`../../10-audience-and-voice/claims-and-proof-policy.md`](../../10-audience-and-voice/claims-and-proof-policy.md). No customer counts, no testimonials, no unsourced figures. Pre-launch we have zero customers.

### Gated subsets (do not resolve these here)

| Subset | IDs | Gate |
|---|---|---|
| Pune / Marathi-flavoured lines (9) | `CTA-WHATSAPP-023`, `CTA-COMMENT-026`, `CTA-SHARE-021`, `CTA-SAVE-024`, `CTA-DM-013`, `CTA-COMMUNITY-010`, `CTA-COMMUNITY-026`, `CTA-LEAD-MAGNET-023`, `CTA-FOLLOW-020` | M1 is Mumbai-only. Hold until **D24**. |
| COMMUNITY category (50) | `CTA-COMMUNITY-001` … `-050` | There is no community yet. Hold until **D23** settles which channels exist. |
| Keyword vocabulary (DEMO / PRICE / LEAK / GUIDE …) | across DM + COMMENT | The month-1 pack uses SYSTEM / KHATA / AUDIT / DEMO. Align once **D23** fixes the channel set. |

> Open decision D23 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`
> Open decision D24 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`

---

## How the IDs work

Every CTA has a **stable ID**: `CTA-<CATEGORY>-NNN` — zero-padded 3 digits, **numbering restarts per category** (e.g. `CTA-DEMO-001` … `CTA-DEMO-050`, then `CTA-WHATSAPP-001` …). IDs never change once assigned, so any content piece can reference a CTA by ID forever.

**Schema (`ctas.json`):**

```json
{"id":"CTA-DEMO-001","category":"DEMO","language":"hi-dominant|mixed|en-leaning|mr-dominant","text":"the CTA line","funnel_stage":"TOFU|MOFU|BOFU"}
```

- **language** — `hi-dominant` (Hindi-heavy), `mixed` (Hinglish, the default), `en-leaning` (English-heavy), `mr-dominant` (Marathi-flavored, Pune).
- **funnel_stage** — `TOFU` (awareness/engagement: follow, save, share, comment), `MOFU` (consideration: demo, DM, WhatsApp, lead-magnet), `BOFU` (decision: trial, signup, book).

---

## How the content factory assigns a CTA per piece

1. **Pick the goal** of the post (engagement, lead capture, or conversion) → maps to a funnel stage.
2. **Pick the category** from the cheatsheet below that matches the goal + format (Reel vs carousel vs story).
3. **Filter `ctas.json`** by `category` + `funnel_stage`, and by `language` if the piece is Pune-targeted (`mr-dominant`, held under **D24**) or English-leaning.
4. **Round-robin / random-pick** a CTA ID so the same line isn't repeated across consecutive posts; **log the chosen `id`** against the content piece for tracking which CTA drove the result.
5. **Place it** as the spoken/on-screen end line AND the caption-ender. Keep the action verb intact (e.g. "comment 'CRM'", "link in bio", "DM 'DEMO'").

> Rule of thumb: **one primary CTA per piece.** A secondary soft CTA (Save/Follow) can ride along in the caption, but the spoken/on-screen CTA stays single and clear.

---

## Which CTA category for which goal (cheatsheet)

| Goal | Funnel stage | Use category | Why |
|---|---|---|---|
| Grow audience / get content seen | TOFU | **FOLLOW**, **SHARE** | Builds reach and warm audience for later. |
| Boost engagement / algorithm push | TOFU | **COMMENT**, **SAVE** | Comments + saves are the strongest IG ranking signals. |
| Capture a lead without leaving IG | MOFU | **LEAD-MAGNET**, **COMMENT** (keyword) | Trades value for a DM/keyword trigger. |
| Start a 1:1 conversation | MOFU | **DM**, **WHATSAPP** | Warm, low-friction; great for objections + pricing. |
| Show the product | MOFU | **DEMO** | 2-min demo de-risks the decision before trial. |
| Build belonging / retention | TOFU | **COMMUNITY** | Network effect, free support, soft nurture. |
| Drive sign-ups / conversions | BOFU | **TRIAL** | The trial in `../../pricing.json` needs no card — lowest-friction conversion. |

**Format pairing:** Reels → FOLLOW/SAVE/COMMENT/DEMO · Carousels → SAVE/LEAD-MAGNET/SHARE · Stories → WHATSAPP/DM/TRIAL (swipe-up/link sticker) · Educational posts → SAVE/LEAD-MAGNET · Founder/BTS → FOLLOW/COMMUNITY.

---

## DEMO — show the product (2-min demo)

| ID | CTA | Lang | Stage |
|---|---|---|---|
| CTA-DEMO-001 | Demo dekho — sirf 2 minute. Link bio mein hai. | mixed | MOFU |
| CTA-DEMO-002 | 2 min ka demo, poora CRM samajh jaoge. realestateflow.in/demo/ | mixed | MOFU |
| CTA-DEMO-003 | Live demo book karo, hum dikhayenge sab kuch. | mixed | MOFU |
| CTA-DEMO-004 | Bina signup, demo dekho — realestateflow.in/demo/ pe jao. | mixed | TOFU |
| CTA-DEMO-005 | Demo ke baad decide karo. Pressure zero. | mixed | MOFU |
| CTA-DEMO-006 | Apni agency ka demo chahiye? Comment karo DEMO. | mixed | MOFU |
| CTA-DEMO-007 | Dekhna hai kaise kaam karta hai? Demo link bio mein. | mixed | MOFU |
| CTA-DEMO-008 | Quick demo — 120 seconds, that's it. | en-leaning | MOFU |
| CTA-DEMO-009 | Demo dekhe bina mat judge karo, bhai. | hi-dominant | MOFU |
| CTA-DEMO-010 | Tap karo bio link, demo turant chalu. | mixed | MOFU |
| CTA-DEMO-011 | Demo wala video bio mein pinned hai. | mixed | MOFU |
| CTA-DEMO-012 | Ek baar demo dekh lo, baaki samajh jaoge. | hi-dominant | MOFU |
| CTA-DEMO-013 | Free demo book karo aaj hi — slots limited. | mixed | BOFU |
| CTA-DEMO-014 | Demo chahiye toh DM mein 'DEMO' likho. | mixed | MOFU |
| CTA-DEMO-015 | 2-minute walkthrough dekho, time waste nahi hoga. | mixed | MOFU |
| CTA-DEMO-016 | Demo dekho, fir trial lo — simple. | mixed | MOFU |
| CTA-DEMO-017 | Live demo mein apne sawaal poocho. | mixed | MOFU |
| CTA-DEMO-018 | Curious ho? Demo se sab clear ho jayega. | mixed | TOFU |
| CTA-DEMO-019 | Demo dekhne ka time nahi? 2 min hi toh hai. | hi-dominant | MOFU |
| CTA-DEMO-020 | Personalised demo — apni agency ke hisaab se. | mixed | MOFU |
| CTA-DEMO-021 | Demo link bio mein — abhi tap karo. | mixed | MOFU |
| CTA-DEMO-022 | Dikhana hai team ko? Demo saath baith ke dekho. | mixed | MOFU |
| CTA-DEMO-023 | Demo dekho — no slides, sirf real product. | mixed | MOFU |
| CTA-DEMO-024 | Aaj ka demo slot book kar lo, kal busy ho jaoge. | mixed | BOFU |
| CTA-DEMO-025 | Demo dekhke socho — koi jaldi nahi. | hi-dominant | MOFU |
| CTA-DEMO-026 | Bio mein demo link. Ek tap, done. | mixed | MOFU |
| CTA-DEMO-027 | Demo dekhna free hai, judging tumhari marzi. | mixed | MOFU |
| CTA-DEMO-028 | Real CRM, real demo — realestateflow.in/demo/. | mixed | MOFU |
| CTA-DEMO-029 | Demo book karo, hum tumhare numbers pe dikhayenge. | mixed | MOFU |
| CTA-DEMO-030 | Sirf dekhna chahte ho? Self-serve demo bio mein. | mixed | TOFU |
| CTA-DEMO-031 | Demo dekho, fir khud decide karo. | mixed | BOFU |
| CTA-DEMO-032 | Live walkthrough chahiye? Comment 'DEMO'. | mixed | MOFU |
| CTA-DEMO-033 | Demo dekho phone pe — desktop ki zaroorat nahi. | mixed | MOFU |
| CTA-DEMO-034 | Guided demo book karo — ek RealEstateFlow expert ke saath. | mixed | MOFU |
| CTA-DEMO-035 | Demo mein khata book bhi dikhayenge — zaroor dekho. | mixed | MOFU |
| CTA-DEMO-036 | AI calling ka demo dekhna mat bhoolna. | mixed | MOFU |
| CTA-DEMO-037 | 2 min ka demo > 2 ghante ka confusion. | mixed | MOFU |
| CTA-DEMO-038 | Demo dekho aaj, decision lo kal — koi rush nahi. | hi-dominant | MOFU |
| CTA-DEMO-039 | Bio link tap karo, demo seedha khulega. | mixed | MOFU |
| CTA-DEMO-040 | Demo dekho aur batao kya pasand aaya. | mixed | MOFU |
| CTA-DEMO-041 | Free live demo — slot ke liye DM karo. | mixed | BOFU |
| CTA-DEMO-042 | Demo dekhna hai bina baat kiye? Bio mein video hai. | mixed | TOFU |
| CTA-DEMO-043 | Ek demo, saare doubts clear. realestateflow.in/demo/. | mixed | MOFU |
| CTA-DEMO-044 | Demo book karo — Hindi mein samjhayenge. | mixed | MOFU |
| CTA-DEMO-045 | Sirf 2 min do, demo khud bol dega. | hi-dominant | MOFU |
| CTA-DEMO-046 | Demo dekhe bina decision mat lena, yaar. | hi-dominant | MOFU |
| CTA-DEMO-047 | Quick demo lena hai? Bio link ready hai. | mixed | MOFU |
| CTA-DEMO-048 | Demo dekho, screenshots se zyada clear hoga. | mixed | MOFU |
| CTA-DEMO-049 | Apni team ke saath demo schedule karo. | mixed | MOFU |
| CTA-DEMO-050 | Demo ka link bio mein — abhi dekh lo. | mixed | MOFU |

## WHATSAPP — start a chat

| ID | CTA | Lang | Stage |
|---|---|---|---|
| CTA-WHATSAPP-001 | WhatsApp pe baat karte hain — bio mein number. | mixed | MOFU |
| CTA-WHATSAPP-002 | Koi sawaal? WhatsApp karo, turant reply. | mixed | MOFU |
| CTA-WHATSAPP-003 | WhatsApp pe 'Hi' bhejo, baaki hum sambhal lenge. | mixed | MOFU |
| CTA-WHATSAPP-004 | Demo WhatsApp pe chahiye? Message karo. | mixed | MOFU |
| CTA-WHATSAPP-005 | WhatsApp pe pricing poocho — koi formality nahi. | mixed | MOFU |
| CTA-WHATSAPP-006 | Seedha WhatsApp karo — calls ka jhanjhat nahi. | mixed | MOFU |
| CTA-WHATSAPP-007 | WhatsApp pe 'CRM' likho, details aa jayengi. | mixed | MOFU |
| CTA-WHATSAPP-008 | Confusion hai? WhatsApp pe clear kar dete hain. | mixed | MOFU |
| CTA-WHATSAPP-009 | WhatsApp link bio mein — tap karke chat shuru. | mixed | MOFU |
| CTA-WHATSAPP-010 | WhatsApp pe demo schedule karo, easy hai. | mixed | MOFU |
| CTA-WHATSAPP-011 | Bhai, WhatsApp karo — hum English/Hindi dono mein baat karenge. | mixed | MOFU |
| CTA-WHATSAPP-012 | WhatsApp pe apni agency ka size batao, plan suggest karenge. | mixed | MOFU |
| CTA-WHATSAPP-013 | Jaldi reply chahiye? WhatsApp best hai. | mixed | MOFU |
| CTA-WHATSAPP-014 | WhatsApp karo — no bots, real banda baat karega. | mixed | MOFU |
| CTA-WHATSAPP-015 | Pricing, plans, demo — sab WhatsApp pe. | mixed | MOFU |
| CTA-WHATSAPP-016 | WhatsApp pe 'TRIAL' likho, setup mein help milegi. | mixed | BOFU |
| CTA-WHATSAPP-017 | Office se baat karni hai? WhatsApp number bio mein. | mixed | MOFU |
| CTA-WHATSAPP-018 | WhatsApp pe message chhodo, hum call back karenge. | mixed | MOFU |
| CTA-WHATSAPP-019 | Ek WhatsApp aur tumhara CRM setup shuru. | mixed | BOFU |
| CTA-WHATSAPP-020 | WhatsApp pe doubt poocho — judge koi nahi karega. | mixed | MOFU |
| CTA-WHATSAPP-021 | WhatsApp pe demo ka time fix karo. | mixed | MOFU |
| CTA-WHATSAPP-022 | Reply guaranteed — WhatsApp karke dekho. | mixed | MOFU |
| CTA-WHATSAPP-023 | WhatsApp pe 'PUNE' likho agar Pune se ho — local team connect. | mr-dominant | MOFU |
| CTA-WHATSAPP-024 | Team plan chahiye? WhatsApp pe baat karte hain. | mixed | MOFU |
| CTA-WHATSAPP-025 | WhatsApp pe sab samjha denge — bina pressure. | mixed | MOFU |
| CTA-WHATSAPP-026 | Number save karo, kabhi bhi WhatsApp karo. | mixed | MOFU |
| CTA-WHATSAPP-027 | WhatsApp pe apna requirement bhejo, custom quote denge. | mixed | BOFU |
| CTA-WHATSAPP-028 | Demo book karna hai? Bas WhatsApp karo. | mixed | MOFU |
| CTA-WHATSAPP-029 | WhatsApp pe screenshot bhejo apni current sheet ka — migrate kar denge. | mixed | BOFU |
| CTA-WHATSAPP-030 | Late night doubt? WhatsApp chhodo, subah reply. | mixed | MOFU |
| CTA-WHATSAPP-031 | WhatsApp pe 'DEMO' bhejo — link turant. | mixed | MOFU |
| CTA-WHATSAPP-032 | Hinglish mein baat karni hai? WhatsApp perfect hai. | mixed | MOFU |
| CTA-WHATSAPP-033 | WhatsApp pe onboarding help — free hai. | mixed | BOFU |
| CTA-WHATSAPP-034 | Sawaal chhota ho ya bada — WhatsApp karo. | hi-dominant | MOFU |
| CTA-WHATSAPP-035 | WhatsApp pe apni team add karwao — hum guide karenge. | mixed | BOFU |
| CTA-WHATSAPP-036 | Bio mein WhatsApp button — ek tap mein chat. | mixed | MOFU |
| CTA-WHATSAPP-037 | WhatsApp pe baat karo, fir trial lo — koi rush nahi. | mixed | MOFU |
| CTA-WHATSAPP-038 | Kuch bhi poocho WhatsApp pe — sales pitch nahi milega. | mixed | MOFU |
| CTA-WHATSAPP-039 | WhatsApp pe 'PRICE' likho — saare plans bhej denge. | mixed | MOFU |
| CTA-WHATSAPP-040 | WhatsApp karo aur 10 min mein clarity le lo. | mixed | MOFU |
| CTA-WHATSAPP-041 | Demo ya trial — WhatsApp pe decide karo. | mixed | MOFU |
| CTA-WHATSAPP-042 | WhatsApp pe humse juro, updates miss mat karo. | mixed | TOFU |
| CTA-WHATSAPP-043 | Migration ka tension? WhatsApp karo, free help. | mixed | BOFU |
| CTA-WHATSAPP-044 | WhatsApp pe baat — phone uthane ka mann nahi toh type karo. | hi-dominant | MOFU |
| CTA-WHATSAPP-045 | WhatsApp number bio mein — abhi message karo. | mixed | MOFU |
| CTA-WHATSAPP-046 | Khata setup mein help? WhatsApp pe poocho. | mixed | BOFU |
| CTA-WHATSAPP-047 | WhatsApp pe 'AI' likho — AI calling samjhayenge. | mixed | MOFU |
| CTA-WHATSAPP-048 | Tumhare time pe WhatsApp karo — hum wahin honge. | mixed | MOFU |
| CTA-WHATSAPP-049 | WhatsApp se faster kuch nahi — abhi try karo. | mixed | MOFU |
| CTA-WHATSAPP-050 | Ek WhatsApp message — saara confusion khatam. | hi-dominant | MOFU |

## TRIAL — free signup, no credit card

| ID | CTA | Lang | Stage |
|---|---|---|---|
| CTA-TRIAL-001 | Free trial shuru karo — no credit card. app.realestateflow.in/signup | mixed | BOFU |
| CTA-TRIAL-002 | Aaj hi free trial lo, kal se organised raho. | mixed | BOFU |
| CTA-TRIAL-003 | Trial free hai — card maango toh batana. | mixed | BOFU |
| CTA-TRIAL-004 | Bio link se signup karo, 2 min mein ready. | mixed | BOFU |
| CTA-TRIAL-005 | Free mein try karo — pasand aaye toh rakho. | mixed | BOFU |
| CTA-TRIAL-006 | Trial lo, apni asli leads daal ke test karo. | mixed | BOFU |
| CTA-TRIAL-007 | No credit card, no jhanjhat — bas signup. | mixed | BOFU |
| CTA-TRIAL-008 | Free trial = zero risk. Abhi shuru karo. | mixed | BOFU |
| CTA-TRIAL-009 | Trial ke liye bio link tap karo. | mixed | BOFU |
| CTA-TRIAL-010 | Aaj signup, aaj hi pehla lead add karo. | mixed | BOFU |
| CTA-TRIAL-011 | Free trial — apni team ke saath try karo. | mixed | BOFU |
| CTA-TRIAL-012 | Trial lena hai? app.realestateflow.in/signup pe jao. | mixed | BOFU |
| CTA-TRIAL-013 | Bina paise diye poora CRM chalao — trial lo. | mixed | BOFU |
| CTA-TRIAL-014 | Free trial shuru, spreadsheet band. | mixed | BOFU |
| CTA-TRIAL-015 | Signup karo, demo data ready milega — turant samjhoge. | mixed | BOFU |
| CTA-TRIAL-016 | Trial free hai, decision tumhara — pressure zero. | mixed | BOFU |
| CTA-TRIAL-017 | Card ki zaroorat nahi — sirf phone number. | mixed | BOFU |
| CTA-TRIAL-018 | Free trial lo, khud dekho farak. | hi-dominant | BOFU |
| CTA-TRIAL-019 | Trial mein AI calling bhi try karo. | mixed | BOFU |
| CTA-TRIAL-020 | Signup link bio mein — 2 minute ka kaam. | mixed | BOFU |
| CTA-TRIAL-021 | Trial free, setup free, advice free — bas shuru karo. | mixed | BOFU |
| CTA-TRIAL-022 | Pehle try karo, fir trust karo — free trial lo. | mixed | BOFU |
| CTA-TRIAL-023 | Trial chahiye? DM mein 'TRIAL' likho. | mixed | BOFU |
| CTA-TRIAL-024 | Aaj free trial, kal pehli deal organised. | mixed | BOFU |
| CTA-TRIAL-025 | Trial se shuru karo — card nahi chahiye. | mixed | BOFU |
| CTA-TRIAL-026 | Trial lo, team ko invite karo, saath mein chalao. | mixed | BOFU |
| CTA-TRIAL-027 | Risk kuch nahi — free trial abhi shuru. | mixed | BOFU |
| CTA-TRIAL-028 | Signup 2 min — trial lo. | mixed | BOFU |
| CTA-TRIAL-029 | Free trial pe apni purani sheet import karo. | mixed | BOFU |
| CTA-TRIAL-030 | Trial ke andar hi pehla follow-up set karo. | mixed | BOFU |
| CTA-TRIAL-031 | Bio link → signup → done. Itna easy. | mixed | BOFU |
| CTA-TRIAL-032 | Free trial — bina commitment, bina card. | mixed | BOFU |
| CTA-TRIAL-033 | Aaj shuru karo, weekend tak system ready. | mixed | BOFU |
| CTA-TRIAL-034 | Trial lo aur dekho ek bhi lead miss nahi hota. | mixed | BOFU |
| CTA-TRIAL-035 | Free mein shuru karo — magic baad mein dikhega. | hi-dominant | BOFU |
| CTA-TRIAL-036 | Trial activate karo, hum onboarding mein help karenge. | mixed | BOFU |
| CTA-TRIAL-037 | Signup karo — Hindi interface bhi available. | mixed | BOFU |
| CTA-TRIAL-038 | Free trial — card nahi chahiye. | mr-dominant | BOFU |
| CTA-TRIAL-039 | Trial lo, khata book test karo, hisaab clear. | mixed | BOFU |
| CTA-TRIAL-040 | Card details? Nahi chahiye. Sirf signup karo. | mixed | BOFU |
| CTA-TRIAL-041 | Free trial start karo, baaki baad mein socho. | hi-dominant | BOFU |
| CTA-TRIAL-042 | Trial = free test drive. Bio link tap karo. | mixed | BOFU |
| CTA-TRIAL-043 | Aaj signup karo, kal team productive. | mixed | BOFU |
| CTA-TRIAL-044 | {{trial_line}} — apne pace pe chalao. | mixed | BOFU |
| CTA-TRIAL-045 | Trial lo aur ek week mein farak feel karo. | mixed | BOFU |
| CTA-TRIAL-046 | Signup link bio mein — abhi try karo, free. | mixed | BOFU |
| CTA-TRIAL-047 | Free trial pe property inventory daal ke dekho. | mixed | BOFU |
| CTA-TRIAL-048 | Trial start, spreadsheet ka tension end. | mixed | BOFU |
| CTA-TRIAL-049 | No card. No call. Sirf free trial. Shuru karo. | mixed | BOFU |
| CTA-TRIAL-050 | Aaj free trial lo — kal khud thank you bologe. | hi-dominant | BOFU |

## COMMENT — engagement + keyword triggers

| ID | CTA | Lang | Stage |
|---|---|---|---|
| CTA-COMMENT-001 | Agree ho? Comment mein 'haan' likho. | mixed | TOFU |
| CTA-COMMENT-002 | Comment karo 'CRM' aur link DM kar denge. | mixed | MOFU |
| CTA-COMMENT-003 | Tumhari sabse badi lead-problem comment mein batao. | mixed | TOFU |
| CTA-COMMENT-004 | Relate kiya? Comment mein ek emoji chhodo. | mixed | TOFU |
| CTA-COMMENT-005 | Comment 'DEMO' karo — link inbox mein. | mixed | MOFU |
| CTA-COMMENT-006 | Kaun-kaun abhi bhi Excel pe hai? Comment karo. | mixed | TOFU |
| CTA-COMMENT-007 | Comment mein apna shehar likho — local tips denge. | mixed | TOFU |
| CTA-COMMENT-008 | Sahmat ho? Niche comment karo. | hi-dominant | TOFU |
| CTA-COMMENT-009 | Comment 'GUIDE' — free checklist bhej denge. | mixed | MOFU |
| CTA-COMMENT-010 | Tumne aaj kitne follow-up miss kiye? Comment karo. | mixed | TOFU |
| CTA-COMMENT-011 | Comment mein batao — sabse bada time-waste kya hai? | mixed | TOFU |
| CTA-COMMENT-012 | Yeh galti tum bhi karte ho? Comment 'yes/no'. | mixed | TOFU |
| CTA-COMMENT-013 | Comment 'TRIAL' — signup link bhej denge. | mixed | BOFU |
| CTA-COMMENT-014 | Apna favourite feature comment karo (demo dekh ke). | mixed | MOFU |
| CTA-COMMENT-015 | Comment mein tag karo apne business partner ko. | mixed | TOFU |
| CTA-COMMENT-016 | Yeh pain real hai? Comment mein 100% likho. | mixed | TOFU |
| CTA-COMMENT-017 | Comment 'PRICE' aur saare plans bhej denge. | mixed | MOFU |
| CTA-COMMENT-018 | Konsa point sabse zyada hit hua? Comment karo. | mixed | TOFU |
| CTA-COMMENT-019 | Comment karo agar follow-up bhoolne ki aadat hai. | hi-dominant | TOFU |
| CTA-COMMENT-020 | Apni agency ka size comment mein likho. | mixed | TOFU |
| CTA-COMMENT-021 | Comment 'AI' — AI calling ki detail bhej denge. | mixed | MOFU |
| CTA-COMMENT-022 | Tumhare paas kitne leads pending hain? Comment. | mixed | TOFU |
| CTA-COMMENT-023 | Comment mein ek shabd — tumhari biggest CRM wish. | mixed | TOFU |
| CTA-COMMENT-024 | Sehmat ho ya nahi? Comment mein bolo bindaas. | hi-dominant | TOFU |
| CTA-COMMENT-025 | Comment 'KHATA' — commission tracking samjhayenge. | mixed | MOFU |
| CTA-COMMENT-026 | Pune wale comment mein 'PUNE' likho. | mr-dominant | TOFU |
| CTA-COMMENT-027 | Comment karo, hum sabse common sawaal pe reel banayenge. | mixed | TOFU |
| CTA-COMMENT-028 | Yeh tumhari kahani hai? Comment mein batao. | hi-dominant | TOFU |
| CTA-COMMENT-029 | Comment 'YES' agar leads WhatsApp mein kho jaate hain. | mixed | TOFU |
| CTA-COMMENT-030 | Apna doubt comment mein daalo — hum reply karenge. | mixed | MOFU |
| CTA-COMMENT-031 | Comment mein guess karo — kitna time bachta hai? | mixed | TOFU |
| CTA-COMMENT-032 | Sabse relatable point comment mein quote karo. | mixed | TOFU |
| CTA-COMMENT-033 | Comment 'SETUP' — onboarding steps bhej denge. | mixed | BOFU |
| CTA-COMMENT-034 | Konsa plan tumhare liye sahi? Comment karo, suggest karenge. | mixed | MOFU |
| CTA-COMMENT-035 | Comment mein apni team ka naam tag karo. | mixed | TOFU |
| CTA-COMMENT-036 | Tumhe yeh feature chahiye? Comment 'chahiye'. | hi-dominant | MOFU |
| CTA-COMMENT-037 | Comment karo agar 2026 mein bhi sheet pe ho. | mixed | TOFU |
| CTA-COMMENT-038 | Drop a 🏠 in the comments agar relate karte ho. | mixed | TOFU |
| CTA-COMMENT-039 | Comment 'INFO' — poori detail bhej denge. | mixed | MOFU |
| CTA-COMMENT-040 | Sach bolo — comment mein, kitne deals miss hui? | hi-dominant | TOFU |
| CTA-COMMENT-041 | Comment mein apna pain likho, hum solution dikhayenge. | mixed | TOFU |
| CTA-COMMENT-042 | Yeh hack pasand aaya? Comment mein 🔥 daalo. | mixed | TOFU |
| CTA-COMMENT-043 | Comment 'HELP' — koi bhi sawaal, hum hain. | mixed | MOFU |
| CTA-COMMENT-044 | Apni city comment karo — wahan ki agencies dikhayenge. | mixed | TOFU |
| CTA-COMMENT-045 | Comment karo: spreadsheet ya CRM — tum kya use karte ho? | mixed | TOFU |
| CTA-COMMENT-046 | Yeh number sach lagta hai? Comment mein bolo. | mixed | TOFU |
| CTA-COMMENT-047 | Comment 'REELS' agar aur tips chahiye. | mixed | TOFU |
| CTA-COMMENT-048 | Apna biggest 2026 goal comment mein likho. | mixed | TOFU |
| CTA-COMMENT-049 | Comment karo agar AI calling try karna chahte ho. | mixed | MOFU |
| CTA-COMMENT-050 | Ek comment, ek link — 'DEMO' likho bas. | mixed | MOFU |

## SHARE — spread to team / network

| ID | CTA | Lang | Stage |
|---|---|---|---|
| CTA-SHARE-001 | Yeh apni team ke saath share karo. | mixed | TOFU |
| CTA-SHARE-002 | Kisi agent dost ko bhejo jise yeh chahiye. | mixed | TOFU |
| CTA-SHARE-003 | Share karo — koi na koi iske liye thank you bolega. | mixed | TOFU |
| CTA-SHARE-004 | Apne broker group mein forward karo. | mixed | TOFU |
| CTA-SHARE-005 | Yeh reel apne partner ko zaroor bhejo. | mixed | TOFU |
| CTA-SHARE-006 | Team WhatsApp group mein share karo abhi. | mixed | TOFU |
| CTA-SHARE-007 | Share with that one agent jo abhi bhi Excel pe hai. | mixed | TOFU |
| CTA-SHARE-008 | Yeh tip share karo, credit baad mein lo. | mixed | TOFU |
| CTA-SHARE-009 | Apne manager ko bhejo — wo khush ho jayenge. | mixed | TOFU |
| CTA-SHARE-010 | Share karo agency owners ke group mein. | mixed | TOFU |
| CTA-SHARE-011 | Kisi ko yaad aaya? Unhe yeh bhej do. | hi-dominant | TOFU |
| CTA-SHARE-012 | Apne junior agents ke saath share karo. | mixed | TOFU |
| CTA-SHARE-013 | Yeh sabko pata hona chahiye — share karo. | hi-dominant | TOFU |
| CTA-SHARE-014 | Forward to a friend jo deals miss kar raha hai. | mixed | TOFU |
| CTA-SHARE-015 | Share button dabao, ek agent ki madad ho jayegi. | mixed | TOFU |
| CTA-SHARE-016 | Yeh reel save bhi karo aur share bhi. | mixed | TOFU |
| CTA-SHARE-017 | Apne real estate WhatsApp group mein daal do. | mixed | TOFU |
| CTA-SHARE-018 | Share karo — knowledge baatne se badhta hai. | hi-dominant | TOFU |
| CTA-SHARE-019 | Bhejo us dost ko jo CRM dhundh raha hai. | hi-dominant | MOFU |
| CTA-SHARE-020 | Yeh apni puri sales team ko bhejo. | mixed | TOFU |
| CTA-SHARE-021 | Share this — Pune ke agents ko zaroor pasand aayega. | mr-dominant | TOFU |
| CTA-SHARE-022 | Forward karo apne business partner ko. | mixed | TOFU |
| CTA-SHARE-023 | Agar useful laga toh ek dost ko share karo. | mixed | TOFU |
| CTA-SHARE-024 | Apne network mein share karo, sab seekhe. | mixed | TOFU |
| CTA-SHARE-025 | Yeh hack share karo, hero bano group mein. | mixed | TOFU |
| CTA-SHARE-026 | Share karo us colleague ko jo overwhelmed hai. | mixed | TOFU |
| CTA-SHARE-027 | Bhejo unhe jinki agency grow kar rahi hai. | hi-dominant | TOFU |
| CTA-SHARE-028 | Yeh story share karo, koi na koi relate karega. | mixed | TOFU |
| CTA-SHARE-029 | Apne team lead ko tag aur share karo. | mixed | TOFU |
| CTA-SHARE-030 | Share karo — agla deal kisi aur ka bach jayega. | mixed | TOFU |
| CTA-SHARE-031 | Forward this to your office group abhi. | mixed | TOFU |
| CTA-SHARE-032 | Yeh reel apne realtor friends ko bhejo. | mixed | TOFU |
| CTA-SHARE-033 | Share karo agar yeh tumhari problem solve kar sakta hai. | mixed | TOFU |
| CTA-SHARE-034 | Bhejo us banda ko jo roz follow-up bhoolta hai. | hi-dominant | TOFU |
| CTA-SHARE-035 | Apni agency ke owner ko yeh share karo. | mixed | TOFU |
| CTA-SHARE-036 | Share with your team — saath mein try karna easy hai. | mixed | TOFU |
| CTA-SHARE-037 | Yeh post share karo, save bhi kar lo. | mixed | TOFU |
| CTA-SHARE-038 | Forward karo — sharing is caring, bhai. | mixed | TOFU |
| CTA-SHARE-039 | Apne CRE/broker community mein share karo. | mixed | TOFU |
| CTA-SHARE-040 | Bhejo apne us dost ko jo deals track nahi kar pata. | hi-dominant | TOFU |
| CTA-SHARE-041 | Share karo, fir saath baith ke demo dekho. | mixed | MOFU |
| CTA-SHARE-042 | Yeh apne sabhi agents tak pahuchao. | hi-dominant | TOFU |
| CTA-SHARE-043 | Share this reel before tum bhool jao. | mixed | TOFU |
| CTA-SHARE-044 | Apne real estate group mein viral karo. | mixed | TOFU |
| CTA-SHARE-045 | Bhejo unhe jo abhi bhi diary pe hisaab rakhte hain. | hi-dominant | TOFU |
| CTA-SHARE-046 | Share karo — team ka time bachega. | mixed | TOFU |
| CTA-SHARE-047 | Yeh tip apne partner ke saath baant lo. | mixed | TOFU |
| CTA-SHARE-048 | Forward to anyone jiski agency scale ho rahi hai. | mixed | TOFU |
| CTA-SHARE-049 | Share karo aur batao unhe — Excel ka zamana gaya. | mixed | TOFU |
| CTA-SHARE-050 | Ek share = ek agent ki zindagi easy. | mixed | TOFU |

## SAVE — bookmark for later

| ID | CTA | Lang | Stage |
|---|---|---|---|
| CTA-SAVE-001 | Yeh save karo — baad mein kaam aayega. | mixed | TOFU |
| CTA-SAVE-002 | Save this reel, ek baar mein yaad nahi rahega. | mixed | TOFU |
| CTA-SAVE-003 | Bookmark karo — yeh checklist important hai. | mixed | TOFU |
| CTA-SAVE-004 | Save karo, jab CRM dhundho tab dekhna. | mixed | MOFU |
| CTA-SAVE-005 | Yeh tips save kar lo, repeat dekhna padega. | mixed | TOFU |
| CTA-SAVE-006 | Save this — agency setup ke time kaam aayega. | mixed | MOFU |
| CTA-SAVE-007 | Bookmark for later — yeh sona hai. | mixed | TOFU |
| CTA-SAVE-008 | Save karo, apni team ko baad mein dikhana. | mixed | TOFU |
| CTA-SAVE-009 | Yeh post save karo before scroll kar jao. | mixed | TOFU |
| CTA-SAVE-010 | Save kar lo — yeh pricing breakdown handy hai. | mixed | MOFU |
| CTA-SAVE-011 | Bookmark this reel, weekend pe try karna. | mixed | MOFU |
| CTA-SAVE-012 | Save karo yeh follow-up template idea. | mixed | TOFU |
| CTA-SAVE-013 | Yeh save karo, agle client call se pehle dekhna. | mixed | TOFU |
| CTA-SAVE-014 | Save this — 5 mistakes jo har agent karta hai. | mixed | TOFU |
| CTA-SAVE-015 | Bookmark karo, demo dekhne se pehle yaad rahe. | mixed | MOFU |
| CTA-SAVE-016 | Save kar lo — khata setup steps yahan hain. | mixed | MOFU |
| CTA-SAVE-017 | Yeh reel save karo, apne pace pe seekhna. | mixed | TOFU |
| CTA-SAVE-018 | Save this checklist before tum bhool jao. | mixed | TOFU |
| CTA-SAVE-019 | Bookmark karo — AI calling ka pura process. | mixed | MOFU |
| CTA-SAVE-020 | Save karo aur kal subah implement karo. | mixed | TOFU |
| CTA-SAVE-021 | Yeh hack save kar lo, daily use hoga. | mixed | TOFU |
| CTA-SAVE-022 | Save this — lead tracking ka simple system. | mixed | TOFU |
| CTA-SAVE-023 | Bookmark karo, jab team grow kare tab dekhna. | mixed | MOFU |
| CTA-SAVE-024 | Save karo yeh — Pune market ke numbers. | mr-dominant | TOFU |
| CTA-SAVE-025 | Yeh save karo, screenshot lene ki zaroorat nahi. | mixed | TOFU |
| CTA-SAVE-026 | Save this reel — onboarding shortcut andar hai. | mixed | MOFU |
| CTA-SAVE-027 | Bookmark karo, yeh tum dobara dhundhoge. | hi-dominant | TOFU |
| CTA-SAVE-028 | Save karo — property sharing trick yahan hai. | mixed | TOFU |
| CTA-SAVE-029 | Yeh save kar lo, next deal mein use karna. | mixed | TOFU |
| CTA-SAVE-030 | Save this before reel kho jaye feed mein. | mixed | TOFU |
| CTA-SAVE-031 | Bookmark karo — commission dispute solution. | mixed | TOFU |
| CTA-SAVE-032 | Save karo aur apni team ke saath review karo. | mixed | TOFU |
| CTA-SAVE-033 | Yeh save karo, demo link bhi yahin hai. | mixed | MOFU |
| CTA-SAVE-034 | Save this — agent ka daily routine optimised. | mixed | TOFU |
| CTA-SAVE-035 | Bookmark karo, free trial ke time yaad aayega. | mixed | BOFU |
| CTA-SAVE-036 | Save karo yeh — leads kaise organise karein. | mixed | TOFU |
| CTA-SAVE-037 | Yeh reel save kar lo, gold info hai. | mixed | TOFU |
| CTA-SAVE-038 | Save this — agency growth ke 3 steps. | mixed | TOFU |
| CTA-SAVE-039 | Bookmark karo, baad mein WhatsApp pe poochna. | mixed | MOFU |
| CTA-SAVE-040 | Save karo — yeh setup guide miss mat karna. | mixed | MOFU |
| CTA-SAVE-041 | Yeh save kar lo before tum scroll karo aage. | mixed | TOFU |
| CTA-SAVE-042 | Save this reel — tumhari biggest galti yahan hai. | mixed | TOFU |
| CTA-SAVE-043 | Bookmark karo — RERA + CRM checklist. | mixed | TOFU |
| CTA-SAVE-044 | Save karo, ek baar dekhke yaad nahi rahega. | hi-dominant | TOFU |
| CTA-SAVE-045 | Yeh save karo — team plan compare yahan hai. | mixed | MOFU |
| CTA-SAVE-046 | Save this — AI follow-up script template. | mixed | TOFU |
| CTA-SAVE-047 | Bookmark karo, apne junior ko sikhana baad mein. | mixed | TOFU |
| CTA-SAVE-048 | Save karo — yeh trick deal close karwati hai. | mixed | TOFU |
| CTA-SAVE-049 | Yeh save kar lo, pricing yaad nahi rahegi warna. | mixed | MOFU |
| CTA-SAVE-050 | Save this reel ab — thank me later. | mixed | TOFU |

## DM — direct-message keyword triggers

| ID | CTA | Lang | Stage |
|---|---|---|---|
| CTA-DM-001 | DM mein 'DEMO' likho — link turant bhej denge. | mixed | MOFU |
| CTA-DM-002 | Inbox khol do, 'CRM' likho — details aayengi. | mixed | MOFU |
| CTA-DM-003 | DM karo 'TRIAL' — signup link instantly. | mixed | BOFU |
| CTA-DM-004 | Sawaal hai? DM karo, hum reply karenge. | mixed | MOFU |
| CTA-DM-005 | DM mein 'PRICE' likho — saare plans bhej denge. | mixed | MOFU |
| CTA-DM-006 | Koi bhi doubt? DM open hai 24x7. | mixed | MOFU |
| CTA-DM-007 | DM karo 'INFO' — pura breakdown bhej denge. | mixed | MOFU |
| CTA-DM-008 | Inbox mein 'GUIDE' likho — free checklist. | mixed | MOFU |
| CTA-DM-009 | DM mein apni agency ka size batao, plan suggest karenge. | mixed | MOFU |
| CTA-DM-010 | DM 'AI' — AI calling ka demo bhej denge. | mixed | MOFU |
| CTA-DM-011 | Personal sawaal? DM mein bindaas poocho. | hi-dominant | MOFU |
| CTA-DM-012 | DM karo 'KHATA' — commission feature samjhayenge. | mixed | MOFU |
| CTA-DM-013 | Inbox mein 'PUNE' likho — local team connect karegi. | mr-dominant | MOFU |
| CTA-DM-014 | DM mein 'SETUP' likho — onboarding steps milenge. | mixed | BOFU |
| CTA-DM-015 | Pricing detail DM mein chahiye? 'PLAN' likho. | mixed | MOFU |
| CTA-DM-016 | DM karo, sales pitch nahi — sirf madad milegi. | mixed | MOFU |
| CTA-DM-017 | Inbox khol ke 'DEMO' bhejo — done. | mixed | MOFU |
| CTA-DM-018 | DM mein apni current sheet ka screenshot bhejo — migrate karwa denge. | mixed | BOFU |
| CTA-DM-019 | Koi feature pooch-na hai? DM karo abhi. | mixed | MOFU |
| CTA-DM-020 | DM 'TEAM' — team plan ki details bhej denge. | mixed | MOFU |
| CTA-DM-021 | Inbox mein 'START' likho — turant shuru karwate hain. | mixed | BOFU |
| CTA-DM-022 | DM karo aur 10 min mein clarity le lo. | mixed | MOFU |
| CTA-DM-023 | DM mein 'WHATSAPP' likho — number share kar denge. | mixed | MOFU |
| CTA-DM-024 | Confusion clear karna hai? DM seedha karo. | hi-dominant | MOFU |
| CTA-DM-025 | DM 'HELP' — koi bhi sawaal, jawab pakka. | mixed | MOFU |
| CTA-DM-026 | Inbox mein 'OFFER' likho — current deal bhej denge. | mixed | BOFU |
| CTA-DM-027 | DM karo, hum bot nahi — real banda reply karega. | mixed | MOFU |
| CTA-DM-028 | DM mein apna pain likho, solution dikhayenge. | mixed | MOFU |
| CTA-DM-029 | Quick question? Slide into our DMs. | en-leaning | MOFU |
| CTA-DM-030 | DM 'RERA' — compliance ke saath kaise kaam karein. | mixed | MOFU |
| CTA-DM-031 | Inbox mein 'COMPARE' likho — plans compare bhej denge. | mixed | MOFU |
| CTA-DM-032 | DM karo apne time pe — hum wahin honge. | mixed | MOFU |
| CTA-DM-033 | DM mein 'CALL' likho — hum call back karenge. | mixed | MOFU |
| CTA-DM-034 | Doubt chhota ho ya bada — DM mein daalo. | hi-dominant | MOFU |
| CTA-DM-035 | DM 'MIGRATE' — purani sheet shift karwa denge. | mixed | BOFU |
| CTA-DM-036 | Inbox khol do, jo poochna hai poocho. | hi-dominant | MOFU |
| CTA-DM-037 | DM mein apni city batao — local insights denge. | mixed | TOFU |
| CTA-DM-038 | DM karo 'TRIAL' — signup link bhej denge. | mixed | BOFU |
| CTA-DM-039 | Yeh feature chahiye? DM 'chahiye' likho. | hi-dominant | MOFU |
| CTA-DM-040 | DM mein 'BOOK' likho — demo slot fix karte hain. | mixed | MOFU |
| CTA-DM-041 | Inbox open — 'CRM' type karo, baaki hum sambhalein. | mixed | MOFU |
| CTA-DM-042 | DM karo, judge koi nahi karega — sirf help. | mixed | MOFU |
| CTA-DM-043 | DM 'DASHBOARD' — analytics ka tour bhej denge. | mixed | MOFU |
| CTA-DM-044 | Apna requirement DM mein bhejo — custom quote. | mixed | BOFU |
| CTA-DM-045 | DM mein 'YES' likho — hum guide karenge step by step. | mixed | BOFU |
| CTA-DM-046 | Inbox mein 'PROPERTY' likho — inventory feature dekho. | mixed | MOFU |
| CTA-DM-047 | DM karo abhi — kal busy ho jaoge. | mixed | MOFU |
| CTA-DM-048 | DM 'LEADS' — lead tracking ka demo bhej denge. | mixed | MOFU |
| CTA-DM-049 | Inbox mein ek message — saara confusion khatam. | hi-dominant | MOFU |
| CTA-DM-050 | DM karo 'DEMO' aur 2 min ka video le lo. | mixed | MOFU |

## COMMUNITY — join the agent community

| ID | CTA | Lang | Stage |
|---|---|---|---|
| CTA-COMMUNITY-001 | Hamari agent community join karo — link bio mein. | mixed | TOFU |
| CTA-COMMUNITY-002 | Real estate agents ka group — judo aur seekho. | mixed | TOFU |
| CTA-COMMUNITY-003 | Community mein roz naye tips milte hain — join karo. | mixed | TOFU |
| CTA-COMMUNITY-004 | Akele mat struggle karo — community se juro. | hi-dominant | TOFU |
| CTA-COMMUNITY-005 | Join karo — shuruaati members mein aao. | mixed | TOFU |
| CTA-COMMUNITY-006 | Community mein apne sawaal poocho, jawab pao. | mixed | TOFU |
| CTA-COMMUNITY-007 | Free community — sirf agents ke liye. Join karo. | mixed | TOFU |
| CTA-COMMUNITY-008 | Bio link se community join karo abhi. | mixed | TOFU |
| CTA-COMMUNITY-009 | Community mein deals, tips, support — sab milega. | mixed | TOFU |
| CTA-COMMUNITY-010 | Pune agents ka apna group hai — join karo. | mr-dominant | TOFU |
| CTA-COMMUNITY-011 | Community join karo, networking free mein. | mixed | TOFU |
| CTA-COMMUNITY-012 | Doubt? Community mein poocho — koi na koi help karega. | mixed | TOFU |
| CTA-COMMUNITY-013 | Hamari WhatsApp community join karo — link bio. | mixed | TOFU |
| CTA-COMMUNITY-014 | Community mein weekly live sessions hote hain — join. | mixed | TOFU |
| CTA-COMMUNITY-015 | Agents ka community — competition nahi, collaboration. | mixed | TOFU |
| CTA-COMMUNITY-016 | Join karo aur top agents se seekho. | mixed | TOFU |
| CTA-COMMUNITY-017 | Community mein apni wins share karo. | mixed | TOFU |
| CTA-COMMUNITY-018 | Free join — community mein exclusive resources milte hain. | mixed | TOFU |
| CTA-COMMUNITY-019 | Real estate ki real baatein — community join karo. | mixed | TOFU |
| CTA-COMMUNITY-020 | Community se juro, akele growth slow hoti hai. | hi-dominant | TOFU |
| CTA-COMMUNITY-021 | Join karo — har sawaal ka jawab community mein. | mixed | TOFU |
| CTA-COMMUNITY-022 | Hamari community mein naye agents ka swagat hai. | hi-dominant | TOFU |
| CTA-COMMUNITY-023 | Community mein deals ka exchange bhi hota hai — join. | mixed | TOFU |
| CTA-COMMUNITY-024 | Bio link → community → instant access. | mixed | TOFU |
| CTA-COMMUNITY-025 | Community join karo aur updates pehle pao. | mixed | TOFU |
| CTA-COMMUNITY-026 | Mumbai, Pune, Delhi agents — sab ek community mein. | mixed | TOFU |
| CTA-COMMUNITY-027 | Community mein free templates aur scripts milte hain. | mixed | TOFU |
| CTA-COMMUNITY-028 | Join karo — yeh group sirf serious agents ke liye. | mixed | TOFU |
| CTA-COMMUNITY-029 | Community mein apni problem rakho, crowd se solution. | mixed | TOFU |
| CTA-COMMUNITY-030 | Free agent community — abhi join karo, link bio. | mixed | TOFU |
| CTA-COMMUNITY-031 | Community se juro aur referrals bhi kamao. | mixed | TOFU |
| CTA-COMMUNITY-032 | Hamari community mein roz value add hoti hai. | mixed | TOFU |
| CTA-COMMUNITY-033 | Join karo aur RERA updates miss mat karo. | mixed | TOFU |
| CTA-COMMUNITY-034 | Community mein top brokers ke case studies milte hain. | mixed | TOFU |
| CTA-COMMUNITY-035 | Agents ke liye safe space — community join karo. | mixed | TOFU |
| CTA-COMMUNITY-036 | Join karo, community mein hi demo bhi milta hai. | mixed | MOFU |
| CTA-COMMUNITY-037 | Community mein apna intro do — connections banao. | mixed | TOFU |
| CTA-COMMUNITY-038 | Free community access — sirf bio link se. | mixed | TOFU |
| CTA-COMMUNITY-039 | Community join karo, isolation se bahar aao. | mixed | TOFU |
| CTA-COMMUNITY-040 | Hamari community mein 100s of agents daily active. | mixed | TOFU |
| CTA-COMMUNITY-041 | Join karo aur sabse pehle naye features try karo. | mixed | MOFU |
| CTA-COMMUNITY-042 | Community mein weekly Q&A hota hai — join karo. | mixed | TOFU |
| CTA-COMMUNITY-043 | Real agents, real advice — community join karo. | mixed | TOFU |
| CTA-COMMUNITY-044 | Bio se community join karo, networking shuru. | mixed | TOFU |
| CTA-COMMUNITY-045 | Community mein apni city ka sub-group milega. | mixed | TOFU |
| CTA-COMMUNITY-046 | Join karo — yahan koi sales pressure nahi, sirf support. | mixed | TOFU |
| CTA-COMMUNITY-047 | Community mein hi free trial ka offer milta hai. | mixed | BOFU |
| CTA-COMMUNITY-048 | Agents ki community — judo, grow karo, jeeto. | mixed | TOFU |
| CTA-COMMUNITY-049 | Join karo aur expert mentors se direct baat karo. | mixed | TOFU |
| CTA-COMMUNITY-050 | Ek community, anginat connections — abhi join karo. | mixed | TOFU |

## LEAD-MAGNET — free downloads / resources

| ID | CTA | Lang | Stage |
|---|---|---|---|
| CTA-LEAD-MAGNET-001 | Free checklist download karo — link bio mein. | mixed | MOFU |
| CTA-LEAD-MAGNET-002 | 'Agency Setup Guide' free hai — comment 'GUIDE'. | mixed | MOFU |
| CTA-LEAD-MAGNET-003 | Free follow-up script template — DM 'SCRIPT'. | mixed | MOFU |
| CTA-LEAD-MAGNET-004 | Lead tracking sheet free download — bio link. | mixed | MOFU |
| CTA-LEAD-MAGNET-005 | Free Agency Leakage Audit — DM 'AUDIT'. | mixed | MOFU |
| CTA-LEAD-MAGNET-006 | Khata book template free hai — comment 'KHATA'. | mixed | MOFU |
| CTA-LEAD-MAGNET-007 | Free RERA compliance checklist — DM 'RERA'. | mixed | MOFU |
| CTA-LEAD-MAGNET-008 | 'AI Calling Starter Kit' free — comment 'AI'. | mixed | MOFU |
| CTA-LEAD-MAGNET-009 | Download free: agent ka daily routine planner. | mixed | MOFU |
| CTA-LEAD-MAGNET-010 | Free pricing comparison sheet — link bio mein. | mixed | MOFU |
| CTA-LEAD-MAGNET-011 | '5 CRM mistakes' PDF free — DM 'PDF'. | mixed | MOFU |
| CTA-LEAD-MAGNET-012 | Free lead-magnet: property sharing templates. | mixed | MOFU |
| CTA-LEAD-MAGNET-013 | Free guide download karo — agency scale kaise karein. | mixed | MOFU |
| CTA-LEAD-MAGNET-014 | Comment 'PLAN' aur free business plan template lo. | mixed | MOFU |
| CTA-LEAD-MAGNET-015 | Free WhatsApp lead-capture template — DM 'WA'. | mixed | MOFU |
| CTA-LEAD-MAGNET-016 | Download free: commission calculator sheet. | mixed | MOFU |
| CTA-LEAD-MAGNET-017 | Free e-book: 'Real estate CRM 101' — bio link. | mixed | MOFU |
| CTA-LEAD-MAGNET-018 | Comment 'CHECKLIST' — free onboarding checklist. | mixed | MOFU |
| CTA-LEAD-MAGNET-019 | Free template: team performance tracker. | mixed | MOFU |
| CTA-LEAD-MAGNET-020 | 'Follow-up calendar' free download — DM 'CAL'. | mixed | MOFU |
| CTA-LEAD-MAGNET-021 | Free guide: leads ko deals mein kaise badle. | mixed | MOFU |
| CTA-LEAD-MAGNET-022 | Download free: site-visit scheduling template. | mixed | MOFU |
| CTA-LEAD-MAGNET-023 | Free PDF: 'Pune real estate market 2026' — DM 'PUNE'. | mr-dominant | MOFU |
| CTA-LEAD-MAGNET-024 | Comment 'KIT' — free agent starter kit milega. | mixed | MOFU |
| CTA-LEAD-MAGNET-025 | Free download: buyer-property matching sheet. | mixed | MOFU |
| CTA-LEAD-MAGNET-026 | 'Cold call script' free hai — DM 'CALL'. | mixed | MOFU |
| CTA-LEAD-MAGNET-027 | Free resource: 50 follow-up message templates. | mixed | MOFU |
| CTA-LEAD-MAGNET-028 | Download karo free — agency KPI dashboard template. | mixed | MOFU |
| CTA-LEAD-MAGNET-029 | Free guide: spreadsheet se CRM tak — DM 'SHIFT'. | mixed | MOFU |
| CTA-LEAD-MAGNET-030 | Comment 'LEADS' — free lead scoring template. | mixed | MOFU |
| CTA-LEAD-MAGNET-031 | Free checklist: naye agent ko onboard kaise karein. | mixed | MOFU |
| CTA-LEAD-MAGNET-032 | Download free: monthly closing report template. | mixed | MOFU |
| CTA-LEAD-MAGNET-033 | Free e-book: 'Agency ki growth ke 7 steps' — bio. | mixed | MOFU |
| CTA-LEAD-MAGNET-034 | DM 'TEMPLATE' — free CRM setup template milega. | mixed | MOFU |
| CTA-LEAD-MAGNET-035 | Free guide: client objections kaise handle karein. | mixed | MOFU |
| CTA-LEAD-MAGNET-036 | Download free: property inventory tracker. | mixed | MOFU |
| CTA-LEAD-MAGNET-037 | Comment 'FREE' — agent toolkit bhej denge. | mixed | MOFU |
| CTA-LEAD-MAGNET-038 | Free PDF: 'WhatsApp leads organise kaise karein'. | mixed | MOFU |
| CTA-LEAD-MAGNET-039 | Free resource: demo se pehle ki tayari checklist. | mixed | MOFU |
| CTA-LEAD-MAGNET-040 | Download free: team commission split sheet. | mixed | MOFU |
| CTA-LEAD-MAGNET-041 | Free guide: AI follow-up calls setup — DM 'AI'. | mixed | MOFU |
| CTA-LEAD-MAGNET-042 | Comment 'GROW' — free agency growth playbook. | mixed | MOFU |
| CTA-LEAD-MAGNET-043 | Free template: weekly pipeline review format. | mixed | MOFU |
| CTA-LEAD-MAGNET-044 | Download free: lead source tracking sheet. | mixed | MOFU |
| CTA-LEAD-MAGNET-045 | Free guide: 2026 mein agent ko kya seekhna hai. | mixed | MOFU |
| CTA-LEAD-MAGNET-046 | DM 'BOOK' — free khata management e-book. | mixed | MOFU |
| CTA-LEAD-MAGNET-047 | Free checklist: data safe kaise rakhein (RBAC). | mixed | MOFU |
| CTA-LEAD-MAGNET-048 | Download free: client meeting prep template. | mixed | MOFU |
| CTA-LEAD-MAGNET-049 | Free resource: deal closing checklist — bio link. | mixed | MOFU |
| CTA-LEAD-MAGNET-050 | Comment 'START' aur free quick-start guide lo. | mixed | MOFU |

## FOLLOW — grow the audience

| ID | CTA | Lang | Stage |
|---|---|---|---|
| CTA-FOLLOW-001 | Follow karo aur roz ek agent-tip pao. | mixed | TOFU |
| CTA-FOLLOW-002 | Real estate hacks chahiye? Follow @realestateflow. | mixed | TOFU |
| CTA-FOLLOW-003 | Follow karo — kal ka tip miss mat karna. | mixed | TOFU |
| CTA-FOLLOW-004 | Aise reels pasand hain? Follow kar lo. | mixed | TOFU |
| CTA-FOLLOW-005 | Follow @realestateflow for daily CRM gyaan. | mixed | TOFU |
| CTA-FOLLOW-006 | Follow karo, agency growth ke tips free mein. | mixed | TOFU |
| CTA-FOLLOW-007 | Naye agent ho? Follow karo, seekhte raho. | mixed | TOFU |
| CTA-FOLLOW-008 | Follow + bell on — koi update miss na ho. | mixed | TOFU |
| CTA-FOLLOW-009 | Yeh helpful tha? Follow karke aur pao. | mixed | TOFU |
| CTA-FOLLOW-010 | Follow karo — har din real estate ki ek baat. | mixed | TOFU |
| CTA-FOLLOW-011 | Agent banna serious hai? Follow @realestateflow. | mixed | TOFU |
| CTA-FOLLOW-012 | Follow kar lo, content roz aata hai. | mixed | TOFU |
| CTA-FOLLOW-013 | Aur tips chahiye? Bas follow karo. | hi-dominant | TOFU |
| CTA-FOLLOW-014 | Follow karo aur apni agency 10x karo. | mixed | TOFU |
| CTA-FOLLOW-015 | Daily real estate tips ke liye follow karo. | mixed | TOFU |
| CTA-FOLLOW-016 | Follow @realestateflow — Hinglish mein gyaan. | mixed | TOFU |
| CTA-FOLLOW-017 | Follow karo, hum tumhe organised banayenge. | mixed | TOFU |
| CTA-FOLLOW-018 | Yeh page tumhare kaam ka hai — follow karo. | mixed | TOFU |
| CTA-FOLLOW-019 | Follow + save = perfect combo, bhai. | mixed | TOFU |
| CTA-FOLLOW-020 | Follow karo Pune real estate updates ke liye. | mr-dominant | TOFU |
| CTA-FOLLOW-021 | Sirf agents ke liye content — follow karo. | mixed | TOFU |
| CTA-FOLLOW-022 | Follow karo aur competitor se aage raho. | mixed | TOFU |
| CTA-FOLLOW-023 | Pasand aaya? Follow karo, aur aayega. | hi-dominant | TOFU |
| CTA-FOLLOW-024 | Follow @realestateflow — CRM, leads, growth. | mixed | TOFU |
| CTA-FOLLOW-025 | Follow karo, demo updates pehle pao. | mixed | MOFU |
| CTA-FOLLOW-026 | Naye features ki khabar? Follow kar lo. | mixed | MOFU |
| CTA-FOLLOW-027 | Follow karo — yeh page tumhe miss nahi karna. | mixed | TOFU |
| CTA-FOLLOW-028 | Roz seekho, roz badho — follow karo. | hi-dominant | TOFU |
| CTA-FOLLOW-029 | Follow @realestateflow aur tip-of-the-day pao. | mixed | TOFU |
| CTA-FOLLOW-030 | Follow karo agar deals close karna serious hai. | mixed | TOFU |
| CTA-FOLLOW-031 | Yeh content free hai — bas follow karo. | mixed | TOFU |
| CTA-FOLLOW-032 | Follow karo, agency ki growth ka roadmap milega. | mixed | TOFU |
| CTA-FOLLOW-033 | Daily Hinglish real estate tips — follow karo. | mixed | TOFU |
| CTA-FOLLOW-034 | Follow + comment = aur personalised content. | mixed | TOFU |
| CTA-FOLLOW-035 | Follow karo, hum tumhari journey mein saath hain. | mixed | TOFU |
| CTA-FOLLOW-036 | Mumbai agents — follow @realestateflow. | mixed | TOFU |
| CTA-FOLLOW-037 | Follow karo aur AI calling tips miss mat karo. | mixed | MOFU |
| CTA-FOLLOW-038 | Yeh reel useful laga? Follow karke loyalty dikhao. | mixed | TOFU |
| CTA-FOLLOW-039 | Follow karo — knowledge free, growth tumhari. | mixed | TOFU |
| CTA-FOLLOW-040 | Real estate ka real content — follow @realestateflow. | mixed | TOFU |
| CTA-FOLLOW-041 | Follow karo, kal phir milenge naye tip ke saath. | mixed | TOFU |
| CTA-FOLLOW-042 | Smart agent? Follow karo smart content ke liye. | mixed | TOFU |
| CTA-FOLLOW-043 | Follow + share = community grow karega. | mixed | TOFU |
| CTA-FOLLOW-044 | Follow karo aur khata/commission tips pao. | mixed | TOFU |
| CTA-FOLLOW-045 | Yeh page agents ke liye gold hai — follow karo. | mixed | TOFU |
| CTA-FOLLOW-046 | Follow @realestateflow before tum scroll karo. | mixed | TOFU |
| CTA-FOLLOW-047 | Follow karo, har reel mein ek naya hack. | mixed | TOFU |
| CTA-FOLLOW-048 | Agency owner ho? Follow karo, strategy roz milegi. | mixed | TOFU |
| CTA-FOLLOW-049 | Follow karo aur 2026 ka best agent bano. | mixed | TOFU |
| CTA-FOLLOW-050 | Tap follow — aur is tarah ke tips ka silsila shuru. | mixed | TOFU |

---

## Counts

| Category | Count |
|---|---|
| DEMO | 50 |
| WHATSAPP | 50 |
| TRIAL | 50 |
| COMMENT | 50 |
| SHARE | 50 |
| SAVE | 50 |
| DM | 50 |
| COMMUNITY | 50 |
| LEAD-MAGNET | 50 |
| FOLLOW | 50 |
| **TOTAL** | **500** |
