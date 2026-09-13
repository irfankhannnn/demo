# AgencyConfig split-table bug — report and fix

Written 2026-09-12 during end-to-end CRM testing (fresh self-serve signup →
AI Assistant → lead creation) on `cloudberry-main` nonprod.

## What was found

Testing the AI Assistant against a brand-new, self-serve-registered tenant
("Test Realty QA", created via Phone OTP → Register Admin) surfaced a genuine
architectural bug, not a config mistake:

**Two independent DynamoDB tables both called "AgencyConfig" existed, owned by
two different services, never synced:**

| | `reality-flow-authentication` | `server` |
|---|---|---|
| Table | `<env>-realestateflow-auth-agency-config` | `<env>-realestateflow-agencies` |
| Written at | self-serve registration (`phoneAuthCustomController.ts`) | billing/upgrade flows, property-pages setup, ManyChat setup, AI Employee config |
| Read by | login-time checks (`resolveUser.ts`, `resolveMemberUser.ts`), invite flow, account deletion | `agentRuntime.js` (AI Assistant gate), `publicListingService.js`, `siteVisitBooking.js`, billing, notifications, webhooks, whatsapp — 15+ files |

Because the two tables were never connected, **every organically-signed-up
tenant had a row in the auth service's table and no row at all in the CRM/
agent server's table.** Any server-side feature keyed on `AgencyConfig` was
silently broken for such a tenant, with no error surfaced to the user or the
admin — the code paths involved (`agentRuntime.js`, `publicListingService.js`)
all treat a missing/null config as "not configured" rather than "this is
broken", so it looks like a product limitation rather than a bug.

**Confirmed broken as a direct result, live, on the test tenant:**
- **AI Assistant chat** — every message returned `agent.invoke.not_provisioned`
  then, once provisioning was faked, `agent.invoke.disabled_by_tenant` —
  because `agentRuntime.js`'s `getAgencyConfig(tenantId)` call
  (`server/agencyConfigService.js`) always returned `null` for this tenant.

**Almost certainly also broken for the same reason** (not directly
reproduced this session, but these all read the same `server`-side
`AgencyConfig` row that never existed):
- Public property pages setup (`publicListingService.js`, `server/routes/publicPagesSettings.js`)
- ManyChat/Instagram webhook token resolution (`getTenantIdByInstagramWebhookToken`)
- WhatsApp connection resolution (`getTenantIdByConnectedWhatsAppPhone`)
- Notification/reminder recipients (`meetingReminderRecipients.js`)
- Billing/credit config reads tied to agency settings

## Why this stayed invisible until now

Every previous test of these features (property-pages demo tenant, ManyChat
webhook test, earlier `agent-chat` smoke tests) used a tenant that was either
**seeded directly into `server`'s table by a script** or **manually
provisioned by an engineer** — never a tenant created through the real,
organic self-serve signup flow. This session was the first time the actual
`Phone OTP → Register Admin` path was exercised end-to-end, which is exactly
the path that only ever wrote to the *other* table.

## The fix

**Single source of truth: `server`'s `AgencyConfigTable`.** Rationale — it
already has 15+ consumers across billing, property pages, AI config,
notifications, and webhooks, vs. `reality-flow-authentication`'s 6 (mostly
login-time checks). Consolidating the other direction would have meant
rewriting the larger, more business-critical surface.

**Chosen mechanism: direct DynamoDB access from both services to the same
table, not an HTTP call from one service to the other's internal API.** This
was a deliberate call, not the default choice — `getAgencyConfig` is on the
**login hot path** (`resolveUser.ts`/`resolveMemberUser.ts` call it up to 3-4
times across branches on every request). Relaying that through a second
Lambda over HTTP would have added 50-150ms per call, multiple times per
login, for a value that direct DynamoDB access already fetches in 5-20ms
today. Given `reality-flow-authentication` already handles equivalent PII
(users, phone/email identity) at the same trust level, granting it IAM access
to a second business-config table already trusted by every other CRM service
is a materially smaller trust expansion than the property-pages-ms/
adapter-ingestion pattern (public-internet-facing, zero-trust services) this
repo otherwise follows for cross-service data access — that pattern was built
for a different threat model and doesn't fit two already-privileged backend
peers sharing one config table.

