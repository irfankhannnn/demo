# Phase 2 — PostgreSQL for Agent & Analytics Workloads

> **Status (17 Sep 2026): Parked (D8).** Nothing in this doc is built and there is no date for it. All product data runs on DynamoDB (`agency-app/api/infra/cfn-backend.yaml`, `agency-app/api/infra/launch-tables-cfn.yaml`). Postgres/Aurora is kept only as a possible future **reporting store fed from DynamoDB** (exports or Streams). Four of the twelve tables below already exist on DynamoDB in another form (see "What exists today"). The content is kept as the design to start from if the idea is un-parked; facts, paths and SQL were corrected against the code.

> Original June 2026 header: New operational requirement · Scope: Build net-new Postgres tables for agent audit, conversation metadata, credits, analytics, and compliance. **CRM stays on DynamoDB.**

---

## What exists today (Sep 2026)

| Doc 27 table | Today | Evidence |
|---|---|---|
| `credits`, `credit_ledger` | **Exists on DynamoDB.** One table: balance item `sk=BALANCE`, ledger items `sk=LEDGER#<iso-ts>#<rand>`, GSI `actionType-index`, 12-month TTL. See doc 30. | `agency-app/api/creditService.js`; `CreditsTable` in `agency-app/api/infra/cfn-backend.yaml` |
| credit costs and packs (not in doc 27) | **Exists on DynamoDB**, editable at runtime. | `agency-app/api/creditConfig.js`; `CreditConfigTable` in `cfn-backend.yaml` |
| `agent_actions` | **Exists on DynamoDB** as the agent audit table (90-day TTL by default). | `agency-app/api/agents/agentAuditService.js`; `AgentAuditTable` in `cfn-backend.yaml` |
| `grievances` | **Exists on DynamoDB.** | `agency-app/api/grievanceDynamodbService.js`, `agency-app/api/routes/grievance.js`; `GrievancesTable` in `launch-tables-cfn.yaml` |
| `agent_approvals`, `conversations_meta`, `agent_usage`, `lead_analytics_daily`, `agent_performance_daily`, `conversion_funnel_daily`, `grievance_responses`, `audit_log` | **Not built.** | — |
| Analytics dashboards | Built on DynamoDB reads, not on projections. | `agency-app/api/teamAnalyticsService.js`, `businessAnalyticsHelpers.js`, `routes/admin.js` (`/team-analytics`, `/agent-activity`), `routes/agentActivity.js`; page `agency-app/web/src/pages/crm/BusinessAnalytics.tsx` |

Two notes that matter if this is un-parked:
- Audit rows currently expire through DynamoDB TTL. The founder decision is to **archive audit rows instead of deleting them** (D17), which is a natural first job for a reporting store.
- The CRM access-pattern fix this doc relies on is still open: `TODO(MED-1)` (add a tenant index, Query instead of Scan) at the top of `agency-app/api/crmDynamodbService.js`.

---

## Strategic Shift from Earlier Design

**Doc 26 and the summary section of doc 25 proposed migrating the entire CRM from DynamoDB to PostgreSQL.** Both are now archived. Codebase analysis showed:
- The CRM's DynamoDB problems stem from **improper access patterns** (full-partition scans, partial pagination, missing tenant GSI), not DynamoDB's limits.
- Fixing those patterns (add a `tenant-index` GSI, `Query` instead of `Scan`, pagination) solves most of the stated pain at a fraction of the cost.
- PostgreSQL should be added **narrowly**, if at all, for genuinely relational/analytical workloads (dashboards, long-term audit).

**This document describes that narrower, lower-risk path: Aurora for agent/analytics only.**

---

## 1. Scope: What Would Go to PostgreSQL

### Tables in the June design

The June design gave Postgres **12 new tables**. Four of them (`credits`, `credit_ledger`, `agent_actions`, `grievances`) have since been built on DynamoDB. The CRM (leads, contacts, properties, khata, enquiries, projects, developers, areas) **stays on DynamoDB.**

