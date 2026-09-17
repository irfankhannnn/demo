# 25 — PostgreSQL Database Architecture & Migration

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `apps/crm/server/infra/cfn-backend.yaml` and `apps/crm/server/infra/launch-tables-cfn.yaml` (all product data is on DynamoDB). Postgres is parked as a possible future reporting store fed from DynamoDB, with no date (see `docs/realestateflow-vision/27-phase-2-postgres-analytics-agent-tables.md`).

> **Status:** Design spec · **Date:** 2026-06-16 · **Scope:** DynamoDB → Aurora PostgreSQL migration for operational, queryable, and reportable data. Keeps DynamoDB for high-throughput append-only streams.

---

## 1. Why PostgreSQL Now?

### Current Pain (DynamoDB at scale)
- **Complex queries:** "Show hot leads in South Mumbai, budget 80L–1.2Cr, not visited in 7 days" requires 3–4 GSI queries + app-side joins
- **Reporting:** Agent performance, conversion funnels, cohort analysis are difficult without a reporting DB
- **RBAC at scale:** Coming region/team/project-scoped access (from `15`) can't be enforced efficiently in key-value store
- **Transactions:** Khata (accounting) needs ACID multi-row atomicity for settlement
- **Conversation backbone:** The new L3 requires conversation → message → lead → contact joins with full history
- **Cost:** At scale, DynamoDB per-request pricing scales poorly vs. Postgres fixed compute

### PostgreSQL solves all of these while remaining Lambda-friendly via RDS Proxy.

---

## 2. Multi-Tenancy Strategy: App-Level + Optional RLS (Defense-in-Depth)

### PRIMARY approach: Explicit `tenant_id` parameter (mirrors today's pattern)

Your current code safely passes `tenantId` as an explicit argument to every query:
```js
getCustomers(tenantId, filters) → WHERE tenant_id = ? AND ...
```

**Keep this pattern in SQL.** It's explicit, auditableoptional, and proven. Add RLS as defense-in-depth, not as the primary mechanism.

### Why NOT session-level RLS as primary (critical security bug in prior design)

🔴 **RDS Proxy multiplexing + session-level `SET app.tenant_id` = cross-tenant data leak:**
- RDS Proxy reuses underlying connections across multiple clients.
- A bare `SET app.tenant_id = 'tenant-a'` on the connection sets a **session variable that persists**.
- If the connection returns to the pool and is reused for `tenant-b`'s request, that request sees `app.tenant_id = 'tenant-a'` (Tenant B leaks into Tenant A's data).
- Connection pinning (forcing the connection to stay open for one tenant) defeats pooling entirely, negating the reason to use RDS Proxy.

### Correct pattern: app-level enforcement + optional RLS for defense

1. **Primary:** Application-level `WHERE tenant_id = $1` on every query (as you do today).
2. **Defense:** RLS as a safety net — set it **inside an explicit transaction per request**, using `SET LOCAL` (session-scoped to transaction, not connection):

```sql
-- Inside a transaction (connection-pooling safe)
BEGIN;
  SELECT set_config('app.tenant_id', $1, true);  -- LOCAL to transaction
  SELECT * FROM leads WHERE tenant_id = get_current_setting('app.tenant_id');
COMMIT;
```

Or simpler: **just use app-level WHERE clauses and skip RLS initially.** Add RLS later if you want a DB-enforced safety net, but only after understanding its interaction with pooling.

### Why RLS matters (if used correctly)

| Approach | Security | Pooling | When to use |
|---|---|---|---|
| **App-level only** (recommended day 1) | ✅ Bulletproof if enforced | ✅ Full pooling | Launch; cheapest; proven |
| **App + RLS (transaction-scoped)** | ✅✅ Double-layer | ✅ Full pooling | Phase 3; added complexity for edge-case protection |
| **Session-level RLS (BAD)** | 🔴 Cross-tenant leak | ❌ No pooling | ❌ Never |

**Recommendation: Start with explicit `WHERE tenant_id = ?` (what you have today). When reporting/analytics queries become complex, add a second read-only `analytics_user` role with limited RLS + SELECT-only queries. Don't use RLS for the primary transactional path.**

---

## 3. Migration Scope: Narrow Path First (NEW INSIGHTS)

### ⚠️ CRITICAL REFRAMING: Don't migrate the working CRM

