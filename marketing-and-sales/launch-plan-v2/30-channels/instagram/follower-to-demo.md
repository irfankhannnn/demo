# Instagram — follower-to-demo journey

> **RealEstateFlow · `@realestateflow`**
> The full path from a **cold viewer at 9 PM** to a **booked demo on WhatsApp** — every stage, its content lever, its CTA, its drop-off and its fix. This is the Instagram-side mirror of `../../40-sales-and-conversion/customer-journey.md`; where this file ends (demo booked), the sales layer picks up (qualification → demo → trial → paid). Works with `reels.md`, `stories.md`, `comments.md`, `dm-workflows.md`, `broadcast-channels.md` and `../../40-sales-and-conversion/dm-to-demo.md`.

**Audience reality:** 60–90 day buying cycle, peer-validation driven, control-anxious owners and admin-exhausted brokers. They move on value, not pressure. Brand copy 70% English / 30% romanized Hindi; Mumbai only in M1.

---

## 1. The Journey (stages, levers, CTAs, handoffs)

```
Cold viewer → Follower → Engaged → DM → WhatsApp → Demo  →(Sales OS: Trial → Paid)
```

| Stage | What moves them | Content / lever | CTA category | Handoff |
|---|---|---|---|---|
| **Cold → viewer** | scroll-stop hook | CT-DRAMA/MEME at 9–11 PM + `HK-*` frame-1 | — (watch) | — |
| **Viewer → follower** | series + profile value | franchises (`reels.md §7`), pinned reels, clear bio, Highlights | FOLLOW | — |
| **Follower → engaged** | save/comment/sticker bait | CT-EDU carousels, poll/quiz stories, comment-bait | SAVE / COMMENT | — |
| **Engaged → DM** | keyword / lead-magnet / question sticker | `comments.md`, `stories.md §4` funnels | DM / LEAD-MAGNET / COMMENT-keyword | open DM thread |
| **DM → WhatsApp** | low-friction value | `dm-workflows.md` qualify → hand-off | WHATSAPP | create lead, send the WhatsApp opener |
| **WhatsApp → demo** | product proof + ROI they calculate themselves | 90-second walkthrough, AI Employee clip (`[REC]`), `../../40-sales-and-conversion/demo-script.md` | DEMO | book slot |

---

## 2. Drop-Off Diagnosis + Fixes

| Stage drop | Symptom | Root cause | Fix |
|---|---|---|---|
| Cold → viewer | low hook / 3-sec rate | weak frame-1 | re-cut the hook from `../../20-content-engine/hooks/hook-library.md`; text readable sound-off; post drama at 9–11 PM |
| Viewer → follower | reach high, follows flat | no reason to follow | launch or strengthen a franchise; rewrite the bio (what + who + the "AI presenter" disclosure); pin 3 reels (franchise + walkthrough + build-in-public) |
| Follower → engaged | followers grow, silent | passive content, no ask | every pain reel gets a SAVE/COMMENT CTA and a question; run story polls daily |
| Engaged → DM | engagement but no DMs | no clear ask / friction | add keyword bait (SYSTEM / KHATA / AUDIT / DEMO) and question stickers; keyword rules once App Review passes, manual before that (`dm-workflows.md` §1) |
| DM → WhatsApp | DMs stall | over-qualifying / pricing-first | 2-question rule; deliver value first; offer a **live** demo, ask only for the number |
| WhatsApp → demo | warm but no booking | no urgency / unaddressed objection | send the 90-second walkthrough and a 60-second AI Employee recording; book a specific slot; route the objection to `../../40-sales-and-conversion/objections.md` |

---

## 3. Conversion benchmarks

These are planning assumptions, not measured rates — we have no funnel history. Replace each one with the real number as soon as a month of data exists. Definitions live in `../../50-measurement/metric-dictionary.md`; results go in `../../50-measurement/weekly-scorecard.md`.

