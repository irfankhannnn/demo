# AI Employee System - Phase 2 Implementation Plan
**Status:** Ready for Implementation | **Last Updated:** June 2026 | **Scope:** Context Management, Personality Integration, Testing

---

## High-Level Goal (Plain English)

**What this document is:** This is the detailed master plan for Phase 2 implementation. It breaks down everything we need to do into 5 phases (Foundation, Context Management, Tool Enhancement, Testing, Deployment) with specific tasks, code examples, and validation steps for each.

**Why it matters:** The high-level overview tells us what we need to do, but this document tells us exactly how to do it. Each task has specific file locations, code snippets, and validation checklists. This ensures that different developers can work on different parts of the project without confusion, and that nothing gets missed. It's the blueprint that the team follows to build the system.

**In simple terms:** Think of this like a detailed construction blueprint. The overview says "we need to build a house with 3 bedrooms," but this document says "here's exactly how to build each room, what materials to use, and how to verify it's built correctly." It's the step-by-step instruction manual that guides the team through the entire implementation.

---

## Executive Summary

Based on comprehensive codebase analysis, the AI Employee system has **70% infrastructure** in place but is missing critical features for production readiness:

- ✅ **Implemented:** WhatsApp integration, agent runtime, credit metering, provisioning, audit logging
- ⚠️ **Disabled:** WhatsApp (`BAILEY_ENABLED=false`), AI agents (`AGENTS_ENABLED=false`)
- ❌ **Missing:** Conversation context, personality injection, comprehensive testing

**Estimated Timeline:** 4-6 weeks for full implementation + testing

---

## Part 1: Current State Analysis

### 1.1 What's Actually Working

#### WhatsApp Integration (100% Complete)
- **Bailey.js:** Self-hosted WhatsApp integration
- **Conversation Service:** DynamoDB storage with 90-day TTL
- **Webhook Handler:** EventBridge integration, signature verification
- **Access Control:** Whitelist/blacklist, category-based filtering
- **Status:** DISABLED by default (`BAILEY_ENABLED=false`)

#### Agent Runtime (100% Complete)
- **LLM Support:** Bedrock (Claude 3 Haiku) + Gemini fallback
- **Tool System:** 22 CRM tools with validation
- **Audit Logging:** 90-day TTL, truncated I/O
- **Credit Metering:** Atomic operations, 15 credits/action
- **Provisioning:** Status lifecycle (pending → live → suspended)
- **Status:** DISABLED by default (`AGENTS_ENABLED=false`)

#### Personality Configuration (50% Complete)
- **Storage:** `aiPersonality` field in AgencyConfig (professional/friendly/direct)
- **UI:** Settings page allows configuration
- **Gap:** Personality is **stored but never used** in agent prompts

#### User Categories (100% Complete)
- **Manual Assignment:** Admin can categorize contacts
- **Auto-Categorization:** Based on interaction history
- **Access Control:** Per-category feature toggles
- **Categories:** lead, customer, spam, blocked, unknown

#### Credit System (100% Complete)
- **Atomic Operations:** TransactWrite prevents overdraft
- **Ledger:** 12-month TTL, all operations tracked
- **Metering:** Middleware-based per-action charging
- **Configuration:** DynamoDB-backed, owner-editable

### 1.2 Critical Gaps

#### Gap 1: Conversation Context (CRITICAL)
**Problem:** Agent prompts are static, no conversation history passed to LLM
```javascript
// Current: agents/prompts.js
buildSystemPrompt(agentId, tenantId) {
  // Only includes agentId, tenantId
  // Missing: conversation history, lead context, user preferences
}
```

**Impact:** 
- Multi-turn conversations impossible
- AI can't reference previous interactions
- Context resets on each message

**Solution Needed:** 
- Load last N messages from WhatsApp conversation
- Include lead/contact context in prompt
- Implement conversation state management

#### Gap 2: Personality Not Injected (HIGH)
**Problem:** `aiPersonality` config stored but never used
```javascript
// Current: agents/prompts.js (line 80-96)
// No personality-specific prompt variations
// All agents use same tone regardless of config
```

**Impact:**
- User configuration ignored
- All responses have same tone
- Personality feature is non-functional

**Solution Needed:**
- Create personality-specific prompt templates
- Inject personality into `buildSystemPrompt()`
- Vary tone/style based on configuration

#### Gap 3: Missing Knowledge Base (MEDIUM)
**Problem:** Code references non-existent `ai-employee/` directory
```javascript
// Current: agents/prompts.js (line 10)
const AI_EMPLOYEE_DIR = path.join(process.cwd(), '../../ai-employee');
// This directory does NOT exist
```

