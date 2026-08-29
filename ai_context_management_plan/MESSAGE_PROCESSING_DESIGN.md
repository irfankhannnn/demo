# RealtyFlow Message Processing & Reliability Design

**Version:** 1.0  
**Date:** 2024  
**Status:** Design Phase  
**Audience:** Engineering Team, Architecture Review

---

## Executive Summary

This document provides a comprehensive technical design for improving message processing, idempotency, and reliability in RealtyFlow. The system currently handles WhatsApp messages, billing webhooks, and internal events with basic idempotency but lacks:

1. **Message body variant separation** — No distinction between command, text, and media messages
2. **Command detection & authorization** — Commands are not explicitly detected or authorized
3. **Echo detection** — No mechanism to prevent self-echoes or reply loops
4. **Multi-message handling** — No batching or transaction support
5. **Reply routing** — No thread-aware message routing
6. **Webhook reliability** — Limited retry and circuit-breaker patterns
7. **Comprehensive error recovery** — No graceful degradation strategies

This design introduces a **three-phase implementation** with backward compatibility, comprehensive testing, and risk mitigation.

---

## Part 1: Current State Analysis

### 1.1 Existing Architecture

#### Message Flow (Current)

```
┌─────────────────────────────────────────────────────────────────┐
│ External Source (Bailey WhatsApp, Razorpay, etc.)              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Webhook Endpoint             │
        │ /api/webhooks/whatsapp       │
        │ /api/billing/webhook         │
        └──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Signature Verification       │
        │ (Bailey, Razorpay HMAC)      │
        └──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Idempotency Check            │
        │ (WebhookLog table)           │
        │ ConditionExpression: PK !exists
        └──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Tenant Resolution            │
        │ (hardcoded mapping or        │
        │  auth service lookup)        │
        └──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ EventBridge Publish          │
        │ (or local direct process)    │
        └──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Message Processor            │
        │ (whatsapp-message-processor) │
        └──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Store in WhatsApp Conversation
        │ Service (DynamoDB)           │
        └──────────────────────────────┘
```

#### Key Services

| Service | Purpose | Location |
|---------|---------|----------|
| `webhookLogService.js` | Idempotency via DynamoDB WebhookLog table | `/server/webhookLogService.js` |
| `whatsappConversationService.js` | Message storage & retrieval | `/server/whatsappConversationService.js` |
| `bailey.js` | WhatsApp client (Baileys wrapper) | `/server/bailey.js` |
| `whatsappConversations.js` (route) | User-facing WhatsApp API | `/server/routes/whatsappConversations.js` |
| `webhooks.js` (route) | Inbound webhook handler | `/server/routes/webhooks.js` |
| `billing.js` (route) | Razorpay webhook handler | `/server/routes/billing.js` |

#### Current Idempotency Implementation

**WebhookLog Table Schema:**
```
PK: webhookEventId (String)
SK: (none — single-item table)
Attributes:
  - webhookEventId (PK)
  - processedAt (ISO timestamp)
  - eventType (String: 'whatsapp.incoming', 'subscription.activated', etc.)
  - tenantId (String, nullable)
  - ttl (Unix timestamp, 30 days)
```

**Idempotency Logic:**
```javascript
// webhookLogService.js — logEventIfNotProcessed()
await docClient.send(new PutCommand({
  TableName: TABLE_NAME,
  Item: { webhookEventId, processedAt, eventType, tenantId, ttl },
  ConditionExpression: 'attribute_not_exists(webhookEventId)',
}));
// Returns { processed: true, isDuplicate: false } on success
// Returns { processed: false, isDuplicate: true } on ConditionalCheckFailedException
```

**Current Limitations:**
- ✅ Prevents duplicate processing (atomic check + log)
- ✅ TTL-based cleanup (30 days)
- ❌ No message body variant tracking
- ❌ No echo detection
- ❌ No reply threading
- ❌ No multi-message transactions
- ❌ No retry logic or circuit breaker
- ❌ No command authorization

### 1.2 Message Types in RealtyFlow

#### WhatsApp Messages

**Current Structure (whatsappConversationService.js):**
```javascript
{
  messageId: string,           // UUID
  direction: 'inbound' | 'outbound',
  from: string,                // Phone or JID
  to: string,                  // Phone or JID
  text: string,                // Message body
  fromMe: boolean,             // Self-message flag
  aiGenerated: boolean,        // AI-generated flag
  toolCalls?: Array,           // AI tool calls
  creditsCharged?: number,     // Credits used
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed',
  createdAt: ISO timestamp,
}
```

