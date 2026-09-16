# RealtyFlow Message Processing Architecture

**Version:** 1.0  
**Status:** Design Reference  
**Purpose:** Visual architecture and data flow diagrams

---

## 1. Current Architecture

### Message Flow (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│ External Sources                                                │
├─────────────────────────────────────────────────────────────────┤
│ • Bailey WhatsApp (inbound messages)                            │
│ • Razorpay (billing webhooks)                                   │
│ • Internal services (events)                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Webhook Endpoints                    │
        ├──────────────────────────────────────┤
        │ POST /api/webhooks/whatsapp          │
        │ POST /api/billing/webhook            │
        │ POST /api/webhooks/internal          │
        └──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Signature Verification               │
        ├──────────────────────────────────────┤
        │ • Bailey HMAC (x-bailey-signature)   │
        │ • Razorpay HMAC (x-razorpay-sig)    │
        │ • Internal API Key (x-internal-key)  │
        └──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Idempotency Check                    │
        ├──────────────────────────────────────┤
        │ WebhookLog Table (DynamoDB)          │
        │ PK: webhookEventId                   │
        │ ConditionExpression: !exists(PK)     │
        └──────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │ Duplicate?  │
                    └──────┬──────┘
                    ┌──────┴──────┐
                    │ Yes         │ No
                    ▼             ▼
              Return 200      Continue
              { duplicate }   Processing
                    │             │
                    │             ▼
                    │    ┌──────────────────────┐
                    │    │ Tenant Resolution    │
                    │    ├──────────────────────┤
                    │    │ • Hardcoded mapping  │
                    │    │ • Auth service call  │
                    │    └──────────────────────┘
                    │             │
                    │             ▼
                    │    ┌──────────────────────┐
                    │    │ EventBridge Publish  │
                    │    │ (or local process)   │
                    │    └──────────────────────┘
                    │             │
                    │             ▼
                    │    ┌──────────────────────┐
                    │    │ Message Processor    │
                    │    │ (Lambda or local)    │
                    │    └──────────────────────┘
                    │             │
                    └─────────────┬─────────────┐
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │ Store in DynamoDB        │
                    ├──────────────────────────┤
                    │ WhatsApp Conversation    │
                    │ Billing Events           │
                    │ Internal Events          │
                    └──────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │ Return 200 OK            │
                    └──────────────────────────┘
```

### Database Schema (Current)

```
WebhookLog Table
┌─────────────────────────────────────────────────────┐
│ PK: webhookEventId (String)                         │
├─────────────────────────────────────────────────────┤
│ Attributes:                                         │
│ • webhookEventId (PK)                              │
│ • processedAt (ISO timestamp)                      │
│ • eventType (String)                               │
│ • tenantId (String, nullable)                      │
│ • ttl (Unix timestamp, 30 days)                    │
└─────────────────────────────────────────────────────┘

