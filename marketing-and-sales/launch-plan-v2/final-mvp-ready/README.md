# Final MVP-Ready Implementation Plan — RealEstateFlow

**Branch:** `mvp-readiness-launch` (implementation) / merge target: `auth_rbac_feature`  
**Status:** Implementation complete 2026-06-19 — see `pending-mvp/` for manual release steps  
**Goal:** A production-ready MVP. Every task here is grounded in real files, exact functions, and existing architecture patterns.

---

## How to Use This Folder (for implementing AI agents)

This folder breaks the MVP into **6 EPICs**. Each EPIC file contains **discrete, numbered tasks**. Each task is self-contained and includes:

- **Task ID** (e.g. `E2-T3`) — stable reference
- **Goal** — one sentence
- **Files to touch** — exact paths (NEW vs MODIFY)
- **Implementation detail** — what to write, which existing functions/patterns to reuse
- **Security checklist** — tenant isolation, input validation, secrets
- **Tests** — exactly what to write and how to run
- **Acceptance criteria** — definition of done
- **Depends on** — task IDs that must land first

### Execution rules for implementing AI agents

> **START HERE:** Read `notes/codebase-reference.md` before writing a single line of code. It maps every exact file path, function signature, env var, DynamoDB key, and route path. Do not guess.

1. **Work on `auth_rbac_feature` only.** Never push to another branch.
2. **One task = one focused change + its tests.** Keep commits small and descriptive.
3. **Match existing style.** Server is **ESM** (`import`/`export`, `"type": "module"` in `agency-app/api/package.json`). No `require()`. Frontend is **React 18 + React Router v7 + TailwindCSS**, fetch-based `ApiService`. AWS SDK is **v3** (`@aws-sdk/*`).
4. **Tenant isolation is non-negotiable.** Derive `tenantId` from `req.tenantId` only (set by `validateToken` middleware). NEVER read tenant from request body or headers.
5. **Run `agency-app/api/scripts/build.sh`** (syntax check) before considering any server task done. This script currently only checks `routes/ middleware/ scripts/ lib/` — it does not check root `*.js` or `agents/`. Extend it in E6 (see `07-infra-cfn-deploy.md` §7).
6. **Secrets via env + CFN parameters only.** Never hardcode keys.
7. **Infra changes** go into `agency-app/api/infra/cfn-backend.yaml` + individual `cron/*.yaml` files. Reflect all new params in `agency-app/api/infra/deploy.sh`. See `07-infra-cfn-deploy.md` for the full consolidated change list.
8. **Do NOT invent directories.** There is no `agency-app/api/services/`, `agency-app/api/config/`, or `server/errors/`. New backend modules go at **server root** as `server/<name>.js` and ship automatically via the `*.js` glob. Only `agency-app/api/agents/` is a new allowed subdirectory (add it to the zip include explicitly).
9. **Check before creating.** These files ALREADY EXIST and must not be recreated: `src/pages/RegisterAdmin.tsx`, `src/components/TrialCountdownBanner.tsx`, `src/components/GlassDataTable.tsx`, `src/components/PaywallModal.tsx`, `src/lib/razorpay.ts`. Read them before writing anything new.

---

## EPIC Index

| EPIC | File | Scope | Est. |
|------|------|-------|------|
| **Ref** | `notes/codebase-reference.md` | **READ FIRST** — exact paths, functions, env vars, table/route map | — |
| **Validation** | `00-validation-and-feasibility.md` | Plan-vs-code audit, 17 corrections, risks, open decisions | — |
| **EPIC 1** | `01-epic-onboarding-whatsapp.md` | Wire RegisterAdmin route (1 file change), upgrade flow, Bailey WhatsApp (optional) | 2 wk |
| **EPIC 2** | `02-epic-credit-system.md` | Unified credit ledger, metering, packages (free / ₹1999 / ₹4999), 20% annual | 3 wk |
| **EPIC 3** | `03-epic-email-ses-migration.md` | AWS SES primary + Brevo fallback across 4 routes + 2 crons via `emailService.js` | 1 wk |
| **EPIC 4** | `04-epic-team-analytics.md` | Admin-only team analytics dashboard, Excel export, WhatsApp summary | 2 wk |
| **EPIC 5** | `05-epic-data-quality-crons.md` | Crons: half-filled records + expiring agreements alerts | 1 wk |
| **EPIC 6** | `06-epic-mcp-agents.md` | MCP server wrapping 6 skills + 3 Bedrock agents (qualifier, follow-up, router) | 4 wk |
| **Infra** | `07-infra-cfn-deploy.md` | All CFN + deploy.sh changes, consolidated | — |
| **Testing** | `08-testing-and-acceptance.md` | Test strategy, E2E scenarios, security review checklist | — |
| **SES Setup** | `notes/ses-aws-setup.md` | Manual AWS steps: domain verify, DKIM, sandbox→production | — |

**Critical path:** EPIC 1 → EPIC 2 → (EPIC 3, 4, 5 in parallel) → EPIC 6.
**Quickest win:** E1-T1 (one route in App.tsx) unblocks the entire signup funnel.

## Implementation Status (2026-06-19, branch `mvp-readiness-launch`)

| EPIC | Status | Notes |
|------|--------|-------|
| E1 Onboarding + WhatsApp | ✅ Done | Bailey behind `BAILEY_ENABLED=false` |
| E2 Credit System | ✅ Done | Seed config table on deploy |
| E3 Email SES | ✅ Done | SES verify manual step required |
| E4 Team Analytics | ✅ Done | Add nav link polish |
| E5 Data Quality Crons | ⚠️ Partial | Service done; cron handlers stub |
| E6 MCP + Agents | ⚠️ Partial | MCP + runtime scaffold; agents disabled |
| Infra | ✅ Done | See `pending-mvp/deployment-steps.md` |

**Pending manual work:** `pending-mvp/README.md`

---

## Configurability (owner-controlled)

Everything pricing/cost/schedule-related must be **configurable by the owner** without code changes — via a config table (`cloudberry-real-estate-credit-config`) seeded with defaults and overridable. See `02-epic-credit-system.md` → `E2-T1`.

---

## Source of truth

The narrative plan lives at `/root/.claude/plans/gleaming-growing-rain.md`. **This folder supersedes it** where they differ, because this folder is validated against the actual codebase.
