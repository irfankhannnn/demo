# Phase 2C: Tool Enhancement
**Duration:** 1 week | **Focus:** Context passing, category-based filtering, access control

---

## High-Level Goal (Plain English)

**What we're doing:** We're making sure that when the AI uses its tools (like creating a lead, searching for properties, etc.), it has all the relevant information it needs. We're also adding security rules so that certain types of users (like spammers or blocked numbers) can't use certain tools.

**Why it matters:** Right now, when the AI uses a tool to create a lead, it doesn't know about the conversation that led to that decision. For example, if someone said "I want a 2BHK for 50 lakhs" in the chat, the AI should automatically include that information when creating the lead. Also, we need to prevent bad actors (spammers, blocked users) from using the AI to create fake leads or spam the system.

**In simple terms:** Think of this like giving the AI a "cheat sheet" before it does any action - it gets to see the conversation history, what it knows about the person, and what it's trying to accomplish. We're also adding bouncer-like rules that say "if this person is a spammer, don't let them create leads" or "if this person is blocked, don't let them do anything at all."

---

## Overview

Phase 2C enhances the tool system to pass rich context to tools, implement category-based access control, and enforce proper security boundaries.

### Success Criteria
- ✅ Tools receive rich context
- ✅ Tool filtering by user category working
- ✅ Access control enforced
- ✅ Tested with all categories

---

## Task 2C.1: Enhance Tool Context
**Effort:** 3-4 days | **Priority:** HIGH

### Subtask 2C.1.1: Modify invokeSkill to Enrich Context
**File:** `agency-app/api/skillInvoker.js`

**Changes:**
```javascript
import { getConversationState } from './conversationStateService.js';
import { enrichContextWithLead } from './skillInvoker.js';
import { getUserCategory } from './userCategoryService.js';
import { getAgencyConfig } from './agencyConfigService.js';

async function invokeSkill(tenantId, toolName, rawInput, context = {}) {
  // Enrich context with conversation/lead data
  const enrichedContext = {
    ...context,
    conversationState: context.contactPhone
      ? await getConversationState(tenantId, context.contactPhone)
      : null,
    leadContext: context.leadId
      ? await enrichContextWithLead(tenantId, context.leadId)
      : null,
    userCategory: context.contactPhone
      ? await getUserCategory(tenantId, context.contactPhone)
      : 'unknown',
    agencyConfig: await getAgencyConfig(tenantId)
  };

  // Pass enriched context to tool handlers
  return executeToolWithContext(tenantId, toolName, rawInput, enrichedContext);
}
```

**Validation:**
- [ ] All context sources loaded
- [ ] Graceful handling of missing data
- [ ] Context merged correctly
- [ ] No performance degradation
- [ ] Error handling in place

---

### Subtask 2C.1.2: Implement executeToolWithContext
**File:** `agency-app/api/skillInvoker.js`

**Changes:**
```javascript
async function executeToolWithContext(tenantId, toolName, rawInput, enrichedContext) {
  const tool = TOOL_DEFINITIONS[toolName];
  if (!tool) {
    return { ok: false, error: 'tool_not_found', message: `Tool ${toolName} not found` };
  }

  // Validate input
  const validationResult = validateToolInput(toolName, rawInput);
  if (!validationResult.ok) {
    return validationResult;
  }

  // Execute tool with context
  try {
    const result = await TOOL_HANDLERS[toolName](tenantId, rawInput, enrichedContext);
    return { ok: true, data: result };
  } catch (error) {
    logger.error(`Tool execution failed for ${toolName}:`, error);
    return { ok: false, error: 'tool_execution_failed', message: error.message };
  }
}
```

**Validation:**
- [ ] Tool validation before execution
- [ ] Context passed to handlers
- [ ] Error handling with logging
- [ ] Consistent response format
- [ ] Tool not found handled

---

### Subtask 2C.1.3: Update Tool Handlers to Use Context
**File:** `agency-app/api/skillInvoker.js`

**Changes for create_lead:**
```javascript
async function handleCreateLead(tenantId, input, context) {
  const leadData = {
    ...input,
    source: context.leadContext?.source || 'manual',
    notes: input.notes || []
  };

  // Add conversation context to notes if available
  if (context.conversationState?.extractedInfo) {
    leadData.notes.push(
      `Conversation context: ${JSON.stringify(context.conversationState.extractedInfo)}`
    );
  }

  return await createLead(tenantId, leadData);
}
```