WhatsApp Conversation Table (CRM)
┌─────────────────────────────────────────────────────┐
│ PK: TENANT#{tenantId}#WHATSAPP#{contactPhone}      │
│ SK: MESSAGE#{timestamp}#{messageId}                │
├─────────────────────────────────────────────────────┤
│ Attributes:                                         │
│ • messageId (String)                               │
│ • direction ('inbound' | 'outbound')               │
│ • from (String)                                    │
│ • to (String)                                      │
│ • text (String)                                    │
│ • fromMe (Boolean)                                 │
│ • aiGenerated (Boolean)                            │
│ • status (String)                                  │
│ • createdAt (ISO timestamp)                        │
│ • expiresAt (Unix timestamp, TTL)                  │
│                                                     │
│ GSI3:                                              │
│ • GSI3PK: TENANT#{tenantId}#WHATSAPP              │
│ • GSI3SK: MESSAGE#{timestamp}#CONTACT#{phone}     │
└─────────────────────────────────────────────────────┘
```

---

## 2. Proposed Architecture

### Enhanced Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ External Sources                                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Webhook Endpoints                    │
        └──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Signature Verification               │
        └──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Message Variant Detection            │ ◄── NEW
        ├──────────────────────────────────────┤
        │ • TEXT, COMMAND, MEDIA, REACTION     │
        │ • EDIT, DELETE, SYSTEM, POLL         │
        │ • LOCATION, CONTACT                  │
        └──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Enhanced Idempotency Check           │ ◄── NEW
        ├──────────────────────────────────────┤
        │ • Event-based (webhookEventId)       │
        │ • Content-based (messageHash)        │
        │ • Replay attack check                │
        └──────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │ Duplicate?  │
                    └──────┬──────┘
                    ┌──────┴──────┐
                    │ Yes         │ No
                    ▼             ▼
              Return 200      Continue
              { duplicate }   Processing
                    │             │
                    │             ▼
                    │    ┌──────────────────────┐
                    │    │ Echo Detection       │ ◄── NEW
                    │    ├──────────────────────┤
                    │    │ • Self-send check    │
                    │    │ • Group echo check   │
                    │    │ • Reply loop check   │
                    │    │ • Duplicate delivery │
                    │    └──────────────────────┘
                    │             │
                    │      ┌──────┴──────┐
                    │      │ Is echo?    │
                    │      └──────┬──────┘
                    │      ┌──────┴──────┐
                    │      │ Yes         │ No
                    │      ▼             ▼
                    │   Return 200   Continue
                    │   { echo }     Processing
                    │      │             │
                    │      │             ▼
                    │      │    ┌──────────────────────┐
                    │      │    │ Tenant Resolution    │
                    │      │    └──────────────────────┘
                    │      │             │
                    │      │             ▼
                    │      │    ┌──────────────────────┐
                    │      │    │ Command Detection    │ ◄── NEW
                    │      │    │ & Authorization      │
                    │      │    ├──────────────────────┤
                    │      │    │ • Parse command      │
                    │      │    │ • Check role         │
                    │      │    │ • Check permissions  │
                    │      │    │ • Validate args      │
                    │      │    └──────────────────────┘
                    │      │             │
                    │      │      ┌──────┴──────┐
                    │      │      │ Authorized? │
                    │      │      └──────┬──────┘
                    │      │      ┌──────┴──────┐
                    │      │      │ Yes         │ No
                    │      │      ▼             ▼
                    │      │   Execute      Return 403
                    │      │   Command      { unauthorized }
                    │      │      │             │
                    │      │      ▼             │
                    │      │   ┌──────────────┐ │
                    │      │   │ EventBridge  │ │
                    │      │   │ Publish      │ │
                    │      │   └──────────────┘ │
                    │      │         │          │
                    │      │         ▼          │
                    │      │   ┌──────────────┐ │
                    │      │   │ Message      │ │
                    │      │   │ Processor    │ │
                    │      │   └──────────────┘ │
                    │      │         │          │
                    │      │         ▼          │
                    │      │   ┌──────────────┐ │
                    │      │   │ Store with   │ │
                    │      │   │ Threading    │ │ ◄── NEW
                    │      │   └──────────────┘ │
                    │      │         │          │
                    └──────┴─────────┴──────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │ Webhook Reliability      │ ◄── NEW
                    ├──────────────────────────┤
                    │ • Circuit breaker        │
                    │ • Retry with backoff     │
                    │ • Dead-letter queue      │
                    └──────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │ Return 200 OK            │
                    └──────────────────────────┘
```

### Enhanced Database Schema