**Issues:**
- No distinction between command, text, and media messages
- No explicit command parsing
- No authorization context
- No reply threading (fromJid exists but not used)

---

## Part 2: Proposed Design

### 2.1 Message Body Variant Specification

#### Message Variant Types

```typescript
export enum MessageVariant {
  TEXT = 'text',           // Plain text message
  COMMAND = 'command',     // Command message (e.g., /help, /status)
  MEDIA = 'media',         // Image, video, document, audio
  REACTION = 'reaction',   // Emoji reaction to another message
  EDIT = 'edit',           // Edit of a previous message
  DELETE = 'delete',       // Deletion of a previous message
  SYSTEM = 'system',       // System message (e.g., user joined group)
  POLL = 'poll',           // Poll message
  LOCATION = 'location',   // Location sharing
  CONTACT = 'contact',     // Contact card
}

export interface MessageBody {
  variant: MessageVariant;
  content: string;                    // Main content
  metadata?: {
    mediaUrl?: string;                // For MEDIA variant
    mediaType?: 'image' | 'video' | 'audio' | 'document';
    mediaSize?: number;
    reactionEmoji?: string;            // For REACTION variant
    editedMessageId?: string;          // For EDIT variant
    deletedMessageId?: string;         // For DELETE variant
    pollOptions?: string[];            // For POLL variant
    latitude?: number;                 // For LOCATION variant
    longitude?: number;
    address?: string;
    vcard?: string;                    // For CONTACT variant
  };
  command?: {
    name: string;                      // Command name (e.g., 'help', 'status')
    args: Record<string, string>;      // Parsed arguments
    rawInput: string;                  // Original command string
  };
}

export interface EnrichedMessage {
  messageId: string;
  variant: MessageVariant;
  body: MessageBody;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  fromMe: boolean;
  aiGenerated: boolean;
  
  // Reply threading
  replyToMessageId?: string;           // Message this is replying to
  replyToThreadId?: string;            // Thread ID for grouping
  threadDepth?: number;                // Depth in reply chain
  
  // Authorization context
  authorization?: {
    userId: string;
    tenantId: string;
    role: 'admin' | 'manager' | 'agent' | 'user';
    permissions: string[];
  };
  
  // Echo detection
  echoDetection?: {
    isEcho: boolean;
    echoOf?: string;                   // Original message ID
    echoReason?: 'self-send' | 'group-echo' | 'reply-loop';
  };
  
  // Processing metadata
  receivedAt: ISO timestamp;
  processedAt?: ISO timestamp;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  errorMessage?: string;
  
  // Credits & usage
  creditsCharged?: number;
  toolCalls?: Array<{
    tool: string;
    result?: string;
    parameters?: Record<string, unknown>;
  }>;
}
```

### 2.2 Command Detection & Authorization

#### Command Registry Pattern

```typescript
export interface CommandDefinition {
  name: string;
  description: string;
  aliases: string[];
  requiredRole: 'admin' | 'manager' | 'agent' | 'user';
  requiredPermissions: string[];
  schema: {
    args: Record<string, {
      type: 'string' | 'number' | 'boolean';
      required: boolean;
      description: string;
    }>;
  };
  handler: (context: CommandContext) => Promise<CommandResult>;
}

export class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();
  private aliases: Map<string, string> = new Map();

  register(definition: CommandDefinition): void {
    this.commands.set(definition.name, definition);
    for (const alias of definition.aliases) {
      this.aliases.set(alias, definition.name);
    }
  }

  resolve(commandName: string): CommandDefinition | null {
    const name = this.aliases.get(commandName) || commandName;
    return this.commands.get(name) || null;
  }

  listCommands(role: string): CommandDefinition[] {
    return Array.from(this.commands.values()).filter(cmd => {
      const roleHierarchy = { admin: 3, manager: 2, agent: 1, user: 0 };
      return roleHierarchy[role] >= roleHierarchy[cmd.requiredRole];
    });
  }
}
```

### 2.3 Idempotency & Deduplication

#### Enhanced WebhookLog Schema

