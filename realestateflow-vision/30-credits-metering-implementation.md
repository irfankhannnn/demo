# 30 — Credits & Metering Implementation

> **Phase:** 2 (ledger + metering) · **Infra:** CloudFormation only · **Status:** Implementation spec

---

## Overview

The credit system is **0% implemented** in the codebase. The AI calling service, Bedrock API calls, and WhatsApp sends currently run without any cost tracking or budget caps. This document specifies the complete credit/metering stack from ledger to enforcement.

**Design principles:**
- 1 credit ≈ ₹0.10 (keeps numbers human-readable)
- Prepaid: tenants buy credit packs; system deducts per action
- Hard cap: actions that exceed balance are rejected (not silently over-billed)
- Audit trail: every deduction logged with action type, agent ID, model, token count
- Multi-model routing: cheapest capable model first; cost fed back to ledger

---

## Credit Pricing Reference

| Action | Credits | ₹ cost | Notes |
|--------|---------|--------|-------|
| WhatsApp message (inbound processing) | 1 | ₹0.10 | Router + qualifier run |
| WhatsApp message (outbound, AI-authored) | 1 | ₹0.10 | Sales assistant reply |
| AI voice call per minute (inbound) | 5 | ₹0.50 | ElevenLabs TTS + Exotel |
| AI voice call per minute (outbound) | 8 | ₹0.80 | Outbound + ElevenLabs |
| Lead qualification (full flow) | 2 | ₹0.20 | Router + qualifier agents |
| Image generation (Higgsfield/Nano) | 20 | ₹2.00 | Per image |
| Video generation (short, <30s) | 50 | ₹5.00 | Per video |
| Ad campaign creation (Meta) | 30 | ₹3.00 | Includes creative + setup |
| Portal listing post (99acres etc.) | 10 | ₹1.00 | Browser automation |
| Marketing campaign (full) | 100 | ₹10.00 | End-to-end campaign |
| Follow-up journey step | 1 | ₹0.10 | Per touchpoint sent |
| Knowledge base query (RAG) | 0.5 | ₹0.05 | Bedrock KB retrieve |

## Credit Pack Pricing

| Pack | Credits | Price | Per credit |
|------|---------|-------|-----------|
| Starter | 500 | ₹50 | ₹0.10 |
| Growth | 2,000 | ₹180 | ₹0.09 |
| Scale | 5,000 | ₹400 | ₹0.08 |
| Enterprise | 10,000 | ₹700 | ₹0.07 |

---

## PostgreSQL Schema (Phase 2, doc 27)

These tables live in Aurora Serverless v2 alongside the agent/analytics tables already specified in doc 27.

```sql
-- Credit balance per tenant
CREATE TABLE credits (
    tenant_id       VARCHAR(128) NOT NULL PRIMARY KEY,
    balance         NUMERIC(12,2) NOT NULL DEFAULT 0,
    lifetime_spent  NUMERIC(12,2) NOT NULL DEFAULT 0,
    last_purchase   TIMESTAMPTZ,
    hard_cap        NUMERIC(12,2),          -- NULL = no cap, otherwise block at 0
    alert_threshold NUMERIC(12,2),          -- send alert when balance drops below
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every credit event (purchase or deduction)
CREATE TABLE credit_ledger (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(128) NOT NULL REFERENCES credits(tenant_id),
    event_type      VARCHAR(32) NOT NULL,   -- 'purchase' | 'deduct' | 'refund' | 'admin_grant'
    action_type     VARCHAR(64),            -- 'whatsapp_inbound' | 'voice_min' | etc.
    amount          NUMERIC(8,2) NOT NULL,  -- positive=credit, negative=debit
    balance_after   NUMERIC(12,2) NOT NULL,
    agent_id        VARCHAR(128),
    model_id        VARCHAR(64),            -- 'claude-haiku-4-5' | 'claude-sonnet-4-6' | etc.
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    vendor_cost_usd NUMERIC(8,6),           -- actual AWS/vendor cost in USD
    razorpay_order_id VARCHAR(128),         -- for purchases
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_credit_ledger_tenant ON credit_ledger(tenant_id, created_at DESC);
CREATE INDEX idx_credit_ledger_action ON credit_ledger(tenant_id, action_type, created_at DESC);

-- Per-action usage for analytics
CREATE TABLE agent_usage (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(128) NOT NULL,
    agent_id        VARCHAR(128) NOT NULL,
    action_type     VARCHAR(64) NOT NULL,
    model_id        VARCHAR(64),
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    latency_ms      INTEGER,
    credits_charged NUMERIC(6,2) NOT NULL,
    success         BOOLEAN NOT NULL DEFAULT TRUE,
    error_code      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agent_usage_tenant ON agent_usage(tenant_id, created_at DESC);
```

