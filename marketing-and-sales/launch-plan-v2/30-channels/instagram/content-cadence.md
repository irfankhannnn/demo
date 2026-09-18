# Instagram — content cadence

> **RealEstateFlow · `@realestateflow`**
> The weekly and monthly posting calendar that balances **reach (drama) · saves (edu) · demos** while honouring the language mix and the peak-hour windows. This is the operating rhythm that turns the 520-opportunity content plan (`../../20-content-engine/content-plan/content-plan-500.md`, `OPP-*`) into a predictable feed. Works with `reels.md`, `carousels.md`, `stories.md`, `broadcast-channels.md` and `../../20-content-engine/production-pipeline.md`.

**Audience reality:** peak windows **6–8 AM (chai/edu) · 12–1 PM (lunch/meme) · 9–11 PM (drama)**; Friday evening strongest, Monday morning weakest. Those windows are June-2026 desk research, not measured — re-derive them from Instagram Insights after a month of data. Android, sound off. Brand copy is 70% English / 30% romanized Hindi.

**Where this file and the month-1 organic pack disagree, the month-1 pack wins for M1** — it fixes the main daily slot at 9:30 PM IST. Treat the slot table below as the shape to return to afterwards.

---

## 1. Weekly quota (the math)

| Format | Qty/week | Primary goal | Slot |
|---|---|---|---|
| **Reels** | 5–6 | reach + demos | drama 9–11 PM, edu 7–8 AM |
| **Carousels** | 2 | saves | 7–8 AM |
| **Stories** | daily, 4–7 frames | retention + DMs | morning + evening (`stories.md`) |
| **Broadcast** | 2–3 | warm retention | Mon/Wed/Fri |

**Net new "big" pieces ≈ 7–8/week** (reels + carousels) — the CT-* mix below applies to these. Stories and broadcast are nurture layers on top, re-surfacing the same pieces.

The human editor handles about **3 videos a week**. Everything beyond that is `[AI]` generation or a `[REC]` screen recording, so the quota above only works if the routing in `../../20-content-engine/README.md` is respected.

---

## 2. CT-* mix ratio (per ~8 reels + carousels)

| CT | Qty | Job |
|---|---|---|
| CT-DRAMA | ×2 | reach (flagship) |
| CT-EDU | ×2 | saves (highest-volume pillar) |
| CT-DEMO | ×2 | demos — real screen recordings (`[REC]`) |
| CT-AI | ×1 | differentiation, via the WhatsApp AI Employee |
| CT-AUTHORITY | ×1 | brand |
| (+ CT-MEME / CT-UGC opportunistic) | flex | cheap reach |

CT-CASE and CT-PROOF held a slot in the June draft. They have none now — zero customers, zero testimonials. That slot became a second CT-DEMO.

> Sprint overrides (`../../20-content-engine/content-plan/content-plan-500.md` §5): reach week → more CT-MEME/CT-DRAMA; lead-gen week → filter `cta_category=DEMO/TRIAL` and add CT-DEMO/CT-UGC. The Pune filter is out of scope for M1.
>
> Open decision D24 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 3. Weekly theme-days (appointment viewing) + example `OPP-*`

Series run on fixed weekdays so followers return for the next episode (the series loop, `growth-loops.md` §3; franchises in `reels.md` §7).

| Day | Series | CT | Week 1 OPP | Week 2 OPP | Slot |
|---|---|---|---|---|---|
| **Mon** | "Broker ki Galti #N" | CT-EDU | OPP-296 (deal gaya kahan) | OPP-321 (3 follow-up bhoolte) | 7–8 AM |
| **Tue** | Feature spotlight | CT-DEMO `[REC]` | OPP-443 (WhatsApp capture) | Property page + booking link | 12–1 PM |
| **Wed** | Drama skit | CT-DRAMA | OPP-001 (200 unread POV) | OPP-006 (the deal nobody followed up) | 9–11 PM |
| **Thu** | Product walkthrough | CT-DEMO `[REC]` | Khata book: commission split | Team hierarchy + member access | 7–8 AM |
| **Fri** | "AI Employee ne kya kiya" | CT-AI `[REC]` | OPP-192 ("aaj ke meetings" on WhatsApp) | AI Employee qualifying an inbound lead | 9–11 PM (strongest) |
| **Sat** | Meme / relatable + UGC | CT-MEME / CT-UGC | OPP-435 (2026, abhi Excel) | OPP-436 (follow-up ka reminder) | 12–1 PM |
| **Sun** | Authority | CT-AUTHORITY | OPP-383 (launch day) | OPP-088 (built for Indian broking) | 6–8 PM |

