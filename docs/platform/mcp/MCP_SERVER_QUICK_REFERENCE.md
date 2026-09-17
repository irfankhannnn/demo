# MCP Server — Quick Reference Guide

**Status:** Phase 3 Complete  
**Last Updated:** June 28, 2026

---

## Quick Start

### Local Development

```bash
# Start the local MCP server
cd server
MCP_TENANT_ID=test-agency node mcp-server/localServer.js

# Server runs on http://localhost:4001/mcp
# Health check: http://localhost:4001/health
```

### Testing with curl

```bash
# Test tools/list
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-agency" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Test resources/list
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-agency" \
  -d '{"jsonrpc":"2.0","method":"resources/list","id":2}'

# Test prompts/list
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-agency" \
  -d '{"jsonrpc":"2.0","method":"prompts/list","id":3}'

# Test tools/call
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-agency" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"get_leads",
      "arguments":{"limit":5}
    },
    "id":4
  }'

# Test resources/read
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-agency" \
  -d '{
    "jsonrpc":"2.0",
    "method":"resources/read",
    "params":{"uri":"crm://recent-leads"},
    "id":5
  }'

# Test prompts/get
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-agency" \
  -d '{
    "jsonrpc":"2.0",
    "method":"prompts/get",
    "params":{"name":"daily-summary"},
    "id":6
  }'
```

---

## File Structure

```
agency-app/api/mcp-server/
├── httpServer.js          # Main MCP server (StreamableHTTP transport)
├── lambdaHandler.js       # Lambda handler wrapper
├── localServer.js         # Local dev server
├── tools.js               # Tool definitions (imports from shared)
├── resources.js           # Resource handlers (5 resources)
├── prompts.js             # Prompt generators (5 prompts)
└── index.js               # (deprecated, use httpServer.js)
```

---

## Tools (54 Available)

All 54 CRM tools are available via `tools/list` and `tools/call`.

**Examples:**
- `create_lead` — Create a new lead
- `get_leads` — List leads with filters
- `update_lead` — Update a lead
- `create_meeting` — Create a meeting
- `get_upcoming_meetings` — Get meetings in next 7 days
- `create_property` — Create a property
- `search_properties` — Search properties
- `create_buyer` — Create a buyer
- `get_buyers` — List buyers

**Full list:** See `agency-app/api/shared/toolDefinitions.js`

---

## Resources (5 Available)

### 1. crm://recent-leads
**Description:** Last 10 leads (summary)  
**Returns:**
```json
{
  "count": 10,
  "leads": [
    {
      "id": "lead-123",
      "name": "Raj Kumar",
      "phone": "9876543210",
      "email": "raj@example.com",
      "status": "qualified",
      "budget": 5000000,
      "createdAt": "2026-06-28T10:00:00Z"
    }
  ]
}
```

### 2. crm://upcoming-meetings
**Description:** Meetings in next 7 days  
**Returns:**
```json
{
  "count": 3,
  "meetings": [
    {
      "id": "meeting-456",
      "title": "Site Visit - Bandra",
      "description": "Property viewing with buyer",
      "startTime": "2026-06-29T14:00:00Z",
      "endTime": "2026-06-29T15:00:00Z",
      "location": "Bandra, Mumbai",
      "attendees": ["Raj Kumar", "Agent Name"],
      "status": "scheduled"
    }
  ]
}
```

### 3. crm://agency-profile
**Description:** Agency metrics and stats  
**Returns:**
```json
{
  "metrics": {
    "totalLeads": 150,
    "totalBuyers": 45,
    "totalSellers": 30,
    "totalOwners": 25,
    "totalCustomers": 40,
    "totalProperties": 85,
    "totalMeetings": 200,
    "activeLeads": 45,
    "convertedLeads": 30,
    "conversionRate": 20,
    "averageBudget": 4500000,
    "highPriorityLeads": 12
  }
}
```

### 4. crm://hot-leads
**Description:** High priority, qualified leads  
**Returns:**
```json
{
  "count": 5,
  "leads": [
    {
      "id": "lead-789",
      "name": "Priya Sharma",
      "phone": "9123456789",
      "budget": 7500000,
      "priority": "high",
      "status": "qualified",
      "requirements": { "bhk": 3, "area": "Andheri" },
      "lastInteraction": "2026-06-28T09:30:00Z"
    }
  ]
}
```

### 5. crm://active-properties
**Description:** Active properties available for sale/rent  
**Returns:**
```json
{
  "count": 15,
  "properties": [
    {
      "id": "prop-101",
      "title": "3 BHK Apartment in Bandra",
      "type": "apartment",
      "area": "Bandra",
      "price": 5000000,
      "bhk": 3,
      "status": "active",
      "owner": "John Doe",
      "createdAt": "2026-06-25T10:00:00Z"
    }
  ]
}
```

---

## Prompts (5 Available)

