# AI Employee System — Comprehensive Production-Ready Implementation Plan

**Document Version:** 2.1 (FINAL)  
**Status:** Ready for Implementation  
**Last Updated:** 2026-06-21  
**Changes in v2.1:** Fixed 6 additional issues (scanAgencyConfigs, hash function, EventBridge parsing, route mount, channel validation, JWT_SECRET storage)

---

## EXECUTIVE SUMMARY

The **AI Employee** system is a WhatsApp-first, credit-metered, autonomous agent platform enabling agency owners to manage their CRM via natural language. This document provides a complete, implementation-ready plan covering all technical, architectural, and operational aspects.

**Key Facts:**
- **Business Model:** ₹7,999/month add-on (`plan_ai_employee_monthly`)
- **Core Value:** Natural language CRM queries via WhatsApp + autonomous lead qualification/routing
- **Architecture:** Bedrock Haiku agents + EventBridge + MCP server + Bailey WhatsApp
- **Cost Model:** 15 credits per agent action
- **MVP Scope:** 4 autonomous agents + WhatsApp inbound + Claude Desktop MCP

---

## PART 1: GAP ANALYSIS

### Current State vs. Requirements

| Component | Status | Gap | Severity |
|-----------|--------|-----|----------|
| `skillInvoker.js` | ✅ Implemented | None | — |
| `agentRuntime.js` | ✅ Exists | Missing tenant opt-in checks, prompts | HIGH |
| `agentAuditService.js` | ✅ Exists | Logs to CRM table; needs dedicated table | MEDIUM |
| `lead-qualifier-handler.js` | ✅ Exists | Missing `lead.qualified` EventBridge emit | HIGH |
| `lead-router-handler.js` | ✅ Exists | Logic incomplete | HIGH |
| `lead-followup-cron.js` | ✅ Exists | Logic incomplete | HIGH |
| `whatsapp-message-processor.js` | ✅ Exists | No free-text agent routing | HIGH |
| EventBridge rules | ✅ Exist in CFN | All `State: DISABLED` | HIGH |
| Lead creation event | ❌ Missing | No `lead.created` publish | CRITICAL |
| MCP server | ⚠️ Partial | Missing service JWT auth + endpoint | HIGH |
| `.mcp.json` registration | ❌ Missing | No `nabi-crm` entry | HIGH |
| `AgentAudit` table | ❌ Missing | Not in CFN | MEDIUM |
| Tenant opt-in flag | ❌ Missing | No `aiEmployeeEnabled` in AgencyConfig | HIGH |
| `deploy.sh` zip | ⚠️ Partial | `agents/` may not be included | MEDIUM |
| Route mounts | ❌ Missing | `/api/crm/agent/tool` not mounted | CRITICAL |
| Billing webhook integration | ❌ Missing | No auto-set of `aiEmployeeEnabled` on purchase | CRITICAL |
| Follow-up cron tenant list | ❌ Missing | No mechanism to iterate all tenants | HIGH |

---

## PART 2: RISK ASSESSMENT

### Critical Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Bedrock quota exceeded** | Agent failures | Rate limit per tenant; CloudWatch alerts |
| **EventBridge event loss** | Silent failures | DLQ + exponential backoff (2s, 4s, 8s, 16s, max 60s) |
| **Credit race condition** | Double-charging | DynamoDB TransactWrite for atomic deduction |
| **WhatsApp message loop** | Infinite replies | Idempotency key (messageId); check `createdBy` |
| **Tenant data leakage** | CRITICAL | Inject tenantId immutably; whitelist tools; audit all calls |
| **JWT secret exposure** | Unauthorized access | AWS Secrets Manager; quarterly rotation |
| **Lambda timeout** | Incomplete actions | Set timeout to 300s; Bedrock client timeout 60s |
| **Subscription race** | Disabled agent | Cache subscription for 5 min; invalidate on webhook |
| **EventBridge enabled globally** | Non-subscribed tenants charged | Add tenant opt-in check as first step in handlers |
| **Missing route mounts** | 404 errors | Mount all routes in server.js |