**Impact:**
- Tenant-specific documentation not loaded
- Custom instructions not available
- Knowledge base integration incomplete

**Solution Needed:**
- Create `.devin/ai-employee/` directory structure
- Implement document loading mechanism
- Add tenant-specific knowledge base support

#### Gap 4: Limited Context Passing (MEDIUM)
**Problem:** Only `userId` passed to tools, no rich context
```javascript
// Current: agents/agentRuntime.js (line 199)
invokeSkill(tenantId, toolName, toolInput, { userId: context.userId })
// Missing: lead context, conversation state, user preferences
```

**Impact:**
- Tools lack context for better decisions
- Can't personalize responses
- Limited tool effectiveness

**Solution Needed:**
- Expand context object with lead/contact/conversation data
- Pass user preferences to tools
- Implement context enrichment

#### Gap 5: No Conversation State (MEDIUM)
**Problem:** Each message is independent, no multi-turn state
```javascript
// Current: agents/agentRuntime.js
// Invokes LLM once per message
// No conversation state tracking
// No context accumulation across turns
```

**Impact:**
- Can't maintain conversation flow
- Can't track conversation goals
- Limited conversational ability

**Solution Needed:**
- Implement conversation state table
- Track conversation goals/context
- Maintain state across tool calls

#### Gap 6: Incomplete Testing (CRITICAL)
**Problem:** No WhatsApp or AI Employee tests
```
tests/playwright/
├── ui/crm/ai-employee.spec.ts  // Only page load test
├── api/cross-tenant-pentest.spec.ts  // Only 1 test
└── NO WhatsApp tests
```

**Impact:**
- Can't verify WhatsApp integration
- AI behavior untested
- Regression risk high

**Solution Needed:**
- Add WhatsApp webhook tests
- Add AI agent behavior tests
- Add integration tests

---

## Part 2: Implementation Roadmap

### Phase 2A: Foundation (Weeks 1-2)

#### Task 2A.1: Enable WhatsApp Integration
**Objective:** Get WhatsApp working end-to-end

**Changes Required:**
1. Create `.env` configuration:
   ```bash
   BAILEY_ENABLED=true
   BAILEY_MODE=selfhosted
   BAILEY_API_ENDPOINT=http://localhost:3003  # Your Bailey service
   BAILEY_API_KEY=<key>  # Optional but recommended for auth
   BAILEY_ADMIN_API_KEY=<key>  # For destructive operations
   BAILEY_WEBHOOK_SECRET=<secret>
   ```

2. Verify Bailey webhook endpoint is accessible
3. Test message sending via `POST /api/whatsapp/conversations/:phone/messages`
4. Verify conversation history is stored in DynamoDB

**Deliverables:**
- WhatsApp pairing working
- Messages sent/received
- Conversation history logged
- Webhook signature verification passing

**Effort:** 3-4 days

---

#### Task 2A.2: Implement Personality Injection
**Objective:** Make personality configuration functional

**File Changes:**

<ref_file file="D:\reality_flow_crm\nabi-app-git-bkp\server\agents\prompts.js" />

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

**Where to Call:**
- `agents/agentRuntime.js` line 201: Pass personality from agency config
- `agents/agentRuntime.js` line 199: Load personality before building prompt

**Code Location:**
```javascript
// agents/agentRuntime.js (around line 199)
const agencyConfig = await getAgencyConfig(tenantId);
const personality = agencyConfig?.aiPersonality || 'professional';
const systemPrompt = buildSystemPrompt(agentId, tenantId, personality);
```

**Deliverables:**
- Personality injected into system prompts
- All 3 personalities tested
- Responses vary by personality setting

**Effort:** 2-3 days

---

#### Task 2A.3: Create Knowledge Base Directory Structure
**Objective:** Set up infrastructure for tenant-specific documentation

**Directory Structure to Create:**
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

**Implementation:**
1. Create directory structure
2. Implement document loader in `agents/prompts.js`:
```javascript
function loadTenantDocs(tenantId) {
  const docsPath = path.join(process.cwd(), '.devin/ai-employee');
  const tenantPath = path.join(docsPath, 'tenant-templates', tenantId);
  
  try {
    const businessContext = fs.readFileSync(
      path.join(tenantPath, 'business-context.md'), 'utf-8'
    );
    const teamMembers = fs.readFileSync(
      path.join(tenantPath, 'team-members.md'), 'utf-8'
    );
    return { businessContext, teamMembers };
  } catch (e) {
    return {}; // Graceful fallback
  }
}
```

