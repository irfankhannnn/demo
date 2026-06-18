# Instagram — Follower-to-Demo Journey

> **Phase 3 · Instagram Subsystem · RealEstateFlow (brand: RealtyFlow) · @realtyflow_india**
> The full path from a **cold viewer at 9 PM** to a **booked demo on WhatsApp** — every stage, its content lever, its CTA, its drop-off, and its fix. This is the Instagram-side mirror of Sales OS `customer-journey.md`; where this file ends (demo booked) Sales OS picks up (qualification → demo → trial → paid). Integrates with `reels.md`, `stories.md`, `comments.md`, `dm-workflows.md`, `broadcast-channels.md`, and `content-to-conversation.md`.

**Audience reality:** 60–90 day buying cycle (research §2.3), peer-validation driven, control-anxious owners + admin-exhausted brokers. They move on value, not pressure. Hinglish 70/30 + Marathi for Pune.

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
| **DM → WhatsApp** | low-friction value | `dm-workflows.md` qualify → handoff | WHATSAPP | create lead, send WA template |
| **WhatsApp → demo** | proof + AI-wow + ROI | case study + AI clip + Sales OS `demo-script.md` | DEMO | book slot |

---

## 2. Drop-Off Diagnosis + Fixes

| Stage drop | Symptom | Root cause | Fix |
|---|---|---|---|
| Cold → viewer | low hook/3-sec rate | weak frame-1 | re-cut hook from `07-hook-library.md`; text readable sound-off; post drama at 9–11 PM |
| Viewer → follower | reach high, follows flat | no reason to follow | launch/strengthen a franchise; rewrite bio (what + who + proof); pin 3 reels (franchise+demo+proof) |
| Follower → engaged | followers grow, silent | passive content, no ask | every pain reel gets a SAVE/COMMENT CTA + a question; run story polls daily |
| Engaged → DM | engagement but no DMs | no clear ask / friction | add keyword bait (LEAK/DEMO) + question stickers; auto-replies live (`dm-workflows.md §1`) |
| DM → WhatsApp | DMs stall | over-qualifying / pricing-first | 2-question rule; deliver value first; offer **live** demo, ask only for number |
| WhatsApp → demo | warm but no booking | no urgency / unaddressed objection | send case (OPP-280/372) + 60-sec AI clip; book a specific slot; route objection to `objections.md` |

---

## 3. Conversion Benchmarks (tune in `growth-dashboard.md`)

| Step | Benchmark | Notes |
|---|---|---|
| Viewer → follower | **2–4%** | strong franchise + bio |
| Follower → DM (per month) | **~1–2%** | depends on CTA discipline |
| DM → WhatsApp handoff | **~40%** | 2-question rule protects this |
| WhatsApp → demo booked | **~30%** | proof + AI clip drives it |
| Demo → trial/paid | Sales OS | `customer-journey.md` |

**Worked funnel example:** 50,000 reel reach → ~1,500 followers gained (3%) → ~25 DMs/month (1.5%) → ~10 WhatsApp handoffs (40%) → ~3 demos (30%) → Sales OS converts ~1 trial. Multiply across 5–6 reels/week to model monthly demos (`90-day-growth-strategy.md` KPIs).

---

## 4. Worked Example — Tracing One Follower to a Demo

> **Rajesh (CH-OWNER archetype, Andheri, 6-agent agency).**
1. **9:40 PM:** sees OPP-001 ("POV broker scrolling 200 unread WhatsApp") on the cold feed → hook stops him (relatable, research §5.1). *Viewer.*
2. Profile visit → sees "Apna Properties" franchise grid + pinned demo + "RESULTS 📈" Highlight → **follows.** *Follower.*
3. Next morning: OPP-013 carousel ("100 leads → 12 convert") → **saves** it + comments "sach mein 😩". *Engaged.* (60-min reply: "Aapki agency mein kitne leak ho rahe? DM mein leakage calculator bhejta hoon 🙌")
4. Story poll "Leads kahan? WhatsApp/System" → taps **WhatsApp** → fix-frame "DM 'LEAK'" → he comments/DMs **LEAK** → auto-reply fires the calculator (`dm-workflows.md §1`). *DM.*
5. DM qualify: "6 agents, sab WhatsApp pe" → route DEMO → handoff: "WhatsApp pe bhej dun? aapke ek lead pe AI call live dikhata hoon." → gives number. *WhatsApp.* (lead created: source=`instagram_dm`, OPP-id=OPP-001→OPP-163)
6. WhatsApp: sent OPP-372 (Andheri ~0 leak case) + 60-sec AI clip → books **demo** Sat 1 PM. *Demo booked → Sales OS.*

Every step logged its OPP-id → attribution shows OPP-001 sourced the viewer, OPP-163 sourced the DM. Both get more production budget.

---

## 5. Attribution & Instrumentation

- **Tag on every lead:** `source` (instagram_reel / _carousel / _story / _comment / _dm), **originating OPP-id**, **CTA-id**, persona, team-size, current-tool, city (Pune flag).
- **Multi-touch:** capture both the *first-touch* content (viewer) and the *converting* content (DM trigger) — they're often different OPP-* (see §4).
- **Instrumentation:** keyword auto-replies (`dm-workflows.md §1`) tag the keyword; story link stickers tag per CTA-id (`stories.md §8`); UTM on demo/trial links.
- **Feedback:** which OPP-* drive demos → flag in `04-content-plan-500.csv` → produce more of that angle/CT/language (the content plan's loop, §5).
- **Dashboard:** stage-by-stage funnel + per-OPP demo attribution in `growth-dashboard.md`.

> The journey is measured by **demos booked + which content booked them**, not follower count. A follower who never DMs is a vanity number; an OPP-* that books 3 demos/month is the engine.