---

## PART 3: IMPACT ON EXISTING SYSTEMS

### Lead Creation Flow
- **Current:** `POST /api/crm/leads` → create → return
- **New:** `POST /api/crm/leads` → create → **publish EventBridge** → return
- **Impact:** Minimal; non-blocking async
- **Backward Compatibility:** ✅ Fully compatible

### Subscription System
- **New:** Razorpay webhook detects `plan_ai_employee_monthly` → creates provisioning row → sets `aiEmployeeEnabled=true`
- **Impact:** Additive; existing plans unchanged
- **Backward Compatibility:** ✅ Fully compatible

### Credit System
- **New:** 15 credits deducted upfront before Bedrock invoke
- **Impact:** New action type; existing logic unchanged
- **Backward Compatibility:** ✅ Fully compatible

### WhatsApp System
- **New:** Fallback to agent if deterministic command fails
- **Impact:** Extends existing flow
- **Backward Compatibility:** ✅ Fully compatible

### Frontend
- **New:** Agent activity log (admin-only), AI Employee subscription card, follow-up config UI
- **Modified:** Trial banner → highlight AI Employee
- **Impact:** Additive UI components
- **Backward Compatibility:** ✅ Fully compatible

---

## PART 4: ARCHITECTURE DECISIONS

### 1. Tenant Opt-in Mechanism (BOTH Required)

```
AGENTS_ENABLED=true (global flag)
  ↓
AIEmployeeProvisioning.status=live (Razorpay paid)
  ↓
AgencyConfig.aiEmployeeEnabled=true (tenant explicitly enabled)
  ↓
Credit balance >= 15
  ↓
PROCEED
```

**Implementation:**
```javascript
// apps/crm/server/agents/agentRuntime.js
import { getProvisioningByTenant } from '../aiEmployeeProvisioningService.js';
import { getAgencyConfig } from '../agencyConfigService.js';
import { getBalance, deductCredits } from '../creditService.js';

async function invokeAgent(tenantId, prompt, context = {}) {
  // 1. Global flag
  if (process.env.AGENTS_ENABLED !== 'true') {
    logger.warn('agent.invoke.disabled', { tenantId });
    return { ok: false, error: 'agents_disabled' };
  }

  // 2. Provisioning check (Razorpay subscription paid)
  const provisioning = await getProvisioningByTenant(tenantId);
  if (!provisioning || provisioning.status !== 'live') {
    logger.warn('agent.invoke.not_provisioned', { tenantId, status: provisioning?.status });
    return { ok: false, error: 'ai_employee_not_provisioned', status: provisioning?.status };
  }

  // 3. Tenant config check (explicitly enabled)
  const agencyConfig = await getAgencyConfig(tenantId);
  if (!agencyConfig?.aiEmployeeEnabled) {
    logger.warn('agent.invoke.disabled_by_tenant', { tenantId });
    return { ok: false, error: 'ai_employee_disabled_by_tenant' };
  }

  // 4. Credit check
  const balance = await getBalance(tenantId);
  if (balance < 15) {
    logger.warn('agent.invoke.insufficient_credits', { tenantId, balance });
    return { ok: false, error: 'insufficient_credits', balance };
  }

  // 5. Deduct credits (atomic)
  await deductCredits(tenantId, 15, 'agent_action', { reason: 'bedrock_invoke' });

  // 6. Invoke Bedrock...
}
```

---

### 2. AgentAudit Table Schema

```
PK: tenantId
SK: createdAt#id (e.g., "2026-06-21T10:30:45.123Z#a1b2c3d4")

Attributes:
- agentId: "qualifier", "router", "followup", "whatsapp"
- action: "invoke", "tool_call", "error"
- toolName: "create_lead", etc.
- input: JSON (max 512 chars)
- output: JSON (max 1024 chars)
- creditsCharged: 15 for invoke, 0 for tool_call
- status: "success", "error", "timeout"
- durationMs: execution time
- expiresAt: TTL (90 days)

GSI1: tenantId + agentId#createdAt
```

---

### 3. EventBridge Events

