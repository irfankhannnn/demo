# Phase 2A: Foundation
**Duration:** 2 weeks | **Focus:** WhatsApp enablement, personality injection, knowledge base setup

---

## High-Level Goal (Plain English)

**What we're doing:** We're turning on the WhatsApp messaging feature and making the AI assistant able to "speak" in different personalities (professional, friendly, or direct). We're also setting up a place where each company can store their own custom instructions and business information that the AI should know about.

**Why it matters:** Right now, the WhatsApp integration exists but is turned off, and even if we turn it on, the AI responds the same way to everyone regardless of their personality settings. We need to fix this so that when a real estate agent says "be friendly with my customers," the AI actually adjusts its tone. We also need to give each company a way to tell the AI about their specific business (like "we focus on luxury properties in Mumbai") so the AI can give more relevant answers.

**In simple terms:** Think of this like setting up a phone line for the AI and teaching it how to speak in different tones (formal vs casual) while also giving it a "cheat sheet" about each company's business so it doesn't give generic answers.

---

## Overview

Phase 2A establishes the foundation for the AI Employee system by enabling WhatsApp integration, making personality configuration functional, and setting up the knowledge base infrastructure.

### Success Criteria
- ✅ WhatsApp messages sent/received end-to-end
- ✅ Personality configuration functional
- ✅ Knowledge base directory created
- ✅ All 3 personalities tested

---

## Task 2A.1: Enable WhatsApp Integration
**Effort:** 3-4 days | **Priority:** CRITICAL

### Subtask 2A.1.1: Configure Environment Variables
**File:** `server/.env`

**Changes Required:**
```bash
BAILEY_ENABLED=true
BAILEY_MODE=selfhosted
BAILEY_API_KEY=<your-api-key>  # Optional but recommended for auth
BAILEY_ADMIN_API_KEY=<your-admin-key>  # For destructive operations
BAILEY_WEBHOOK_SECRET=<your-secret>
BAILEY_API_ENDPOINT=http://localhost:3003  # Your Bailey service
BAILEY_API_PREFIX=              # Optional path prefix
```

**Validation:**
- [ ] Verify Bailey service is running at BAILEY_API_ENDPOINT
- [ ] Verify BAILEY_WEBHOOK_SECRET matches your Bailey configuration
- [ ] Test service health check (if available)

---

### Subtask 2A.1.2: Verify Webhook Endpoint Accessibility
**File:** `server/routes/webhooks.js`

**Action:**
1. Check webhook endpoint is accessible from Bailey service
2. Verify webhook signature verification is working
3. Test with sample webhook payload

**Test Command:**
```bash
curl -X POST http://localhost:3001/webhooks/whatsapp \
  -H "x-bailey-signature: sha256=<signature>" \
  -H "x-bailey-timestamp: <timestamp>" \
  -d '{"from":"919876543210","text":"test"}'
```

**Validation:**
- [ ] Webhook endpoint returns 200 for valid signatures
- [ ] Webhook endpoint returns 401 for invalid signatures
- [ ] Signature verification logic is correct

---

### Subtask 2A.1.3: Test Message Sending
**File:** `server/bailey.js`

**Action:**
1. Test message sending via `POST /api/whatsapp/conversations/:phone/messages`
2. Verify message is delivered to WhatsApp
3. Check message is stored in DynamoDB

**Test API Call:**
```bash
curl -X POST http://localhost:3001/api/whatsapp/conversations/919876543210/messages \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant-id>" \
  -d '{"text":"Test message from API"}'
```

**Validation:**
- [ ] Message sent successfully
- [ ] Message appears in WhatsApp
- [ ] Message stored in DynamoDB with correct TTL
- [ ] Message has correct direction (outbound)

---

### Subtask 2A.1.4: Verify Conversation History Storage
**File:** `server/whatsappConversationService.js`

**Action:**
1. Send multiple messages
2. Retrieve conversation history
3. Verify 90-day TTL is set correctly

**Test API Call:**
```bash
curl -X GET http://localhost:3001/api/whatsapp/conversations/919876543210 \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant-id>"
```

**Validation:**
- [ ] Conversation history retrieved correctly
- [ ] Messages ordered by timestamp (newest first)
- [ ] TTL attribute set to 90 days
- [ ] Pagination works correctly

---

## Task 2A.2: Implement Personality Injection
**Effort:** 2-3 days | **Priority:** HIGH

