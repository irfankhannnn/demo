# 26 — PostgreSQL Schema & Migration Scripts

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `apps/crm/server/infra/cfn-backend.yaml` and `apps/crm/server/infra/launch-tables-cfn.yaml` (all product data is on DynamoDB). Postgres is parked as a possible future reporting store fed from DynamoDB, with no date (see `docs/realestateflow-vision/27-phase-2-postgres-analytics-agent-tables.md`).

> **Status:** Implementation reference · **Date:** 2026-06-16 · **Scope:** SQL DDL, Drizzle schema definitions, and migration strategy for moving from DynamoDB to Postgres.

---

## 1. PostgreSQL Schema (Full DDL)

### Extensions & Setup

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS uuid-ossp;     -- UUID functions

-- Create app schema (optional, but good for namespacing)
CREATE SCHEMA app;
SET search_path TO app, public;

-- Tenant isolation: create a dummy tenant if testing
INSERT INTO tenants (id, name, plan) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, 'demo', 'team')
  ON CONFLICT DO NOTHING;
```

### Core Tables

```sql
-- TENANCY
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'team', -- free, solo, team, teamplus
  subscription_status VARCHAR(50) DEFAULT 'active', -- active, cancelled, expired
  settings JSONB DEFAULT '{}',
  max_seats INT DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name)
);

-- MASTER CONTACT DIRECTORY
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone VARCHAR(20),
  email VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  alternate_phone VARCHAR(20),
  alternate_email VARCHAR(255),
  -- Multi-channel handles (WhatsApp, Instagram, Telegram, etc.)
  channel_handles JSONB DEFAULT '{}', -- {"whatsapp": "+919123456789", "instagram": "handle", "telegram": "@handle"}
  address TEXT,
  city VARCHAR(100),
  kyc_status VARCHAR(50), -- pending, verified, rejected
  -- Document references (S3 keys)
  photo_s3_key VARCHAR(255),
  pan_doc_s3_key VARCHAR(255),
  aadhar_doc_s3_key VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  UNIQUE(tenant_id, phone),
  UNIQUE(tenant_id, email)
);

-- LEADS (Prospects in pipeline)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'new', -- new, contacted, qualified, negotiating, converted, lost
  priority VARCHAR(50) DEFAULT 'medium', -- high, medium, low
  source VARCHAR(100), -- whatsapp, instagram_dm, instagram_comment, facebook_msg, telegram, website_chat, lead_ad, portal, b2b, manual
  requirement JSONB DEFAULT '{}', -- {type: "2bhk", bhk: 2, config: "flat", furnished: "semi"}
  budget JSONB DEFAULT '{}', -- {min: 8000000 (paise), max: 12000000, currency: "INR"}
  timeline JSONB DEFAULT '{}', -- {months: 3, flexible: true}
  location JSONB DEFAULT '{}', -- {areas: ["Bandra", "Worli"], coordinates: {lat: 19.05, lng: 72.83}}
  score VARCHAR(50), -- hot, warm, cold
  score_reasons JSONB DEFAULT '{}', -- {budget_fit: true, timeline_urgent: true, visited_before: false, engagement_high: true}
  score_updated_at TIMESTAMP,
  assigned_to UUID, -- agent/user ID from Cognito
  assigned_at TIMESTAMP,
  notes TEXT,
  
  -- Qualification progression (auto-filled by Qualifier agent)
  qualified_at TIMESTAMP,
  qualification_data JSONB DEFAULT '{}', -- {budget_confirmed: true, timeline_confirmed: true, config_confirmed: true}
  
  -- Attribution tracking (for ROI)
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(255),
  ad_id VARCHAR(100),
  post_id VARCHAR(100),
  portal_name VARCHAR(100),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- BUYERS (Post-purchase customers)
CREATE TABLE buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  -- Purchase history (array of transactions)
  purchases JSONB DEFAULT '[]', -- [{property_id, price, registration_status, stamp_duty, brokerage, loan_details}]
  -- KYC for financial transactions
  kyc JSONB DEFAULT '{}', -- {pan: "...", aadhar: "...", bank_account: "..."}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- TENANTS / CUSTOMERS (Those who rent)
