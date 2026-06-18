# Attention OS — Content → Conversation

**The system that turns a viewer into a DM, then a WhatsApp chat, then a demo.** This is where attention becomes pipeline. Integrates with `CTA-*`, `distribution-os/instagram/dm-workflows.md`, `distribution-os/whatsapp/`, and Sales OS.

---

## 1. The Conversion Spine
```
Reel/Story (pain)
   → on-content CTA ("comment LEAK" / "DM the word DEMO")
   → auto/manual DM reply (deliver value + ONE question)
   → qualify in DM (max 2 Qs) → move to WhatsApp (richer demo)
   → demo booked → Sales OS demo-script
```
**Friction law:** each step asks for exactly ONE micro-action. Never ask a cold viewer for a demo — ask for a comment or a word. Escalate the ask only as warmth rises.

---

## 2. 20 Conversation-Starter Mechanics
| # | Mechanic | Example (Hinglish) | Framework/CTA |
|---|---|---|---|
| 1 | Keyword comment loop | "Comment 'LEAK' — main lead-leakage calculator DM kar deta hoon" | FW-LEAD-LEAKAGE / CTA-LEAD-MAGNET |
| 2 | DM-the-word | "DM 'DEMO' for a 2-min AI-calling demo" | CTA-DEMO |
| 3 | Lead-magnet bait | "Comment 'SHEET' for the free Broker Follow-up Tracker" | CTA-LEAD-MAGNET |
| 4 | Story poll → DM | poll "WhatsApp pe leads sambhalte ho? Haan/Naa" → DM the Haan voters | — |
| 5 | Quiz sticker | "Guess kitne % leads leak hote hain?" → reveal + offer | FW-LEAD-LEAKAGE |
| 6 | Question sticker | "Apni biggest lead problem batao" → reply each in DM | — |
| 7 | "Tag a broker" | "Tag a broker jo aaj bhi Excel pe hai" | CT-DRAMA |
| 8 | Hot-take comment bait | contrarian line → argue → DM the engaged | FW-CONTRARIAN |
| 9 | Before/after reveal | "Full breakdown DM mein" | FW-BAB |
| 10 | Case-study teaser | "Yeh agency ne kaise kiya? DM 'CASE'" | FW-CASE |
| 11 | Mini-audit offer | "Free 10-min pipeline audit chahiye? DM 'AUDIT'" | CTA-DM |
| 12 | AI demo curiosity | "AI ko apne hi lead pe try karna hai? DM 'AI'" | FW-AI |
| 13 | Objection reversal | "'CRM mahanga hai' — numbers DM mein" | FW-OBJECTION |
| 14 | Save→DM | "Save this, fir DM karo apna use-case" | CTA-SAVE |
| 15 | Live/Q&A funnel | go live → answer → push to DM/WhatsApp | — |
| 16 | Comment-to-resource | "Comment 'CRM' — full setup checklist bhejta hoon" | CTA-LEAD-MAGNET |
| 17 | Poll-debate | "Excel vs CRM — vote + reason comment karo" | FW-MYTH |
| 18 | Challenge | "7-din follow-up challenge join karna hai? DM 'CHALLENGE'" | CT-EDU |
| 19 | Behind-the-scenes invite | "Building this live — DM 'BTS' to follow the journey" | CT-FOUNDER |
| 20 | Referral nudge | "Kisi broker ko bhejo jise yeh chahiye — woh DM karega toh free setup" | CTA-SHARE |

---

## 3. DM Reply Flows (verbatim templates)
**Keyword reply (warm):**
> "Arre {{name}} 🙌 yeh raha {{asset}}. Ek quick sawaal — abhi leads WhatsApp/Excel pe ya kisi system pe? Bata do, main exact dikhata hoon RealEstateFlow kaise fit hota hai."

**Qualify (2 Qs only):**
> "Do cheezein — (1) team kitni badi hai? (2) abhi leads kahan track karte ho?" → route: solo→TRIAL, team→DEMO.

**Handoff to WhatsApp:**
> "WhatsApp pe bhej dun? Wahan main AI calling + inventory live dikha dunga, 5 min mein clear ho jayega." → capture number → Sales OS.

**No-reply nudge (24h):**
> "Koi pressure nahi {{name}} — bas yeh 60-sec AI-calling clip dekh lo 👉 {{clip}}."

---

## 4. Comment SOP (the engagement-to-DM engine)
- Reply to EVERY comment in the **first 60 minutes** (algorithm + trust).
- Pin a comment that restates the CTA / keyword / demo prompt.
- Buying-intent comment ("price?", "kaise milega?", "demo?") → "DM kar diya 🙌" → move to DM (never sell in the public thread).
- Heart genuine comments + reply with a question to keep threads alive (each reply = a fresh signal).
- Hide spam/competitor trolling; answer real objections publicly (mini FW-OBJECTION) then take details to DM.

---

## 5. Handoff Contract to Sales OS
When a DM reaches "team + current pain + wants to see it":
1. Create a lead — `leadSource=instagram_dm` (or `instagram_comment`), `contentRef=OPP-*`/reel id (Automation OS attribution).
2. Trigger `sales-os/qualification.md`.
3. Log which `OPP-*`/franchise drove the conversation (content attribution → growth-dashboard).

---

## 6. Metrics
| Metric | Formula | Target |
|---|---|---|
| DM rate | DMs ÷ reach | rising |
| Comment→DM | DMs from comments ÷ intent comments | >50% |
| DM→WhatsApp | numbers captured ÷ DMs | 40% |
| WhatsApp→demo | demos ÷ WhatsApp convos | 30% |

Tracked in `growth-dashboard.md`. The biggest early leverage is usually the DM→WhatsApp step — reduce friction (ask only for the number + offer a live demo).