### Changes made

**`server/infra/cfn-backend.yaml`** — `AgencyConfigTable` gained:
- Two new attributes: `adminEmail`, `adminPhone` (both `S`)
- Two new GSIs: `adminEmail-index`, `adminPhone-index` (simple hash-key
  lookups, `Projection: ALL`) — these replace the `AdminEmailIndex`/
  `AdminPhoneIndex` GSIs that used to live on the auth service's own,
  now-removed table
- No IAM change needed on the server side — the existing Lambda role's grant
  is already `${AgencyConfigTable.Arn}/index/*` (wildcard), so it covers the
  new indexes automatically

**`reality-flow-authentication/infra/cfn-backend.yaml`**:
- Removed the `AgencyConfigTable` resource entirely (`DeletionPolicy: Retain`,
  so the physical table is orphaned, not deleted — see "What's left" below)
- Removed the now-dangling `AgencyConfigTableName`/`AgencyConfigTableArn`
  outputs (confirmed nothing else `Fn::ImportValue`s them)
- Added a new `AgencyConfigTableName` parameter (mirrors the existing
  `SubscriptionsTableName` pattern exactly: a literal fallback plus a
  `ServerStackName`-gated `Fn::ImportValue` of `server`'s
  `AgencyConfigTableArn`/`AgencyConfigTableName` exports)
- IAM policy and the Lambda's `AGENCY_CONFIG_TABLE` env var now point at
  `server`'s table via that same `UseServerStackExport` condition
- **No changes needed to any of the 6 files that call
  `agencyConfigModel.ts`** (`accountController.ts`, `authController.ts`,
  `inviteController.ts`, `phoneAuthCustomController.ts`,
  `resolveUser.ts`, `resolveMemberUser.ts`, plus `phoneAuthCustomController`) —
  the model file's function bodies (`GetCommand`/`PutCommand`/`UpdateCommand`/
  `QueryCommand`) are unchanged; only the table name they point at changed,
  because the schema (partition key `TenantId`, GSI shape) now matches.

**Incidental fix found and corrected while wiring this up:** neither
`ServerStackName` nor `SubscriptionsTableName` were actually being passed as
CloudFormation parameter overrides by `infra/deploy.sh` — every deploy
(dev or prod) silently used the template's hardcoded dev-only default
(`dev-realestateflow-subscriptions`) regardless of environment or of what
`.env.prod` said. Harmless by coincidence for `Subscriptions` (the literal
default happens to be the real dev table name), but a live prod-correctness
bug and one my new `AgencyConfigTableName` parameter would have inherited.
Fixed by adding `AgencyConfigTableName` (and confirming `ServerStackName`/
`SubscriptionsTableName` are) real entries in `infra/lib/params.sh`'s
`PARAM_KEYS`/`PARAM_VALUES` — the parameter-generation module the other
in-flight config-only-deploy work already extracted from `deploy.sh`.

**Config files** — `reality-flow-authentication/.env.dev`, `.env.prod`,
`sample.env`: `AGENCY_CONFIG_TABLE` now points at `server`'s table name
(`dev-realestateflow-agencies` / `prod-realestateflow-agencies`); `.env.dev`'s
previously-blank `SERVER_STACK_NAME` is now set to
`dev-realestateflow-backend` (that stack exists; this was safe and correct
to do, and also fixes the incidental `Subscriptions` issue above for dev).

**Data migration:** the one real tenant affected in nonprod ("Test Realty QA",
`069b048f-398a-42b0-a95c-d740102c8ab6`) had its row copied from the old auth
table into `server`'s table (`agencyName`, `adminEmail`, `status`,
`notificationSettings`), so nothing it had is lost.