```
WebhookLog-v2 Table (Enhanced)
┌─────────────────────────────────────────────────────┐
│ PK: webhookEventId (String)                         │
│ SK: messageHash (String)                            │ ◄── NEW
├─────────────────────────────────────────────────────┤
│ Attributes:                                         │
│ • webhookEventId (PK)                              │
│ • messageHash (SK) — SHA256(from:to:text:time)    │
│ • processedAt (ISO timestamp)                      │
│ • eventType (String)                               │
│ • tenantId (String)                                │
│ • messageId (String)                               │ ◄── NEW
│ • senderPhone (String)                             │ ◄── NEW
│ • idempotencyKey (String)                          │ ◄── NEW
│ • status ('pending'|'processing'|'completed')      │ ◄── NEW
│ • result (JSON)                                    │ ◄── NEW
│ • errorMessage (String)                            │ ◄── NEW
│ • retryCount (Number)                              │ ◄── NEW
│ • lastRetryAt (ISO timestamp)                      │ ◄── NEW
│ • createdAt (ISO timestamp)                        │ ◄── NEW
│ • updatedAt (ISO timestamp)                        │ ◄── NEW
│ • ttl (Unix timestamp, 30 days)                    │
│                                                     │
│ GSI1: TenantIdMessageHashIndex                     │ ◄── NEW
│ • PK: tenantId                                     │
│ • SK: messageHash                                  │
│ • Projection: ALL                                  │
│                                                     │
│ GSI2: TenantIdProcessedAtIndex                     │ ◄── NEW
│ • PK: tenantId                                     │
│ • SK: processedAt                                  │
│ • Projection: ALL                                  │
└─────────────────────────────────────────────────────┘

WhatsApp Conversation Table (Enhanced)
┌─────────────────────────────────────────────────────┐
│ PK: TENANT#{tenantId}#WHATSAPP#{contactPhone}      │
│ SK: MESSAGE#{timestamp}#{messageId}                │
├─────────────────────────────────────────────────────┤
│ Attributes:                                         │
│ • messageId (String)                               │
│ • variant (String) ◄── NEW                         │
│ • direction ('inbound' | 'outbound')               │
│ • from (String)                                    │
│ • to (String)                                      │
│ • text (String)                                    │
│ • body (JSON) ◄── NEW                              │
│ • fromMe (Boolean)                                 │
│ • aiGenerated (Boolean)                            │
│ • status (String)                                  │
│ • createdAt (ISO timestamp)                        │
│ • expiresAt (Unix timestamp, TTL)                  │
│                                                     │
│ Threading Fields: ◄── NEW                          │
│ • threadId (String)                                │
│ • parentMessageId (String)                         │
│ • threadMetadata (JSON)                            │
│   - rootMessageId                                  │
│   - depth                                          │
│   - childCount                                     │
│   - lastReplyAt                                    │
│                                                     │
│ Echo Detection Fields: ◄── NEW                     │
│ • isEcho (Boolean)                                 │
│ • echoReason (String)                              │
│ • echoOf (String)                                  │
│                                                     │
│ GSI3:                                              │
│ • GSI3PK: TENANT#{tenantId}#WHATSAPP              │
│ • GSI3SK: MESSAGE#{timestamp}#CONTACT#{phone}     │
│                                                     │
│ GSI4: ThreadIdIndex ◄── NEW                        │
│ • PK: threadId                                     │
│ • SK: createdAt                                    │
│ • Projection: ALL                                  │
│                                                     │
│ GSI5: MessageIdIndex ◄── NEW                       │
│ • PK: messageId                                    │
│ • Projection: ALL                                  │
└─────────────────────────────────────────────────────┘

DeadLetterQueue Table (New)
┌─────────────────────────────────────────────────────┐
│ PK: id (String, UUID)                              │
│ SK: (none)                                         │
├─────────────────────────────────────────────────────┤
│ Attributes:                                         │
│ • id (PK)                                          │
│ • webhookEventId (String)                          │
│ • eventType (String)                               │
│ • payload (JSON)                                   │
│ • error (String)                                   │
│ • errorStack (String)                              │
│ • failedAt (ISO timestamp)                         │
│ • retryCount (Number)                              │
│ • nextRetryAt (ISO timestamp)                      │
│ • status ('pending'|'processing'|'resolved')       │
│ • ttl (Unix timestamp, 7 days)                     │
│                                                     │
│ GSI1: StatusNextRetryIndex                         │
│ • PK: status                                       │
│ • SK: nextRetryAt                                  │
│ • Projection: ALL                                  │
└─────────────────────────────────────────────────────┘
```