**Codebase audit found:**
- The "DynamoDB pain" in the earlier docs (slow queries, complex filtering) stems from **improper use of DynamoDB**, not DynamoDB's inherent limits:
  - Every list operation uses `ScanCommand` (reads entire partition) + `FilterExpression`, then filters/sorts **in JavaScript memory**
  - Zero pagination anywhere (no `LastEvaluatedKey`, `Limit`)
  - A `TODO(MED-1)` to add a `tenant-index` GSI was never completed
  - With proper `QueryCommand` + GSI + pagination, most of these queries would be fast *in place*

**Recommendation: Fix DynamoDB access patterns first (cheap, low-risk), then add Postgres narrowly for genuinely relational/analytical workloads.**

### ✅ MOVE TO POSTGRESQL (Aurora Serverless v2, ap-south-1) — ANALYTICAL + AGENT DATA ONLY

**Net-new analytical + agent-layer workloads (NOT a rewrite of the CRM):**

| Purpose | PostgreSQL Tables |
|---|---|
| **Agent audit & billing** | `agent_actions`, `agent_approvals` |
| **Conversation metadata** (index + metadata; messages stay in DDB) | `conversations_meta` |
| **Credits & metering** | `credits`, `credit_ledger`, `agent_usage` |
| **Analytics projection** (denormalized for dashboards) | `lead_analytics_daily`, `agent_performance_daily`, `conversion_funnel` |
| **Grievances & support** | `grievances`, `grievance_responses` |
| **Audit log** (immutable, compliance) | `audit_log` |

**Total: ~12 Postgres tables (NEW tables, not migrated from DDB)**

**The existing CRM (leads, contacts, properties, buyers, owners, khata, enquiries, projects, developers, areas) STAYS on DynamoDB.** Optimize its access patterns (add GSI, pagination) and leave it alone. Postgres is for genuinely new relational workloads, not a lift-and-shift.

### ✅ KEEP ON DYNAMODB (high-throughput, append-only, ephemeral)

| DynamoDB Table | Why |
|---|---|
| **Conversations** (new) | High write rate (WhatsApp/IG messages), append-only, DynamoDB Streams → EventBridge |
| **Messages** (new) | Immutable log, TTL cleanup, query-by-conversation_id + timestamp |
| **WebhookLog** | Idempotency checks (high frequency), TTL expiry |
| **NotificationsTable** | Append-only, scheduled, ephemeral |
| **NPSResponses** | Survey responses, never updated |
| **TenantApiKeys** | Simple key-value, <100ms lookup |
| **AIEmployeeProvisioning** | State machine, rarely queried |
| **AgentSessionState** (new) | Ephemeral conversation context, Strands/AgentCore session memory |

**Principle:** If you need to **JOIN** it, **report on** it, or apply **RBAC** → Postgres. If it's **append-only**, **high-write-frequency**, or **ephemeral state** → DynamoDB.

---

## 4. PostgreSQL Schema Architecture

### Connection & Pooling

```
Lambda functions
     ↓ (via VPC)
RDS Proxy (pgBouncer, transaction mode, 100 client conns → 20 DB conns)
     ↓
Aurora Serverless v2 (ap-south-1)
     ├─ Min: 0.5 ACU (always-on, ~2–3GB memory)
     ├─ Max: 64 ACU (scales on demand)
     └─ Postgres 16, 5 replicas (multi-AZ)
```

**Why RDS Proxy is mandatory with Lambda:**
- Each Lambda invocation opens a connection
- 1000 concurrent Lambdas → 1000 connections without pooling
- Aurora max connections ~16,000 → insufficient at scale
- RDS Proxy multiplexes: 100 client connections → 20 DB connections via statement-level pooling
- Cost: ~$0.015/hour (~$11/month) — negligible

---

### Table Structure (Simplified Example)