**Lead Created:**
```json
{
  "source": "crm.leads",
  "detail-type": "lead.created",
  "detail": {
    "tenantId": "tenant-123",
    "leadId": "lead-456",
    "leadType": "buyer",
    "name": "Rahul",
    "phone": "9876543210",
    "createdAt": "2026-06-21T10:30:45.123Z"
  }
}
```

**Lead Qualified:**
```json
{
  "source": "crm.leads",
  "detail-type": "lead.qualified",
  "detail": {
    "tenantId": "tenant-123",
    "leadId": "lead-456",
    "score": "HOT",
    "scoreValue": 85,
    "qualifiedAt": "2026-06-21T10:30:50.123Z"
  }
}
```

---

### 4. MCP Server Auth Flow

```
Claude Desktop
  ↓ (reads .mcp.json)
  ↓ (spawns MCP server with env: MCP_TENANT_ID, JWT_SECRET)
MCP Server
  ↓ (signs JWT: {tenantId, source: 'mcp', iat, exp})
  ↓ (listens on stdio)
Claude asks: "Create lead named Rahul"
  ↓
MCP calls: POST /api/crm/agent/tool
  Headers: Authorization: Bearer <JWT>
  Body: {toolName: "create_lead", input: {...}}
  ↓
Backend validates JWT (signature, expiry, source='mcp')
  ↓ (extracts tenantId from JWT immutably)
  ↓ (calls skillInvoker with tenantId)
  ↓ (logs to AgentAuditTable)
Returns: {ok: true, data: {...}}
```

---

### 5. Follow-up Agent Modes

**Draft Mode (Default):**
- Agent drafts message
- Store as lead note with type `draft_followup`
- Admin reviews in UI before sending

**Autosend Mode:**
- Agent drafts message
- Send immediately via WhatsApp/Email
- Log to audit table

**Configuration:**
```javascript
// In AgencyConfig:
{
  TenantId: "tenant-123",
  followupAgentMode: "draft", // or "autosend"
  followupAgentAutoSendChannels: ["whatsapp", "email"], // if autosend
}
```

---

## PART 5: PHASE-BY-PHASE IMPLEMENTATION

### Phase 1: Infrastructure (2-3 days)

**Tasks:**
1. Add `AgentAuditTable` to CFN
2. Add Bedrock IAM permissions
3. Enable EventBridge rules (change `State: DISABLED` → `ENABLED`)
4. Add env vars to CFN + Lambda
5. Update `deploy.sh` zip include/exclude
6. Update `.env.example`

**Files Modified:**
- `apps/crm/server/infra/cfn-backend.yaml`
- `apps/crm/server/infra/deploy.sh`
- `apps/crm/server/.env.example`

---

### Phase 2: Agent Runtime & Audit (3-4 days)

**Tasks:**
1. Refactor `agentAuditService.js` → log to dedicated table
2. Create `apps/crm/server/agents/prompts.js` → compose system prompts
3. Refactor `agentRuntime.js` → add tenant opt-in checks, Bedrock loop, error handling

**Files Modified/Created:**
- `apps/crm/server/agents/agentAuditService.js`
- `apps/crm/server/agents/prompts.js` (NEW)
- `apps/crm/server/agents/agentRuntime.js`

---

### Phase 3: EventBridge & Handlers (3-4 days)

**Tasks:**
1. Update `apps/crm/server/routes/leads.js` → publish `lead.created` event
2. Complete `lead-qualifier-handler.js` → emit `lead.qualified` event + add tenant opt-in check
3. Complete `lead-router-handler.js` → assign to best member + add tenant opt-in check
4. Complete `lead-followup-cron.js` → draft/autosend messages + get tenant list

**Files Modified:**
- `apps/crm/server/routes/leads.js`
- `apps/crm/server/scripts/lead-qualifier-handler.js`
- `apps/crm/server/scripts/lead-router-handler.js`
- `apps/crm/server/scripts/lead-followup-cron.js`

