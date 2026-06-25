# RealtyFlow Message Processing - Implementation Guide

**Version:** 1.0  
**Status:** Implementation Ready  
**Target Audience:** Development Team

---

## Quick Start

This guide provides step-by-step instructions for implementing the message processing improvements outlined in `MESSAGE_PROCESSING_DESIGN.md`.

---

## Phase 1: Foundation (Weeks 1-2)

### Step 1.1: Create Message Variant Detection System

**File:** `src/utils/messageVariantDetector.ts`

```typescript
import crypto from 'crypto';

export enum MessageVariant {
  TEXT = 'text',
  COMMAND = 'command',
  MEDIA = 'media',
  REACTION = 'reaction',
  EDIT = 'edit',
  DELETE = 'delete',
  SYSTEM = 'system',
  POLL = 'poll',
  LOCATION = 'location',
  CONTACT = 'contact',
}

export class MessageVariantDetector {
  static detect(rawMessage: any): MessageVariant {
    // System messages
    if (rawMessage.isSystemMessage || rawMessage.type === 'notification') {
      return MessageVariant.SYSTEM;
    }

    // Reactions
    if (rawMessage.type === 'reaction' || rawMessage.reaction) {
      return MessageVariant.REACTION;
    }

    // Edits
    if (rawMessage.edit || rawMessage.editedMessage) {
      return MessageVariant.EDIT;
    }

    // Deletes
    if (rawMessage.delete || rawMessage.deletedMessage) {
      return MessageVariant.DELETE;
    }

    // Media
    if (rawMessage.media || rawMessage.image || rawMessage.video || 
        rawMessage.audio || rawMessage.document) {
      return MessageVariant.MEDIA;
    }

    // Location
    if (rawMessage.location || rawMessage.latitude || rawMessage.longitude) {
      return MessageVariant.LOCATION;
    }

    // Contact
    if (rawMessage.contact || rawMessage.vcard) {
      return MessageVariant.CONTACT;
    }

    // Poll
    if (rawMessage.poll || rawMessage.pollOptions) {
      return MessageVariant.POLL;
    }

    // Command
    const text = rawMessage.text || '';
    if (text.match(/^[/!][a-zA-Z0-9_-]+/)) {
      return MessageVariant.COMMAND;
    }

    // Default
    return MessageVariant.TEXT;
  }

  static parseCommand(text: string): { name: string; args: Record<string, string> } | null {
    const match = text.match(/^[/!]([a-zA-Z0-9_-]+)(?:\\s+(.*))?$/);
    if (!match) return null;

    const name = match[1].toLowerCase();
    const argsStr = match[2] || '';
    const args: Record<string, string> = {};
    const parts = argsStr.split(/\\s+/);
    
    for (const part of parts) {
      if (part.includes('=')) {
        const [key, value] = part.split('=');
        args[key] = value;
      } else {
        args[`arg${Object.keys(args).length}`] = part;
      }
    }

    return { name, args };
  }

  static extractMetadata(rawMessage: any, variant: MessageVariant): any {
    const metadata: any = {};

    switch (variant) {
      case MessageVariant.MEDIA:
        metadata.mediaUrl = rawMessage.media?.url || rawMessage.mediaUrl;
        metadata.mediaType = this.detectMediaType(rawMessage);
        metadata.mediaSize = rawMessage.media?.size || rawMessage.mediaSize;
        break;

      case MessageVariant.REACTION:
        metadata.reactionEmoji = rawMessage.reaction || rawMessage.reactionEmoji;
        break;

      case MessageVariant.EDIT:
        metadata.editedMessageId = rawMessage.editedMessage?.id || rawMessage.editedMessageId;
        break;

      case MessageVariant.DELETE:
        metadata.deletedMessageId = rawMessage.deletedMessage?.id || rawMessage.deletedMessageId;
        break;

      case MessageVariant.LOCATION:
        metadata.latitude = rawMessage.location?.latitude || rawMessage.latitude;
        metadata.longitude = rawMessage.location?.longitude || rawMessage.longitude;
        metadata.address = rawMessage.location?.address || rawMessage.address;
        break;

      case MessageVariant.CONTACT:
        metadata.vcard = rawMessage.contact?.vcard || rawMessage.vcard;
        break;

      case MessageVariant.POLL:
        metadata.pollOptions = rawMessage.poll?.options || rawMessage.pollOptions || [];
        break;
    }

    return metadata;
  }

  private static detectMediaType(rawMessage: any): 'image' | 'video' | 'audio' | 'document' {
    if (rawMessage.image) return 'image';
    if (rawMessage.video) return 'video';
    if (rawMessage.audio) return 'audio';
    if (rawMessage.document) return 'document';
    return 'document';
  }
}
```