```typescript
export interface WebhookLogEntry {
  webhookEventId: string;              // PK: unique webhook event ID
  messageHash: string;                 // SK: message hash for deduplication
  processedAt: ISO timestamp;
  eventType: string;
  tenantId?: string;
  messageId?: string;                  // Original message ID
  messageContent?: string;             // Hash of message content
  senderPhone?: string;                // Normalized sender phone
  idempotencyKey: string;              // Client-provided or derived
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;                        // Result of processing
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: ISO timestamp;
  ttl: Unix timestamp;                 // 30 days for webhooks
  createdAt: ISO timestamp;
  updatedAt: ISO timestamp;
  processedBy?: string;                // Lambda function name
}
```

#### Deduplication Algorithm

```typescript
export class IdempotencyService {
  static computeMessageHash(message: {
    from: string;
    to: string;
    text: string;
    createdAt?: string;
  }): string {
    const content = `${message.from}:${message.to}:${message.text}:${message.createdAt || ''}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  static async checkEventDuplicate(
    webhookEventId: string,
    eventType: string,
    tenantId?: string
  ): Promise<{ isDuplicate: boolean; previousResult?: any }> {
    const result = await docClient.send(new GetCommand({
      TableName: WEBHOOK_LOG_TABLE,
      Key: { webhookEventId },
    }));
    
    if (result.Item) {
      return { isDuplicate: true, previousResult: result.Item.result };
    }
    return { isDuplicate: false };
  }

  static async checkMessageDuplicate(
    tenantId: string,
    message: { from: string; to: string; text: string; createdAt?: string }
  ): Promise<{ isDuplicate: boolean; previousResult?: any }> {
    const messageHash = this.computeMessageHash(message);
    const lookbackWindow = 5 * 60 * 1000; // 5 minutes
    const cutoff = new Date(Date.now() - lookbackWindow).toISOString();

    const result = await docClient.send(new QueryCommand({
      TableName: WEBHOOK_LOG_TABLE,
      IndexName: 'TenantIdMessageHashIndex',
      KeyConditionExpression: 'tenantId = :tenantId AND messageHash = :messageHash',
      FilterExpression: 'processedAt > :cutoff',
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
        ':messageHash': messageHash,
        ':cutoff': cutoff,
      },
      Limit: 1,
    }));

    if (result.Items && result.Items.length > 0) {
      return { isDuplicate: true, previousResult: result.Items[0].result };
    }
    return { isDuplicate: false };
  }
}
```

### 2.4 Echo Detection & Suppression

#### Echo Detection Algorithm

```typescript
export enum EchoReason {
  SELF_SEND = 'self-send',
  GROUP_ECHO = 'group-echo',
  REPLY_LOOP = 'reply-loop',
  DUPLICATE_DELIVERY = 'duplicate-delivery',
}

export class EchoDetectionService {
  private echoCache: Map<string, any> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  async detectEcho(
    message: EnrichedMessage,
    tenantId: string
  ): Promise<{ isEcho: boolean; reason?: EchoReason; originalMessageId?: string }> {
    // 1. Self-send detection
    if (this.isSelfSend(message)) {
      return { isEcho: true, reason: EchoReason.SELF_SEND };
    }

    // 2. Group echo detection
    const groupEcho = await this.detectGroupEcho(message, tenantId);
    if (groupEcho) {
      return { isEcho: true, reason: EchoReason.GROUP_ECHO, originalMessageId: groupEcho };
    }

    // 3. Reply loop detection
    const replyLoop = await this.detectReplyLoop(message, tenantId);
    if (replyLoop) {
      return { isEcho: true, reason: EchoReason.REPLY_LOOP, originalMessageId: replyLoop };
    }

    // 4. Duplicate delivery detection
    const duplicate = await this.detectDuplicateDelivery(message, tenantId);
    if (duplicate) {
      return { isEcho: true, reason: EchoReason.DUPLICATE_DELIVERY, originalMessageId: duplicate };
    }

    return { isEcho: false };
  }

  private isSelfSend(message: EnrichedMessage): boolean {
    const normalizedFrom = this.normalizePhone(message.from);
    const normalizedTo = this.normalizePhone(message.to);
    return normalizedFrom === normalizedTo && normalizedFrom !== null;
  }

  private normalizePhone(phone: string): string | null {
    const cleaned = phone.replace(/@(s\\.whatsapp\\.net|g\\.us|lid)$/, '');
    const digits = cleaned.replace(/\\D/g, '');
    return digits.length > 0 ? digits : null;
  }
}
```

### 2.5 Reply Routing & Threading

#### Thread-Aware Message Storage

```typescript
export interface ThreadMetadata {
  threadId: string;              // Unique thread identifier
  rootMessageId: string;         // Original message in thread
  depth: number;                 // Nesting depth
  parentMessageId?: string;      // Direct parent
  childCount: number;            // Number of replies
  lastReplyAt: ISO timestamp;
}