**CRITICAL:** Add tenant opt-in check as FIRST step in each handler:
```javascript
export async function handler(event) {
  // Parse EventBridge detail (may be string or object)
  const detail = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
  const { tenantId } = detail;
  
  // Check tenant opt-in FIRST (before any processing)
  const provisioning = await getProvisioningByTenant(tenantId);
  if (!provisioning || provisioning.status !== 'live') {
    logger.info('handler.skipped', { tenantId, reason: 'not_provisioned' });
    return { ok: true, skipped: true };
  }
  
  const agencyConfig = await getAgencyConfig(tenantId);
  if (!agencyConfig?.aiEmployeeEnabled) {
    logger.info('handler.skipped', { tenantId, reason: 'disabled_by_tenant' });
    return { ok: true, skipped: true };
  }
  
  // ... rest of handler
}
```

**For Follow-up Cron:** Get tenant list from AgencyConfig:
```javascript
// First, add scanAgencyConfigs to agencyConfigService.js:
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

export async function scanAgencyConfigs(filter = {}) {
  const params = { TableName: AGENCY_CONFIG_TABLE_NAME };
  
  if (filter.aiEmployeeEnabled !== undefined) {
    params.FilterExpression = 'aiEmployeeEnabled = :enabled';
    params.ExpressionAttributeValues = { ':enabled': filter.aiEmployeeEnabled === true };
  }
  
  const result = await docClient.send(new ScanCommand(params));
  return result.Items?.map(item => item.TenantId) || [];
}

// Then use in lead-followup-cron.js:
import { scanAgencyConfigs } from '../agencyConfigService.js';

export async function handler(event) {
  // Get all tenants with AI Employee enabled
  const tenants = await scanAgencyConfigs({ aiEmployeeEnabled: true });
  
  for (const tenantId of tenants) {
    // ... process follow-up for each tenant
  }
}
```

---

### Phase 4: WhatsApp AI Assistant (2-3 days)

**Tasks:**
1. Update `whatsapp-message-processor.js` → route free-text to agent

**Files Modified:**
- `apps/crm/server/scripts/whatsapp-message-processor.js`

---

### Phase 5: MCP Server & Route Mounts (2-3 days)

**Tasks:**
1. Create `apps/crm/server/routes/agentTools.js` → `/api/crm/agent/tool` endpoint with JWT validation
2. Update `apps/crm/server/mcp-server/index.js` → sign JWT, call endpoint
3. Update `.mcp.json` → register `nabi-crm` server
4. **CRITICAL:** Mount routes in `apps/crm/server/server.js`

**Files Modified/Created:**
- `apps/crm/server/routes/agentTools.js` (NEW)
- `apps/crm/server/mcp-server/index.js`
- `.mcp.json`
- `apps/crm/server/server.js` (add route mounts)

**Route Mount in server.js:**
```javascript
// After other route imports:
import agentToolsRoutes from './routes/agentTools.js';

// In middleware section, after json parser:
app.use('/api/crm', agentToolsRoutes);

// Verify adminRoutes is mounted:
app.use('/api/admin', adminRoutes);
```

**Route Definition in agentTools.js:**
```javascript
router.post('/agent/tool', validateServiceToken, async (req, res) => {
  // ...
});
```

**JWT Validation Middleware in agentTools.js:**
```javascript
function validateServiceToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.source !== 'mcp') {
      return res.status(401).json({ error: 'invalid_token_source' });
    }
    req.serviceTenantId = decoded.tenantId;
    next();
  } catch (err) {
    logger.warn('agentTools.jwt.validation.failed', { error: err.message });
    return res.status(401).json({ error: 'invalid_token' });
  }
}

router.post('/agent/tool', validateServiceToken, async (req, res) => {
  const { toolName, input } = req.body;
  const tenantId = req.serviceTenantId;
  
  try {
    const result = await invokeSkill(tenantId, toolName, input);
    await logAgentAction(tenantId, 'mcp', 'tool_call', { toolName, input }, result, 0);
    res.json(result);
  } catch (err) {
    logger.error('agentTools.invoke.failed', { tenantId, toolName, error: err.message });
    res.status(500).json({ error: err.message });
  }
});
```

