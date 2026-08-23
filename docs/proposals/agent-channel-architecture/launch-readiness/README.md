# Launch Readiness — Feature-by-Feature Assessment

**Scope defined by the founder:** leads, owners, properties, tenants, buyers, sellers, khatabook, meetings, the complete WhatsApp AI flow, the Instagram/ManyChat flow, and S3 upload → analyze → update CRM. **Payment is explicitly on hold.**

**Assessed:** 2026-08-22, branch `auth_rbac_feature`. Test suite **724/724 green** (589 at first assessment).

**Companion documents:**
- [`01-audit-findings.md`](./01-audit-findings.md) — every bug found and fixed across five audit passes
- [`02-credit-refund.md`](./02-credit-refund.md) — the credit-refund leak and the refund policy chosen
- [`03-decisions-and-open-items.md`](./03-decisions-and-open-items.md) — **product decisions taken, and what is still waiting on a person**

---

## How to read the status column

| Status | Means |
|---|---|
| ✅ **Verified** | I ran something that proves it — a test, a direct invocation, a parse |
| ⚠️ **Built, unproven** | Code exists and is self-consistent, but has never run against the real model / real AWS / a real user |
| ❌ **Gap** | Missing or broken |
| ⛔ **Not audited** | I have not examined this. Not a pass — an absence of information |

This distinction is the single most important thing in this document. A large amount of the system is **⚠️, not ✅**, and the gap between those two is what a staging pass closes.

---

## 1. CRM entities over the WhatsApp AI

Tool coverage is **verified** by enumerating the live registry (`TOOL_COUNT: 68`) and confirming every handler resolves to a real function (`validateToolDefinitions`).

| Entity | Create | Read/Search | Update | Remove | Status |
|---|---|---|---|---|---|
| **Leads** | ✅ | ✅ | ✅ | ✅ `archive_lead` | ✅ Complete (8 tools) |
| **Owners** | ✅ | ✅ | ✅ | ✅ | ✅ Complete (8 tools) |
| **Properties** | ✅ | ✅ | ✅ | ✅ | ✅ Complete (8 tools) |
| **Tenants** | ✅ | ✅ | ✅ | ✅ | ✅ Complete (8 tools) |
| **Buyers** | ✅ | ✅ | ✅ | ✅ | ✅ Complete (7 tools) |
| **Sellers** | ✅ | ✅ | ✅ | ✅ | ✅ Complete — *via* `leadType: 'seller'` (see note) |
| **Meetings** | ✅ | ✅ | ✅ | ✅ | ✅ Complete (5 tools) |
| **Khatabook** | ❌ by design | ✅ | ❌ by design | ❌ by design | ✅ **Read-only — added this session** |
| Contacts | ✅ | ✅ | ✅ | ✅ | ✅ Complete (10 tools) |

**Sellers — not a gap.** There is deliberately no `SELLER` entity: `crmDynamodbService.js` records *"SELLER Entity REMOVED — replaced by OWNER + PROPERTY listing for sale."* Sellers exist as `leadType: 'seller'` (confirmed present in both the `create_lead` and `search_leads` enums), and on conversion become an owner plus a for-sale property. Full lifecycle coverage.

**Khatabook — was a hard gap, now partially closed.** Khata is a fully-built REST feature (`routes/khata.js`, 15 endpoints, own table with GSIs, categories, settle/unsettle, summaries) that the agent **could not see at all** — zero tools in the registry. "Kitna paisa pending hai?" was unanswerable despite the data existing. Added this session:

- `search_khata_entries` — filter by settlement status, transaction type, property, party, free text
- `get_khata_summary` — received / paid / net / pending, plus the largest pending items
- A new `khata` routing domain with Hinglish aliases. **Router verified**: `"khata dikhao"`, `"kitna paisa pending hai"`, `"hisaab dikhao"`, `"kitna lena hai"` all route correctly, and `"show me leads"` still routes to leads.