```sql
-- TENANCY
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'team',
  subscription_status VARCHAR(50) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- CONTACTS (master directory)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  phone VARCHAR(20),
  email VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  channel_handles JSONB DEFAULT '{}', -- {"whatsapp": "+919123456789", "instagram": "handle"}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, phone),
  UNIQUE(tenant_id, email)
);

-- LEADS (prospects in pipeline)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  contact_id UUID REFERENCES contacts(id),
  status VARCHAR(50) DEFAULT 'new', -- new, contacted, qualified, negotiating, converted, lost
  priority VARCHAR(50) DEFAULT 'medium', -- high, medium, low
  source VARCHAR(100), -- whatsapp, instagram, website, portal, b2b
  budget_min BIGINT, -- in paise (80L = 8000000)
  budget_max BIGINT,
  config JSONB DEFAULT '{}', -- {type: "2bhk", bhk: 2, config: "flat"}
  timeline JSONB DEFAULT '{}', -- {months: 3, flexible: false}
  location JSONB DEFAULT '{}', -- {areas: ["Bandra"], coordinates: {...}}
  score VARCHAR(50), -- hot, warm, cold
  score_reasons JSONB DEFAULT '{}', -- {budget_fit: true, timeline_urgent: true, ...}
  assigned_to UUID, -- agent/user id
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- PROPERTIES (inventory)
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  building_id UUID,
  project_id UUID,
  type VARCHAR(50), -- flat, villa, office, shop
  status VARCHAR(50) DEFAULT 'available', -- available, for-sale, sold, for-rent, rented, vacant
  sale_info JSONB DEFAULT '{}', -- {price: 8000000, brokers: [...], registration_status: "..."}
  rental_info JSONB DEFAULT '{}', -- {monthly_rent: 80000, furnishing: "..."}
  kyc_docs JSONB DEFAULT '{}', -- {title: "...", oc: "...", tax_receipt: "..."}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- VISITS (scheduled site visits)
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  property_id UUID REFERENCES properties(id),
  scheduled_at TIMESTAMP,
  outcome VARCHAR(50), -- completed, no-show, rescheduled, not-interested
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- TASKS (agent action items)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  assigned_to UUID, -- agent/user
  entity_type VARCHAR(50), -- lead, property, contact
  entity_id UUID,
  description TEXT,
  due_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'open', -- open, completed, cancelled
  created_by_agent BOOLEAN DEFAULT FALSE, -- auto-created by agent?
  created_at TIMESTAMP DEFAULT NOW()
);

-- KHATA (accounting)
CREATE TABLE khata_categories (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255),
  type VARCHAR(50) -- income, expense
);

CREATE TABLE khata_transactions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  category_id UUID REFERENCES khata_categories(id),
  amount BIGINT, -- in paise
  date DATE,
  party_name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AGENT AUDIT (for billing & governance)
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_type VARCHAR(100), -- sales_assistant, qualifier, voice_agent, marketing_agent
  action VARCHAR(255), -- replied_to_lead, scheduled_call, generated_content
  entity_type VARCHAR(50),
  entity_id UUID,
  credits_used DECIMAL(10, 2),
  approved_by UUID, -- null = auto-approved, user_id = manually approved
  created_at TIMESTAMP DEFAULT NOW()
);

-- CONVERSATION METADATA (thread index)
CREATE TABLE conversations_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  contact_id UUID REFERENCES contacts(id),
  channel VARCHAR(50), -- whatsapp, instagram, facebook, telegram, web
  source VARCHAR(100), -- ad_id, post_id, portal_name
  status VARCHAR(50) DEFAULT 'open', -- open, closed, escalated
  lead_id UUID REFERENCES leads(id),
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  last_message_at TIMESTAMP
);
```

**Design decisions:**
- **Query-hot fields as REAL COLUMNS**, not JSONB. Examples:
  - `budget_min`, `budget_max` (INT) — hot for range queries, filtering
  - `bedroom_count`, `bathroom_count` (INT) — hot for search
  - `timeline_months` (INT) — hot for filtering
  - `score` (VARCHAR) — hot for sorting/filtering
  - `city`, `area_id`, `building_id` (VARCHAR/UUID) — hot for location queries
- **JSONB only for display/config:** `channel_handles`, `requirement_details` (flexible schema), `amenities`, `images[]`, `contact_info`, `settings`
- `tenant_id UUID NOT NULL` on every table + app-level `WHERE tenant_id = $1` enforced in code
- Foreign keys within tenant scope (enforce `tenant_id` match on joins)
- `TIMESTAMP` for all temporal queries (conversion funnels, cohort analysis)
- Audit columns: `created_at`, `created_by`, `updated_at` on all entities

**Why this matters:** If you put `budget` in JSONB, you're inheriting the same friction (nested field queries, harder indexing) that you're migrating to *escape.* The schema must match your query patterns, not abstract them away.

---

## 5. Indexes Strategy