---

## Service Layer — CreditService

**File:** `server/services/creditService.js`

```js
import { knex } from '../db/knex.js';

export class CreditService {
  /**
   * Deduct credits atomically. Returns { ok: true } or throws InsufficientCreditsError.
   * Uses a transaction + SELECT FOR UPDATE to prevent race conditions.
   */
  static async deduct(tenantId, { actionType, amount, agentId, modelId,
                                   inputTokens, outputTokens, vendorCostUsd, metadata }) {
    return knex.transaction(async (trx) => {
      // Lock the row
      const [credit] = await trx('credits')
        .where({ tenant_id: tenantId })
        .forUpdate()
        .select('balance', 'hard_cap');

      if (!credit) throw new Error(`Credits not initialized for tenant ${tenantId}`);

      if (credit.balance < amount) {
        throw new InsufficientCreditsError(tenantId, credit.balance, amount);
      }

      const balanceAfter = parseFloat(credit.balance) - amount;

      await trx('credits')
        .where({ tenant_id: tenantId })
        .update({
          balance: balanceAfter,
          lifetime_spent: knex.raw('lifetime_spent + ?', [amount]),
          updated_at: knex.fn.now(),
        });

      const [ledgerRow] = await trx('credit_ledger').insert({
        tenant_id: tenantId,
        event_type: 'deduct',
        action_type: actionType,
        amount: -amount,
        balance_after: balanceAfter,
        agent_id: agentId,
        model_id: modelId,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        vendor_cost_usd: vendorCostUsd,
        metadata,
      }).returning('id');

      return { ok: true, balanceAfter, ledgerId: ledgerRow.id };
    });
  }

  /**
   * Add credits (purchase or admin grant). Always succeeds.
   */
  static async credit(tenantId, { amount, eventType = 'purchase',
                                   razorpayOrderId, metadata }) {
    return knex.transaction(async (trx) => {
      await trx('credits')
        .insert({ tenant_id: tenantId, balance: amount })
        .onConflict('tenant_id')
        .merge({
          balance: knex.raw('credits.balance + ?', [amount]),
          last_purchase: eventType === 'purchase' ? knex.fn.now() : knex.raw('last_purchase'),
          updated_at: knex.fn.now(),
        });

      const balanceAfter = (await trx('credits')
        .where({ tenant_id: tenantId })
        .select('balance'))[0].balance;

      await trx('credit_ledger').insert({
        tenant_id: tenantId,
        event_type: eventType,
        amount,
        balance_after: balanceAfter,
        razorpay_order_id: razorpayOrderId,
        metadata,
      });

      return { ok: true, balanceAfter };
    });
  }

  static async getBalance(tenantId) {
    const row = await knex('credits').where({ tenant_id: tenantId }).first();
    return row?.balance ?? 0;
  }

  static async getHistory(tenantId, { limit = 50, offset = 0 } = {}) {
    return knex('credit_ledger')
      .where({ tenant_id: tenantId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
  }
}

export class InsufficientCreditsError extends Error {
  constructor(tenantId, balance, required) {
    super(`Insufficient credits for ${tenantId}: has ${balance}, needs ${required}`);
    this.code = 'INSUFFICIENT_CREDITS';
    this.tenantId = tenantId;
    this.balance = balance;
    this.required = required;
  }
}
```

---

## Metering Middleware

