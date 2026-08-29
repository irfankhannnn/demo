# Quick Start Guide - Phase 2 Implementation
**For:** Development Team  
**Purpose:** Get up to speed on the AI Employee system and Phase 2 roadmap  
**Time to Read:** 10 minutes

---

## High-Level Goal (Plain English)

**What this document is:** This is a quick reference guide for developers who want to start working on Phase 2 without reading all the detailed documentation. It explains the current state, the 3 main problems we're fixing, and how to get started quickly.

**Why it matters:** The detailed implementation plan is comprehensive but can be overwhelming if you just want to start coding. This guide gives you the essentials in 10 minutes - what's broken, how to fix it, and what files to modify. It's like a "cheat sheet" or "quick start" guide that gets you productive immediately.

**In simple terms:** Think of this like the "Getting Started" section of a manual. Instead of reading the whole book, you just read the first chapter to understand the basics and start working. This document gives you the minimum viable information to begin implementation without getting bogged down in details.

---

## What You Need to Know

### Current State (70% Complete)
The AI Employee system is **mostly built** but **disabled by default**:
- ✅ WhatsApp integration exists (Bailey.js)
- ✅ Agent runtime exists (Bedrock + Gemini)
- ✅ Credit metering works
- ✅ Audit logging works
- ❌ **Conversation context missing** (CRITICAL)
- ❌ **Personality not injected** (HIGH)
- ❌ **Tests incomplete** (CRITICAL)

### Why It's Disabled
Two environment variables control everything:
```bash
BAILEY_ENABLED=false        # WhatsApp disabled
AGENTS_ENABLED=false        # AI agents disabled
```

To enable: Set both to `true` in `.env`

---

## The 3 Critical Gaps

### Gap 1: No Conversation Context (CRITICAL)
**Problem:** Agent can't see previous messages

**Example:**
```
User: "I'm looking for a 2BHK apartment"
Agent: "What's your budget?"
User: "50 lakhs"
Agent: "What's your budget?" ← REPEATS QUESTION (no context!)
```

**Solution:** Load last N messages from WhatsApp conversation into agent prompt

**File to Modify:** `server/agents/agentRuntime.js` (line 210)

**Effort:** 3-4 days

---

### Gap 2: Personality Not Used (HIGH)
**Problem:** User sets personality, but it's ignored

**Example:**
```
User sets: "friendly" personality
Agent response: "Property details: 2BHK, 50L, Bandra" ← ROBOTIC
Should be: "Hey! Found a nice 2BHK in Bandra for 50L. Interested?" ← FRIENDLY
```

**Solution:** Create personality-specific prompts and inject into system prompt

**File to Modify:** `server/agents/prompts.js` (line 80-96)

**Effort:** 2-3 days

---

### Gap 3: No Testing (CRITICAL)
**Problem:** WhatsApp and AI features untested

**Current Tests:**
- 189 tests exist (E2E + API)
- 0 WhatsApp tests
- 1 AI test (only page load)

**Solution:** Add comprehensive tests for WhatsApp and AI behavior

**Files to Create:**
- `tests/playwright/api/whatsapp.spec.ts`
- `tests/playwright/api/ai-agent.spec.ts`
- `tests/playwright/api/context-management.spec.ts`

**Effort:** 4-5 days

---

## Phase 2 Roadmap (4-6 Weeks)

### Phase 2A: Foundation (2 weeks)
1. Enable WhatsApp integration
2. Implement personality injection
3. Create knowledge base directory

### Phase 2B: Context (1-2 weeks)
1. Load conversation history
2. Include lead/contact context
3. Implement conversation state table

### Phase 2C: Tools (1 week)
1. Pass rich context to tools
2. Filter tools by user category
3. Enforce access control

### Phase 2D: Testing (1-2 weeks)
1. WhatsApp integration tests
2. AI agent behavior tests
3. Context management tests

### Phase 2E: Production (1 week)
1. Update CloudFormation
2. Add monitoring/alerts
3. Complete documentation

---

## How to Get Started

