# Daily Standup Template

Copy this skeleton into `marketing-and-sales/launch-implement/daily-log/dayXX.md` at the end of every working day. 5-10 minutes. Honest, brief, append-only.

---

```markdown
# Day {NN} — {YYYY-MM-DD}

> **Phase:** Pre-launch / Week 1 / Week 2 / ...
> **Goal of the day (from `launch-plan-v2/{file}`):** [one line]

## What shipped today
- [ ] [task ID or file ref] — [outcome] → [output path]
- [ ] ...

## Blockers
- [ ] [blocker description] → [owner] → [unblock plan]

## Metric snapshot (end of day)
| Metric | Value | vs target |
|---|---|---|
| Trial signups (cumulative) | N | target M1 = 30-50 |
| Activated trials (cumulative) | N | target ≥40% |
| Paying customers | N | target M1 = 3-5 |
| Cold replies (cumulative, Day 17+) | N | target ≥10% |
| NPS responses (cumulative, Day 28+) | N | target ≥10 |
| Daily Razorpay collected (₹) | N | — |

## Decisions logged (append to `00-DECISIONS-LOG.md`)
- [ ] [Decision] — linked to [file]

## Plan for next 24h
1. [Highest-priority task ID/file]
2. [Next]
3. [Next]

## Founder mood / energy (1-10)
[number] — [optional 1-line note]

## Notes for self
- [free text, anything not captured above]
```

---

## Why this template exists

- **Forced honesty.** Numbers go in even on bad days.
- **Decision history.** When you (or a future founder reading this) wonders "why did we pick X?", the log + standup pairs answer it.
- **AI-agent context.** When Cascade picks up a task two days later, it reads the last 2-3 standups to know current state without you re-explaining.
- **Burnout signal.** Mood scores ≤4 for 3 days running = take Sunday off, defer non-blocking work.

---

## Sample entry

```markdown
# Day 03 — 2026-06-04

> **Phase:** Week 1 — Foundation
> **Goal of the day:** Activate Razorpay live mode + test ₹1 invoice (per `week-1-foundation/day-03-payment-go-live.md`)

## What shipped today
- [x] day-03 ACs 1-4: Razorpay KYC live, ₹1 test invoice rendered with HSN 998314, settlement to bank confirmed → screenshot saved at `launch-implement/week-1/payment-go-live-evidence.png`
- [x] Updated `pricing.json` `paymentProcessor.live = true`

## Blockers
- [ ] AiSensy WhatsApp BSP onboarding still pending number verification → AiSensy support → expected unblock Day 5

## Metric snapshot (end of day)
| Metric | Value | vs target |
|---|---|---|
| Trial signups | 0 | not yet (LPs deploy Day 6) |
| Activated trials | 0 | — |
| Paying customers | 0 | — |
| Cold replies | 0 | not yet (cold sends start Day 17) |
| NPS responses | 0 | — |
| Daily Razorpay collected | ₹1 | test only |

## Decisions logged
- [x] Settlement window = T+1 → linked `00-DECISIONS-LOG.md` entry 2026-06-04

## Plan for next 24h
1. day-04: PostHog + GA4 + Pixel + LinkedIn Tag final wire-up + Playwright assertion test (4h founder, 2h AI)
2. Reply to 5 LinkedIn DMs from post-2 traction
3. Prep Mumbai prospect Firecrawl query for Day 8

## Founder mood / energy
8 — Razorpay live unblocks the whole chain. Solid day.

## Notes for self
- Razorpay support agent very fast on call. Use them again for any GST query.
- Cookie banner consent flow needs visual polish — minor.
```

---

## Where to file

- `marketing-and-sales/launch-implement/daily-log/dayXX.md` (Pre-launch days use `T-XX.md`)
- One file per day, even on Sunday off (write "Day off — no work" so the chain stays unbroken)
- Commit weekly to git (drafts are fine; PII/financial details should be S3-only)