**File:** `server/middleware/meterCredits.js`

```js
import { CreditService, InsufficientCreditsError } from '../services/creditService.js';
import { CREDIT_COSTS } from '../config/creditCosts.js';

/**
 * Factory: wraps an action type with credit gate.
 * Usage: router.post('/send', meterCredits('whatsapp_outbound'), handler)
 */
export function meterCredits(actionType) {
  const cost = CREDIT_COSTS[actionType];
  if (cost === undefined) throw new Error(`Unknown action type: ${actionType}`);

  return async (req, res, next) => {
    const { tenantId } = req;
    try {
      // Reserve credits (deduct before action; refund on error if needed)
      const result = await CreditService.deduct(tenantId, {
        actionType,
        amount: cost,
        metadata: { path: req.path, method: req.method },
      });
      req.creditLedgerId = result.ledgerId; // for downstream logging
      next();
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return res.status(402).json({
          error: 'insufficient_credits',
          balance: err.balance,
          required: err.required,
          message: 'You have run out of credits. Top up to continue.',
        });
      }
      next(err);
    }
  };
}
```

**File:** `server/config/creditCosts.js`

```js
export const CREDIT_COSTS = {
  whatsapp_inbound:      1,
  whatsapp_outbound:     1,
  voice_inbound_per_min: 5,
  voice_outbound_per_min:8,
  lead_qualification:    2,
  image_generation:      20,
  video_generation:      50,
  ad_campaign_create:    30,
  portal_listing_post:   10,
  marketing_campaign:    100,
  followup_step:         1,
  rag_query:             0.5,
};
```

---

## Multi-Model Router

**File:** `server/services/modelRouter.js`

Route to the cheapest model that can handle the task. Costs based on ap-south-1 Bedrock pricing.

```js
const MODEL_CONFIG = {
  'claude-haiku-4-5-20251001': {
    inputPricePerMToken:  0.80,   // USD per million input tokens
    outputPricePerMToken: 4.00,
    maxContextTokens: 200_000,
    capabilities: ['classify', 'route', 'score', 'simple_qa'],
  },
  'claude-sonnet-4-6': {
    inputPricePerMToken:  3.00,
    outputPricePerMToken: 15.00,
    maxContextTokens: 200_000,
    capabilities: ['classify', 'route', 'score', 'simple_qa', 'tool_use', 'conversation', 'draft'],
  },
  'claude-opus-4-8': {
    inputPricePerMToken:  15.00,
    outputPricePerMToken: 75.00,
    maxContextTokens: 200_000,
    capabilities: ['classify', 'route', 'score', 'simple_qa', 'tool_use', 'conversation',
                   'draft', 'complex_reasoning', 'multi_step_planning'],
  },
};

const TASK_MODEL_MAP = {
  classify:            'claude-haiku-4-5-20251001',
  route:               'claude-haiku-4-5-20251001',
  score:               'claude-haiku-4-5-20251001',
  simple_qa:           'claude-haiku-4-5-20251001',
  tool_use:            'claude-sonnet-4-6',
  conversation:        'claude-sonnet-4-6',
  draft:               'claude-sonnet-4-6',
  complex_reasoning:   'claude-opus-4-8',
  multi_step_planning: 'claude-opus-4-8',
};

export function selectModel(taskType) {
  return TASK_MODEL_MAP[taskType] ?? 'claude-haiku-4-5-20251001';
}

/**
 * Calculate vendor cost in USD from Bedrock usage response.
 */
export function calcBedrockCost(modelId, inputTokens, outputTokens) {
  const cfg = MODEL_CONFIG[modelId];
  if (!cfg) return 0;
  return (inputTokens * cfg.inputPricePerMToken / 1_000_000) +
         (outputTokens * cfg.outputPricePerMToken / 1_000_000);
}

/**
 * Convert actual vendor cost (USD) to credits.
 * Uses 3x markup on vendor cost to cover overhead + margin.
 */
export function usdToCredits(usdCost) {
  const INR_PER_USD = 84;          // update periodically or fetch from FX service
  const CREDITS_PER_INR = 10;     // 1 credit = ₹0.10
  const MARKUP = 3;
  return Math.ceil(usdCost * INR_PER_USD * CREDITS_PER_INR * MARKUP);
}
```