CREATE TABLE tenants_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  -- Current rental
  current_rental JSONB DEFAULT '{}', -- {property_id, lease_start, lease_end, monthly_rent}
  -- Rental history
  rental_history JSONB DEFAULT '[]', -- [{property_id, lease_start, lease_end, monthly_rent}]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- OWNERS (Property owners)
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  -- Portfolio of properties
  portfolio JSONB DEFAULT '[]', -- [{property_id, status: "for-sale" | "for-rent" | "self-occupied"}]
  -- Banking details for rental/sale proceeds
  bank_details JSONB DEFAULT '{}', -- {account_number, ifsc, account_holder}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- DEVELOPERS (Real estate developers)
CREATE TABLE developers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  contact_info JSONB DEFAULT '{}', -- {phone, email, office_address}
  properties_built INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  UNIQUE(tenant_id, name)
);

-- AREAS / COMMUNITIES
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  coordinates JSONB DEFAULT '{}', -- {lat: 19.05, lng: 72.83}
  landmarks JSONB DEFAULT '[]', -- ["near_station", "business_district"]
  tier VARCHAR(50), -- metro, tier1, tier2
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  UNIQUE(tenant_id, name, city)
);

-- PROJECTS (Real estate projects)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  developer_id UUID REFERENCES developers(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  type VARCHAR(50), -- residential, commercial, mixed
  status VARCHAR(50) DEFAULT 'off-plan', -- off-plan, under-construction, ready, sold-out
  units_total INT,
  units_available INT,
  price_range JSONB DEFAULT '{}', -- {min: 8000000, max: 20000000}
  amenities JSONB DEFAULT '[]', -- ["gym", "pool", "parking", "security"]
  thumbnail_s3_key VARCHAR(255),
  brochure_s3_key VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- PROPERTIES / UNITS (Inventory)
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Location
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  building_id UUID, -- FK to buildings (added later)
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  -- Type & configuration
  type VARCHAR(50) NOT NULL, -- flat, villa, office, shop, studio
  bedroom_count INT,
  bathroom_count INT,
  size_sqft INT, -- Built-up area
  carpet_area_sqft INT,
  furnishing VARCHAR(50), -- unfurnished, semi-furnished, furnished
  -- Status
  status VARCHAR(50) DEFAULT 'available', -- available, for-sale, sold, for-rent, rented, vacant
  
  -- Sale info
  sale_info JSONB DEFAULT '{}', -- {price, broker_commission, registration_status, sale_deed_s3, tax_receipt_s3}
  -- Rental info
  rental_info JSONB DEFAULT '{}', -- {monthly_rent, lease_term_months, available_from, lease_agreement_s3}
  -- KYC & Documentation
  kyc_docs JSONB DEFAULT '{}', -- {title_deed_s3, occupancy_cert_s3, tax_receipt_s3, property_photo_s3}
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- BUILDINGS (Real-world buildings, for hierarchy)
CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  floors INT,
  built_year INT,
  amenities JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- VISITS (Scheduled site visits)
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, no-show, rescheduled, cancelled
  outcome VARCHAR(100), -- interested, not-interested, need-time, price-negotiation
  notes TEXT,
  feedback JSONB DEFAULT '{}', -- {agent_feedback: "...", customer_reaction: "..."}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- TASKS (Agent action items)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL, -- Cognito user ID
  -- What entity does this task relate to?
  entity_type VARCHAR(50) NOT NULL, -- lead, property, contact, visit
  entity_id UUID NOT NULL,
  -- Task details
  title VARCHAR(255),
  description TEXT,
  due_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'open', -- open, in-progress, completed, cancelled
  priority VARCHAR(50) DEFAULT 'medium', -- high, medium, low
  
  -- Auto-created by agent?
  created_by_agent BOOLEAN DEFAULT FALSE,
  created_by_agent_type VARCHAR(100), -- sales_assistant, voice_agent, follow_up_engine
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- NOTES / COMMENTS (on any entity)
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- What entity does this note belong to?
  entity_type VARCHAR(50) NOT NULL, -- lead, property, contact, visit
  entity_id UUID NOT NULL,
  -- Note content
  body TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE, -- internal team notes vs customer-visible
  created_by UUID, -- Cognito user ID or agent ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- MEETINGS (Scheduled meetings with customers)
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  meeting_type VARCHAR(50), -- call, video, in-person
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, no-show, cancelled
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- KHATA / ACCOUNTING
CREATE TABLE khata_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- income, expense
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL),
  UNIQUE(tenant_id, name)
);