| Purpose | Postgres Tables | Why (relational need) |
|---|---|---|
| **Agent audit & billing** | `agent_actions` (exists on DynamoDB), `agent_approvals` | Every AI action must be logged (cost, compliance, eval). Join with credits for billing. |
| **Conversation metadata** | `conversations_meta` | Index for "find all conversations for contact X". |
| **Credits & metering** | `credits`, `credit_ledger` (both exist on DynamoDB), `agent_usage` | Track balance, transactions, usage rates; enable "pause at ₹X" caps. |
| **Analytics projection** | `lead_analytics_daily`, `agent_performance_daily`, `conversion_funnel_daily` | Denormalized summaries: leads created/qualified/converted per day, agent efficiency. Built from DynamoDB data via projection. |
| **Compliance & support** | `grievances` (exists on DynamoDB), `grievance_responses`, `audit_log` | Long-lived logs for DPDP Act compliance. |

### Tables that stay on DynamoDB

Names are the CloudFormation defaults for `dev`; each is a parameter (`${Env}-realestateflow-*`).

| Table | Why |
|---|---|
| `dev-realestateflow-crm` | CRM core single table (leads, contacts, buyers, owners, tenants, notes; WhatsApp conversation records also live here, `agency-app/api/whatsappConversationService.js`). GSIs: owner-property, status, search, marketplace. |
| `dev-realestateflow-projects` | Projects; bulk data, rarely filtered. |
| `dev-realestateflow-developers` | Same; low query volume. |
| `dev-realestateflow-areas`, `dev-realestateflow-communities` | Reference data; seldom written. |
| `dev-realestateflow-khata` | Accounting; simple CRUD, no complex joins. |
| `dev-realestateflow-webhook-log` | Idempotency checks. |
| `dev-realestateflow-notifications` | Notifications and reminders. |

There are no separate `Conversations` or `Messages` tables. Lead events are published straight to EventBridge with `PutEvents` (for example `agency-app/api/scripts/lead-qualifier-handler.js`), not through DynamoDB Streams.

**Key principle: DynamoDB for transactional, event-stream, and high-write workloads. PostgreSQL, if ever added, for analytical and complex-query workloads.**

---

## 2. PostgreSQL Schema (Narrower Edition)

Corrections from the June draft: PostgreSQL has no inline `INDEX` clause inside `CREATE TABLE` (indexes are separate statements); `uuid-ossp` must be quoted and is not needed because `pgcrypto` provides `gen_random_uuid()`; tenant IDs are strings, not UUIDs (`TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/` in `agency-app/api/routes/billing.js`), and there is no `tenants` table to reference. User IDs also come from the auth service as strings.

### Setup

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- All tables include tenant isolation
-- Primary enforcer: WHERE tenant_id = $1 (application level)
-- Optional RLS as defense-in-depth added later, if needed
```

### Agent Audit & Approvals

```sql
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  agent_type VARCHAR(100) NOT NULL, -- whatsapp, web, qualifier, router, followup, call-recording-analyzer
  action VARCHAR(255) NOT NULL,     -- invoke, tool call name, ...
  entity_type VARCHAR(50),          -- lead, contact, property, meeting
  entity_id VARCHAR(128),

  -- What happened
  input JSONB,
  output JSONB,

  -- Billing & governance
  credits_used INTEGER DEFAULT 0,   -- credits are whole numbers
  approval_status VARCHAR(50) DEFAULT 'auto', -- auto, pending_approval, approved, rejected
  approved_by VARCHAR(128),
  approval_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_agent_actions_tenant_created ON agent_actions (tenant_id, created_at DESC);
CREATE INDEX idx_agent_actions_tenant_agent ON agent_actions (tenant_id, agent_type, created_at DESC);
CREATE INDEX idx_agent_actions_entity ON agent_actions (entity_type, entity_id);