**Write access is deliberately withheld**, and there is a test that fails if anyone adds it. Two reasons: (1) `flows/03-call-intelligence.md` already establishes the rule — *"Khata entries are never created automatically … money records need a human"* — and that principle shouldn't be weaker on WhatsApp than in the call pipeline; (2) the agent's permission check is currently **inert** on WhatsApp (see §5), so an AI money-write tool would be effectively ungated. Recording and settling money stays in the CRM UI until that is fixed.

---

## 2. WhatsApp AI flow — the complete path

| Piece | Status |
|---|---|
| Inbound → EventBridge → processor → agent → reply | ⚠️ Built, unproven |
| Dedup (atomic claim), self-chat auth, chunked delivery | ⚠️ Built, unproven end-to-end |
| Multi-step compound requests ("create lead **and** book visit") | ⚠️ Built, **shipped OFF** behind `AgentToolLoopEnabled` |
| Wrong-domain recovery (scope escalation) | ⚠️ Built, same flag |
| Person disambiguation (`find_person`) | ⚠️ Built, **live**, matching logic unverified |
| Deterministic list/detail card formatting | ✅ Verified by the golden-conversation suite |

**The single-tool-per-turn limitation is fixed but not enabled.** `AgentToolLoopEnabled` defaults to `false`, so today a compound request still completes only its first action. Enabling it is a CFN stack update (the parameter now exists and is wired to all 5 agent Lambdas).

---

## 3. Instagram → ManyChat flow

⛔ **Not audited.** All I have confirmed is that the endpoint exists: `POST /instagram/:webhookToken` in `routes/webhooks.js`, resolving the tenant via `getTenantIdByInstagramWebhookToken` (a per-tenant token embedded in the ManyChat "External Request" URL).

I have **not** examined: payload validation, lead creation, duplicate handling, error paths, token rotation, or what happens on a malformed ManyChat call. Given this is named launch-critical, it needs a dedicated pass.

---

## 4. S3 upload → analyze → update CRM (call recordings)

| Piece | Status |
|---|---|
| Pipeline unit tests (phone extract, entity resolve, analysis, action planner, executor) | ✅ Verified — all suites pass |
| Upload → S3 → Transcribe → Gemini → action plan → approval → CRM write | ⚠️ Built, **never run end-to-end** |
| Design safety (only the note auto-applies; everything else needs approval) | ✅ Verified in `actionPlanner` tests |
| Khata never auto-created from a call | ✅ Verified by design |

A full manual test plan already exists at [`../recording-flow-test.md`](../recording-flow-test.md) (17 scenarios incl. oversized upload, silent audio, transcription failure, cross-tenant isolation, presigned-PUT regression). **It has not been executed.** Running it is the fastest way to convert this row from ⚠️ to ✅.

---

## 5. Security

| Item | Status |
|---|---|
| `archive_*` granted **read** OAuth scope over MCP | ✅ **Fixed this session** — was a live privilege-escalation waiting to fire |
| No `delete_*` tool reachable by the AI (WhatsApp or MCP) | ✅ Verified — 0 in registry, 0 stale in MCP copy |
| Khata write withheld from AI | ✅ Verified by a guard test |
| Tenant scoping on every tool call | ✅ Enforced — `tenantId` is a required parameter throughout |
| Dependency audit in CI | ✅ **Added this session** (`npm audit`, fails on critical) |
| **Category permissions bypassed on WhatsApp** | ❌ **OPEN — see below** |
| Global rate limiting / WAF | ❌ Open (from `launch-audit/05-launch-gaps.md`, INFRA-04) |
| Seat-cap enforcement at invite API | ❌ Open (BUG-009, cross-service, documented not implemented) |

### The one I would not launch past without a decision

**`canUserAccessTool` never runs on the WhatsApp path.** `invokeSkill` only checks permissions when a `userId` is passed, and `whatsapp-message-processor.js` never passes one. Every `USER_CATEGORIES` allowlist is therefore **decorative** on your primary channel — any tool in the registry is reachable by any sender who passes the self-chat check.

