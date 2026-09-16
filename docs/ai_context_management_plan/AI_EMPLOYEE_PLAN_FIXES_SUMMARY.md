# AI Employee Plan — Fixes Summary (v1.0 → v2.1)

**Date:** 2026-06-21  
**Status:** All Issues Fixed  
**Total Fixes:** 21 issues (15 in v2.0 + 6 in v2.1)

---

## Issues Found & Fixed

### CRITICAL BUGS (5)

#### 1. ❌ Incorrect Subscription Check Logic
**Issue:** Plan assumed subscription has `addOns` field containing `plan_ai_employee_monthly`  
**Reality:** Subscriptions use separate `AIEmployeeProvisioning` table with status `pending` → `live`  
**Impact:** Agent invocation would always fail even for paid tenants  
**Fix:** Changed to check `AIEmployeeProvisioning.status === 'live'`

**Before:**
```javascript
const hasAIEmployeeSubscription = subscription?.addOns?.includes('plan_ai_employee_monthly');
```

**After:**
```javascript
const provisioning = await getProvisioningByTenant(tenantId);
if (!provisioning || provisioning.status !== 'live') {
  return { ok: false, error: 'ai_employee_not_provisioned' };
}
```

---

#### 2. ❌ Missing Route Mounts for Agent Tool Endpoint
**Issue:** Phase 5 created `/api/crm/agent/tool` endpoint but never mounted it in `server.js`  
**Impact:** MCP server would get 404 errors  
**Fix:** Added explicit route mount instructions in Phase 5

**Added to Phase 5:**
```javascript
// In apps/crm/server/server.js:
import agentToolsRoutes from './routes/agentTools.js';
app.use('/api/crm/agent/tool', agentToolsRoutes);
```

---

#### 3. ❌ Missing Route Mount for Admin Endpoints
**Issue:** Phase 7 mentioned adding `/api/admin/agent-activity` but didn't specify mounting  
**Impact:** Endpoints would be inaccessible  
**Fix:** Added explicit verification that `adminRoutes` is mounted

**Added to Phase 5:**
```javascript
// Verify in server.js:
app.use('/api/admin', adminRoutes);
```

---

#### 4. ❌ Missing RBAC for Agent Activity Endpoint
**Issue:** No role-based access control specified for sensitive audit logs  
**Impact:** Non-admin users could access other tenants' agent audit logs  
**Fix:** Added `requireRole('ADMIN')` to all admin endpoints

**Added to Phase 7:**
```javascript
router.get('/agent-activity', validateToken, extractTenantId, requireRole('ADMIN'), async (req, res) => {
  // ... implementation
});
```

---

#### 5. ❌ EventBridge Rules Enabled Globally Without Tenant Filter
**Issue:** Plan changed rules from `DISABLED` → `ENABLED` globally, triggering handlers for ALL tenants  
**Impact:** Non-subscribed tenants would have leads processed and credits deducted  
**Fix:** Keep rules `ENABLED` but add tenant opt-in check as FIRST step in each handler

**Added to Phase 3:**
```javascript
export async function handler(event) {
  const { tenantId } = detail;
  
  // Check tenant opt-in FIRST
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

---

### SIGNIFICANT GAPS (5)

#### 6. ❌ Missing Billing Webhook Integration
**Issue:** Plan didn't specify how billing webhook auto-enables AI Employee  
**Impact:** Tenants who pay wouldn't have `aiEmployeeEnabled` set automatically  
**Fix:** Added Phase 6 (Billing Webhook Integration) with explicit implementation

**Added to Phase 6:**
```javascript
// In apps/crm/server/routes/billing.js webhook handler:
if (event.event === 'subscription.activated' && event.payload.plan_id === 'plan_ai_employee_monthly') {
  await createProvisioningRow({ ... }); // Already exists
  await updateAgencyConfig(tenantId, { aiEmployeeEnabled: true }); // NEW
}
```

---

#### 7. ❌ Missing UI for Follow-up Agent Configuration
**Issue:** Plan mentioned `followupAgentMode` config but no UI to change it  
**Impact:** Admins couldn't switch between draft/autosend modes  
**Fix:** Added `/api/admin/ai-employee/config` GET/PUT endpoints

**Added to Phase 7:**
```javascript
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
  await updateAgencyConfig(req.tenantId, { followupAgentMode, followupAgentAutoSendChannels });
  res.json({ ok: true });
});
```

---

#### 8. ❌ Missing Gradual Rollout Mechanism
**Issue:** Plan said "enable for 10% of tenants" but didn't specify HOW  
**Impact:** Cannot safely roll out feature  
**Fix:** Added percentage-based rollout using tenant ID hash

**Added to Part 7:**
```javascript
function isEnabledForRollout(tenantId, rolloutPercentage) {
  if (rolloutPercentage >= 100) return true;
  if (rolloutPercentage <= 0) return false;
  
  const hash = parseInt(tenantId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0), 10);
  
  return (Math.abs(hash) % 100) < rolloutPercentage;
}

// In agentRuntime.js:
const rolloutPercentage = parseInt(process.env.AI_EMPLOYEE_ROLLOUT_PERCENTAGE || '100', 10);
if (!isEnabledForRollout(tenantId, rolloutPercentage)) {
  return { ok: false, error: 'tenant_not_in_rollout' };
}
```

---

#### 9. ❌ Missing Tenant List for Follow-up Cron
**Issue:** Follow-up cron needs to iterate all tenants but no mechanism specified  
**Impact:** Follow-up cron cannot function  
**Fix:** Added implementation to scan `AgencyConfig` for enabled tenants

**Added to Phase 3:**
```javascript
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