## Verified live, end-to-end (2026-09-12)

After both stacks redeployed, a real chat message was sent through the actual
CRM UI as the test tenant. Server logs confirm the full chain now works:

```
ddb.getAgencyConfig  tableName=dev-realestateflow-agencies  ok=true
credits.deducted     cost=15  actionType=agent_action
agent.router.result  source=rules.keyword.leads  domains=[leads]
```

`getAgencyConfig` resolving successfully is the direct proof the fix works —
this is the exact call that always returned `null` before, for any
organically-signed-up tenant. The turn then failed one step later, but on a
**completely unrelated, pre-existing** issue: the configured Gemini model
(`gemini-2.5-pro`, `GEMINI_MODEL` in `server/.env.dev`) has been deprecated by
Google (`This model models/gemini-2.5-pro is no longer available to new
users`). Credits were correctly auto-refunded on that failure. This is a
separate follow-up (update `GEMINI_MODEL` to a currently-supported model) —
not fixed here, since picking a replacement model is a product decision, not
part of this bug.

Two more pre-existing, unrelated gaps surfaced by this same test, noted for
awareness only (neither touched):
- New tenants get no seeded credit balance and no `AIEmployeeProvisioning`
  row from the self-serve signup flow — both had to be created manually
  here to get far enough to test. Worth a real fix in the registration flow
  at some point, but out of scope for the AgencyConfig split-table bug.
- `dev-realestateflow-api`'s Lambda role lacks `cloudwatch:PutMetricData` —
  harmless (custom metric emission fails silently and is already
  try/caught), but means credit-related CloudWatch metrics aren't actually
  recording in dev.

## Gemini model update (2026-09-12)

