# Workflow Catalog (Phase 13 — The 12 End-to-End Workflows)

The complete, production-ready catalog of marketing/sales/lifecycle automations that run on the automation runtime (`automation-architecture.md`). This **supersedes and extends** the 9 workflows in `../../automation-os/workflow-map.md` (which now points here) to **12** — adding `demo_completed`, `customer_at_risk`, and `customer_expanded` as first-class flows.

Each workflow (`WF-*`) is a per-tenant `RULE` (schema in `automation-architecture.md` §3.1). Every action names its exact **service / entity / channel**, re-emits a `MKT_EVENT`, is idempotent + consent-gated, and ties to a **metric** and **engineering task**. Spend/publish actions are human-in-the-loop.

---

## Triggers catalog

| Trigger (`MKT_EVENT.type`) | Source | Dedupe key | Carries | Fires WF |
|---|---|---|---|---|
| `content_published` | Blotato webhook / scheduler | `blotato:{postId}` | OPP-*, asset, platform | WF-01 |
| `comment` | IG/FB webhook | `{plat}:cmt:{id}` | text, user, contentRef | WF-02 |
| `dm` | IG/WhatsApp webhook | `{plat}:msg:{id}` | text, user, contentRef | WF-03 |
| `lead_magnet_download` / web form | web/WA | `web:lm:{subId}` | asset, contact, consent | WF-04 |
| `demo_requested` | DM/web/calendar | `{src}:dreq:{id}` | contact, pain | WF-05 |
| `demo_booked` | calendar/ai_call | `cal:{bookingId}` | slot, leadRef | WF-05 |
| `demo_completed` | calendar/SDR mark | `cal:done:{bookingId}` | outcome, objection | WF-06 |
| `trial_started` | product/app | `app:trial:{userId}` | userId, plan, segment | WF-07 |
| `trial_inactive` | nightly scoring | `app:inact:{userId}:{day}` | userId, lastLogin | WF-08 |
| `milestone_hit` | product/ai_call | `app:ms:{userId}:{ms}` | milestone (M1–M7) | WF-07/09 |
| `customer_activated` | product (3/4 core) | `app:act:{userId}` | userId, milestones | WF-09 |
| `paid` | billing | `billing:{invoiceId}` | plan, amount | WF-09 (cancel nurture) |
| `health_critical` / at_risk | nightly customer-scoring | `app:risk:{userId}:{day}` | healthScore, signals | WF-10 |
| `referral_sent` / `referral_converted` | referralService | `ref:{code}:{stage}` | referrerId, code | WF-11 |
| `expansion_signal` / `paid` (upgrade) | billing/usage scoring | `billing:exp:{invoiceId}` | from→to plan, seats | WF-12 |

Cross-system links: events → `../attribution/events.md`; scores used as conditions → `../lead-scoring/lead-scoring-engine.md`, `../activation/milestones-and-score.md`, `../customer-scoring/`; rewards → `../referrals/`.

---

## WF-01 — New Content Published
- **Trigger:** `content_published` (Blotato webhook / scheduler).
- **Conditions:** `contentRef` present (OPP-*); not duplicate (`blotato:{postId}`).
- **Actions:** `lead.n/a`; write `MKT_EVENT(content_published)` → opens attribution window; `notify(team, "content_live")` via `notificationDynamodbService`; register OPP-* as attribution denominator; arm DM/comment attribution to this asset (hourly insights puller → `impression`/`engagement`).
- **Notifications:** in-app to Content/Distribution agents.
- **Metric:** content-ROI baseline; reach→DM rate by OPP- *; hook rate.
- **Outcome:** every published piece becomes measurable; later customers trace to `OPP-*`.
- **Eng task:** Blotato webhook route + insights puller (EventBridge hourly). Maps E-AUTO-1.

## WF-02 — Comment Received
- **Trigger:** `comment` (IG/FB webhook).
- **Conditions:** buying-intent keyword match (`regex` PRICE/DEMO/"kitna"/"price"); not spam; rate-cap not hit.
- **Actions:** if intent → `whatsapp.send`/IG auto-DM (content-to-conversation template, **consent-safe public reply only**); `MKT_EVENT(comment)`; `lead.upsert(source=instagram_comment, contentRef)` if identifiable; `notify(SDR)` on strong intent.
- **Notifications:** SDR/Sales agent flag.
- **Metric:** comment→DM rate; engagement depth (feeds lead INTENT score).
- **Outcome:** comments convert to conversations without manual monitoring.
- **Eng task:** comment webhook + auto-DM adapter + rate-limiter. E-AUTO-3.