| Step | Benchmark | Notes |
|---|---|---|
| Viewer → follower | **2–4%** | strong franchise + bio |
| Follower → DM (per month) | **~1–2%** | depends on CTA discipline |
| DM → WhatsApp handoff | **~40%** | 2-question rule protects this |
| WhatsApp → demo booked | **~30%** | the walkthrough and a real product recording drive it |
| Demo → trial/paid | see the sales layer | `../../40-sales-and-conversion/customer-journey.md` |

**Worked funnel arithmetic (assumptions, not results):** 50,000 reel reach → ~1,500 followers gained (3%) → ~25 DMs/month (1.5%) → ~10 WhatsApp hand-offs (40%) → ~3 demos (30%) → roughly 1 trial. Multiply across 5–6 reels a week to model monthly demos. Note that the month-1 headline KPI is waitlist signups, not demos (`90-day-growth-strategy.md`).

---

## 4. Worked example — tracing one follower to a demo

> **Hypothetical.** No named agency, no city, no claimed result — this is a walkthrough of the mechanics, not a customer story. We have no customers.

1. **9:40 PM:** a viewer sees OPP-001 ("POV: broker scrolling 200 unread WhatsApp") on the cold feed; the hook stops them because it is their exact evening. *Viewer.*
2. Profile visit → franchise grid, pinned walkthrough, bio with the "AI presenter" disclosure → **follows.** *Follower.*
3. Next morning: the OPP-013 carousel ("100 leads aaye — kitne convert hue?") → **saves** it and comments "sach mein 😩". *Engaged.* Reply inside 60 minutes: "Aapke kitne leak ho rahe? DM mein audit bhejta hoon 🙌"
4. Story poll "Leads kahan? WhatsApp / System" → taps **WhatsApp** → the fix frame says "DM 'AUDIT'" → they DM **AUDIT** → the keyword rule replies, or a person does if App Review is still pending (`dm-workflows.md` §1). *DM.*
5. DM qualification: "6 agents, sab WhatsApp pe" → route DEMO → hand-off: "WhatsApp pe bhej dun? AI Employee ko aapke ek lead pe live dikhata hoon." → they give a number. *WhatsApp.* The Instagram service creates the CRM lead (`source: 'Instagram'`, `sourceAdapter: 'instagram'`, `reelRef`); the `OPP-*` chain (OPP-001 → OPP-013) is written into the tracking sheet by hand.
6. WhatsApp: the 90-second walkthrough plus a 60-second AI Employee screen recording → books a **demo**. *Demo booked → the sales layer takes over.*

The attribution point survives intact: first touch and converting touch are usually different `OPP-*`, and both deserve more production. The June draft made this point with an invented Andheri agency and an invented "~0 leak" result; the mechanics are the same without them.

---

## 5. Attribution and instrumentation

- **What the CRM stores:** `source: 'Instagram'`, `sourceAdapter: 'instagram'`, `externalRef`, `reelRef` (`apps/crm/server/leadIngestion.js`). There is no per-surface source value (`instagram_reel` / `_story` / `_dm`), no `contentRef`, no `utm` on a lead, and `/api/marketing/events` does not exist.
- **So the sheet carries the rest:** originating `OPP-*`, `CTA-*`, surface, persona, team size, current tool, route. Keyed to the lead id.
- **Multi-touch:** record both the *first-touch* content (what made them a viewer) and the *converting* content (what opened the DM) — they are usually different `OPP-*`.
- **Instrumentation that does exist:** UTM is captured at signup (`utm_source`, `apps/crm/server/routes/auth.js`) and PostHog is wired into the CRM. See `../../50-measurement/posthog-event-map.md` and `../../50-measurement/attribution-today.md`.
- **Feedback:** which `OPP-*` drive demos → flag in `../../20-content-engine/content-plan/content-plan-500.csv` → produce more of that angle, CT and language.

> The journey is measured by **demos booked and which content booked them**, not follower count. A follower who never DMs is a vanity number; an `OPP-*` that books three demos a month is the engine.