CREATE TABLE khata_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES khata_categories(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL, -- in paise
  date DATE NOT NULL,
  party_name VARCHAR(255),
  description TEXT,
  reference_number VARCHAR(100),
  created_by UUID, -- user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- ENQUIRIES (Contact form submissions)
CREATE TABLE enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  source VARCHAR(100), -- website_form, portal, manual
  message TEXT,
  status VARCHAR(50) DEFAULT 'new', -- new, contacted, qualified, converted, lost
  priority VARCHAR(50) DEFAULT 'medium',
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- B2B LEADS (Special B2B channel, e.g., Ten BKC)
CREATE TABLE b2b_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  contact_info JSONB DEFAULT '{}', -- {name, email, phone}
  opportunity_size VARCHAR(50), -- small, medium, large
  status VARCHAR(50) DEFAULT 'new', -- new, qualified, proposal_sent, closed
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- AGENCY CONFIGURATION (Per-tenant settings)
CREATE TABLE agency_config (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  team_name VARCHAR(255),
  logo_s3_key VARCHAR(255),
  settings JSONB DEFAULT '{}', -- {default_commission: 2.0, currency: "INR", language: "en"}
  automation_rules JSONB DEFAULT '{}', -- {lead_auto_assign: true, auto_follow_up: true}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- GRIEVANCES (DPDP Act compliance)
CREATE TABLE grievances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_email VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- data_access, data_deletion, data_correction, complaint
  description TEXT,
  status VARCHAR(50) DEFAULT 'open', -- open, resolved, rejected
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- AI & AGENT AUDIT LOG (for billing & governance)
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_type VARCHAR(100) NOT NULL, -- sales_assistant, qualifier, voice_agent, marketing_agent, follow_up_engine
  action VARCHAR(255) NOT NULL, -- replied_to_lead, asked_question, booked_visit, generated_content
  entity_type VARCHAR(50), -- lead, property, contact, visit, campaign
  entity_id UUID,
  input JSONB DEFAULT '{}', -- what the agent was asked to do
  output JSONB DEFAULT '{}', -- what the agent did
  credits_used DECIMAL(10, 2) DEFAULT 0,
  approved_by UUID, -- NULL = auto-approved, user_id = manually approved by human
  approval_status VARCHAR(50) DEFAULT 'auto', -- auto, approved, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- CONVERSATION METADATA (Index for conversation threads)
CREATE TABLE conversations_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL, -- whatsapp, instagram_dm, facebook_msg, telegram, web, sms
  source VARCHAR(100), -- ad_id, post_id, portal_name, organic
  status VARCHAR(50) DEFAULT 'open', -- open, closed, escalated
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  message_count INT DEFAULT 0,
  -- DynamoDB Messages table will hold individual messages
  -- This table is just the index/metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);

-- CREDITS (Billing ledger)
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  balance DECIMAL(12, 2) DEFAULT 0, -- current credits available
  total_purchased DECIMAL(12, 2) DEFAULT 0,
  total_used DECIMAL(12, 2) DEFAULT 0,
  last_recharged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_isolation CHECK (tenant_id IS NOT NULL)
);
```

---

## 2. Indexes for Query Performance

```sql
-- SEARCH & DISCOVERY INDEXES
CREATE INDEX idx_leads_tenant_status ON leads(tenant_id, status);
CREATE INDEX idx_leads_tenant_score ON leads(tenant_id, score);
CREATE INDEX idx_leads_tenant_assigned ON leads(tenant_id, assigned_to);
CREATE INDEX idx_leads_created_at ON leads(tenant_id, created_at DESC);