```sql
-- SEARCH & DISCOVERY
CREATE INDEX idx_leads_tenant_status ON leads(tenant_id, status);
CREATE INDEX idx_leads_tenant_score ON leads(tenant_id, score);
CREATE INDEX idx_contacts_tenant_phone ON contacts(tenant_id, phone);
CREATE INDEX idx_properties_tenant_status ON properties(tenant_id, status);

-- JOINS
CREATE INDEX idx_visits_lead_id ON visits(lead_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_agent_actions_tenant_created ON agent_actions(tenant_id, created_at DESC);

-- TEXT SEARCH (requires pg_trgm extension)
CREATE INDEX idx_contacts_name_trgm ON contacts USING gist(name gist_trgm_ops);
CREATE INDEX idx_properties_description_trgm ON properties USING gist(
  (sale_info->>'description') gist_trgm_ops
);

-- TIME SERIES (for reporting)
CREATE INDEX idx_khata_tx_tenant_date ON khata_transactions(tenant_id, date DESC);
CREATE INDEX idx_visits_tenant_scheduled ON visits(tenant_id, scheduled_at);
```

---

## 6. RLS Policies (Tenant Isolation)

```sql
-- Enable RLS on all tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
-- ... all tables

-- Default policy: user can only see their tenant's rows
CREATE POLICY tenant_isolation_leads ON leads
  USING (tenant_id = current_setting('app.tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation_contacts ON contacts
  USING (tenant_id = current_setting('app.tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

-- ... repeat for all tables

-- At Lambda request middleware:
-- const tenant = extractTenantId(request);
-- await client.query("SET app.tenant_id = $1", [tenant]);
-- All subsequent queries are automatically RLS-filtered
```

---

## 7. ORM Choice: Knex.js (for JavaScript backend)

### CRITICAL: Your `apps/crm/server/` is JavaScript, not TypeScript

**Finding from codebase audit:**
- `apps/crm/server/` has **zero TypeScript** — all `.js` files, no `tsconfig.json`, no `typescript` dependency, no build step.
- Only `services/reality-flow-authentication/` and `apps/crm/real-estate-crm-app/` are TypeScript.
- Introducing a TypeScript ORM (`Drizzle`) means either:
  1. Rewrite all of `apps/crm/server/` to TypeScript (massive, separate effort), **or**
  2. Use Drizzle from JS (defeats the entire value prop of picking it for type safety).

### Recommendation: Knex.js

| Criteria | Knex | Drizzle | Prisma |
|---|---|---|---|
| **Language fit** | ✅ JS-native | ❌ Requires TS migration | ❌ Requires TS |
| **Bundle size** | 200 KB | 140 KB | 7 MB |
| **Lambda cold start** | ~100ms | ~50ms | ~1000ms |
| **Schema migrations** | ✅ First-class (`.migrations/`) | ✅ CLI-based | ✅ CLI-based |
| **Query builder** | ✅ Fluent (minimal types) | ✅ Typed | ✅ Typed |
| **Raw SQL** | ✅ Native `.raw()` | ✅ `sql()` | ⚠️ `$queryRaw` |
| **Production use** | ✅ Proven at scale | ⚠️ Newer | ✅ Proven |
| **Fits your stack NOW** | ✅ Yes | ❌ Not without rewrite | ❌ Not without rewrite |

**Knex is the pragmatic choice: no toolchain changes, native migration support, minimal overhead, proven in serverless.**

### Example Knex schema & queries

```typescript
// schema.ts
import { pgTable, uuid, varchar, jsonb, timestamp, bigint, boolean } from 'drizzle-orm/pg-core';

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  contactId: uuid('contact_id'),
  status: varchar('status', { length: 50 }).default('new'),
  score: varchar('score', { length: 50 }),
  budgetMin: bigint('budget_min'),
  budgetMax: bigint('budget_max'),
  config: jsonb('config').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Usage in Lambda
import { db } from './db';
import { eq } from 'drizzle-orm';

export async function getHotLeads(tenantId: string, city: string) {
  // RLS handled by SET app.tenant_id middleware
  const hotLeads = await db.select().from(leads)
    .where(
      and(
        eq(leads.tenantId, tenantId),
        eq(leads.score, 'hot'),
        ilike(leads.location, `%${city}%`)
      )
    )
    .orderBy(desc(leads.createdAt));
  return hotLeads;
}
```

---

## 8. PostgreSQL Rollout: New Tables Only

**Timeline: Weeks 3–4 (in parallel with Phase 1 agent work, non-blocking)**

Since you're NOT migrating the CRM, this is straightforward:

