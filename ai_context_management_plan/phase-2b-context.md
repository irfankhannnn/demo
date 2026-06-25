# Phase 2B: Context Management
**Duration:** 1-2 weeks | **Focus:** Conversation history, lead context, state management

---

## High-Level Goal (Plain English)

**What we're doing:** We're giving the AI a "memory" so it can remember what was said in previous messages and know details about the person it's talking to. We're also adding a way for the AI to track the progress of a conversation (like "we're trying to find out their budget" and "we're 50% done with that goal").

**Why it matters:** Right now, every time someone sends a message, the AI treats it like a completely new conversation. If someone says "my budget is 50 lakhs" and then asks a follow-up question, the AI won't remember the budget and might ask again. This is frustrating for users. We need to fix this so the AI can maintain context across multiple messages, remember details about the lead (their name, what they're looking for, etc.), and track what it's trying to accomplish in the conversation.

**In simple terms:** Think of this like giving the AI a notepad where it writes down what happened in previous messages, keeps track of what it knows about the person, and notes down what it's currently trying to achieve in the conversation. This way, it doesn't have to ask the same questions repeatedly and can have a more natural, continuous conversation.

---

## Overview

Phase 2B implements the core context management system, enabling the AI to maintain conversation history, access lead/contact information, and track multi-turn conversation state.

### Success Criteria
- ✅ Conversation history loaded in agent prompts
- ✅ Lead/contact context included
- ✅ Conversation state table working
- ✅ Multi-turn conversations functional

---

## Task 2B.1: Implement Conversation Context Loading
**Effort:** 3-4 days | **Priority:** CRITICAL

### Subtask 2B.1.1: Add getConversationContext Function
**File:** `server/whatsappConversationService.js`

**Changes:**
```javascript
async function getConversationContext(tenantId, contactPhone, limit = 10) {
  // Validate and normalize phone number
  const normalizedPhone = contactPhone.replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(normalizedPhone)) {
    throw new Error('Invalid phone number format');
  }

  const params = {
    TableName: CRM_DYNAMODB_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#WHATSAPP#${normalizedPhone}`,
      ':sk': 'MESSAGE#'
    },
    ScanIndexForward: false,  // Newest first
    Limit: limit
  };

  try {
    const result = await dynamodb.query(params);

    // Format for LLM (oldest first)
    return result.Items
      .reverse()
      .map(msg => ({
        role: msg.fromMe ? 'assistant' : 'user',
        content: msg.text,
        timestamp: msg.createdAt
      }));
  } catch (error) {
    logger.error('Failed to load conversation context:', error);
    throw error;
  }
}
```

**Validation:**
- [ ] Phone number validation added
- [ ] Normalization removes non-digits
- [ ] Error handling with logging
- [ ] Returns empty array if no messages
- [ ] Messages ordered oldest to newest

---

### Subtask 2B.1.2: Integrate Context Loading into Agent Runtime
**File:** `server/agents/agentRuntime.js`

**Changes:**
```javascript
// Around line 210 (before building system prompt)
const conversationHistory = await getConversationContext(
  tenantId,
  context.contactPhone,
  5  // Last 5 messages
);

// Format conversation history for prompt
const contextPrompt = conversationHistory
  .map(msg => `${msg.role}: ${msg.content}`)
  .join('\n');

// Append to system prompt
const systemPrompt = await buildSystemPrompt(agentId, tenantId, personality);
const finalPrompt = systemPrompt + `\n\nRecent conversation:\n${contextPrompt}`;
```

**Validation:**
- [ ] Conversation history loaded
- [ ] Limited to last 5 messages
- [ ] Formatted correctly for LLM
- [ ] Appended to system prompt
- [ ] Works when no history exists

---

### Subtask 2B.1.3: Add Caching for Conversation History
**File:** `server/whatsappConversationService.js`

**Changes:**
```javascript
const conversationCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

async function getConversationContext(tenantId, contactPhone, limit = 10) {
  const cacheKey = `${tenantId}:${contactPhone}`;
  const cached = conversationCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // ... existing logic ...

  // Cache the result
  conversationCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });

  return result;
}

// Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of conversationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      conversationCache.delete(key);
    }
  }
}, 60000); // Clean up every minute
```

**Validation:**
- [ ] Cache implemented with TTL
- [ ] Cache key includes tenant and phone
- [ ] Periodic cleanup prevents memory leaks
- [ ] Cache hit reduces DynamoDB calls
- [ ] Cache miss loads fresh data

---

### Subtask 2B.1.4: Test Conversation Context Loading
**File:** `tests/playwright/api/conversation-context.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('Conversation Context Loading', () => {
  test('should load conversation history', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Send multiple messages
    for (let i = 0; i < 3; i++) {
      await request.post(
        `${API_URL}/api/whatsapp/conversations/${testPhone}/messages`,
        {
          data: { text: `Message ${i + 1}` },
          headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
        }
      );
    }

    // Invoke agent - should have access to conversation history
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'What was discussed in our previous messages?',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    // Agent should reference previous messages
  });

  test('should handle empty conversation history', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Hello',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    // Should work without conversation history
  });

  test('should validate phone number format', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Hello',
        context: { contactPhone: 'invalid-phone' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(400);
    // Should return validation error
  });
});
```

**Validation:**
- [ ] Conversation history loads correctly
- [ ] Empty history handled gracefully
- [ ] Phone validation works
- [ ] Invalid phone numbers rejected

---

## Task 2B.2: Implement Lead/Contact Context Enrichment
**Effort:** 2-3 days | **Priority:** HIGH

### Subtask 2B.2.1: Add enrichContextWithLead Function
**File:** `server/skillInvoker.js`

**Changes:**
```javascript
async function enrichContextWithLead(tenantId, leadId) {
  if (!leadId) return {};

  try {
    const lead = await getLeadById(tenantId, leadId);
    if (!lead) return {};

    return {
      leadId,
      leadName: lead.name,
      leadPhone: lead.phone,
      leadEmail: lead.email,
      leadType: lead.leadType,
      leadScore: lead.score,
      leadSource: lead.source,
      lastInteraction: lead.lastInteractionAt,
      notes: lead.notes?.slice(0, 3) || []  // Last 3 notes
    };
  } catch (error) {
    logger.error('Failed to enrich context with lead:', error);
    return {};
  }
}
```

**Validation:**
- [ ] Function handles missing leadId
- [ ] Returns empty object if lead not found
- [ ] Error handling with logging
- [ ] Returns only last 3 notes
- [ ] All relevant lead fields included

---

### Subtask 2B.2.2: Integrate Lead Context into Agent Runtime
**File:** `server/agents/agentRuntime.js`

**Changes:**
```javascript
// Around line 210 (after loading conversation history)
const leadContext = await enrichContextWithLead(tenantId, context.leadId);

// Format lead context for prompt
let leadContextPrompt = '';
if (leadContext.leadName) {
  leadContextPrompt = `
Lead Information:
- Name: ${leadContext.leadName}
- Phone: ${leadContext.leadPhone}
- Type: ${leadContext.leadType}
- Score: ${leadContext.leadScore}
- Source: ${leadContext.leadSource}
- Last Interaction: ${leadContext.lastInteraction}
${leadContext.notes.length > 0 ? `- Recent Notes: ${leadContext.notes.join('; ')}` : ''}
`;
}