CREATE INDEX idx_contacts_tenant_phone ON contacts(tenant_id, phone);
CREATE INDEX idx_contacts_tenant_email ON contacts(tenant_id, email);
CREATE INDEX idx_contacts_tenant_name ON contacts(tenant_id, name);

CREATE INDEX idx_properties_tenant_status ON properties(tenant_id, status);
CREATE INDEX idx_properties_tenant_area ON properties(tenant_id, area_id);

CREATE INDEX idx_visits_lead_id ON visits(lead_id);
CREATE INDEX idx_visits_tenant_scheduled ON visits(tenant_id, scheduled_at DESC);
CREATE INDEX idx_visits_status ON visits(tenant_id, status);

CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_entity ON tasks(tenant_id, entity_type, entity_id);
CREATE INDEX idx_tasks_due_at ON tasks(assigned_to, due_at) WHERE status = 'open';

CREATE INDEX idx_agent_actions_tenant_created ON agent_actions(tenant_id, created_at DESC);
CREATE INDEX idx_agent_actions_agent_type ON agent_actions(agent_type, created_at DESC);

CREATE INDEX idx_khata_tx_tenant_date ON khata_transactions(tenant_id, date DESC);

CREATE INDEX idx_conversations_meta_contact ON conversations_meta(contact_id, opened_at DESC);
CREATE INDEX idx_conversations_meta_lead ON conversations_meta(lead_id);

-- FULL-TEXT SEARCH INDEXES (using pg_trgm)
CREATE INDEX idx_contacts_name_trgm ON contacts USING gist(name gist_trgm_ops);
CREATE INDEX idx_properties_type_trgm ON properties USING gist(type gist_trgm_ops);
CREATE INDEX idx_areas_name_trgm ON areas USING gist(name gist_trgm_ops);
CREATE INDEX idx_projects_name_trgm ON projects USING gist(name gist_trgm_ops);

-- COMPOUND INDEXES FOR COMMON QUERIES
CREATE INDEX idx_leads_tenant_score_assigned ON leads(tenant_id, score, assigned_to);
CREATE INDEX idx_visits_lead_status ON visits(lead_id, status);
CREATE INDEX idx_buyers_contact_id ON buyers(contact_id);
CREATE INDEX idx_owners_contact_id ON owners(contact_id);
```

---

## 3. Row-Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE khata_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE khata_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

-- Generic policy: users can only see their tenant's rows
-- For each table:
CREATE POLICY tenant_isolation ON contacts
  USING (tenant_id = current_setting('app.tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation ON leads
  USING (tenant_id = current_setting('app.tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation ON properties
  USING (tenant_id = current_setting('app.tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation ON visits
  USING (tenant_id = current_setting('app.tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

-- ... repeat for all tables

-- Master tenant policy (only superuser/admin can see all)
-- (Optional: create separate admin role with BYPASS RLS privilege)
CREATE ROLE admin_rls WITH NOLOGIN;
GRANT admin_rls TO <admin_lambda_role>;
ALTER ROLE admin_rls IN DATABASE <db> SET rls.bypass_to_superuser = ON;
```

---

## 4. Drizzle ORM Schema File