### Week 3: Setup
- Provision Aurora Serverless v2 + RDS Proxy in staging
- Deploy schema migrations (agent_actions, conversations_meta, credits, audit_log, grievances, analytics tables)
- Write service layer (AgentActionService, ConversationMetaService, etc.)
- Unit + integration tests for new services

### Week 4: Wiring
- Wire agent actions → `agent_actions` table on every AI action
- Wire conversation routing → `conversations_meta` for metadata/indexing
- Wire Lago metering → `credit_ledger`
- Wire audit events → `audit_log`
- Deploy to staging; test end-to-end with pilot agents

### Week 5+: Gradual rollout
- Feature-flag new tables (write to both old queue/DDB + Postgres)
- Validate Postgres queries and analytics dashboards work
- Deploy to prod behind flags
- Migrate off flags when stable

**Key: Zero migration risk because you're not touching the CRM.**

**Safety valves:**
- Feature flags per service: `USE_POSTGRES_LEADS=true/false`
- Verify row counts: `SELECT COUNT(*) FROM leads WHERE tenant_id = $1` vs DynamoDB
- Rollback: switch feature flags back to DynamoDB

---

## 9. Files Changed

### New Files

| File | Purpose |
|---|---|
| `apps/crm/server/db/schema.ts` | Drizzle schema definition (leads, contacts, properties, etc.) |
| `apps/crm/server/db/migrations/001_init.sql` | Initial schema + RLS policies |
| `apps/crm/server/db/client.ts` | Drizzle + RDS Proxy connection pool |
| `apps/crm/server/db/middleware.ts` | Middleware to set `app.tenant_id` per request |
| `apps/crm/server/services/leadService.ts` | Lead CRUD (Drizzle) |
| `apps/crm/server/services/contactService.ts` | Contact CRUD + merge logic |
| `apps/crm/server/services/propertyService.ts` | Property CRUD + search |
| `apps/crm/server/services/visitService.ts` | Visit scheduling + tracking |
| `apps/crm/server/services/taskService.ts` | Task management |
| `apps/crm/server/services/khataService.ts` | Accounting transactions (ACID) |
| `apps/crm/server/services/projectService.ts` | Project/developer management |
| `apps/crm/server/services/agentActionService.ts` | Agent action audit log |
| `apps/crm/server/services/conversationMetaService.ts` | Conversation thread metadata |

### Modified Files

| File | Changes |
|---|---|
| `apps/crm/server/infra/cfn-backend.yaml` | Add Aurora cluster, RDS Proxy, VPC config; keep DynamoDB tables |
| `apps/crm/server/db.js` or `apps/crm/server/index.js` | Require new `apps/crm/server/db/client.ts` + middleware |
| `apps/crm/server/routes/*.js` (23 files) | Swap service imports (e.g., `crmDynamodbService` → `leadService`); routes unchanged |
| `docs/realestateflow-vision/README.md` | Add document 25 to index |
| `docs/realestateflow-vision/18-migration-strategy.md` | Expand with DB migration details |
| `docs/realestateflow-vision/21-roadmap.md` | Add Phase 0 DB provisioning to critical path |
| `docs/realestateflow-vision/24-implementation-plan.md` | Add Postgres setup to Weeks 6–7 |

### Unchanged

- Frontend (`apps/crm/real-estate-crm-app/`) — API contract identical
- Auth service (`services/reality-flow-authentication/`) — No changes
- Route signatures — Only service layer swaps; REST API unchanged

---

## 10. Cost Breakdown

### Aurora Serverless v2 (estimated, India pricing)

| Component | Config | Cost/month |
|---|---|---|
| **Compute (ACU)** | 0.5–64 ACU, avg 2 ACU | ₹2,000–3,000 |
| **Storage** | 50–200 GB (grows over time) | ₹500–2,000 |
| **RDS Proxy** | 100 client conns, ~20 DB conns | ₹300 |
| **Backups & replication** | Multi-AZ, auto, 5 replicas | ₹1,000 |
| **Data transfer (egress)** | 100 GB/month (if heavy reporting) | ₹1,000–2,000 |
| **Total** | **Early-stage (50 agencies)** | **₹5,000–8,000/mo** |

**vs DynamoDB at scale (1M writes/day):**
- On-demand: ₹8,000–15,000/mo
- Postgres is more cost-efficient at scale

---

## 11. What Stays in DynamoDB (6 tables)

