# Instagram — DM Workflows

> **Phase 3 · Instagram Subsystem · RealEstateFlow (brand: RealtyFlow) · @realtyflow_india**
> The DM is where **attention becomes a qualified conversation** — the bridge from a reel/story/comment to a WhatsApp demo. Stories open DMs (`stories.md §4`), comments route to DMs (`comments.md §4`), keywords trigger DMs. This file is the funnel inside the inbox. Integrates with `content-to-conversation.md`, Sales OS (`qualification.md`, `objections.md`, `demo-script.md`), and `distribution-os/whatsapp/`.

**Audience reality:** brokers prefer typing over calls, reply fast to value, hate being sold to in public, and live on WhatsApp. So: deliver value first, qualify in ≤2 questions, never lead with pricing, move richer chats to WhatsApp quickly. Hinglish 70/30 + Marathi for Pune.

---

## 1. Auto-Reply Keyword Table (set in IG/Meta tools)

Each keyword (used as the comment-bait / story-bait CTA) triggers an instant DM. Verbatim replies below. Keep `{link}` tokens swapped for live URLs.

| Keyword | Auto-DM (verbatim) | Then routes to |
|---|---|---|
| **DEMO** | "2-min AI-calling demo dekho 👉 {demo.realtyflow.in}. Waise team size kitni hai aapki? 🙌" | qualify (`CTA-DEMO-001`) |
| **LEAK** | "Yeh raha Lead-Leakage Calculator 👉 {link}. Abhi leads kahan track karte ho — WhatsApp ya koi system?" | qualify (`CTA-LEAD-MAGNET-005`) |
| **SHEET** | "Free Broker Follow-up Tracker 👇 {link}. Kitne leads/month aate hain roughly?" | qualify |
| **AI** | "AI ko apne hi ek lead pe try karwana hai? Number do, WhatsApp pe live call dikhata hoon 📞" | handoff |
| **TRIAL** | "Free trial, no card 👉 {app.realtyflow.in/signup}. Setup mein help chahiye toh batao, साथ करते hain." | onboarding |
| **PRICE** | "Plans: Free / ₹999 / ₹2,999 / ₹5,999. Aapki agency ke hisaab se kaunsa sahi hai — team size batao, suggest karta hoon." | qualify |
| **KHATA** | "Commission/khata book ka quick clip 👉 {link}. Abhi hisaab Excel pe ya diary pe?" | qualify |
| **GUIDE** | "Free 'Agency Setup Guide' 👇 {link}. Kitne agents hain team mein?" | qualify |
| **CRM** | "Pura CRM 2 min mein samajh aa jayega 👉 {demo}. Abhi konsa tool use karte ho?" | qualify |
| **PUNE** | "Namaskar 🙏 Pune ki local team connect karwata hoon. WhatsApp number share karo?" (mr-dominant) | handoff |
| **SETUP** | "Onboarding steps + free migration 👉 {link}. Apni current sheet ka screenshot bhejo, shift karwa deta hoon." | onboarding |
| **DASHBOARD** | "Owner dashboard ka 60-sec tour 👉 {link}. Aap owner ho ya team handle karte ho?" | qualify |

---

## 2. The Complete DM Script Flow (with branches)

```
STEP 1 — GREET + DELIVER
  "Arre {{name}} 🙌 dekha aapne reel pe react kiya. Yeh raha jo maanga: {asset/link}."

STEP 2 — QUALIFY (max 2 Qs)
  Q1: "Aapki agency mein kitne agents hain — solo ya team?"
  Q2: "Abhi leads WhatsApp/Excel pe ya kisi system pe?"

STEP 3 — ROUTE (branch on answers)
  ├─ SOLO + curious        → TRIAL: "Solo ke liye free plan perfect hai 👉 {signup}. 5 min mein set."
  ├─ TEAM (2–8) + pain     → DEMO:  "Team ke liye ek 2-min demo dikhata hoon — WhatsApp pe live, aaj/kal?"
  ├─ OWNER (8+) + control  → DEMO + DASHBOARD: "Owner dashboard zaroor dekho — team visibility ka game."
  ├─ "bas dekh raha tha"   → NURTURE: drop value, no push; tag for follow-up; invite to broadcast channel.
  └─ Pune                  → mr-dominant + local-team handoff.

STEP 4 — HANDOFF (to WhatsApp)
  "WhatsApp pe bhej dun? Wahan AI calling + inventory + khata live dikhata hoon — type karna easy hai 🙂"

STEP 5 — CAPTURE + CREATE LEAD
  Get number → create CRM lead (source=instagram_dm, OPP-id=originating content)
  → hand to Sales OS qualification (`sales-os/qualification.md`).
```