### `apps/crm/server/db/schema.ts`

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  timestamp,
  jsonb,
  boolean,
  integer,
  decimal,
  date,
  primaryKey,
  foreignKey,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// TENANTS
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  plan: varchar('plan', { length: 50 }).default('team'),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('active'),
  settings: jsonb('settings').default({}),
  maxSeats: integer('max_seats').default(5),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// CONTACTS
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    name: varchar('name', { length: 255 }).notNull(),
    alternatePhone: varchar('alternate_phone', { length: 20 }),
    alternateEmail: varchar('alternate_email', { length: 255 }),
    channelHandles: jsonb('channel_handles').default({}),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    kycStatus: varchar('kyc_status', { length: 50 }),
    photoS3Key: varchar('photo_s3_key', { length: 255 }),
    panDocS3Key: varchar('pan_doc_s3_key', { length: 255 }),
    aadharDocS3Key: varchar('aadhar_doc_s3_key', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    idx_tenant_phone: index('idx_contacts_tenant_phone').on(table.tenantId, table.phone),
    idx_tenant_email: index('idx_contacts_tenant_email').on(table.tenantId, table.email),
    uniq_tenant_phone: unique('uniq_tenant_phone').on(table.tenantId, table.phone),
    uniq_tenant_email: unique('uniq_tenant_email').on(table.tenantId, table.email),
  })
);

// LEADS
export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 50 }).default('new'),
    priority: varchar('priority', { length: 50 }).default('medium'),
    source: varchar('source', { length: 100 }),
    requirement: jsonb('requirement').default({}),
    budget: jsonb('budget').default({}),
    timeline: jsonb('timeline').default({}),
    location: jsonb('location').default({}),
    score: varchar('score', { length: 50 }),
    scoreReasons: jsonb('score_reasons').default({}),
    scoreUpdatedAt: timestamp('score_updated_at', { withTimezone: true }),
    assignedTo: uuid('assigned_to'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    notes: text('notes'),
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    qualificationData: jsonb('qualification_data').default({}),
    utmSource: varchar('utm_source', { length: 100 }),
    utmMedium: varchar('utm_medium', { length: 100 }),
    utmCampaign: varchar('utm_campaign', { length: 255 }),
    adId: varchar('ad_id', { length: 100 }),
    postId: varchar('post_id', { length: 100 }),
    portalName: varchar('portal_name', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    idx_tenant_status: index('idx_leads_tenant_status').on(table.tenantId, table.status),
    idx_tenant_score: index('idx_leads_tenant_score').on(table.tenantId, table.score),
    idx_created_at: index('idx_leads_created_at').on(table.tenantId, table.createdAt),
  })
);

// PROPERTIES
export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),
    buildingId: uuid('building_id'),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    type: varchar('type', { length: 50 }).notNull(),
    bedroomCount: integer('bedroom_count'),
    bathroomCount: integer('bathroom_count'),
    sizeSqft: integer('size_sqft'),
    carpetAreaSqft: integer('carpet_area_sqft'),
    furnishing: varchar('furnishing', { length: 50 }),
    status: varchar('status', { length: 50 }).default('available'),
    saleInfo: jsonb('sale_info').default({}),
    rentalInfo: jsonb('rental_info').default({}),
    kycDocs: jsonb('kyc_docs').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    idx_tenant_status: index('idx_properties_tenant_status').on(table.tenantId, table.status),
  })
);

// VISITS
export const visits = pgTable(
  'visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 50 }).default('scheduled'),
    outcome: varchar('outcome', { length: 100 }),
    notes: text('notes'),
    feedback: jsonb('feedback').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    idx_lead_status: index('idx_visits_lead_status').on(table.leadId, table.status),
  })
);

// ... (add remaining tables similarly)

