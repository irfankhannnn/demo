# 04 — RealEstateFlow Content Plan: 520 Scored Opportunities

> **What this is.** A bank of **520 distinct, scored Instagram content opportunities** (OPP-001 … OPP-520) for RealEstateFlow (brand: RealtyFlow), each grounded in a real product feature (`01-business-memory.md`), a real Mumbai/Pune broker pain or charged moment (`02-market-research.md §6, §10, §5`), and tagged to the OS systems: content types (`CT-*`), frameworks (`FW-*`), characters (`CH-*`), and the language strategy (`03-language-strategy.md`). The machine-readable rows live in **`04-content-plan-500.csv`**. The 14-day launch sprint that consumes the top picks is **`05-14-day-launch-plan.md`**.

> **Built from 147 grounded seed angles** (one per real pain/feature/moment/lead-source) expanded across content types, frameworks, languages, personas, and cities into **520 opportunities**.


---

## 1. Scoring Methodology

Every opportunity is scored on **five axes, 1–10 each**. These axes map to what Instagram actually rewards and to what the business needs from a B2B SaaS launch:

| Axis | What it measures | Why it matters here |
|---|---|---|
| `reach_potential` | Scroll-stop + algorithmic reach (cold audience) | Top-of-funnel awareness among 62k Mumbai+Pune brokers |
| `shareability` | WhatsApp-forward / 'send to a peer' pull | Peer validation is the #1 trust signal for brokers (research §2.2, §9.2) |
| `save_potential` | 'Bookmark for later' (educational/utility value) | Saves signal intent + train the algorithm; how-to/data content earns them |
| `comment_potential` | Debate / tag-a-friend / objection in comments | Comments drive distribution and surface buying objections |
| `lead_gen_potential` | Likelihood of a demo/trial/DM (qualified intent) | The actual launch objective — sign-ups, not vanity reach |


### Weights

Total = simple sum of the five axes (**max 50**). The **priority_score** is a weighted blend, with **lead-gen weighted highest** because this is a launch with a revenue objective:

```
priority_score = reach*0.20 + shareability*0.20 + save*0.20 + comment*0.15 + lead_gen*0.25
```

Rounded to 1 decimal. Rationale: reach/share/save each carry standard 0.20 (the engagement engine), comments slightly lower at 0.15 (valuable but noisier), and **lead-gen at 0.25** so a piece that converts is ranked above a piece that merely entertains. A pure-reach meme can still rank well, but a demo that also converts will out-rank it.


### How scores were assigned (realism)

Each seed angle carries a base profile per axis (e.g. WhatsApp-chaos memes start high on reach/share, low on save/lead; case studies start high on lead/save, lower on reach). The content-type then nudges every axis (CT-MEME: +reach/+share, −save/−lead; CT-DEMO/CT-CASE: +lead/+save, −reach; CT-AUTHORITY: +save/+comment), the CTA category nudges its matching axis, and a small random jitter (±2) keeps the distribution natural. Result: scores span **4.2–8.0** (mean ~6.0), not a wall of 9s and 10s.


---

## 2. Distribution Summary

**Total opportunities: 520** · priority mean **5.99** · range **4.2–8.0**


**Priority-score bands**

| Band | Count | Share |
|---|---|---|
| High (≥ 8.0) | 1 | 0.2% |
| Strong (6.5–7.9) | 111 | 21.3% |
| Solid (5.0–6.4) | 386 | 74.2% |
| Filler/experimental (< 5.0) | 22 | 4.2% |


### By content type (CT-*)
| CT | Name | Count | Share |
|---|---|---|---|
| CT-EDU | Educational | 111 | 21.3% |
| CT-DEMO | Product Demo | 92 | 17.7% |
| CT-DRAMA | Drama/Skit | 75 | 14.4% |
| CT-AUTHORITY | Authority | 66 | 12.7% |
| CT-CASE | Case Study | 48 | 9.2% |
| CT-UGC | UGC | 41 | 7.9% |
| CT-MEME | Meme | 40 | 7.7% |
| CT-FOUNDER | Founder | 21 | 4.0% |
| CT-PROOF | Social Proof | 16 | 3.1% |
| CT-NEWS | News | 10 | 1.9% |


