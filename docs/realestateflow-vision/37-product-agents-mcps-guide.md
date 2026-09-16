# 37 — Product Agents, MCPs & Skills — Complete Tenant Guide

> **Audience:** CRM tenants (real estate agencies) · **Phase:** 1–3 · **Scope:** What agents + tools they get, how to use them, workflow examples

---

## Hierarchy: Agents > MCP Tools > Business Rules

```
Tenant (Agency) interacts with:
    ↓
[Agent Personas] — 10 domain-bounded AI agents
    ├─ Conversation Router
    ├─ Sales Assistant
    ├─ Lead Qualifier
    ├─ Lead Scorer
    ├─ Assignment
    ├─ Follow-Up / Nurture
    ├─ Voice Agent
    ├─ Marketing Agent
    ├─ Automation Agent
    └─ Agency-Command (owner's copilot)
        ↓
[11 MCP Domain Servers] — Tool APIs for each business domain
    ├─ Lead MCP
    ├─ Property/Inventory MCP
    ├─ CRM/Contact MCP
    ├─ Visit/Scheduling MCP
    ├─ Task/Assignment MCP
    ├─ Knowledge/RAG MCP
    ├─ Voice MCP
    ├─ Marketing MCP
    ├─ Automation MCP
    ├─ Document/KYC MCP
    └─ Analytics MCP
        ↓
[Business Rules + Data Validation] — Enforced at tool layer
    ├─ Tenant isolation (WHERE tenant_id = X)
    ├─ RBAC (user role can call this tool?)
    ├─ Budget validation (enough credits?)
    ├─ Rate limits (per-agent, per-tenant)
    └─ Audit logging (immutable record)
```

---

## The 10 Product Agents (Tenant-Facing) — Quick Ref

| Agent | Tier | Role | Model | Primary Tools | Example |
|---|---|---|---|---|---|
| **Router** | T0 | Classify inbound, resolve contact, route to right agent | Haiku | CRM, Lead | "Budget ₹50L, 2BHK" → classified as lead_inquiry, routed to Sales Assistant |
| **Sales Assistant** | T1 | Answer property Qs, show inventory, book visits (grounded) | Sonnet | Property, Knowledge, Visit, Document | "Show 2BHK under 50L in Andheri" → displays 5 properties, explains payment plans, books visit |
| **Qualifier** | T0→T1 | Progressive profiling: extract budget, timeline, location, BHK, purpose | Haiku | Lead, CRM | Asks "What's your budget?" → extracts ₹40–50L; asks "Timeline?" → extracts "3 months" |
| **Scorer** | T0 | Deterministic + LLM signals → Hot/Warm/Cold score | Haiku | Lead | Evaluates engagement, budget fit, timeline fit → scores "HOT", confidence 92% |
| **Assignment** | T0/rules | Apply tenant rules (round-robin, region, affinity) to assign lead | Haiku | Lead, Task, CRM | Hot lead + Andheri → assigns to Priya (Andheri specialist) |
| **Follow-Up** | T2 | Multi-step journeys: conditional logic, channel-switching, delays | Sonnet | Marketing, Visit, Lead, Voice, Knowledge | Day 0: WhatsApp intro; Day 2: email if no reply; Day 5: call; Day 7: visit offer |
| **Voice Agent** | T1→T2 | Inbound/outbound calls (DLT-compliant, India) | Nova Sonic | Lead, Property, Visit, Knowledge | Prospect calls → classified, properties shown, visit booked on call |
| **Marketing Agent** | T2 | Generate campaigns, content, landing pages, schedule posts | Sonnet | Marketing, Property, Analytics, Document | Brief: "First-time buyer campaign" → agent drafts copy, creates landing page, schedules WhatsApp sequence |
| **Automation Agent** | T2 | Portal posting, lead retrieval, browser automation (approval-gated) | Sonnet | Automation, Property, Lead, Document | New property created → auto-posted to 99acres, MagicBricks, Housing.com |
| **Agency-Command** | T1 | Owner's WhatsApp/dashboard copilot: "What's hot?", revenue reports | Sonnet | Analytics, Lead, CRM, Task | "@agency-command hot leads" → returns 3 unbooked HOT leads, recommends follow-up |

---

