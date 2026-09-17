# Open Decisions — marketing (D22–D29)

> **These are NOT decided.** The founder deferred all eight until content-creation work begins (`decisions.md`, 2026-09-17). Recommendations below are the reviewers' opinion with evidence, not an outcome. Do not resolve one by writing a doc as if it were settled.
>
> **How to use this file.** Any doc whose content depends on an open decision carries, at the affected section:
> `> Open decision D2x — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`
> When a decision closes: append it to `00-DECISIONS-LOG.md` as a dated entry, delete its section here, and remove every inline note that cites it.

**Already settled elsewhere — not open, do not reopen:** the Hinglish convention for brand copy (70% English / 30% romanized Hindi, `CLAUDE.md` + brand kit v3); the v3 "Bazaar Signal" visual system; zero fake proof (pre-launch, no customers); the founder never appears on camera; Mumbai-only for M1; no paid ads in M1; Telegram dropped; prices come from `pricing.json` only, with the replacement proposal tracked at `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`.

---

## D22 · Scheduling: Blotato, or publish by hand?

**Question.** Do we schedule feed posts through the Blotato MCP, or upload everything manually?

**State of the evidence.** `blotato` is configured in `.mcp.json` and listed in `CLAUDE.md`. But commit `dfa01df` (21 Jun 2026) rewrote every Content OS publishing step to "manual upload via Meta Business Suite", and the month-1 pack only says "schedule the whole week on Sunday". So the tool is wired and the docs tell you not to use it.

**Options.**
- **A.** Blotato for all scheduled feed posts (IG reels and carousels, Facebook, LinkedIn). Manual for Stories, broadcast channel, community posts and every comment/DM reply.
- **B.** Manual everything — Meta Business Suite for IG/FB, LinkedIn's native scheduler. Remove `blotato` from `.mcp.json` and `CLAUDE.md` so the drift stops.
- **C.** Meta Business Suite for IG/FB (native, free) plus Blotato only for LinkedIn and anything else.

**Recommendation: A.** It fits the Thursday–Sunday batch rhythm and uses a tool that is already paid for and wired. Keep the "reply within 60 minutes" work manual — scheduling tools are bad at conversation.

**Depends on it.** `30-channels/README.md` (publishing SOP) · `30-channels/instagram/README.md`, `content-cadence.md`, `reels.md`, `stories.md` · `30-channels/facebook.md`, `linkedin.md`, `youtube.md` · `20-content-engine/production-pipeline.md` (Step 10 + Batch Mode) · `20-content-engine/higgsfield-guide.md` §5 Step 9 · `60-automation/tooling-stack.md` · `50-measurement/attribution-today.md` (a Blotato publish webhook is assumed by two archived specs and does not exist).

---

## D23 · Which channels and handles are in scope now?

**Question.** Which channels do we run in M1, under which handles, and who automates the Instagram DMs?

**State of the evidence.** The month-1 pack is Instagram + Facebook organic only. No paid ads in M1 (logged). The Content OS additionally runs LinkedIn founder authority, YouTube (Shorts + long-form), Facebook groups and Lead Ads, an IG broadcast channel, a WhatsApp broadcast list and community, and WhatsApp keyword automation. The month-1 pack watermarks `@realestateflow`; `@realtyflow_india` appears nowhere else in the repo; `@happyproperties99` is the owner's agency account used as the Meta tester, not the brand account.

**Options.**
- **A.** Instagram + Facebook organic only, plus 1:1 WhatsApp hand-off from DMs. Everything else parked with a post-PMF banner.
- **B.** A, plus LinkedIn founder text posts and comments (no video), plus manual participation in Mumbai Facebook broker groups.
- **C.** The full Content OS channel set now.

**Sub-questions.**
- *(a) Brand handle* — confirm `@realestateflow`.
- *(b) Company WhatsApp for outreach* — Cloud API number (template approval, higher effort) or a self-hosted QR-linked number via `platform/whatsapp-platform` (no templates, higher ban risk at volume)? Overlaps D29.
- *(c) IG DM/comment automation for our own account* — dogfood RealEstateFlow's own hosted Instagram service once Meta App Review passes, use ManyChat in the meantime, or stay manual?

**Recommendation: B**, with `@realestateflow`, Cloud API for anything broadcast-shaped, self-hosted only for genuine 1:1, and ManyChat until App Review passes and then dogfood our own service. LinkedIn text posts cost the founder minutes, not editor hours, and the five drafts in `linkedin-posts/` are already written.