## WF-03 — DM Received
- **Trigger:** `dm` (IG/WhatsApp webhook).
- **Conditions:** inbound (not echo); dedupe by message id.
- **Actions:** keyword `whatsapp.send` auto-reply; `lead.upsert` via `crmDynamodbService` (`source=instagram_dm`, `contentRef=OPP-*`, `consent` from opt-in); `score.recompute(lead)`; if INTENT keyword + phone + consent → `aiCall.place` (`ai-calling-service`, async, idempotent by leadId+day); `notify(SDR)` if Hot (`leadScore≥70`).
- **Notifications:** SDR; speed-to-first-reply < 5 min.
- **Metric:** DM→lead rate; speed-to-lead; Hot-lead count.
- **Outcome:** every DM = attributed, scored, auto-qualified lead.
- **Eng task:** IG/WA webhook + lead upsert + ai-call trigger. E-AUTO-2/3. (Diagram A in architecture.)

## WF-04 — Lead Captured
- **Trigger:** `lead_magnet_download` / web form submit (UTM).
- **Conditions:** `consent.whatsapp || consent.email` (opt-in checkbox); valid contact.
- **Actions:** deliver asset (`email.send`/`whatsapp.send`); `lead.upsert(source=lead_magnet|web, utm*, campaignId, contentRef)`; `score.recompute`; `sequence.enroll(nurture, channel per consent)`; `notify(owner_role, "new_lead")`.
- **Notifications:** Owner/SDR in-app.
- **Metric:** download→demo rate; lead source quality (+18 score); CAC by campaign.
- **Outcome:** captured leads enter a measured nurture path, attributed to channel + content.
- **Eng task:** web events route (`POST /api/marketing/events`) + nurture sequence. E-AUTO-4.

## WF-05 — Demo Requested
- **Trigger:** `demo_requested` → `demo_booked`.
- **Conditions:** slot available (IST, no double-book); lead resolved.
- **Actions:** `lead.update(stage=demo)`; create demo event (Calendar); `sequence.enroll(demo_reminder)` → T-24h / T-1h via `SCHEDULED_NOTIFICATION`; `notify(SDR)` + attach qualification brief (from `lead-scoring`); `score.recompute(+25 intent)`.
- **Notifications:** SDR reminder + brief; lead reminder (WhatsApp, consent).
- **Metric:** demo no-show rate (<25% target); demo-request→booked; north-star (qualified demos/wk = `demo_booked AND leadScore≥40`).
- **Outcome:** booked, prepped, reminded demos; fewer no-shows.
- **Eng task:** calendar integration + reminder sequence. E-AUTO-4.

## WF-06 — Demo Completed *(new — extends the 9)*
- **Trigger:** `demo_completed` (calendar / SDR marks done).
- **Conditions:** demo marked done; objection/outcome captured.
- **Actions:** `lead.update(stage=post_demo)`; branch — if positive → `sequence.enroll(trial_push)` + `notify(SDR, "send trial link")`; if objection → `sequence.enroll(objection_handling)` (Sales/Customer-Success agent draft, **HIL send**); `score.recompute`; if no-show → `sequence.enroll(reschedule)`.
- **Notifications:** SDR next-step task; founder if high-value.
- **Metric:** demo→trial conversion; objection-type distribution; no-show recovery.
- **Outcome:** no demo goes cold; objections get a structured follow-up.
- **Eng task:** demo-completed event + branch rules + objection sequence. E-AUTO-2.

## WF-07 — Trial Started
- **Trigger:** `trial_started` (product).
- **Conditions:** new trial; segment (solo/agency) resolved.
- **Actions:** `sequence.enroll(onboarding_7d)` (channel per consent); Day-2 `aiCall.place` activation nudge; start `score.recompute(activation)` tracking; `notify(CS agent)`; cancel-on-activation guard.
- **Notifications:** CS in-app; lead onboarding drip.
- **Metric:** week-1 activation rate (3/4 core milestones, `activation/milestones-and-score.md`); time-to-first-AI-call (M3 AHA).
- **Outcome:** trials are actively driven to the aha moment, not left alone.
- **Eng task:** onboarding sequence + activation tracking hook. E-AUTO-4.

## WF-08 — Trial Inactive
- **Trigger:** `trial_inactive` (nightly scoring, no login 48h/7d).
- **Conditions:** trial active; not converted; touch-cap not hit; `consent` for channel.
- **Actions:** `sequence.enroll(winback)` — step1 personal WhatsApp nudge, step2 (T+2d) setup-call offer (`aiCall.place`/calendar), step3 (T+4d) founder escalation `notify`; `MKT_EVENT(at_risk)`; **cancel on login/reply/paid**.
- **Notifications:** founder/CS escalation; lead win-back touches.
- **Metric:** reactivation rate; trial→paid recovery.
- **Outcome:** inactive trials get a capped, cancellable win-back before they lapse.
- **Eng task:** nightly inactivity scan + winback sequence + cancel rules. E-AUTO-4/5. (Diagram B.)