## The 11 Business Domain MCPs — Tool Specs

Each MCP exposes business operations as REST-like tools. Agents call them.

### 1. Lead MCP
**Manages:** Lead lifecycle (create, update, search, qualify, score, convert)

**Tools:**
- `create_lead(name, phone, email, budget, location, bhk, ...)` → lead_id
- `get_lead(lead_id)` → full lead object
- `search_leads(filters: {score, status, assigned_to, date_range}, limit, offset)` → [leads...] paginated
- `qualify_lead(lead_id, qualification_data)` → { confidence, missing_slots, next_question }
- `score_lead(lead_id)` → { score: HOT|WARM|COLD, reasons, confidence }
- `convert_lead(lead_id, booking_data)` → updates status, creates booking record
- `get_lead_analytics(date_range, groupby: source|status|score|agent)` → funnel, conversion rates

**Example:**
```
Sales Assistant calls: search_leads({location: "Andheri", bhk: 2, price_max: 5M})
  ↓ Returns: 47 matching leads
Router calls: get_lead(lead_xyz) → full object
Scorer calls: score_lead(lead_xyz) → { score: "HOT", confidence: 0.92 }
```

---

### 2. Property / Inventory MCP
**Manages:** Property listings (sell, rent, projects)

**Tools:**
- `search_properties(filters: {location, bhk, price_range, amenities, sale|rental, available|sold})` → [properties...]
- `get_property(property_id)` → full property (specs, pricing, floor plans, amenities)
- `get_pricing(property_id)` → { base_price, registration, taxes, amenities }
- `get_payment_plan(property_id)` → { down_payment, installments, bank_tie_ups, duration }
- `list_amenities(property_id)` → [security, gym, pool, parking, ...]
- `get_images(property_id)` → [URLs to images, floor plans, 360 tour]
- `update_property_status(property_id, status: available|hold|sold)` 
- `get_property_availability(property_id, date_range)` → available viewing slots

**Example:**
```
Sales Assistant: "Show me 2BHK properties in Andheri under 50L"
  ↓ Calls: search_properties({location: "Andheri", bhk: 2, price_max: 5M})
  ↓ Returns 5 properties; displays top 3 with images + pricing
Prospect: "Tell me about payment plans for the first one"
  ↓ Calls: get_payment_plan(property_id_1)
  ↓ Returns: 20% down, 80% bank loan, EMI 45k/month
```

---

### 3. CRM / Contact MCP
**Manages:** Contacts, interactions (calls, meetings, notes, KYC docs)

**Tools:**
- `create_contact(name, phone, email, type: buyer|seller|owner, address)` → contact_id
- `search_contacts(filters: {type, name, phone, email}, limit, offset)` → [contacts...] (deduped)
- `merge_contacts(contact_id_1, contact_id_2)` → merges duplicates, preserves history
- `add_interaction(contact_id, type: call|email|meeting|whatsapp, notes, agent_id)` → appends to history
- `get_contact_timeline(contact_id)` → chronological interactions
- `update_contact(contact_id, updates: {phone, email, address, ...})`
- `upload_kyc_document(contact_id, doc_type, file)` → S3, returns URL

**Example:**
```
Router: Check if phone +91 98765 43210 exists
  ↓ Calls: search_contacts(phone="+91 98765 43210")
  ↓ Returns: existing contact "Rohit Sharma", contact_id_xyz
  ↓ Uses existing instead of creating duplicate
Router: Add WhatsApp interaction
  ↓ Calls: add_interaction(contact_xyz, type: "whatsapp", notes: "Looking for 2BHK Andheri")
```

---

### 4. Visit / Scheduling MCP
**Manages:** Property viewings, agent meetings, follow-up calls

**Tools:**
- `schedule_visit(lead_id, property_id, date_time, contact_info)` → booking_id, confirmation URL
- `check_availability(property_id, date_range)` → [available_slots...] based on agent schedules
- `get_visit(booking_id)` → visit details, assigned agent, directions
- `update_visit_status(booking_id, status: scheduled|completed|no_show|rescheduled)`
- `add_visit_feedback(booking_id, feedback: {agent_rating, property_rating, interested, notes})`
- `cancel_visit(booking_id, reason)`

