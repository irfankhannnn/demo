# Customer journey

The end-to-end map, and the connective tissue between the channel layer and the scripts in this folder. Every stage has an owner, levers, a conversion target, a drop-off analysis and an instrumentation need. Use it to find where pipeline leaks and what to fix first. Grounded in the 60–90 day buying cycle and the lead-source picture in `../10-audience-and-voice/market-research.md`.

> **The funnel definition itself lives in `../00-PLAN-OVERVIEW.md` §1 and §5.** This file elaborates the stages; it does not redefine them. Where the two disagree, the plan overview wins.

**Used by:** `../week-4-optimize-convert/day-29-revenue-retention-audit.md` directly, and every outreach day file in `../week-2-soft-launch/` … `../week-4-optimize-convert/` as the map they sit on.

## The journey
```
Instagram → DM → WhatsApp → Demo → Trial → Onboarding → Paid Customer → Referral
```

> **The demo wow and the activation event are not settled.** These scripts were written around AI calling — a live call as the demo wow, and "first AI call by Day 2" as the aha. The launch plan wedge is the WhatsApp AI Employee, with activation defined as the owner connecting WhatsApp and the AI Employee handling at least one inbound lead in 7 days. A trial user cannot reach that: the AI Employee is a paid add-on with no trial (`../pricing.json`), while AI call minutes are covered by the trial credit allowance. Both readings are kept below, flagged, and neither is chosen here.
>
> Open decision D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## Stage-by-stage map

| Stage | Owner | Levers | Conversion target | Drop-off cause | Specific improvement |
|---|---|---|---|---|---|
| **Instagram** | `../30-channels/instagram/` | reels, 1-second hooks, series and franchises, bio CTA | ~1–2%/mo of followers → DM | weak hook · no reason to act · unclear bio | Fix the first second; run a hook A/B; pain-led reels (`FW-LEAD-LEAKAGE`, `FW-WHATSAPP-CHAOS`); a bio with one clear CTA and the AI-presenter disclosure |
| **DM** | `dm-to-demo.md` | keyword loops, lead magnets, keyword-rule replies (Instagram service, after App Review — manual before it) | 40% DM → WhatsApp | no CTA in the reply · slow reply (>60 min) · sold too hard | Reply within 60 minutes and inside the 24-hour window; ONE micro-ask; two qualifying questions only; never pitch a cold viewer |
| **WhatsApp** | `../30-channels/whatsapp/lead-nurture.md` + `qualification.md` | speed to lead, a real product clip, two-question qualification | 30% WhatsApp → demo | friction (asks too much) · slow response · no number captured | Ask only for the number; respond within 15 minutes; offer a 90-second live walkthrough (`demo-script.md`) |
| **Demo** | `demo-script.md` | one pain, one wow, persona branch | 40% demo → trial | no-show · feature dump · the wrong pain mirrored back | Reminders and a recorded fallback; tailor to the captured pain; lead with whichever capability fits their pain (D27/CC-3); close with the trial ask |
| **Trial** | `onboarding-script.md` | the first real moment inside 7 days, guided import | 25–35% trial → paid | never activates · stalls at setup | Guided 10-lead import on Day 0; a first AI-handled lead or first AI call by Day 2; proactive WhatsApp; 3 of 4 activation milestones |
| **Onboarding** | `../30-channels/whatsapp/customer-success.md` | week-1 milestones, stall recovery | 90%+ activated → retained | stalls at setup · team will not adopt · confusion | Proactive nudges in the peak windows; team training; the training videos promised in `../pricing.json`; founder escalation for at-risk accounts |
| **Paid** | `../30-channels/whatsapp/customer-success.md` | 30-day ROI review, health scoring, usage reviews | <5% monthly churn | no perceived value · feature underuse · payment failure | Day-30 ROI review in ₹ using their own counts; health scoring (`../50-measurement/customer-health.md`); win-back; expansion to Team / Team+ seats or the AI Employee add-on |
| **Referral** | `../30-channels/whatsapp/referral.md` | post-win ask, rewards, peer-group seeding | 20%+ paid → referral | never asked · asked too early · no reward | Trigger the ask **after the first activation win**. Gated: there is no referral system in the product and the reward is undecided (D29b) |

---

## Conversion targets

**These are planning assumptions, not measured rates.** We have no funnel history — replace each with the real number as soon as there is one. Definitions live in `../50-measurement/metric-dictionary.md`.

IG → DM ~1–2%/mo of followers · DM → WhatsApp **40%** · WhatsApp → demo **30%** · demo → trial **40%** · trial → paid **25–35%** · paid → referral **20%+**.

**End-to-end arithmetic:** 10,000 followers → ~150 DMs/mo → 60 WhatsApp conversations → 18 demos → 7 trials → ~2 paid a month, organic, before any paid ads. The model is unforgiving of mid-funnel leaks — lifting DM → WhatsApp from 40% to 55% roughly doubles the paid customers downstream. M1's own targets are 30–50 trials and 3–5 paying (`../00-PLAN-OVERVIEW.md`), against a month-1 headline KPI of waitlist signups.

