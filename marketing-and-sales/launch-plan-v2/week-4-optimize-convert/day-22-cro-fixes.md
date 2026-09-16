# Day 22 — CRO Fixes Based on Day-21 Drop-Points

> **Type:** 🤖 + 🧍
> **Phase:** Week 4 — Optimize & Convert
> **Skill(s):** `page-cro` + `signup-flow-cro` + `funnel-analysis` + `pr-review`
> **Estimated time:** 2h founder + 6h AI

## Objective
Ship 3-5 high-leverage conversion fixes targeting the top drop-points from Day-21 funnel analysis. Focus: LP → trial-start (if low conversion), signup → activation (if low), demo no-show (if high), trial → paid initiation (if low).

## Why This Matters for RealEstateFlow
Days 22-30 are about converting existing traffic + leads, not generating more. Every percentage point lifted on a downstream funnel stage compounds across all upstream channels.

## User Story
As founder reading the Day-21 brief, I want top-3 drop-points fixed by Day 22 EOD, so the next 8 days of traffic convert better than the past 21.

## Acceptance Criteria
- [ ] Top 3-5 drop-points identified from Day-21 brief + ranked by ICE
- [ ] Each fix shipped + verified in PostHog (event firing post-fix)
- [ ] Hotjar / FullStory session-replay reviewed for top drop-stage to confirm UX hypothesis
- [ ] PR list at `marketing-and-sales/launch-implement/week-4/day-22-cro-prs.md` with diff + before/after metrics target
- [ ] No regressions (Playwright test suite green)
- [ ] LP A/B testing where possible: 2 hero variants for top drop-page (split via Netlify Edge functions or PostHog feature flags)
- [ ] Day-22 standup with shipped count + expected impact

## Manual Steps (🧍)

1. **Read Day-21 brief** + identify top 3-5 drop-points by ICE.
2. **Run AI Prompt #1** to triage drop-points + generate fix specs.
3. **Manual review** of fix specs — does each one tie to a real PostHog event?
4. **Run AI Prompt #2** per fix spec to generate the diff.
5. **Smoke test** each fix locally + push.
6. **Verify in PostHog** that the relevant event fires post-fix on the test session.
7. **Daily standup**.

## AI Prompt #1 (🤖) — Triage drop-points

```
Read inputs:
- `marketing-and-sales/launch-implement/week-3/day-21-weekly-growth-brief.md` (top drop-points)
- PostHog: full funnel + session-replay snippets for top drop-stage
- All 12 LP HTML files
- `apps/crm/real-estate-crm-app/src/pages/auth/Register.tsx`
- `apps/crm/real-estate-crm-app/src/pages/onboarding/*.tsx`
- `apps/crm/real-estate-crm-app/src/pages/leads/AddLead.tsx`
- `apps/crm/real-estate-crm-app/src/components/PaywallModal.tsx`

For each top drop-point:
1. Hypothesis (UX / copy / friction / trust)
2. Evidence: PostHog event + replay quote
3. Fix proposal (specific component / route / copy change)
4. Impact estimate (% lift expected based on industry benchmarks for similar fix)
5. Effort estimate (S/M/L)
6. ICE = Impact × Confidence × Ease, rank by score
7. Before/after metric to watch in PostHog

Output `marketing-and-sales/launch-implement/week-4/day-22-drop-point-triage.md` with top-5 ranked.

Stop. Don't generate diffs yet (Step 2).
```

## AI Prompt #2 (🤖) — Generate fix per drop-point

```
For drop-point #{{N}} from `day-22-drop-point-triage.md`:

Context: {{paste the triage entry}}

Read the relevant file(s) listed in the triage entry.

Produce:
1. Root-cause analysis (2-4 sentences)
2. Minimal fix (smallest possible change at root cause)
3. Diff per file
4. Manual verification (founder runs in <2 min)
5. PostHog event to watch + expected baseline → target conversion lift
6. Playwright test to add (if no existing coverage)
7. A/B test setup if applicable (variant A = current, variant B = new — Netlify Edge or PostHog feature flag)

Constraints:
- Match existing repo patterns
- Mobile-first responsive
- Preserve tenant scoping + auth
- TypeScript-strict; no `any`
- No new dependencies

Output as PR-style note + diff. Don't auto-deploy.
```

## Sample drop-points & typical fixes

(Use as reference — actual list comes from Day-21 data.)

| Drop-point | Likely fix | Target lift |
|---|---|---|
| LP hero → CTA click <30% | Sharpen H1 + add Day-14 testimonial card above fold + 2 trust badges | +5-10% |
| Signup → OTP verification 60% drop | Add WhatsApp OTP fallback alongside SMS + retry-OTP UX | +15-20% |
| Onboarding step 3 of 5 (agency setup) 40% drop | Reduce required fields from 8 → 4; defer rest to "Settings later" | +10-15% |
| First-record completion (buyer) 40% drop | Demo-tenant template "Add 3 sample buyers in 1 click" + skip-with-defaults | +20% |
| Demo booked → demo attended 40% no-show | WhatsApp 1h-before reminder + 24h-before email + Cal.com auto-reminder | +15-25% |
| Paywall → checkout init 70% drop | Trust badges + "Cancel anytime + 1-month money back" reassurance + 3 testimonial logos | +10-15% |

## Inputs
- Day-21 brief
- Repo + PostHog access

## Outputs
- `day-22-drop-point-triage.md`
- `day-22-cro-prs.md` (PR list)
- 3-5 PRs shipped
- Playwright tests added (if any)
- Daily standup

## Success Criterion
3-5 fixes shipped + PostHog confirms event firing post-fix + no regressions.

## Fallback / Plan B
If a fix introduces regression, revert + queue for Day 26. Don't ship broken code in Week 4 — every percentage point matters.

## Risks
| Risk | Mitigation |
|---|---|
| Fix breaks existing flow | Playwright + manual smoke before push |
| A/B test setup adds complexity | Skip A/B for Day 22; ship single variant; A/B M2 |
| Wrong drop-point hypothesis | Session replay + 2-3 user interviews if uncertain |
| Founder over-fixes (5+ items) | Cap at 5 per ICE rank; defer rest to Day 26 |

## India / Mumbai-Specific Notes
- WhatsApp OTP fallback critical for Mumbai users (Jio/Vi delivery flaky)
- Mobile session-replays mandatory (80%+ traffic)
- Trust badges should include Indian recognisable: "Razorpay Secured", "DPDP Compliant", "Built in Mumbai"

## Dependencies
- **Blocks:** Day 23-30 acquisition rides on lifted conversion
- **Depends on:** Day-21 brief

## Connected Skills
- `page-cro` — primary
- `signup-flow-cro` + `onboarding-cro` — fix variants
- `funnel-analysis` — verification
- `pr-review` — code quality