`GEMINI_MODEL` (`planTurn.js`/`composeReply.js`, main tool-planning + reply
generation) and `GEMINI_CLASSIFIER_MODEL` (`domainRouter.js`'s LLM fallback
classifier, only invoked when the rules fast-path can't decide) both pointed
at deprecated/aging models (`gemini-2.5-pro`, `gemini-2.5-flash`). Checked
every Gemini call site in this codebase (`planTurn.js`, `composeReply.js`,
`domainRouter.js`) and confirmed all three are single-turn `generateContent`
calls — none constructs a `FunctionResponse` for a follow-up turn — so
Gemini 3.x's stricter multi-turn function-calling protocol doesn't apply and
a model swap carries no compatibility risk here.

- `GEMINI_MODEL` → `gemini-3.8-flash` (current-gen Flash tier, matches the
  planning/reply task's complexity).
- `GEMINI_CLASSIFIER_MODEL` → `gemini-3.1-flash-lite` (cheapest current-gen
  tier — this call only returns a tiny `{domains, smalltalk}` JSON blob, no
  tools, so it doesn't need Flash-tier capability).

Updated in all env files (`.env`, `.env.dev`, `.env.prod`, `.env.sample`),
the CFN template defaults (`GeminiModel`/`GeminiClassifierModel` Parameters
in `server/infra/cfn-backend.yaml`), and `generate-cfn-params.sh`'s
fallbacks. Both variables are SSM-Parameter-Store-mapped
(`server/infra/ssm-param-map.txt`), so deployed to dev via the fast
config-only path (`infra/config-deploy.sh dev`) — no full stack redeploy
needed. Verified live via `aws ssm get-parameter --with-decryption` against
both SSM parameters post-deploy.

## Third write path found and fixed (2026-09-12): `onboarding-page`

A repo-wide audit for any remaining reference to the old table/index names
turned up a **third, previously-unaudited producer**:
`onboarding-page/server/ddb.js`'s `putAgencyConfig()` (called from
`onboardService.js`'s `onboardTenant()`) writes a brand-new tenant's
AgencyConfig row directly via `AGENCY_CONFIG_DYNAMODB_TABLE_NAME` — completely
independent of both `reality-flow-authentication`'s and `server`'s model
code. Its **live `.env`** (not just a stale comment) was pointed at
`prod-realestateflow-auth-agency-config` — the same old, split, auth-owned
table this whole fix moved everyone else off of. Any tenant onboarded through
this tool would reproduce the original bug: a row the CRM/AI Assistant would
never see.

Fixed the naming convention everywhere in `onboarding-page`
(`server/ddb.js` comments, `README.md`, `web/index.html`, `.env.sample`) to
point at `<env>-realestateflow-agencies` (server's consolidated table),
**except the live `prod` `.env` value**, left deliberately on the old table
for now — see the caveat below.

**Prod is not yet migrated.** Checked directly against
`prod-realestateflow-agencies` in the real prod account
(`cloudberry-prod-new`): it exists, but its only GSIs are
`instagramWebhookToken-index`/`connectedWhatsAppPhone-index` — no
`adminEmail-index`/`adminPhone-index`. Neither `server/infra/cfn-backend.yaml`
nor `reality-flow-authentication/infra/cfn-backend.yaml`'s consolidation
changes have been deployed to prod; prod's `reality-flow-authentication`
stack still owns its own separate `AgencyConfigTable`. So
`onboarding-page/.env`'s prod value was deliberately left as
`prod-realestateflow-auth-agency-config` (matching prod's current live
reality) with a comment explaining why, and a clear "do not switch until
prod migration deploys" warning. **This whole fix, including the model
updates above, is dev-only (`cloudberry-main`) as of this writing — prod
still has the original split-table bug.** Deploying the CFN consolidation
to prod, then flipping `onboarding-page`'s prod `.env`, is the next step
before this can be called fully fixed.

## Old table cleanup (2026-09-12)

The old `reality-flow-authentication`-owned `dev-realestateflow-auth-agency-config`
table (dev only) has been **deleted**, now that:
- its single row was confirmed byte-for-byte migrated into
  `dev-realestateflow-agencies` (matched by `TenantId`, same
  `agencyName`/`adminEmail`/`notificationSettings`/`createdAt`);
- an on-demand backup was taken first (`dev-realestateflow-auth-agency-config-pre-delete-20260912`,
  in `cloudberry-main`) as a safety net beyond the table's own PITR (which
  does not survive a `delete-table` call);
- the repo-wide reference audit above (including the `onboarding-page` find)
  turned up nothing else still pointing at it in dev.

Prod's equivalent table (`prod-realestateflow-auth-agency-config`, 1 item)
was **not touched** — it's still the live, in-use table for prod's
unmigrated `reality-flow-authentication` stack. Delete it only after prod
goes through the same CFN migration + verification this dev environment did.

## What's left / follow-ups

- **Prod migration is the main remaining item.** Deploy the
  `reality-flow-authentication`/`server` CFN consolidation to prod, verify
  end-to-end the same way dev was verified, flip `onboarding-page/.env`'s
  prod value to `prod-realestateflow-agencies`, then delete
  `prod-realestateflow-auth-agency-config` (take a backup first, same as
  dev).
- **`server/agencyConfigService.js` does not yet have
  `findAgencyByAdminEmail`/`findAgencyByAdminPhone`/`createAgencyConfig`/
  `markAgencyForDeletion` equivalents.** They weren't added because nothing on
  the `server` side currently needs them — `reality-flow-authentication`'s own
  model file already implements the equivalent DynamoDB calls directly and
  didn't need touching. If `server` ever needs these operations itself, add
  them there rather than re-deriving them.
- **No changes were made to Postgres or any other datastore.** A full
  Postgres migration was considered and explicitly rejected as out of scope —
  it would touch every DynamoDB access point across both services (and
  several more: `backend_insta_sol_ms`, `property-pages-ms`, `whatsapp-platform`),
  a multi-week rewrite far beyond what this bug required, and not something to
  do unilaterally against a repo with live nonprod (and eventually prod)
  traffic. The two-table split was the actual defect; consolidating onto one
  already-established DynamoDB table is the complete fix for it.