**Example:**
```
Sales Assistant: "Can I visit tomorrow at 2pm?"
  ↓ Calls: check_availability(property_id_1, date="tomorrow")
  ↓ Returns: [10am, 2pm, 4pm] available
Sales Assistant: "Let me book you for 2pm"
  ↓ Calls: schedule_visit({property_id_1, date_time: "tomorrow 2pm", ...})
  ↓ Returns: booking_id_xyz, WhatsApp sent to prospect
Raj (agent) attends visit, provides feedback
  ↓ Calls: add_visit_feedback(booking_xyz, {agent_rating: 5, interested: true})
```

---

### 5. Task / Assignment MCP
**Manages:** Agent tasks, approvals, HITL queue

**Tools:**
- `create_task(type: lead_followup|approval|review, assigned_to, lead_id, due_at)` → task_id
- `get_task(task_id)` → task details
- `update_task_status(task_id, status: pending|in_progress|completed|blocked)`
- `list_tasks(filters: {assigned_to, status, due_date}, limit, offset)` → agent's inbox
- `add_task_comment(task_id, comment)` → for collaboration
- `mark_task_complete(task_id, outcome: {result: success|failed, notes})`

**Example:**
```
Assignment Agent: Create task for Raj
  ↓ Calls: create_task({
       type: "lead_followup",
       assigned_to: "raj@agency.com",
       lead_id: "lead_xyz",
       due_at: "+2h",  # SLA: respond within 2 hours
       message: "Hot lead – Rohit, 2BHK, 45–50L, visit booked tomorrow 2pm"
     })
Raj sees in inbox → calls: mark_task_complete({result: "success", notes: "Visit confirmed, lead interested"})
```

---

### 6. Knowledge / RAG MCP
**Manages:** Tenant's knowledge base (property guides, policies, FAQ, neighborhood info)

**Tools:**
- `query_knowledge(question, context: {property_id, location, lead_type})` → grounded answer + sources
- `ingest_document(doc_type: guide|policy|faq|neighborhood_info, file)` → uploads to S3, returns doc_id
- `get_source(source_id)` → original document snippet

**Example:**
```
Prospect: "What's the best payment plan for someone with an existing loan?"
  ↓ Sales Assistant calls: query_knowledge({
       question: "Best payment plan for existing loan holders",
       context: {lead_type: "existing_borrower"}
     })
  ↓ Knowledge MCP queries Bedrock KB (tenant's own guides)
  ↓ Returns: "We recommend [plan X] because [reasons]. Here's our guide."
```

---

### 7. Voice MCP
**Manages:** AI calling (inbound/outbound, DLT-compliant)

**Tools:**
- `inbound_call_handler(caller_phone, intent)` → routes to Voice Agent, records
- `schedule_outbound_call(lead_id, date_time)` → queues call for scheduled time
- `get_call_transcript(call_id)` → full transcript + speech-to-text
- `log_call_outcome(call_id, outcome: {connected, duration_sec, lead_status_update, notes})`

**Example:**
```
Prospect dials 1800-REALFLOW
  ↓ Telecom routes to Voice MCP inbound_call_handler()
  ↓ Voice Agent (Haiku classifier): "Looking for property, support, or something else?"
  ↓ Prospect: "Property"
  ↓ Transfers to Voice Agent (Sonnet, full conversation)
    → Shows properties, books visit, creates lead
  ↓ Transcript + lead auto-logged to CRM

Nurture Agent triggers follow-up call:
  ↓ Calls: schedule_outbound_call(lead_id_xyz, date_time: "tomorrow 10am")
  ↓ Voice Agent dials at 10am, follows up, checks visit status
```

---

### 8. Marketing MCP
**Manages:** Campaigns, content, messaging (WhatsApp, email, SMS)

**Tools:**
- `create_campaign(name, target_segment, channels: [whatsapp|email|sms], template_id, budget)` → campaign_id
- `schedule_message(campaign_id, lead_ids, date_time, channel)` → queues messages
- `get_campaign_metrics(campaign_id)` → { sent, delivered, opened, clicked, conversions, ROI }
- `pause_campaign(campaign_id)`
- `update_campaign_performance(campaign_id, metrics)` → updates tracking

