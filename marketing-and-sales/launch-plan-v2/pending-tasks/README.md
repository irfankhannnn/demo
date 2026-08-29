# Pending Tasks — What's Actually Left to Launch

## Context

This folder was **cleaned up against PR #24** (Launch Readiness Completion). Everything the coding agents and PR #24 already shipped — the 7-table CloudFormation, LP analytics/consent partials, homepage SEO/AEO, cookie banner, signup consent checkbox, Sentry/PostHog wiring, the 4 rendered legal pages, and all the AI content drafts — has been **removed** from the task lists below. Each file now keeps **only the items that are still pending**, and lists what was removed in an "Already done — no action needed" block at the top.

Almost everything that remains is **human/vendor/ops** work: create accounts, get KYC/legal sign-off, set up DNS, paste secrets, deploy, and run the post-launch playbook. The only code item still open is BUG-009 (cross-service seat-cap, in the separate `reality-flow-authentication` repo).

## How to read each task

Every task now has:
- **Why** — a one-liner: *where* it's used + *why* it's needed.
- **Steps** — the concrete actions.
- **Example** — a command, env block, or config where useful.
- **Read** — the owner file to open in **`team-work/`** (`FOUNDER-tasks.md` / `MADHU-tasks.md` / `ZEESHAN-tasks.md`) plus the exact task ID (`FND-0xx` / `MAD-0xx` / `ZEE-0xx`).

> `team-work/` only covers **Pre-Launch + Week 1**, so Week 2–4 (`07`–`09`) have no `team-work` task IDs — those are owned by Founder + Madhu and sequenced in `launch-implement/week-2…4/`.

## File Index

| File | Pending scope | Owner file in `team-work/` |
|---|---|---|
| `01-infra-setup.md` | Deploy DDB tables, demo Cognito, crons, API GW/WAF, CloudWatch, Cloudflare DNS, env vars | `FOUNDER-tasks.md` (`FND-002/003/007`) |
| `02-external-accounts.md` | 15 vendor signups (PostHog, Razorpay, Brevo, hCaptcha, AiSensy, Sentry, Workspace, …) | `FOUNDER-tasks.md` (`FND-004/005/006`), `MADHU-tasks.md` (`MAD-003/010`) |
| `03-legal-and-compliance.md` | Company details, lawyer sign-off, GST CA sign-off, security-audit sign-off, inbox test | `FOUNDER-tasks.md` (`FND-004/008/009`), `MADHU-tasks.md` (`MAD-003/008`) |
| `04-content-and-brand.md` | Brand assets (blocked on image MCP), LinkedIn posts, welcome drip, founder review of drafts | `MADHU-tasks.md` (`MAD-005/006/011`) |
| `05-deployment.md` | Fill LP `.env`, deploy LP/CRM/demo/Lambda, Lighthouse, sitemap, T-1 smoke test | `ZEESHAN-tasks.md` (`ZEE-013`), `FOUNDER-tasks.md` (`FND-002/007`) |
| `06-week1-operations.md` | Day 1–7: friction walkthrough, payment go-live, analytics config, helpdesk, go/no-go | `FOUNDER-tasks.md` (`FND-010…013`), `MADHU-tasks.md` (`MAD-010/011`), `ZEESHAN-tasks.md` (`ZEE-011/014`) |
| `07-week2-soft-launch.md` | Day 8–14: prospect sourcing, beta invites, onboarding calls, testimonials | *(post-launch — Founder + Madhu)* |
| `08-week3-public-launch.md` | Day 15–21: testimonial swap, directories, cold outreach, PMF gate | *(post-launch — Founder + Madhu)* |
| `09-week4-convert.md` | Day 22–30: CRO fixes, trial→paid, case study, NPS, Month-1 audit | *(post-launch — Founder + Madhu)* |

## Priority Legend

- **P0 / Critical** — Blocks launch or is legally required.
- **P1 / High** — Required before or during Week 1.
- **P2 / Medium** — Required before Week 3 public launch (or post-launch).

## Critical path (P0, in order)

1. **Razorpay KYC** (ACCT-07) + **Instantly warm-up** (ACCT-11) — start Day 1; 3–21 day SLAs.
2. **Vendor accounts** (`02`) → **populate env** (INFRA-07).
3. **Cloudflare DNS** (INFRA-06) + **deploy DDB tables** (INFRA-01).
4. **Lawyer + security sign-off** (LEGAL-02/04).
5. **Deploy LP/CRM/Lambda** (`05`) → **T-1 smoke test** (DEPLOY-09).
6. **Week 1 ops** (`06`) → **Day-7 Go/No-Go**.