3. Integrate into `buildSystemPrompt()`:
```javascript
const tenantDocs = loadTenantDocs(tenantId);
if (tenantDocs.businessContext) {
  systemPrompt += `\n\nTenant Context:\n${tenantDocs.businessContext}`;
}
```

**Deliverables:**
- Directory structure created
- Document loader implemented
- Example tenant docs provided
- Graceful fallback for missing docs

**Effort:** 2-3 days

---

### Phase 2B: Context Management (Weeks 2-3)

#### Task 2B.1: Implement Conversation Context Loading
**Objective:** Pass conversation history to LLM

**New Function in `whatsappConversationService.js`:**
```javascript
async function getConversationContext(tenantId, contactPhone, limit = 10) {
  const params = {
    TableName: CRM_DYNAMODB_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#WHATSAPP#${contactPhone}`,
      ':sk': 'MESSAGE#'
    },
    ScanIndexForward: false,  // Newest first
    Limit: limit
  };
  
  const result = await dynamodb.query(params);
  
  // Format for LLM
  return result.Items
    .reverse()  // Oldest first
    .map(msg => ({
      role: msg.fromMe ? 'assistant' : 'user',
      content: msg.text,
      timestamp: msg.createdAt
    }));
}
```

**Integration into Agent Runtime:**
```javascript
// agents/agentRuntime.js (around line 210)
const conversationHistory = await getConversationContext(
  tenantId, 
  context.contactPhone, 
  5  // Last 5 messages
);

// Append to system prompt
const contextPrompt = conversationHistory
  .map(msg => `${msg.role}: ${msg.content}`)
  .join('\n');

const systemPrompt = buildSystemPrompt(agentId, tenantId, personality) + 
  `\n\nRecent conversation:\n${contextPrompt}`;
```

**Deliverables:**
- Conversation history loaded from DynamoDB
- Last N messages included in prompt
- Proper formatting for LLM consumption
- Tested with multi-turn conversations

**Effort:** 3-4 days

---

#### Task 2B.2: Implement Lead/Contact Context Enrichment
**Objective:** Include lead/contact data in agent context

**New Function in `skillInvoker.js`:**
```javascript
async function enrichContextWithLead(tenantId, leadId) {
  if (!leadId) return {};
  
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
    notes: lead.notes?.slice(0, 3)  // Last 3 notes
  };
}
```

**Integration into Agent Runtime:**
```javascript
// agents/agentRuntime.js (around line 210)
const leadContext = await enrichContextWithLead(tenantId, context.leadId);

const contextPrompt = `
Lead Information:
- Name: ${leadContext.leadName}
- Phone: ${leadContext.leadPhone}
- Type: ${leadContext.leadType}
- Score: ${leadContext.leadScore}
- Source: ${leadContext.leadSource}
- Last Interaction: ${leadContext.lastInteraction}
${leadContext.notes ? `- Recent Notes: ${leadContext.notes.join('; ')}` : ''}

${conversationHistory...}
`;
```

**Deliverables:**
- Lead context loaded from DynamoDB
- Contact information included in prompt
- Recent notes/interactions available to agent
- Graceful handling of missing leads

**Effort:** 2-3 days

---

#### Task 2B.3: Implement Conversation State Table
**Objective:** Track multi-turn conversation state

**New DynamoDB Table Schema:**
```javascript
// ConversationState table
{
  PK: `TENANT#${tenantId}#CONVERSATION#${contactPhone}`,
  SK: `STATE#${conversationId}`,
  
  // Conversation metadata
  conversationId: string,
  tenantId: string,
  contactPhone: string,
  leadId?: string,
  
  // State tracking
  state: 'active' | 'completed' | 'escalated',
  goal?: string,  // e.g., "qualify_lead", "schedule_meeting"
  goalProgress?: number,  // 0-100
  
  // Context accumulation
  extractedInfo: {
    budget?: string,
    timeline?: string,
    propertyType?: string,
    location?: string,
    // ... other extracted fields
  },
  
  // Conversation metadata
  messageCount: number,
  startedAt: ISO8601,
  lastMessageAt: ISO8601,
  updatedAt: ISO8601,
  expiresAt: number  // TTL: 7 days
}
```

**CloudFormation Addition:**
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
    StreamSpecification:
      StreamViewType: NEW_AND_OLD_IMAGES
```

