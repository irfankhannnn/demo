# Sales OS — Customer Journey

The end-to-end map and the connective tissue across **Attention**, **Distribution**, **Sales**, and **Automation** OS. Every stage has an owner, levers, conversion target, drop-off analysis, and instrumentation needs. Use this to find where pipeline leaks and what to fix first. Grounded in research §2.3 (60–90 day cycle) and §5 (lead sources).

## The journey
```
Instagram → DM → WhatsApp → Demo → Trial → Onboarding → Paid Customer → Referral
```

---

## Stage-by-stage map

| Stage | Owner | Levers | Conversion target | Drop-off cause | Specific improvement |
|---|---|---|---|---|---|
| **Instagram** | Content OS / Attention OS | reels, 1-sec hooks, series/franchises, bio CTA | ~1–2%/mo of followers → DM | weak hook · no reason to act · unclear bio | Fix the 1-sec hook; run hook A/B (`ab-test-setup`); pain-led reels (`FW-LEAD-LEAKAGE`, `FW-WHATSAPP-CHAOS`); bio with one clear CTA |
| **DM** | `content-to-conversation.md` | keyword loops, lead magnets, auto-reply | 40% DM → WhatsApp | no CTA in reply · slow reply (>60 min) · sold too hard | Auto-reply <60 min; ONE micro-ask (`CTA-LEAD-MAGNET`); 2-Q qualify only; never pitch a cold viewer |
| **WhatsApp** | `lead-nurture.md` + `qualification.md` | speed-to-lead, AI clip, 2-Q qualify | 30% WhatsApp → demo | friction (asks too much) · slow response · no number captured | Ask only the number; respond ≤15 min (research §5 = 60% vs 20%); offer 2-min live demo (`demo-script.md` short) |
| **Demo** | `demo-script.md` | one pain → AI-calling wow, persona branch | 40% demo → trial | no-show · feature dump · wrong pain mirrored | Reminders + recorded fallback; tailor to captured pain; lead with live AI call; close with trial ask |
| **Trial** | `onboarding-script.md` | aha in 7 days, guided import, Day-2 AI call | 25–35% trial → paid | never activates · no AI call · stalls at setup | Guided 10-lead import on Day 0; **AI call by Day 2**; proactive WhatsApp; 3/4 activation milestones |
| **Onboarding** | `customer-success.md` | week-1 milestones, stall-recovery | 90%+ activated → retained | stalls at setup · team won't adopt · confusion | Proactive nudges in peak windows; team training; Loom tutorials; founder escalation for at-risk |
| **Paid** | `customer-success.md` | 30-day ROI review, health scoring, usage reviews | <5% monthly churn | no perceived value · feature underuse · payment fail | Day-30 ROI review in ₹; health scoring; win-back; expansion to Growth (`paywall-upgrade-cro`) |
| **Referral** | `referral.md` | post-win ask, rewards, peer-group seeding | 20%+ paid → referral | never asked · asked too early · no reward | Trigger ask **after first activation win**; reward; ride peer-validation (research §2.3) |

---

## Conversion targets (tune in growth-dashboard)
IG→DM ~1–2%/mo of followers · DM→WhatsApp **40%** · WhatsApp→demo **30%** · demo→trial **40%** · trial→paid **25–35%** · paid→referral **20%+**.

**End-to-end illustration:** 10,000 followers → ~150 DM/mo → 60 WhatsApp → 18 demos → 7 trials → ~2 paid/mo (organic, before paid ads). The model is unforgiving of mid-funnel leaks — a 40%→55% DM→WhatsApp lift roughly *doubles* paid customers downstream.

---

## Detailed drop-off analysis + improvements

1. **Hook rate (IG → DM) — biggest volume lever.** Most reach dies in the first second. Fix: pain-recognition hooks brokers *feel* (research §10 emotional moments); test 3 hooks/post; franchise the winners. A 1%→2% lift doubles the entire funnel's top.
2. **DM → WhatsApp friction.** Drop-off when the reply has no CTA, comes >60 min late, or asks for too much. Fix: instant auto-reply, single micro-ask, qualify in 2 questions, then "WhatsApp pe live dikha dun?" (`content-to-conversation.md` §3).
3. **Speed-to-lead (WhatsApp).** The hidden killer — a 2-hour reply loses the lead to a faster competitor (research §5). Fix: ≤15-min response SLA; templated first reply.
4. **Demo no-shows.** ~30–40% of booked demos ghost. Fix: WhatsApp reminder 10 min before; "apna real lead ready rakhna" (raises commitment); recorded 2-min fallback for no-shows.
5. **Trial week-1 activation.** The single biggest retention predictor. Drop-off = never fires an AI call. Fix: guided import Day 0, **AI call by Day 2**, proactive stall-recovery (`onboarding-script.md`).
6. **Paid churn.** Drop-off = value never made concrete. Fix: Day-30 ROI review in ₹; health scoring flags reds early.
7. **Referral ask discipline.** Drop-off = simply never asked, or asked before the win. Fix: hard-wire the ask to the first activation win.

---

## Biggest leverage points (in order)
1. **Hook rate** (top-of-funnel volume). 2. **DM→WhatsApp friction.** 3. **Speed-to-lead.** 4. **Demo no-shows.** 5. **Trial week-1 activation.** 6. **Referral ask discipline.**

---

## Stage-by-stage metrics table (instrument all of these)

| Stage | Primary metric | Secondary | Leading indicator | Source event |
|---|---|---|---|---|
| Instagram | reach → DM rate | hook hold-rate, saves/shares | reels published/wk | content attribution (`OPP-*`) |
| DM | DM→WhatsApp rate | reply time, CTA-click | DMs received | DM logged w/ keyword + reel |
| WhatsApp | WhatsApp→demo rate | response SLA, qualify completion | numbers captured | lead created (source, segment, pain) |
| Demo | demo→trial rate | show-rate, pain-match | demos booked | demo_done stage event |
| Trial | trial→paid rate | activation (3/4), Day-2 AI call | trials started | activation-scoring events |
| Onboarding | activation rate | time-to-aha, milestone count | logins/wk | milestone events |
| Paid | monthly churn % | health score, feature adoption | usage frequency | paid stage, MRR, plan |
| Referral | referrals/customer | referral→paid rate | wins captured | referral logged |

---

## Instrumentation (designed in Automation OS — without it you're blind)
Every stage needs: **lead source** (e.g. `instagram_dm`), **content attribution** (originating `OPP-*` / reel / `FW-*`), **stage timestamps** (to compute velocity + drop-off), **activation events** (lead added, follow-up set, **first AI call**, team invited), and **MRR/plan**. These tie to Automation OS attribution + activation-scoring and surface in growth-dashboard. **No instrumentation = no visibility = leaks you can't see** — the exact problem we sell brokers a fix for.

---

## Cross-OS handoff map
- **Attention OS** owns Instagram + DM → hands to Sales OS via `content-to-conversation.md` §5 (creates the lead).
- **Distribution OS** (`whatsapp/`) carries the conversation: `lead-nurture.md` → `demo-followup.md` → `customer-success.md` → `referral.md`.
- **Sales OS** owns qualify → demo → close → onboard (`qualification.md` → `demo-script.md` → `closing-script.md` → `onboarding-script.md`).
- **Automation OS** instruments every stage + scores activation and feeds the dashboard.