**Example:**
```
Follow-Up Agent creates nurture campaign:
  ↓ Calls: create_campaign({
       name: "First-Time Buyer Guide",
       target_segment: "new_leads_budget_50L+",
       channels: ["whatsapp", "email"],
       budget: 10000
     })
  ↓ Returns: campaign_id_xyz

Schedule messages:
  ↓ Calls: schedule_message({
       campaign_id: campaign_xyz,
       lead_ids: [lead_1, lead_2, ...],
       date_time: "2026-06-18 10:00",
       channel: "whatsapp"
     })
  ↓ Returns: { scheduled: 245, skipped_no_consent: 12 }

Monitor performance:
  ↓ Calls: get_campaign_metrics(campaign_xyz)
  ↓ Returns: { sent: 245, opened: 98 (40%), clicked: 49 (20%), conversions: 10 (4%) }
```

---

### 9. Automation MCP
**Manages:** Browser automation, portal posting (legal approval required)

**Tools:**
- `post_to_portal(property_id, portal: 99acres|magicbricks|housing_com)` → uses AgentCore Browser Tool
- `retrieve_portal_leads(portal, date_range)` → fetches new leads from portal
- `get_automation_status(property_id)` → { posted_portals, lead_count_from_portals }

**Example:**
```
New property created in CRM
  ↓ Automation Agent triggered
  ↓ Calls: post_to_portal(property_id_1, portal: "99acres")
  ↓ Automation MCP:
       ├─ Validates property data
       ├─ Uses Browser Tool to login to 99acres
       ├─ Auto-fills form (title, price, images, description)
       ├─ Submits listing
       ├─ Extracts listing URL
       └─ Returns: { url: "99acres.com/property/xyz", posted_at: "..." }
  ↓ CRM updated: property.portals = [{portal: "99acres", url: "...", posted_at: "..."}]

Daily retrieval:
  ↓ Automation Agent calls: retrieve_portal_leads(portal: "99acres", date_range: "today")
  ↓ Returns: [new leads from 99acres lead form]
  ↓ Each lead auto-created in CRM with source="99acres"
```

---

### 10. Document / KYC MCP
**Manages:** Document storage, presigned URLs, KYC verification

**Tools:**
- `upload_document(contact_id, doc_type: identity|address|income|kyc, file)` → S3, returns doc_id
- `get_document_url(doc_id, expires_in: 1h|24h|7d)` → presigned URL (time-limited)
- `list_documents(contact_id)` → [doc_id, type, uploaded_at, ...]
- `verify_document(doc_id)` → marks verified_by, verified_at

**Example:**
```
Prospect ready to book property
  ↓ CRM Agent calls: upload_document({
       contact_id: contact_xyz,
       doc_type: "identity",
       file: <passport PDF>
     })
  ↓ Document MCP stores in S3, returns: doc_id_xyz

Admin manually verifies:
  ↓ Calls: verify_document(doc_id_xyz)
  ↓ CRM updated: contact.kyc_verified = true, verified_by: "admin_id"

Share with bank:
  ↓ Sales Assistant calls: get_document_url(doc_id_xyz, expires_in: "24h")
  ↓ Returns: presigned URL → share with bank for loan application
```

---

### 11. Analytics MCP
**Manages:** Tenant dashboards, reporting, KPIs

**Tools:**
- `get_lead_funnel(date_range)` → { inbound: N, qualified: N, visited: N, booked: N, conversion_% }
- `get_revenue_summary(date_range)` → { bookings: N, avg_price, total_revenue, by_agent, by_source }
- `get_agent_leaderboard(date_range)` → [{ agent, bookings, revenue, conversion_rate, avg_days_to_close }...]
- `get_lead_sources(date_range)` → { whatsapp: N%, portal: N%, email: N%, voice: N% }
- `get_roi_by_channel(date_range)` → { whatsapp: {spend, leads, conversions, roi}, ... }
- `get_churn_risk()` → [leads at risk] + reason