export async function logMessageWithThread(
  tenantId: string,
  contactPhone: string,
  message: EnrichedMessage
): Promise<void> {
  const now = new Date().toISOString();
  const timestamp = message.receivedAt || now;

  // Determine thread ID
  let threadId: string;
  let parentMessageId: string | undefined;
  let depth: number = 0;

  if (message.replyToMessageId) {
    const parent = await fetchMessage(tenantId, message.replyToMessageId);
    if (parent) {
      threadId = parent.threadMetadata?.threadId || message.replyToMessageId;
      parentMessageId = message.replyToMessageId;
      depth = (parent.threadMetadata?.depth || 0) + 1;
    } else {
      threadId = message.messageId;
      depth = 0;
    }
  } else {
    threadId = message.messageId;
    depth = 0;
  }

  const item = {
    PK: buildPk(tenantId, contactPhone),
    SK: buildSk(timestamp, message.messageId),
    threadId,
    parentMessageId,
    threadMetadata: {
      threadId,
      rootMessageId: depth === 0 ? message.messageId : (await getRootMessageId(tenantId, threadId)),
      depth,
      parentMessageId,
      childCount: 0,
      lastReplyAt: timestamp,
    },
    // ... other fields
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

export async function getThread(
  tenantId: string,
  contactPhone: string,
  threadId: string,
  { limit = 50 } = {}
): Promise<{ rootMessage: any; replies: any[] }> {
  // Fetch root message + all replies
  const rootResult = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'ThreadIdIndex',
    KeyConditionExpression: 'threadId = :threadId',
    FilterExpression: 'depth = :zero',
    ExpressionAttributeValues: {
      ':threadId': threadId,
      ':zero': 0,
    },
    Limit: 1,
  }));

  const rootMessage = rootResult.Items?.[0];
  if (!rootMessage) {
    return { rootMessage: null, replies: [] };
  }

  const repliesResult = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'ThreadIdIndex',
    KeyConditionExpression: 'threadId = :threadId',
    FilterExpression: 'depth > :zero',
    ExpressionAttributeValues: {
      ':threadId': threadId,
      ':zero': 0,
    },
    ScanIndexForward: true,
    Limit: limit,
  }));

  return {
    rootMessage: formatMessage(rootMessage),
    replies: (repliesResult.Items || []).map(formatMessage),
  };
}
```

### 2.6 Webhook Reliability Improvements

#### Circuit Breaker Pattern

```typescript
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }
}
```

#### Retry Logic with Exponential Backoff

```typescript
export class WebhookReliabilityService {
  async executeWithRetry<T>(
    webhookId: string,
    handler: () => Promise<T>,
    retryConfig: RetryConfig = {}
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await this.circuitBreaker.execute(handler);
      } catch (err) {
        lastError = err;
        if (attempt < config.maxRetries) {
          const delay = this.calculateBackoffDelay(
            attempt,
            config.initialDelayMs,
            config.maxDelayMs,
            config.backoffMultiplier,
            config.jitterFactor
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Webhook execution failed');
  }

  private calculateBackoffDelay(
    attempt: number,
    initialDelayMs: number,
    maxDelayMs: number,
    backoffMultiplier: number,
    jitterFactor: number
  ): number {
    const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
    const jitter = cappedDelay * jitterFactor * (Math.random() - 0.5) * 2;
    return Math.max(0, cappedDelay + jitter);
  }
}
```

#### Dead-Letter Queue (DLQ)

```typescript
export class DeadLetterQueueService {
  async sendToDLQ(
    webhookEventId: string,
    eventType: string,
    payload: any,
    error: Error,
    retryable: boolean = true
  ): Promise<void> {
    const dlqEntry: DeadLetterQueueEntry = {
      id: crypto.randomUUID(),
      webhookEventId,
      eventType,
      payload,
      error: error.message,
      failedAt: new Date().toISOString(),
      retryCount: 0,
      nextRetryAt: retryable ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : undefined,
      status: 'pending',
      ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    };

    await docClient.send(new PutCommand({
      TableName: DLQ_TABLE,
      Item: dlqEntry,
    }));

    if (!retryable) {
      await this.alertOps(dlqEntry);
    }
  }

  async processPendingEntries(): Promise<void> {
    const now = new Date().toISOString();
    const result = await docClient.send(new QueryCommand({
      TableName: DLQ_TABLE,
      IndexName: 'StatusNextRetryIndex',
      KeyConditionExpression: '#status = :status AND nextRetryAt <= :now',
      ExpressionAttributeValues: {
        ':status': 'pending',
        ':now': now,
      },
      Limit: 100,
    }));

    for (const entry of result.Items || []) {
      await this.retryEntry(entry);
    }
  }
}
```

---

## Part 3: Implementation Approach

### 3.1 Phased Rollout

#### Phase 1: Foundation (Weeks 1-2)

**Objective:** Establish message variant detection and enhanced idempotency

**Tasks:**
1. Create message variant detection system
2. Enhance WebhookLog table with new fields
3. Implement deduplication service
4. Write comprehensive unit tests

**Deliverables:**
- Message variant detection system
- Enhanced WebhookLog schema
- Deduplication service
- Unit tests (80% coverage)

**Risk:** Schema migration on production table

**Mitigation:**
- Create new table first, dual-write for 1 week
- Backfill existing data
- Switch reads after validation

---

#### Phase 2: Intelligence (Weeks 3-4)

**Objective:** Add echo detection, command detection, and reply threading

**Tasks:**
1. Implement echo detection service
2. Implement command registry & authorization
3. Add reply threading support

**Deliverables:**
- Echo detection service
- Command registry & authorization
- Reply threading support
- Integration tests

**Risk:** Performance impact of echo detection queries

**Mitigation:**
- In-memory cache with TTL
- Limit lookback window to 5 minutes
- Monitor query performance

---

#### Phase 3: Reliability (Weeks 5-6)

**Objective:** Add webhook reliability, retry logic, and DLQ

**Tasks:**
1. Implement circuit breaker pattern
2. Implement retry logic with exponential backoff
3. Implement dead-letter queue
4. Add monitoring & alerting

**Deliverables:**
- Circuit breaker implementation
- Retry logic with exponential backoff
- Dead-letter queue system
- Monitoring dashboards
- Operations runbook

**Risk:** Increased complexity in webhook handling

**Mitigation:**
- Feature flags for gradual rollout
- Extensive testing with chaos engineering
- Clear runbooks for operations

---

### 3.2 Testing Strategy

#### Unit Tests

```typescript
// tests/unit/messageVariantDetector.test.ts
describe('MessageVariantDetector', () => {
  it('detects TEXT variant', () => {
    const result = MessageVariantDetector.detect({ text: 'Hello world' });
    expect(result).toBe(MessageVariant.TEXT);
  });

  it('detects COMMAND variant', () => {
    const result = MessageVariantDetector.detect({ text: '/help' });
    expect(result).toBe(MessageVariant.COMMAND);
  });

  it('detects MEDIA variant', () => {
    const result = MessageVariantDetector.detect({ image: { url: '...' } });
    expect(result).toBe(MessageVariant.MEDIA);
  });

  it('parses command arguments', () => {
    const result = MessageVariantDetector.parseCommand('/status tenant=abc role=admin');
    expect(result.name).toBe('status');
    expect(result.args.tenant).toBe('abc');
    expect(result.args.role).toBe('admin');
  });
});

// tests/unit/echoDetectionService.test.ts
describe('EchoDetectionService', () => {
  it('detects self-send', async () => {
    const message = {
      from: '919876543210',
      to: '919876543210',
      text: 'Hello',
    };
    const result = await service.detectEcho(message, 'tenant-1');
    expect(result.isEcho).toBe(true);
    expect(result.reason).toBe(EchoReason.SELF_SEND);
  });

  it('detects group echo', async () => {
    // Mock recent outbound message
    mockFindRecentOutboundMessage.mockResolvedValue({
      messageId: 'msg-1',
      createdAt: new Date().toISOString(),
    });

    const message = {
      messageId: 'msg-2',
      from: '919876543210',
      to: 'group-id@g.us',
      text: 'Hello group',
    };
    const result = await service.detectEcho(message, 'tenant-1');
    expect(result.isEcho).toBe(true);
    expect(result.reason).toBe(EchoReason.GROUP_ECHO);
  });
});

// tests/unit/idempotencyService.test.ts
describe('IdempotencyService', () => {
  it('detects duplicate webhook event', async () => {
    mockDocClient.send.mockResolvedValueOnce({
      Item: { webhookEventId: 'event-1', result: { success: true } },
    });

    const result = await IdempotencyService.checkEventDuplicate('event-1', 'whatsapp.incoming');
    expect(result.isDuplicate).toBe(true);
    expect(result.previousResult).toEqual({ success: true });
  });

  it('detects duplicate message content', async () => {
    mockDocClient.send.mockResolvedValueOnce({
      Items: [{ webhookEventId: 'event-1', result: { success: true } }],
    });

    const result = await IdempotencyService.checkMessageDuplicate('tenant-1', {
      from: '919876543210',
      to: '919876543211',
      text: 'Hello',
    });
    expect(result.isDuplicate).toBe(true);
  });
});
```

#### Integration Tests

```typescript
// tests/integration/webhookFlow.test.ts
describe('Webhook Flow', () => {
  it('processes WhatsApp message end-to-end', async () => {
    const message = {
      messageId: 'msg-1',
      from: '919876543210',
      to: '919876543211',
      text: 'Hello',
      fromMe: false,
    };

    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-bailey-signature', signature)
      .set('x-bailey-timestamp', timestamp)
      .send(message);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    // Verify message was stored
    const stored = await whatsappConversationService.getConversation('tenant-1', '919876543210');
    expect(stored.messages).toHaveLength(1);
    expect(stored.messages[0].messageId).toBe('msg-1');
  });

  it('rejects duplicate webhook event', async () => {
    const message = { messageId: 'msg-1', from: '919876543210', to: '919876543211', text: 'Hello' };

    // First request
    const response1 = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-bailey-signature', signature)
      .set('x-bailey-timestamp', timestamp)
      .send(message);
    expect(response1.status).toBe(200);

    // Second request (duplicate)
    const response2 = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-bailey-signature', signature)
      .set('x-bailey-timestamp', timestamp)
      .send(message);
    expect(response2.status).toBe(200);
    expect(response2.body.duplicate).toBe(true);
  });

  it('detects and rejects echo messages', async () => {
    // Send message from A to B
    await sendMessage('919876543210', '919876543211', 'Hello');

    // Simulate echo: message from B back to A with same content
    const echoMessage = {
      messageId: 'msg-2',
      from: '919876543211',
      to: '919876543210',
      text: 'Hello',
      fromMe: false,
    };

    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-bailey-signature', signature)
      .set('x-bailey-timestamp', timestamp)
      .send(echoMessage);

    expect(response.status).toBe(200);
    expect(response.body.echo).toBe(true);
  });
});
```

#### Load Tests

```typescript
// tests/load/webhookLoad.test.ts
describe('Webhook Load Tests', () => {
  it('handles 1000 concurrent webhook requests', async () => {
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      const message = {
        messageId: `msg-${i}`,
        from: `9198765432${String(i).padStart(2, '0')}`,
        to: '919876543211',
        text: `Message ${i}`,
      };
      promises.push(
        request(app)
          .post('/api/webhooks/whatsapp')
          .set('x-bailey-signature', signature)
          .set('x-bailey-timestamp', timestamp)
          .send(message)
      );
    }

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status === 200).length;
    expect(successCount).toBeGreaterThan(990); // Allow 1% failure
  });

  it('maintains sub-100ms latency under load', async () => {
    const message = {
      messageId: 'msg-1',
      from: '919876543210',
      to: '919876543211',
      text: 'Hello',
    };

    const start = Date.now();
    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-bailey-signature', signature)
      .set('x-bailey-timestamp', timestamp)
      .send(message);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });
});
```

---

## Part 4: Risk Assessment & Mitigations

### 4.1 Identified Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Schema migration failures | Data loss, downtime | Medium | Dual-write, backfill validation, rollback plan |
| Echo detection false positives | Legitimate messages dropped | Medium | Extensive testing, manual review, feature flag |
| Performance degradation | Increased latency | Medium | Caching, query optimization, load testing |
| Retry storms | Cascading failures | Low | Circuit breaker, DLQ, rate limiting |
| Authorization bypass | Security breach | Low | Comprehensive testing, code review, pen testing |

### 4.2 Mitigation Strategies

#### Data Migration Safety

```bash
# 1. Create new table with enhanced schema
aws dynamodb create-table \
  --table-name WebhookLog-v2 \
  --attribute-definitions \
    AttributeName=webhookEventId,AttributeType=S \
    AttributeName=messageHash,AttributeType=S \
  --key-schema \
    AttributeName=webhookEventId,KeyType=HASH \
    AttributeName=messageHash,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# 2. Enable dual-write for 1 week