---

## 3. Component Architecture

### Message Variant Detection

```
┌─────────────────────────────────────────────────────┐
│ Raw Message (from Bailey/Razorpay)                 │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ MessageVariantDetector.detect()  │
        └──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬─────────────┐
        │              │              │             │
        ▼              ▼              ▼             ▼
    SYSTEM        REACTION        MEDIA         COMMAND
    (check        (check          (check        (check
    isSystem      reaction)       media)        /! prefix)
    Message)                                    │
        │              │              │         │
        │              │              │         ▼
        │              │              │    ┌──────────────┐
        │              │              │    │ Parse Command│
        │              │              │    │ Extract args │
        │              │              │    └──────────────┘
        │              │              │         │
        └──────────────┴──────────────┴─────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Extract Metadata                 │
        │ (mediaUrl, emoji, location, etc) │
        └──────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Return EnrichedMessage            │
        │ {                                │
        │   variant: MessageVariant,       │
        │   body: MessageBody,             │
        │   metadata: {...},               │
        │   command: {...}                 │
        │ }                                │
        └──────────────────────────────────┘
```

### Echo Detection Flow

```
┌─────────────────────────────────────────────────────┐
│ Incoming Message                                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ 1. Self-Send Check               │
        │ from == to?                      │
        └──────────────────────────────────┘
                       │
                ┌──────┴──────┐
                │ Yes         │ No
                ▼             ▼
            ECHO         Continue
            (SELF_SEND)
                │             │
                │             ▼
                │    ┌──────────────────────────┐
                │    │ 2. Group Echo Check      │
                │    │ to ends with @g.us?      │
                │    │ Recent outbound msg?     │
                │    └──────────────────────────┘
                │             │
                │      ┌──────┴──────┐
                │      │ Yes         │ No
                │      ▼             ▼
                │   ECHO         Continue
                │   (GROUP_ECHO)
                │      │             │
                │      │             ▼
                │      │    ┌──────────────────────┐
                │      │    │ 3. Reply Loop Check  │
                │      │    │ Has replyToMessageId?│
                │      │    │ Check chain...       │
                │      │    └──────────────────────┘
                │      │             │
                │      │      ┌──────┴──────┐
                │      │      │ Yes         │ No
                │      │      ▼             ▼
                │      │   ECHO         Continue
                │      │   (REPLY_LOOP)
                │      │      │             │
                │      │      │             ▼
                │      │      │    ┌──────────────────┐
                │      │      │    │ 4. Duplicate     │
                │      │      │    │ Delivery Check   │
                │      │      │    │ Same content?    │
                │      │      │    │ Last 2 minutes?  │
                │      │      │    └──────────────────┘
                │      │      │             │
                │      │      │      ┌──────┴──────┐
                │      │      │      │ Yes         │ No
                │      │      │      ▼             ▼
                │      │      │   ECHO         NOT ECHO
                │      │      │   (DUPLICATE)
                │      │      │      │             │
                └──────┴──────┴──────┴─────────────┘
                                    │
                                    ▼
                        ┌──────────────────────┐
                        │ Return Result        │
                        │ {                   │
                        │   isEcho: boolean,  │
                        │   reason?: string   │
                        │ }                   │
                        └──────────────────────┘
```

### Command Authorization Flow