// Append to system prompt
const finalPrompt = systemPrompt + leadContextPrompt + contextPrompt;
```

**Validation:**
- [ ] Lead context loaded
- [ ] Formatted correctly for prompt
- [ ] Only included if lead exists
- [ ] Notes limited to last 3
- [ ] Works when no lead exists

---

### Subtask 2B.2.3: Test Lead Context Enrichment
**File:** `tests/playwright/api/lead-context.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('Lead Context Enrichment', () => {
  test('should include lead context in agent prompt', async ({ request }) => {
    // Create a lead
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

    // Invoke agent with lead context
    const agentResponse = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'What is this lead interested in?',
        context: { leadId: lead.data.leadId, contactPhone: '919876543210' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(agentResponse.status()).toBe(200);
    // Agent should use lead context
  });

  test('should handle missing lead gracefully', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Hello',
        context: { leadId: 'non-existent-lead' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    // Should work without lead context
  });
});
```

**Validation:**
- [ ] Lead context included when available
- [ ] Missing lead handled gracefully
- [ ] Agent uses lead information
- [ ] No errors when lead not found

---

## Task 2B.3: Implement Conversation State Table
**Effort:** 4-5 days | **Priority:** HIGH

### Subtask 2B.3.1: Add ConversationStateTable to CloudFormation
**File:** `server/infra/cfn-backend.yaml`

**Changes:**
```yaml
ConversationStateTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub '${EnvironmentName}-conversation-state'
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: PK
        AttributeType: S
      - AttributeName: SK
        AttributeType: S
    KeySchema:
      - AttributeName: PK
        KeyType: HASH
      - AttributeName: SK
        KeyType: RANGE
    TimeToLiveSpecification:
      AttributeName: expiresAt
      Enabled: true
```

**Validation:**
- [ ] Table name uses environment parameter
- [ ] PAY_PER_REQUEST billing mode
- [ ] TTL enabled on expiresAt
- [ ] No StreamSpecification (removed to avoid errors)
- [ ] CloudFormation validates successfully

---

### Subtask 2B.3.2: Create conversationStateService.js
**File:** `server/conversationStateService.js` (new file)

**Changes:**
```javascript
import { dynamodb } from './lib/dynamodb.js';
import { CONVERSATION_STATE_TABLE_NAME } from './config.js';

async function getConversationState(tenantId, contactPhone) {
  const normalizedPhone = contactPhone.replace(/\D/g, '');

  const params = {
    TableName: CONVERSATION_STATE_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#CONVERSATION#${normalizedPhone}`
    },
    ScanIndexForward: false,
    Limit: 1
  };

  try {
    const result = await dynamodb.query(params);
    return result.Items[0] || null;
  } catch (error) {
    logger.error('Failed to get conversation state:', error);
    return null;
  }
}

async function createConversationState(tenantId, contactPhone, goal) {
  const normalizedPhone = contactPhone.replace(/\D/g, '');
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const item = {
    PK: `TENANT#${tenantId}#CONVERSATION#${normalizedPhone}`,
    SK: `STATE#${conversationId}`,
    conversationId,
    tenantId,
    contactPhone: normalizedPhone,
    state: 'active',
    goal,
    goalProgress: 0,
    extractedInfo: {},
    messageCount: 0,
    startedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)  // 7 days TTL
  };

  try {
    await dynamodb.put({ TableName: CONVERSATION_STATE_TABLE_NAME, Item: item });
    return item;
  } catch (error) {
    logger.error('Failed to create conversation state:', error);
    throw error;
  }
}

async function updateConversationState(tenantId, contactPhone, updates) {
  const normalizedPhone = contactPhone.replace(/\D/g, '');
  const existing = await getConversationState(tenantId, contactPhone);

  if (!existing) {
    // Create new state if doesn't exist
    return createConversationState(tenantId, contactPhone, updates.goal || 'general');
  }

  const item = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    messageCount: (existing.messageCount || 0) + 1
  };

  try {
    await dynamodb.put({ TableName: CONVERSATION_STATE_TABLE_NAME, Item: item });
    return item;
  } catch (error) {
    logger.error('Failed to update conversation state:', error);
    throw error;
  }
}

async function completeConversation(tenantId, contactPhone, outcome) {
  const normalizedPhone = contactPhone.replace(/\D/g, '');

  const params = {
    TableName: CONVERSATION_STATE_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CONVERSATION#${normalizedPhone}`,
      SK: `STATE#${existing.conversationId}`
    },
    UpdateExpression: 'SET #state = :state, #outcome = :outcome, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#state': 'state',
      '#outcome': 'outcome',
      '#updatedAt': 'updatedAt'
    },
    ExpressionAttributeValues: {
      ':state': 'completed',
      ':outcome': outcome,
      ':updatedAt': new Date().toISOString()
    }
  };

  try {
    await dynamodb.update(params);
  } catch (error) {
    logger.error('Failed to complete conversation:', error);
    throw error;
  }
}