### Subtask 2A.2.1: Add Personality-Specific Prompt Templates
**File:** `server/agents/prompts.js`

**Changes:**
```javascript
// Add personality-specific prompt templates
const personalityPrompts = {
  professional: `
    You are a professional real estate assistant.
    Be formal, concise, and business-focused.
    Use proper English with minimal casual language.
    Focus on facts and data.
  `,
  friendly: `
    You are a friendly real estate assistant.
    Be warm, conversational, and approachable.
    Use Hinglish (70% English, 30% Hindi romanised).
    Build rapport with the user.
  `,
  direct: `
    You are a direct real estate assistant.
    Be straightforward and action-oriented.
    Get to the point quickly.
    Minimize unnecessary details.
  `
};
```

**Validation:**
- [ ] All 3 personality templates defined
- [ ] Templates follow Hinglish convention for "friendly"
- [ ] Templates are concise and clear

---

### Subtask 2A.2.2: Modify buildSystemPrompt Function
**File:** `server/agents/prompts.js`

**Changes:**
```javascript
// Modify buildSystemPrompt to use personality
export function buildSystemPrompt(agentId, tenantId, personality = 'professional') {
  const specific = agentSpecificPrompts[agentId] || agentSpecificPrompts.mcp;
  const personalityStyle = personalityPrompts[personality] || personalityPrompts.professional;

  return `You are SyncBot, an AI assistant for RealEstateFlow CRM (tenant: ${tenantId}).

${personalityStyle}

${specific}

CRITICAL RULES:
- NEVER write your internal reasoning or thinking
- NEVER output more than 2 short sentences
- NEVER include "The user..." or "I should..." or "Wait..." in your reply
- ONLY give the final answer to the user
- Use tools for create/update operations
- Never invent data
- Tenant ID: ${tenantId}
`.trim();
}
```

**Validation:**
- [ ] Function accepts personality parameter
- [ ] Default personality is 'professional'
- [ ] Personality template injected correctly
- [ ] Function signature backward compatible

---

### Subtask 2A.2.3: Load Personality from Agency Config
**File:** `server/agents/agentRuntime.js`

**Changes:**
```javascript
// Around line 199 (before building system prompt)
const agencyConfig = await getAgencyConfig(tenantId);
const personality = agencyConfig?.aiPersonality || 'professional';
const systemPrompt = buildSystemPrompt(agentId, tenantId, personality);
```

**Validation:**
- [ ] Agency config loaded successfully
- [ ] Personality extracted from config
- [ ] Default fallback to 'professional' if missing
- [ ] Personality passed to buildSystemPrompt

---

### Subtask 2A.2.4: Test All 3 Personalities
**File:** `tests/playwright/api/ai-agent.spec.ts` (new file)

**Test Cases:**
```typescript
test('should use professional personality', async ({ request }) => {
  await request.patch(`${API_URL}/api/crm/config/ai-employee`, {
    data: { aiPersonality: 'professional' },
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });

  const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
    data: { agentId: 'whatsapp', prompt: 'Hello', context: {} },
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });

  expect(response.status()).toBe(200);
  // Verify response tone is professional
});

test('should use friendly personality', async ({ request }) => {
  await request.patch(`${API_URL}/api/crm/config/ai-employee`, {
    data: { aiPersonality: 'friendly' },
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });

  const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
    data: { agentId: 'whatsapp', prompt: 'Hello', context: {} },
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });

  expect(response.status()).toBe(200);
  // Verify response uses Hinglish and warm tone
});

test('should use direct personality', async ({ request }) => {
  await request.patch(`${API_URL}/api/crm/config/ai-employee`, {
    data: { aiPersonality: 'direct' },
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });

  const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
    data: { agentId: 'whatsapp', prompt: 'Hello', context: {} },
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });

  expect(response.status()).toBe(200);
  // Verify response is concise and action-oriented
});
```

**Validation:**
- [ ] Professional personality test passes
- [ ] Friendly personality test passes
- [ ] Direct personality test passes
- [ ] Responses vary by personality setting

---

## Task 2A.3: Create Knowledge Base Directory Structure
**Effort:** 2-3 days | **Priority:** MEDIUM

### Subtask 2A.3.1: Create Directory Structure
**Directory:** `.devin/ai-employee/`

