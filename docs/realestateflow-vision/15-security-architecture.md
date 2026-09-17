# 15 — Security Architecture

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Hardcoded secrets are out of the working tree (rotation unconfirmed), PITR is on, service-to-service auth is shared API keys, and the before-launch hardening list is now fixed by D17 and D18.

> **Scope:** identity, roles, tenant isolation, secrets, encryption, audit, platform hardening and compliance for a multi-tenant CRM. Related: `11` (lead visibility), `12` (voice consent), `14` (vector isolation), `16` (infra).

---

## 1. Posture today

In place:

- Cognito-based auth microservice (`services/reality-flow-authentication`): phone OTP, Google sign-in, PKCE, refresh token in an httpOnly cookie.
- Tenant id derived on the server, not taken from the client.
- CRM Express hardening: CORS allowlist (`apps/crm/server/utils/corsOrigins.js`), security headers, auth rate limiting, timing-safe API-key compares, structured logging.
- Phone numbers masked in every `/api/crm/*` JSON response (`apps/crm/server/middleware/phoneMasking.js`).
- DPDP grievance route (`apps/crm/server/routes/grievance.js`).
- DynamoDB point-in-time recovery on all 18 tables in the CRM backend stack and on the main tables of the calling, follow-up, auth, WhatsApp and Instagram stacks.

Gaps are listed in §2 (keys) and §8 (hardening).

## 2. Leaked credentials (D18, open action)

What happened:

- Exotel and ElevenLabs credentials were committed in `ai-calling-service/deploy-lambda.ps1` and a copy in the CI/CD wrapper. Both files were deleted in Sep 2026 (commit `bdff45e`).
- A Gemini API key and a Baileys API key were committed in `server/whatsapp-env.json`; the file was untracked in commit `a42f30c` (`docs/security-key-rotation.md`).
- A CRM API key is also in history.
- Git history was not rewritten, so all of these values are still readable in history.

**Rotation status: unconfirmed.** `docs/services/ai-calling-service/GO-LIVE-RUNBOOK.md` still lists rotation as pending.

Plan (D18):

1. Rotate the Exotel, ElevenLabs, Gemini, Baileys and CRM API keys.
2. No history rewrite. Never force-push.
3. Add gitleaks secret scanning to CI. Today there is none: the workflows are `insta-sol-ms-tests.yml`, `playwright.yml`, `pr-intelligence.yml` and `server-tests.yml` (`.github/workflows/`), and the only dependency check is `npm audit` in the Instagram workflow.

New secrets go in gitignored `.env.dev` / `.env.prod` files and reach AWS as NoEcho CloudFormation parameters, SSM SecureString or Secrets Manager (§6). No secret values belong in docs.

## 3. Identity and authentication

