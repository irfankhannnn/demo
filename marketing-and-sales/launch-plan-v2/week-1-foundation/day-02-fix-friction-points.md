# Day 02 — Fix Friction Points (P0 → Ship)

> **Type:** 🧍 + 🤖
> **Phase:** Week 1
> **Skill(s):** `codebase-analysis` + `pr-review` + `signup-flow-cro` + `onboarding-cro`
> **Estimated time:** 6h founder + 4h AI

## Objective
Ship every P0 friction issue from Day 1 backlog + as many P1 as time allows. Goal: a Mumbai broker can sign up + add a buyer + add a property in <8 minutes from a cold landing page visit.

## Why This Matters for RealEstateFlow
Every P0 friction = a paying customer lost. Day 2 is the only block of dedicated bug-fix time before payments go live Day 3 and beta invites go out Day 9.

## User Story
As founder shipping fixes, I want each P0 backlog item resolved + verified end-to-end, so Day 9 beta invites land on a frictionless product.

## Acceptance Criteria
- [ ] All P0 items from `day-01-backlog.md` shipped + closed (PR or commit referenced)
- [ ] All P0 fixes verified by re-walkthrough (5-min focused re-test)
- [ ] Top 3 P1 by ICE shipped (time-permitting)
- [ ] Updated backlog entry per item: status, PR link, fix verified Y/N
- [ ] Total signup → first record time measured: ≤8 minutes for desktop, ≤10 minutes for mobile
- [ ] No new P0 introduced (regression test on existing flows)
- [ ] Daily standup written

## Manual Steps (🧍)

1. **Open backlog** `day-01-backlog.md`. Filter to P0 + ICE-sorted.
2. **For each P0 item**: read entry, run AI Prompt below to generate the fix PR, review the diff, run locally, push.
3. **Manual smoke test** after each fix: re-trigger the original friction step, verify resolution.
4. **Re-walkthrough** end-to-end after all P0 fixes shipped: signup → OTP → onboarding → first buyer + property + lead + Khata. Time it.
5. **If time remains** (<3h before EOD): pull top P1 by ICE, repeat fix loop.
6. **Update `day-01-backlog.md`** with status + PR links per item.
7. **Daily standup** in `daily-log/day02.md`.
8. **Tick ACs** + log decisions if anything significant.

## AI Prompt (🤖) — run per P0 item

```
You are a senior full-stack engineer fixing a P0 friction issue in RealEstateFlow.

Issue from `marketing-and-sales/launch-implement/week-1/day-01-backlog.md`:
{{ paste issue title + description + best-guess file location }}

Read these files for context:
- {{ best-guess file path }}
- `agency-app/web/src/App.tsx` (route + auth context)
- `agency-app/api/routes/{{relevant route}}.js`
- `agency-app/api/tenantMiddleware.js`

Produce:
1. Root-cause analysis (2-4 sentences) — why does this friction happen
2. Minimal fix (smallest possible change at the root cause; no over-engineering)
3. Diff: old code → new code with file paths
4. Regression risk: what could break + which existing test verifies it (or new test to add)
5. Manual verification steps the founder can run in <2 min

Constraints:
- No new dependencies unless absolutely required
- Preserve existing tenant scoping + auth patterns
- TypeScript-strict; no `any`
- Mobile-first responsive (Tailwind)
- Match existing component patterns (check sibling files)

Output as a markdown PR-description-style note + the diff. Do NOT touch any file outside the scope of this single issue.
```

## Inputs
- `day-01-backlog.md` (output of Day 1)
- Repo + dev environment

## Outputs
- 1 PR (or commit) per P0 item
- Updated `day-01-backlog.md` with status + PR link
- `daily-log/day02.md` standup

## Success Criterion
Re-walkthrough end-to-end signup→first-record time ≤8min desktop / ≤10min mobile; zero P0 outstanding.

## Fallback / Plan B
If a P0 cannot be fixed Day 2 (e.g., requires architectural change), document the decision in `00-DECISIONS-LOG.md`, ship a workaround (banner / disabled feature / fallback flow) so the user isn't blocked, and queue real fix for Day 5.

## Risks
| Risk | Mitigation |
|---|---|
| Fixes introduce regressions | Manual smoke + Playwright tests for cross-tenant + auth (P13) |
| AI generates over-engineered fix | Prompt enforces "minimal fix at root cause" |
| Founder ships untested code | Smoke test in checklist before push |
| P0 list too long for 1 day | Defer top P0s only; document deferred P0 in standup |

## India / Mumbai-Specific Notes
- Test fixes on slow 4G + iPhone + low-end Android — Mumbai broker fleet is heterogeneous
- Don't introduce new English-heavy copy; consult `creative/landing-pages/main/index.html` patterns

## Dependencies
- **Blocks:** Day 3 (payment go-live needs no-P0), Day 9 (beta invites need clean product)
- **Depends on:** Day 1 backlog

## Connected Skills
- `codebase-analysis` — root-cause + diff
- `pr-review` — review own PRs
- `signup-flow-cro` + `onboarding-cro` — UX fix patterns