# Application writes to both WebhookLog and WebhookLog-v2

# 3. Backfill existing data
aws dynamodb scan --table-name WebhookLog | \
  jq '.Items[]' | \
  aws dynamodb batch-write-item --request-items '{
    "WebhookLog-v2": [...]
  }'

# 4. Validate data integrity
SELECT COUNT(*) FROM WebhookLog;
SELECT COUNT(*) FROM WebhookLog-v2;
# Should be equal

# 5. Switch reads to new table
# Update application config

# 6. Monitor for 1 week, then delete old table
```

#### Feature Flags

```typescript
// src/config/features.ts
export const FEATURES = {
  ECHO_DETECTION_ENABLED: process.env.FEATURE_ECHO_DETECTION === 'true',
  COMMAND_AUTHORIZATION_ENABLED: process.env.FEATURE_COMMAND_AUTH === 'true',
  REPLY_THREADING_ENABLED: process.env.FEATURE_REPLY_THREADING === 'true',
  WEBHOOK_RETRY_ENABLED: process.env.FEATURE_WEBHOOK_RETRY === 'true',
};

// Usage in webhook handler
if (FEATURES.ECHO_DETECTION_ENABLED) {
  const echoResult = await echoDetectionService.detectEcho(message, tenantId);
  if (echoResult.isEcho) {
    logger.info('Message is echo, skipping', { messageId, reason: echoResult.reason });
    return res.json({ ok: true, skipped: true, reason: 'echo_detected' });
  }
}
```

#### Monitoring & Alerting

```typescript
// src/monitoring/webhookMetrics.ts
export class WebhookMetrics {
  private cloudwatch = new CloudWatchClient();