---

## Agent Integration — Deduct After Bedrock Call

Each agent (Router, Qualifier, Sales Assistant) should deduct credits AFTER the Bedrock call so we know exact token counts.

**Pattern for Strands/Bedrock agents:**

```js
// After invoking Bedrock:
const response = await bedrockClient.converse({ modelId, messages, ... });
const usage = response.usage; // { inputTokens, outputTokens }
const vendorCostUsd = calcBedrockCost(modelId, usage.inputTokens, usage.outputTokens);
const credits = usdToCredits(vendorCostUsd);

await CreditService.deduct(tenantId, {
  actionType: 'conversation',
  amount: credits,
  agentId: 'sales-assistant',
  modelId,
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  vendorCostUsd,
});

// Log to agent_usage table
await knex('agent_usage').insert({
  tenant_id: tenantId,
  agent_id: 'sales-assistant',
  action_type: 'conversation',
  model_id: modelId,
  input_tokens: usage.inputTokens,
  output_tokens: usage.outputTokens,
  credits_charged: credits,
  latency_ms: responseTimeMs,
  success: true,
});
```

---

## ElevenLabs Token Tracking

ElevenLabs charges per character synthesized. Track in the same ledger.

```js
// After ElevenLabs TTS call:
const charCount = text.length;
const ELEVENLABS_PRICE_PER_CHAR = 0.000030; // USD (Starter plan ~$22/750k chars)
const vendorCostUsd = charCount * ELEVENLABS_PRICE_PER_CHAR;
const credits = Math.max(1, usdToCredits(vendorCostUsd));

await CreditService.deduct(tenantId, {
  actionType: 'voice_inbound_per_min',
  amount: credits,
  agentId: 'voice-agent',
  modelId: 'elevenlabs-multilingual-v2',
  metadata: { charCount, voiceId },
  vendorCostUsd,
});
```

---

## Credit Purchase Flow (Razorpay Orders)

Credit packs are one-time purchases (Razorpay Orders, not Subscriptions).

### Backend `server/routes/credits.js`

```js
// Create order for credit pack purchase
router.post('/purchase', requireAuth, async (req, res) => {
  const { packId } = req.body;
  const PACKS = {
    starter:    { credits: 500,   amountPaise: 5000  },
    growth:     { credits: 2000,  amountPaise: 18000 },
    scale:      { credits: 5000,  amountPaise: 40000 },
    enterprise: { credits: 10000, amountPaise: 70000 },
  };

  const pack = PACKS[packId];
  if (!pack) return res.status(400).json({ error: 'Unknown pack' });

  const order = await razorpay.orders.create({
    amount: pack.amountPaise,
    currency: 'INR',
    receipt: `credits_${req.tenantId}_${Date.now()}`,
    notes: { tenantId: req.tenantId, packId, credits: pack.credits },
  });

  res.json({ orderId: order.id, amount: pack.amountPaise, credits: pack.credits });
});

// Webhook: payment.captured for credit orders
// In billing.js, extend the payment.captured case:
case 'payment.captured': {
  const notes = payload.payload.payment.entity.notes;
  if (notes?.packId) {
    // Credit pack purchase
    await CreditService.credit(notes.tenantId, {
      amount: parseInt(notes.credits),
      eventType: 'purchase',
      razorpayOrderId: payload.payload.payment.entity.order_id,
      metadata: { packId: notes.packId },
    });
  } else {
    // Subscription payment — existing handling
  }
  break;
}
```

---

## Budget Cap Enforcement

Tenants can set a monthly spend cap. Once credits fall below zero (or hit the configured threshold), all AI actions are blocked.