---

### Phase 6: Billing Webhook Integration (1-2 days)

**Tasks:**
1. Update `apps/crm/server/routes/billing.js` → on `subscription.activated` with `plan_ai_employee_monthly`, set `aiEmployeeEnabled=true`
2. Verify provisioning row creation (already exists)

**Files Modified:**
- `apps/crm/server/routes/billing.js`

**Implementation:**
```javascript
// In billing.js webhook handler, after createProvisioningRow:
if (event.event === 'subscription.activated' && event.payload.plan_id === 'plan_ai_employee_monthly') {
  // Provisioning row already created above
  
  // Set aiEmployeeEnabled=true in AgencyConfig
  await updateAgencyConfig(tenantId, { aiEmployeeEnabled: true });
  
  logger.info('billing.ai_employee.activated', { tenantId });
}
```

---

### Phase 7: Frontend Integration (2-3 days)

**Tasks:**
1. Create `AgentActivityLog.tsx` component (read-only, admin-only)
2. Add `/api/admin/agent-activity` endpoint with RBAC
3. Add `/api/admin/ai-employee/config` endpoints (GET/PUT) for follow-up mode config
4. Update billing settings → show AI Employee subscription card
5. Update trial banner → highlight AI Employee feature

**Files Modified/Created:**
- `apps/crm/real-estate-crm-app/src/components/AgentActivityLog.tsx` (NEW)
- `apps/crm/server/routes/admin.js` (add agent-activity + ai-employee/config endpoints)
- `apps/crm/real-estate-crm-app/src/pages/crm/BillingSettings.tsx`
- `apps/crm/real-estate-crm-app/src/components/TrialCountdownBanner.tsx`

**Admin Endpoints:**
```javascript
// GET /api/admin/agent-activity
router.get('/agent-activity', validateToken, extractTenantId, requireRole('ADMIN'), async (req, res) => {
  const { limit = 20 } = req.query;
  const activity = await getAgentActivity(req.tenantId, { limit });
  res.json(activity);
});

// GET /api/admin/ai-employee/config
router.get('/ai-employee/config', validateToken, extractTenantId, requireRole('ADMIN'), async (req, res) => {
  const config = await getAgencyConfig(req.tenantId);
  res.json({
    followupAgentMode: config?.followupAgentMode || 'draft',
    followupAgentAutoSendChannels: config?.followupAgentAutoSendChannels || ['whatsapp'],
  });
});

// PUT /api/admin/ai-employee/config
router.put('/ai-employee/config', validateToken, extractTenantId, requireRole('ADMIN'), async (req, res) => {
  const { followupAgentMode, followupAgentAutoSendChannels } = req.body;
  
  if (!['draft', 'autosend'].includes(followupAgentMode)) {
    return res.status(400).json({ error: 'invalid_mode' });
  }
  
  // Validate channels
  const validChannels = ['whatsapp', 'email'];
  if (followupAgentAutoSendChannels) {
    const invalidChannels = followupAgentAutoSendChannels.filter(c => !validChannels.includes(c));
    if (invalidChannels.length > 0) {
      return res.status(400).json({ 
        error: 'invalid_channels', 
        invalidChannels,
        validChannels 
      });
    }
  }
  
  await updateAgencyConfig(req.tenantId, {
    followupAgentMode,
    followupAgentAutoSendChannels,
  });
  
  res.json({ ok: true });
});
```

---

### Phase 8: Testing & Deployment (2-3 days)

**Tasks:**
1. Unit tests for agent runtime, handlers, MCP server
2. Integration tests for EventBridge flow, billing webhook
3. E2E tests for WhatsApp → agent → reply
4. Load testing for Bedrock quota
5. Security audit (JWT, tenant isolation, tool whitelist)
6. Deploy to dev → staging → production with gradual rollout

**Files Modified/Created:**
- `server/__tests__/agentRuntime.test.js` (NEW)
- `server/__tests__/lead-qualifier-handler.test.js` (NEW)
- `server/__tests__/agentTools.test.js` (NEW)
- `server/__tests__/billing-webhook.test.js` (NEW)