**Structure:**
```
.devin/ai-employee/
├── README.md                    # Overview
├── system-prompts/
│   ├── base.md                 # Base system prompt
│   ├── personality-professional.md
│   ├── personality-friendly.md
│   └── personality-direct.md
├── tools/
│   ├── lead-creation.md        # Tool-specific guidance
│   ├── lead-qualification.md
│   └── ...
├── tenant-templates/
│   └── example-tenant/
│       ├── business-context.md # Tenant-specific info
│       ├── team-members.md
│       └── custom-rules.md
└── examples/
    ├── good-responses.md
    ├── bad-responses.md
    └── conversation-flows.md
```

**Validation:**
- [ ] All directories created
- [ ] README.md with overview
- [ ] Example tenant template provided

---

### Subtask 2A.3.2: Implement Document Loader
**File:** `server/agents/prompts.js`

**Changes:**
```javascript
import fs from 'fs/promises';
import path from 'path';

async function loadTenantDocs(tenantId) {
  const docsPath = path.join(process.cwd(), '.devin/ai-employee');
  const tenantPath = path.join(docsPath, 'tenant-templates', tenantId);

  try {
    const businessContext = await fs.readFile(
      path.join(tenantPath, 'business-context.md'),
      'utf-8'
    );
    const teamMembers = await fs.readFile(
      path.join(tenantPath, 'team-members.md'),
      'utf-8'
    );
    return { businessContext, teamMembers };
  } catch (e) {
    logger.warn(`Failed to load tenant docs for ${tenantId}:`, e.message);
    return {}; // Graceful fallback
  }
}
```

**Validation:**
- [ ] Function uses async file I/O (not blocking)
- [ ] Error handling with logging
- [ ] Graceful fallback for missing docs
- [ ] Returns empty object on error

---

### Subtask 2A.3.3: Integrate Document Loader into buildSystemPrompt
**File:** `server/agents/prompts.js`

**Changes:**
```javascript
export async function buildSystemPrompt(agentId, tenantId, personality = 'professional') {
  const specific = agentSpecificPrompts[agentId] || agentSpecificPrompts.mcp;
  const personalityStyle = personalityPrompts[personality] || personalityPrompts.professional;

  let systemPrompt = `You are SyncBot, an AI assistant for RealEstateFlow CRM (tenant: ${tenantId}).

${personalityStyle}

${specific}

CRITICAL RULES:
- NEVER write your internal reasoning or thinking
- NEVER output more than 2 short sentences
- NEVER include "The user..." or "I should..." or "Wait..." in your reply
- ONLY give the final answer to the user
- Use tools for create/update operations
- Never invent data
- Tenant ID: ${tenantId}
`.trim();

  // Load tenant-specific documentation
  const tenantDocs = await loadTenantDocs(tenantId);
  if (tenantDocs.businessContext) {
    systemPrompt += `\n\nTenant Context:\n${tenantDocs.businessContext}`;
  }
  if (tenantDocs.teamMembers) {
    systemPrompt += `\n\nTeam Members:\n${tenantDocs.teamMembers}`;
  }

  return systemPrompt;
}
```

**Validation:**
- [ ] Function is now async
- [ ] Tenant docs loaded and appended
- [ ] Business context included if available
- [ ] Team members included if available
- [ ] Works without tenant docs (graceful fallback)

---

### Subtask 2A.3.4: Update Agent Runtime to Use Async buildSystemPrompt
**File:** `server/agents/agentRuntime.js`

**Changes:**
```javascript
// Around line 199 (before building system prompt)
const agencyConfig = await getAgencyConfig(tenantId);
const personality = agencyConfig?.aiPersonality || 'professional';
const systemPrompt = await buildSystemPrompt(agentId, tenantId, personality); // Add await
```

**Validation:**
- [ ] buildSystemPrompt called with await
- [ ] No syntax errors
- [ ] Agent runtime still works

---

### Subtask 2A.3.5: Create Example Tenant Documentation
**File:** `.devin/ai-employee/tenant-templates/example-tenant/business-context.md`

**Content:**
```markdown
# Business Context

## Company Overview
We are a premium real estate agency specializing in luxury properties in Mumbai and South Delhi.

## Target Market
- High-net-worth individuals
- NRIs looking for investment properties
- Corporate clients for office spaces

## Value Proposition
- Exclusive property listings
- Personalized service
- Market expertise
- Legal support

## Pricing Strategy
- Premium properties: ₹5Cr+
- Mid-range properties: ₹2Cr-5Cr
- Budget properties: ₹1Cr-2Cr
```