**Example:**
```
Agency owner opens dashboard:
  ↓ Dashboard calls: get_lead_funnel(date_range: "this_week")
  ↓ Returns: { inbound: 87, qualified: 71, visited: 18, booked: 5, conversion: 5.7% }

Agency owner asks Agency-Command copilot:
  ↓ "@agency-command revenue report"
  ↓ Agency-Command calls: get_revenue_summary(date_range: "this_month")
  ↓ Returns: { bookings: 12, avg_price: 65L, total_revenue: ₹7.8M, top_agent: "Raj" }

Trending analysis:
  ↓ Dashboard calls: get_roi_by_channel()
  ↓ Returns: { whatsapp: {spend: ₹50k, leads: 87, conversions: 12, roi: 12:1}, portal: {roi: 2:1} }
  ↓ Decision: "Increase WhatsApp budget by 50%"
```

---

## End-to-End Workflow Example

**Lead from inbound to booking (3 days):**

```
DAY 0, 9 AM:
  Prospect WhatsApp: "Looking for 2BHK in Andheri under 50L"
    ↓
  Conversation Router (T0, Haiku, <1s):
    ├─ Intent: "lead_inquiry" ✓
    ├─ Resolve contact: new contact "Rohit Sharma"
    ├─ Create lead via Lead MCP
    └─ Route to: Sales Assistant
    ↓
  Sales Assistant (T1, Sonnet):
    ├─ "Found 5 great 2BHK options in Andheri!"
    ├─ Calls Property MCP.search_properties({location: "Andheri", bhk: 2, price_max: 50L})
    ├─ Shows top 3 with images, price, floor plan
    ├─ Prospect: "Tell me about the first one"
    ├─ Calls Property MCP.get_property_details() + Knowledge MCP.query_knowledge()
    ├─ Explains specs + payment plan
    ├─ Prospect: "Can I visit?"
    ├─ Calls Visit MCP.check_availability() → shows slots [10am, 2pm, 4pm tomorrow]
    ├─ Prospect: "2pm works"
    ├─ Calls Visit MCP.schedule_visit() → booking_id_xyz, agent Raj assigned
    └─ Sends WhatsApp: "Booked! Tomorrow 2pm. Agent Raj will meet you."

  [Background, async]:
    Lead Qualifier (T0, Haiku):
      ├─ Extracts from convo: budget [45L, 50L], location "Andheri", bhk 2, timeline "immediate"
      ├─ Calls Lead MCP.qualify_lead() → 85% confidence
      └─ CRM updated
    
    Lead Scorer (T0, Haiku):
      ├─ Evaluates: budget fit ✓, timeline ✓, location ✓, engagement ✓
      ├─ Calls Lead MCP.score_lead() → { score: "HOT", confidence: 0.94 }
      └─ CRM updated
    
    Assignment Agent (T0/rules, Haiku):
      ├─ Rule check: HOT lead → Senior team, Andheri specialist → Raj
      ├─ Raj already assigned to visit (same agent)
      ├─ Creates Task via Task MCP
      └─ Slack: "@raj Hot lead – Rohit, visit tomorrow 2pm, 2h SLA"

DAY 1, 2 PM:
  Raj meets Rohit at property

DAY 1, 3 PM (post-visit):
  Raj marks task complete
  Follow-Up Nurture Agent (T2, Sonnet):
    ├─ Triggered by: lead.status = "visited"
    ├─ Step 1: "How was the property?" (WhatsApp, via Marketing MCP)
    ├─ Prospect: "Great! Ready to book"
    ├─ Step 2: "Process overview + KYC" (email, document link via Document MCP)
    ├─ Prospect uploads identity via Document MCP
    └─ Step 3: "Coordinating with bank for loan" (email, next 48h)

DAY 3, 4 PM:
  Prospect signs agreement
  Sales Assistant calls: Lead MCP.convert_lead({
    booking_date: "2026-06-20",
    property_id: "property_1",
    booking_amount: "₹5,00,000"
  })
  
  Analytics auto-updates:
    ├─ Funnel: inbound → qualified → visited → booked ✓
    ├─ Revenue: +₹5L
    ├─ Agent (Raj): +1 booking
    ├─ Time-to-close: 3 days (excellent!)
    └─ Source attribution: WhatsApp (for ROI tracking)

DAY 3, 6 PM:
  Agency owner opens dashboard:
    ├─ Calls Analytics MCP.get_lead_funnel() → 87 inbound, 71 qualified, 18 visited, 5 booked
    ├─ Calls Analytics MCP.get_agent_leaderboard() → Raj +2 bookings this week
    ├─ Calls Analytics MCP.get_roi_by_channel() → WhatsApp 20% conversion (12:1 ROI)
    └─ Decision: "Increase WhatsApp budget from ₹50k to ₹75k/day"
```

