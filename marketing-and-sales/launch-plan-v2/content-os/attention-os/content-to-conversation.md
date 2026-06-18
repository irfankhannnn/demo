# Attention OS — Content → Conversation

**The system that turns a viewer into a DM, then a WhatsApp chat, then a demo.** This is where attention becomes pipeline. Integrates with `CTA-*`, Sales OS, and `distribution-os/whatsapp/`.

## 1. The Conversion Spine
```
Reel/Story (pain) → on-content CTA ("comment CRM" / "DM the word DEMO")
→ auto/manual DM reply (value + 1 question)
→ qualify in DM (2 Qs) → move to WhatsApp (richer)
→ demo booked → Sales OS demo-script
```
Friction rule: each step asks for only ONE micro-action. Never ask for a demo from a cold viewer — ask for a comment or a word.

## 2. 15 Conversation-Starter Mechanics
1. **Keyword comment loop** — "Comment 'LEAK' and I'll DM you the lead-leakage calculator." (FW-LEAD-LEAKAGE)
2. **DM-the-word** — "DM 'DEMO' for a 2-min AI-calling demo." (CTA-DEMO)
3. **Lead-magnet bait** — "Comment 'SHEET' for the free Broker Follow-up Tracker." (CTA-LEAD-MAGNET)
4. **Story poll → DM** — poll "WhatsApp pe leads sambhalte ho? Haan/Naa" → DM the "Haan" voters.
5. **Quiz sticker** — "Guess kitne % leads leak hote hain?" → reveal + DM offer.
6. **Question sticker** — "Apni biggest lead-management problem batao" → reply each in DM.
7. **"Tag a broker"** — tag mechanic seeds new DMs from the tagged.
8. **Hot-take comment bait** — contrarian line → argue in comments → DM the engaged.
9. **Before/after reveal** — "Full breakdown DM mein" (FW-BAB).
10. **Case-study teaser** — "Yeh agency ne kaise kiya? DM 'CASE'." (FW-CASE)
11. **Mini-audit offer** — "Apni pipeline ka free 10-min audit chahiye? DM 'AUDIT'."
12. **AI demo curiosity** — "AI ko apne hi lead pe try karna hai? DM 'AI'." (FW-AI)
13. **Objection reversal** — answer "CRM mahanga hai" → "Numbers DM mein."
14. **Save→DM** — "Save this, fir DM karo apna use-case."
15. **Live/Q&A funnel** — go live, answer, push to DM/WhatsApp.

## 3. DM Reply Flows (templates)
**Keyword reply (warm):**
> "Arre {{name}} 🙌 yeh raha {{asset}}. Ek quick sawaal — abhi leads WhatsApp/Excel pe ya kisi system pe? Bata do, main exact bata dunga RealEstateFlow kaise fit hota hai."

**Qualify (2 Qs only):** team size? current lead tool? → route: solo→TRIAL, team→DEMO.
**Handoff to WhatsApp:** "WhatsApp pe bhej dun? Wahan main inventory/AI calling live dikha dunga." → number → Sales OS.

## 4. Comment SOP (the engagement-to-DM engine)
- Reply to EVERY comment in first 60 min (algorithm + trust).
- Pin a comment that restates the CTA.
- For buying-intent comments → take to DM, don't sell in public.
- Heart + reply with a question to keep threads alive.

## 5. Handoff contract to Sales OS
When a DM hits "team + current pain + wants to see it" → create a lead (lead source = `instagram_dm`, see Automation OS attribution) and trigger `sales-os/qualification.md`. Log the originating `OPP-*`/reel for content attribution.

## 6. Metrics
DM rate (DMs ÷ reach), DM→WhatsApp rate, WhatsApp→demo rate. Targets and tracking in `growth-dashboard.md`.