Mitigating factors: the self-chat check means only the connected business number can drive the agent, and `delete_*` no longer exists. So the blast radius is "an authorised operator can do anything the agent can do," not "a stranger can." Whether that is acceptable depends on whether multiple staff share that WhatsApp number. Full detail: [`../phase1-imp/07-bugs-found.md`](../phase1-imp/07-bugs-found.md) #8.

---

## 6. Bugs

**Fixed this session (9 live bugs):** `create_meeting` broken at two independent layers (meeting creation was 100% non-functional over WhatsApp); `update_contact_role` completely broken; phone-lookup tools never matched a real number; `delete_property_document` silently deleted nothing; meeting status state-machine had no reachable terminal state; `toTitleCase` corrupted caps-typed building names; `archive_*` mis-scoped over MCP; plus 6 stale prompt instructions steering the model toward removed tools.

**Known-remaining (documented, deliberately unfixed):** phantom note tools referenced in 2 files but absent from the registry; 3 unreachable branches in `responseFormatter.js`; `toolContextBuilder.js` entirely dead (also holds a stale phone-keyed call). None affect runtime behaviour.

---

## 7. SRE / observability

**Was at zero** — the stack had 0 alarms, 0 dashboards, 0 SNS topics. `launch-audit/05-launch-gaps.md` lists this as an open **HIGH** gap (INFRA-05): *"Incidents undetected until customer complaint."*

**Now IaC-ready** (validated: YAML parses, dashboard JSON parses):
- **8 alarms** — WhatsApp processor errors / throttles / p95 duration, API Lambda errors, call-recording DLQ-not-empty, queue backlog, worker errors, CrmTable throttling
- **1 dashboard**, 7 widgets
- **SNS topic** + optional email subscription (`AlertEmail`)

Alarms deliberately use **AWS-native** metrics, not the app's custom ones: the custom metrics carry a `TenantId` dimension, so an alarm on them would only ever watch one tenant. Custom metrics appear on the dashboard via `SEARCH` expressions instead.

**Still open:** nothing is deployed; no BetterStack/external uptime monitor; no CD pipeline; no distributed tracing (acceptable per the prior audit).

---

## 8. What must happen before launch

**Blocking, and only you can do these:**

1. **Deploy** — the 7 launch DDB tables (`launch-tables-cfn.yaml`), the `AgencyConfigTable` GSI, the alarms/dashboard, and populate real env values. From `launch-audit/03-production-readiness.md`, all still pending.
2. **Run one staging pass.** This converts most ⚠️ rows to ✅ or finds real bugs:
   - WhatsApp: create/update a lead, owner, property, tenant, buyer, seller-lead, meeting; ask a khata question; ask for a person by name
   - Upload a real recording and walk `../recording-flow-test.md`
   - Fire a real ManyChat webhook
   - Open the CRM on a phone
3. **Decide on the permission bypass** (§5).
4. **Legal + Razorpay KYC** — unchanged from the prior audit (payment on hold, but KYC has a 3–7 day SLA).

**Recommended before enabling the tool loop:** deploy with `AgentToolLoopEnabled=false`, confirm the baseline is healthy, then flip it in staging and watch `agent.tool_loop.result` `stopReason` and `scope_escalation` rates.

---

## 9. Honest summary

The **CRM entity coverage over WhatsApp is genuinely complete** for your stated scope — that's the strongest claim in this document, and it's verified against the live registry rather than asserted. Khata was the one real hole and it's now closed for reads.

Everything else in the WhatsApp/agent/recording surface is **built and self-consistent but unproven against reality**. Instagram is **unaudited**. The frontend is **unaudited** (only signal: 68 `.tsx` files use Tailwind responsive breakpoints — that is not a responsive audit).

**I would not describe this as "ready for launch."** I would describe it as *"ready for a staging pass that will tell you whether it's ready for launch."* The difference matters, and the plan above is ordered to close it fastest.