- **Users:** stay on Amazon Cognito with phone OTP, Google and PKCE, refresh in an httpOnly cookie.
- **Service to service today:** shared API keys plus an `x-tenant-id` header, compared with timing-safe checks (for example `apps/crm/server/routes/adapterIngestionInternal.js`). Examples:
  - CRM → follow-up service: `CRM_CALLER_API_KEY`
  - Follow-up service → CRM: `CRM_INTERNAL_API_KEY` (the CRM's `FOLLOWUP_INTERNAL_API_KEY`)
  - CRM ↔ calling service: `AI_CALLING_INTERNAL_API_KEY`
  - Intake adapters → CRM: `ADAPTER_INTERNAL_API_KEY`
  - ElevenLabs → calling service tools: `SERVER_TOOL_API_KEY`, tenant bound from a `secret__tenant_id` dynamic variable
  (`services/followup-agent-service/README.md`, `services/ai-calling-service/README.md`, `apps/crm/server/infra/cfn-backend.yaml`)
- **External AI clients:** the MCP server runs its own OAuth, validating Cognito user tokens (`services/reality-flow-mcp/src/routes/oauth.ts`, `src/middleware/validateToken.ts`).
- **Later:** per-service machine identities (for example Cognito M2M clients) with scopes, replacing shared keys. Not scheduled.

## 4. Roles (D15)

Today the auth service issues only `ADMIN` and `MEMBER` (`services/reality-flow-authentication/src/controllers/phoneAuthCustomController.ts`). The CRM middleware already accepts `MANAGER`, `OWNER` and `FOUNDER` (`apps/crm/server/middleware/requireRole.js`), but nothing issues them. Members can see every lead in the tenant.

Decision D15:

| Phase | Roles and visibility |
|---|---|
| **M1 launch (Phase A)** | `ADMIN` and `MEMBER`, as built |
| **Before selling Team plans (Phase B)** | Add `MANAGER`; members see only their own (assigned) leads |

Principles that hold at every stage:

- Enforcement is on the server, in routes and in tool handlers. Frontend gating is UX only.
- An AI agent never has more access than the user or context it acts for.
- Tenant id is never taken from a request body or a model argument.

## 5. Tenant isolation

| Dimension | As built |
|---|---|
| **CRM data** | `tenantId` attributes with tenant-scoped GSIs (for example `search-index`, `tenant-index`) in the CRM table; some list functions still scan and filter by tenant (`apps/crm/server/crmDynamodbService.js`, TODO MED-1) |
| **Calling data** | Keys prefixed `TENANT#{tenantId}#CALL#...` (`services/ai-calling-service`) |
| **Vector search** | `tenantId` is the HASH key of both vector search schemas; AWS rejects a search without it (`apps/crm/server/infra/create-vector-index.mjs`, see `14`) |
| **Voice tools** | Tenant from a bound header, never from a model parameter |
| **Instagram** | Per-tenant OAuth connection; tokens AES-256-GCM encrypted in DynamoDB (`apps/instagram/backend_insta_sol_ms/services/metaSecurity.js`); the service's IAM role reaches only its own two tables and talks to the CRM over the internal API |
| **Files** | S3 object keys prefixed with tenant id (`<tenantId>/call-recordings/...`) |
| **Credits / usage** | Per-tenant credit ledger (`apps/crm/server/creditService.js`) |

Not built: per-tenant KMS keys, per-tenant secrets, automated cross-tenant isolation tests in CI.

## 6. Secrets and encryption

- **CRM backend:** about 100 config values, keys included, live in SSM Parameter Store (SecureString) and are loaded at cold start (`apps/crm/server/config/ssmBootstrap.js`, synced by `apps/crm/server/infra/sync-ssm-params.sh`).
- **Calling, follow-up and WhatsApp platform stacks:** one Secrets Manager secret each, loaded at cold start.
- **Instagram tokens:** encrypted in DynamoDB (above).
- **KMS:** one customer-managed key, in `services/whatsapp-platform/infra/cfn-platform.yaml`. Everything else uses AWS-managed encryption.
- **S3 documents / recordings bucket** (`apps/crm/server/infra/cfn-backend.yaml`): public access blocked, SSE-S3, no expiration rule (customer records are never deleted), versioning explicitly `Suspended`.

> **Open question:** re-enable versioning on the documents / recordings bucket? Not decided.

## 7. Audit and observability

- `AgentAuditTable` records agent actions (`apps/crm/server/agents/agentAuditService.js`), but rows carry a **90-day TTL**, so DynamoDB deletes them. **D17:** archive audit rows instead of letting TTL delete them.
- A general CRM mutation audit log is not built (Phase B, see `00`).
- API Gateway access logs exist only in the auth stack. None on the CRM API.
- No WAF in any template.
- CloudWatch alarms, a CRM dashboard, Sentry and PostHog are in place (`16 §7`).

## 8. Platform hardening (D17)

| Item | State today | When (D17) |
|---|---|---|
| API throttling on the CRM API | Not built. Rate limiting is an in-memory Express limiter (`apps/crm/server/middleware/rateLimiter.js`), which doesn't hold across Lambda containers. API Gateway throttling exists only on the Instagram and property-pages stacks. | **Before paid launch** |
| API Gateway access logs on the CRM API | Not built | **Before paid launch** |
| CORS on API Gateway gateway responses | Still `Access-Control-Allow-Origin: '*'` on 5 gateway responses (`apps/crm/server/infra/cfn-backend.yaml`); the Express allowlist is correct | **Before paid launch** |
| Server-enforced read-only after the grace period | `apps/crm/server/scripts/grace-period-expiry-cron.js` exists but no EventBridge rule schedules it | **Before paid launch** |
| Archive agent audit rows instead of TTL delete | TTL delete today | Phase B (with the CRM audit log) |
| WAF on public APIs | None | **After first customers** |
| Rotate leaked keys, gitleaks in CI | See §2 | **Before paid launch** |
| Least-privilege IAM per service | Mostly in place; `bedrock:InvokeModel` on `*` and stale Claude 3 Haiku grants remain on CRM roles | Clean up with Phase B |

## 9. Compliance

- **DPDP Act 2023:** consent for lead and customer data, purpose limitation, access and deletion requests (grievance route exists), breach process. Data subject deletion must not hard-delete CRM records by default; archive instead.
- **WhatsApp:** Baileys (self-hosted, `services/whatsapp-platform`) is used only as a staff command channel. Customer messaging moves to the official WhatsApp Business Cloud API (D9, `39`). Chatwoot is dropped.
- **Telephony:** outbound only at launch, consent captured at intake, DLT registration before bulk calls (D16, `12`).
- **RERA:** property claims in marketing and sales content must be accurate.
- **Data residency:** India tenant data stays in ap-south-1 (Mumbai).

> **Open question:** Dubai tenants (named in CLAUDE.md) would need a data-residency review. M1 is India-only; keep this as a later note or remove it? Not decided.

## 10. Agent-specific threats

| Threat | Mitigation (built unless marked) |
|---|---|
| Prompt injection through inbound messages or documents | External content treated as data; tools enforce tenant and role regardless of the prompt; no secrets in agent context |
| Agent over-action | Bounded tool loop; unattended flows (qualifier) use schema-constrained output; human approval gates for high-stakes actions (partly built) |
| Cross-tenant leakage | Tenant from auth or bound headers, never from arguments; vector search requires `tenantId` |
| Runaway cost | Credit checks before AI calls and agent actions (`apps/crm/server/middleware/meterCredits.js`) |
| Exfiltration via tools | Phone masking on CRM responses; egress audit and DLP not built |

## 11. Phasing

- **Phase A (M1 launch, before taking payment):** rotate keys and add gitleaks; API throttling, CRM API access logs, gateway-response CORS fix; schedule and enforce read-only after grace.
- **Phase B (hardening):** `MANAGER` role and own-leads visibility; CRM audit log and archive (not TTL delete) for agent audit rows; WAF after first customers; IAM clean-up.
- **Later:** per-service machine identities; per-tenant KMS for sensitive fields; isolation tests in CI.

## 12. Considered in June, not adopted

- A four-role model (Owner / Manager / Team Lead / Agent) with territory scoping at launch (replaced by D15).
- Cognito M2M identities for every agent from P2, and AgentCore Identity / Policy (the agent runtime is in-house, see `04`).
- Per-tenant Secrets Manager secrets and per-tenant KMS keys as the default.
- Bedrock Knowledge Base metadata filters for isolation (retrieval is DynamoDB vector search, `14`).
- Isolated browser microVMs for portal automation (portal posting by browser automation is dropped, D14).