### 1. qualify-lead
**Arguments:** `leadId` (required)  
**Purpose:** Analyze a lead and determine qualification  
**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "qualify-lead",
    "arguments": { "leadId": "lead-123" }
  },
  "id": 1
}
```
**Returns:** System + user prompts for Claude to analyze the lead

### 2. draft-followup
**Arguments:** `leadId` (required), `channel` (required: whatsapp/email/sms)  
**Purpose:** Draft a followup message  
**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "draft-followup",
    "arguments": { "leadId": "lead-123", "channel": "whatsapp" }
  },
  "id": 2
}
```
**Returns:** System + user prompts for Claude to draft the message

### 3. daily-summary
**Arguments:** (none)  
**Purpose:** Generate daily CRM summary  
**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "daily-summary"
  },
  "id": 3
}
```
**Returns:** System + user prompts for Claude to generate summary

### 4. property-match
**Arguments:** `buyerId` (required)  
**Purpose:** Find properties matching buyer's requirements  
**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "property-match",
    "arguments": { "buyerId": "buyer-456" }
  },
  "id": 4
}
```
**Returns:** System + user prompts for Claude to match properties

### 5. meeting-prep
**Arguments:** `meetingId` (required)  
**Purpose:** Prepare meeting briefing  
**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "meeting-prep",
    "arguments": { "meetingId": "meeting-789" }
  },
  "id": 5
}
```
**Returns:** System + user prompts for Claude to prepare briefing

---

## Headers

### Required Headers
- `x-tenant-id` — Tenant ID (set by API Gateway JWT authorizer)

### Optional Headers
- `x-user-id` — User ID (defaults to 'mcp-agent')
- `x-client-id` — Client ID (e.g., 'anthropic', 'openai')

---

## Error Handling

### MCP Error Codes
- `MethodNotFound` — Unknown method or tool
- `InvalidRequest` — Invalid parameters
- `InternalError` — Server error

### Example Error Response
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Tool not found: unknown_tool"
  },
  "id": 1
}
```

---

## Logging

All MCP requests are logged with:
- `timestamp` — ISO 8601 timestamp
- `method` — MCP method (tools/list, tools/call, etc.)
- `tenantId` — Tenant ID
- `userId` — User ID
- `clientId` — Client ID (anthropic, openai, etc.)
- `statusCode` — HTTP response code
- `latencyMs` — Request duration in milliseconds

**Log Location:** CloudWatch Logs (in production) or console (in development)

---

## Deployment

### Local Development
```bash
node agency-app/api/mcp-server/localServer.js
```

### AWS Lambda
1. Create CloudFormation stack with `infra/cfn-mcp.yaml`
2. Deploy MCP Lambda function
3. API Gateway invokes Lambda with JWT authorizer
4. Lambda handler: `mcp-server/lambdaHandler.handler`

---

## Common Workflows

### Workflow 1: Qualify a Lead
```
Claude: "Qualify the lead with ID lead-123"
    ↓
Claude calls: prompts/get with name="qualify-lead", arguments={leadId: "lead-123"}
    ↓
Claude receives system + user prompts
    ↓
Claude calls: tools/call with name="get_lead", arguments={leadId: "lead-123"}
    ↓
Claude analyzes and provides qualification score
```

### Workflow 2: Daily Summary
```
Claude: "Generate a daily summary"
    ↓
Claude calls: prompts/get with name="daily-summary"
    ↓
Claude receives system + user prompts
    ↓
Claude calls: resources/read with uri="crm://agency-profile"
Claude calls: resources/read with uri="crm://recent-leads"
Claude calls: resources/read with uri="crm://upcoming-meetings"
    ↓
Claude generates summary with insights
```

### Workflow 3: Find Properties for Buyer
```
Claude: "Find properties for buyer buyer-456"
    ↓
Claude calls: prompts/get with name="property-match", arguments={buyerId: "buyer-456"}
    ↓
Claude receives system + user prompts
    ↓
Claude calls: resources/read with uri="crm://active-properties"
Claude calls: tools/call with name="get_buyer", arguments={buyerId: "buyer-456"}
    ↓
Claude matches properties and provides recommendations
```

---

## Troubleshooting

### Issue: "Missing x-tenant-id header"
**Solution:** Add `x-tenant-id` header to request

### Issue: "Tool not found"
**Solution:** Check tool name in `tools/list` response

### Issue: "Unknown resource"
**Solution:** Check resource URI in `resources/list` response

### Issue: "Unknown prompt"
**Solution:** Check prompt name in `prompts/list` response

### Issue: "Lead not found"
**Solution:** Verify leadId exists in CRM

---

## Next Steps

- **Phase 4:** CloudFormation Deployment
- **Phase 5:** OAuth Integration
- **Phase 6:** Dashboard Page (AI Integrations UI)

---

*For detailed documentation, see:*
- `docs/platform/mcp/PHASE_3_COMPLETION_SUMMARY.md` — Phase 3 completion details
- `docs/platform/mcp/MCP_REMAINING_PLAN.md` — Remaining phases (4-9)
- `agency-app/api/mcp-server/httpServer.js` — Main server code
- `agency-app/api/mcp-server/resources.js` — Resource handlers
- `agency-app/api/mcp-server/prompts.js` — Prompt generators