**Tests:** `tests/unit/messageVariantDetector.test.ts`

```typescript
import { MessageVariantDetector, MessageVariant } from '../../../src/utils/messageVariantDetector';

describe('MessageVariantDetector', () => {
  describe('detect', () => {
    it('detects TEXT variant', () => {
      const result = MessageVariantDetector.detect({ text: 'Hello world' });
      expect(result).toBe(MessageVariant.TEXT);
    });

    it('detects COMMAND variant', () => {
      const result = MessageVariantDetector.detect({ text: '/help' });
      expect(result).toBe(MessageVariant.COMMAND);
    });

    it('detects COMMAND variant with !', () => {
      const result = MessageVariantDetector.detect({ text: '!status' });
      expect(result).toBe(MessageVariant.COMMAND);
    });

    it('detects MEDIA variant with image', () => {
      const result = MessageVariantDetector.detect({ image: { url: 'http://...' } });
      expect(result).toBe(MessageVariant.MEDIA);
    });

    it('detects REACTION variant', () => {
      const result = MessageVariantDetector.detect({ reaction: '👍' });
      expect(result).toBe(MessageVariant.REACTION);
    });

    it('detects SYSTEM variant', () => {
      const result = MessageVariantDetector.detect({ isSystemMessage: true });
      expect(result).toBe(MessageVariant.SYSTEM);
    });

    it('detects LOCATION variant', () => {
      const result = MessageVariantDetector.detect({ latitude: 28.7041, longitude: 77.1025 });
      expect(result).toBe(MessageVariant.LOCATION);
    });
  });

  describe('parseCommand', () => {
    it('parses simple command', () => {
      const result = MessageVariantDetector.parseCommand('/help');
      expect(result?.name).toBe('help');
      expect(Object.keys(result?.args || {})).toHaveLength(0);
    });

    it('parses command with key=value args', () => {
      const result = MessageVariantDetector.parseCommand('/status tenant=abc role=admin');
      expect(result?.name).toBe('status');
      expect(result?.args.tenant).toBe('abc');
      expect(result?.args.role).toBe('admin');
    });

    it('parses command with positional args', () => {
      const result = MessageVariantDetector.parseCommand('/create lead john');
      expect(result?.name).toBe('create');
      expect(result?.args.arg0).toBe('lead');
      expect(result?.args.arg1).toBe('john');
    });

    it('returns null for non-command text', () => {
      const result = MessageVariantDetector.parseCommand('Hello world');
      expect(result).toBeNull();
    });
  });

  describe('extractMetadata', () => {
    it('extracts media metadata', () => {
      const metadata = MessageVariantDetector.extractMetadata(
        { image: { url: 'http://...', size: 1024 } },
        MessageVariant.MEDIA
      );
      expect(metadata.mediaUrl).toBe('http://...');
      expect(metadata.mediaType).toBe('image');
      expect(metadata.mediaSize).toBe(1024);
    });

    it('extracts location metadata', () => {
      const metadata = MessageVariantDetector.extractMetadata(
        { latitude: 28.7041, longitude: 77.1025, address: 'Delhi' },
        MessageVariant.LOCATION
      );
      expect(metadata.latitude).toBe(28.7041);
      expect(metadata.longitude).toBe(77.1025);
      expect(metadata.address).toBe('Delhi');
    });
  });
});
```