**Depends on it.** All of `30-channels/` — especially `youtube.md` (parked or not), `linkedin.md`, `facebook.md`, `founder-presence.md`, `instagram/broadcast-channels.md`, `instagram/90-day-growth-strategy.md`, `instagram/growth-loops.md`, `whatsapp/community.md`, `whatsapp/founder-broadcast.md`, `whatsapp/message-templates.md` · `20-content-engine/ctas/` (50 COMMUNITY CTAs and every FOLLOW-handle CTA) · `40-sales-and-conversion/dm-to-demo.md`.

---

## D24 · City, language mix and ICP

**Question.** What language split do we write in, and does any Pune or Marathi content ship in M1?

**State of the evidence.** Three splits are written down, at three different scopes: 70% English / 30% romanized Hindi for brand copy (`CLAUDE.md`, brand kit v3 — the newest); 60% English / 25% Hinglish / 15% Marathi for ads and social (`00-DECISIONS-LOG.md`); 55% Hinglish / 30% Marathi / 15% English in `10-audience-and-voice/language-and-tone.md` (the oldest, and justified by a Pune push). M1 is Mumbai only. 69% of the 1,000 hooks are tagged hi-dominant; only 2 are mr-dominant. The 520-row content plan has 123 Pune rows.

**Options.**
- **A.** Brand kit 70/30 governs all M1 organic content; Marathi only as an occasional Mumbai accent (≤5%). Revisit when Pune opens.
- **B.** Decisions-log 60/25/15 for ads and social; 70/30 for brand copy elsewhere.
- **C.** Keep 55/30/15 and plan Pune content now.

**Sub-question.** For the 1,000-hook library — re-tag the `language` field only (cheap), or regenerate the library in English-led Hinglish (expensive, better)?

**Recommendation: A**, with re-tagging rather than regeneration for now. It is the newest source and the only one consistent with Mumbai-only. Update `BRAND-POSITIONING.md` §4.1 to say "Pune: post-PMF" rather than listing it as a current market. Whichever option wins, the three splits must end up with **explicit non-overlapping scopes** — that ambiguity is what produced three numbers.

**Depends on it.** `10-audience-and-voice/language-and-tone.md`, `icp-and-personas.md`, `market-research.md` · `20-content-engine/hooks/hook-library.md` + `hooks.json` (1,000 records) · `20-content-engine/ctas/` (11 Pune CTAs) · `20-content-engine/content-plan/content-plan-500.csv` (123 Pune rows, plus the language and city columns) · `20-content-engine/attention-model.md` (Marathi opener) · `30-channels/instagram/content-cadence.md`, `stories.md` · every `30-channels/whatsapp/*` Marathi variant · `40-sales-and-conversion/qualification.md`, `demo-script.md`, `followup-script.md` · `LP2/README.md` brand-constants table.

---

## D25 · Keep the 9-character "Apna Properties" cast?

**Question.** Do we keep the nine recurring AI characters, or is the single month-1 narrator the only AI face?

**State of the evidence.** The Content OS mandates nine recurring characters with Soul IDs, including a "happy customer" couple (CH-HAPPY) and CH-OWNER used as a founder proxy. The month-1 pack uses **one** AI narrator, Arjun, who speaks for the brand and never plays a broker, owner or customer, plus real screen recordings. CH-BROKER is also named Arjun. The editor is capped at about three videos a week.

**Options.**
- **A.** Retire the cast. Arjun is the only AI face; `cast-and-presenter.md` becomes an archetype reference for writing, not for generation.
- **B.** Hybrid. Arjun presents. Keep two or three cast members for clearly fictional comedy skits carrying an on-screen "dramatised" label. Delete CH-HAPPY and every founder-proxy or proof role; rename CH-BROKER to end the collision.
- **C.** Keep all nine as written. *(Not compatible with the AI-presenter policy without the fact fixes already listed in review A.)*

**Recommendation: B.** Skit reels are the Content OS's reach engine and are honest when labelled fiction. Proof roles never are — a synthetic face giving a testimonial is a fabricated customer regardless of the disclaimer. Note the throughput constraint: a nine-character cast needs more editor hours than three videos a week can supply.

**Depends on it.** `20-content-engine/cast-and-presenter.md` · `20-content-engine/higgsfield-guide.md` §3, §6 · `higgsfield-skills.md` (`/realestateflow-founder` casts CH-OWNER as the founder) · `content-types.md` (CT-CASE, CT-FOUNDER) · `production-pipeline.md`, `prompt-library.md` · `visual-system.md` §9 #10, §16 #1 · `30-channels/instagram/reels.md`, `stories.md`, `content-cadence.md` · `30-channels/founder-presence.md`.

---

## D26 · Which AI features may marketing show today?

**Question.** Which product capabilities are we allowed to demonstrate and claim in public content right now?

