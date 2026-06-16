# Phase 2 — PostgreSQL for Agent & Analytics Workloads

> **Status:** New operational requirement · **Duration:** Weeks 3–4 (parallel to Phase 1) · **Scope:** Build net-new Postgres tables for agent audit, conversation metadata, credits, analytics, and compliance. **CRM stays on DynamoDB.**

---

## Strategic Shift from Earlier Design

**Earlier docs (25–26) proposed migrating the entire CRM from DynamoDB to PostgreSQL.** Codebase analysis showed:
- The CRM's DynamoDB problems stem from **improper access patterns** (full-partition scans, no pagination, missing GSI), not DynamoDB's limits.
- Fixing those patterns (add `tenant-index` GSI, `Query` instead of `Scan`, pagination) solves 70% of the stated pain at a fraction of the cost.
- PostgreSQL should be added **narrowly** for genuinely relational/analytical workloads (agent audit, conversation indexing, credits/metering, dashboards).

**This document describes that narrower, lower-risk path: Aurora for agent/analytics only.**

---

## 1. Scope: What Goes to PostgreSQL

### New tables required for the vision

Postgres will own **12 new tables** that didn't exist on DynamoDB. The CRM (leads, contacts, properties, khata, enquiries, projects, developers, areas) **stays on DynamoDB and stays optimized in place.**

| Purpose | Postgres Tables | Why (relational need) |
|---|---|---|
| **Agent audit & billing** | `agent_actions`, `agent_approvals` | Every AI action must be logged (cost, compliance, eval). Join with credits for billing. |
| **Conversation metadata** | `conversations_meta` | Index for "find all conversations for contact X" — easier in SQL than scanning a DDB table. (Message bodies stay in DynamoDB.) |
| **Credits & metering** | `credits`, `credit_ledger`, `agent_usage` | Track balance, transactions, usage rates; enable "pause at $X" caps. Complex accounting, needs transactions. |
| **Analytics projection** | `lead_analytics_daily`, `agent_performance_daily`, `conversion_funnel` | Denormalized summaries: leads created/qualified/converted per day, agent efficiency. Built from DDB events via projection. |
| **Compliance & support** | `grievances`, `grievance_responses`, `audit_log` | Immutable logs for DPDP Act compliance. Easier to enforce immutability in Postgres. |

### Tables that stay on DynamoDB

| Table | Why |
|---|---|
| `cloudberry-real-estate-crm` | CRM core; has established access patterns (once pagination is added). |
| `cloudberry-real-estate-projects` | Projects & developers; bulk data, rarely filtered. GSI-able. |
| `cloudberry-real-estate-developers` | Same; low-query volume. |
| `cloudberry-real-estate-areas` | Reference data; seldom written. |
| `cloudberry-real-estate-khata` | Accounting; simple CRUD, no complex joins. |
| `Conversations` (new) | High write-rate event stream; append-only; DynamoDB Streams → EventBridge. |
| `Messages` (new) | Immutable message log; TTL cleanup; query pattern is `(conversation_id, timestamp)` — DynamoDB native. |
| `WebhookLog` | Idempotency checks; ephemeral. |
| `Notifications` | Scheduled reminders; ephemeral. |

**Key principle: DynamoDB for transactional, event-stream, and high-write workloads. PostgreSQL for analytical, complex-query, and auditable workloads.**

---

## 2. PostgreSQL Schema (Narrower Edition)

### Setup

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;

-- All tables include tenant isolation
-- Primary enforcer: WHERE tenant_id = $1 (application level)
-- Optional RLS as defense-in-depth added later, if needed
```

### Agent Audit & Approvals

```sql
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_type VARCHAR(100) NOT NULL, -- sales_assistant, qualifier, voice_agent, marketing_agent, follow_up_engine
  action VARCHAR(255) NOT NULL, -- replied_to_lead, asked_question, booked_visit, generated_content, sent_email
  entity_type VARCHAR(50), -- lead, contact, property, visit, campaign
  entity_id UUID,
  
  -- What happened
  input JSONB, -- user message, query, parameters
  output JSONB, -- agent response, decision, output artifact
  
  -- Billing & governance
  credits_used DECIMAL(10, 2) DEFAULT 0,
  approval_status VARCHAR(50) DEFAULT 'auto', -- auto, pending_approval, approved, rejected
  approved_by UUID, -- admin user who approved, if manual
  approval_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  INDEX idx_tenant_created (tenant_id, created_at DESC),
  INDEX idx_tenant_agent_type (tenant_id, agent_type, created_at DESC),
  INDEX idx_entity (entity_type, entity_id)
);