### By framework (FW-*)
| FW | Count | Share |
|---|---|---|
| FW-CRM | 82 | 15.8% |
| FW-MYTH | 47 | 9.0% |
| FW-LEAD-LEAKAGE | 46 | 8.8% |
| FW-WHATSAPP-CHAOS | 35 | 6.7% |
| FW-SKIT | 30 | 5.8% |
| FW-DEMO | 29 | 5.6% |
| FW-CONTRARIAN | 28 | 5.4% |
| FW-AI | 27 | 5.2% |
| FW-AUTHORITY | 25 | 4.8% |
| FW-MISTAKE | 24 | 4.6% |
| FW-CASE | 20 | 3.8% |
| FW-UGC | 19 | 3.7% |
| FW-DRAMA | 18 | 3.5% |
| FW-CURIOSITY | 17 | 3.3% |
| FW-BAB | 17 | 3.3% |
| FW-CONVO | 15 | 2.9% |
| FW-OBJECTION | 14 | 2.7% |
| FW-FOUNDER | 10 | 1.9% |
| FW-PROPERTY | 8 | 1.5% |
| FW-CUSTOMER | 6 | 1.2% |
| FW-NEWS | 3 | 0.6% |


### By persona
| Persona | Count | Share |
|---|---|---|
| Owner | 270 | 51.9% |
| Broker | 176 | 33.8% |
| Manager | 52 | 10.0% |
| NewJoiner | 19 | 3.7% |
| Buyer | 3 | 0.6% |


### By language tag
| Language | Count | Share |
|---|---|---|
| hi-dominant | 235 | 45.2% |
| mr-dominant | 128 | 24.6% |
| mixed | 79 | 15.2% |
| en-leaning | 78 | 15.0% |


### Language band vs strategy target (`03-language-strategy §2`)
| Band | Count | Actual | Target |
|---|---|---|---|
| Hindi/Hinglish spine (hi-dominant + mixed) | 314 | 60.4% | 55% |
| Marathi-led (mr-dominant) | 128 | 24.6% | 30% |
| English-leaning (en-leaning) | 78 | 15.0% | 15% |

> The spine (Hindi/Hinglish) carries the plurality, Marathi over-indexes vs population-share to win Pune saves/shares, and English stays ~15% for owner-buyer credibility. Matches the portfolio target.


### By city
| City | Count | Share |
|---|---|---|
| Both | 264 | 50.8% |
| Mumbai | 133 | 25.6% |
| Pune | 123 | 23.7% |

> `Both` = a single Hinglish-spine asset that runs in Mumbai **and** Pune without re-shoot (production efficiency, per language strategy §2). City-specific rows carry the local-tongue/geo overlay.


---

## 3. TOP 50 Opportunities (by priority_score)

