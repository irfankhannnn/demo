# Content Plan — 526 Scored Opportunities

> **What this is.** A bank of scored Instagram content opportunities (`OPP-001` … `OPP-526`) for RealEstateFlow. Each is tagged to the engine's objects — content types (`CT-*`), frameworks (`FW-*`), cast (`CH-*`) and a language tag. The machine-readable rows live in [`content-plan-500.csv`](content-plan-500.csv); this file is the human-readable summary of them. **The two must stay in sync** — edit the CSV, then update this file. [`README.md`](README.md) explains how a row becomes a scheduled post.

> **Built from 147 grounded seed angles** expanded across content types, frameworks, languages, personas and cities into 520 opportunities, plus **6 seeds added in September 2026** (`OPP-521`…`OPP-526`) for shipped surfaces the June plan never covered: Instagram DM → CRM capture, comment-keyword auto-reply, property pages with site-visit booking, the WhatsApp AI Employee handling a lead end to end, and the two AI follow-up calls.

## Read the `status` and `gate` columns first

Roughly three rows in ten cannot be produced as written. The CSV now says which, and why.

| `status` | Rows | Meaning |
|---|---|---|
| `ok` | 367 | Producible today. |
| `blocked-prelaunch` | 97 | Asserts a customer, a case study, a testimonial or a result we do not have. We are pre-launch with **zero customers**. Kept for post-launch reuse; do not produce. |
| `blocked-founder-oncamera` | 15 | Written around the founder on camera, or around an unverifiable founder claim. The founder is never on camera; `characters` on these rows has been reset to `CH-PRESENTER`, and the unverifiable claim still has to go before the row can run. |
| `blocked-feature` | 12 | Describes something the product does not do: the lead-leakage calculator is a placeholder, and there is no portal sync or "all portals one inbox". Two of them (`OPP-521`, `OPP-522`) are new rows about Instagram DM and comment automation, which is built but blocked on Meta App Review and running dry in dev. |
| `review-number` | 28 | The title asserts a percentage or a ₹ figure. Producible only once that number is sourced, replaced with one the viewer works out themselves, or dropped. Nothing on the approved-claims list carries these numbers today. |
| `retitled` | 7 | The title asserted something untrue and has been rewritten in place — the four "raat ko 100 leads AI ne call kiye" rows (automated calls run only in the tenant's business hours) and the three "ROI 30 din" rows (an unproven promise). |

| `gate` | Rows | Meaning |
|---|---|---|
| `D24` | 123 | `city=Pune`. M1 is Mumbai-only. |
| `D26` | 37 | The title features AI calling, which exists in the product but is not on the approved-claims list. |
| `D23` | 2 | Depends on which channels and automations are in scope (`OPP-521`, `OPP-522`). |

> Open decision D23 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`
> Open decision D24 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`
> Open decision D26 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`

**Every row, whatever its status, still has to pass** [`../../10-audience-and-voice/claims-and-proof-policy.md`](../../10-audience-and-voice/claims-and-proof-policy.md) at production time. The status column catches what a machine could catch; it is not a substitute for reading the script.

**The scores below are June estimates**, computed before anything was published. Treat them as a prioritisation aid, not as measured performance. Re-score from real numbers once the first month's results exist.



---

## 1. Scoring Methodology

Every opportunity is scored on **five axes, 1–10 each**. These axes map to what Instagram actually rewards and to what the business needs from a B2B SaaS launch:

| Axis | What it measures | Why it matters here |
|---|---|---|
| `reach_potential` | Scroll-stop + algorithmic reach (cold audience) | Top-of-funnel awareness among the Mumbai MMR broker base (order of tens of thousands — an estimate, not a sourced figure) |
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

> **This distribution is the June plan's, and it does not match the current rules.** Brand copy is 70% English / 30% romanized Hindi (brand kit v3, `CLAUDE.md`); the decisions log sets 60/25/15 EN/Hinglish/Marathi for ads; this plan was built to 55/30/15 with a Marathi over-index for Pune. Three targets, three scopes. The plan's own numbers are left as-is so the gap is visible rather than quietly papered over.
> Open decision D24 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`


### By city
| City | Count | Share |
|---|---|---|
| Both | 264 | 50.8% |
| Mumbai | 133 | 25.6% |
| Pune | 123 | 23.7% |

> `Both` = a single Hinglish-spine asset that runs in more than one city without a re-shoot. The 123 `Pune` rows carry `gate=D24` and are not in scope while M1 is Mumbai-only; `Both` rows run as Mumbai rows until that changes.


---

## 3. TOP 50 Opportunities (by June priority_score)

> Rows carrying ⛔ cannot be produced as written; rows carrying `[D24]` or `[D26]` are behind an open decision. Skip them and take the next row down.

| # | OPP | Title | CT | FW | Lang | Persona | Priority | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | OPP-481 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (deep- [D24, D26] ⛔ blocked-prelaunch | CT-AUTHORITY | FW-CRM | hi-dominant | Broker | 8.0 | 39 |
| 2 | OPP-240 | CRM mahanga? {{entry_price}} se shuru - ek bacha hua lead hi kaafi (deep-dive) | CT-AUTHORITY | FW-AUTHORITY | en-leaning | Owner | 7.9 | 39 |
| 3 | OPP-187 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (carou [D26] ⛔ blocked-prelaunch | CT-EDU | FW-CRM | hi-dominant | Broker | 7.9 | 38 |
| 4 | OPP-163 | Lead leakage calculator apni leak nikalo comment mein (case ⛔ blocked-feature  | CT-CASE | FW-LEAD-LEAKAGE | hi-dominant | Owner | 7.8 | 39 |
| 5 | OPP-467 | Response within 15 min 60 percent close after 1 hour 20 perc ⚠ review-number | CT-UGC | FW-PROPERTY | mixed | Owner | 7.8 | 38 |
| 6 | OPP-310 | Lead leakage calculator apni leak nikalo comment mein (deep- ⛔ blocked-feature | CT-AUTHORITY | FW-CONTRARIAN | en-leaning | Owner | 7.7 | 39 |
| 7 | OPP-325 | Commission ka jhagda ab nahi khata book khol ke dikhao (skit | CT-DRAMA | FW-CONVO | mr-dominant | Owner | 7.7 | 38 |
| 8 | OPP-295 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek lea | CT-EDU | FW-LEAD-LEAKAGE | hi-dominant | Broker | 7.6 | 38 |
| 9 | OPP-006 | Tumhi pan lead WhatsApp madhe shodhta mag deal gela samjha [D24] | CT-DRAMA | FW-SKIT | mr-dominant | Broker | 7.5 | 37 |
| 10 | OPP-457 | Lead leakage calculator apni leak nikalo comment mein (demo) ⛔ blocked-feature | CT-DEMO | FW-CRM | hi-dominant | Owner | 7.5 | 37 |
| 11 | OPP-296 | WhatsApp mein jo 5L deal laga tha woh gaya kahan (carousel) [D24] ⚠ review-number  | CT-EDU | FW-MISTAKE | hi-dominant | Owner | 7.4 | 37 |
| 12 | OPP-015 | Aapke leads leak ho rahe hain aur aapko pata bhi nahi | CT-EDU | FW-MYTH | en-leaning | Owner | 7.4 | 36 |
| 13 | OPP-190 | AI calling demo sun lo asli real estate call (carousel) [D24, D26] | CT-EDU | FW-LEAD-LEAKAGE | mr-dominant | Broker | 7.4 | 36 |
| 14 | OPP-336 | Maine AI se follow-up call karwaya client ko pata bhi nahi c [D26] ⛔ blocked-prelaunch | CT-UGC | FW-PROPERTY | mixed | Broker | 7.4 | 36 |
| 15 | OPP-443 | WhatsApp mein jo 5L deal laga tha woh gaya kahan (demo) ⚠ review-number | CT-DEMO | FW-DEMO | hi-dominant | Owner | 7.4 | 36 |
| 16 | OPP-383 | Launch day RealEstateFlow ab live hai dekho (founder cut) ⛔ founder-on-camera | CT-FOUNDER | FW-FOUNDER | hi-dominant | Owner | 7.2 | 37 |
| 17 | OPP-002 | WhatsApp mein jo 5L deal laga tha woh gaya kahan ⚠ review-number | CT-DRAMA | FW-DRAMA | mr-dominant | Owner | 7.2 | 36 |
| 18 | OPP-058 | Top agent nikla apne saare client le gaya | CT-DRAMA | FW-SKIT | en-leaning | Owner | 7.2 | 36 |
| 19 | OPP-117 | RealEstateFlow vs generic CRM India ke liye bana | CT-AUTHORITY | FW-CRM | hi-dominant | Owner | 7.2 | 36 |
| 20 | OPP-321 | 3 follow-up jo har broker bhoolta hai (skit) [Mumbai] | CT-DRAMA | FW-CONVO | hi-dominant | Broker | 7.2 | 36 |
| 21 | OPP-483 | Maine AI se follow-up call karwaya client ko pata bhi nahi c [D26] ⛔ blocked-prelaunch | CT-AUTHORITY | FW-CONTRARIAN | hi-dominant | Broker | 7.2 | 36 |
| 22 | OPP-049 | Pata hai team abhi kya kar rahi hai dashboard kholo | CT-EDU | FW-MYTH | hi-dominant | Owner | 7.2 | 35 |
| 23 | OPP-307 | 100 leads aaye sirf 12 convert hue baaki kahan gaye (deep-di | CT-AUTHORITY | FW-CONTRARIAN | mixed | Owner | 7.2 | 35 |
| 24 | OPP-335 | AI calls karega tu deals close karega 10 ghante bach gaye (U [D26] | CT-UGC | FW-UGC | hi-dominant | Broker | 7.2 | 35 |
| 25 | OPP-387 | CRM mahanga? {{entry_price}} se shuru - ek bacha hua lead hi kaafi (skit) | CT-DRAMA | FW-SKIT | mixed | Owner | 7.2 | 35 |
| 26 | OPP-484 | AI calling demo sun lo asli real estate call (deep-dive) [D26] | CT-AUTHORITY | FW-MYTH | hi-dominant | Broker | 7.2 | 35 |
| 27 | OPP-088 | Indian brokers ko US CRM nahi chahiye desi chahiye ⛔ founder-on-camera | CT-FOUNDER | FW-FOUNDER | mr-dominant | Owner | 7.1 | 36 |
| 28 | OPP-442 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek lea | CT-DEMO | FW-AI | mixed | Broker | 7.1 | 35 |
| 29 | OPP-482 | AI calls karega tu deals close karega 10 ghante bach gaye (d [D26] | CT-AUTHORITY | FW-MYTH | hi-dominant | Broker | 7.1 | 35 |
| 30 | OPP-334 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (UGC s [D26] ⛔ blocked-prelaunch | CT-UGC | FW-OBJECTION | en-leaning | Broker | 7.1 | 34 |
| 31 | OPP-089 | Launch day RealEstateFlow ab live hai dekho ⛔ founder-on-camera | CT-FOUNDER | FW-FOUNDER | en-leaning | Owner | 7.0 | 36 |
| 32 | OPP-245 | Tum broke nahi ho tum bleeding ho roz 50K leak (deep-dive) ⚠ review-number | CT-AUTHORITY | FW-CRM | mr-dominant | Owner | 7.0 | 36 |
| 33 | OPP-287 | Naya agent jab pehli baar CRM dekhta hai reaction (skit) | CT-DRAMA | FW-WHATSAPP-CHAOS | mr-dominant | NewJoiner | 7.0 | 36 |
| 34 | OPP-392 | Tum broke nahi ho tum bleeding ho roz 50K leak (skit) ⚠ review-number | CT-DRAMA | FW-WHATSAPP-CHAOS | en-leaning | Owner | 7.0 | 36 |
| 35 | OPP-013 | 100 leads aaye sirf 12 convert hue baaki kahan gaye | CT-EDU | FW-CRM | hi-dominant | Owner | 7.0 | 35 |
| 36 | OPP-122 | Diwali booking season leads ka rush handle karo | CT-NEWS | FW-NEWS | hi-dominant | Owner | 7.0 | 35 |
| 37 | OPP-300 | Tumhi pan lead WhatsApp madhe shodhta mag deal gela samjha ( [D24] | CT-EDU | FW-MYTH | mr-dominant | Broker | 7.0 | 35 |
| 38 | OPP-042 | Maine AI se follow-up call karwaya client ko pata bhi nahi c [D26] ⛔ blocked-prelaunch | CT-DEMO | FW-DEMO | hi-dominant | Broker | 7.0 | 34 |
| 39 | OPP-081 | Mr aur Mrs Khan ka smooth deal testimonial ⛔ blocked-prelaunch | CT-PROOF | FW-CUSTOMER | hi-dominant | Buyer | 7.0 | 34 |
| 40 | OPP-312 | Competitor ne 2 min mein call kiya aapne 2 ghante baad (deep [D26] | CT-AUTHORITY | FW-MYTH | mixed | Broker | 7.0 | 34 |
| 41 | OPP-511 | Property turant share karo deal fast karo demo (carousel) | CT-EDU | FW-MYTH | hi-dominant | Broker | 7.0 | 34 |
| 42 | OPP-001 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek lea | CT-DRAMA | FW-DRAMA | hi-dominant | Broker | 6.9 | 35 |
| 43 | OPP-192 | Business hours mein AI ne leads qualify kiye, subah tak list ready (carousel) | CT-EDU | FW-MISTAKE | mr-dominant | Owner | 6.9 | 34 |
| 44 | OPP-309 | Aapke leads leak ho rahe hain aur aapko pata bhi nahi (deep- | CT-AUTHORITY | FW-MYTH | en-leaning | Owner | 6.9 | 34 |
| 45 | OPP-280 | Arjun ne 5 deal se 12 deal kiye system se (case study) ⛔ blocked-prelaunch | CT-CASE | FW-LEAD-LEAKAGE | hi-dominant | Broker | 6.9 | 33 |
| 46 | OPP-343 | Pata hai team abhi kya kar rahi hai dashboard kholo (deep-di [D24] | CT-AUTHORITY | FW-CONTRARIAN | hi-dominant | Owner | 6.9 | 33 |
| 47 | OPP-057 | Ek agent gaya saara business gaya bachao kaise | CT-DRAMA | FW-DRAMA | mr-dominant | Owner | 6.8 | 35 |
| 48 | OPP-098 | Tum broke nahi ho tum bleeding ho roz 50K leak ⚠ review-number | CT-EDU | FW-MYTH | hi-dominant | Owner | 6.8 | 35 |
| 49 | OPP-289 | Beta business join nahi karna chahta jab tak CRM nahi dekha [D24]  | CT-FOUNDER | FW-FOUNDER | mr-dominant | Owner | 6.8 | 35 |
| 50 | OPP-062 | Naya agent Day 1 vs Day 7 with RealEstateFlow [D24] | CT-DRAMA | FW-CONVO | mr-dominant | NewJoiner | 6.8 | 34 |


---

## 4. Top 10 per Content Type


### CT-EDU — Educational

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-187 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (car [D26] ⛔ blocked-prelaunch | FW-CRM | hi-dominant | Broker | 7.9 |
| OPP-295 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek l | FW-LEAD-LEAKAGE | hi-dominant | Broker | 7.6 |
| OPP-296 | WhatsApp mein jo 5L deal laga tha woh gaya kahan (carousel [D24] ⚠ review-number | FW-MISTAKE | hi-dominant | Owner | 7.4 |
| OPP-015 | Aapke leads leak ho rahe hain aur aapko pata bhi nahi | FW-MYTH | en-leaning | Owner | 7.4 |
| OPP-190 | AI calling demo sun lo asli real estate call (carousel) [D24, D26] | FW-LEAD-LEAKAGE | mr-dominant | Broker | 7.4 |
| OPP-049 | Pata hai team abhi kya kar rahi hai dashboard kholo | FW-MYTH | hi-dominant | Owner | 7.2 |
| OPP-013 | 100 leads aaye sirf 12 convert hue baaki kahan gaye | FW-CRM | hi-dominant | Owner | 7.0 |
| OPP-300 | Tumhi pan lead WhatsApp madhe shodhta mag deal gela samjha [D24] | FW-MYTH | mr-dominant | Broker | 7.0 |
| OPP-511 | Property turant share karo deal fast karo demo (carousel) | FW-MYTH | hi-dominant | Broker | 7.0 |
| OPP-192 | Business hours mein AI ne leads qualify kiye, subah tak list ready (carousel) | FW-MISTAKE | mr-dominant | Owner | 6.9 |


### CT-DRAMA — Drama/Skit

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-325 | Commission ka jhagda ab nahi khata book khol ke dikhao (sk | FW-CONVO | mr-dominant | Owner | 7.7 |
| OPP-006 | Tumhi pan lead WhatsApp madhe shodhta mag deal gela samjha [D24] | FW-SKIT | mr-dominant | Broker | 7.5 |
| OPP-002 | WhatsApp mein jo 5L deal laga tha woh gaya kahan ⚠ review-number | FW-DRAMA | mr-dominant | Owner | 7.2 |
| OPP-058 | Top agent nikla apne saare client le gaya | FW-SKIT | en-leaning | Owner | 7.2 |
| OPP-321 | 3 follow-up jo har broker bhoolta hai (skit) [Mumbai] | FW-CONVO | hi-dominant | Broker | 7.2 |
| OPP-387 | CRM mahanga? {{entry_price}} se shuru - ek bacha hua lead hi kaafi (skit) | FW-SKIT | mixed | Owner | 7.2 |
| OPP-287 | Naya agent jab pehli baar CRM dekhta hai reaction (skit) | FW-WHATSAPP-CHAOS | mr-dominant | NewJoiner | 7.0 |
| OPP-392 | Tum broke nahi ho tum bleeding ho roz 50K leak (skit) ⚠ review-number | FW-WHATSAPP-CHAOS | en-leaning | Owner | 7.0 |
| OPP-001 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek l | FW-DRAMA | hi-dominant | Broker | 6.9 |
| OPP-057 | Ek agent gaya saara business gaya bachao kaise | FW-DRAMA | mr-dominant | Owner | 6.8 |


### CT-UGC — UGC

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-467 | Response within 15 min 60 percent close after 1 hour 20 pe ⚠ review-number | FW-PROPERTY | mixed | Owner | 7.8 |
| OPP-336 | Maine AI se follow-up call karwaya client ko pata bhi nahi [D26] ⛔ blocked-prelaunch | FW-PROPERTY | mixed | Broker | 7.4 |
| OPP-335 | AI calls karega tu deals close karega 10 ghante bach gaye [D26]  | FW-UGC | hi-dominant | Broker | 7.2 |
| OPP-334 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (UGC [D26] ⛔ blocked-prelaunch | FW-OBJECTION | en-leaning | Broker | 7.1 |
| OPP-339 | Business hours mein AI ne leads qualify kiye, subah tak list ready (UGC selfie) | FW-UGC | hi-dominant | Owner | 6.8 |
| OPP-469 | Follow-up rahila ani deal gela Pune broker ki kahani (UGC [D24]  | FW-OBJECTION | hi-dominant | Broker | 6.8 |
| OPP-372 | Andheri broker ne lead leakage near zero kiya 60 din mein ⛔ blocked-prelaunch  | FW-OBJECTION | hi-dominant | Owner | 6.6 |
| OPP-378 | Shuruaati members ke liye RealEstateFlow live hai (UGC selfie) ⛔ blocked-prelaunch | FW-UGC | hi-dominant | Owner | 6.6 |
| OPP-340 | AI tumhe replace nahi karega boring kaam karega (UGC selfi | FW-OBJECTION | hi-dominant | Broker | 6.5 |
| OPP-211 | New joiner 30 min mein CRM seekh gaya WhatsApp jaisa (UGC ⛔ blocked-prelaunch  | FW-OBJECTION | mixed | NewJoiner | 6.5 |


### CT-FOUNDER — Founder

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-383 | Launch day RealEstateFlow ab live hai dekho (founder cut) ⛔ founder-on-camera | FW-FOUNDER | hi-dominant | Owner | 7.2 |
| OPP-088 | Indian brokers ko US CRM nahi chahiye desi chahiye ⛔ founder-on-camera | FW-FOUNDER | mr-dominant | Owner | 7.1 |
| OPP-089 | Launch day RealEstateFlow ab live hai dekho ⛔ founder-on-camera | FW-FOUNDER | en-leaning | Owner | 7.0 |
| OPP-289 | Beta business join nahi karna chahta jab tak CRM nahi dekh [D24] | FW-FOUNDER | mr-dominant | Owner | 6.8 |
| OPP-380 | Ek cheez jo har agency ka follow-up theek kar deti hai [D24] ⛔ founder-on-camera  | FW-CONTRARIAN | hi-dominant | Owner | 6.7 |
| OPP-090 | Mera broker dost ne 20L ka deal khoya tab idea aaya ⛔ founder-on-camera | FW-AUTHORITY | hi-dominant | Owner | 6.5 |
| OPP-134 | Professional broker banna hai to professional tool [D24] | FW-CONTRARIAN | mr-dominant | Owner | 6.5 |
| OPP-382 | Indian brokers ko US CRM nahi chahiye desi chahiye (founde ⛔ founder-on-camera | FW-AUTHORITY | hi-dominant | Owner | 6.2 |
| OPP-132 | 15 agent team 20 Cr revenue 8 ghante kaam ka sapna | FW-FOUNDER | mixed | Owner | 6.2 |
| OPP-133 | Arjun ne 5 deal se 12 deal kiye system se ⛔ blocked-prelaunch | FW-FOUNDER | mr-dominant | Broker | 6.2 |


### CT-CASE — Case Study

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-163 | Lead leakage calculator apni leak nikalo comment mein (cas ⛔ blocked-feature | FW-LEAD-LEAKAGE | hi-dominant | Owner | 7.8 |
| OPP-280 | Arjun ne 5 deal se 12 deal kiye system se (case study) ⛔ blocked-prelaunch | FW-LEAD-LEAKAGE | hi-dominant | Broker | 6.9 |
| OPP-160 | 100 leads aaye sirf 12 convert hue baaki kahan gaye (case ⛔ blocked-prelaunch  | FW-LEAD-LEAKAGE | en-leaning | Owner | 6.7 |
| OPP-225 | Andheri broker ne lead leakage near zero kiya 60 din mein ⛔ blocked-prelaunch  | FW-LEAD-LEAKAGE | mr-dominant | Owner | 6.7 |
| OPP-227 | Close rate 8 percent se 12 percent 2 mahine mein (case stu [D24] ⛔ blocked-prelaunch | FW-CASE | hi-dominant | Owner | 6.7 |
| OPP-254 | FB pe 20 comment 3 ko call kiya 17 ignore ek buyer tha (ca [D26] ⛔ blocked-prelaunch | FW-CASE | hi-dominant | Broker | 6.7 |
| OPP-474 | Agent bole 5L baki broker bole 3L hisaab kaun sahi (case s ⛔ blocked-prelaunch | FW-BAB | en-leaning | Owner | 6.5 |
| OPP-167 | Lead aaya call lagaya kal buyer already gaya (case study) ⛔ blocked-prelaunch | FW-LEAD-LEAKAGE | en-leaning | Broker | 6.5 |
| OPP-231 | Shuruaati members ke liye RealEstateFlow live hai (case study) ⛔ blocked-prelaunch | FW-LEAD-LEAKAGE | mixed | Owner | 6.5 |
| OPP-257 | Referral source track kiya top agent 40 referral nikla (ca ⛔ blocked-prelaunch | FW-BAB | mixed | Owner | 6.4 |


### CT-DEMO — Product Demo

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-457 | Lead leakage calculator apni leak nikalo comment mein (dem ⛔ blocked-feature | FW-CRM | hi-dominant | Owner | 7.5 |
| OPP-443 | WhatsApp mein jo 5L deal laga tha woh gaya kahan (demo) ⚠ review-number | FW-DEMO | hi-dominant | Owner | 7.4 |
| OPP-442 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek l | FW-AI | mixed | Broker | 7.1 |
| OPP-042 | Maine AI se follow-up call karwaya client ko pata bhi nahi [D26] ⛔ blocked-prelaunch | FW-DEMO | hi-dominant | Broker | 7.0 |
| OPP-129 | Site visit schedule reminder auto demo | FW-AI | mr-dominant | Broker | 6.8 |
| OPP-399 | All portals one inbox MagicBricks Housing 99acres (demo) ⛔ blocked-feature | FW-CRM | mixed | Owner | 6.8 |
| OPP-455 | 30 percent leads chup-chaap gayab har mahine ka 20L (demo) ⚠ review-number | FW-DEMO | mr-dominant | Owner | 6.8 |
| OPP-039 | Manual hisaab mein har mahine kitna leak ho raha | FW-AI | hi-dominant | Owner | 6.7 |
| OPP-041 | AI calls karega tu deals close karega 10 ghante bach gaye [D26] | FW-CRM | mixed | Broker | 6.7 |
| OPP-072 | Instagram pe dekhi property aap dhoondh nahi paye client g | FW-CRM | hi-dominant | Broker | 6.5 |


### CT-PROOF — Social Proof

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-081 | Mr aur Mrs Khan ka smooth deal testimonial ⛔ blocked-prelaunch | FW-CUSTOMER | hi-dominant | Buyer | 7.0 |
| OPP-078 | Andheri broker ne lead leakage near zero kiya 60 din mein ⛔ blocked-prelaunch | FW-CUSTOMER | mr-dominant | Owner | 6.5 |
| OPP-083 | 12K month diya 25L recover kiya ab CRM free jaisa ⛔ blocked-prelaunch | FW-AUTHORITY | mr-dominant | Owner | 6.4 |
| OPP-436 | Beta business join nahi karna chahta jab tak CRM nahi dekh ⛔ blocked-prelaunch | FW-AUTHORITY | en-leaning | Owner | 6.3 |
| OPP-371 | Buyer requirement capture karo galti se kuch miss na ho (t ⛔ blocked-prelaunch | FW-CASE | mr-dominant | Broker | 6.2 |
| OPP-437 | Purane broker ka succession plan tech se zinda (testimonia ⛔ blocked-prelaunch | FW-CASE | en-leaning | Owner | 6.2 |
| OPP-519 | Andheri broker ne lead leakage near zero kiya 60 din mein ⛔ blocked-prelaunch  | FW-CUSTOMER | hi-dominant | Owner | 6.1 |
| OPP-368 | Client call aaye to saari history turant samne (testimonia ⛔ blocked-prelaunch | FW-CUSTOMER | en-leaning | Broker | 6.0 |
| OPP-369 | Sneha ne client ki requirement ek jagah rakhi perfect matc ⛔ blocked-prelaunch | FW-AUTHORITY | hi-dominant | Broker | 5.9 |
| OPP-370 | Client ko lagta hai aap sirf usi ke liye kaam kar rahe (te ⛔ blocked-prelaunch | FW-AUTHORITY | hi-dominant | Broker | 5.9 |


### CT-NEWS — News

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-122 | Diwali booking season leads ka rush handle karo | FW-NEWS | hi-dominant | Owner | 7.0 |
| OPP-101 | Ready reckoner rate badha brokers ke liye matlab | FW-CONTRARIAN | en-leaning | Owner | 6.4 |
| OPP-100 | RERA number har listing pe trust signal [D24] | FW-CRM | mr-dominant | Owner | 6.3 |
| OPP-102 | Carpet vs built-up loading samjhao client ko | FW-CONTRARIAN | mixed | Broker | 6.2 |
| OPP-099 | Maharashtra RERA agent rule badla 60 sec mein samjho | FW-CRM | mixed | Owner | 6.0 |
| OPP-125 | Year end push December targets dashboard se | FW-NEWS | mixed | Manager | 6.0 |
| OPP-121 | Gudi Padwa naya saal nayi deals shubhechha [D24] | FW-CONTRARIAN | mr-dominant | Owner | 5.9 |
| OPP-123 | Akshaya Tritiya property muhurat leads double | FW-CONTRARIAN | mr-dominant | Owner | 5.8 |
| OPP-124 | Festival season 3x leads system ready hai kya ⚠ review-number | FW-NEWS | hi-dominant | Owner | 5.4 |
| OPP-103 | Portal listing rate hike MagicBricks 99acres ab kya [D24] | FW-CONTRARIAN | en-leaning | Owner | 4.8 |


### CT-MEME — Meme

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-435 | 2026 aa gaya bhai aur tu abhi bhi Excel pe (meme) [Mumbai] | FW-SKIT | hi-dominant | Broker | 6.6 |
| OPP-430 | POV jab client puche mera lead kahan hai (meme) [Mumbai] | FW-SKIT | hi-dominant | Broker | 6.4 |
| OPP-141 | 2026 aa gaya bhai aur tu abhi bhi Excel pe | FW-SKIT | hi-dominant | Broker | 6.3 |
| OPP-148 | POV broker scrolling 200 unread WhatsApp dhoondh raha ek l [D24] | FW-WHATSAPP-CHAOS | mr-dominant | Broker | 6.3 |
| OPP-149 | WhatsApp mein jo 5L deal laga tha woh gaya kahan (meme) ⚠ review-number | FW-CURIOSITY | hi-dominant | Owner | 6.3 |
| OPP-157 | WhatsApp lead ek tap mein system mein daalo demo (meme) | FW-CURIOSITY | hi-dominant | Broker | 6.2 |
| OPP-269 | Diwali booking season leads ka rush handle karo (meme) [D24] | FW-SKIT | hi-dominant | Owner | 6.2 |
| OPP-153 | Tumhi pan lead WhatsApp madhe shodhta mag deal gela samjha [D24] | FW-CURIOSITY | mr-dominant | Broker | 6.0 |
| OPP-138 | Jab do agent same lead pe ladte hain [D24] | FW-WHATSAPP-CHAOS | mixed | Manager | 5.9 |
| OPP-139 | Ek minute file dhoondta hoon buyer waiting meme [D24] | FW-WHATSAPP-CHAOS | hi-dominant | Broker | 5.9 |


### CT-AUTHORITY — Authority

| OPP | Title | FW | Lang | Persona | Priority |
|---|---|---|---|---|---|
| OPP-481 | AI ne mere 100 buyers ko call kiya 30 qualified nikle (dee [D24, D26] ⛔ blocked-prelaunch | FW-CRM | hi-dominant | Broker | 8.0 |
| OPP-240 | CRM mahanga? {{entry_price}} se shuru - ek bacha hua lead hi kaafi (deep-dive) | FW-AUTHORITY | en-leaning | Owner | 7.9 |
| OPP-310 | Lead leakage calculator apni leak nikalo comment mein (dee ⛔ blocked-feature | FW-CONTRARIAN | en-leaning | Owner | 7.7 |
| OPP-117 | RealEstateFlow vs generic CRM India ke liye bana | FW-CRM | hi-dominant | Owner | 7.2 |
| OPP-483 | Maine AI se follow-up call karwaya client ko pata bhi nahi [D26] ⛔ blocked-prelaunch | FW-CONTRARIAN | hi-dominant | Broker | 7.2 |
| OPP-307 | 100 leads aaye sirf 12 convert hue baaki kahan gaye (deep- | FW-CONTRARIAN | mixed | Owner | 7.2 |
| OPP-484 | AI calling demo sun lo asli real estate call (deep-dive) [D26] | FW-MYTH | hi-dominant | Broker | 7.2 |
| OPP-482 | AI calls karega tu deals close karega 10 ghante bach gaye [D26]  | FW-MYTH | hi-dominant | Broker | 7.1 |
| OPP-245 | Tum broke nahi ho tum bleeding ho roz 50K leak (deep-dive) ⚠ review-number | FW-CRM | mr-dominant | Owner | 7.0 |
| OPP-312 | Competitor ne 2 min mein call kiya aapne 2 ghante baad (de [D26] | FW-MYTH | mixed | Broker | 7.0 |


---

## 5. How the Content Factory Consumes This Plan

This file and the CSV are the intake queue for [`../production-pipeline.md`](../production-pipeline.md). The loop:

1. **Filter, then sort.** Drop everything where `status` is not `ok`, drop `gate=D24` while M1 is Mumbai-only, and drop `gate=D26` until AI calling is on the approved-claims list. Then sort by `priority_score`, or filter by `cta_category=DEMO/TRIAL` for a lead-gen week or `content_type=CT-MEME` for a reach week. Pick the OPP-ids for the week.
2. **Hand the row to the pipeline.** Each row specifies the recipe: `content_type` (CT-*) → default `framework`, `characters`, `language` tag, `hook_category`, `cta_category`. [`../content-types.md`](../content-types.md) expands the CT recipe into a full script: hook (first second, in the row's language), framework structure, dialogue locked to the consistency prompts, burned-in subtitles (romanized), and a CTA pulled by id.
3. **Route each shot** `[AI]`, `[REC]` or `[ED]`, and count the `[ED]` shots against the editor's ~3-videos-a-week cap before you commit to the week.
4. **Generate assets** via the Higgsfield workflow the CT recipe names, reusing the saved Soul IDs so the cast stays consistent. Real product UI comes from a `[REC]` screen recording.
5. **Claims check, then schedule.** Run the pre-publish checklist. Primary slot is 9:30 PM IST. How publishing happens — the `blotato` MCP or manual upload — is **D22**.
6. **Feed results back.** Winners get re-cut into variants; losers are retired. Record outcomes against the `OPP-` id so the June scores can eventually be replaced by measured ones.

**Rule of thumb:** in any week pull about 60% from the Strong (6.5–7.9) band, about 25% high-reach memes and dramas for the top of funnel, and about 15% deep lead-gen (demo/UGC with DEMO/TRIAL CTAs). Case-study and proof rows are not available pre-launch, so the trust slot is filled by product demos instead.

> Open decision D22 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`
