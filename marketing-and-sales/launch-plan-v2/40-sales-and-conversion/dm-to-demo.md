# DM to demo

**The system that turns a viewer into a DM, then a WhatsApp chat, then a demo.** This is where attention becomes pipeline. Works with `CTA-*`, `../30-channels/instagram/dm-workflows.md`, `../30-channels/whatsapp/` and the scripts in this folder.

**Used by:** `../week-2-soft-launch/day-09-craft-send-invites.md` · `../week-3-public-launch/day-17-cold-outreach-prep.md`, `day-18-execute-cold-day1.md`, `day-19-cold-day2-iterate.md` · `../week-4-optimize-convert/day-23-followup-non-replies.md`.

> **Meta's limits bind this whole file.** Free-form DMs only inside the 24-hour window; one private reply per comment, within 7 days. The keyword automation is built (`agency-app/instagram-api`, `services/ruleMatcher.js`) but the service is still in Meta Development Mode with App Review pending, so until it passes a person sends every reply by hand, within 15 minutes. Graph API only — never browser automation. Draft, review, send; nothing auto-sends unreviewed.
>
> Open decision D23 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 1. The conversion spine

```
Reel/Story (pain)
   → on-content CTA ("comment AUDIT" / "DM the word DEMO")
   → keyword-rule reply, or a manual one (deliver value + ONE question)
   → qualify in the DM (max 2 questions) → move to WhatsApp (richer demo)
   → demo booked → demo-script.md
```

**Friction law:** each step asks for exactly ONE micro-action. Never ask a cold viewer for a demo — ask for a comment or a word. Escalate the ask only as warmth rises.

---

## 2. Conversation-starter mechanics

The month-1 public keyword set is **SYSTEM · KHATA · AUDIT · DEMO**. Keywords outside that set need a rule configured before they appear in a caption, or the comment arrives and nothing answers it.

| # | Mechanic | Example (Hinglish) | Framework / CTA |
|---|---|---|---|
| 1 | Keyword comment loop | "Comment 'AUDIT' — main leakage audit DM kar deta hoon" | FW-LEAD-LEAKAGE / CTA-LEAD-MAGNET |
| 2 | DM-the-word | "DM 'DEMO' for a 90-second walkthrough" | CTA-DEMO |
| 3 | Lead-magnet bait | "Comment 'KHATA' for the commission tracker" | CTA-LEAD-MAGNET |
| 4 | Story poll → DM | poll "WhatsApp pe leads sambhalte ho? Haan/Naa" → DM the Haan voters | — |
| 5 | Quiz sticker | "Guess karo — aapke kitne leads bina teesre follow-up ke reh gaye?" → reveal + offer | FW-LEAD-LEAKAGE |
| 6 | Question sticker | "Apni biggest lead problem batao" → reply to each in the DM | — |
| 7 | "Tag a broker" | "Tag a broker jo aaj bhi Excel pe hai" | CT-DRAMA |
| 8 | Hot-take comment bait | contrarian line → discussion → DM the engaged | FW-CONTRARIAN |
| 9 | Before/after reveal | "Full breakdown DM mein" | FW-BAB |
| 10 | Product teaser | "AI Employee ne ek lead kaise handle kiya — DM 'DEMO'" | CT-DEMO |
| 11 | Mini-audit offer | "Free 10-min pipeline audit chahiye? DM 'AUDIT'" | CTA-DM |
| 12 | AI curiosity | "AI Employee ko apne ek lead pe dekhna hai? DM 'SYSTEM'" | FW-AI |
| 13 | Objection reversal | "'CRM mahanga hai' — hisaab DM mein, aapke numbers pe" | FW-OBJECTION |
| 14 | Save → DM | "Save this, fir DM karo apna use-case" | CTA-SAVE |
| 15 | Live / Q&A funnel | go live, answer, push to DM or WhatsApp | — |
| 16 | Comment-to-resource | "Comment 'SYSTEM' — full setup checklist bhejta hoon" | CTA-LEAD-MAGNET |
| 17 | Poll debate | "Excel vs system — vote karo aur reason comment karo" | FW-MYTH |
| 18 | Challenge | "7-din follow-up challenge join karna hai? DM 'SYSTEM'" | CT-EDU |
| 19 | Build-in-public invite | "Building this live — DM 'SYSTEM' to follow the journey" | CT-AUTHORITY |
| 20 | Referral nudge | *(gated — see `../30-channels/whatsapp/referral.md`; needs paying customers and a decided reward)* | CTA-SHARE |

