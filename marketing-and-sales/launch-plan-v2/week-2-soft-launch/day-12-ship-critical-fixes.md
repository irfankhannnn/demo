# Day 12 — Ship Critical Beta Fixes

> **Type:** 🧍 + 🤖
> **Phase:** Week 2
> **Skill(s):** `codebase-analysis` + `pr-review` + `signup-flow-cro`
> **Estimated time:** 6h founder + 4h AI

## Objective
Ship the 3-5 P0 items from Day 11 backlog before Day 13 check-in drip. Same fix loop as Day 2 (root-cause + diff + smoke + push) but informed by real beta-tester data.

## Why This Matters for RealEstateFlow
Testimonials Day 14 only land if the product they're testifying about works. Day 12 closes the gap between "they showed willingness" and "they have nothing left to complain about".

## User Story
As founder, I want every Day-11 P0 shipped + verified by EOD Day 12, so Day 13 check-ins land on a fixed product + Day 14 testimonials are clean.

## Acceptance Criteria
- [ ] All Day-11 P0 items shipped + closed (PR or commit referenced)
- [ ] Each fix verified by re-walkthrough on the same persona that hit it
- [ ] Backlog updated: status, PR, fix-verified Y/N per item
- [ ] No new P0 introduced (regression smoke)
- [ ] WhatsApp/email update sent to testers whose specific issue got fixed: "Hi {{name}}, the {{issue}} you flagged is fixed. Try again + let me know."
- [ ] PostHog cohort "Beta testers" shows at least 6/8 active (post-fix re-engagement)
- [ ] Day 12 standup written

## Manual Steps (🧍)

1. **Open Day-11 P0 queue** — read each item.
2. **Run AI Prompt below per item** to generate fix PR.
3. **Review diffs + smoke test** (founder runs locally or in dev env).
4. **Push to production** in batches of 1-2 fixes (don't bundle 5 fixes into one push — easier to bisect).
5. **Update Day-11 backlog** with status + PR per item.
6. **Notify affected testers** via personalised WhatsApp/email: "Fix is live, try {{specific step}} again — apologies for the issue, your feedback shipped this in 24h."
7. **Verify cohort health** in PostHog: re-engagement post-fix.
8. **Daily standup** + tick ACs.

## AI Prompt (🤖) — per P0 item

```
You are a senior full-stack engineer fixing a P0 beta-feedback item.

Backlog entry:
{{ paste pattern title + observed-by-N + proposed fix + file location from day-11-feedback-backlog.md }}

Read for context:
- {{ best-guess file path }}
- `agency-app/web/src/App.tsx`
- `agency-app/api/routes/{{relevant route}}.js`
- `agency-app/api/tenantMiddleware.js`
- `marketing-and-sales/launch-implement/week-2/day-10-call-notes/{{tester-slug}}.md` (the original tester observation)

Produce:
1. Root-cause analysis (2-4 sentences)
2. Minimal fix (smallest change at root cause)
3. Diff per file
4. Manual verification steps the founder runs in <2 min
5. Tester-notification copy (1-line WhatsApp/email to send post-deploy: "Hi {{name}}, fix for {{issue}} is live — try X again. Sorry for the trouble.")
6. Regression risk note + Playwright test if needed

Constraints:
- Match existing patterns in repo
- Preserve tenant scoping + auth
- TypeScript-strict; no `any`
- Mobile-first responsive

Output as PR-style note + diff + tester-notification copy. Do NOT touch unrelated files.
```

## Inputs
- Day-11 P0 queue
- Repo + dev environment
- Tester contact info from Day 9 invite log

## Outputs
- 3-5 PRs / commits
- Updated `day-11-feedback-backlog.md`
- WhatsApp/email replies to affected testers
- Day 12 standup

## Success Criterion
All Day-11 P0 closed + tester re-engagement signal in PostHog.

## Fallback / Plan B
If a P0 needs >1 day, ship a workaround/banner Day 12 (e.g., "Phone OTP delays >2 min? Email founder for manual login") + queue real fix Day 14. Don't block the cohort.

## Risks
| Risk | Mitigation |
|---|---|
| Fix introduces regression for non-beta users | Smoke test on full flow + Playwright cross-tenant |
| Tester loses trust if fix slow | Day-12 EOD deadline + transparent comms |
| Multiple fixes conflict | Push 1-2 at a time + verify between |
| Cascade hallucinates fix | Founder reviews every diff before push |

## India / Mumbai-Specific Notes
- OTP delays = Jio/Vi/Airtel issue → may need WhatsApp OTP fallback (queue P1 if not done already)
- Mobile-first verification — test fix on iPhone + low-end Android

## Dependencies
- **Blocks:** Day 13 check-in drip, Day 14 testimonials
- **Depends on:** Day 11 backlog

## Connected Skills
- `codebase-analysis` — root-cause + diff
- `pr-review` — review own PR
- `signup-flow-cro` + `onboarding-cro` — UX fixes
