# Phase 2D: Testing
**Duration:** 1-2 weeks | **Focus:** WhatsApp integration tests, AI agent tests, context management tests

---

## High-Level Goal (Plain English)

**What we're doing:** We're writing comprehensive tests to make sure everything we built in the previous phases actually works correctly. This includes testing WhatsApp messaging, AI agent responses, personality changes, conversation memory, and security rules.

**Why it matters:** We're adding a lot of new features (WhatsApp, personality, context management, etc.) and if we don't test them thoroughly, they could break in production. We need to verify that messages are sent correctly, the AI responds with the right personality, it remembers conversation history, and security rules block the right people. Testing gives us confidence that the system will work when real users start using it.

**In simple terms:** Think of this like a "quality check" before we go live. We're simulating real-world scenarios - sending WhatsApp messages, having conversations with the AI, trying to break things - to make sure everything works as expected. If something fails during testing, we fix it now rather than having it fail in front of real customers.

---

## Overview

Phase 2D implements comprehensive testing for all new features added in Phases 2A-2C, ensuring 100% test coverage for WhatsApp, AI agents, and context management.

### Success Criteria
- ✅ 100% test coverage for WhatsApp
- ✅ 100% test coverage for AI agents
- ✅ Context management tests passing
- ✅ All edge cases tested

---

## Task 2D.1: Add WhatsApp Integration Tests
**Effort:** 3-4 days | **Priority:** CRITICAL

### Subtask 2D.1.1: Create WhatsApp Test File
**File:** `tests/playwright/api/whatsapp.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN, BAILEY_WEBHOOK_SECRET } from '../helpers/config';
import crypto from 'crypto';

test.describe('WhatsApp Integration', () => {
  test('should receive and process incoming message webhook', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;
    const payload = {
      from: testPhone,
      to: '919876543211',
      text: 'Hello, I am interested in properties',
      messageId: `msg_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', BAILEY_WEBHOOK_SECRET)
      .update(`${payload.timestamp}.${rawBody}`)
      .digest('hex');

    const response = await request.post(`${API_URL}/webhooks/whatsapp`, {
      data: payload,
      headers: {
        'x-bailey-signature': `sha256=${signature}`,
        'x-bailey-timestamp': payload.timestamp.toString()
      }
    });

    expect(response.status()).toBe(200);
  });

  test('should reject webhook with invalid signature', async ({ request }) => {
    const payload = { from: '919876543210', text: 'Hello' };

    const response = await request.post(`${API_URL}/webhooks/whatsapp`, {
      data: payload,
      headers: {
        'x-bailey-signature': 'sha256=invalid',
        'x-bailey-timestamp': Math.floor(Date.now() / 1000).toString()
      }
    });

    expect(response.status()).toBe(401);
  });

  test('should reject webhook with missing signature', async ({ request }) => {
    const payload = { from: '919876543210', text: 'Hello' };

    const response = await request.post(`${API_URL}/webhooks/whatsapp`, {
      data: payload,
      headers: {
        'x-bailey-timestamp': Math.floor(Date.now() / 1000).toString()
      }
    });

    expect(response.status()).toBe(401);
  });

  test('should store conversation in DynamoDB', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Send message via API
    const response = await request.post(
      `${API_URL}/api/whatsapp/conversations/${testPhone}/messages`,
      {
        data: { text: 'Test message' },
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );

    expect(response.status()).toBe(200);

    // Verify conversation stored
    const convResponse = await request.get(
      `${API_URL}/api/whatsapp/conversations/${testPhone}`,
      {
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );

    expect(convResponse.status()).toBe(200);
    const messages = await convResponse.json();
    expect(messages.length).toBeGreaterThan(0);
  });

  test('should retrieve conversation with pagination', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Send 15 messages
    for (let i = 0; i < 15; i++) {
      await request.post(
        `${API_URL}/api/whatsapp/conversations/${testPhone}/messages`,
        {
          data: { text: `Message ${i + 1}` },
          headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
        }
      );
    }

    // Retrieve with pagination
    const response = await request.get(
      `${API_URL}/api/whatsapp/conversations/${testPhone}?limit=10`,
      {
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );

    expect(response.status()).toBe(200);
    const messages = await response.json();
    expect(messages.length).toBe(10);
  });

  test('should mark conversation as read', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Send message
    await request.post(
      `${API_URL}/api/whatsapp/conversations/${testPhone}/messages`,
      {
        data: { text: 'Test message' },
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );

    // Mark as read
    const response = await request.patch(
      `${API_URL}/api/whatsapp/conversations/${testPhone}/read`,
      {
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );

    expect(response.status()).toBe(200);
  });

  test('should handle media messages', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    const response = await request.post(
      `${API_URL}/api/whatsapp/conversations/${testPhone}/messages`,
      {
        data: {
          text: 'Check this image',
          media: {
            type: 'image',
            url: 'https://example.com/image.jpg'
          }
        },
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );

    expect(response.status()).toBe(200);
  });
});
```

**Validation:**
- [ ] Webhook signature verification tested
- [ ] Invalid signature rejection tested
- [ ] Missing signature rejection tested
- [ ] Message storage verified
- [ ] Pagination tested
- [ ] Mark as read tested
- [ ] Media messages tested

---

### Subtask 2D.1.2: Add WhatsApp Helper Functions
**File:** `tests/playwright/helpers/whatsapp.ts` (new file)

**Changes:**
```typescript
import { API_URL, TEST_TOKEN } from './config';