**State of the evidence.** The approved-claims list covers the WhatsApp AI Employee, khata, reminders and QR-linked WhatsApp. **AI calling exists in the repo** (`agency-app/ai-calling`, `agency-app/followup-agent`) **but is not on that list** — yet the Content OS makes it the product "aha", the Friday franchise and roughly 40 hooks and CTAs. Instagram DM/comment automation and lead scoring are built but blocked on Meta App Review, with `INSTA_DRY_RUN_SENDS` on in dev. Property pages and ManyChat booking are built and live. The public HTTPS on `realestateflow.in` is currently down, so no demo link should be published until it is fixed.

**Options.**
- **A.** AI Employee only — the approved list as it stands. AI calling, Instagram automation and property pages stay off-limits until the founder adds them.
- **B.** A plus AI calling, if it is production-ready and its pricing is settled (which plan includes it, and how credits are shown).
- **C.** A plus B plus Instagram lead automation as "coming soon", after App Review is submitted.

**Recommendation: A** now. Add AI calling (B) once it is live in prod and reflected in `pricing.json` / the doc-38 proposal; add Instagram automation once App Review passes. Each addition goes into the approved-claims list first, then into content — never the other way round. Interlocks with D27: if activation is redefined around AI calling, this decision must move to B first.

**Depends on it.** `10-audience-and-voice/claims-and-proof-policy.md` (the approved-claims list itself) · `20-content-engine/framework-library.md` (FW-AI) · `content-types.md` (CT-AI, CT-DEMO) · `prompt-library.md` §7 · `20-content-engine/hooks/` (83 AI-category hooks) and `ctas/` (AI-keyword CTAs) · `30-channels/instagram/reels.md`, `content-cadence.md`, `dm-workflows.md`, `broadcast-channels.md` · `30-channels/whatsapp/customer-success.md`, `demo-followup.md`, `lead-nurture.md`, `message-templates.md` · `30-channels/founder-presence.md`, `linkedin.md` · `40-sales-and-conversion/demo-script.md`.

---

## D27 · What counts as activation?

**Question.** What is the single activation event we report against the ≥40% PMF-gate threshold?

**State of the evidence.** Two definitions are written down and they do not agree. The launch plan says "owner connects WhatsApp and the AI Employee handles ≥1 inbound lead end-to-end within 7 days", measured by PostHog `ai_employee_lead_handled`, target ≥40%. The growth platform says 10+ leads plus first AI call plus follow-up plus team/match, three of four core milestones and a score ≥70, target ≥60%. **The catch: the AI Employee is a paid add-on with no trial, so a Solo or Team trial user cannot reach the launch-plan definition at all.** AI calls consume credits, though every tenant including trials gets 1,000 free credits a month. What product onboarding actually asks for is: connect WhatsApp.

**Options.**
- **A.** Launch-plan definition as written. Simple, but only measurable for AI Employee buyers.
- **B.** Growth-platform milestone model as written. Needs scoring code nobody is scheduled to build.
- **C.** Two-track. **CRM plans:** first real lead captured through a connected channel (WhatsApp connected, Instagram connected, or a property-page booking) plus one follow-up set, within 7 days — measurable today with `lead_added` and `meeting_scheduled` plus a channel-connected event. **AI Employee buyers:** `ai_employee_lead_handled` within 7 days. Target ≥40% for both.
- **D.** Launch-plan definition, but redefined around the first AI call (which a trial user *can* reach on free credits) — requires D26 to move to option B first.

**Recommendation: C.** It matches what the product actually onboards to, it is measurable with events that already exist, and it does not require a trial user to buy a ₹7,999 add-on before they can count as activated. Whatever is chosen, it must be a thing a free-trial user can do.

**Depends on it.** `LP2/00-PLAN-OVERVIEW.md` §1 and §5 · `50-measurement/activation-definition.md` · `metric-dictionary.md` (M-A1, M-A2, M-S2) · `posthog-event-map.md` · `weekly-scorecard.md` (the activation row) · `customer-health.md` · `60-automation/workflow-catalog.md` (WF-07, WF-09) · `40-sales-and-conversion/customer-journey.md`, `onboarding-script.md` · `30-channels/whatsapp/customer-success.md` · `30-channels/instagram/90-day-growth-strategy.md`.

---

## D28 · What date anchors the plan?

**Question.** Is there a public launch date, and what do the plans count from?

**State of the evidence.** No launch date is recorded anywhere — every entry in `00-DECISIONS-LOG.md` reads `2026-MM-DD`. The launch plan is at Week 1 (day-04 to day-06 artefacts exist). The month-1 content pack was scheduled for 10 Aug – 6 Sep 2026. The Content OS roadmap is undated. Two things that the DM funnel depends on are not ready: Meta App Review for the Instagram service, and working HTTPS on `realestateflow.in`.