```
┌─────────────────────────────────────────────────────┐
│ Incoming Command Message                            │
│ /status tenant=abc role=admin                       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Parse Command                    │
        │ name: 'status'                   │
        │ args: { tenant: 'abc', ... }     │
        └──────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Resolve Command Definition       │
        │ from CommandRegistry             │
        └──────────────────────────────────┘
                       │
                ┌──────┴──────┐
                │ Found?      │
                └──────┬──────┘
                ┌──────┴──────┐
                │ Yes         │ No
                ▼             ▼
            Continue      Return 404
                │         { COMMAND_NOT_FOUND }
                │
                ▼
        ┌──────────────────────────────────┐
        │ Check Role                       │
        │ User: agent (level 1)            │
        │ Required: manager (level 2)      │
        └──────────────────────────────────┘
                │
        ┌───────┴────────┐
        │ Sufficient?    │
        └───────┬────────┘
        ┌───────┴────────┐
        │ Yes            │ No
        ▼                ▼
    Continue         Return 403
                     { INSUFFICIENT_ROLE }
        │
        ▼
        ┌──────────────────────────────────┐
        │ Check Permissions                │
        │ Required: ['view:status']         │
        │ User has: ['view:leads', ...]    │
        └──────────────────────────────────┘
                │
        ┌───────┴────────┐
        │ All present?   │
        └───────┬────────┘
        ┌───────┴────────┐
        │ Yes            │ No
        ▼                ▼
    Continue         Return 403
                     { MISSING_PERMISSIONS }
        │
        ▼
        ┌──────────────────────────────────┐
        │ Validate Arguments               │
        │ Against Schema                   │
        └──────────────────────────────────┘
                │
        ┌───────┴────────┐
        │ Valid?         │
        └───────┬────────┘
        ┌───────┴────────┐
        │ Yes            │ No
        ▼                ▼
    Continue         Return 400
                     { INVALID_ARG_TYPE }
        │
        ▼
        ┌──────────────────────────────────┐
        │ Execute Command Handler          │
        │ handler(context)                 │
        └──────────────────────────────────┘
                │
                ▼
        ┌──────────────────────────────────┐
        │ Return Result                    │
        │ {                                │
        │   success: true,                 │
        │   response: "Status: online",    │
        │   data: {...}                    │
        │ }                                │
        └──────────────────────────────────┘
```

### Webhook Reliability Flow

```
┌─────────────────────────────────────────────────────┐
│ Webhook Event Received                              │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ executeWithRetry()               │
        │ maxRetries: 3                    │
        │ initialDelay: 1000ms             │
        └──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │ Attempt 1                    │
        ▼                              │
    ┌──────────────────────────┐      │
    │ CircuitBreaker.execute() │      │
    │ State: CLOSED            │      │
    └──────────────────────────┘      │
            │                         │
        ┌───┴────┐                    │
        │ Success?                    │
        └───┬────┘                    │
        ┌───┴────┐                    │
        │ Yes    │ No                 │
        ▼        ▼                    │
    Return  Failure                   │
    Result  Count++                   │
            │                         │
            ├─ Threshold met?         │
            │  Yes → Circuit OPEN     │
            │  No → Continue          │
            │                         │
            ▼                         │
    ┌──────────────────────────┐     │
    │ Wait (exponential backoff)     │
    │ delay = 1000 * 2^0 = 1s       │
    │ + jitter                       │
    └──────────────────────────┘     │
            │                         │
            └─────────────────────────┤
                                      │
        ┌─────────────────────────────┘
        │ Attempt 2
        ▼
    ┌──────────────────────────┐
    │ CircuitBreaker.execute() │
    │ State: CLOSED            │
    └──────────────────────────┘
            │
        ┌───┴────┐
        │ Success?
        └───┬────┘
        ┌───┴────┐
        │ Yes    │ No
        ▼        ▼
    Return  Failure
    Result  Count++
            │
            ▼
    ┌──────────────────────────┐
    │ Wait (exponential backoff)
    │ delay = 1000 * 2^1 = 2s
    │ + jitter
    └──────────────────────────┘
            │
            ▼
        ┌───────────────────────┐
        │ Attempt 3             │
        │ (similar flow)        │
        └───────────────────────┘
            │
        ┌───┴────┐
        │ Success?
        └───┬────┘
        ┌───┴────┐
        │ Yes    │ No
        ▼        ▼
    Return  All retries
    Result  exhausted
            │
            ▼
    ┌──────────────────────────┐
    │ Send to DLQ              │
    │ (Dead-Letter Queue)      │
    │                          │
    │ DeadLetterQueue Entry:   │
    │ • id: UUID               │
    │ • webhookEventId         │
    │ • eventType              │
    │ • payload                │
    │ • error                  │
    │ • retryCount: 0          │
    │ • status: 'pending'      │
    │ • nextRetryAt: now+5min  │
    └──────────────────────────┘
            │
            ▼
    ┌──────────────────────────┐
    │ Alert Operations Team    │
    │ (if non-retryable)       │
    └──────────────────────────┘
            │
            ▼
    ┌──────────────────────────┐
    │ Return 200 OK            │
    │ (webhook accepted)       │
    └──────────────────────────┘
```