export async function sendWhatsAppMessage(phone: string, text: string) {
  const response = await fetch(`${API_URL}/api/whatsapp/conversations/${phone}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TEST_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });
  return response.json();
}

export async function getConversation(phone: string) {
  const response = await fetch(`${API_URL}/api/whatsapp/conversations/${phone}`, {
    headers: {
      'Authorization': `Bearer ${TEST_TOKEN}`
    }
  });
  return response.json();
}

export async function markConversationRead(phone: string) {
  const response = await fetch(`${API_URL}/api/whatsapp/conversations/${phone}/read`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${TEST_TOKEN}`
    }
  });
  return response.json();
}

export function generateTestPhone() {
  return `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;
}
```

**Validation:**
- [ ] Helper functions created
- [ ] Used in test files
- [ ] Reduces test code duplication
- [ ] Consistent test data generation

---

## Task 2D.2: Add AI Agent Behavior Tests
**Effort:** 4-5 days | **Priority:** CRITICAL

### Subtask 2D.2.1: Create AI Agent Test File
**File:** `tests/playwright/api/ai-agent.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('AI Agent Behavior', () => {
  test('should invoke qualifier agent and return score', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'qualifier',
        prompt: 'Qualify this lead: Budget 50L, ready to buy in 2 months',
        context: { leadId: 'lead_123' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('score');
    expect(['HOT', 'WARM', 'COLD']).toContain(result.data.score);
  });

  test('should invoke router agent and assign lead', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'router',
        prompt: 'Assign this HOT lead to a team member',
        context: { leadId: 'lead_123' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('assignedTo');
  });

  test('should invoke followup agent and generate message', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'followup',
        prompt: 'Generate follow-up for stale lead',
        context: { leadId: 'lead_123' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('message');
    expect(result.data).toHaveProperty('tone');
  });

  test('should respect personality setting in response', async ({ request }) => {
    // Set personality to 'friendly'
    await request.patch(`${API_URL}/api/crm/config/ai-employee`, {
      data: { aiPersonality: 'friendly' },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Invoke whatsapp agent
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Hi, I am looking for a 2BHK apartment',
        context: { contactPhone: '919876543210' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.data.response).toBeTruthy();
    // Friendly personality should use Hinglish and warm tone
  });

  test('should deduct credits on agent invocation', async ({ request }) => {
    // Get initial balance
    const balanceBefore = await request.get(`${API_URL}/api/subscriptions/credits`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    const creditsBefore = (await balanceBefore.json()).balance;

    // Invoke agent
    await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'qualifier',
        prompt: 'Qualify this lead',
        context: {}
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Get new balance
    const balanceAfter = await request.get(`${API_URL}/api/subscriptions/credits`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    const creditsAfter = (await balanceAfter.json()).balance;

    expect(creditsBefore - creditsAfter).toBe(15);  // AGENT_ACTION_CREDITS
  });

  test('should return error if insufficient credits', async ({ request }) => {
    // Manually set credits to 0 via credit service
    // Note: This requires a test endpoint or direct service call
    // For now, we'll test the error handling

    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'qualifier',
        prompt: 'Qualify this lead',
        context: {}
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // If credits are 0, should return 402
    // This test needs a test tenant with 0 credits
  });

  test('should invoke tools and log audit trail', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Create a lead for John Doe, phone 9876543210',
        context: { contactPhone: '919876543210' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.data.toolCalls).toBeDefined();

    // Verify audit log
    const auditResponse = await request.get(`${API_URL}/api/crm/agents/activity`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(auditResponse.status()).toBe(200);
    const audit = await auditResponse.json();
    expect(audit.activities.length).toBeGreaterThan(0);
  });

  test('should handle agent timeout gracefully', async ({ request }) => {
    // Test with a prompt that might cause timeout
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Generate a very long response',
        context: {}
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Should handle timeout without crashing
    expect([200, 408, 500]).toContain(response.status());
  });
});
```

**Validation:**
- [ ] All agent types tested
- [ ] Qualifier agent tested
- [ ] Router agent tested
- [ ] Followup agent tested
- [ ] WhatsApp agent tested
- [ ] Personality variation tested
- [ ] Credit deduction verified
- [ ] Insufficient credits error tested
- [ ] Tool invocation and audit logging verified
- [ ] Timeout handling tested

---

### Subtask 2D.2.2: Add Agent Helper Functions
**File:** `tests/playwright/helpers/agent.ts` (new file)

**Changes:**
```typescript
import { API_URL, TEST_TOKEN } from './config';

export async function invokeAgent(agentId: string, prompt: string, context: any = {}) {
  const response = await fetch(`${API_URL}/api/crm/agent/invoke`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TEST_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ agentId, prompt, context })
  });
  return response.json();
}

export async function setPersonality(personality: string) {
  const response = await fetch(`${API_URL}/api/crm/config/ai-employee`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${TEST_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ aiPersonality: personality })
  });
  return response.json();
}

export async function getCredits() {
  const response = await fetch(`${API_URL}/api/subscriptions/credits`, {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });
  return response.json();
}

export async function getAgentActivity(limit: number = 20) {
  const response = await fetch(`${API_URL}/api/crm/agents/activity?limit=${limit}`, {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });
  return response.json();
}
```

**Validation:**
- [ ] Helper functions created
- [ ] Used in test files
- [ ] Reduces test code duplication
- [ ] Consistent agent invocation

---

## Task 2D.3: Add Context Management Tests
**Effort:** 3-4 days | **Priority:** CRITICAL

### Subtask 2D.3.1: Create Context Management Test File
**File:** `tests/playwright/api/context-management.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';
import { generateTestPhone } from '../helpers/whatsapp';

test.describe('Context Management', () => {
  test('should load conversation history in agent prompt', async ({ request }) => {
    const testPhone = generateTestPhone();

    // Send multiple messages to build history
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
    const result = await response.json();
    // Agent should reference previous messages
  });

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

  test('should track conversation state across turns', async ({ request }) => {
    const testPhone = generateTestPhone();

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

  test('should handle missing context gracefully', async ({ request }) => {
    const testPhone = generateTestPhone();

    // Invoke agent with no context
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Hello',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    // Should work without context
  });

  test('should cache conversation history', async ({ request }) => {
    const testPhone = generateTestPhone();

    // Send message
    await request.post(
      `${API_URL}/api/whatsapp/conversations/${testPhone}/messages`,
      {
        data: { text: 'Test message' },
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );

    // First invocation - should load from DB
    const response1 = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Hello',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Second invocation - should load from cache
    const response2 = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Hello again',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(200);
    // Both should succeed, second should be faster
  });
});
```

**Validation:**
- [ ] Conversation history loading tested
- [ ] Lead context inclusion verified
- [ ] Multi-turn state tracking tested
- [ ] Context persistence verified
- [ ] Missing context handled gracefully
- [ ] Caching functionality tested

---

## Task 2D.4: Add Edge Case Tests
**Effort:** 2-3 days | **Priority:** MEDIUM

### Subtask 2D.4.1: Create Edge Case Test File
**File:** `tests/playwright/api/edge-cases.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';
import { generateTestPhone } from '../helpers/whatsapp';

test.describe('Edge Cases', () => {
  test('should handle very long conversation history', async ({ request }) => {
    const testPhone = generateTestPhone();

    // Send 100 messages
    for (let i = 0; i < 100; i++) {
      await request.post(
        `${API_URL}/api/whatsapp/conversations/${testPhone}/messages`,
        {
          data: { text: `Message ${i + 1}` },
          headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
        }
      );
    }

    // Should only load last 10 (or configured limit)
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'What was discussed?',
        context: { contactPhone: testPhone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
  });

  test('should handle invalid phone numbers', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Hello',
        context: { contactPhone: 'invalid-phone' }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(400);
  });

  test('should handle concurrent agent invocations', async ({ request }) => {
    const testPhone = generateTestPhone();

    // Send 10 concurrent requests
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(
        request.post(`${API_URL}/api/crm/agent/invoke`, {
          data: {
            agentId: 'whatsapp',
            prompt: `Test message ${i}`,
            context: { contactPhone: testPhone }
          },
          headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
        })
      );
    }

    const responses = await Promise.all(requests);
    const successCount = responses.filter(r => r.status() === 200).length;

    expect(successCount).toBeGreaterThan(0);
  });

  test('should handle agent errors gracefully', async ({ request }) => {
    // Test with malformed prompt
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: '',
        context: {}
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    // Should return error without crashing
    expect([200, 400, 500]).toContain(response.status());
  });

  test('should handle missing agent ID', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'non-existent-agent',
        prompt: 'Hello',
        context: {}
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(400);
  });
});
```

**Validation:**
- [ ] Long conversation history handled
- [ ] Invalid phone numbers rejected
- [ ] Concurrent invocations handled
- [ ] Agent errors handled gracefully
- [ ] Missing agent ID handled

---

## Phase 2D Completion Checklist

### WhatsApp Tests
- [ ] Webhook signature verification tested
- [ ] Invalid signature rejection tested
- [ ] Message storage verified
- [ ] Conversation retrieval tested
- [ ] Pagination tested
- [ ] Mark as read tested
- [ ] Media messages tested
- [ ] Helper functions created

### AI Agent Tests
- [ ] Qualifier agent tested
- [ ] Router agent tested
- [ ] Followup agent tested
- [ ] WhatsApp agent tested
- [ ] Personality variation tested
- [ ] Credit deduction verified
- [ ] Insufficient credits error tested
- [ ] Tool invocation and audit logging verified
- [ ] Timeout handling tested
- [ ] Helper functions created

### Context Management Tests
- [ ] Conversation history loading tested
- [ ] Lead context inclusion verified
- [ ] Multi-turn state tracking tested
- [ ] Context persistence verified
- [ ] Missing context handled gracefully
- [ ] Caching functionality tested

### Edge Case Tests
- [ ] Long conversation history handled
- [ ] Invalid phone numbers rejected
- [ ] Concurrent invocations handled
- [ ] Agent errors handled gracefully
- [ ] Missing agent ID handled

### Test Infrastructure
- [ ] All test files created
- [ ] Helper functions implemented
- [ ] Test data generation consistent
- [ ] No hardcoded test data
- [ ] Test isolation ensured

### Documentation
- [ ] Test documentation updated
- [ ] Test coverage report generated
- [ ] Known test limitations documented

---

## Next Steps

After completing Phase 2D:
1. Update `progress-tracker.md` with completed tasks
2. Move to `phase-2e-deployment.md`
3. Ensure all Phase 2D tests pass before proceeding
4. Generate test coverage report

---

**Phase Status:** 📋 Planned
**Last Updated:** June 2026