### Step 1: Read the Full Documents
1. `CODEBASE_ANALYSIS_SUMMARY.md` - Complete architecture overview
2. `IMPLEMENTATION_PLAN_PHASE_2.md` - Detailed implementation roadmap

### Step 2: Set Up Environment
```bash
# Clone the repo
cd nabi-app-git-bkp

# Install dependencies
npm install

# Copy environment file
cp server/.env.example server/.env

# Update .env with your credentials
# BAILEY_ENABLED=true
# BAILEY_MODE=selfhosted
# BAILEY_API_ENDPOINT=http://localhost:3003  # Your Bailey service
# AGENTS_ENABLED=true
# BEDROCK_MODEL_ID=<your-model>
```

### Step 3: Start Phase 2A
1. **Task 2A.1:** Enable WhatsApp (3-4 days)
   - Set `BAILEY_ENABLED=true`
   - Test message sending
   - Verify webhook signature

2. **Task 2A.2:** Implement personality (2-3 days)
   - Modify `server/agents/prompts.js`
   - Add personality-specific templates
   - Test all 3 personalities

3. **Task 2A.3:** Create knowledge base (2-3 days)
   - Create `.devin/ai-employee/` directory
   - Add document loader
   - Implement graceful fallback

### Step 4: Run Tests
```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- tests/playwright/api/whatsapp.spec.ts

# Run with UI
npm run test -- --ui
```

---

## Key Code Locations

### Agent System
```
server/agents/
├── agentRuntime.js      ← Main agent execution (line 201)
├── prompts.js           ← System prompts (line 80-96)
└── agentAuditService.js ← Audit logging
```

### WhatsApp
```
server/
├── bailey.js                        ← Bailey integration
├── whatsappConversationService.js   ← Conversation storage
└── routes/webhooks.js               ← Webhook handler
```

### Tools
```
server/
├── skillInvoker.js      ← 22 CRM tools
└── agents/agentRuntime.js (line 150-192) ← Tool invocation loop
```

### Configuration
```
server/
├── agencyConfigService.js           ← Agency settings
└── routes/aiEmployeeConfig.js       ← Config endpoints
```

---

## Environment Variables You Need

### WhatsApp (Bailey)
```bash
BAILEY_ENABLED=true
BAILEY_MODE=selfhosted
BAILEY_API_ENDPOINT=http://localhost:3003  # Your Bailey service
BAILEY_API_KEY=<your-key>      # Optional but recommended for auth
BAILEY_ADMIN_API_KEY=<your-key>  # For destructive operations
BAILEY_WEBHOOK_SECRET=<secret>
```

### AI Agents
```bash
AGENTS_ENABLED=true
LLM_PROVIDER=bedrock            # or gemini
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
GEMINI_API_KEY=<your-key>
AGENT_ACTION_CREDITS=15
AI_EMPLOYEE_ROLLOUT_PERCENTAGE=100
```

### Database
```bash
CRM_DYNAMODB_TABLE_NAME=real-estate-crm
AGENT_AUDIT_TABLE_NAME=cloudberry-real-estate-agent-audit
CREDITS_TABLE_NAME=cloudberry-real-estate-credits
USER_CATEGORIES_TABLE_NAME=cloudberry-real-estate-user-categories
```

---

## Common Issues & Fixes

### Issue 1: "BAILEY_ENABLED is false"
**Fix:** Set `BAILEY_ENABLED=true` in `.env`

### Issue 2: "Agent returns empty response"
**Fix:** Check `AGENTS_ENABLED=true` and credits balance > 15

### Issue 3: "Webhook signature verification failed"
**Fix:** Ensure `BAILEY_WEBHOOK_SECRET` matches Bailey configuration

### Issue 4: "No conversation history in agent prompt"
**Fix:** This is expected in Phase 1. Implement Phase 2B to fix.

### Issue 5: "Personality setting ignored"
**Fix:** This is expected in Phase 1. Implement Phase 2A to fix.

---

## Testing Checklist