**Changes for convert_lead:**
```javascript
async function handleConvertLead(tenantId, input, context) {
  // Use conversation state to populate transaction details
  const transactionDetails = {
    ...input,
    budget: context.conversationState?.extractedInfo?.budget || input.budget,
    timeline: context.conversationState?.extractedInfo?.timeline || input.timeline,
    propertyType: context.conversationState?.extractedInfo?.propertyType || input.propertyType
  };

  return await convertLead(tenantId, input.leadId, transactionDetails);
}
```

**Changes for search_leads:**
```javascript
async function handleSearchLeads(tenantId, input, context) {
  // Filter by user category if specified
  const filters = {
    ...input,
    category: context.userCategory !== 'unknown' ? context.userCategory : input.category
  };

  return await searchLeads(tenantId, filters);
}
```

**Changes for update_lead:**
```javascript
async function handleUpdateLead(tenantId, input, context) {
  // Preserve conversation history in notes
  const existingLead = await getLeadById(tenantId, input.leadId);
  const updates = {
    ...input,
    notes: [
      ...(existingLead?.notes || []),
      ...(input.notes || []),
      `Updated via conversation: ${context.conversationState?.conversationId || 'N/A'}`
    ]
  };

  return await updateLead(tenantId, input.leadId, updates);
}
```

**Validation:**
- [ ] create_lead uses conversation context
- [ ] convert_lead uses extracted info
- [ ] search_leads filters by category
- [ ] update_lead preserves history
- [ ] All tools tested with context

---

### Subtask 2C.1.4: Test Tool Context Enhancement
**File:** `tests/playwright/api/tool-context.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('Tool Context Enhancement', () => {
  test('should pass conversation state to create_lead', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Create conversation state
    await request.post(`${API_URL}/api/crm/conversation-state/${testPhone}`, {
      data: {
        goal: 'qualify_lead',
        extractedInfo: { budget: '50L', timeline: '2 months' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Invoke agent to create lead
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Create a lead for this conversation',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    // Verify lead created with conversation context
  });

  test('should use extracted info in convert_lead', async ({ request }) => {
    // Create a lead first
    const leadResponse = await request.post(`${API_URL}/api/crm/leads`, {
      data: {
        name: 'John Doe',
        phone: '9876543210',
        leadType: 'buyer',
        source: 'whatsapp'
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    const lead = await leadResponse.json();

    // Create conversation state with extracted info
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;
    await request.post(`${API_URL}/api/crm/conversation-state/${testPhone}`, {
      data: {
        goal: 'convert_lead',
        extractedInfo: { budget: '50L', propertyType: '2BHK' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Convert lead
    const convertResponse = await request.post(`${API_URL}/api/crm/leads/${lead.data.leadId}/convert`, {
      data: {
        leadId: lead.data.leadId,
        contactPhone: testPhone
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(convertResponse.status()).toBe(200);
    // Verify transaction details populated from conversation state
  });
});
```

**Validation:**
- [ ] Context passed to tools
- [ ] Conversation state used in create_lead
- [ ] Extracted info used in convert_lead
- [ ] Category filtering works in search_leads
- [ ] History preserved in update_lead

---

## Task 2C.2: Implement Tool Filtering by User Category
**Effort:** 2-3 days | **Priority:** HIGH

### Subtask 2C.2.1: Define Tool Category Permissions
**File:** `agency-app/api/skillInvoker.js`

**Changes:**
```javascript
const TOOL_CATEGORY_PERMISSIONS = {
  lead: {
    allowed: ['create_lead', 'get_lead', 'search_leads', 'update_lead', 'create_lead_note'],
    denied: ['convert_lead', 'create_contact']
  },
  customer: {
    allowed: ['get_lead', 'search_leads', 'update_lead', 'convert_lead', 'create_contact'],
    denied: []
  },
  spam: {
    allowed: [],
    denied: ['create_lead', 'convert_lead', 'create_contact']
  },
  blocked: {
    allowed: [],
    denied: ['all']
  },
  unknown: {
    allowed: ['get_lead', 'search_leads'],  // Read-only for unknown
    denied: ['create_lead', 'convert_lead', 'create_contact', 'update_lead']
  }
};
```