---

## 3. Qualification-in-DM (the 2-question rule)

Never interrogate. Two questions max before you give value or route:
1. **Team size** (solo / 2–8 / 8+) → maps to plan + persona (Broker / Owner).
2. **Current tool** (WhatsApp / Excel / other CRM) → maps to pain depth + migration offer.

Read the answer against the ICP (research §2): solo → TRIAL/free plan; small team with pain → DEMO; owner with control-anxiety → DASHBOARD demo. Tag the persona so nurture + attribution know who this is.

---

## 4. Objection Snippets (DM-sized, route to Sales OS for depth)

| Objection | DM snippet (Hinglish) | Full ref |
|---|---|---|
| "Mahanga hoga" | "₹999 se shuru, aur ek bachi hui ₹1L deal se saal bhar ka cost cover 🙂 ROI 30 din." | `objections.md §8.2` |
| "Team nahi seekhegi" | "Bhai WhatsApp jaisa hi hai — 2-hour training, 30 min mein samajh aata hai. 95% adoption month 1." | §8.1 |
| "Hum theek hain abhi" | "Theek nahi, bleeding ho rahe ho — roz ~₹50K leak. Dikhana hai kahan?" | §8.3 |
| "AI calling kaam karegi?" | "Real estate AI calling ka sabse easy case hai — ek live call dikhata hoon, khud judge karo." | §8.6 |
| "Pehle CRM try kiya, fail" | "Woh US ke liye bane the. Yeh Mumbai/Pune ke liye — desi problem, desi solution." | §8.9 |

Keep it to ONE snippet, then offer the demo. Don't win the argument in DM — win the demo booking.

---

## 5. Handoff-to-WhatsApp Script

```
"Yeh chat thodi limited hai bhai 😅 WhatsApp pe bhej dun?
 Wahan aapke hi ek lead pe AI call live dikhata hoon + inventory share + khata —
 sab 5 min mein. Bas number do, abhi bhejta hoon link."
→ on number: create lead, send WA template (distribution-os/whatsapp/), book demo slot.
```
WhatsApp is the richer channel (file shares, voice notes, live demo). Move any conversation that's past "qualified + interested" there fast.

---

## 6. No-Reply Nudges (cadence)

Never spam. Two gentle nudges, then stop and let nurture take over.

| Timing | Nudge (Hinglish) |
|---|---|
| **+24h** | "Koi pressure nahi 🙂 bas yeh 60-sec AI calling clip dekh lo 👉 {clip}." |
| **+72h** | "{{name}} ek choti baat — {their-pain} ke liye yeh case dekho: {OPP-372/280}. Demo chahiye toh bolo." |
| **+7d** | (stop DM) → add to broadcast channel + nurture sequence; revisit only if they re-engage. |

---

## 7. Do / Don't

| Do | Don't |
|---|---|
| One ask per message | dump qualify + pricing + demo in one wall of text |
| Deliver the promised value first | open with a sales pitch |
| Sell the **demo**, not the price | paste the price list first |
| Move warm chats to WhatsApp fast | keep a hot lead stuck in IG DMs |
| Tag source + OPP-id on every lead | leave leads unattributed |
| Reply within the peak-hour window | let DMs sit overnight unanswered |
| Hinglish (Marathi for Pune) | corporate English script |

---

## 8. Lead Attribution

Every qualified DM logs: `source=instagram_dm` (or `instagram_comment` / `instagram_story`), **originating OPP-id** (which content drove it), **CTA-id**, persona, team-size, current-tool, and route (TRIAL/DEMO/NURTURE). This feeds `content-to-conversation.md` + `follower-to-demo.md` so we know *which content books demos* and double down (the content plan's feedback loop, `04-content-plan-500.md §5`).

---

## 9. Metrics

| Metric | What it tells you | Target |
|---|---|---|
| DM threads / day | top-of-conversation volume | ≥ 10/day by Month 2 |
| Keyword-trigger fires | auto-reply pull | track per keyword |
| DM → qualified | conversation quality | track |
| DM → WhatsApp handoff | funnel pull | **~40%** (`follower-to-demo.md`) |
| WhatsApp → demo | downstream | ~30% |
| Median first-reply time | responsiveness | < peak-window (same session) |

> DMs are measured by **qualified handoffs to WhatsApp + booked demos**, not message count. Log every qualified DM against its OPP-id — that's how content earns its keep.
