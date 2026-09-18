# Attention Model

**How attention actually works for Mumbai real-estate agency owners, and how we engineer it on purpose.** This is the mechanical theory behind every reel. It plugs into [`framework-library.md`](framework-library.md) (`FW-*`), [`content-types.md`](content-types.md) (`CT-*`), [`hooks/hook-library.md`](hooks/hook-library.md) (`HK-*`) and [`ctas/cta-library.md`](ctas/cta-library.md) (`CTA-*`).

> M1 is Mumbai-only; the Pune and Marathi levers below are kept but parked.
> Open decision D24 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`

---

## 1. The Scroll-Stop Equation
> **Stop probability = (Relevance × Emotion × Pattern-Interrupt) ÷ Time-to-hook**

A broker on the 9pm scroll gives each reel ~0.4s to justify itself. To win:
- **Relevance (0–1):** the broker recognises *their own situation* instantly — WhatsApp chaos, lost lead, commission jhagda, AI envy. Generic = 0.
- **Emotion (0–1):** intensity of the feeling triggered. Fear of loss is the strongest lever in this niche.
- **Pattern-interrupt (0–1):** a number, a bold/contrarian claim, a face mid-reaction, a "POV:". (A Marathi opener is a strong lever for Pune — parked under **D24**.)
- **Time-to-hook:** must be **≤1 second**. Every extra second roughly halves the audience that stays.

**Operational rule:** if any of the three multipliers is near zero, the reel dies — no editing trick saves it. Fix the *concept*, not the cut.

---

## 2. The 3-Second Rule (reel anatomy)
| Time | Job | Tool | Failure mode |
|---|---|---|---|
| 0.0–1.0s | Stop the scroll | `HK-*` hook + on-screen text + a face/reaction + bold visual | Slow logo intro, talking warm-up |
| 1–3s | Confirm relevance ("yeh toh main hoon") | name the pain in *their* Hinglish words | Generic claim, no specificity |
| 3–15s | Deliver ONE idea | `FW-*` structure | Two ideas = zero ideas |
| last 2–4s | Convert attention → action | `CTA-*` | No ask, or 3 asks |

**Hook checklist (every reel):** visual change in frame 1 · text on screen in frame 1 · spoken hook is a `HK-*` line · subtitles on (sound-off viewing) · one emotion only.

---

## 3. Pattern Interrupts that work for brokers (ranked)
1. **₹-number on screen** — the viewer's own number, e.g. "Ek bhooli follow-up ki keemat kitni? Apni average commission likho." Never a figure we cannot source.
2. **Mid-action freeze** — CH-OWNER pinching nose, CH-LOSTLEAD frowning at phone.
3. **"Stop doing X"** — "Excel mein CRM band karo."
4. **Contrarian claim** — "Market down nahi, tumhari leakage problem hai."
5. **POV framing** — "POV: 200 unread WhatsApp, ek hot lead dabi hui."
6. **Marathi opener (Pune)** — instant in-group signal, +trust. *Parked: M1 is Mumbai-only (**D24**).*
7. **Direct accusation** — "Tum jise 'busy' kehte ho, woh disorganized hai."
8. **Cliffhanger** — "AI Employee ne raat 2 baje jo kiya, woh dekho…" (shown as a real screen recording, never as a first-person result claim).

---

## 4. The Emotional Trigger Stack (what to pull, when)
Ranked by power in this niche (from market-research §attention currencies):

| Rank | Trigger | Funnel | Best frameworks | Best CT |
|---|---|---|---|---|
| 1 | **Fear of loss** (leads, commission, agent-leaving-with-data) | TOFU reach | FW-FEAR, FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE | CT-DRAMA, CT-EDU |
| 2 | **Greed / money** (more deals, predictable income) | MOFU desire | FW-LEAD-LEAKAGE, FW-BAB | CT-DEMO (CT-CASE is disabled pre-launch) |
| 3 | **Status** (look pro, scale, peer respect) | brand/authority | FW-AUTHORITY, FW-FOUNDER, FW-TEAM | CT-AUTHORITY (CT-FOUNDER runs as an AI-presenter or text post — the founder is never on camera) |
| 4 | **Relatability / entertainment** | reach + follows | FW-DRAMA, FW-SKIT | CT-DRAMA, CT-MEME |
| 5 | **Curiosity / novelty** (AI wow) | reach + differentiation | FW-AI, FW-CURIOSITY | CT-AI |

**Pairing rule:** one trigger per piece. Mixing fear + humour + status dilutes all three.

---

## 5. The Attention → DM Ladder (AIDA, brokerised)
```
Attention  → scroll-stop hook (HK-*)                 [job: reach]      FW-FEAR/DRAMA
Interest   → relatable pain named in ₹/Hinglish       [job: retention]  FW-PAS/WHATSAPP-CHAOS
Desire     → product demo + AI wow + transformation   [job: belief]     FW-DEMO/AI/BAB
Action     → low-friction ask (comment word / DM)     [job: response]   CTA-*
   ↓
Conversation (DM → WhatsApp) → Demo                   [../40-sales-and-conversion/dm-to-demo.md]
```
**One rung per piece.** A reel that tries to do Attention *and* Desire *and* Action usually achieves none. Decide the rung in [`production-pipeline.md`](production-pipeline.md) (Step 1) before writing.

---

## 6. Attention Budgeting (portfolio rule)
Per 10 pieces:
- **5 attention-grabbers** (fear/drama, TOFU) — feed the top of funnel.
- **3 desire/belief** (demo/AI/BAB, MOFU) — convert attention to belief.
- **2 conversion** (demo/objection, BOFU) — book demos.

Slot times are set by the month-1 pack (`marketing-and-sales/realestateflow/content-strategy-first-month/00-START-HERE.md` §7), not here.

This mirrors the [content-plan](content-plan/README.md) score weighting (lead-gen weighted highest, but reach feeds it). Skew too far to BOFU and reach starves; too far to TOFU and no demos.

---

## 7. Measuring attention (the only 3 numbers that matter early)
| Metric | Formula | Target | Fix if low |
|---|---|---|---|
| **Hook rate** | 3s views ÷ reach | >45% | first 1s: hook/visual/text |
| **Hold rate** | avg watch time ÷ length | >55% | pacing, one-idea discipline, cut fluff |
| **Action rate** | (saves+shares+comments+DMs) ÷ reach | rising | CTA clarity + comment-bait |

Tracked in [`../50-measurement/weekly-scorecard.md`](../50-measurement/weekly-scorecard.md). A low hook rate is *never* a topic problem — it is a first-second problem.

---

## 8. Anti-patterns (attention killers — banned)
- Slow logo/gradient intro before the hook.
- Corporate English ("streamline your real-estate workflow").
- Feature with no pain attached.
- Stock photos / no real Indian faces.
- Shuddh Hindi or wrong Marathi (feels fake → instant scroll). Brand copy is 70% English / 30% romanized Hindi.
- Two ideas in one reel.
- No subtitles (most brokers watch sound-off mid-day).