CREATE TABLE agent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_action_id UUID REFERENCES agent_actions(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  reviewer_id UUID NOT NULL, -- admin or manager
  review_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);
```

### Conversation Metadata

```sql
CREATE TABLE conversations_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_id UUID NOT NULL, -- FK to DynamoDB contact; stored for indexing
  channel VARCHAR(50) NOT NULL, -- whatsapp, instagram_dm, facebook_msg, telegram, web_chat, sms
  source VARCHAR(100), -- ad_id, post_id, portal_name, organic
  status VARCHAR(50) DEFAULT 'open', -- open, closed, escalated, archived
  
  -- Link to CRM lead (if conversion happened)
  lead_id UUID,
  
  -- Timing
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  message_count INT DEFAULT 0,
  
  -- Agent activity
  last_agent_response_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  INDEX idx_tenant_contact (tenant_id, contact_id, opened_at DESC),
  INDEX idx_tenant_lead (tenant_id, lead_id),
  INDEX idx_tenant_status (tenant_id, status)
);
-- Messages (bodies, attachments) stay in DynamoDB for high write rate
-- Query pattern: SELECT * FROM conversations_meta WHERE contact_id = ?
-- Then fetch message bodies from DDB via conversation_id
```

### Credits & Metering

```sql
CREATE TABLE credits (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id),
  balance DECIMAL(12, 2) DEFAULT 0, -- current credits available
  total_purchased DECIMAL(12, 2) DEFAULT 0,
  total_used DECIMAL(12, 2) DEFAULT 0,
  last_recharged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- purchase, usage, refund, adjustment
  amount DECIMAL(12, 2) NOT NULL, -- positive (credit) or negative (debit)
  reason VARCHAR(255), -- "lead_qualified", "voice_call_1min", "marketing_post_created"
  agent_action_id UUID REFERENCES agent_actions(id), -- which agent action caused this
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  INDEX idx_tenant_created (tenant_id, created_at DESC)
);

CREATE TABLE agent_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  metric VARCHAR(100) NOT NULL, -- "actions", "approvals", "errors"
  value INT NOT NULL,
  period_date DATE NOT NULL, -- daily aggregation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  UNIQUE(tenant_id, agent_type, metric, period_date),
  INDEX idx_tenant_period (tenant_id, period_date DESC)
);
```

### Analytics Projection (Denormalized from DDB events)

```sql
CREATE TABLE lead_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  date DATE NOT NULL,
  
  leads_created INT DEFAULT 0,
  leads_qualified INT DEFAULT 0,
  leads_converted INT DEFAULT 0,
  leads_lost INT DEFAULT 0,
  avg_time_to_qualify INT, -- minutes
  
  by_source JSONB DEFAULT '{}', -- {"whatsapp": 10, "web": 5, "portal": 3}
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  UNIQUE(tenant_id, date)
);

CREATE TABLE agent_performance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  
  actions_executed INT DEFAULT 0,
  actions_approved INT DEFAULT 0,
  actions_rejected INT DEFAULT 0,
  avg_latency_ms INT, -- milliseconds to execute
  error_rate DECIMAL(5, 2), -- percentage
  credits_consumed DECIMAL(12, 2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  UNIQUE(tenant_id, agent_type, date)
);

CREATE TABLE conversion_funnel_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  date DATE NOT NULL,
  
  inbound_conversations INT DEFAULT 0, -- new conversations opened
  leads_created INT DEFAULT 0, -- contact → lead
  qualified INT DEFAULT 0, -- lead.score = hot
  visits_scheduled INT DEFAULT 0, -- visit.status = scheduled
  conversions INT DEFAULT 0, -- buyer/owner created
  
  conversion_rate DECIMAL(5, 2), -- conversions / inbound_conversations
  avg_conversion_days INT, -- days from inbound to conversion
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  UNIQUE(tenant_id, date)
);
```

### Compliance & Audit

```sql
CREATE TABLE grievances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL, -- data_access, data_deletion, data_correction, complaint
  description TEXT,
  status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, rejected
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  INDEX idx_tenant_status (tenant_id, status)
);