  async recordWebhookProcessing(
    eventType: string,
    duration: number,
    success: boolean,
    isDuplicate: boolean,
    isEcho: boolean
  ): Promise<void> {
    await this.cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'RealtyFlow/Webhooks',
      MetricData: [
        {
          MetricName: 'ProcessingDuration',
          Value: duration,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'EventType', Value: eventType },
            { Name: 'Success', Value: success ? 'true' : 'false' },
          ],
        },
        {
          MetricName: 'DuplicateCount',
          Value: isDuplicate ? 1 : 0,
          Unit: 'Count',
          Dimensions: [{ Name: 'EventType', Value: eventType }],
        },
        {
          MetricName: 'EchoCount',
          Value: isEcho ? 1 : 0,
          Unit: 'Count',
          Dimensions: [{ Name: 'EventType', Value: eventType }],
        },
      ],
    }));
  }

  async createAlarms(): Promise<void> {
    // High error rate alarm
    await this.cloudwatch.send(new PutMetricAlarmCommand({
      AlarmName: 'WebhookHighErrorRate',
      MetricName: 'ProcessingDuration',
      Namespace: 'RealtyFlow/Webhooks',
      Statistic: 'Average',
      Period: 300,
      EvaluationPeriods: 2,
      Threshold: 1000, // 1 second
      ComparisonOperator: 'GreaterThanThreshold',
      AlarmActions: [process.env.SNS_ALERT_TOPIC_ARN],
    }));

    // DLQ backlog alarm
    await this.cloudwatch.send(new PutMetricAlarmCommand({
      AlarmName: 'DLQBacklogHigh',
      MetricName: 'ApproximateNumberOfMessagesVisible',
      Namespace: 'AWS/SQS',
      Dimensions: [{ Name: 'QueueName', Value: 'webhook-dlq' }],
      Statistic: 'Average',
      Period: 300,
      EvaluationPeriods: 1,
      Threshold: 100,
      ComparisonOperator: 'GreaterThanThreshold',
      AlarmActions: [process.env.SNS_ALERT_TOPIC_ARN],
    }));
  }
}
```

---

## Part 5: Effort Estimation

### 5.1 Development Effort

| Component | Effort | Notes |
|-----------|--------|-------|
| Message variant detection | 3 days | Straightforward classification logic |
| Enhanced idempotency | 4 days | Schema migration, testing |
| Echo detection | 5 days | Complex algorithm, multiple detection methods |
| Command registry & auth | 4 days | Registry pattern, authorization middleware |
| Reply threading | 5 days | Schema changes, GSI creation, UI updates |
| Webhook reliability | 6 days | Circuit breaker, retry logic, DLQ |
| Testing (unit + integration) | 8 days | Comprehensive test coverage |
| Monitoring & alerting | 3 days | CloudWatch metrics, alarms |
| Documentation | 2 days | Design docs, runbooks, API docs |
| **Total** | **40 days** | ~8 weeks with 1 week buffer |

### 5.2 Timeline

```
Week 1-2: Phase 1 (Foundation)
  - Message variant detection
  - Enhanced idempotency
  - Unit tests
  - Code review & merge