// AREAS
export const areas = pgTable('areas', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }).default('India'),
  coordinates: jsonb('coordinates').default({}),
  landmarks: jsonb('landmarks').default([]),
  tier: varchar('tier', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// PROJECTS
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  developerId: uuid('developer_id').references(() => developers.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 50 }),
  status: varchar('status', { length: 50 }).default('off-plan'),
  unitsTotal: integer('units_total'),
  unitsAvailable: integer('units_available'),
  priceRange: jsonb('price_range').default({}),
  amenities: jsonb('amenities').default([]),
  thumbnailS3Key: varchar('thumbnail_s3_key', { length: 255 }),
  brochureS3Key: varchar('brochure_s3_key', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// DEVELOPERS
export const developers = pgTable('developers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  website: varchar('website', { length: 255 }),
  contactInfo: jsonb('contact_info').default({}),
  propertiesBuilt: integer('properties_built').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// KHATA
export const khataCategories = pgTable('khata_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const khataTransactions = pgTable('khata_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => khataCategories.id, { onDelete: 'set null' }),
  amount: bigint('amount').notNull(),
  date: date('date').notNull(),
  partyName: varchar('party_name', { length: 255 }),
  description: text('description'),
  referenceNumber: varchar('reference_number', { length: 100 }),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// AGENT ACTIONS
export const agentActions = pgTable('agent_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  agentType: varchar('agent_type', { length: 100 }).notNull(),
  action: varchar('action', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),
  input: jsonb('input').default({}),
  output: jsonb('output').default({}),
  creditsUsed: decimal('credits_used', { precision: 10, scale: 2 }).default('0'),
  approvedBy: uuid('approved_by'),
  approvalStatus: varchar('approval_status', { length: 50 }).default('auto'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ... (continue for remaining tables)
```

---

## 5. Database Client Setup (Drizzle + RDS Proxy)

### `apps/crm/server/db/client.ts`

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create RDS Proxy connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10, // RDS Proxy handles pooling; keep Lambda connections low
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Set app.tenant_id on every connection
pool.on('connect', (client) => {
  client.query('SET application_name = $1', ['realestateflow-lambda']);
});

// Create Drizzle client
export const db = drizzle(pool, { schema });

// Middleware to set tenant context
export async function setTenantContext(tenantId: string) {
  // This gets called in every Lambda handler before DB queries
  await pool.query('SET app.tenant_id = $1::uuid', [tenantId]);
}

// Export for migrations
export { pool };
```

### `apps/crm/server/middleware/tenantContext.ts`

```typescript
import { pool } from '../db/client';

export async function tenantContextMiddleware(req: any, res: any, next: any) {
  try {
    const tenantId = req.tenantId; // Set by extractTenantId middleware
    if (!tenantId) throw new Error('No tenant ID in request');

    // Get a connection from the pool
    const client = await pool.connect();
    
    try {
      // Set the tenant context for RLS
      await client.query('SET app.tenant_id = $1::uuid', [tenantId]);
      
      // Attach client to request for later use
      req.dbClient = client;
      next();
    } catch (err) {
      client.release();
      throw err;
    } finally {
      // Release connection after response is sent
      res.on('finish', () => {
        client.release();
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database context error' });
  }
}
```

---

## 6. Service Example: Lead Service

### `apps/crm/server/services/leadService.ts`

```typescript
import { db } from '../db/client';
import { leads, contacts } from '../db/schema';
import { eq, and, desc, like } from 'drizzle-orm';

export async function createLead(tenantId: string, data: any) {
  const [lead] = await db
    .insert(leads)
    .values({
      tenantId,
      contactId: data.contactId,
      status: 'new',
      source: data.source,
      budget: data.budget,
      timeline: data.timeline,
      location: data.location,
      ...data,
    })
    .returning();

  return lead;
}

export async function getLeadById(tenantId: string, leadId: string) {
  // RLS will automatically filter by tenant_id
  const [lead] = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.tenantId, tenantId),
        eq(leads.id, leadId)
      )
    );

  return lead;
}

export async function getHotLeads(tenantId: string, limit: number = 50) {
  return db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.tenantId, tenantId),
        eq(leads.score, 'hot')
      )
    )
    .orderBy(desc(leads.createdAt))
    .limit(limit);
}

export async function updateLeadScore(tenantId: string, leadId: string, score: 'hot' | 'warm' | 'cold') {
  const [updated] = await db
    .update(leads)
    .set({ score, scoreUpdatedAt: new Date() })
    .where(
      and(
        eq(leads.tenantId, tenantId),
        eq(leads.id, leadId)
      )
    )
    .returning();

  return updated;
}

export async function searchLeads(tenantId: string, query: string) {
  // Use pg_trgm for fuzzy name search
  return db
    .select()
    .from(leads)
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .where(
      and(
        eq(leads.tenantId, tenantId),
        // Fuzzy search on contact name
        // Note: requires custom SQL for ILIKE + similarity
      )
    );
}
```

---

## 7. Migration Scripts (Strangler Fig)

### Phase 1: Dual-Write

```typescript
// Old service stays: crmDynamodbService
// New service runs in parallel: leadService (Postgres)

export async function createLeadDualWrite(tenantId: string, data: any) {
  // Write to DynamoDB (source of truth for now)
  const ddbLead = await crmDynamodbService.createLead(tenantId, data);
  
  // Write to Postgres (for validation)
  const pgLead = await leadService.createLead(tenantId, data);
  
  // Log for monitoring
  console.log(`Dual-write for lead ${ddbLead.id}: DDB and Postgres`);
  
  return ddbLead; // Return DDB version (source of truth)
}
```

### Phase 2: Read Switchover

```typescript
// Feature flag to control read source
const USE_POSTGRES_READS = process.env.USE_POSTGRES_READS === 'true';

export async function getLead(tenantId: string, leadId: string) {
  if (USE_POSTGRES_READS) {
    return leadService.getLeadById(tenantId, leadId);
  } else {
    return crmDynamodbService.getLead(tenantId, leadId);
  }
}
```

### Phase 3: Cutover

```typescript
// Stop writing to DynamoDB; Postgres is now source of truth
export async function createLead(tenantId: string, data: any) {
  return leadService.createLead(tenantId, data);
  // No DynamoDB write
}
```

---

## 8. Migration Validation

### Data Parity Check

```typescript
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { db } from './db/client';
import { leads } from './db/schema';
import { eq } from 'drizzle-orm';

export async function validateDataParity(tenantId: string) {
  const ddbClient = new DynamoDBClient({ region: 'ap-south-1' });
  
  // Count leads in DynamoDB
  const ddbResult = await ddbClient.send(
    new ScanCommand({
      TableName: 'cloudberry-real-estate-crm',
      FilterExpression: 'begins_with(pk, :tenant)',
      ExpressionAttributeValues: {
        ':tenant': { S: `TENANT#${tenantId}#ENTITY#LEAD` },
      },
      Select: 'COUNT',
    })
  );
  
  // Count leads in Postgres
  const pgResult = await db
    .select({ count: sql`COUNT(*)` })
    .from(leads)
    .where(eq(leads.tenantId, tenantId));
  
  console.log(`DynamoDB count: ${ddbResult.Count}`);
  console.log(`Postgres count: ${pgResult[0].count}`);
  
  if (ddbResult.Count !== pgResult[0].count) {
    throw new Error('Data parity mismatch!');
  }
  
  return { ddbCount: ddbResult.Count, pgCount: pgResult[0].count, status: 'PASS' };
}
```

---

## 9. Drizzle Migrations

### `apps/crm/server/db/migrations/001_init.sql`

This file is generated by Drizzle's migration tool:

```bash
npx drizzle-kit generate:pg --schema ./server/db/schema.ts --out ./server/db/migrations
```

The migration includes:
- All CREATE TABLE statements
- All CREATE INDEX statements
- All RLS ENABLE / CREATE POLICY statements

---

## Summary

| Component | File | Purpose |
|---|---|---|
| **Schema** | `apps/crm/server/db/schema.ts` | Drizzle ORM definitions |
| **Connection** | `apps/crm/server/db/client.ts` | RDS Proxy pool + Drizzle instance |
| **Middleware** | `apps/crm/server/middleware/tenantContext.ts` | Set `app.tenant_id` per request |
| **Services** | `apps/crm/server/services/*.ts` | Lead, Contact, Property, etc. CRUD |
| **Migrations** | `apps/crm/server/db/migrations/*.sql` | DDL + RLS policies (auto-generated) |
| **Validation** | `apps/crm/server/scripts/validateParity.ts` | Dual-write verification |

**Next: Write migration scripts and update routes to use new services.**