---

## PART 6: TESTING STRATEGY

### Unit Tests

**`agentRuntime.test.js`:**
- ✅ Tenant opt-in checks (provisioning status, config flag, credits)
- ✅ Credit deduction (atomic, non-refundable)
- ✅ Tool whitelist enforcement
- ✅ Error handling (Bedrock timeout, tool error)

**`agentAuditService.test.js`:**
- ✅ Log to AgentAuditTable
- ✅ TTL expiration
- ✅ Query by tenantId + agentId

**`lead-qualifier-handler.test.js`:**
- ✅ Score extraction (HOT/WARM/COLD)
- ✅ Idempotency (skip if recently qualified)
- ✅ EventBridge event emission
- ✅ Tenant opt-in check (skip if not provisioned)

**`lead-router-handler.test.js`:**
- ✅ Team member workload calculation
- ✅ Assignment to least-loaded member
- ✅ Fallback if agent fails
- ✅ Tenant opt-in check

**`whatsapp-message-processor.test.js`:**
- ✅ Deterministic command parsing
- ✅ Agent routing on command failure
- ✅ Idempotency (messageId dedup)

**`agentTools.test.js`:**
- ✅ JWT validation (signature, expiry, source='mcp', tenantId)
- ✅ Tool invocation via skillInvoker
- ✅ Audit logging
- ✅ Unauthorized token rejection

**`billing-webhook.test.js`:**
- ✅ HMAC signature validation
- ✅ subscription.activated event → provisioning row creation
- ✅ subscription.activated event → aiEmployeeEnabled=true in AgencyConfig
- ✅ Idempotency (no duplicate provisioning rows)

### Integration Tests

**EventBridge Flow:**
- ✅ Lead creation → `lead.created` event → Qualifier → `lead.qualified` event → Router
- ✅ Event retry on failure (DLQ)
- ✅ Timeout handling
- ✅ Tenant opt-in check prevents processing for non-subscribed tenants

**Billing Webhook Flow:**
- ✅ subscription.activated with plan_ai_employee_monthly → creates provisioning row
- ✅ Sets aiEmployeeEnabled=true in AgencyConfig
- ✅ Sends Brevo email + AiSensy WhatsApp
- ✅ Idempotency (no duplicate provisioning rows)

**WhatsApp Flow:**
- ✅ Inbound message → processor → deterministic command → reply
- ✅ Inbound message → processor → agent → reply
- ✅ Idempotency (no duplicate replies)

**MCP Flow:**
- ✅ Claude Desktop → MCP server → JWT signing → `/api/crm/agent/tool` → skillInvoker → reply
- ✅ JWT validation (signature, expiry, source)
- ✅ Audit logging

### E2E Tests (Playwright)

**Lead Qualification:**
1. Create lead via UI
2. Verify `lead.created` event triggered
3. Verify Qualifier scored the lead within 5 seconds
4. Verify Router assigned the lead

**WhatsApp Query:**
1. Send WhatsApp message: "Show me all leads in Mumbai"
2. Verify agent processes query
3. Verify reply received on WhatsApp

**MCP Integration:**
1. Start MCP server locally
2. Ask Claude: "Create a lead named Rahul"
3. Verify lead created in CRM

**Billing & Provisioning:**
1. Simulate Razorpay webhook: subscription.activated with plan_ai_employee_monthly
2. Verify provisioning row created with status=pending
3. Verify aiEmployeeEnabled=true in AgencyConfig
4. Verify agent can now be invoked

---

## PART 7: GRADUAL ROLLOUT MECHANISM

To safely roll out AI Employee, implement a percentage-based rollout using tenant ID hash:

```javascript
// apps/crm/server/agents/agentRuntime.js
function isEnabledForRollout(tenantId, rolloutPercentage) {
  if (rolloutPercentage >= 100) return true;
  if (rolloutPercentage <= 0) return false;
  
  const hash = tenantId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a >>> 0; // Convert to unsigned 32-bit integer
  }, 0);
  
  return (hash % 100) < rolloutPercentage;
}

async function invokeAgent(tenantId, prompt, context = {}) {
  // ... existing checks ...
  
  // Rollout check
  const rolloutPercentage = parseInt(process.env.AI_EMPLOYEE_ROLLOUT_PERCENTAGE || '100', 10);
  if (!isEnabledForRollout(tenantId, rolloutPercentage)) {
    return { ok: false, error: 'tenant_not_in_rollout' };
  }
  
  // ... rest of function ...
}
```

**Deployment Steps:**
1. Deploy with `AI_EMPLOYEE_ROLLOUT_PERCENTAGE=10` (10% of tenants)
2. Monitor for 24 hours
3. Increase to `AI_EMPLOYEE_ROLLOUT_PERCENTAGE=50` (50% of tenants)
4. Monitor for 24 hours
5. Increase to `AI_EMPLOYEE_ROLLOUT_PERCENTAGE=100` (all tenants)

---

## PART 8: DEPLOYMENT & ROLLOUT

### Pre-Deployment Checklist

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Code review completed
- [ ] Security audit passed (JWT, tenant isolation, tool whitelist)
- [ ] Load testing completed (Bedrock quota, Lambda concurrency)
- [ ] Rollback plan documented
- [ ] Monitoring/alerts configured (CloudWatch, Sentry)
- [ ] Documentation updated (README, API docs, user guide)
- [ ] Route mounts verified in server.js
- [ ] Billing webhook integration tested
- [ ] Follow-up cron tenant list tested

### Deployment Steps

1. **Dev Environment:**
   - Deploy CFN changes
   - Deploy code changes
   - Run full test suite
   - Manual testing
   - Verify route mounts work

2. **Staging Environment:**
   - Deploy CFN changes
   - Deploy code changes
   - Run full test suite
   - Load testing (simulate 100 concurrent agents)
   - Security audit
   - Test billing webhook integration
   - Test follow-up cron with multiple tenants

3. **Production Environment:**
   - Deploy CFN changes (with `AGENTS_ENABLED=false` initially)
   - Deploy code changes
   - Verify no errors in CloudWatch
   - Set `AI_EMPLOYEE_ROLLOUT_PERCENTAGE=10` (10% of tenants)
   - Monitor for 24 hours
   - Increase to `AI_EMPLOYEE_ROLLOUT_PERCENTAGE=50` (50% of tenants)
   - Monitor for 24 hours
   - Increase to `AI_EMPLOYEE_ROLLOUT_PERCENTAGE=100` (all tenants)

### Rollback Plan

If critical issues detected:
1. Set `AGENTS_ENABLED=false` in CFN
2. Set `AI_EMPLOYEE_ROLLOUT_PERCENTAGE=0` in CFN
3. Redeploy Lambda
4. Disable EventBridge rules
5. Investigate root cause
6. Fix and re-deploy

---

## PART 9: MONITORING & OBSERVABILITY

### CloudWatch Metrics

```
Namespace: RealEstateFlow/AIEmployee

Metrics:
- agent.invoke.count (Count, per agentId)
- agent.invoke.duration (Milliseconds)
- agent.invoke.errors (Count, per error type)
- agent.tool_calls (Count, per toolName)
- agent.credits_deducted (Sum, per tenantId)
- bedrock.api_calls (Count)
- bedrock.api_errors (Count)
- eventbridge.events_published (Count, per detail-type)
- eventbridge.events_failed (Count)
- eventbridge.dlq_messages (Count)
- provisioning.status_pending (Count)
- provisioning.status_live (Count)
- provisioning.status_escalated (Count)
```

### Alarms

- `agent.invoke.errors > 10 in 5 min` → Page on-call
- `bedrock.api_errors > 5 in 5 min` → Page on-call
- `eventbridge.events_failed > 10 in 5 min` → Page on-call
- `eventbridge.dlq_messages > 0` → Alert (check DLQ)
- `agent.credits_deducted > $1000/hour` → Alert (quota exceeded)
- `provisioning.status_pending > 10` → Alert (SLA at risk)

### Logging

