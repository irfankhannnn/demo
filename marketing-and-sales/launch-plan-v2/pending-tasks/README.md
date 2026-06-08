# Pending Tasks — Phase 2 Manual Work

## Context

The agent swarm has completed the implementation analysis and planning phase. Tasks executable through coding agents have been separated into 13 day-wise PRs documented in:

- `coding-agent-brief/` — complete agent prompts + coordination docs
- `coding-agent-brief/02-PR-SCHEDULE.md` — 6-day, 13-PR coding plan (PR-A through PR-L)

This folder contains **only the remaining manual tasks** required for a complete Phase 2 launch. These require human action, external coordination, approvals, business decisions, or operational execution that cannot be automated.

## File Index

| File | Scope |
|---|---|
| `01-infra-setup.md` | AWS DDB tables, Cognito, API Gateway, WAF, CloudWatch, Cloudflare DNS, env vars |
| `02-external-accounts.md` | All third-party vendor signups and configuration |
| `03-legal-and-compliance.md` | Legal docs, lawyer review, GST/CA sign-off, founder details for copy |
| `04-content-and-brand.md` | AI-prompt content tasks (Madhu): pricing copy, battle cards, brand assets, SEO, LinkedIn posts |
| `05-deployment.md` | LP + CRM + Lambda deploy, domain mapping, placeholder replacement, smoke tests |
| `06-week1-operations.md` | Product walkthrough, payment go-live, analytics config, helpdesk, Day 7 go/no-go |
| `07-week2-soft-launch.md` | Beta prospect sourcing, invites, onboarding calls, testimonials |
| `08-week3-public-launch.md` | Cold outreach execution, directory submissions, LinkedIn posts, community engagement |
| `09-week4-convert.md` | CRO fixes, trial-to-paid follow-up, case study, NPS email blast, Month-1 audit |

## Priority Legend

- **Critical** — Blocks launch or is legally required
- **High** — Required before or during Week 1
- **Medium** — Required before Week 3 public launch
- **Low** — Required for full Month-1 execution