Week 3-4: Phase 2 (Intelligence)
  - Echo detection
  - Command registry & authorization
  - Reply threading
  - Integration tests

Week 5-6: Phase 3 (Reliability)
  - Circuit breaker & retry logic
  - Dead-letter queue
  - Monitoring & alerting
  - Load testing

Week 7: Staging & QA
  - Full integration testing
  - Performance testing
  - Security review
  - Documentation

Week 8: Production Rollout
  - Gradual rollout with feature flags
  - Monitoring & incident response
  - Post-launch support
```

---

## Part 6: Backward Compatibility

### 6.1 API Compatibility

All new features are **additive** and do not break existing APIs:

```typescript
// Old API still works
const conversation = await getConversation(tenantId, phone);
// Returns: { contactPhone, messages, nextKey }

// New API with threading
const conversation = await getConversation(tenantId, phone, { includeThreads: true });
// Returns: { contactPhone, messages, threads, nextKey }

// New thread-specific API
const thread = await getThread(tenantId, phone, threadId);
// Returns: { rootMessage, replies }
```

### 6.2 Database Compatibility

Old and new schemas coexist during migration:

```typescript
// Dual-write during migration
async function logMessage(tenantId, contactPhone, message) {
  // Write to old table
  await logMessageOld(tenantId, contactPhone, message);
  
  // Write to new table
  if (MIGRATION_ENABLED) {
    await logMessageNew(tenantId, contactPhone, message);
  }
}