CREATE TABLE grievance_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  grievance_id UUID REFERENCES grievances(id),
  response_body TEXT,
  responder_id UUID, -- admin user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  action_type VARCHAR(100) NOT NULL, -- create, update, delete, export, login
  entity_type VARCHAR(50), -- lead, contact, property
  entity_id UUID,
  user_id UUID, -- admin, agent, or system
  before_state JSONB, -- what changed from
  after_state JSONB, -- what changed to
  ip_address INET,
  user_agent VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  INDEX idx_tenant_created (tenant_id, created_at DESC),
  INDEX idx_entity (entity_type, entity_id)
);
```

---

## 3. Knex.js Service Layer (JavaScript)

### Setup (no TypeScript required)

```javascript
// server/db/analytics.js
import knex from 'knex';

const analyticsDb = knex({
  client: 'pg',
  connection: {
    host: process.env.ANALYTICS_DB_HOST,
    port: process.env.ANALYTICS_DB_PORT || 5432,
    user: process.env.ANALYTICS_DB_USER,
    password: process.env.ANALYTICS_DB_PASSWORD,
    database: process.env.ANALYTICS_DB_NAME,
  },
  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 30000,
  },
  migrations: {
    directory: './db/migrations',
  },
});

export default analyticsDb;
```

### Example: Agent Action Service

```javascript
// server/services/agentActionService.js
import analyticsDb from '../db/analytics.js';

export async function logAgentAction(tenantId, {
  agentType,
  action,
  entityType,
  entityId,
  input,
  output,
  creditsUsed,
}) {
  if (!tenantId) throw new Error('Tenant ID required');

  const [actionRecord] = await analyticsDb('agent_actions')
    .insert({
      tenant_id: tenantId,
      agent_type: agentType,
      action,
      entity_type: entityType,
      entity_id: entityId,
      input: JSON.stringify(input),
      output: JSON.stringify(output),
      credits_used: creditsUsed,
    })
    .returning('*');

  // Also increment credit ledger
  await analyticsDb('credit_ledger').insert({
    tenant_id: tenantId,
    transaction_type: 'usage',
    amount: -creditsUsed,
    reason: `${agentType}_${action}`,
    agent_action_id: actionRecord.id,
  });

  return actionRecord;
}

export async function getAgentActionsForTenant(tenantId, { startDate, endDate, agentType }) {
  return analyticsDb('agent_actions')
    .where('tenant_id', tenantId)
    .andWhere('created_at', '>=', startDate)
    .andWhere('created_at', '<=', endDate)
    .andWhere(agentType ? 'agent_type' : true, agentType || true)
    .orderBy('created_at', 'desc')
    .limit(1000);
}

export async function getAgentUsageDaily(tenantId, agentType, date) {
  return analyticsDb('agent_usage')
    .where({ tenant_id: tenantId, agent_type: agentType, period_date: date })
    .first();
}
```

### Example: Conversation Metadata Service

```javascript
// server/services/conversationMetaService.js
export async function openConversation(tenantId, { contactId, channel, source }) {
  const [conv] = await analyticsDb('conversations_meta')
    .insert({
      tenant_id: tenantId,
      contact_id: contactId,
      channel,
      source,
      status: 'open',
    })
    .returning('*');
  return conv;
}

export async function getConversationsForContact(tenantId, contactId) {
  return analyticsDb('conversations_meta')
    .where({ tenant_id: tenantId, contact_id: contactId })
    .orderBy('opened_at', 'desc');
}

export async function linkConversationToLead(conversationId, leadId) {
  return analyticsDb('conversations_meta')
    .where('id', conversationId)
    .update({ lead_id: leadId });
}
```

---

## 4. Wiring Into Phase 1 Agent Flow

### On every agent action:

```javascript
// In routes/crm.js or Phase 1 agent handlers
import { logAgentAction } from '../services/agentActionService.js';

router.post('/agents/respond-to-lead', validateToken, extractTenantId, async (req, res) => {
  const { leadId, reply } = req.body;
  
  // Execute the agent (Phase 1: Sales Assistant)
  const agentResult = await salesAssistant(req.tenantId, leadId, reply);
  
  // Log to Postgres (Phase 2)
  await logAgentAction(req.tenantId, {
    agentType: 'sales_assistant',
    action: 'replied_to_lead',
    entityType: 'lead',
    entityId: leadId,
    input: { reply },
    output: agentResult,
    creditsUsed: 0.5, // sales assistant costs 0.5 credits
  });
  
  // Send reply & update lead
  await sendReplyToContact(...);
  await updateLeadStatus(...);
  
  res.json({ ok: true });
});
```

### On conversation routing:

```javascript
// Phase 1: Conversation Orchestrator
import { openConversation, linkConversationToLead } from '../services/conversationMetaService.js';

