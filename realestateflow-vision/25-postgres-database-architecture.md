# 25 — PostgreSQL Database Architecture & Migration

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

## 2. Multi-Tenancy Strategy: Row-Level Security (RLS)

### Why RLS over schema-per-tenant or DB-per-tenant?

| Approach | Cost | Complexity | Lambda-friendly | Recommended |
|---|---|---|---|---|
| **Row-Level Security (RLS)** | Single cluster | Medium (policies) | ✅ Yes — connection pooling | ✅ **YES** |
| Schema-per-tenant | Single cluster | High (migrations per schema) | ⚠️ Harder pooling | ❌ Avoid |
| Database-per-tenant | Per-tenant cluster | Low | ❌ No pooling | ❌ Too heavy |

### How it works

```sql
-- Every table has tenant_id
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  ...
);

-- RLS policy: user can only see their tenant's rows
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leads
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- At request start in Lambda:
-- SET app.tenant_id = 'xyz' — Postgres enforces isolation on every query
```

**Benefits:**
- Lambda scales to 1000s of concurrent invocations → RDS Proxy handles connection pooling
- Enforced at the DB layer, not application code
- Migrations run once, apply to all tenants
- Natural fit for your existing `TENANT#` prefix pattern

---

## 3. What Moves Where

### ✅ MOVE TO POSTGRESQL (Aurora Serverless v2, ap-south-1)

**Transactional, queryable, reportable data:**

| Current DynamoDB Table | → PostgreSQL Tables |
|---|---|
| `cloudberry-real-estate-crm` | `leads`, `contacts`, `buyers`, `owners`, `tenants_customers`, `notes`, `meetings`, `visits` |
| `cloudberry-real-estate-core` | `properties`, `buildings`, `flats`, `units`, `floor_plans` |
| `cloudberry-real-estate-projects` | `projects`, `project_amenities` |
| `cloudberry-real-estate-developers` | `developers` |
| `cloudberry-real-estate-communities` | `areas`, `communities` |
| `cloudberry-real-estate-areas` | `area_banners` |
| `cloudberry-real-estate-khata` | `khata_transactions`, `khata_categories` |
| `cloudberry-real-estate-enquiries` | `enquiries` |
| `cloudberry-real-estate-b2b-details` | `b2b_leads` |
| `cloudberry-real-estate-agencies` | `agency_config` |
| **(new)** | `tasks`, `agent_actions`, `conversations_meta`, `credits`, `grievances` |

**Total: ~30 Postgres tables**

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
- `JSONB` for flexible sub-objects (config, settings, channel_handles) → avoids over-normalization while keeping query power
- `tenant_id UUID NOT NULL` on every table + RLS policy enforced at DB layer
- Foreign keys within tenant scope (enforce `tenant_id` match on joins)
- `TIMESTAMP` for all temporal queries (conversion funnels, cohort analysis)
- No `updated_at` auto-trigger yet — can add later if needed for change tracking

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

## 7. ORM Choice: Drizzle (TypeScript-Native)

### Why Drizzle

| Criteria | Drizzle | Knex | Prisma |
|---|---|---|---|
| **Bundle size** | 140 KB | 200 KB | 7 MB |
| **Lambda cold start** | ~50ms | ~100ms | ~1000ms |
| **TypeScript support** | ✅ First-class | ⚠️ Manual TS | ✅ Great |
| **Schema migrations** | ✅ Via `migrate()` | ✅ Via knex | ✅ Via Prisma CLI |
| **Query builder** | ✅ Typed | ⚠️ Untyped | ✅ Typed |
| **Raw SQL** | ✅ `sql()` helper | ✅ Native | ⚠️ Via `$queryRaw` |
| **Lambda-friendly** | ✅ Yes | ✅ Yes | ❌ Too heavy |

### Example Drizzle schema & queries

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

## 8. Migration: Dual-Write Phase (Strangler Fig)

**Timeline: Weeks 6–12 (runs parallel with agent implementation)**

### Phase 0: Setup (Weeks 6–7)
- Provision Aurora + RDS Proxy in staging
- Deploy migrations (schema + RLS policies)
- Write dual-write service layer
- Unit tests for new services

### Phase 1: Dual-Write (Weeks 8–9)
- Keep DynamoDB writes as-is
- Add Postgres writes on every CRM operation
- Read from DynamoDB (source of truth)
- Validate Postgres has identical data
- Zero user impact

### Phase 2: Read Migration (Weeks 10–11)
- Switch reads to Postgres (table by table)
- Start with `projects`, `developers`, `areas` (low-risk)
- Move to `leads`, `contacts`, `properties` (higher-risk)
- Monitor query latency, error rates

### Phase 3: Cutover (Week 12)
- Stop DynamoDB writes
- Decommission DynamoDB tables (except 6 that stay)
- Keep old DynamoDB data archived (S3 backup)

**Safety valves:**
- Feature flags per service: `USE_POSTGRES_LEADS=true/false`
- Verify row counts: `SELECT COUNT(*) FROM leads WHERE tenant_id = $1` vs DynamoDB
- Rollback: switch feature flags back to DynamoDB

---

## 9. Files Changed

### New Files

| File | Purpose |
|---|---|
| `server/db/schema.ts` | Drizzle schema definition (leads, contacts, properties, etc.) |
| `server/db/migrations/001_init.sql` | Initial schema + RLS policies |
| `server/db/client.ts` | Drizzle + RDS Proxy connection pool |
| `server/db/middleware.ts` | Middleware to set `app.tenant_id` per request |
| `server/services/leadService.ts` | Lead CRUD (Drizzle) |
| `server/services/contactService.ts` | Contact CRUD + merge logic |
| `server/services/propertyService.ts` | Property CRUD + search |
| `server/services/visitService.ts` | Visit scheduling + tracking |
| `server/services/taskService.ts` | Task management |
| `server/services/khataService.ts` | Accounting transactions (ACID) |
| `server/services/projectService.ts` | Project/developer management |
| `server/services/agentActionService.ts` | Agent action audit log |
| `server/services/conversationMetaService.ts` | Conversation thread metadata |

### Modified Files

| File | Changes |
|---|---|
| `server/infra/cfn-backend.yaml` | Add Aurora cluster, RDS Proxy, VPC config; keep DynamoDB tables |
| `server/db.js` or `server/index.js` | Require new `server/db/client.ts` + middleware |
| `server/routes/*.js` (23 files) | Swap service imports (e.g., `crmDynamodbService` → `leadService`); routes unchanged |
| `realestateflow-vision/README.md` | Add document 25 to index |
| `realestateflow-vision/18-migration-strategy.md` | Expand with DB migration details |
| `realestateflow-vision/21-roadmap.md` | Add Phase 0 DB provisioning to critical path |
| `realestateflow-vision/24-implementation-plan.md` | Add Postgres setup to Weeks 6–7 |

### Unchanged

- Frontend (`real-estate-crm-app/`) — API contract identical
- Auth service (`reality-flow-authentication/`) — No changes
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