CREATE TABLE agent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  agent_action_id UUID REFERENCES agent_actions(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  reviewer_id VARCHAR(128) NOT NULL,    -- admin or manager
  review_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Conversation Metadata

```sql
CREATE TABLE conversations_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  contact_id VARCHAR(128) NOT NULL, -- DynamoDB contact id; stored for indexing
  channel VARCHAR(50) NOT NULL,     -- whatsapp, instagram_dm, web_chat, voice
  source VARCHAR(100),              -- ad_id, post_id, organic
  status VARCHAR(50) DEFAULT 'open', -- open, closed, escalated, archived

  lead_id VARCHAR(128),             -- link to CRM lead (if conversion happened)

  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  message_count INT DEFAULT 0,
  last_agent_response_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_conv_tenant_contact ON conversations_meta (tenant_id, contact_id, opened_at DESC);
CREATE INDEX idx_conv_tenant_lead ON conversations_meta (tenant_id, lead_id);
CREATE INDEX idx_conv_tenant_status ON conversations_meta (tenant_id, status);
-- Message bodies stay in DynamoDB (CRM single table)
```

### Credits & Metering (reporting copy only)

The live ledger is DynamoDB (doc 30). If a reporting store is built, these tables would be read-only copies fed from it.

```sql
CREATE TABLE credits (
  tenant_id VARCHAR(128) PRIMARY KEY,
  balance INTEGER DEFAULT 0,
  total_purchased INTEGER DEFAULT 0,
  total_used INTEGER DEFAULT 0,
  last_recharged_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE credit_ledger (
  id VARCHAR(128) PRIMARY KEY,          -- DynamoDB sk, e.g. LEDGER#<ts>#<rand>
  tenant_id VARCHAR(128) NOT NULL,
  action_type VARCHAR(100) NOT NULL,    -- agent_action, ai_call_per_minute, purchase, monthly_reset, refund.agent_action, ...
  amount INTEGER NOT NULL,              -- positive (grant) or negative (deduct)
  balance_before INTEGER,
  balance_after INTEGER,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_ledger_tenant_created ON credit_ledger (tenant_id, created_at DESC);

CREATE TABLE agent_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  metric VARCHAR(100) NOT NULL, -- "actions", "approvals", "errors"
  value INT NOT NULL,
  period_date DATE NOT NULL,    -- daily aggregation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (tenant_id, agent_type, metric, period_date)
);
CREATE INDEX idx_agent_usage_tenant_period ON agent_usage (tenant_id, period_date DESC);
```

### Analytics Projection (denormalized from DynamoDB)

```sql
CREATE TABLE lead_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  date DATE NOT NULL,

  leads_created INT DEFAULT 0,
  leads_qualified INT DEFAULT 0,
  leads_converted INT DEFAULT 0,
  leads_lost INT DEFAULT 0,
  avg_time_to_qualify INT, -- minutes

  by_source JSONB DEFAULT '{}', -- {"whatsapp": 10, "instagram": 5, "web": 3}

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (tenant_id, date)
);

CREATE TABLE agent_performance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  date DATE NOT NULL,

  actions_executed INT DEFAULT 0,
  actions_approved INT DEFAULT 0,
  actions_rejected INT DEFAULT 0,
  avg_latency_ms INT,
  error_rate DECIMAL(5, 2), -- percentage
  credits_consumed INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (tenant_id, agent_type, date)
);

CREATE TABLE conversion_funnel_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  date DATE NOT NULL,

  inbound_conversations INT DEFAULT 0,
  leads_created INT DEFAULT 0,
  qualified INT DEFAULT 0,        -- lead.score = HOT
  visits_scheduled INT DEFAULT 0,
  conversions INT DEFAULT 0,      -- buyer/owner/tenant created

  conversion_rate DECIMAL(5, 2),
  avg_conversion_days INT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (tenant_id, date)
);
```

### Compliance & Audit

```sql
CREATE TABLE grievances (             -- reporting copy; live table is DynamoDB
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128),
  contact_email VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,     -- data_access, data_deletion, data_correction, complaint
  description TEXT,
  status VARCHAR(50) DEFAULT 'open',
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_grievances_status ON grievances (status, created_at DESC);

CREATE TABLE grievance_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128),
  grievance_id VARCHAR(128) REFERENCES grievances(id),
  response_body TEXT,
  responder_id VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  action_type VARCHAR(100) NOT NULL, -- create, update, archive, export, login
  entity_type VARCHAR(50),
  entity_id VARCHAR(128),
  user_id VARCHAR(128),
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant_created ON audit_log (tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
```

---

## 3. Knex.js Service Layer (JavaScript)

`agency-app/api` is plain JavaScript (ES modules), so Knex rather than a TypeScript ORM. **None of the files in this section exist.** Paths show where they would go.

### Setup

```javascript
// agency-app/api/db/analytics.js  (not built)
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
  pool: { min: 0, max: 10, idleTimeoutMillis: 30000 },
  migrations: { directory: './db/migrations' },
});

export default analyticsDb;
```

### Example: projecting agent audit rows

The live writer is `logAgentAction` in `agency-app/api/agents/agentAuditService.js` (DynamoDB). A reporting store would copy from it, not replace it.

```javascript
// agency-app/api/db/projectAgentAudit.js  (not built)
import analyticsDb from './analytics.js';

export async function upsertAgentAction(tenantId, auditItem) {
  if (!tenantId) throw new Error('Tenant ID required');
  await analyticsDb('agent_actions')
    .insert({
      tenant_id: tenantId,
      agent_type: auditItem.agentId,
      action: auditItem.action,
      input: JSON.stringify(auditItem.input),
      output: JSON.stringify(auditItem.output),
      credits_used: auditItem.creditsCharged ?? 0,
      created_at: auditItem.createdAt,
    });
}

export async function getAgentActionsForTenant(tenantId, { startDate, endDate, agentType }) {
  const q = analyticsDb('agent_actions')
    .where('tenant_id', tenantId)
    .andWhere('created_at', '>=', startDate)
    .andWhere('created_at', '<=', endDate);
  if (agentType) q.andWhere('agent_type', agentType);
  return q.orderBy('created_at', 'desc').limit(1000);
}
```

### Example: Conversation Metadata Service

```javascript
// agency-app/api/db/conversationMeta.js  (not built)
import analyticsDb from './analytics.js';

export async function openConversation(tenantId, { contactId, channel, source }) {
  const [conv] = await analyticsDb('conversations_meta')
    .insert({ tenant_id: tenantId, contact_id: contactId, channel, source, status: 'open' })
    .returning('*');
  return conv;
}

export async function getConversationsForContact(tenantId, contactId) {
  return analyticsDb('conversations_meta')
    .where({ tenant_id: tenantId, contact_id: contactId })
    .orderBy('opened_at', 'desc');
}

export async function linkConversationToLead(tenantId, conversationId, leadId) {
  return analyticsDb('conversations_meta')
    .where({ tenant_id: tenantId, id: conversationId })
    .update({ lead_id: leadId });
}
```

---

## 4. Where it would hook into the agent flow

The June draft showed made-up routes (`/agents/respond-to-lead`, `/webhook/whatsapp`) and a price of 0.5 credits per action. The real entry points are:

| Flow | Real entry point today |
|---|---|
| Every AI turn (WhatsApp, web chat, qualifier, router, follow-up drafts) | `invokeAgent` in `agency-app/api/agents/agentRuntime.js`. It checks provisioning and balance, deducts `AGENT_ACTION_CREDITS` (default **15**) as `agent_action`, runs the turn, refunds if the turn failed before any CRM write, and writes an audit row via `logAgentAction`. |
| Web chat | `agency-app/api/routes/agentChat.js` (mounted at `/api/crm/agent-chat`) → `agents/channels/webChannel.js` |
| WhatsApp | Self-hosted Baileys transport (`platform/whatsapp-platform`) → CRM (`agency-app/api/routes/whatsappConversations.js`, `routes/webhooks.js`, `scripts/whatsapp-message-processor.js`) |
| Lead events | `lead.created` → `scripts/lead-qualifier-handler.js`; `lead.qualified` → `scripts/lead-router-handler.js` (EventBridge rules in `cfn-backend.yaml`) |

A projection would subscribe to these (audit table, ledger, lead events) rather than adding a second synchronous write in the request path.

---

## 5. Analytics Dashboard Queries (illustrative)

```javascript
// agency-app/api/routes/analytics.js  (not built; today's analytics are routes/admin.js and routes/agentActivity.js)
router.get('/dashboard/agent-efficiency', validateToken, extractTenantId, async (req, res) => {
  const { startDate, endDate } = req.query;
  const dailyStats = await analyticsDb('agent_performance_daily')
    .where('tenant_id', req.tenantId)
    .whereBetween('date', [startDate, endDate])
    .orderBy('date', 'asc');
  res.json(dailyStats);
});

router.get('/dashboard/funnel', validateToken, extractTenantId, async (req, res) => {
  const { date } = req.query;
  const funnel = await analyticsDb('conversion_funnel_daily')
    .where({ tenant_id: req.tenantId, date })
    .first();
  res.json(funnel);
});
```

---

## 6. Sequence if un-parked (no dates)

| Step | Tasks |
|---|---|
| **1** | Fix `TODO(MED-1)` on DynamoDB first; confirm the dashboards still need a reporting store. |
| **2** | Provision Aurora Serverless v2 in CloudFormation next to the service; write Knex migrations. |
| **3** | Build a one-way projection from DynamoDB (Streams or scheduled export) for audit, ledger and lead events. Archive audit rows here instead of letting TTL delete them (D17). |
| **4** | Point dashboards at the projection behind a feature flag; compare numbers with the DynamoDB-based dashboards before switching. |

---

## 7. Cost & Performance (June 2026 estimate, not re-checked)

### Aurora Serverless v2 (new tables only, low volume)

- **Compute:** ~0.5 ACU (idle) to 2 ACU (busy) = ~₹1-2k/month
- **Storage:** ~5 GB initial = ~₹250/month
- **RDS Proxy:** ~₹300/month
- **Total:** ~₹2-3k/month (scales with agent volume)

### Performance targets

- Projection lag: minutes, not realtime
- Conversation metadata queries: P95 <50ms
- Daily analytics aggregation: nightly batch
- Dashboards: <500ms (cached)

---

## What This Is NOT

- **Not a rewrite of the CRM.** Leads, contacts, properties, khata stay on DynamoDB.
- **Not a data migration.** A reporting store would be fed from DynamoDB, which stays the source of truth.
- **Not on the request path.** If Postgres goes down, the product keeps working because nothing live reads from it. (The June claim of a "DDB event queue fallback" was never built and is not needed with a one-way projection.)
- **Not the full vision.** Growth features are in doc 28.

---

## Success Criteria (if un-parked)

- [ ] `TODO(MED-1)` fixed on DynamoDB.
- [ ] Aurora Serverless cluster provisioned in CloudFormation.
- [ ] Knex migrations run; tables and indexes created.
- [ ] Projection copies agent audit, ledger and lead events with no gaps (daily count check against DynamoDB).
- [ ] Audit rows archived instead of TTL-deleted.
- [ ] Dashboards queryable; P95 latency <500ms.
- [ ] Tenant isolation tests pass.
- [ ] Failures alert through the existing `AlertEmail` / SNS setup in `cfn-backend.yaml`.