### Step 1.2: Enhance WebhookLog Table Schema

**Migration Script:** `scripts/migrate-webhooklog-v2.ts`

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const client = new DynamoDBClient({ region: 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const OLD_TABLE = 'WebhookLog';
const NEW_TABLE = 'WebhookLog-v2';

async function migrateData() {
  console.log('Starting WebhookLog migration...');

  let lastEvaluatedKey: any = undefined;
  let migratedCount = 0;
  let errorCount = 0;

  do {
    try {
      const result = await docClient.send(new ScanCommand({
        TableName: OLD_TABLE,
        Limit: 100,
        ExclusiveStartKey: lastEvaluatedKey,
      }));

      for (const item of result.Items || []) {
        try {
          const messageHash = item.messageId 
            ? crypto.createHash('sha256').update(item.messageId).digest('hex')
            : crypto.createHash('sha256').update(item.webhookEventId).digest('hex');

          const newItem = {
            ...item,
            messageHash,
            status: item.status || 'completed',
            retryCount: 0,
            createdAt: item.processedAt,
            updatedAt: new Date().toISOString(),
          };

          await docClient.send(new PutCommand({
            TableName: NEW_TABLE,
            Item: newItem,
          }));

          migratedCount++;
        } catch (err) {
          console.error('Error migrating item:', item.webhookEventId, err);
          errorCount++;
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } catch (err) {
      console.error('Error scanning old table:', err);
      break;
    }
  } while (lastEvaluatedKey);

  console.log(`Migration complete: ${migratedCount} items migrated, ${errorCount} errors`);
}

migrateData().catch(console.error);
```

**CloudFormation Update:** `infra/cfn-backend.yaml`

```yaml
WebhookLogTableV2:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: WebhookLog-v2
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: webhookEventId
        AttributeType: S
      - AttributeName: messageHash
        AttributeType: S
      - AttributeName: tenantId
        AttributeType: S
      - AttributeName: processedAt
        AttributeType: S
    KeySchema:
      - AttributeName: webhookEventId
        KeyType: HASH
      - AttributeName: messageHash
        KeyType: RANGE
    GlobalSecondaryIndexes:
      - IndexName: TenantIdMessageHashIndex
        KeySchema:
          - AttributeName: tenantId
            KeyType: HASH
          - AttributeName: messageHash
            KeyType: RANGE
        Projection:
          ProjectionType: ALL
      - IndexName: TenantIdProcessedAtIndex
        KeySchema:
          - AttributeName: tenantId
            KeyType: HASH
          - AttributeName: processedAt
            KeyType: RANGE
        Projection:
          ProjectionType: ALL
    TimeToLiveSpecification:
      AttributeName: ttl
      Enabled: true
    Tags:
      - Key: Component
        Value: Webhooks
```

### Step 1.3: Implement Deduplication Service

**File:** `src/services/idempotencyService.ts`

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { logger } from '../logger';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const WEBHOOK_LOG_TABLE = process.env.WEBHOOK_LOG_TABLE || 'WebhookLog-v2';

export interface DeduplicationResult {
  isDuplicate: boolean;
  isDuplicateContent: boolean;
  isReplay: boolean;
  webhookLogId: string;
  previousResult?: any;
}

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
    try {
      const result = await docClient.send(new GetCommand({
        TableName: WEBHOOK_LOG_TABLE,
        Key: { webhookEventId },
      }));

      if (result.Item) {
        logger.info('idempotencyService.eventDuplicate', { webhookEventId });
        return { isDuplicate: true, previousResult: result.Item.result };
      }

      return { isDuplicate: false };
    } catch (err) {
      logger.error('idempotencyService.checkEventDuplicate.failed', { webhookEventId, error: err.message });
      throw err;
    }
  }

  static async checkMessageDuplicate(
    tenantId: string,
    message: { from: string; to: string; text: string; createdAt?: string }
  ): Promise<{ isDuplicate: boolean; previousResult?: any }> {
    const messageHash = this.computeMessageHash(message);
    const lookbackWindow = 5 * 60 * 1000; // 5 minutes
    const cutoff = new Date(Date.now() - lookbackWindow).toISOString();

    try {
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
        logger.info('idempotencyService.messageDuplicate', { tenantId, messageHash });
        return { isDuplicate: true, previousResult: result.Items[0].result };
      }

      return { isDuplicate: false };
    } catch (err) {
      logger.error('idempotencyService.checkMessageDuplicate.failed', { tenantId, error: err.message });
      throw err;
    }
  }

  static checkReplayAttack(eventTimestamp: number, maxAgeMs: number = 5 * 60 * 1000): boolean {
    const now = Date.now();
    const eventTimeMs = typeof eventTimestamp === 'number' ? eventTimestamp * 1000 : eventTimestamp;
    return now - eventTimeMs > maxAgeMs;
  }

  static async logEventIfNotProcessed(
    webhookEventId: string,
    messageHash: string,
    eventType: string,
    tenantId?: string,
    idempotencyKey?: string
  ): Promise<{ processed: boolean; isDuplicate: boolean; previousResult?: any }> {
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

    try {
      await docClient.send(new PutCommand({
        TableName: WEBHOOK_LOG_TABLE,
        Item: {
          webhookEventId,
          messageHash,
          processedAt: now,
          eventType,
          tenantId: tenantId || null,
          idempotencyKey: idempotencyKey || webhookEventId,
          status: 'processing',
          retryCount: 0,
          createdAt: now,
          updatedAt: now,
          ttl,
        },
        ConditionExpression: 'attribute_not_exists(webhookEventId)',
      }));
      return { processed: true, isDuplicate: false };
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        const result = await docClient.send(new GetCommand({
          TableName: WEBHOOK_LOG_TABLE,
          Key: { webhookEventId },
        }));
        return {
          processed: false,
          isDuplicate: true,
          previousResult: result.Item?.result,
        };
      }
      throw err;
    }
  }

  static async markEventCompleted(webhookEventId: string, result: any): Promise<void> {
    await docClient.send(new UpdateCommand({
      TableName: WEBHOOK_LOG_TABLE,
      Key: { webhookEventId },
      UpdateExpression: 'SET #status = :status, #result = :result, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#result': 'result',
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':result': result,
        ':now': new Date().toISOString(),
      },
    }));
  }

  static async markEventFailed(webhookEventId: string, error: string, retryable: boolean = true): Promise<void> {
    const updateExpression = retryable
      ? 'SET #status = :status, errorMessage = :error, retryCount = retryCount + :one, updatedAt = :now'
      : 'SET #status = :status, errorMessage = :error, updatedAt = :now';

    await docClient.send(new UpdateCommand({
      TableName: WEBHOOK_LOG_TABLE,
      Key: { webhookEventId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': retryable ? 'pending' : 'failed',
        ':error': error,
        ':one': 1,
        ':now': new Date().toISOString(),
      },
    }));
  }
}

export const idempotencyService = new IdempotencyService();
```

### Step 1.4: Update Webhook Handler

**File:** `server/routes/webhooks.js` (updated)

```javascript
import { MessageVariantDetector } from '../src/utils/messageVariantDetector.js';
import { idempotencyService } from '../src/services/idempotencyService.js';

router.post('/whatsapp', webhookRateLimit, async (req, res) => {
  try {
    logger.info('webhooks.whatsapp.received', { headers: req.headers });

    if (!isBaileyEnabled()) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'bailey_disabled' });
    }

    const rawBody = req.body;
    const signature = req.headers['x-bailey-signature'];
    const timestamp = req.headers['x-bailey-timestamp'];

    if (!verifyBaileySignature(rawBody, signature, timestamp)) {
      logger.warn('webhooks.whatsapp.invalid_signature');
      return res.status(401).json({ error: 'invalid_signature' });
    }

    let body;
    try {
      body = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ error: 'invalid_json' });
    }

    const messageId = body.messageId || body.id || crypto.randomUUID();
    const { from, to, text, media, fromJid } = body;

    logger.info('webhooks.whatsapp.parsed', { messageId, from, to, text });

    // NEW: Detect message variant
    const variant = MessageVariantDetector.detect(body);
    const metadata = MessageVariantDetector.extractMetadata(body, variant);
    let commandInfo = null;
    if (variant === 'command') {
      commandInfo = MessageVariantDetector.parseCommand(text);
    }

    logger.info('webhooks.whatsapp.variant_detected', { messageId, variant, command: commandInfo?.name });

    // NEW: Enhanced idempotency check
    const messageHash = idempotencyService.computeMessageHash({
      from,
      to,
      text,
      createdAt: body.createdAt,
    });

    const tenantId = await resolveTenantByWhatsAppNumber(to);
    if (!tenantId) {
      logger.info('webhooks.whatsapp.unknown_number', { to });
      return res.status(200).json({ ok: true, skipped: true, reason: 'unknown_number' });
    }

    const idempotency = await idempotencyService.logEventIfNotProcessed(
      `bailey:${messageId}`,
      messageHash,
      'whatsapp.incoming',
      tenantId
    );
    if (idempotency.isDuplicate) {
      logger.info('webhooks.whatsapp.duplicate', { messageId, tenantId });
      return res.status(200).json({ ok: true, duplicate: true });
    }

    // ... rest of webhook handler
  } catch (err) {
    logger.error('webhooks.whatsapp.error', { error: err.message, stack: err.stack });
    return res.status(200).json({ ok: true, error: 'processing_failed' });
  }
});
```

---

## Phase 2: Intelligence (Weeks 3-4)

### Step 2.1: Implement Echo Detection Service

**File:** `src/services/echoDetectionService.ts`

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { logger } from '../logger';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const WHATSAPP_TABLE = process.env.CRM_DYNAMODB_TABLE_NAME;

export enum EchoReason {
  SELF_SEND = 'self-send',
  GROUP_ECHO = 'group-echo',
  REPLY_LOOP = 'reply-loop',
  DUPLICATE_DELIVERY = 'duplicate-delivery',
}

export class EchoDetectionService {
  private echoCache: Map<string, any> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_CACHE_SIZE = 10000;

  async detectEcho(
    message: any,
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

  private isSelfSend(message: any): boolean {
    const normalizedFrom = this.normalizePhone(message.from);
    const normalizedTo = this.normalizePhone(message.to);
    return normalizedFrom === normalizedTo && normalizedFrom !== null;
  }

  private async detectGroupEcho(message: any, tenantId: string): Promise<string | null> {
    if (!message.to.includes('@g.us')) {
      return null;
    }

    const recentOutbound = await this.findRecentOutboundMessage(
      tenantId,
      message.to,
      message.text,
      5 * 60 * 1000
    );

    return recentOutbound?.messageId || null;
  }

  private async detectReplyLoop(message: any, tenantId: string): Promise<string | null> {
    if (!message.replyToMessageId) {
      return null;
    }

    const repliedTo = await this.fetchMessage(tenantId, message.replyToMessageId);
    if (!repliedTo || !repliedTo.replyToMessageId) {
      return null;
    }

    const repliedToReply = await this.fetchMessage(tenantId, repliedTo.replyToMessageId);
    if (!repliedToReply) {
      return null;
    }

    const normalizedCurrentFrom = this.normalizePhone(message.from);
    const normalizedLoopFrom = this.normalizePhone(repliedToReply.from);

    if (normalizedCurrentFrom === normalizedLoopFrom) {
      return repliedToReply.messageId;
    }

    return null;
  }

  private async detectDuplicateDelivery(message: any, tenantId: string): Promise<string | null> {
    const cacheKey = `${tenantId}:${message.messageId}`;
    if (this.echoCache.has(cacheKey)) {
      return message.messageId;
    }

    const duplicate = await this.findRecentMessageByContent(
      tenantId,
      message.from,
      message.to,
      message.text,
      2 * 60 * 1000
    );

    return duplicate?.messageId || null;
  }

  private async findRecentOutboundMessage(
    tenantId: string,
    to: string,
    text: string,
    windowMs: number
  ): Promise<{ messageId: string; createdAt: string } | null> {
    const cutoff = new Date(Date.now() - windowMs).toISOString();

    try {
      const result = await docClient.send(new QueryCommand({
        TableName: WHATSAPP_TABLE,
        IndexName: 'TenantIdDirectionIndex',
        KeyConditionExpression: 'tenantId = :tenantId AND #direction = :direction',
        FilterExpression: 'contactPhone = :to AND #text = :text AND createdAt > :cutoff',
        ExpressionAttributeNames: {
          '#direction': 'direction',
          '#text': 'text',
        },
        ExpressionAttributeValues: {
          ':tenantId': tenantId,
          ':direction': 'outbound',
          ':to': to,
          ':text': text,
          ':cutoff': cutoff,
        },
        Limit: 1,
      }));

      return result.Items?.[0] || null;
    } catch (err) {
      logger.warn('echoDetectionService.findRecentOutboundMessage.failed', { error: err.message });
      return null;
    }
  }

  private async findRecentMessageByContent(
    tenantId: string,
    from: string,
    to: string,
    text: string,
    windowMs: number
  ): Promise<{ messageId: string; createdAt: string } | null> {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    const contentHash = this.hashContent(text);

    try {
      const result = await docClient.send(new QueryCommand({
        TableName: WHATSAPP_TABLE,
        IndexName: 'TenantIdContentHashIndex',
        KeyConditionExpression: 'tenantId = :tenantId AND contentHash = :hash',
        FilterExpression: 'createdAt > :cutoff',
        ExpressionAttributeValues: {
          ':tenantId': tenantId,
          ':hash': contentHash,
          ':cutoff': cutoff,
        },
        Limit: 1,
      }));

      return result.Items?.[0] || null;
    } catch (err) {
      logger.warn('echoDetectionService.findRecentMessageByContent.failed', { error: err.message });
      return null;
    }
  }

  private async fetchMessage(tenantId: string, messageId: string): Promise<any> {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: WHATSAPP_TABLE,
        IndexName: 'MessageIdIndex',
        KeyConditionExpression: 'messageId = :messageId',
        ExpressionAttributeValues: { ':messageId': messageId },
        Limit: 1,
      }));
      return result.Items?.[0] || null;
    } catch (err) {
      logger.warn('echoDetectionService.fetchMessage.failed', { messageId, error: err.message });
      return null;
    }
  }

  private normalizePhone(phone: string): string | null {
    const cleaned = phone.replace(/@(s\\.whatsapp\\.net|g\\.us|lid)$/, '');
    const digits = cleaned.replace(/\\D/g, '');
    return digits.length > 0 ? digits : null;
  }

  private hashContent(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  private cleanupCache(): void {
    if (this.echoCache.size > this.MAX_CACHE_SIZE) {
      const entriesToRemove = Math.floor(this.MAX_CACHE_SIZE * 0.25);
      let removed = 0;
      for (const [key] of this.echoCache) {
        if (removed >= entriesToRemove) break;
        this.echoCache.delete(key);
        removed++;
      }
    }
  }
}

export const echoDetectionService = new EchoDetectionService();
```

### Step 2.2: Implement Command Registry & Authorization

**File:** `src/commands/commandRegistry.ts`

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

export interface CommandContext {
  messageId: string;
  tenantId: string;
  userId: string;
  role: 'admin' | 'manager' | 'agent' | 'user';
  permissions: string[];
  command: {
    name: string;
    args: Record<string, string>;
  };
  message: any;
}

export interface CommandResult {
  success: boolean;
  response: string;
  data?: any;
  error?: string;
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

export const commandRegistry = new CommandRegistry();

// Register built-in commands
commandRegistry.register({
  name: 'help',
  description: 'Show available commands',
  aliases: ['h', '?'],
  requiredRole: 'user',
  requiredPermissions: [],
  schema: {
    args: {
      command: { type: 'string', required: false, description: 'Specific command to get help for' },
    },
  },
  handler: async (context) => {
    const { command } = context.command.args;
    if (command) {
      const cmd = commandRegistry.resolve(command);
      if (!cmd) {
        return { success: false, response: `Command '${command}' not found`, error: 'COMMAND_NOT_FOUND' };
      }
      return {
        success: true,
        response: `**${cmd.name}**\\n${cmd.description}\\n\\nUsage: /${cmd.name} ${Object.keys(cmd.schema.args).join(' ')}`,
      };
    }
    const commands = commandRegistry.listCommands(context.role);
    const list = commands.map(c => `/${c.name} — ${c.description}`).join('\\n');
    return { success: true, response: `Available commands:\\n${list}` };
  },
});

commandRegistry.register({
  name: 'status',
  description: 'Show AI Employee status',
  aliases: ['stat'],
  requiredRole: 'manager',
  requiredPermissions: ['view:ai-employee-status'],
  schema: { args: {} },
  handler: async (context) => {
    return { success: true, response: 'AI Employee is online and ready.' };
  },
});
```

**File:** `src/middleware/commandAuthorization.ts`

```typescript
import { commandRegistry } from '../commands/commandRegistry';

export class CommandAuthorizationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CommandAuthorizationError';
  }
}

export async function authorizeCommand(context: any): Promise<{ authorized: boolean; reason?: string }> {
  const definition = commandRegistry.resolve(context.command.name);
  
  if (!definition) {
    return { authorized: false, reason: 'COMMAND_NOT_FOUND' };
  }

  // 1. Check role
  const roleHierarchy = { admin: 3, manager: 2, agent: 1, user: 0 };
  if (roleHierarchy[context.role] < roleHierarchy[definition.requiredRole]) {
    return {
      authorized: false,
      reason: `INSUFFICIENT_ROLE: requires ${definition.requiredRole}, user has ${context.role}`,
    };
  }

  // 2. Check permissions
  const missingPermissions = definition.requiredPermissions.filter(
    p => !context.permissions.includes(p)
  );
  if (missingPermissions.length > 0) {
    return {
      authorized: false,
      reason: `MISSING_PERMISSIONS: ${missingPermissions.join(', ')}`,
    };
  }

  // 3. Validate arguments
  for (const [argName, argDef] of Object.entries(definition.schema.args)) {
    if (argDef.required && !context.command.args[argName]) {
      return {
        authorized: false,
        reason: `MISSING_REQUIRED_ARG: ${argName}`,
      };
    }
    if (context.command.args[argName]) {
      const value = context.command.args[argName];
      if (argDef.type === 'number' && isNaN(Number(value))) {
        return {
          authorized: false,
          reason: `INVALID_ARG_TYPE: ${argName} must be a number`,
        };
      }
    }
  }

  return { authorized: true };
}
```

---

## Phase 3: Reliability (Weeks 5-6)

### Step 3.1: Implement Circuit Breaker

**File:** `src/services/circuitBreaker.ts`

```typescript
import { logger } from '../logger';

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly name: string;

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name;
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        logger.info('circuitBreaker.transition', { name: this.name, from: 'OPEN', to: 'HALF_OPEN' });
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
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
        logger.info('circuitBreaker.transition', { name: this.name, from: 'HALF_OPEN', to: 'CLOSED' });
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.config.failureThreshold) {
      logger.warn('circuitBreaker.transition', { name: this.name, from: 'CLOSED', to: 'OPEN' });
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): { state: CircuitState; failureCount: number; successCount: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }
}
```

### Step 3.2: Implement Retry Logic

**File:** `src/services/webhookReliabilityService.ts`

```typescript
import { CircuitBreaker, CircuitBreakerConfig } from './circuitBreaker';
import { logger } from '../logger';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

export class WebhookReliabilityService {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  };

  async executeWithRetry<T>(
    webhookId: string,
    handler: () => Promise<T>,
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    const circuitBreaker = this.getOrCreateCircuitBreaker(webhookId);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await circuitBreaker.execute(handler);
      } catch (err) {
        lastError = err;
        logger.warn('webhookReliabilityService.attempt.failed', {
          webhookId,
          attempt,
          error: err.message,
        });

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

    throw lastError || new Error('Webhook execution failed after retries');
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

  private getOrCreateCircuitBreaker(webhookId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(webhookId)) {
      this.circuitBreakers.set(
        webhookId,
        new CircuitBreaker(webhookId, {
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 60000,
        })
      );
    }
    return this.circuitBreakers.get(webhookId)!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const webhookReliabilityService = new WebhookReliabilityService();
```

---

## Testing Checklist

- [ ] Unit tests for MessageVariantDetector (80% coverage)
- [ ] Unit tests for IdempotencyService (80% coverage)
- [ ] Unit tests for EchoDetectionService (80% coverage)
- [ ] Unit tests for CommandRegistry (80% coverage)
- [ ] Unit tests for CircuitBreaker (80% coverage)
- [ ] Integration tests for webhook flow
- [ ] Integration tests for echo detection
- [ ] Integration tests for command execution
- [ ] Load tests (1000 concurrent requests)
- [ ] Latency tests (p99 < 100ms)
- [ ] Security tests (authorization bypass attempts)
- [ ] Chaos engineering tests (failure scenarios)

---

## Deployment Checklist

- [ ] Create new DynamoDB tables (WebhookLog-v2, DLQ)
- [ ] Run data migration script
- [ ] Validate data integrity
- [ ] Deploy code changes
- [ ] Enable feature flags (one at a time)
- [ ] Monitor metrics (latency, error rate, duplicates)
- [ ] Verify echo detection accuracy
- [ ] Test command execution
- [ ] Verify retry logic
- [ ] Check DLQ processing
- [ ] Collect feedback from team
- [ ] Document lessons learned

---

## Monitoring & Observability

### Key Metrics to Track

1. **Webhook Processing Latency**
   - p50, p95, p99
   - By event type
   - By webhook source

2. **Duplicate Detection Rate**
   - Event-based duplicates
   - Content-based duplicates
   - False positives

3. **Echo Detection Rate**
   - Self-sends detected
   - Group echoes detected
   - Reply loops detected
   - False positives

4. **Command Execution**
   - Commands executed per hour
   - Success rate
   - Authorization failures

5. **Retry Success Rate**
   - Successful retries
   - Failed retries
   - DLQ entries

6. **Circuit Breaker State**
   - State transitions
   - Time in OPEN state
   - Recovery time

---

## Rollback Plan

If issues occur:

1. **Disable feature flags** (immediate)
   ```bash
   export FEATURE_ECHO_DETECTION=false
   export FEATURE_COMMAND_AUTH=false
   export FEATURE_REPLY_THREADING=false
   export FEATURE_WEBHOOK_RETRY=false
   ```

2. **Revert to old webhook handler** (if needed)
   ```bash
   git revert <commit-hash>
   npm run build
   npm run deploy
   ```

3. **Restore from backup** (if data corruption)
   ```bash
   aws dynamodb restore-table-from-backup \
     --target-table-name WebhookLog \
     --backup-arn <backup-arn>
   ```

4. **Notify team** via Slack/email

5. **Post-mortem** within 24 hours

---

## Support & Escalation

- **On-call engineer:** Check Slack #on-call channel
- **Escalation:** @engineering-leads
- **Urgent issues:** Page on-call via PagerDuty
- **Post-incident:** Create GitHub issue with `incident` label

---

## Additional Resources

- Design document: `MESSAGE_PROCESSING_DESIGN.md`
- Architecture diagram: `MESSAGE_PROCESSING_ARCHITECTURE.png`
- API documentation: `MESSAGE_PROCESSING_API.md`
- Runbook: `MESSAGE_PROCESSING_RUNBOOK.md`