## WF-09 — Customer Activated
- **Trigger:** `customer_activated` (3/4 core milestones) / `paid`.
- **Conditions:** genuine value reached (core-4 hit); `paid` cancels open nurture/winback.
- **Actions:** `whatsapp.send` congrats; `lead.update(stage=customer)`; `sequence.enroll(post_activation)` → schedule usage review; `referral.issue` (referral ask) + case-study request; `score.recompute(health baseline)`; cancel nurture/winback enrollments.
- **Notifications:** CS celebrate; founder for case-study candidates.
- **Metric:** activation→referral rate; NPS; trial→paid.
- **Outcome:** activation triggers expansion+advocacy motions at the moment of peak value.
- **Eng task:** activation/paid events + referral issue + cancel rules. E-AUTO-3.

## WF-10 — Customer At Risk *(new — extends the 9)*
- **Trigger:** `health_critical` / at_risk (nightly customer-scoring, `healthScore<40`).
- **Conditions:** active customer; risk signals (login decay, support flags, AI-call usage drop); not already in save-flow.
- **Actions:** `notify(CS agent)` priority alert + risk reason; `sequence.enroll(save_flow)` — proactive check-in (`whatsapp.send`/`aiCall.place`), value reminder, offer (HIL if discount); `lead.update(stage=at_risk)`; `score.recompute`.
- **Notifications:** CS + founder for high-LTV accounts.
- **Metric:** churn rate; save rate (at-risk→healthy); NRR.
- **Outcome:** churn caught before renewal, not after cancel.
- **Eng task:** customer-scoring nightly + at-risk event + save sequence. Links `../customer-scoring/`. E-AUTO-4.

## WF-11 — Referral Generated
- **Trigger:** `referral_sent` / `referral_converted` (referralService).
- **Conditions:** valid code; anti-abuse (not self-referral, unique referee); reward **on `paid` only**.
- **Actions:** `referral.issue` (create REFERRAL + code) on ask; on signup `lead.upsert(source=referral, refereeLeadId)`; on referee `paid` → `referral.reward` (ledger) + `notify(referrer)`; `score.recompute(referee +25 source)`.
- **Notifications:** referrer reward confirmation; CS thank-you.
- **Metric:** referral % of new customers; referral CAC (cheapest channel); viral coefficient.
- **Outcome:** the lowest-CAC channel is tracked + rewarded automatically, abuse-safe.
- **Eng task:** referralService + reward ledger + anti-abuse guard. Links `../referrals/`. E-AUTO-3.

## WF-12 — Customer Expanded *(new — extends the 9)*
- **Trigger:** `expansion_signal` (usage scoring) / `paid` (upgrade).
- **Conditions:** healthy customer (`healthScore≥70`); usage near plan limit (leads/seats/AI-call minutes) OR expansion signal.
- **Actions:** `notify(CS agent, "expansion ready")`; `sequence.enroll(expansion_offer)` — value-based upgrade nudge (in-app + `whatsapp.send`); **HIL** for any priced offer; on `paid` upgrade → `MKT_EVENT(paid, from→to plan)` + `referral.issue` (happy-customer ask); `score.recompute`.
- **Notifications:** CS expansion task; founder for enterprise jumps.
- **Metric:** expansion revenue; NRR/upsell rate; seat growth.
- **Outcome:** account growth is triggered by real usage signals, not random outreach.
- **Eng task:** usage-threshold scoring + expansion event + offer sequence. Links `../customer-scoring/`. E-AUTO-4.

---

## Workflow → metric → system map

| WF | Stage | North-star contribution | Score input | Cross-system |
|---|---|---|---|---|
| WF-01 | content | content ROI denominator | — | attribution |
| WF-02 | engagement | comment→DM | INTENT/engagement | attribution, lead-scoring |
| WF-03 | conversation | DM→lead, speed-to-lead | INTENT, recompute | lead-scoring |
| WF-04 | conversation | download→demo, CAC | SOURCE +18 | attribution, campaigns |
| WF-05 | demo | **qualified demos/wk** | INTENT +25 | lead-scoring |
| WF-06 | demo | demo→trial | engagement | sales-os |
| WF-07 | trial | week-1 activation | activationScore | activation |
| WF-08 | trial | reactivation, trial→paid | activation decay | activation |
| WF-09 | paid | activation→referral, new customers/mo | health baseline | referrals, customer-scoring |
| WF-10 | retain | churn↓, NRR | healthScore | customer-scoring, retention |
| WF-11 | referral | referral % of customers | SOURCE +25 | referrals |
| WF-12 | expand | NRR/expansion rev | health+usage | customer-scoring |

All 12 are per-tenant, consent-safe, idempotent, and cancellable. The chain WF-01→WF-12 realizes the success definition (`../gap-analysis.md` §8): reel `OPP-*` → engagement → DM → demo → trial → activation → paid → referral → expansion, every step measured + automatable.