**Validation:**
- [ ] All categories defined
- [ ] Allowed/denied lists accurate
- [ ] 'unknown' has read-only access
- [ ] 'blocked' denies all tools
- [ ] 'spam' denies write operations

---

### Subtask 2C.2.2: Add Permission Check to invokeSkill
**File:** `agency-app/api/skillInvoker.js`

**Changes:**
```javascript
async function invokeSkill(tenantId, toolName, rawInput, context = {}) {
  // Check user category permissions
  const userCategory = context.userCategory || 'unknown';
  const permissions = TOOL_CATEGORY_PERMISSIONS[userCategory] || TOOL_CATEGORY_PERMISSIONS.unknown;

  // Check if tool is denied
  if (permissions.denied.includes('all') || permissions.denied.includes(toolName)) {
    logger.warn(`Tool ${toolName} denied for category ${userCategory}`);
    return {
      ok: false,
      error: 'access_denied',
      message: `Tool ${toolName} not allowed for category ${userCategory}`
    };
  }

  // Check if tool is allowed
  if (permissions.allowed.length > 0 && !permissions.allowed.includes(toolName)) {
    logger.warn(`Tool ${toolName} not in allowed list for category ${userCategory}`);
    return {
      ok: false,
      error: 'access_denied',
      message: `Tool ${toolName} not allowed for category ${userCategory}`
    };
  }

  // Continue with tool execution
  return executeToolWithContext(tenantId, toolName, rawInput, context);
}
```

**Validation:**
- [ ] Permission check before execution
- [ ] Denied tools return error
- [ ] Allowed tools execute
- [ ] Logging for security audit
- [ ] Clear error messages

---

### Subtask 2C.2.3: Test Category-Based Tool Filtering
**File:** `tests/playwright/api/tool-filtering.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('Tool Filtering by User Category', () => {
  test('should allow create_lead for lead category', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Set user category to 'lead'
    await request.post(`${API_URL}/api/crm/user-categories/${testPhone}`, {
      data: { category: 'lead' },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Try to create lead
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Create a lead for John Doe',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    // Should succeed
  });

  test('should deny create_lead for spam category', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Set user category to 'spam'
    await request.post(`${API_URL}/api/crm/user-categories/${testPhone}`, {
      data: { category: 'spam' },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Try to create lead
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Create a lead for John Doe',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(403);
    // Should be denied
  });

  test('should deny all tools for blocked category', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Set user category to 'blocked'
    await request.post(`${API_URL}/api/crm/user-categories/${testPhone}`, {
      data: { category: 'blocked' },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Try to search leads (read operation)
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Search for leads',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(403);
    // Should be denied
  });

  test('should allow read-only for unknown category', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Set user category to 'unknown' (default)
    await request.post(`${API_URL}/api/crm/user-categories/${testPhone}`, {
      data: { category: 'unknown' },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Try to search leads (read operation)
    const searchResponse = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Search for leads',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(searchResponse.status()).toBe(200);
    // Should succeed (read-only)

    // Try to create lead (write operation)
    const createResponse = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Create a lead',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(createResponse.status()).toBe(403);
    // Should be denied
  });
});
```

**Validation:**
- [ ] Lead category can create leads
- [ ] Spam category cannot create leads
- [ ] Blocked category denied all tools
- [ ] Unknown category has read-only access
- [ ] Customer category can convert leads
- [ ] All categories tested

---

## Task 2C.3: Implement Access Control Enforcement
**Effort:** 2-3 days | **Priority:** HIGH

### Subtask 2C.3.1: Add Rate Limiting per Category
**File:** `agency-app/api/middleware/rateLimiter.js`

**Changes:**
```javascript
const CATEGORY_RATE_LIMITS = {
  lead: { max: 100, windowMs: 60000 },      // 100/min for leads
  customer: { max: 200, windowMs: 60000 },  // 200/min for customers
  spam: { max: 10, windowMs: 60000 },       // 10/min for spam
  blocked: { max: 0, windowMs: 60000 },     // 0/min for blocked
  unknown: { max: 50, windowMs: 60000 }     // 50/min for unknown
};

function createCategoryRateLimiter(category) {
  const limits = CATEGORY_RATE_LIMITS[category] || CATEGORY_RATE_LIMITS.unknown;
  return rateLimit({
    windowMs: limits.windowMs,
    max: limits.max,
    message: `Rate limit exceeded for category ${category}`
  });
}
```