---

## 4. Data Flow Diagrams

### Message Ingestion & Storage

```
Bailey WhatsApp
    │
    ├─ Raw Message
    │  {
    │    messageId: 'msg-1',
    │    from: '919876543210',
    │    to: '919876543211',
    │    text: '/help',
    │    createdAt: '2024-01-15T10:30:00Z'
    │  }
    │
    ▼
Webhook Endpoint (/api/webhooks/whatsapp)
    │
    ├─ Signature Verification ✓
    │
    ├─ Message Variant Detection
    │  variant: 'command'
    │  command: { name: 'help', args: {} }
    │
    ├─ Idempotency Check
    │  messageHash: SHA256(from:to:text:time)
    │  Check WebhookLog-v2 for duplicate
    │
    ├─ Echo Detection
    │  isSelfSend: false
    │  isGroupEcho: false
    │  isReplyLoop: false
    │  isDuplicate: false
    │
    ├─ Tenant Resolution
    │  tenantId: 'tenant-abc123'
    │
    ├─ Command Authorization
    │  role: 'admin'
    │  permissions: ['execute:help']
    │  authorized: true
    │
    ▼
EventBridge (or local processor)
    │
    ├─ Event Detail
    │  {
    │    messageId: 'msg-1',
    │    tenantId: 'tenant-abc123',
    │    variant: 'command',
    │    body: { ... },
    │    command: { name: 'help', args: {} },
    │    echoDetection: { isEcho: false },
    │    authorization: { role: 'admin', ... },
    │    receivedAt: '2024-01-15T10:30:00Z'
    │  }
    │
    ▼
Message Processor Lambda
    │
    ├─ Execute Command Handler
    │  → CommandRegistry.resolve('help')
    │  → handler(context)
    │  → response: "Available commands: ..."
    │
    ├─ Log Message with Threading
    │  threadId: 'msg-1' (root)
    │  parentMessageId: null
    │  depth: 0
    │
    ▼
DynamoDB Storage
    │
    ├─ WhatsApp Conversation Table
    │  PK: TENANT#tenant-abc123#WHATSAPP#919876543211
    │  SK: MESSAGE#2024-01-15T10:30:00Z#msg-1
    │  {
    │    messageId: 'msg-1',
    │    variant: 'command',
    │    body: { variant: 'command', content: '/help', command: {...} },
    │    direction: 'inbound',
    │    from: '919876543210',
    │    to: '919876543211',
    │    fromMe: false,
    │    aiGenerated: false,
    │    status: 'processed',
    │    createdAt: '2024-01-15T10:30:00Z',
    │    threadId: 'msg-1',
    │    parentMessageId: null,
    │    threadMetadata: {
    │      threadId: 'msg-1',
    │      rootMessageId: 'msg-1',
    │      depth: 0,
    │      childCount: 0,
    │      lastReplyAt: '2024-01-15T10:30:00Z'
    │    },
    │    expiresAt: 1710000000 (90 days)
    │  }
    │
    ├─ WebhookLog-v2 Table
    │  PK: bailey:msg-1
    │  SK: <messageHash>
    │  {
    │    webhookEventId: 'bailey:msg-1',
    │    messageHash: '<sha256>',
    │    processedAt: '2024-01-15T10:30:00Z',
    │    eventType: 'whatsapp.incoming',
    │    tenantId: 'tenant-abc123',
    │    messageId: 'msg-1',
    │    senderPhone: '919876543210',
    │    status: 'completed',
    │    result: { success: true, response: "..." },
    │    retryCount: 0,
    │    createdAt: '2024-01-15T10:30:00Z',
    │    updatedAt: '2024-01-15T10:30:00Z',
    │    ttl: 1710000000 (30 days)
    │  }
    │
    ▼
Response to Webhook Sender
    {
      ok: true,
      processed: true,
      messageId: 'msg-1',
      variant: 'command',
      threadId: 'msg-1'
    }
```