```js
// CreditService.deduct already throws InsufficientCreditsError when balance < amount.
// Budget alert: send email when balance drops below alert_threshold.

// After successful deduct, check alert threshold:
static async deduct(tenantId, opts) {
  const result = await knex.transaction(async (trx) => {
    // ... existing deduct logic ...
    
    // Check alert threshold
    const [{ alert_threshold }] = await trx('credits')
      .where({ tenant_id: tenantId })
      .select('alert_threshold');
    
    if (alert_threshold && balanceAfter < alert_threshold && balance >= alert_threshold) {
      // Just crossed the threshold — fire alert (non-blocking)
      setImmediate(() => sendLowCreditAlert(tenantId, balanceAfter));
    }
    
    return { ok: true, balanceAfter, ledgerId };
  });
  return result;
}
```

---

## API Routes

**File:** `server/routes/credits.js`

```
POST /api/credits/purchase          — create Razorpay order for credit pack
GET  /api/credits/balance           — current balance + alert_threshold
GET  /api/credits/history           — paginated ledger
GET  /api/credits/usage-summary     — per-action breakdown (last 30 days)
POST /api/credits/set-alert         — set alert_threshold
GET  /api/admin/credits/:tenantId   — FOUNDER: view any tenant's balance
POST /api/admin/credits/:tenantId/grant — FOUNDER: manual credit grant
```

---

## Frontend — Credits Dashboard

**Route:** `/billing/credits`

Components:
- **Balance card**: current credits, ₹ equivalent, days at current burn rate
- **Buy credits**: 4 pack options with Razorpay checkout integration
- **Usage breakdown**: bar chart by action type (last 30 days)
- **Transaction history**: paginated ledger table
- **Alert threshold**: slider to set low-balance email alert

---

## Phase 2 Knex Migration File

**File:** `server/db/migrations/003_credits.js`

```js
export async function up(knex) {
  await knex.schema.createTable('credits', (t) => {
    t.string('tenant_id', 128).primary();
    t.decimal('balance', 12, 2).notNullable().defaultTo(0);
    t.decimal('lifetime_spent', 12, 2).notNullable().defaultTo(0);
    t.timestamp('last_purchase', { useTz: true });
    t.decimal('hard_cap', 12, 2);
    t.decimal('alert_threshold', 12, 2);
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('credit_ledger', (t) => {
    t.bigIncrements('id').primary();
    t.string('tenant_id', 128).notNullable().references('credits.tenant_id');
    t.string('event_type', 32).notNullable();
    t.string('action_type', 64);
    t.decimal('amount', 8, 2).notNullable();
    t.decimal('balance_after', 12, 2).notNullable();
    t.string('agent_id', 128);
    t.string('model_id', 64);
    t.integer('input_tokens');
    t.integer('output_tokens');
    t.decimal('vendor_cost_usd', 8, 6);
    t.string('razorpay_order_id', 128);
    t.jsonb('metadata');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['tenant_id', 'created_at']);
    t.index(['tenant_id', 'action_type', 'created_at']);
  });

  await knex.schema.createTable('agent_usage', (t) => {
    t.bigIncrements('id').primary();
    t.string('tenant_id', 128).notNullable();
    t.string('agent_id', 128).notNullable();
    t.string('action_type', 64).notNullable();
    t.string('model_id', 64);
    t.integer('input_tokens').notNullable().defaultTo(0);
    t.integer('output_tokens').notNullable().defaultTo(0);
    t.integer('latency_ms');
    t.decimal('credits_charged', 6, 2).notNullable();
    t.boolean('success').notNullable().defaultTo(true);
    t.string('error_code', 64);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['tenant_id', 'created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('agent_usage');
  await knex.schema.dropTableIfExists('credit_ledger');
  await knex.schema.dropTableIfExists('credits');
}
```

---

## CFN Changes — Aurora + Credit System

All Aurora infrastructure is already specced in `25-postgres-database-architecture.md`. The credits tables are added via Knex migrations (not CFN — CFN provisions the Aurora cluster; migrations provision tables).

### Additional CFN for credit alerts

Add to `server/infra/cfn-backend.yaml`:

```yaml
# SNS topic for low-credit alerts (email + in-app)
CreditAlertTopic:
  Type: AWS::SNS::Topic
  Properties:
    TopicName: !Sub "${AWS::StackName}-credit-alerts"
    Subscription:
      - Protocol: email
        Endpoint: cloudberryitsolutions@gmail.com

# EventBridge rule: daily credit summary email to tenants
CreditSummaryRule:
  Type: AWS::Events::Rule
  Properties:
    Name: !Sub "${AWS::StackName}-credit-daily-summary"
    ScheduleExpression: "cron(0 8 * * ? *)"  # 8 AM IST daily
    State: ENABLED
    Targets:
      - Id: CreditSummaryLambda
        Arn: !GetAtt CreditSummaryFunction.Arn

CreditSummaryFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: !Sub "${AWS::StackName}-credit-daily-summary"
    Runtime: nodejs20.x
    Handler: credit-summary-cron.handler
    Role: !GetAtt LambdaExecutionRole.Arn
    Environment:
      Variables:
        AURORA_SECRET_ARN: !Sub "{{resolve:secretsmanager:${AWS::StackName}/aurora:SecretString:arn}}"
        SNS_ALERT_TOPIC: !Ref CreditAlertTopic
    Code:
      S3Bucket: !Ref DeploymentBucket
      S3Key: "scripts/credit-summary-cron.zip"

CreditSummaryLambdaPermission:
  Type: AWS::Lambda::Permission
  Properties:
    Action: lambda:InvokeFunction
    FunctionName: !GetAtt CreditSummaryFunction.Arn
    Principal: events.amazonaws.com
    SourceArn: !GetAtt CreditSummaryRule.Arn
```

---

## Free Plan Limits

Free trial tenants get a one-time credit allocation on trial start:

```js
// In createTrialSubscription() in subscriptionService.js, also call:
await CreditService.credit(tenantId, {
  amount: 100,          // ₹10 worth — enough for ~100 WhatsApp messages
  eventType: 'admin_grant',
  metadata: { reason: 'trial_signup' },
});
```

This lets trial tenants experience the AI features before paying, while limiting exposure.

---

## Lago Integration (Optional — Phase 3)

Lago OSS is a metering/billing engine that can replace the manual ledger for complex scenarios (prepaid + postpaid, tiered pricing, metered subscriptions). Integration path if needed:

1. Self-host Lago on ECS Fargate or use Lago Cloud
2. Create Lago billable metric per action type
3. Push usage events to Lago after each action (in addition to or replacing credit_ledger)
4. Lago handles invoice generation, dunning, plan management

**Recommendation:** Implement the manual credit ledger (above) in Phase 2. Evaluate Lago in Phase 3 only if multi-tier metered subscriptions are required (e.g., committed spend + overage). The manual ledger is simpler, fully owned, and sufficient for Phase 2 volumes (< 1M events/mo).

---

## Implementation Checklist

### Phase 2 (Weeks 7–8)
- [ ] Knex migration 003_credits.js
- [ ] CreditService.js (deduct, credit, getBalance, getHistory)
- [ ] modelRouter.js (selectModel, calcBedrockCost, usdToCredits)
- [ ] creditCosts.js config
- [ ] meterCredits.js middleware

### Phase 2 (Weeks 9–10)
- [ ] Wire metering into agent calls (Bedrock + ElevenLabs)
- [ ] Credits API routes (`/api/credits/*`)
- [ ] Razorpay credit pack order flow
- [ ] CFN: CreditAlertTopic, CreditSummaryFunction, CreditSummaryRule
- [ ] Trial signup → 100 credits grant
- [ ] Low-balance alert email via Brevo

### Phase 2 (Weeks 9–10, frontend)
- [ ] `/billing/credits` page (balance, buy, history, usage chart)
- [ ] Insufficient credits modal (shown on 402 response)
- [ ] Low balance banner in nav

### Phase 3
- [ ] Budget cap UI (set hard_cap per tenant)
- [ ] Admin credit dashboard (FOUNDER view, grant credits)
- [ ] Evaluate Lago if needed
- [ ] Per-channel credit packs (voice add-on, marketing add-on)