export {
  getConversationState,
  createConversationState,
  updateConversationState,
  completeConversation
};
```

**Validation:**
- [ ] All functions implemented
- [ ] Phone number validation
- [ ] Error handling with logging
- [ ] TTL set to 7 days
- [ ] Auto-creates state if missing
- [ ] Message count incremented

---

### Subtask 2B.3.3: Add Environment Variable for Table Name
**File:** `server/.env`

**Changes:**
```bash
CONVERSATION_STATE_TABLE_NAME=conversation-state
```

**Validation:**
- [ ] Environment variable added
- [ ] Matches CloudFormation table name
- [ ] Loaded in config.js

---

### Subtask 2B.3.4: Integrate State Management into Agent Runtime
**File:** `server/agents/agentRuntime.js`

**Changes:**
```javascript
import { getConversationState, updateConversationState } from '../conversationStateService.js';

// Around line 210 (after loading lead context)
const convState = await getConversationState(tenantId, context.contactPhone);

// Format state for prompt
let stateContextPrompt = '';
if (convState) {
  stateContextPrompt = `
Current Conversation Goal: ${convState.goal}
Progress: ${convState.goalProgress}%
Extracted Information:
${JSON.stringify(convState.extractedInfo, null, 2)}
`;
}

// Append to system prompt
const finalPrompt = systemPrompt + leadContextPrompt + stateContextPrompt + contextPrompt;

// After agent response, update state
const newExtractedInfo = extractInfoFromResponse(agentResponse);
await updateConversationState(tenantId, context.contactPhone, {
  goalProgress: calculateProgress(convState, newExtractedInfo),
  extractedInfo: { ...convState.extractedInfo, ...newExtractedInfo }
});
```

**Validation:**
- [ ] State loaded before agent invocation
- [ ] State included in prompt
- [ ] State updated after response
- [ ] Works when no state exists
- [ ] Extracted info merged correctly

---

### Subtask 2B.3.5: Test Conversation State Management
**File:** `tests/playwright/api/conversation-state.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('Conversation State Management', () => {
  test('should track conversation state across turns', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // First turn: agent asks for budget
    const turn1 = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'What is your budget?',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(turn1.status()).toBe(200);

    // Second turn: user provides budget, agent should remember
    const turn2 = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'My budget is 50 lakhs',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(turn2.status()).toBe(200);

    // Verify conversation state was updated
    const stateResponse = await request.get(
      `${API_URL}/api/crm/conversation-state/${testPhone}`,
      {
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );

    expect(stateResponse.status()).toBe(200);
    const state = await stateResponse.json();
    expect(state.extractedInfo.budget).toBe('50 lakhs');
  });

  test('should auto-create state if missing', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Hello',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    // State should be auto-created
  });

  test('should expire after 7 days', async ({ request }) => {
    // Test TTL functionality
    // This requires manual verification or time-based test
  });
});
```

**Validation:**
- [ ] State tracked across turns
- [ ] Auto-creates state if missing
- [ ] Extracted info persisted
- [ ] Progress updated correctly
- [ ] TTL functionality works

---

## Phase 2B Completion Checklist

### Conversation Context
- [ ] getConversationContext function implemented
- [ ] Phone number validation added
- [ ] Error handling with logging
- [ ] Caching implemented (30s TTL)
- [ ] Integrated into agent runtime
- [ ] Tests pass

### Lead Context
- [ ] enrichContextWithLead function implemented
- [ ] Error handling for missing leads
- [ ] Integrated into agent runtime
- [ ] Formatted correctly for prompt
- [ ] Tests pass

### Conversation State
- [ ] ConversationStateTable added to CFN
- [ ] conversationStateService.js created
- [ ] All CRUD operations implemented
- [ ] TTL set to 7 days
- [ ] Integrated into agent runtime
- [ ] State updates after agent response
- [ ] Tests pass

### Integration
- [ ] All context sources combined
- [ ] Prompt assembly correct
- [ ] No context source conflicts
- [ ] Graceful fallbacks work
- [ ] Performance acceptable

### Documentation
- [ ] Code comments updated
- [ ] API documentation updated
- [ ] Architecture diagram updated

---

## Next Steps

After completing Phase 2B:
1. Update `progress-tracker.md` with completed tasks
2. Move to `phase-2c-tools.md`
3. Ensure all Phase 2B tests pass before proceeding

---

**Phase Status:** 📋 Planned
**Last Updated:** June 2026