**Options.**
- **A.** Set a public-launch date (Day 15 of the plan) and date everything from it, including the 30-60-90 as M1/M2/M3.
- **B.** Keep relative days (T-21, Day 1, …) and add one line to `00-DECISIONS-LOG.md`: "Day 1 = YYYY-MM-DD". Every plan reads off that.
- **C.** Hold the public launch until Instagram App Review and the prod deploy are done; run content in build-in-public mode until then.

**Recommendation: B, with the Day 1 date chosen under C's condition.** Relative days survive slippage; a single anchor line converts them when needed. Instagram automation and working legal URLs on the domain are genuine blockers for the funnel these docs assume.

**Open sub-question.** Did the 10 Aug – 6 Sep month-1 pack actually run? If it did, the next content plan should build on its results rather than starting from the June sprint. Nothing in the repo records the outcome.

**Depends on it.** `LP2/00-PLAN-OVERVIEW.md` §3 · `month-2-plus/README.md` (phases) · `50-measurement/weekly-scorecard.md` (reporting periods) · `20-content-engine/content-plan/README.md` (§5 scheduling) · `30-channels/instagram/90-day-growth-strategy.md` · `00-DECISIONS-LOG.md` (the anchor line itself).

---

## D29 · Measurement stack, referrals, and the prospect WhatsApp channel

Three questions that share one answer shape: build something, or run it by hand until volume justifies code. Under D3 the default is "by hand, on what exists".

### D29a · What is the event and analytics backbone?

**State of the evidence.** PostHog is already wired into the CRM SPA, the server and the landing pages, with a fixed event contract. GA4, Meta Pixel, LinkedIn and Hotjar sit on landing pages behind consent. UTM is captured at signup; Razorpay billing webhooks, NPS and a trial email drip all exist. The archived design instead specifies a custom DynamoDB `MKT_EVENT` store, SQS and custom React dashboards — zero lines of which are built.

**Options.** **A.** PostHog is the event store and the dashboard; Razorpay events reach it via `serverTrack`; GA4 and Pixel only for ad optimisation. · **B.** Build the custom `MKT_EVENT` spine as designed. · **C.** PostHog now; add a small custom store later only for joins PostHog cannot do (OPP-ID ↔ Instagram mediaId ↔ paid revenue).

**Recommendation: C**, which is A for the next 90 days. Rename every design-time event to its live PostHog name rather than maintaining a second vocabulary.

### D29b · Referral programme — timing and mechanics

**State of the evidence.** Three incompatible versions exist and none is built. Growth platform: referrer gets one free month capped at ₹5,999 (a plan price that does not exist), referee 50% off plus a 30-day trial, automated engine in the CRM table. Day-30 spec: referrer ₹500 credit up to ₹2,500/month, referee one month free via a Razorpay coupon, NPS promoters only, separate tables. M2 plan: the day-30 rewards plus an affiliate tier (₹2,000 + 25% MRR for six months) — and it claims a referral route and UI are "live", which is false; neither exists.

**Options.** **A.** Manual first — at Day 30, issue founder-created Razorpay coupons to NPS promoters among paying customers and log them in a sheet. Automate after roughly ten referred signups. · **B.** Build the day-30 lightweight version now: create-code, redeem, coupon, `?ref=` alongside the existing UTM capture. · **C.** Build the full engine with ledger, anti-abuse and clawback.

**Recommendation: A**, with the day-30 spec's rewards as the canonical numbers. Correct the false "live" claim in the M2 doc either way.

### D29c · Which WhatsApp number talks to prospects?

**State of the evidence.** The product's WhatsApp is self-hosted Baileys, QR-linked, not a BSP. The plan stack names AiSensy (BSP) for warm messaging and a personal number capped at 15/day for cold. Several Content OS docs assume a Business API template workflow that we do not have.

**Options.** **A.** Follow the plan — AiSensy for warm, personal number ≤15/day for cold. · **B.** Use the self-hosted Baileys number for prospects too. · **C.** Cloud API direct, no BSP.

**Recommendation: A.** Baileys on a brand number carries real ban risk at outreach volume, and losing that number would also disrupt product demos. Interlocks with D23(b).

**Depends on D29 as a whole.** `50-measurement/posthog-event-map.md`, `attribution-today.md`, `metric-dictionary.md`, `weekly-scorecard.md`, `referral-program.md`, `prospect-lead-scoring.md`, `design-only-backlog.md` · `60-automation/tooling-stack.md`, `workflow-catalog.md` · `30-channels/whatsapp/README.md`, `referral.md`, `message-templates.md`, `founder-broadcast.md` · `month-2-plus/M2-referral-program-scale.md` (the false "live" claim) · `week-4-optimize-convert/day-30-month-2-strategy.md` (the referral spec that should win).