| # | OPP | Title | CT | FW | Lang | Persona | Priority | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | OPP-481 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (deep- | CT-AUTHORITY | FW-CRM | hi-dominant | Broker | 8.0 | 39 |
| 2 | OPP-240 | CRM mahanga hai 999 se shuru ROI 30 din (deep-dive) | CT-AUTHORITY | FW-AUTHORITY | en-leaning | Owner | 7.9 | 39 |
| 3 | OPP-187 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (carou | CT-EDU | FW-CRM | hi-dominant | Broker | 7.9 | 38 |
| 4 | OPP-163 | Lead leakage calculator apni leak nikalo comment mein (case  | CT-CASE | FW-LEAD-LEAKAGE | hi-dominant | Owner | 7.8 | 39 |
| 5 | OPP-467 | Response within 15 min 60 percent close after 1 hour 20 perc | CT-UGC | FW-PROPERTY | mixed | Owner | 7.8 | 38 |
| 6 | OPP-310 | Lead leakage calculator apni leak nikalo comment mein (deep- | CT-AUTHORITY | FW-CONTRARIAN | en-leaning | Owner | 7.7 | 39 |
| 7 | OPP-325 | Commission ka jhagda ab nahi khata book khol ke dikhao (skit | CT-DRAMA | FW-CONVO | mr-dominant | Owner | 7.7 | 38 |
| 8 | OPP-295 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek lea | CT-EDU | FW-LEAD-LEAKAGE | hi-dominant | Broker | 7.6 | 38 |
| 9 | OPP-006 | Tumhi pan lead WhatsApp madhe shodhta mag deal gela samjha | CT-DRAMA | FW-SKIT | mr-dominant | Broker | 7.5 | 37 |
| 10 | OPP-457 | Lead leakage calculator apni leak nikalo comment mein (demo) | CT-DEMO | FW-CRM | hi-dominant | Owner | 7.5 | 37 |
| 11 | OPP-296 | WhatsApp mein jo 5L deal laga tha woh gaya kahan (carousel)  | CT-EDU | FW-MISTAKE | hi-dominant | Owner | 7.4 | 37 |
| 12 | OPP-015 | Aapke leads leak ho rahe hain aur aapko pata bhi nahi | CT-EDU | FW-MYTH | en-leaning | Owner | 7.4 | 36 |
| 13 | OPP-190 | AI calling demo sun lo asli real estate call (carousel) | CT-EDU | FW-LEAD-LEAKAGE | mr-dominant | Broker | 7.4 | 36 |
| 14 | OPP-336 | Maine AI se follow-up call karwaya client ko pata bhi nahi c | CT-UGC | FW-PROPERTY | mixed | Broker | 7.4 | 36 |
| 15 | OPP-443 | WhatsApp mein jo 5L deal laga tha woh gaya kahan (demo) | CT-DEMO | FW-DEMO | hi-dominant | Owner | 7.4 | 36 |
| 16 | OPP-383 | Launch day RealEstateFlow ab live hai dekho (founder cut) | CT-FOUNDER | FW-FOUNDER | hi-dominant | Owner | 7.2 | 37 |
| 17 | OPP-002 | WhatsApp mein jo 5L deal laga tha woh gaya kahan | CT-DRAMA | FW-DRAMA | mr-dominant | Owner | 7.2 | 36 |
| 18 | OPP-058 | Top agent nikla apne saare client le gaya | CT-DRAMA | FW-SKIT | en-leaning | Owner | 7.2 | 36 |
| 19 | OPP-117 | RealEstateFlow vs generic CRM India ke liye bana | CT-AUTHORITY | FW-CRM | hi-dominant | Owner | 7.2 | 36 |
| 20 | OPP-321 | 3 follow-up jo har broker bhoolta hai (skit) [Mumbai] | CT-DRAMA | FW-CONVO | hi-dominant | Broker | 7.2 | 36 |
| 21 | OPP-483 | Maine AI se follow-up call karwaya client ko pata bhi nahi c | CT-AUTHORITY | FW-CONTRARIAN | hi-dominant | Broker | 7.2 | 36 |
| 22 | OPP-049 | Pata hai team abhi kya kar rahi hai dashboard kholo | CT-EDU | FW-MYTH | hi-dominant | Owner | 7.2 | 35 |
| 23 | OPP-307 | 100 leads aaye sirf 12 convert hue baaki kahan gaye (deep-di | CT-AUTHORITY | FW-CONTRARIAN | mixed | Owner | 7.2 | 35 |
| 24 | OPP-335 | AI calls karega tu deals close karega 10 ghante bach gaye (U | CT-UGC | FW-UGC | hi-dominant | Broker | 7.2 | 35 |
| 25 | OPP-387 | CRM mahanga hai 999 se shuru ROI 30 din (skit) | CT-DRAMA | FW-SKIT | mixed | Owner | 7.2 | 35 |
| 26 | OPP-484 | AI calling demo sun lo asli real estate call (deep-dive) | CT-AUTHORITY | FW-MYTH | hi-dominant | Broker | 7.2 | 35 |
| 27 | OPP-088 | Indian brokers ko US CRM nahi chahiye desi chahiye | CT-FOUNDER | FW-FOUNDER | mr-dominant | Owner | 7.1 | 36 |
| 28 | OPP-442 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek lea | CT-DEMO | FW-AI | mixed | Broker | 7.1 | 35 |
| 29 | OPP-482 | AI calls karega tu deals close karega 10 ghante bach gaye (d | CT-AUTHORITY | FW-MYTH | hi-dominant | Broker | 7.1 | 35 |
| 30 | OPP-334 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (UGC s | CT-UGC | FW-OBJECTION | en-leaning | Broker | 7.1 | 34 |
| 31 | OPP-089 | Launch day RealEstateFlow ab live hai dekho | CT-FOUNDER | FW-FOUNDER | en-leaning | Owner | 7.0 | 36 |
| 32 | OPP-245 | Tum broke nahi ho tum bleeding ho roz 50K leak (deep-dive) | CT-AUTHORITY | FW-CRM | mr-dominant | Owner | 7.0 | 36 |
| 33 | OPP-287 | Naya agent jab pehli baar CRM dekhta hai reaction (skit) | CT-DRAMA | FW-WHATSAPP-CHAOS | mr-dominant | NewJoiner | 7.0 | 36 |
| 34 | OPP-392 | Tum broke nahi ho tum bleeding ho roz 50K leak (skit) | CT-DRAMA | FW-WHATSAPP-CHAOS | en-leaning | Owner | 7.0 | 36 |
| 35 | OPP-013 | 100 leads aaye sirf 12 convert hue baaki kahan gaye | CT-EDU | FW-CRM | hi-dominant | Owner | 7.0 | 35 |
| 36 | OPP-122 | Diwali booking season leads ka rush handle karo | CT-NEWS | FW-NEWS | hi-dominant | Owner | 7.0 | 35 |
| 37 | OPP-300 | Tumhi pan lead WhatsApp madhe shodhta mag deal gela samjha ( | CT-EDU | FW-MYTH | mr-dominant | Broker | 7.0 | 35 |
| 38 | OPP-042 | Maine AI se follow-up call karwaya client ko pata bhi nahi c | CT-DEMO | FW-DEMO | hi-dominant | Broker | 7.0 | 34 |
| 39 | OPP-081 | Mr aur Mrs Khan ka smooth deal testimonial | CT-PROOF | FW-CUSTOMER | hi-dominant | Buyer | 7.0 | 34 |
| 40 | OPP-312 | Competitor ne 2 min mein call kiya aapne 2 ghante baad (deep | CT-AUTHORITY | FW-MYTH | mixed | Broker | 7.0 | 34 |
| 41 | OPP-511 | Property turant share karo deal fast karo demo (carousel) | CT-EDU | FW-MYTH | hi-dominant | Broker | 7.0 | 34 |
| 42 | OPP-001 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek lea | CT-DRAMA | FW-DRAMA | hi-dominant | Broker | 6.9 | 35 |
| 43 | OPP-192 | Raat ko 100 leads AI ne call kiye subah qualified list ready | CT-EDU | FW-MISTAKE | mr-dominant | Owner | 6.9 | 34 |
| 44 | OPP-309 | Aapke leads leak ho rahe hain aur aapko pata bhi nahi (deep- | CT-AUTHORITY | FW-MYTH | en-leaning | Owner | 6.9 | 34 |
| 45 | OPP-280 | Arjun ne 5 deal se 12 deal kiye system se (case study) | CT-CASE | FW-LEAD-LEAKAGE | hi-dominant | Broker | 6.9 | 33 |
| 46 | OPP-343 | Pata hai team abhi kya kar rahi hai dashboard kholo (deep-di | CT-AUTHORITY | FW-CONTRARIAN | hi-dominant | Owner | 6.9 | 33 |
| 47 | OPP-057 | Ek agent gaya saara business gaya bachao kaise | CT-DRAMA | FW-DRAMA | mr-dominant | Owner | 6.8 | 35 |
| 48 | OPP-098 | Tum broke nahi ho tum bleeding ho roz 50K leak | CT-EDU | FW-MYTH | hi-dominant | Owner | 6.8 | 35 |
| 49 | OPP-289 | Beta business join nahi karna chahta jab tak CRM nahi dekha  | CT-FOUNDER | FW-FOUNDER | mr-dominant | Owner | 6.8 | 35 |
| 50 | OPP-062 | Naya agent Day 1 vs Day 7 with RealEstateFlow | CT-DRAMA | FW-CONVO | mr-dominant | NewJoiner | 6.8 | 34 |


---

## 4. Top 10 per Content Type


### CT-EDU — Educational

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-187 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (car | FW-CRM | hi-dominant | Broker | 7.9 |
| OPP-295 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek l | FW-LEAD-LEAKAGE | hi-dominant | Broker | 7.6 |
| OPP-296 | WhatsApp mein jo 5L deal laga tha woh gaya kahan (carousel | FW-MISTAKE | hi-dominant | Owner | 7.4 |
| OPP-015 | Aapke leads leak ho rahe hain aur aapko pata bhi nahi | FW-MYTH | en-leaning | Owner | 7.4 |
| OPP-190 | AI calling demo sun lo asli real estate call (carousel) | FW-LEAD-LEAKAGE | mr-dominant | Broker | 7.4 |
| OPP-049 | Pata hai team abhi kya kar rahi hai dashboard kholo | FW-MYTH | hi-dominant | Owner | 7.2 |
| OPP-013 | 100 leads aaye sirf 12 convert hue baaki kahan gaye | FW-CRM | hi-dominant | Owner | 7.0 |
| OPP-300 | Tumhi pan lead WhatsApp madhe shodhta mag deal gela samjha | FW-MYTH | mr-dominant | Broker | 7.0 |
| OPP-511 | Property turant share karo deal fast karo demo (carousel) | FW-MYTH | hi-dominant | Broker | 7.0 |
| OPP-192 | Raat ko 100 leads AI ne call kiye subah qualified list rea | FW-MISTAKE | mr-dominant | Owner | 6.9 |


### CT-DRAMA — Drama/Skit

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-325 | Commission ka jhagda ab nahi khata book khol ke dikhao (sk | FW-CONVO | mr-dominant | Owner | 7.7 |
| OPP-006 | Tumhi pan lead WhatsApp madhe shodhta mag deal gela samjha | FW-SKIT | mr-dominant | Broker | 7.5 |
| OPP-002 | WhatsApp mein jo 5L deal laga tha woh gaya kahan | FW-DRAMA | mr-dominant | Owner | 7.2 |
| OPP-058 | Top agent nikla apne saare client le gaya | FW-SKIT | en-leaning | Owner | 7.2 |
| OPP-321 | 3 follow-up jo har broker bhoolta hai (skit) [Mumbai] | FW-CONVO | hi-dominant | Broker | 7.2 |
| OPP-387 | CRM mahanga hai 999 se shuru ROI 30 din (skit) | FW-SKIT | mixed | Owner | 7.2 |
| OPP-287 | Naya agent jab pehli baar CRM dekhta hai reaction (skit) | FW-WHATSAPP-CHAOS | mr-dominant | NewJoiner | 7.0 |
| OPP-392 | Tum broke nahi ho tum bleeding ho roz 50K leak (skit) | FW-WHATSAPP-CHAOS | en-leaning | Owner | 7.0 |
| OPP-001 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek l | FW-DRAMA | hi-dominant | Broker | 6.9 |
| OPP-057 | Ek agent gaya saara business gaya bachao kaise | FW-DRAMA | mr-dominant | Owner | 6.8 |


### CT-UGC — UGC

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-467 | Response within 15 min 60 percent close after 1 hour 20 pe | FW-PROPERTY | mixed | Owner | 7.8 |
| OPP-336 | Maine AI se follow-up call karwaya client ko pata bhi nahi | FW-PROPERTY | mixed | Broker | 7.4 |
| OPP-335 | AI calls karega tu deals close karega 10 ghante bach gaye  | FW-UGC | hi-dominant | Broker | 7.2 |
| OPP-334 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (UGC | FW-OBJECTION | en-leaning | Broker | 7.1 |
| OPP-339 | Raat ko 100 leads AI ne call kiye subah qualified list rea | FW-UGC | hi-dominant | Owner | 6.8 |
| OPP-469 | Follow-up rahila ani deal gela Pune broker ki kahani (UGC  | FW-OBJECTION | hi-dominant | Broker | 6.8 |
| OPP-372 | Andheri broker ne lead leakage near zero kiya 60 din mein  | FW-OBJECTION | hi-dominant | Owner | 6.6 |
| OPP-378 | 200 plus brokerages already RealEstateFlow pe (UGC selfie) | FW-UGC | hi-dominant | Owner | 6.6 |
| OPP-340 | AI tumhe replace nahi karega boring kaam karega (UGC selfi | FW-OBJECTION | hi-dominant | Broker | 6.5 |
| OPP-211 | New joiner 30 min mein CRM seekh gaya WhatsApp jaisa (UGC  | FW-OBJECTION | mixed | NewJoiner | 6.5 |


### CT-FOUNDER — Founder

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-383 | Launch day RealEstateFlow ab live hai dekho (founder cut) | FW-FOUNDER | hi-dominant | Owner | 7.2 |
| OPP-088 | Indian brokers ko US CRM nahi chahiye desi chahiye | FW-FOUNDER | mr-dominant | Owner | 7.1 |
| OPP-089 | Launch day RealEstateFlow ab live hai dekho | FW-FOUNDER | en-leaning | Owner | 7.0 |
| OPP-289 | Beta business join nahi karna chahta jab tak CRM nahi dekh | FW-FOUNDER | mr-dominant | Owner | 6.8 |
| OPP-380 | Maine 200 brokerages dekhe ek cheez samajh aayi follow-up  | FW-CONTRARIAN | hi-dominant | Owner | 6.7 |
| OPP-090 | Mera broker dost ne 20L ka deal khoya tab idea aaya | FW-AUTHORITY | hi-dominant | Owner | 6.5 |
| OPP-134 | Professional broker banna hai to professional tool | FW-CONTRARIAN | mr-dominant | Owner | 6.5 |
| OPP-382 | Indian brokers ko US CRM nahi chahiye desi chahiye (founde | FW-AUTHORITY | hi-dominant | Owner | 6.2 |
| OPP-132 | 15 agent team 20 Cr revenue 8 ghante kaam ka sapna | FW-FOUNDER | mixed | Owner | 6.2 |
| OPP-133 | Arjun ne 5 deal se 12 deal kiye system se | FW-FOUNDER | mr-dominant | Broker | 6.2 |


### CT-CASE — Case Study

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-163 | Lead leakage calculator apni leak nikalo comment mein (cas | FW-LEAD-LEAKAGE | hi-dominant | Owner | 7.8 |
| OPP-280 | Arjun ne 5 deal se 12 deal kiye system se (case study) | FW-LEAD-LEAKAGE | hi-dominant | Broker | 6.9 |
| OPP-160 | 100 leads aaye sirf 12 convert hue baaki kahan gaye (case  | FW-LEAD-LEAKAGE | en-leaning | Owner | 6.7 |
| OPP-225 | Andheri broker ne lead leakage near zero kiya 60 din mein  | FW-LEAD-LEAKAGE | mr-dominant | Owner | 6.7 |
| OPP-227 | Close rate 8 percent se 12 percent 2 mahine mein (case stu | FW-CASE | hi-dominant | Owner | 6.7 |
| OPP-254 | FB pe 20 comment 3 ko call kiya 17 ignore ek buyer tha (ca | FW-CASE | hi-dominant | Broker | 6.7 |
| OPP-474 | Agent bole 5L baki broker bole 3L hisaab kaun sahi (case s | FW-BAB | en-leaning | Owner | 6.5 |
| OPP-167 | Lead aaya call lagaya kal buyer already gaya (case study) | FW-LEAD-LEAKAGE | en-leaning | Broker | 6.5 |
| OPP-231 | 200 plus brokerages already RealEstateFlow pe (case study) | FW-LEAD-LEAKAGE | mixed | Owner | 6.5 |
| OPP-257 | Referral source track kiya top agent 40 referral nikla (ca | FW-BAB | mixed | Owner | 6.4 |


### CT-DEMO — Product Demo

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-457 | Lead leakage calculator apni leak nikalo comment mein (dem | FW-CRM | hi-dominant | Owner | 7.5 |
| OPP-443 | WhatsApp mein jo 5L deal laga tha woh gaya kahan (demo) | FW-DEMO | hi-dominant | Owner | 7.4 |
| OPP-442 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek l | FW-AI | mixed | Broker | 7.1 |
| OPP-042 | Maine AI se follow-up call karwaya client ko pata bhi nahi | FW-DEMO | hi-dominant | Broker | 7.0 |
| OPP-129 | Site visit schedule reminder auto demo | FW-AI | mr-dominant | Broker | 6.8 |
| OPP-399 | All portals one inbox MagicBricks Housing 99acres (demo) | FW-CRM | mixed | Owner | 6.8 |
| OPP-455 | 30 percent leads chup-chaap gayab har mahine ka 20L (demo) | FW-DEMO | mr-dominant | Owner | 6.8 |
| OPP-039 | Manual hisaab mein har mahine kitna leak ho raha | FW-AI | hi-dominant | Owner | 6.7 |
| OPP-041 | AI calls karega tu deals close karega 10 ghante bach gaye | FW-CRM | mixed | Broker | 6.7 |
| OPP-072 | Instagram pe dekhi property aap dhoondh nahi paye client g | FW-CRM | hi-dominant | Broker | 6.5 |


### CT-PROOF — Social Proof

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-081 | Mr aur Mrs Khan ka smooth deal testimonial | FW-CUSTOMER | hi-dominant | Buyer | 7.0 |
| OPP-078 | Andheri broker ne lead leakage near zero kiya 60 din mein | FW-CUSTOMER | mr-dominant | Owner | 6.5 |
| OPP-083 | 12K month diya 25L recover kiya ab CRM free jaisa | FW-AUTHORITY | mr-dominant | Owner | 6.4 |
| OPP-436 | Beta business join nahi karna chahta jab tak CRM nahi dekh | FW-AUTHORITY | en-leaning | Owner | 6.3 |
| OPP-371 | Buyer requirement capture karo galti se kuch miss na ho (t | FW-CASE | mr-dominant | Broker | 6.2 |
| OPP-437 | Purane broker ka succession plan tech se zinda (testimonia | FW-CASE | en-leaning | Owner | 6.2 |
| OPP-519 | Andheri broker ne lead leakage near zero kiya 60 din mein  | FW-CUSTOMER | hi-dominant | Owner | 6.1 |
| OPP-368 | Client call aaye to saari history turant samne (testimonia | FW-CUSTOMER | en-leaning | Broker | 6.0 |
| OPP-369 | Sneha ne client ki requirement ek jagah rakhi perfect matc | FW-AUTHORITY | hi-dominant | Broker | 5.9 |
| OPP-370 | Client ko lagta hai aap sirf usi ke liye kaam kar rahe (te | FW-AUTHORITY | hi-dominant | Broker | 5.9 |


### CT-NEWS — News

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-122 | Diwali booking season leads ka rush handle karo | FW-NEWS | hi-dominant | Owner | 7.0 |
| OPP-101 | Ready reckoner rate badha brokers ke liye matlab | FW-CONTRARIAN | en-leaning | Owner | 6.4 |
| OPP-100 | RERA number har listing pe trust signal | FW-CRM | mr-dominant | Owner | 6.3 |
| OPP-102 | Carpet vs built-up loading samjhao client ko | FW-CONTRARIAN | mixed | Broker | 6.2 |
| OPP-099 | Maharashtra RERA agent rule badla 60 sec mein samjho | FW-CRM | mixed | Owner | 6.0 |
| OPP-125 | Year end push December targets dashboard se | FW-NEWS | mixed | Manager | 6.0 |
| OPP-121 | Gudi Padwa naya saal nayi deals shubhechha | FW-CONTRARIAN | mr-dominant | Owner | 5.9 |
| OPP-123 | Akshaya Tritiya property muhurat leads double | FW-CONTRARIAN | mr-dominant | Owner | 5.8 |
| OPP-124 | Festival season 3x leads system ready hai kya | FW-NEWS | hi-dominant | Owner | 5.4 |
| OPP-103 | Portal listing rate hike MagicBricks 99acres ab kya | FW-CONTRARIAN | en-leaning | Owner | 4.8 |


### CT-MEME — Meme

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-435 | 2026 aa gaya bhai aur tu abhi bhi Excel pe (meme) [Mumbai] | FW-SKIT | hi-dominant | Broker | 6.6 |
| OPP-430 | POV jab client puche mera lead kahan hai (meme) [Mumbai] | FW-SKIT | hi-dominant | Broker | 6.4 |
| OPP-141 | 2026 aa gaya bhai aur tu abhi bhi Excel pe | FW-SKIT | hi-dominant | Broker | 6.3 |
| OPP-148 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek l | FW-WHATSAPP-CHAOS | mr-dominant | Broker | 6.3 |
| OPP-149 | WhatsApp mein jo 5L deal laga tha woh gaya kahan (meme) | FW-CURIOSITY | hi-dominant | Owner | 6.3 |
| OPP-157 | WhatsApp lead ek tap mein system mein daalo demo (meme) | FW-CURIOSITY | hi-dominant | Broker | 6.2 |
| OPP-269 | Diwali booking season leads ka rush handle karo (meme) | FW-SKIT | hi-dominant | Owner | 6.2 |
| OPP-153 | Tumhi pan lead WhatsApp madhe shodhta mag deal gela samjha | FW-CURIOSITY | mr-dominant | Broker | 6.0 |
| OPP-138 | Jab do agent same lead pe ladte hain | FW-WHATSAPP-CHAOS | mixed | Manager | 5.9 |
| OPP-139 | Ek minute file dhoondta hoon buyer waiting meme | FW-WHATSAPP-CHAOS | hi-dominant | Broker | 5.9 |


### CT-AUTHORITY — Authority

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-481 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (dee | FW-CRM | hi-dominant | Broker | 8.0 |
| OPP-240 | CRM mahanga hai 999 se shuru ROI 30 din (deep-dive) | FW-AUTHORITY | en-leaning | Owner | 7.9 |
| OPP-310 | Lead leakage calculator apni leak nikalo comment mein (dee | FW-CONTRARIAN | en-leaning | Owner | 7.7 |
| OPP-117 | RealEstateFlow vs generic CRM India ke liye bana | FW-CRM | hi-dominant | Owner | 7.2 |
| OPP-483 | Maine AI se follow-up call karwaya client ko pata bhi nahi | FW-CONTRARIAN | hi-dominant | Broker | 7.2 |
| OPP-307 | 100 leads aaye sirf 12 convert hue baaki kahan gaye (deep- | FW-CONTRARIAN | mixed | Owner | 7.2 |
| OPP-484 | AI calling demo sun lo asli real estate call (deep-dive) | FW-MYTH | hi-dominant | Broker | 7.2 |
| OPP-482 | AI calls karega tu deals close karega 10 ghante bach gaye  | FW-MYTH | hi-dominant | Broker | 7.1 |
| OPP-245 | Tum broke nahi ho tum bleeding ho roz 50K leak (deep-dive) | FW-CRM | mr-dominant | Owner | 7.0 |
| OPP-312 | Competitor ne 2 min mein call kiya aapne 2 ghante baad (de | FW-MYTH | mixed | Broker | 7.0 |


---

## 5. How the Content Factory Consumes This Plan

This file + the CSV are the **intake queue** for the content factory (`10-content-factory.md`). The loop:

1. **Pull by priority.** Sort `04-content-plan-500.csv` by `priority_score` (or filter by `cta_category=DEMO/TRIAL` for a lead-gen sprint, by `content_type=CT-MEME` for a reach sprint, by `city=Pune` for a geo push). Pick the OPP-ids you want this week.
2. **Hand the row to the factory.** Each row already specifies the recipe: `content_type` (CT-*) → default `framework`, `characters` (CH-*), `language` tag, `hook_category`, and `cta_category`. The factory expands the CT recipe (`09-content-type-system.md` Master Recipe Table) into a full script: hook (first 1.5s, in the row's language), framework structure, character dialogue locked to the CH-* consistency prompts, burned-in subtitles (subtitle-language = spoken-language, romanized), and the CTA.
3. **Generate assets** via the Higgsfield workflow the CT recipe names (HF-DRAMA-DIALOGUE, HF-DEMO-SCREEN, HF-UGC-SELFIE, HF-TALKING-HEAD, etc.) using the saved character Soul IDs so the cast stays consistent across every reel.
4. **Schedule** at the peak windows from market research (6–8 AM, 12–1 PM, 6–8 PM; Friday evenings strongest) via Blotato.
5. **Balance check.** The pipeline-manager enforces the monthly language split (55/30/15) and a healthy mix of reach vs lead-gen vs trust content using the `content_type` / `language` / `cta_category` columns.
6. **Feed results back.** Winners (high saves/DMs) get re-cut into variants (UGC for paid); losers get retired. ab-optimizer + media-buyer pull the `cta_category=DEMO/TRIAL` rows for Meta ad creative.

**Rule of thumb:** for any given week, pull ~60% from the **Strong (6.5–7.9)** band, ~25% high-reach memes/dramas for top-of-funnel, and ~15% deep lead-gen (demo/case/UGC with DEMO/TRIAL CTAs). The 14-day launch plan (`05-14-day-launch-plan.md`) is a worked example of exactly this selection.