---

## 5. Deployment Architecture

### Infrastructure Components

```
AWS Account
├─ API Gateway
│  ├─ POST /api/webhooks/whatsapp
│  ├─ POST /api/billing/webhook
│  └─ POST /api/webhooks/internal
│
├─ Lambda Functions
│  ├─ webhook-handler (webhook endpoint)
│  ├─ message-processor (EventBridge target)
│  └─ dlq-processor (cron job, every 5 minutes)
│
├─ DynamoDB Tables
│  ├─ WebhookLog-v2 (idempotency log)
│  ├─ CRM (WhatsApp conversations)
│  └─ DeadLetterQueue (failed webhooks)
│
├─ EventBridge
│  ├─ Rule: whatsapp.incoming
│  │  Target: message-processor Lambda
│  └─ Rule: subscription.activated
│     Target: message-processor Lambda
│
├─ SQS Queue
│  └─ webhook-dlq (dead-letter queue)
│
├─ CloudWatch
│  ├─ Log Groups
│  │  ├─ /aws/lambda/webhook-handler
│  │  ├─ /aws/lambda/message-processor
│  │  └─ /aws/lambda/dlq-processor
│  ├─ Metrics
│  │  ├─ WebhookProcessingDuration
│  │  ├─ DuplicateCount
│  │  ├─ EchoCount
│  │  └─ DLQBacklog
│  └─ Alarms
│     ├─ HighLatency
│     ├─ HighErrorRate
│     └─ DLQBacklogHigh
│
├─ SNS Topics
│  └─ webhook-alerts (for ops notifications)
│
└─ IAM Roles
   ├─ webhook-handler-role
   ├─ message-processor-role
   └─ dlq-processor-role
```

---

## 6. Monitoring & Observability

### Metrics Dashboard