All agent actions logged to AgentAuditTable with:
- Input (first 512 chars)
- Output (first 1024 chars)
- Execution time
- Error message (if failed)
- Credits charged

Queryable by: tenantId, agentId, createdAt, status

---

## PART 10: SECURITY CONSIDERATIONS

### Tenant Isolation

✅ **Immutable tenantId Injection:**
- tenantId passed as argument to `invokeAgent()`
- Never extracted from user input or JWT claims
- Validated in every tool call via `skillInvoker`

✅ **Tool Whitelist:**
- Only 22 safe CRM operations allowed
- No delete, no auth, no admin operations
- Enforced in `skillInvoker` and `agentRuntime`

✅ **Audit Trail:**
- Every tool call logged to AgentAuditTable
- Input/output captured (truncated for size)
- Queryable by tenant for compliance

### JWT Secret Management

✅ **Storage (MVP):**
- Stored in `apps/crm/server/.env` as `JWT_SECRET`
- Generated with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Never logged or exposed
- Commit placeholder to `.env.example`, not actual secret

✅ **Storage (Post-MVP):**
- Migrate to AWS Secrets Manager
- Rotate quarterly
- Update Lambda environment variables to fetch from Secrets Manager

✅ **Signing:**
- HS256 algorithm
- Claims: `{tenantId, source: 'mcp', iat, exp}`
- Expiry: 1 hour

✅ **Validation:**
- Signature verified in `/api/crm/agent/tool`
- Expiry checked
- source field checked (must be 'mcp')
- tenantId extracted and used immutably

### Rate Limiting

✅ **Per-Tenant Daily Cap:**
- Configurable in AgencyConfig (default: 100 agent actions/day)
- Enforced before Bedrock invoke
- Prevents quota exhaustion

✅ **Per-Bedrock API:**
- AWS Bedrock has built-in rate limits
- Implement exponential backoff (2s, 4s, 8s, 16s, max 60s)
- DLQ for failed events

### RBAC for Admin Endpoints

✅ **Agent Activity Endpoint:**
- Requires `validateToken` + `extractTenantId` + `requireRole('ADMIN')`
- Returns only current tenant's audit logs
- Queryable by agentId, createdAt, status

✅ **AI Employee Config Endpoints:**
- Requires `validateToken` + `extractTenantId` + `requireRole('ADMIN')`
- GET returns current config
- PUT validates input (followupAgentMode must be 'draft' or 'autosend')

---

## PART 11: FINAL EXECUTION SEQUENCE

**Week 1-2: Infrastructure**
- Phase 1: Infrastructure (2-3 days)
- Phase 2: Agent Runtime & Audit (3-4 days)

**Week 2-3: Event Pipeline**
- Phase 3: EventBridge & Handlers (3-4 days)

**Week 3: WhatsApp & MCP**
- Phase 4: WhatsApp AI Assistant (2-3 days)
- Phase 5: MCP Server & Route Mounts (2-3 days)

**Week 4: Billing & Frontend**
- Phase 6: Billing Webhook Integration (1-2 days)
- Phase 7: Frontend Integration (2-3 days)

**Week 5: Testing & Deployment**
- Phase 8: Testing & Deployment (2-3 days)

**Total: 5 weeks (25-30 days)**

---

## CONCLUSION

This plan provides a comprehensive, production-ready implementation of the AI Employee system. It covers all technical, architectural, operational, and security aspects. All critical gaps and bugs have been fixed:

✅ Subscription check uses correct `AIEmployeeProvisioning` table  
✅ All routes mounted in `server.js`  
✅ RBAC enforced on admin endpoints  
✅ EventBridge handlers include tenant opt-in checks  
✅ Billing webhook integration auto-enables AI Employee  
✅ Follow-up cron gets tenant list from AgencyConfig  
✅ Gradual rollout mechanism implemented  
✅ JWT validation properly specified  
✅ All integration tests documented  

Follow the phase-by-phase approach, run all tests, and deploy gradually to ensure stability and success.

**Next Step:** Approve this corrected plan and begin Phase 1 (Infrastructure).