### Before Phase 2A
- [ ] Read CODEBASE_ANALYSIS_SUMMARY.md
- [ ] Read IMPLEMENTATION_PLAN_PHASE_2.md
- [ ] Set up test environment
- [ ] Verify self-hosted Bailey service is running
- [ ] Verify Bedrock/Gemini credentials work

### After Phase 2A
- [ ] WhatsApp messages send/receive
- [ ] Personality configuration works
- [ ] All 3 personalities tested
- [ ] Knowledge base directory created

### After Phase 2B
- [ ] Conversation history loads
- [ ] Lead context included
- [ ] Multi-turn conversations work
- [ ] Conversation state persists

### After Phase 2C
- [ ] Tools receive rich context
- [ ] Category-based filtering works
- [ ] Access control enforced
- [ ] All categories tested

### After Phase 2D
- [ ] 100% WhatsApp test coverage
- [ ] 100% AI agent test coverage
- [ ] Context management tests pass
- [ ] All edge cases tested

### After Phase 2E
- [ ] CloudFormation updated
- [ ] Monitoring alerts working
- [ ] Documentation complete
- [ ] Team trained

---

## Success Metrics

### Phase 2A Success
- ✅ WhatsApp messages working end-to-end
- ✅ Personality setting affects response tone
- ✅ Knowledge base directory created
- ✅ No errors in CloudWatch logs

### Phase 2B Success
- ✅ Agent references previous messages
- ✅ Lead context visible in responses
- ✅ Multi-turn conversations work
- ✅ Conversation state persists

### Phase 2C Success
- ✅ Tools have rich context
- ✅ Spam users can't create leads
- ✅ Category-based access control works
- ✅ No unauthorized tool access

### Phase 2D Success
- ✅ 100% test coverage for WhatsApp
- ✅ 100% test coverage for AI agents
- ✅ All context tests passing
- ✅ No regressions in existing tests

### Phase 2E Success
- ✅ CloudFormation deploys cleanly
- ✅ CloudWatch metrics visible
- ✅ Alerts trigger correctly
- ✅ Team can operate system

---

## Quick Reference: File Changes

### Phase 2A Changes
```
server/agents/prompts.js          ← Add personality templates
server/agents/agentRuntime.js     ← Inject personality
.devin/ai-employee/               ← Create directory
```

### Phase 2B Changes
```
server/agents/agentRuntime.js     ← Load conversation history
server/whatsappConversationService.js  ← Add context function
server/conversationStateService.js     ← Create new file
server/infra/cfn-backend.yaml     ← Add ConversationState table
```

### Phase 2C Changes
```
server/skillInvoker.js            ← Enhance context
server/agents/agentRuntime.js     ← Pass rich context
server/whatsappAccessControl.js   ← Tool filtering
```

### Phase 2D Changes
```
tests/playwright/api/whatsapp.spec.ts              ← Create new
tests/playwright/api/ai-agent.spec.ts              ← Create new
tests/playwright/api/context-management.spec.ts    ← Create new
```

### Phase 2E Changes
```
server/infra/cfn-backend.yaml     ← Update parameters
observability/cloudwatch.js       ← Add metrics
CONTEXT_MANAGEMENT_GUIDE.md       ← Create documentation
```

---

## Next Steps

1. **This Week:**
   - Read both analysis documents
   - Ensure self-hosted Bailey service is running
   - Set up test environment
   - Begin Phase 2A

2. **Week 1-2:**
   - Complete Phase 2A tasks
   - Begin Phase 2B tasks

3. **Week 3-4:**
   - Complete Phase 2B and 2C
   - Begin Phase 2D testing

4. **Week 5-6:**
   - Complete Phase 2D and 2E
   - Deploy to production

---

## Questions?

Refer to:
- `CODEBASE_ANALYSIS_SUMMARY.md` - Architecture overview
- `IMPLEMENTATION_PLAN_PHASE_2.md` - Detailed implementation guide
- Code comments in `server/agents/` - Implementation details

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 2026  
**Next Review:** After Phase 2A completion