```
┌─────────────────────────────────────────────────────┐
│ RealtyFlow Message Processing Dashboard             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Webhook Metrics                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Processing Latency (p99)                    │   │
│ │ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│ │ 85ms (target: < 100ms)                      │   │
│ │                                             │   │
│ │ Success Rate                                │   │
│ │ ████████████████████████████████████████░░  │   │
│ │ 99.8% (target: > 99.9%)                     │   │
│ │                                             │   │
│ │ Duplicate Rate                              │   │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│ │ 0.05% (target: < 0.1%)                      │   │
│ │                                             │   │
│ │ Echo Detection Rate                         │   │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│ │ 0.2% (expected: 0.1-0.5%)                   │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Message Metrics                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Messages Processed (last hour)               │   │
│ │ 12,450 messages                             │   │
│ │                                             │   │
│ │ By Variant:                                 │   │
│ │ • TEXT: 8,234 (66%)                         │   │
│ │ • COMMAND: 2,145 (17%)                      │   │
│ │ • MEDIA: 1,523 (12%)                        │   │
│ │ • REACTION: 548 (4%)                        │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ System Health                                       │
│ ┌─────────────────────────────────────────────┐   │
│ │ Circuit Breaker State                       │   │
│ │ ✓ CLOSED (normal operation)                 │   │
│ │                                             │   │
│ │ DLQ Backlog                                 │   │
│ │ 12 messages (max: 100)                      │   │
│ │                                             │   │
│ │ Database Performance                        │   │
│ │ • Read latency (p99): 45ms                  │   │
│ │ • Write latency (p99): 52ms                 │   │
│ │ • Consumed capacity: 234 RCU/s              │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 7. Sequence Diagrams

### Successful Message Processing

```
Bailey          Webhook         Idempotency    Echo          Message
Client          Handler         Service        Detection     Processor
  │                │                │             │             │
  │─ POST /webhook─>│                │             │             │
  │                 │                │             │             │
  │                 │─ Verify Sig ✓  │             │             │
  │                 │                │             │             │
  │                 │─ Detect Variant│             │             │
  │                 │ (COMMAND)      │             │             │
  │                 │                │             │             │
  │                 │─ Check Duplicate─>│          │             │
  │                 │                │─ Not found  │             │
  │                 │                │<─ OK        │             │
  │                 │                │             │             │
  │                 │─ Detect Echo ──────────────>│             │
  │                 │                │             │─ Not echo   │
  │                 │                │             │<────────────│
  │                 │                │             │             │
  │                 │─ Publish to EventBridge ─────────────────>│
  │                 │                │             │             │
  │                 │<─ 200 OK ──────────────────────────────────│
  │<─ 200 OK ───────│                │             │             │
  │                 │                │             │             │
  │                 │                │             │    Process  │
  │                 │                │             │    Message  │
  │                 │                │             │    Store in │
  │                 │                │             │    DynamoDB │
  │                 │                │             │             │
```

### Duplicate Message Detection

```
Bailey          Webhook         Idempotency    Message
Client          Handler         Service        Processor
  │                │                │             │
  │─ POST /webhook─>│                │             │
  │ (same msg)      │                │             │
  │                 │                │             │
  │                 │─ Check Duplicate─>│         │
  │                 │                │─ Found!    │
  │                 │                │ (duplicate)│
  │                 │                │<─ Duplicate│
  │                 │                │             │
  │                 │<─ 200 OK ──────────────────│
  │                 │ { duplicate: true }        │
  │<─ 200 OK ───────│                │             │
  │                 │                │             │
  │                 │                │ (no further│
  │                 │                │  processing)
  │                 │                │             │
```

### Echo Message Detection

```
Bailey          Webhook         Echo           Message
Client          Handler         Detection      Processor
  │                │                │             │
  │─ POST /webhook─>│                │             │
  │ (echo msg)      │                │             │
  │                 │                │             │
  │                 │─ Detect Echo ──>│           │
  │                 │                │─ Is echo   │
  │                 │                │ (self-send)│
  │                 │                │<─ Echo!    │
  │                 │                │             │
  │                 │<─ 200 OK ──────────────────│
  │                 │ { echo: true, reason: ... }│
  │<─ 200 OK ───────│                │             │
  │                 │                │             │
  │                 │                │ (no further│
  │                 │                │  processing)
  │                 │                │             │
```

---

## 8. Scaling Considerations

### Throughput Capacity

```
Current Capacity:
├─ API Gateway: 10,000 req/s
├─ Lambda: 1,000 concurrent executions
├─ DynamoDB: On-demand billing
└─ EventBridge: 10,000 events/s

Projected Growth:
├─ Year 1: 100 req/s (10% utilization)
├─ Year 2: 500 req/s (50% utilization)
└─ Year 3: 1,000 req/s (100% utilization)

Scaling Strategy:
├─ Phase 1: On-demand DynamoDB (auto-scaling)
├─ Phase 2: Reserved capacity (if > 500 req/s)
├─ Phase 3: Provisioned throughput + caching
└─ Phase 4: Multi-region deployment
```

---

This architecture provides a solid foundation for reliable, scalable message processing in RealtyFlow.