**Every asset a mechanic promises must exist before the mechanic ships.** The lead-leakage calculator on the site is still a placeholder (`agency-app/landing-pages/agency-owners/index.html`), and there is no follow-up tracker or setup checklist yet. Mechanic 10 used to be a case-study teaser ("Yeh agency ne kaise kiya? DM 'CASE'"); with zero customers, the product demo replaces it.

---

## 3. DM reply flows (verbatim)

**Keyword reply (warm):**
> "Arre {{name}} 🙌 yeh raha {{asset}}. Ek quick sawaal — abhi leads WhatsApp/Excel pe ya kisi system pe? Bata do, main exact dikhata hoon RealEstateFlow kaise fit hota hai."

**Qualify (2 questions only):**
> "Do cheezein — (1) team kitni badi hai? (2) abhi leads kahan track karte ho?" → route: solo → TRIAL, team → DEMO.

**Hand-off to WhatsApp:**
> "WhatsApp pe bhej dun? Wahan main AI Employee aur inventory live dikha dunga, 5 min mein clear ho jayega." → capture the number → `qualification.md`.

**No-reply nudge (within 24h):**
> "Koi pressure nahi {{name}} — bas yeh 60-second clip dekh lo 👉 {{clip}}."

That nudge has to go inside the 24-hour window. After it, they have to message first.

---

## 4. Comment SOP (the engagement-to-DM engine)

- Reply to **every** comment in the first 60 minutes — algorithm and trust.
- Pin a comment restating the CTA, keyword or demo prompt.
- Buying-intent comment ("price?", "kaise milega?", "demo?") → "DM kar diya 🙌" → move to the DM. Never sell in the public thread.
- Heart genuine comments and reply with a question to keep threads alive; each reply is a fresh signal.
- Hide spam and trolling; answer real objections publicly with a mini FW-OBJECTION, then take the details to the DM.

Remember the one-private-reply-per-comment limit: you get one shot per comment, within 7 days.

---

## 5. Hand-off contract to the sales layer

When a DM reaches "team + current pain + wants to see it":

1. **The lead already exists.** The Instagram service creates it automatically with `source: 'Instagram'`, `sourceAdapter: 'instagram'`, `externalRef` and the reel in `reelRef` (`agency-app/api/leadIngestion.js`, `agency-app/instagram-api/services/crmBridge.js`). Creating a second one by hand duplicates it.
2. **Log the `OPP-*` manually** in the tracking sheet. There is no `leadSource`, `contentRef` or `utm` field on a lead, and `/api/marketing/events` does not exist. The June draft assumed all four.
3. **Check the AI score first.** `lead.created` fires an EventBridge event that runs the AI lead qualifier, so the lead already carries a temperature by the time you look at it (`agency-app/api/scripts/lead-qualifier-handler.js`). Read that, then run `qualification.md` for Warm and above.

---

## 6. Metrics

| Metric | Formula | Target |
|---|---|---|
| DM rate | DMs ÷ reach | rising |
| Comment → DM | DMs from comments ÷ intent comments | >50% |
| DM → WhatsApp | numbers captured ÷ DMs | 40% |
| WhatsApp → demo | demos ÷ WhatsApp conversations | 30% |

Definitions in `../50-measurement/metric-dictionary.md`; reported in `../50-measurement/weekly-scorecard.md`. These are planning assumptions, not measured rates — replace each with the real number once there is a month of data.

The biggest early leverage is usually the DM → WhatsApp step. Reduce the friction: ask only for the number, and offer a live demo.
