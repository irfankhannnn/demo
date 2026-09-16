# RealtyFlow Context & Memory Management: Comprehensive Improvement Design

**Document Version:** 1.0  
**Date:** January 2025  
**Status:** Technical Design (Ready for Implementation Planning)  
**Scope:** Context envelope design, session management, conversation summarization, memory persistence, and multi-turn coherence

---

## Executive Summary

RealtyFlow's current context and memory management (score: 5/10 vs OpenClaw's 9/10) suffers from:
- **Weak context envelope** (7 fields vs OpenClaw's 20+)
- **No session key concept** (limits multi-agent routing and DM collapsing)
- **Basic conversation history** (last 5-10 messages, no summarization)
- **No quoted reply support** (breaks context chains)
- **Limited tenant context injection** (no per-tenant preferences, timezone, business hours)
- **No context window optimization** (can exceed LLM limits)
- **Poor multi-turn coherence** (agent loses context after 5+ turns)

This design proposes a **phased 6-month roadmap** to implement:
1. **Enhanced context envelope** with 25+ fields
2. **Session key grammar** for flexible routing
3. **Conversation summarization** with compaction
4. **Persistent memory layer** with retrieval
5. **Tenant context injection** system
6. **Context window optimization** with smart truncation
7. **Multi-turn coherence** improvements
8. **Backward compatibility** strategy

**Expected Impact:**
- 40% reduction in context-related hallucinations
- 60% improvement in multi-turn conversation coherence
- 35% reduction in LLM token usage
- Support for multi-agent routing and group chats
- Improved tenant-specific personalization

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Context Envelope Design](#context-envelope-design)
3. [Session Key Grammar & Routing](#session-key-grammar--routing)
4. [Conversation Summarization](#conversation-summarization)
5. [Memory Persistence & Retrieval](#memory-persistence--retrieval)
6. [Tenant Context Injection](#tenant-context-injection)
7. [Context Window Optimization](#context-window-optimization)
8. [Multi-Turn Coherence](#multi-turn-coherence)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Migration Strategy](#migration-strategy)
11. [Testing Strategy](#testing-strategy)
12. [Risk Assessment](#risk-assessment)
13. [Effort Estimation](#effort-estimation)

---

## 1. Current State Analysis

### 1.1 Existing Context Management

**Current Implementation (conversationStateService.js):**
- 7 core fields: tenantId, contactPhone, status, intent, topic, messageCount, context
- 24-hour TTL for conversation state
- Basic message history (5-10 messages from DynamoDB)
- No message summarization or compaction
- No quoted reply tracking
- No media/location support

**Current Agent Context (agentRuntime.js):**
- System prompt with tenant personality
- Last N messages as conversation history
- 22 static tools with hardcoded schemas
- No session key concept
- No multi-agent routing
- No group chat support
- Response sanitization to strip leaked reasoning

### 1.2 OpenClaw Reference Architecture

**OpenClaw's Inbound Envelope (20+ fields):**
- Body variants: Body, BodyForAgent, RawBody, CommandBody
- Reply context: ReplyToId, ReplyToBody, ReplyToSender
- Media: MediaPath, MediaUrl, MediaType
- Group: GroupSubject, GroupMembers, ChatType
- Sender: SenderName, SenderId, SenderE164
- Routing: SessionKey, AccountId, MessageSid
- Security: CommandAuthorized, WasMentioned
- Metadata: Location, Provider, Surface, OriginatingChannel
- Streaming: Buffered block dispatcher, model callbacks

### 1.3 Gap Analysis

| Dimension | Current | OpenClaw | Gap | Impact |
|-----------|---------|----------|-----|--------|
| Context fields | 7 | 20+ | -13 | Lost context, poor routing |
| Body variants | 1 | 4 | -3 | No command/reply distinction |
| Reply support | None | Full | -1 | Broken context chains |
| Media support | None | Full | -1 | Can't handle rich content |
| Group support | Blocked | Full | -1 | No group chat capability |
| Session keys | None | Flexible | -1 | No multi-agent routing |
| Message history | 5-10 msgs | Summarized | -1 | Context window overflows |
| Tenant context | Basic | Rich | -1 | Poor personalization |
| **Total Score** | **5/10** | **9/10** | **-4/10** | **Critical gaps** |

---

## 2. Context Envelope Design

### 2.1 Enhanced MsgContext Structure

The new `MsgContext` interface replaces simple message strings with a rich context envelope containing 25+ fields organized into logical sections.

**Key Sections:**
- **Core Message:** raw, forAgent, original, command
- **Reply Context:** replyTo with full message chain
- **Media & Attachments:** images, videos, documents, locations
- **Sender Identity:** name, phone, category, linked CRM entity
- **Group Context:** group ID, members, mentions
- **Routing & Session:** sessionKey, tenantId, accountId, messageId
- **Security & Authorization:** command auth, allowlist, blocklist, rate limits
- **Channel Metadata:** type, provider, surface, originating channel
- **Conversation State:** intent, topic, status, labels
- **Tenant Context:** timezone, business hours, personality, preferences, features
- **Conversation History:** previous messages (full or summarized)
- **Metadata:** version, creation time, token count, truncation status

### 2.2 Body Variants Processing

**Processing Pipeline:**
1. Extract body variants (raw, forAgent, original, command)
2. Detect if message is a command (e.g., `/create_lead`)
3. Redact PII (phone, email, Aadhaar, PAN)
4. Normalize whitespace and abbreviations
5. Expand currency notation (80L -> 8000000)
6. Normalize property terms (2BHK -> 2 bedroom apartment)

**BodyForAgent Cleaning Rules:**
- Redact PII: phone numbers, emails, Aadhaar, PAN
- Normalize whitespace
- Optionally remove emojis
- Expand abbreviations
- Normalize currency and property terms
- Preserve original in `raw` field for audit

### 2.3 Reply Context Detection

**Quoted Reply Support:**
- Track `replyToId`, `replyToBody`, `replyToSender`
- Enable context chains for multi-turn conversations
- Prevent context loss when user replies to old messages
- Support for group mentions and @replies

---

## 3. Session Key Grammar & Routing

### 3.1 Session Key Format

**Grammar Definition:**
```
SessionKey ::= "SESSION" "#" TenantId "#" Scope "#" ScopeId ["#" SubScope]

Scope ::= "MAIN" | "DM" | "GROUP" | "CHANNEL" | "TEAM"
SubScope ::= "PEER" | "ACCOUNT" | "CHANNEL_PEER" | "ACCOUNT_CHANNEL_PEER"

Examples:
  SESSION#TENANT_001#MAIN#DEFAULT
  SESSION#TENANT_001#DM#+919876543210
  SESSION#TENANT_001#DM#+919876543210#ACCOUNT_CHANNEL_PEER
  SESSION#TENANT_001#GROUP#GROUP_ABC123
  SESSION#TENANT_001#CHANNEL#SALES_TEAM
```

### 3.2 Routing Resolution

**Multi-Level Routing:**
1. **Scope-based:** MAIN -> default agent, DM -> DM agent, GROUP -> group handler
2. **Intent-based:** inquiry -> sales, complaint -> support, booking -> fulfillment
3. **Category-based:** LEAD -> lead agent, CUSTOMER -> customer service
4. **Channel-based:** whatsapp -> whatsapp agent, telegram -> telegram agent
5. **Time-based:** business hours -> day agent, after hours -> night agent
6. **Fallback chain:** if primary unavailable, try secondary, tertiary, etc.

### 3.3 Benefits

- **Flexible DM collapsing:** Can collapse all DMs to single agent or per-peer agents
- **Multi-agent support:** Different agents for different scopes/intents
- **Group chat support:** Dedicated agents for group conversations
- **Team routing:** Route to specific team based on scope
- **Scalability:** Add new agents without changing core logic

---

## 4. Conversation Summarization

### 4.1 Multi-Level Summarization Strategy

**Three Levels:**
1. **Brief:** 2-3 sentences, main request and outcome
2. **Detailed:** 5-7 sentences, context, requests, and outcomes
3. **Executive:** 1 paragraph, business impact and next steps

**Summarization Algorithm:**
1. Extract key information (key points, topics, decisions, actions)
2. Identify entities (leads, properties, locations)
3. Detect sentiment (positive, neutral, negative)
4. Generate summary using LLM
5. Extract key points and entities for indexing

### 4.2 Compaction Strategy

**When to Compact:**
- Message count > 20
- Total tokens > 3000
- Oldest message > 60 minutes old

**Compaction Process:**
1. Keep last 5 recent messages (full)
2. Summarize older messages
3. Create synthetic summary message
4. Return: [summary_message, ...recent_messages]

**Benefits:**
- Reduces context window usage by 40-60%
- Preserves recent context for coherence
- Enables long conversations without token overflow
- Maintains conversation history for retrieval

---

## 5. Memory Persistence & Retrieval

### 5.1 Multi-Layer Memory System

**Three Layers:**
1. **Short-term (24h TTL):** Current conversation messages
   - Storage: DynamoDB with TTL
   - Use: Current turn context
   - Size: ~20 messages

2. **Medium-term (90 days):** Conversation summaries
   - Storage: DynamoDB with TTL
   - Use: Historical context, pattern detection
   - Size: ~10 summaries per contact

3. **Long-term (1 year):** Contact profile & interaction history
   - Storage: DynamoDB with TTL
   - Use: Personalization, preferences, trends
   - Size: 1 profile per contact

4. **Semantic (Indefinite):** Message embeddings for similarity search
   - Storage: Vector database (OpenSearch, Pinecone)
   - Use: Find relevant past interactions
   - Size: All messages indexed

### 5.2 Memory Retrieval

**Retrieval Strategy:**
- Parallel fetch from all layers
- Short-term: last 20 messages
- Medium-term: last 10 summaries
- Long-term: contact profile
- Semantic: top 5 similar past interactions

**Contact Profile (Long-term Memory):**
- Linked CRM entities (lead, buyer, seller, owner, tenant)
- Learned preferences (language, response style, topics)
- Interaction summary (total conversations, messages, response time)
- Topics of interest with frequency
- Known issues and notes

### 5.3 Memory Persistence Operations

**Save Operations:**
- Save message: `saveMessage(tenantId, contactPhone, message)`
- Save summary: `saveSummary(tenantId, contactPhone, summary, conversationId)`
- Save profile: `saveContactProfile(tenantId, contactPhone, profile)`
- Save embedding: `saveEmbedding(tenantId, conversationId, messageId, embedding, content)`

---

## 6. Tenant Context Injection

### 6.1 Tenant Context Structure

**Comprehensive Tenant Context:**
- **Tenant Identity:** ID, name, industry
- **Business Configuration:** timezone, business hours (per day), current status
- **Communication Preferences:** personality, tone, language, response length, emoji usage, Hinglish
- **Operational Context:** currency, date format, number format, area units, metrics
- **Feature Toggles:** per-tenant feature flags with configuration
- **Knowledge Base:** FAQs, response templates, business rules
- **Escalation Rules:** keywords, max retries, escalation agent/email
- **Compliance:** data retention, PII redaction, audit logging, consent
- **Personalization:** track preferences, remember context, suggest relevant

### 6.2 Tenant Context Retrieval & Injection

**Retrieval:**
- Cache with 5-minute TTL
- Fetch from DynamoDB if not cached
- Return default context for new tenants

**Injection into System Prompt:**
- Add tenant context section to system prompt
- Include personality, tone, language, response length
- List available features
- Include business rules and escalation keywords
- Provide timezone and business hours information

**Benefits:**
- Personalized responses per tenant
- Consistent personality across conversations
- Automatic feature gating
- Timezone-aware business hours
- Escalation automation

---

## 7. Context Window Optimization

### 7.1 Token Estimation & Truncation

**Token Limits by Model:**
- Claude 3 Haiku: 8,000 tokens
- Claude 3 Sonnet: 200,000 tokens
- Claude 3 Opus: 200,000 tokens
- Gemini Pro: 30,000 tokens

**Reserved Tokens:**
- System prompt: 1,000 tokens
- Response generation: 1,000 tokens
- Safety margin: 500 tokens
- Available for context: Total - Reserved

**Truncation Strategy:**
1. Estimate tokens for system prompt
2. Estimate tokens for current message
3. Calculate available tokens for history
4. Fetch conversation history
5. If exceeds available tokens:
   - Compact conversation (summarize old messages)
   - If still exceeds, truncate oldest messages
   - If still exceeds, use semantic search for relevant messages only

### 7.2 Smart Truncation

**Truncation Priority:**
1. Keep current message (always)
2. Keep recent messages (last 5)
3. Keep messages with tool calls (important)
4. Keep messages with high sentiment (positive/negative)
5. Keep messages with entities (leads, properties)
6. Truncate oldest messages first

**Compaction Before Truncation:**
- If history > 20 messages, compact first
- Summarize messages older than 60 minutes
- Reduces token usage by 40-60% before truncation

---

## 8. Multi-Turn Coherence

### 8.1 Context Preservation Across Turns

**Current Problem:**
- Agent loses context after 5+ turns
- No memory of earlier decisions
- Repeats questions already answered
- Inconsistent personality

**Solution: Enhanced Context Tracking**

**Per-Turn Context:**
- Current conversation state (intent, topic, status)
- Recent messages (last 5)
- Summarized history (older messages)
- Contact profile (preferences, history)
- Tenant context (personality, rules)

**Conversation State Machine:**
```
States: active -> paused -> resolved
        active -> paused -> active (resume)

Transitions:
- User sends message: active
- No response for 1h: paused
- User sends message after pause: active (resume)
- Issue resolved: resolved
```

**Intent Tracking:**
- Detect intent from first message
- Update intent if user changes topic
- Use intent for routing and context
- Track intent history for patterns

**Topic Tracking:**
- Detect current topic from message
- Update topic as conversation progresses
- Use topic for context and routing
- Track topic history for patterns

### 8.2 Coherence Metrics

**Metrics to Track:**
- **Context Retention:** % of previous context remembered
- **Intent Consistency:** % of messages aligned with detected intent
- **Topic Consistency:** % of messages on same topic
- **Decision Consistency:** % of decisions consistent with earlier decisions
- **Personality Consistency:** % of responses matching tenant personality

**Monitoring:**
- Track metrics per conversation
- Alert if coherence drops below threshold
- Log incoherent responses for analysis
- Improve prompts based on patterns

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Objectives:**
- Implement enhanced MsgContext structure
- Add body variant processing
- Implement session key grammar
- Add basic tenant context injection

**Deliverables:**
- `MsgContext` interface and builder
- `extractBodyVariants()` function
- `buildSessionKey()` and `parseSessionKey()` functions
- `TenantContextManager` class
- Unit tests for all components

**Effort:** 3 weeks (2 engineers)

### Phase 2: Memory Layer (Weeks 5-8)

**Objectives:**
- Implement conversation summarization
- Add memory persistence (short/medium/long-term)
- Implement memory retrieval
- Add semantic search (optional for Phase 2)

**Deliverables:**
- `ConversationSummarizer` class
- `MemoryPersister` class
- `MemoryRetriever` class
- DynamoDB schema updates
- Integration tests

**Effort:** 4 weeks (2 engineers)

### Phase 3: Context Optimization (Weeks 9-12)

**Objectives:**
- Implement context window optimization
- Add token estimation
- Implement smart truncation
- Add conversation compaction

**Deliverables:**
- `ContextWindowOptimizer` class
- Token estimation functions
- Truncation and compaction logic
- Performance benchmarks
- Integration tests

**Effort:** 3 weeks (1-2 engineers)

### Phase 4: Routing & Multi-Agent (Weeks 13-16)

**Objectives:**
- Implement agent routing layer
- Add multi-agent support
- Implement group chat support
- Add routing configuration

**Deliverables:**
- `AgentRouter` class
- `RoutingConfig` interface
- Group chat handling
- Routing configuration UI
- Integration tests

**Effort:** 4 weeks (2 engineers)

### Phase 5: Multi-Turn Coherence (Weeks 17-20)

**Objectives:**
- Implement conversation state machine
- Add intent/topic tracking
- Implement coherence metrics
- Add monitoring and alerting

**Deliverables:**
- Conversation state machine
- Intent/topic detection
- Coherence metrics tracking
- Monitoring dashboard
- Integration tests

**Effort:** 4 weeks (2 engineers)

### Phase 6: Migration & Optimization (Weeks 21-24)

**Objectives:**
- Migrate existing conversations
- Optimize performance
- Add backward compatibility
- Production rollout

**Deliverables:**
- Migration scripts
- Performance optimizations
- Backward compatibility layer
- Rollout plan
- Documentation

**Effort:** 4 weeks (2-3 engineers)

**Total Effort:** 22 weeks, 12-15 engineer-weeks

---

## 10. Migration Strategy

### 10.1 Backward Compatibility

**Compatibility Layer:**
- Support old context format alongside new
- Gradual migration of existing conversations
- Feature flags for new functionality
- Fallback to old behavior if new fails

**Migration Phases:**
1. **Phase 1 (Week 1):** Deploy new code with feature flags OFF
2. **Phase 2 (Week 2-3):** Enable for new conversations only
3. **Phase 3 (Week 4-6):** Migrate existing conversations (batch job)
4. **Phase 4 (Week 7):** Enable for all conversations
5. **Phase 5 (Week 8+):** Remove old code

### 10.2 Data Migration

**Existing Conversation Migration:**
```
For each conversation:
  1. Fetch old message history
  2. Build new MsgContext for each message
  3. Save to new schema
  4. Verify data integrity
  5. Mark as migrated
```

**Rollback Plan:**
- Keep old data for 30 days
- Ability to revert to old schema
- Feature flag to disable new code
- Monitoring for errors

### 10.3 Feature Flags

**Flags to Implement:**
- `ENABLE_NEW_CONTEXT_ENVELOPE` (default: false)
- `ENABLE_SESSION_KEYS` (default: false)
- `ENABLE_CONVERSATION_SUMMARIZATION` (default: false)
- `ENABLE_MEMORY_PERSISTENCE` (default: false)
- `ENABLE_TENANT_CONTEXT_INJECTION` (default: false)
- `ENABLE_CONTEXT_WINDOW_OPTIMIZATION` (default: false)
- `ENABLE_MULTI_AGENT_ROUTING` (default: false)

**Rollout Strategy:**
- Week 1: All flags OFF
- Week 2: Enable for 10% of tenants
- Week 3: Enable for 25% of tenants
- Week 4: Enable for 50% of tenants
- Week 5: Enable for 75% of tenants
- Week 6: Enable for 100% of tenants

---

## 11. Testing Strategy

### 11.1 Unit Tests

**Coverage:**
- MsgContext builder (10 tests)
- Body variant extraction (8 tests)
- Session key grammar (12 tests)
- Tenant context injection (10 tests)
- Conversation summarization (15 tests)
- Memory persistence (12 tests)
- Memory retrieval (10 tests)
- Context window optimization (15 tests)
- Agent routing (12 tests)

**Target Coverage:** >90%

### 11.2 Integration Tests

**Scenarios:**
1. **End-to-end conversation flow:**
   - Receive message -> build context -> route to agent -> get response
   - Verify context is preserved across turns
   - Verify memory is persisted

2. **Multi-turn coherence:**
   - 10-turn conversation
   - Verify agent remembers earlier context
   - Verify intent/topic consistency

3. **Context window optimization:**
   - Long conversation (50+ messages)
   - Verify context is compacted
   - Verify no token overflow

4. **Multi-agent routing:**
   - Different intents route to different agents
   - Different categories route to different agents
   - Fallback chain works

5. **Memory retrieval:**
   - Retrieve short-term memory (current conversation)
   - Retrieve medium-term memory (summaries)
   - Retrieve long-term memory (profile)
   - Semantic search returns relevant messages

### 11.3 Performance Tests

**Benchmarks:**
- Context building: <100ms
- Session key operations: <10ms
- Memory persistence: <200ms
- Memory retrieval: <300ms
- Token estimation: <50ms
- Conversation summarization: <2s
- Agent routing: <50ms

**Load Tests:**
- 1000 concurrent conversations
- 100 messages/second throughput
- Memory usage <500MB per 10k conversations

### 11.4 User Acceptance Tests

**Scenarios:**
1. **Conversation quality:**
   - Agent provides relevant responses
   - Agent remembers context
   - Agent maintains personality

2. **Performance:**
   - Response time <2 seconds
   - No token overflow errors
   - Smooth multi-turn conversations

3. **Reliability:**
   - No data loss
   - Graceful degradation
   - Error recovery

---

## 12. Risk Assessment

### 12.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Token overflow in LLM calls | Medium | High | Context window optimization, compaction, truncation |
| Memory persistence failures | Low | High | Fallback to short-term only, monitoring, alerts |
| Routing logic errors | Medium | Medium | Comprehensive testing, feature flags, gradual rollout |
| Performance degradation | Medium | Medium | Load testing, optimization, caching |
| Data migration issues | Low | High | Dry-run migration, rollback plan, verification |
| Backward compatibility breaks | Low | High | Compatibility layer, feature flags, gradual migration |

### 12.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Increased DynamoDB costs | Medium | Medium | Optimize queries, add caching, TTL cleanup |
| Vector DB costs (semantic search) | Low | Medium | Make semantic search optional, use cheaper provider |
| Increased latency | Medium | Medium | Optimize code, add caching, parallel operations |
| Monitoring gaps | Low | Medium | Comprehensive logging, metrics, alerts |

### 12.3 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| User confusion with new features | Low | Low | Documentation, gradual rollout, support |
| Regression in conversation quality | Low | High | Extensive testing, UAT, monitoring |
| Adoption delays | Medium | Medium | Clear benefits, training, support |

---

## 13. Effort Estimation

### 13.1 Development Effort

| Component | Effort (days) | Engineers | Total (engineer-weeks) |
|-----------|---------------|-----------|----------------------|
| MsgContext & body variants | 10 | 2 | 2.5 |
| Session key grammar & routing | 12 | 2 | 3 |
| Conversation summarization | 15 | 2 | 3.75 |
| Memory persistence & retrieval | 16 | 2 | 4 |
| Tenant context injection | 10 | 1 | 2.5 |
| Context window optimization | 12 | 2 | 3 |
| Multi-agent routing | 14 | 2 | 3.5 |
| Multi-turn coherence | 12 | 2 | 3 |
| Testing & QA | 20 | 2 | 5 |
| Migration & rollout | 16 | 2 | 4 |
| Documentation | 8 | 1 | 2 |
| **Total** | **145 days** | **2-3** | **37 engineer-weeks** |

### 13.2 Timeline

**Realistic Timeline:** 24 weeks (6 months)
- Phase 1: 4 weeks
- Phase 2: 4 weeks
- Phase 3: 4 weeks
- Phase 4: 4 weeks
- Phase 5: 4 weeks
- Phase 6: 4 weeks

**Parallel Work:** Some phases can run in parallel (e.g., testing during development)

**Actual Timeline:** 18-20 weeks with parallel work

### 13.3 Resource Allocation

**Recommended Team:**
- 2-3 backend engineers (full-time)
- 1 QA engineer (full-time)
- 1 DevOps engineer (part-time, for infrastructure)
- 1 Product manager (part-time, for requirements)

**Cost Estimate:**
- Development: 37 engineer-weeks × $3,000/week = $111,000
- Infrastructure: $5,000-10,000 (vector DB, additional DynamoDB capacity)
- Testing: Included in development
- **Total:** $116,000-121,000

---

## 14. Success Metrics

### 14.1 Technical Metrics

- **Context Retention:** >95% of previous context remembered in multi-turn conversations
- **Intent Consistency:** >90% of messages aligned with detected intent
- **Token Efficiency:** 35% reduction in average tokens per conversation
- **Response Latency:** <2 seconds for 99th percentile
- **Error Rate:** <0.1% for context-related errors

### 14.2 Business Metrics

- **Conversation Quality:** +40% improvement in user satisfaction
- **Resolution Rate:** +25% improvement in first-turn resolution
- **Agent Efficiency:** +30% reduction in messages needed to resolve
- **Adoption:** >80% of tenants using new features within 3 months
- **Cost Savings:** 35% reduction in LLM token usage

### 14.3 Monitoring & Alerts

**Key Metrics to Monitor:**
- Context building latency
- Memory persistence success rate
- Token usage per conversation
- Conversation coherence score
- Agent routing accuracy
- Error rates by component

**Alerts:**
- Context building latency > 500ms
- Memory persistence failure rate > 1%
- Token usage > 80% of limit
- Coherence score < 0.7
- Routing accuracy < 0.95
- Error rate > 0.5%

---

## Appendix A: Data Structure Examples

### A.1 MsgContext Example

```json
{
  "raw": "I'm looking for a 2BHK in Mumbai around 80L",
  "forAgent": "I'm looking for a 2 bedroom apartment in Mumbai around 8000000",
  "original": "I'm looking for a 2BHK in Mumbai around 80L",
  "sender": {
    "name": "Rajesh Kumar",
    "phone": "+919876543210",
    "id": "CONTACT_ABC123",
    "category": "LEAD",
    "linkedEntity": {
      "type": "lead",
      "id": "LEAD_XYZ789",
      "name": "Rajesh Kumar"
    }
  },
  "sessionKey": "SESSION#TENANT_001#DM#+919876543210",
  "tenantId": "TENANT_001",
  "messageId": "MSG_20250115_001",
  "receivedAt": "2025-01-15T10:30:00Z",
  "conversation": {
    "id": "CONV#TENANT_001#+919876543210",
    "intent": "property_search",
    "topic": "2bhk_apartment",
    "status": "active",
    "messageCount": 3,
    "labels": ["property_inquiry", "budget_conscious"]
  },
  "history": [
    {
      "id": "MSG_20250115_000",
      "timestamp": "2025-01-15T10:25:00Z",
      "role": "user",
      "content": "Hi, I'm looking for properties in Mumbai"
    },
    {
      "id": "MSG_20250115_001",
      "timestamp": "2025-01-15T10:28:00Z",
      "role": "assistant",
      "content": "I can help you find properties in Mumbai. What's your budget and preferred area?"
    }
  ],
  "tenant": {
    "id": "TENANT_001",
    "timezone": "Asia/Kolkata",
    "personality": "friendly",
    "communication": {
      "language": "en",
      "responseLength": "detailed",
      "useHinglish": true
    }
  },
  "metadata": {
    "version": 1,
    "createdAt": "2025-01-15T10:30:00Z",
    "estimatedTokens": 450,
    "isTruncated": false
  }
}
```

### A.2 Session Key Examples

```
# Direct message with single agent
SESSION#TENANT_001#DM#+919876543210

# Direct message with per-account-channel-peer isolation
SESSION#TENANT_001#DM#+919876543210#ACCOUNT_CHANNEL_PEER

# Group chat
SESSION#TENANT_001#GROUP#GROUP_ABC123

# Team channel
SESSION#TENANT_001#CHANNEL#SALES_TEAM

# Main/default routing
SESSION#TENANT_001#MAIN#DEFAULT
```

### A.3 Conversation Summary Example

```json
{
  "text": "User Rajesh Kumar is looking for a 2-bedroom apartment in Mumbai with a budget of 80 lakhs. He prefers modern amenities and proximity to public transport. We discussed 3 properties but he wants to see more options with better location.",
  "keyPoints": [
    "Looking for 2BHK apartment",
    "Budget: 80 lakhs",
    "Prefers modern amenities",
    "Needs public transport access",
    "Wants to see more options"
  ],
  "entities": [
    {
      "type": "property_type",
      "value": "2BHK apartment"
    },
    {
      "type": "location",
      "value": "Mumbai"
    },
    {
      "type": "budget",
      "value": "8000000"
    }
  ],
  "sentiment": "positive",
  "messageCount": 12,
  "tokenCount": 180
}
```

---

## Appendix B: Implementation Checklist

### Phase 1 Checklist
- [ ] Design MsgContext interface
- [ ] Implement MsgContext builder
- [ ] Implement body variant extraction
- [ ] Implement PII redaction
- [ ] Implement session key grammar
- [ ] Implement session key builder/parser
- [ ] Implement TenantContextManager
- [ ] Write unit tests (>90% coverage)
- [ ] Code review and approval
- [ ] Deploy to staging
- [ ] Smoke tests in staging

### Phase 2 Checklist
- [ ] Design ConversationSummarizer
- [ ] Implement summarization algorithm
- [ ] Implement MemoryPersister
- [ ] Implement MemoryRetriever
- [ ] Update DynamoDB schema
- [ ] Implement memory TTL cleanup
- [ ] Write integration tests
- [ ] Performance benchmarks
- [ ] Code review and approval
- [ ] Deploy to staging
- [ ] Load tests in staging

### Phase 3 Checklist
- [ ] Design ContextWindowOptimizer
- [ ] Implement token estimation
- [ ] Implement truncation logic
- [ ] Implement compaction logic
- [ ] Write unit tests
- [ ] Performance benchmarks
- [ ] Code review and approval
- [ ] Deploy to staging
- [ ] Verify no token overflow

### Phase 4 Checklist
- [ ] Design AgentRouter
- [ ] Implement routing logic
- [ ] Implement group chat support
- [ ] Implement routing configuration
- [ ] Write integration tests
- [ ] Code review and approval
- [ ] Deploy to staging
- [ ] Test multi-agent routing

### Phase 5 Checklist
- [ ] Implement conversation state machine
- [ ] Implement intent detection
- [ ] Implement topic detection
- [ ] Implement coherence metrics
- [ ] Write unit tests
- [ ] Code review and approval
- [ ] Deploy to staging
- [ ] Monitor coherence metrics

### Phase 6 Checklist
- [ ] Create migration scripts
- [ ] Test migration in staging
- [ ] Dry-run migration on production data
- [ ] Create rollback plan
- [ ] Deploy to production (feature flags OFF)
- [ ] Enable for 10% of tenants
- [ ] Monitor for errors
- [ ] Gradually increase rollout
- [ ] Remove feature flags
- [ ] Remove old code
- [ ] Update documentation

---

## Appendix C: References

### OpenClaw Architecture
- Gateway Controller with ChannelManager
- Multi-agent orchestration with sub-agent spawning
- Session key concept for flexible routing
- Rich inbound envelope with 20+ fields
- Conversation summarization and compaction
- Semantic search with embeddings
- Multi-layer memory system

### RealtyFlow Current Implementation
- conversationStateService.js: Basic conversation state
- agentRuntime.js: LLM invocation with tool loop
- skillInvoker.js: Tool execution
- whatsappConversationService.js: Message history
- agentAuditService.js: Audit logging

### Related Technologies
- AWS DynamoDB: Primary data store
- AWS Bedrock: LLM provider (Claude)
- Google Gemini: Alternative LLM
- OpenSearch/Pinecone: Vector database for semantic search
- AWS CloudWatch: Monitoring and logging

---

**Document End**

This comprehensive design document provides a complete roadmap for implementing context and memory management improvements in RealtyFlow. It addresses all identified gaps from the OpenClaw comparison analysis and provides detailed implementation guidance with realistic effort estimates and risk mitigation strategies.