| Table | Records/day | Why DynamoDB |
|---|---|---|
| **Conversations** (new) | 10,000–100,000 | Append-only, high write, Streams → EventBridge |
| **Messages** (new) | 100,000+ | Immutable log, query by (conversation_id, timestamp), TTL cleanup |
| **WebhookLog** | 5,000–50,000 | Idempotency checks, always TTL-expired |
| **NotificationsTable** | 1,000–10,000 | Scheduled reminders, read once, TTL |
| **NPSResponses** | 100–1,000 | Append-only survey data |
| **TenantApiKeys** | 1–10 | Pure key-value, <100ms lookup, rarely updated |
| **AIEmployeeProvisioning** | 10–50 | State machine, low-volume |
| **AgentSessionState** (new) | 1,000–10,000 | Ephemeral Strands/AgentCore session context |

**Total DynamoDB cost (8 tables):** ~₹500–1,500/mo (compare to Postgres: ₹5–8k/mo)

---

## 12. Validation Checklist (Before & After Cutover)

### Before Postgres Cutover
- [ ] Schema created + indexes built
- [ ] RLS policies created + tested
- [ ] Dual-write code deployed + monitoring
- [ ] 100% data parity: COUNT(table) in Postgres = COUNT(table) in DynamoDB
- [ ] Sample row spot-check across 10 random leads/contacts/properties
- [ ] ACID test: create 10 khata txns in one batch, verify atomicity
- [ ] Query performance baseline (P95 latency <100ms)
- [ ] RLS isolation test: tenant A cannot see tenant B's leads

### After Postgres Cutover
- [ ] Zero cross-tenant data leakage in 24 hours
- [ ] Query latency maintained (P95 <100ms)
- [ ] DynamoDB replication lag < 5 minutes (until decommissioned)
- [ ] Alerts fired (CloudWatch) if Postgres unavailable
- [ ] Rollback tested: switch feature flags, confirm DynamoDB still serves
- [ ] All 284 endpoints tested in staging via Playwright

---

## 13. ADR: Why Not Cloud SQL (MySQL) or RDS (Postgres)?

| Option | Verdict |
|---|---|
| **Aurora Postgres** (this plan) | ✅ **Chosen** — serverless auto-scale, native RLS, multi-AZ, ap-south-1 available |
| **RDS Postgres (on-demand)** | ⚠️ Fixed capacity; harder to scale elastically for Lambda spikes |
| **Cloud SQL (GCP)** | ❌ Not on AWS; data residency concerns |
| **Managed Timescale** | ❌ Overkill for this workload; better for pure time-series |
| **MongoDB (Atlas)** | ❌ Gives up ACID, RLS, and query power for schemalessness (anti-pattern) |

---

## Summary Decision Table

| Decision | Choice | Rationale |
|---|---|---|
| **Primary operational DB** | Aurora Serverless v2 Postgres | ACID, RLS, queryable, Lambda-friendly |
| **Tenant isolation** | Row-Level Security (RLS) | Single cluster, poolable, enforced at DB |
| **Connection pooling** | RDS Proxy | Mandatory for Lambda scale |
| **ORM** | Drizzle | TypeScript-native, Lambda-lightweight, typed queries |
| **Schema per tenant** | Single schema, RLS-gated | Simplest migrations |
| **Migration approach** | Dual-write strangler | Zero downtime, validate incrementally |
| **Tables to move** | 11 DynamoDB → ~30 Postgres | Transactional, joinable data |
| **Tables to keep** | 6 on DynamoDB | Append-only, high-write, ephemeral |
| **Timeline** | Weeks 6–12 (parallel with agents) | Planned, not critical path |

---

## Next Steps (First Actions)

1. **Spike RDS Proxy + Aurora in staging** — verify connection pooling works under 1000 concurrent Lambdas
2. **Write Drizzle schema** — full table definitions + indexes, matches existing data model
3. **Implement dual-write layer** — `leadService.create()` writes to both DynamoDB and Postgres, reads from DynamoDB (control flag)
4. **Validate data parity** — script to compare counts + sample rows
5. **Start migration:** projects → developers → areas → leads → contacts → properties (in that order, lowest risk first)

---

## References

- Drizzle: https://orm.drizzle.team/docs/get-started-postgresql
- RDS Proxy: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html
- Aurora Serverless: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraMigrationGuide/aurora-serverless.html
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Drizzle + Lambda: https://orm.drizzle.team/docs/get-started-postgresql#aws-lambda
