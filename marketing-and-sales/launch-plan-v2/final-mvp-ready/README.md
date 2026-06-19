# Final MVP-Ready Implementation Plan — RealEstateFlow

**Branch:** `auth_rbac_feature` (this is the ONLY target branch)
**Status:** Validated against actual code on 2026-06-19
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

### Execution rules for implementers

1. **Work on `auth_rbac_feature` only.** Never push to another branch.
2. **One task = one focused change + its tests.** Keep commits small and descriptive.
3. **Match existing style.** Server is **ESM** (`import`/`export`, `"type": "module"`). Frontend is **React 18 + React Router v7 + TailwindCSS**, fetch-based `ApiService`. AWS SDK is **v3** (`@aws-sdk/*`).
4. **Tenant isolation is non-negotiable.** Always derive `tenantId` from `req.tenantId` (set by `validateToken`). NEVER trust client headers/body for tenant.
5. **Run `server/scripts/build.sh`** (syntax check) before considering a server task done.
6. **Secrets via env + CFN parameters only.** Never hardcode keys (the repo already had a hardcoded-secret incident in `ai-calling-service/deploy-lambda.ps1` — do not repeat).
7. **Infra changes** go into the CFN files described in `07-infra-cfn-deploy.md` and must be reflected in `server/infra/deploy.sh` params.

---

## EPIC Index

| EPIC | File | Scope | Est. |
|------|------|-------|------|
| **Validation** | `00-validation-and-feasibility.md` | Plan-vs-code audit, corrections, risks, decisions | — |
| **EPIC 1** | `01-epic-onboarding-whatsapp.md` | Wire RegisterAdmin route, upgrade flow, Bailey WhatsApp gateway (optional) | 2 wk |
| **EPIC 2** | `02-epic-credit-system.md` | Unified credit ledger, metering, packages (free / ₹1999 / ₹4999), 20% annual | 3 wk |
| **EPIC 3** | `03-epic-email-ses-migration.md` | AWS SES primary + Brevo fallback across 4 routes + 2 crons | 1 wk |
| **EPIC 4** | `04-epic-team-analytics.md` | Admin-only team analytics dashboard, Excel export, WhatsApp summary skill | 2 wk |
| **EPIC 5** | `05-epic-data-quality-crons.md` | Crons for half-filled leads/owners/tenants/properties + expiring agreements | 1 wk |
| **EPIC 6** | `06-epic-mcp-agents.md` | MCP server wrapping 6 skills + 3 Bedrock agents (qualifier, follow-up, router) | 4 wk |
| **Infra** | `07-infra-cfn-deploy.md` | All CFN additions + deploy.sh param updates, consolidated | — |
| **Testing** | `08-testing-and-acceptance.md` | Test strategy, E2E scenarios, security review checklist | — |

**Critical path:** EPIC 1 → EPIC 2 → (EPIC 3, 4, 5 in parallel) → EPIC 6.

---

## Configurability (owner-controlled)

Everything pricing/cost/schedule-related must be **configurable by the owner** without code changes — via a config table (`cloudberry-real-estate-credit-config`) seeded with defaults and overridable. See `02-epic-credit-system.md` → `E2-T1`.

---

## Source of truth

The narrative plan lives at `/root/.claude/plans/gleaming-growing-rain.md`. **This folder supersedes it** where they differ, because this folder is validated against the actual codebase.