**Validation:**
- [ ] Example business context created
- [ ] Format is clear and structured
- [ ] Content is realistic

---

## Task 2A.4: Phase 2A Testing & Validation
**Effort:** 1-2 days | **Priority:** CRITICAL

### Subtask 2A.4.1: Integration Test - WhatsApp End-to-End
**File:** `tests/playwright/api/whatsapp-integration.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('WhatsApp Integration End-to-End', () => {
  test('should send and receive message', async ({ request }) => {
    const testPhone = `91${Math.floor(Math.random() * 9000000000) + 1000000000}`;

    // Send message
    const sendResponse = await request.post(
      `${API_URL}/api/whatsapp/conversations/${testPhone}/messages`,
      {
        data: { text: 'Test message' },
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );

    expect(sendResponse.status()).toBe(200);

    // Retrieve conversation
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
});
```

**Validation:**
- [ ] End-to-end test passes
- [ ] Uses generated test phone numbers
- [ ] No hardcoded test data

---

### Subtask 2A.4.2: Integration Test - Personality Injection
**File:** `tests/playwright/api/personality-injection.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('Personality Injection', () => {
  test('should inject professional personality', async ({ request }) => {
    await request.patch(`${API_URL}/api/crm/config/ai-employee`, {
      data: { aiPersonality: 'professional' },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Tell me about 2BHK apartments',
        context: {}
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.data.response).toBeTruthy();
    // Verify professional tone (formal, concise)
  });

  test('should inject friendly personality', async ({ request }) => {
    await request.patch(`${API_URL}/api/crm/config/ai-employee`, {
      data: { aiPersonality: 'friendly' },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Tell me about 2BHK apartments',
        context: {}
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.data.response).toBeTruthy();
    // Verify friendly tone (Hinglish, warm)
  });
});
```

**Validation:**
- [ ] Personality injection tests pass
- [ ] All 3 personalities tested
- [ ] Responses vary by personality

---

### Subtask 2A.4.3: Integration Test - Knowledge Base Loading
**File:** `tests/playwright/api/knowledge-base.spec.ts` (new file)

**Test Cases:**
```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('Knowledge Base Loading', () => {
  test('should load tenant docs if available', async ({ request }) => {
    // Create tenant docs in .devin/ai-employee/tenant-templates/test-tenant/
    // Then test agent invocation

    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'What is your company about?',
        context: {}
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    // Verify agent uses tenant context
  });

  test('should work without tenant docs', async ({ request }) => {
    // Test with tenant that has no docs

    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'Hello',
        context: {}
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    // Should not fail, just work without tenant context
  });
});
```

**Validation:**
- [ ] Knowledge base loading tests pass
- [ ] Graceful fallback works
- [ ] No errors when docs missing

---

## Phase 2A Completion Checklist

### Configuration
- [ ] BAILEY_ENABLED=true in .env
- [ ] BAILEY_MODE=selfhosted configured
- [ ] BAILEY_API_ENDPOINT points to your Bailey service
- [ ] BAILEY_WEBHOOK_SECRET configured
- [ ] AGENTS_ENABLED=true in .env

### WhatsApp Integration
- [ ] Webhook endpoint accessible
- [ ] Message sending works
- [ ] Message receiving works
- [ ] Conversation history stored
- [ ] TTL set correctly (90 days)

### Personality System
- [ ] Personality templates defined
- [ ] buildSystemPrompt modified
- [ ] Personality loaded from config
- [ ] All 3 personalities tested
- [ ] Responses vary by personality

### Knowledge Base
- [ ] Directory structure created
- [ ] Document loader implemented
- [ ] Async file I/O used
- [ ] Error handling with logging
- [ ] Graceful fallback works
- [ ] Example tenant docs created

### Testing
- [ ] WhatsApp integration tests pass
- [ ] Personality injection tests pass
- [ ] Knowledge base tests pass
- [ ] No hardcoded test data
- [ ] All edge cases covered

### Documentation
- [ ] Code comments updated
- [ ] README.md in knowledge base
- [ ] Example tenant docs documented

---

## Next Steps

After completing Phase 2A:
1. Update `progress-tracker.md` with completed tasks
2. Move to `phase-2b-context.md`
3. Ensure all Phase 2A tests pass before proceeding

---

**Phase Status:** 📋 Planned
**Last Updated:** June 2026