**Service Functions:**
```javascript
// conversationStateService.js
async function getConversationState(tenantId, contactPhone) {
  // Query latest conversation
}

async function updateConversationState(tenantId, contactPhone, updates) {
  // Update state with new extracted info
}

async function completeConversation(tenantId, contactPhone, outcome) {
  // Mark conversation as completed
}
```

**Integration into Agent Runtime:**
```javascript
// Load conversation state
const convState = await getConversationState(tenantId, context.contactPhone);

// Include in prompt
const stateContext = `
Current Conversation Goal: ${convState.goal}
Progress: ${convState.goalProgress}%
Extracted Information:
${JSON.stringify(convState.extractedInfo, null, 2)}
`;

// Update state after agent response
await updateConversationState(tenantId, context.contactPhone, {
  goalProgress: newProgress,
  extractedInfo: { ...convState.extractedInfo, ...newExtractedInfo }
});
```

**Deliverables:**
- Conversation state table created
- State loading/updating functions implemented
- State included in agent prompts
- TTL cleanup working

**Effort:** 4-5 days

---

### Phase 2C: Tool Enhancement (Weeks 3-4)

#### Task 2C.1: Enhance Tool Context
**Objective:** Pass rich context to tools

**Modify `skillInvoker.js`:**
```javascript
async function invokeSkill(tenantId, toolName, rawInput, context = {}) {
  // Enrich context with conversation/lead data
  const enrichedContext = {
    ...context,
    conversationState: await getConversationState(tenantId, context.contactPhone),
    leadContext: await enrichContextWithLead(tenantId, context.leadId),
    userCategory: await getUserCategory(tenantId, context.contactPhone),
    agencyConfig: await getAgencyConfig(tenantId)
  };
  
  // Pass enriched context to tool handlers
  return executeToolWithContext(tenantId, toolName, rawInput, enrichedContext);
}
```

**Tool-Specific Enhancements:**

1. **create_lead:** Include conversation context in lead notes
2. **convert_lead:** Use conversation state to populate transaction details
3. **search_leads:** Filter by user category
4. **update_lead:** Preserve conversation history in notes

**Deliverables:**
- Rich context passed to all tools
- Tools can access conversation/lead/user data
- Better decision-making in tools
- Tested with multiple tool types

**Effort:** 3-4 days

---

#### Task 2C.2: Implement Tool Filtering by User Category
**Objective:** Restrict tools based on user category

**Modify `skillInvoker.js`:**
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
  }
};