**Validation:**
- [ ] Rate limits defined per category
- [ ] Spam has strict limits
- [ ] Blocked has zero limit
- [ ] Customers have higher limits
- [ ] Fallback to unknown limits

---

### Subtask 2C.3.2: Add Audit Logging for Access Denials
**File:** `agency-app/api/agents/agentAuditService.js`

**Changes:**
```javascript
async function logAccessDenial(tenantId, toolName, userCategory, reason) {
  const item = {
    PK: tenantId,
    SK: `DENIAL#${Date.now()}#${Math.random().toString(36).substr(2, 9)}`,
    action: 'access_denial',
    toolName,
    userCategory,
    reason,
    timestamp: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)  // 90 days TTL
  };

  try {
    await dynamodb.put({ TableName: AGENT_AUDIT_TABLE_NAME, Item: item });
  } catch (error) {
    logger.error('Failed to log access denial:', error);
  }
}
```

**Integration into invokeSkill:**
```javascript
if (permissions.denied.includes('all') || permissions.denied.includes(toolName)) {
  await logAccessDenial(tenantId, toolName, userCategory, 'tool_denied_by_category');
  return {
    ok: false,
    error: 'access_denied',
    message: `Tool ${toolName} not allowed for category ${userCategory}`
  };
}
```

**Validation:**
- [ ] Access denials logged
- [ ] Category recorded
- [ ] Tool name recorded
- [ ] Reason recorded
- [ ] TTL set to 90 days

---

### Subtask 2C.3.3: Test Access Control Enforcement
**File:** `tests/playwright/api/access-control.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('Access Control Enforcement', () => {
  test('should enforce rate limits per category', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Set category to spam (strict rate limit)
    await request.post(`${API_URL}/api/crm/user-categories/${testPhone}`, {
      data: { category: 'spam' },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Make 11 requests (exceeds limit of 10)
    const requests = [];
    for (let i = 0; i < 11; i++) {
      requests.push(
        request.post(`${API_URL}/api/crm/agent/invoke`, {
          data: { agentId: 'whatsapp', prompt: 'Test', context: { contactPhone: testPhone } },
          headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
        })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status() === 429);

    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });

  test('should log access denials', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Set category to blocked
    await request.post(`${API_URL}/api/crm/user-categories/${testPhone}`, {
      data: { category: 'blocked' },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Try to use tool
    await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: { agentId: 'whatsapp', prompt: 'Test', context: { contactPhone: testPhone } },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Check audit log
    const auditResponse = await request.get(`${API_URL}/api/crm/agents/activity`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(auditResponse.status()).toBe(200);
    const audit = await auditResponse.json();
    const denialLog = audit.activities.find(a => a.action === 'access_denial');
    expect(denialLog).toBeTruthy();
  });
});
```

**Validation:**
- [ ] Rate limits enforced per category
- [ ] Spam category has strict limits
- [ ] Access denials logged
- [ ] Audit trail complete
- [ ] Blocked category denied immediately

---

## Phase 2C Completion Checklist

### Tool Context Enhancement
- [ ] invokeSkill enriched with context
- [ ] executeToolWithContext implemented
- [ ] create_lead uses conversation context
- [ ] convert_lead uses extracted info
- [ ] search_leads filters by category
- [ ] update_lead preserves history
- [ ] All tools tested with context

### Category-Based Filtering
- [ ] TOOL_CATEGORY_PERMISSIONS defined
- [ ] Permission check added to invokeSkill
- [ ] Denied tools return error
- [ ] Allowed tools execute
- [ ] Security logging in place
- [ ] All categories tested

### Access Control
- [ ] Rate limits per category
- [ ] Blocked category zero limit
- [ ] Spam category strict limit
- [ ] Access denials logged
- [ ] Audit trail complete
- [ ] All access controls tested

### Integration
- [ ] Context passing works end-to-end
- [ ] Filtering doesn't break existing tools
- [ ] Performance acceptable
- [ ] No regressions in existing tests

### Documentation
- [ ] Tool context documented
- [ ] Category permissions documented
- [ ] Rate limits documented
- [ ] API documentation updated

---

## Next Steps

After completing Phase 2C:
1. Update `progress-tracker.md` with completed tasks
2. Move to `phase-2d-testing.md`
3. Ensure all Phase 2C tests pass before proceeding

---

**Phase Status:** 📋 Planned
**Last Updated:** June 2026