#### 10. ❌ Missing JWT Validation Middleware Specification
**Issue:** Plan mentioned JWT validation but didn't specify implementation details  
**Impact:** Security vulnerability if not properly validated  
**Fix:** Added complete JWT validation middleware code

**Added to Phase 5:**
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
```

---

### MINOR IMPROVEMENTS (5)

#### 11. ✅ Added Billing Webhook Integration Tests
**Added to Part 6 (Testing Strategy):**
```
**`billing-webhook.test.js`:**
- ✅ HMAC signature validation
- ✅ subscription.activated event → provisioning row creation
- ✅ subscription.activated event → aiEmployeeEnabled=true in AgencyConfig
- ✅ Idempotency (no duplicate provisioning rows)
```

---

#### 12. ✅ Added Provisioning Status Metrics
**Added to Part 9 (Monitoring):**
```
- provisioning.status_pending (Count)
- provisioning.status_live (Count)
- provisioning.status_escalated (Count)
```

---

#### 13. ✅ Added DLQ Metrics for EventBridge
**Added to Part 9 (Monitoring):**
```
- eventbridge.dlq_messages (Count)
```

---

#### 14. ✅ Added Rollback Procedure for Gradual Rollout
**Added to Part 8 (Deployment):**
```
If critical issues detected:
1. Set AGENTS_ENABLED=false in CFN
2. Set AI_EMPLOYEE_ROLLOUT_PERCENTAGE=0 in CFN
3. Redeploy Lambda
4. Disable EventBridge rules
5. Investigate root cause
6. Fix and re-deploy
```

---

#### 15. ✅ Restructured Phases for Better Sequencing
**Changes:**
- Phase 5: Now includes route mounts (critical dependency)
- Phase 6: NEW - Billing Webhook Integration (must happen before frontend)
- Phase 7: Frontend Integration (now depends on Phase 6)
- Phase 8: Testing & Deployment (now includes gradual rollout)
- Total timeline: 4 weeks → 5 weeks (more realistic)

---

## ADDITIONAL FIXES (v2.1)

### Critical Bugs (2)

#### 16. ❌ Missing Function: scanAgencyConfigs
**Issue:** Plan used `scanAgencyConfigs({ aiEmployeeEnabled: true })` but function doesn't exist in agencyConfigService.js  
**Impact:** Follow-up cron would fail at runtime  
**Fix:** Added function implementation with ScanCommand

#### 17. ❌ Redundant Bitwise Operation in Rollout Hash
**Issue:** `return a & a` does nothing; doesn't constrain to 32-bit integer  
**Impact:** Inconsistent rollout behavior across environments  
**Fix:** Changed to `return a >>> 0` for proper 32-bit unsigned integer

### High Issues (3)

#### 18. ❌ Missing EventBridge Detail Parsing
**Issue:** Handlers assumed `detail` is object, but it might be JSON string  
**Impact:** Runtime error when detail is string  
**Fix:** Added `typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail`

#### 19. ❌ Route Mount Path Duplication
**Issue:** `/api/crm/agent/tool` + router path would create double path  
**Impact:** Endpoint at wrong URL (/api/crm/agent/tool/agent/tool)  
**Fix:** Changed mount to `/api/crm` with route defined as `/agent/tool`

#### 20. ❌ Missing Channel Validation
**Issue:** No validation for `followupAgentAutoSendChannels` array values  
**Impact:** Invalid channels could cause runtime errors  
**Fix:** Added validation against `['whatsapp', 'email']`

### Low Issues (1)

#### 21. ⚠️ JWT_SECRET Storage Inconsistency
**Issue:** Plan said "AWS Secrets Manager" but current implementation uses .env  
**Impact:** Confusion about where to store secret  
**Fix:** Clarified MVP uses .env, post-MVP migrates to Secrets Manager

---

## Summary of Changes

| Category | Count | Status |
|----------|-------|--------|
| Critical Bugs Fixed (v2.0) | 5 | ✅ |
| Significant Gaps Filled (v2.0) | 5 | ✅ |
| Minor Improvements (v2.0) | 5 | ✅ |
| Additional Fixes (v2.1) | 6 | ✅ |
| **Total Issues Fixed** | **21** | **✅** |

---

## Verification Checklist

- ✅ Subscription check uses correct `AIEmployeeProvisioning` table
- ✅ All routes mounted in `server.js`
- ✅ RBAC enforced on admin endpoints
- ✅ EventBridge handlers include tenant opt-in checks
- ✅ Billing webhook integration auto-enables AI Employee
- ✅ Follow-up cron gets tenant list from AgencyConfig
- ✅ scanAgencyConfigs function added to agencyConfigService.js
- ✅ Follow-up mode configuration UI implemented
- ✅ Gradual rollout mechanism implemented with correct hash function
- ✅ JWT validation properly specified
- ✅ EventBridge detail parsing added to all handlers
- ✅ Route mount paths corrected
- ✅ Channel validation added to config endpoint
- ✅ JWT_SECRET storage clarified (.env for MVP, Secrets Manager post-MVP)
- ✅ All integration tests documented
- ✅ Monitoring metrics complete
- ✅ Rollback procedures documented
- ✅ Phase sequencing corrected
- ✅ Timeline updated (5 weeks)

---

## Document Status

**v1.0:** Initial plan (15 issues identified)  
**v2.0:** All issues fixed (ready for implementation)  
**v2.1:** Additional 6 issues fixed (FINAL - production-ready)

**File:** `D:\reality_flow_crm\nabi-app-git-bkp\AI_EMPLOYEE_COMPREHENSIVE_PLAN.md`

---

## Next Steps

1. ✅ Review corrected plan
2. ✅ Approve plan
3. → Begin Phase 1 (Infrastructure)