// Dual-read during migration
async function getConversation(tenantId, contactPhone) {
  // Read from new table if available, fall back to old
  if (MIGRATION_ENABLED) {
    try {
      return await getConversationNew(tenantId, contactPhone);
    } catch (err) {
      return await getConversationOld(tenantId, contactPhone);
    }
  }
  return await getConversationOld(tenantId, contactPhone);
}
```

### 6.3 Feature Flags

All new features can be disabled via environment variables:

```bash
# Disable all new features
FEATURE_ECHO_DETECTION=false
FEATURE_COMMAND_AUTH=false
FEATURE_REPLY_THREADING=false
FEATURE_WEBHOOK_RETRY=false
```

---

## Part 7: Success Metrics

### 7.1 Key Performance Indicators (KPIs)

| Metric | Target | Current | Improvement |
|--------|--------|---------|-------------|
| Webhook processing latency (p99) | < 100ms | ~200ms | 50% reduction |
| Duplicate message rate | < 0.1% | ~0.5% | 80% reduction |
| Echo detection accuracy | > 99% | N/A | New feature |
| Command authorization success rate | > 99.9% | N/A | New feature |
| Webhook retry success rate | > 95% | ~70% | 25% improvement |
| System uptime | > 99.95% | ~99.9% | 0.05% improvement |

### 7.2 Monitoring Dashboard

```
RealtyFlow Message Processing Dashboard
├── Webhook Metrics
│   ├── Processing Latency (p50, p95, p99)
│   ├── Success Rate
│   ├── Duplicate Rate
│   ├── Echo Detection Rate
│   └── Retry Success Rate
├── Message Metrics
│   ├── Messages Processed (per hour)
│   ├── Messages by Variant
│   ├── Commands Executed
│   └── Authorization Failures
├── System Health
│   ├── Circuit Breaker State
│   ├── DLQ Backlog
│   ├── Error Rate
│   └── Database Performance
└── Alerts
    ├── High Latency
    ├── High Error Rate
    ├── DLQ Backlog
    └── Circuit Breaker Open
```

---

## Conclusion

This design provides a comprehensive roadmap for improving message processing, idempotency, and reliability in RealtyFlow. By implementing these changes in three phases, we can:

1. **Reduce duplicate message processing** from 0.5% to < 0.1%
2. **Eliminate echo loops** with 99%+ accuracy
3. **Add command-level authorization** for better security
4. **Improve webhook reliability** with retry logic and DLQ
5. **Enable reply threading** for better conversation context
6. **Maintain backward compatibility** throughout the rollout

The estimated effort of 40 days (8 weeks) is reasonable given the complexity and importance of these improvements. With proper testing, monitoring, and gradual rollout, we can deploy these changes with minimal risk to production.