---

## Detailed drop-off analysis + improvements

1. **Hook rate (IG → DM) — the biggest volume lever.** Most reach dies in the first second. Fix: pain-recognition hooks brokers actually feel; test three hooks a post; franchise the winners. Lifting 1% to 2% doubles the top of the entire funnel.
2. **DM → WhatsApp friction.** People drop when the reply has no CTA, arrives more than an hour late, or asks for too much. Fix: fast reply, a single micro-ask, two qualifying questions, then "WhatsApp pe live dikha dun?" (`dm-to-demo.md` §3).
3. **Speed to lead (WhatsApp).** The hidden killer: a two-hour reply loses the lead to whoever answered first. Fix: a 15-minute response target and a templated first reply. (The old "15 minutes closes 60% vs 20% after an hour" figure is unsourced and has been dropped — the rule stands without it.)
4. **Demo no-shows.** A large share of booked demos ghost. Fix: a WhatsApp reminder ten minutes before; "apna real lead ready rakhna", which raises commitment; a recorded 90-second fallback.
5. **Trial week-1 activation.** The single biggest retention predictor. Drop-off means they never reached the first real moment. Fix: guided import on Day 0, a first AI-handled lead or AI call by Day 2, proactive stall recovery (`onboarding-script.md`).
6. **Paid churn.** Drop-off means the value was never made concrete. Fix: a Day-30 ROI review in ₹ built from their own counts; health scoring flags the reds early.
7. **Referral ask discipline.** Drop-off means the ask never happened, or happened before the win. Fix: hard-wire it to the first activation win — once there is a referral programme to ask into.

---

## Biggest leverage points (in order)
1. **Hook rate** (top-of-funnel volume). 2. **DM→WhatsApp friction.** 3. **Speed-to-lead.** 4. **Demo no-shows.** 5. **Trial week-1 activation.** 6. **Referral ask discipline.**

---

## Stage-by-stage metrics table (instrument all of these)

| Stage | Primary metric | Secondary | Leading indicator | Source event |
|---|---|---|---|---|
| Instagram | reach → DM rate | hook hold rate, saves and shares | reels published per week | `OPP-*` logged in the tracking sheet |
| DM | DM → WhatsApp rate | reply time, CTA clicks | DMs received | keyword + reel noted in the sheet |
| WhatsApp | WhatsApp → demo rate | response time, qualification completed | numbers captured | `lead.created` (source, sourceAdapter) |
| Demo | demo → trial rate | show rate, pain match | demos booked | demo stage change |
| Trial | trial → paid rate | activation (3 of 4), the Day-2 milestone | trials started | PostHog activation events |
| Onboarding | activation rate | time to the first real moment, milestone count | logins per week | milestone events |
| Paid | monthly churn % | health score, feature adoption | usage frequency | Razorpay + plan |
| Referral | referrals/customer | referral→paid rate | wins captured | referral logged |

---

## Instrumentation — what exists and what does not

**What exists today.** A lead carries `source`, `sourceAdapter`, `externalRef` and `reelRef` (`agency-app/api/leadIngestion.js`) and emits EventBridge `lead.created`, which runs AI qualification. UTM is captured at signup (`utm_source`, `agency-app/api/routes/auth.js`). PostHog is wired into the CRM. Razorpay holds the billing truth. There is an NPS surface in the product.

**What does not exist.** There is no `leadSource` field, no `contentRef`, no per-surface source value, and **no `/api/marketing/events`** — a grep of `apps/`, `services/` and `docs/` returns nothing for it. There is no `MKT_EVENT` store and no marketing data platform. Those were designed in June and never built; see `../50-measurement/design-only-backlog.md`.

**So the contract is:** the CRM and PostHog carry what they carry, and the **tracking sheet carries the rest** — originating `OPP-*`, `CTA-*`, surface, keyword, stage timestamps. It is manual, it is good enough at this volume, and it is honest about being manual. See `../50-measurement/posthog-event-map.md` and `../50-measurement/attribution-today.md`.

Without instrumentation there is no visibility and there are leaks you cannot see — which is, word for word, the problem we sell brokers a fix for.

---

## Hand-off map
- **`../30-channels/instagram/`** owns Instagram and the DM, and hands over via `dm-to-demo.md` §5 — where the lead already exists, created by the Instagram service.
- **`../30-channels/whatsapp/`** carries the conversation: `lead-nurture.md` → `demo-followup.md` → `customer-success.md` → `referral.md`.
- **This folder** owns qualify → demo → close → onboard: `qualification.md` → `demo-script.md` → `closing-script.md` → `onboarding-script.md`.
- **`../50-measurement/`** defines every metric named above and holds the weekly scorecard.