---

## How Tenants Access These

### 1. **Web Dashboard**
- Agents run in background; results appear as lead data, tasks, interactions
- Tenants see: lead list, lead detail, analytics dashboards, approval queues

### 2. **WhatsApp (Inbound)**
- Conversation Router + Sales Assistant handle automatically
- Tenant gets Slack/push notifications: "New hot lead booked a visit"

### 3. **Slack**
- Agency-Command copilot available via Slack: "@agency-command hot leads?"
- Task notifications: "Raj, you have a hot lead assigned"
- Daily briefing: "5 new hot leads, 2 visits today, ₹2.5L revenue yesterday"

### 4. **Marketing Campaigns**
- Click "Create Campaign" in dashboard → Marketing Agent drafts → tenant approves → publishes

### 5. **Portal Automation**
- Enable in dashboard: "Auto-post to 99acres"
- Automation Agent handles daily posting + lead retrieval

### 6. **Voice Calls**
- Prospect calls 1800-REALFLOW → Voice Agent handles → transcript + lead auto-created

### 7. **Approvals**
- Dashboard "Approval Queue" tab
- Review drafted follow-up message, campaign copy, portal posting
- Click Approve → agent auto-executes

---

## Autonomy Levels (Tenant-Configurable)

**Default is conservative; graduate with evidence.**

```
Level 0 (Most Conservative)
  Agent drafts → Tenant approves → Agent executes
  For: sales offers, payment terms, legal clauses, first visit follow-up

Level 1 (Moderate)
  Agent sends → Tenant notified → Can undo within 1h
  For: routine follow-ups, visit reminders

Level 2 (Autonomous)
  Agent executes autonomously; tenant reviews log daily
  For: pre-approved nurture templates, scheduled messages
```

**Example (Tenant configures):**
```
Follow-Up Agent Settings:
  Template: "Visit reminder (pre-approved)"
  Autonomy: Level 2
  Frequency: 1 message per lead per 3 days
  Channels: WhatsApp + Email
  Pause if: lead responded or visited
```

---

## Success Metrics (What Tenants Achieve)

| Metric | Typical Improvement | Evidence |
|---|---|---|
| **Response time to new lead** | 5 min → <1 min | Router + Sales Assistant instant engagement |
| **Lead qualification rate** | 60% → 90% | Qualifier extracts all slots, confidence scoring |
| **Visit booking rate** | 15% → 40% | Sales Assistant books visits in conversation |
| **Conversion rate (visit → booking)** | 20% → 35%+ | Follow-Up Agent nurture + Voice follow-up |
| **Time to close** | 14 days → 4–5 days | Faster nurture, multi-touch follow-up |
| **Cost per lead** | ₹2k → ₹500–1k | WhatsApp inbound (organic) vs. paid ads |
| **Revenue per agent** | ₹20L/year → ₹50L+/year | More leads, better conversion, less admin |

---

## Summary

**Tenants get:**
- ✅ 10 AI agents (Router, Sales Assistant, Qualifier, Scorer, Assignment, Follow-Up, Voice, Marketing, Automation, Agency-Command)
- ✅ 11 MCP tools (Lead, Property, CRM, Visit, Task, Knowledge, Voice, Marketing, Automation, Document, Analytics)
- ✅ Multi-channel inbound (WhatsApp, web, email, voice, portals)
- ✅ Autonomous lead qualification + scoring + assignment
- ✅ Grounded sales conversations + property details + visit booking
- ✅ Multi-touch follow-up journeys with conditional logic
- ✅ Portal automation (99acres, MagicBricks, etc.)
- ✅ Real-time analytics + reporting + copilot

**Execution model:**
- All agents run in background; results appear in CRM + notifications
- Approval queues for high-risk actions (legal, financial)
- Autonomy levels configurable per workflow
- Grounded (never hallucinates); security + audit logging enforced
- Priced in credits (not tokens) per action