Thursday used to be "case study / proof", drawing on OPP-280 (Arjun 5→12) and OPP-372 (Andheri ~0 leak). Both are invented customers that live in the content plan CSV. The Friday slot claimed overnight AI calling, which the product does not do — the follow-up agent calls only inside the tenant's business hours. Both days now run real screen recordings.

> Open decision D26 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

Carousels ride Monday (Broker ki Galti) and Thursday (product walkthrough). Stories re-surface that day's piece each morning (`stories.md` §2).

---

## 4. Language-mix balancing

**For M1 the mix is the brand rule: 70% English / 30% romanized Hindi, and 0% Marathi.** M1 is Mumbai only, so there is no Pune segment to serve.

Three splits exist in the repo and they are not the same scope: 70/30 for brand copy, 60/25/15 (EN/Hinglish/Marathi) for ads and social in the decisions log, and 55/30/15 in the old language-strategy doc. `../../10-audience-and-voice/brand-constants.md` records all three with their scopes. Do not silently pick one.

> Open decision D24 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

Per week (of ~8 pieces): ~5–6 hi-dominant/mixed, ~2–3 en-leaning (owner credibility, LinkedIn cross-post). Tag every piece's `language` in the content plan so the monthly split is checkable.

---

## 5. Batch-production workflow

Produce a **week in one sitting** to keep the presenter consistent and the pipeline efficient.

1. **Pull** ~8 `OPP-*` for the week from `../../20-content-engine/content-plan/content-plan-500.csv` (by theme-day CT and language).
2. **Route** each piece `[AI]` / `[REC]` / `[ED]` per `../../20-content-engine/README.md`. `[ED]` work goes out as an `EDITOR-JOBCARDS/` hand-off and is capped at about 3 videos a week.
3. **Group by preset** — generate all presenter pieces in one Higgsfield session per Soul ID and VP preset.
4. **Run the pipeline** (`../../20-content-engine/production-pipeline.md`): hook → framework → dialogue → VO/subtitles → `CTA-*`.
5. **Render** in `marketing-and-sales/video-projects/my-video/` where a render is needed; export covers (`VP-THUMB-*`); name assets `REF-<TYPE><NN>-<slug>-v<N>` under `marketing-and-sales/creative/`.
6. **Publish** the week to Instagram and Facebook at the slot table below. The Blotato MCP is configured in `.mcp.json` and can schedule feed posts; Stories, broadcast and every reply stay manual either way. YouTube is parked.
   > Open decision D22 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md
7. **Stories and broadcast** batched separately (`stories.md` §7, `broadcast-channels.md` §3).

---

## 6. Slot-time table (IST, by content type)

| Content type | Best slot | Why |
|---|---|---|
| Drama / meme | **9–11 PM** | wind-down, highest reach |
| Educational / carousel | **7–8 AM** | chai-scroll, save-mindset |
| Demo / BOFU | **Fri/Sat 1–2 PM and 9 PM** | buying-intent windows |
| Authority | **6–8 PM** | reflective, follow-mindset |
| AI Employee | **Fri 9–11 PM** | strongest engagement day |
| Stories | spread 6–8 AM / 12–1 PM / 6–8 PM | three peak windows (`stories.md` §2) |

---

## 7. Monthly view

| Week | Theme | Emphasis |
|---|---|---|
| W1 | Launch / refresh franchises | reach-heavy (drama, meme); find what pops |
| W2 | Double down on the top series | mix reach and saves |
| W3 | Product + conversion push | more CT-DEMO, lead-gen sprint |
| W4 | Authority + community + recap | brand, nurture, plan next month |

Monthly totals ≈ 22–24 reels, 8 carousels, ~30 story-days, ~10 broadcast drops. Re-balance language to the brand rule. Retire low-hook-rate formats; keep the presenter (`reels.md` §10).

---

## 8. Sourcing from the content plan

Every slot is filled from `../../20-content-engine/content-plan/content-plan-500.csv`, not invented:

- **Default:** pull the highest-priority `OPP-*` whose `content_type` matches the theme-day's CT and whose `language` matches the slot.
- **Rule of thumb:** ~60% from the Strong (6.5–7.9) band, ~25% high-reach memes and dramas, ~15% deep lead-gen (demo/UGC with DEMO or TRIAL CTAs).
- New `OPP-*` sourced from comment research (`comments.md` §6) feed back into the CSV.
- **Any `OPP-*` that asserts a customer, a count or an unsourced number is not shippable** — several in the CSV do. Check it against `../../10-audience-and-voice/claims-and-proof-policy.md` before it enters a slot.
- The day files in `../../week-1-foundation/` … `../../week-4-optimize-convert/` are the live schedule; this file is the rhythm they run on.

> Cadence is judged by **consistency and balance**: did we ship the quota, hit the language split, and keep each franchise on its weekday? Misses break appointment viewing and the series loop.