router.post('/webhook/whatsapp', validateWebhook, async (req, res) => {
  const { contactId, channel, message } = req.body;
  const tenantId = resolveTenantFromContact(contactId);
  
  // Ensure conversation exists
  let conv = await analyticsDb('conversations_meta')
    .where({ tenant_id: tenantId, contact_id: contactId, channel })
    .first();
  
  if (!conv) {
    conv = await openConversation(tenantId, { contactId, channel, source: 'whatsapp' });
  }
  
  // Route & process (Phase 1 logic)
  const lead = await routeAndQualify(tenantId, contactId, message);
  
  // Link conversation to lead (Phase 2)
  if (lead) {
    await linkConversationToLead(conv.id, lead.id);
  }
  
  res.json({ ok: true });
});
```

---

## 5. Analytics Dashboard Queries

### Example dashboard: "Agent Efficiency"

```javascript
// server/routes/analytics.js
router.get('/dashboard/agent-efficiency', validateToken, extractTenantId, async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const dailyStats = await analyticsDb('agent_performance_daily')
    .where('tenant_id', req.tenantId)
    .whereBetween('date', [startDate, endDate])
    .orderBy('date', 'asc');
  
  res.json(dailyStats);
});
```

### Example dashboard: "Conversion Funnel"

```javascript
router.get('/dashboard/funnel', validateToken, extractTenantId, async (req, res) => {
  const { date } = req.query;
  
  const funnel = await analyticsDb('conversion_funnel_daily')
    .where({ tenant_id: req.tenantId, date })
    .first();
  
  res.json(funnel);
});
```

---

## 6. Implementation Timeline

| Week | Tasks |
|---|---|
| **Week 3** | Provision Aurora + RDS Proxy; write schema migrations (Knex); create service layer (AgentActionService, etc.); unit tests. |
| **Week 4** | Integrate with Phase 1 agent code; wire agent actions → Postgres; wire conversations → metadata table; test E2E. |
| **Week 5** | Deploy to staging behind feature flags; validate analytics dashboards; pilot with 1 test agent. |
| **Week 6+** | Gradual rollout to prod; monitor Postgres latency & costs; flip flags when stable. |

---

## 7. Cost & Performance

### Aurora Serverless v2 (new tables only, low volume in Phase 2)

- **Compute:** ~0.5 ACU (idle) to 2 ACU (busy) = ~₹1-2k/month
- **Storage:** ~5 GB initial = ~₹250/month
- **RDS Proxy:** ~₹300/month
- **Total:** ~₹2-3k/month (scales with agent volume)

### Performance targets

- Agent action logging: <10ms (async, non-blocking)
- Conversation metadata queries: P95 <50ms
- Daily analytics aggregation: nightly batch (not realtime)
- Dashboard dashboards: <500ms (cached)

---

## 8. Migration from Phase 1 → Phase 2

Once Phase 1 (WhatsApp wedge) is live and stable:
1. Deploy Postgres infrastructure (Aurora + RDS Proxy).
2. Run schema migrations (Knex).
3. Wire agent actions & conversation metadata to log to Postgres (feature-flagged).
4. Monitor dual-write consistency (DDB side-effect + Postgres insert).
5. Once 1 week of zero errors, promote analytics dashboard from read-only mode (if querying DDB) to read-write (querying Postgres).

---

## What This Is NOT

- **Not a rewrite of the CRM.** Leads, contacts, properties, khata stay on DynamoDB.
- **Not a data migration.** You're adding net-new tables, not moving existing data.
- **Not risky.** If Postgres goes down, the agent still works (it logs to DDB event queue as fallback).
- **Not the full vision.** This is the infrastructure for agents, audit, and analytics. Marketing + voice + portal automation come in Phase 3.

---

## Success Criteria for Phase 2

- [ ] Aurora Serverless cluster provisioned, RDS Proxy working.
- [ ] Knex migrations run successfully; all 12 tables created with indexes.
- [ ] Agent actions logged to `agent_actions` on every AI action (feature-flagged).
- [ ] Conversations linked to leads in `conversations_meta`.
- [ ] Credits deducted in `credit_ledger` on every action.
- [ ] Analytics dashboards queryable; P95 latency <500ms.
- [ ] Zero data leaks; tenant isolation tests pass.
- [ ] Postgres logs to CloudWatch; alerts set for failures.

Once Phase 2 is live, you have audit, analytics, and metering in place — enabling cost control, agent eval, and compliance. Phase 3 can then scale the vision without worrying about those foundational gaps.