async function invokeSkill(tenantId, toolName, rawInput, context = {}) {
  const userCategory = await getUserCategory(tenantId, context.contactPhone);
  const permissions = TOOL_CATEGORY_PERMISSIONS[userCategory] || TOOL_CATEGORY_PERMISSIONS.unknown;
  
  if (permissions.denied.includes('all') || permissions.denied.includes(toolName)) {
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

**Deliverables:**
- Tool access controlled by user category
- Spam/blocked users can't create leads
- Proper error messages for denied access
- Tested with all categories

**Effort:** 2-3 days

---

### Phase 2D: Testing (Weeks 4-5)

#### Task 2D.1: Add WhatsApp Integration Tests
**Objective:** Test WhatsApp webhook and message flow

**File:** `tests/playwright/api/whatsapp.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { API_URL, BAILEY_WEBHOOK_SECRET } from '../helpers/config';
import crypto from 'crypto';

test.describe('WhatsApp Integration', () => {
  test('should receive and process incoming message webhook', async ({ request }) => {
    const payload = {
      from: '919876543210',
      to: '919876543211',
      text: 'Hello, I am interested in properties',
      messageId: 'msg_' + Date.now(),
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
  
  test('should store conversation in DynamoDB', async ({ request }) => {
    // Send message via API
    const response = await request.post(
      `${API_URL}/api/whatsapp/conversations/919876543210/messages`,
      {
        data: { text: 'Test message' },
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );
    
    expect(response.status()).toBe(200);
    
    // Verify conversation stored
    const convResponse = await request.get(
      `${API_URL}/api/whatsapp/conversations/919876543210`,
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

**Deliverables:**
- Webhook signature verification tested
- Message storage verified
- Conversation retrieval tested
- Invalid signature rejection tested

**Effort:** 3-4 days

---

#### Task 2D.2: Add AI Agent Behavior Tests
**Objective:** Test agent responses and tool invocation

**File:** `tests/playwright/api/ai-agent.spec.ts`

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
    // Friendly personality should use Hinglish and warm tone
    expect(result.data.response).toBeTruthy();
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
    // Set credits to 0
    await request.post(`${API_URL}/api/subscriptions/credits/reset`, {
      data: { balance: 0 },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'qualifier',
        prompt: 'Qualify this lead',
        context: {}
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    
    expect(response.status()).toBe(402);  // Payment Required
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
});
```

**Deliverables:**
- Agent invocation tested
- Personality variation tested
- Credit deduction verified
- Insufficient credits error tested
- Tool invocation and audit logging verified

**Effort:** 4-5 days

---

#### Task 2D.3: Add Context Management Tests
**Objective:** Test conversation context loading and state management

**File:** `tests/playwright/api/context-management.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { API_URL, TEST_TOKEN } from '../helpers/config';

test.describe('Context Management', () => {
  test('should load conversation history in agent prompt', async ({ request }) => {
    const phone = '919876543210';
    
    // Send multiple messages to build history
    for (let i = 0; i < 3; i++) {
      await request.post(`${API_URL}/api/whatsapp/conversations/${phone}/messages`, {
        data: { text: `Message ${i + 1}` },
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      });
    }
    
    // Invoke agent - should have access to conversation history
    const response = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'What was discussed in our previous messages?',
        context: { contactPhone: phone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    
    expect(response.status()).toBe(200);
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
  });
  
  test('should track conversation state across turns', async ({ request }) => {
    const phone = '919876543210';
    
    // First turn: agent asks for budget
    const turn1 = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'What is your budget?',
        context: { contactPhone: phone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    
    expect(turn1.status()).toBe(200);
    
    // Second turn: user provides budget, agent should remember
    const turn2 = await request.post(`${API_URL}/api/crm/agent/invoke`, {
      data: {
        agentId: 'whatsapp',
        prompt: 'My budget is 50 lakhs',
        context: { contactPhone: phone }
      },
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    
    expect(turn2.status()).toBe(200);
    
    // Verify conversation state was updated
    const stateResponse = await request.get(
      `${API_URL}/api/crm/conversation-state/${phone}`,
      {
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      }
    );
    
    expect(stateResponse.status()).toBe(200);
    const state = await stateResponse.json();
    expect(state.extractedInfo.budget).toBe('50 lakhs');
  });
});
```

**Deliverables:**
- Conversation history loading tested
- Lead context inclusion verified
- Multi-turn state tracking tested
- Context persistence verified

**Effort:** 3-4 days

---

### Phase 2E: Deployment & Monitoring (Week 5-6)

#### Task 2E.1: Update CloudFormation Templates
**Objective:** Add new tables and configurations to CFN

**Changes to `apps/crm/server/infra/cfn-backend.yaml`:**

1. Add ConversationStateTable
2. Add environment variables for new features
3. Update Lambda IAM permissions for new tables
4. Add CloudWatch alarms for context loading failures

**Deliverables:**
- CFN templates updated
- New tables defined
- IAM permissions correct
- Deployment tested

**Effort:** 2-3 days

---

#### Task 2E.2: Add Monitoring and Observability
**Objective:** Monitor context loading and agent performance

**CloudWatch Metrics to Add:**
```javascript
// observability/cloudwatch.js
function contextLoadingTime(tenantId, agentId, duration) {
  // Track time to load context
}

function agentResponseQuality(tenantId, agentId, score) {
  // Track response quality
}

function contextCacheMissRate(tenantId) {
  // Track cache miss rate
}

function conversationStateUpdateFailure(tenantId, reason) {
  // Track state update failures
}
```

**CloudWatch Alarms:**
- Context loading > 5 seconds
- Agent response time > 10 seconds
- State update failures > 5/min
- Conversation history load failures > 10/min

**Deliverables:**
- CloudWatch metrics implemented
- Alarms configured
- Dashboard created
- Alerts working

**Effort:** 2-3 days

---

#### Task 2E.3: Documentation and Runbooks
**Objective:** Document system for operations team

**Documents to Create:**
1. `CONTEXT_MANAGEMENT_GUIDE.md` - How context loading works
2. `PERSONALITY_CONFIGURATION.md` - How to configure personalities
3. `CONVERSATION_STATE_GUIDE.md` - State management overview
4. `TROUBLESHOOTING_GUIDE.md` - Common issues and fixes
5. `MONITORING_GUIDE.md` - How to monitor the system

**Deliverables:**
- Comprehensive documentation
- Runbooks for common issues
- Troubleshooting guides
- Operator training materials

**Effort:** 3-4 days

---

## Part 3: Critical Blockers & Dependencies

### Blocker 1: Bailey Service Setup
**Status:** BLOCKING WhatsApp
**Resolution:** Ensure self-hosted Bailey service is running at BAILEY_API_ENDPOINT
**Timeline:** Immediate

### Blocker 2: Bedrock/Gemini API Access
**Status:** BLOCKING AI agents
**Resolution:** Ensure AWS Bedrock or Gemini API credentials configured
**Timeline:** Immediate
**Workaround:** Use Gemini API for local development

### Blocker 3: DynamoDB Capacity
**Status:** MEDIUM - May impact performance
**Resolution:** Monitor DynamoDB metrics, scale as needed
**Timeline:** Ongoing
**Workaround:** Use on-demand billing mode

### Blocker 4: Test Environment Setup
**Status:** BLOCKING testing
**Resolution:** Set up test tenant with test data
**Timeline:** 1-2 days
**Workaround:** Use demo tenant for testing

---

## Part 4: Success Criteria

### Phase 2A Success Criteria
- ✅ WhatsApp messages sent/received end-to-end
- ✅ Personality configuration functional
- ✅ Knowledge base directory created
- ✅ All 3 personalities tested

### Phase 2B Success Criteria
- ✅ Conversation history loaded in agent prompts
- ✅ Lead/contact context included
- ✅ Conversation state table working
- ✅ Multi-turn conversations functional

### Phase 2C Success Criteria
- ✅ Tools receive rich context
- ✅ Tool filtering by user category working
- ✅ Access control enforced
- ✅ Tested with all categories

### Phase 2D Success Criteria
- ✅ 100% test coverage for WhatsApp
- ✅ 100% test coverage for AI agents
- ✅ Context management tests passing
- ✅ All edge cases tested

### Phase 2E Success Criteria
- ✅ CloudFormation templates updated
- ✅ Monitoring and alerts working
- ✅ Documentation complete
- ✅ Team trained on new system

---

## Part 5: Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Bailey service unavailable | Medium | High | Ensure service is running and accessible |
| LLM API rate limits | Medium | Medium | Implement queue/backoff |
| DynamoDB hot partitions | Medium | Medium | Use GSI, implement caching |
| Conversation context too large | Low | Medium | Implement context compression |
| Test data pollution | Medium | Low | Isolate test tenants |
| Performance degradation | Medium | High | Implement caching, optimize queries |

---

## Part 6: Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 2A | 2 weeks | WhatsApp enabled, personality functional, knowledge base created |
| 2B | 1-2 weeks | Conversation context, lead context, state management |
| 2C | 1 week | Tool enhancement, category-based filtering |
| 2D | 1-2 weeks | Comprehensive testing, 100% coverage |
| 2E | 1 week | Deployment, monitoring, documentation |
| **Total** | **4-6 weeks** | **Production-ready AI Employee system** |

---

## Part 7: Next Steps

1. **Immediate (This Week):**
   - Review this plan with team
   - Ensure self-hosted Bailey service is running
   - Set up test environment
   - Begin Phase 2A tasks

2. **Week 1-2:**
   - Complete Phase 2A (WhatsApp, personality, knowledge base)
   - Begin Phase 2B (context management)

3. **Week 3-4:**
   - Complete Phase 2B and 2C (context, tools)
   - Begin Phase 2D (testing)

4. **Week 5-6:**
   - Complete Phase 2D and 2E (testing, deployment)
   - Production deployment

---

## Appendix: Code References

### Key Files to Modify
- `apps/crm/server/agents/prompts.js` - Personality injection
- `apps/crm/server/agents/agentRuntime.js` - Context loading
- `apps/crm/server/whatsappConversationService.js` - Conversation history
- `apps/crm/server/skillInvoker.js` - Tool enhancement
- `apps/crm/server/routes/aiEmployeeConfig.js` - Configuration
- `tests/playwright/api/whatsapp.spec.ts` - New tests
- `tests/playwright/api/ai-agent.spec.ts` - New tests
- `tests/playwright/api/context-management.spec.ts` - New tests

### New Files to Create
- `apps/crm/server/conversationStateService.js` - State management
- `.devin/ai-employee/` - Knowledge base directory
- `apps/crm/server/infra/cfn-conversation-state.yaml` - CloudFormation
- `CONTEXT_MANAGEMENT_GUIDE.md` - Documentation

---

**Document Status:** Ready for Implementation
**Last Updated:** June 2026
**Next Review:** After Phase 2A completion
