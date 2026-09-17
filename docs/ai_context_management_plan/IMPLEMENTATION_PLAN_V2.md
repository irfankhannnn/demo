# AI Employee & WhatsApp Integration — Implementation Plan V2

## Current State Summary

### What Works
- WhatsApp message flow: Baileys → webhook → CRM → LLM → reply (verified working)
- 22 CRM tools available to AI agent (create_lead, search_leads, create_buyer, etc.)
- Credit system with atomic DynamoDB transactions
- Agent audit logging (90-day retention)
- AI Employee config (enable/disable, follow-up mode)
- Multi-member auth (ADMIN/MEMBER roles, invite system, seat management)
- Razorpay billing (subscriptions, credit packs, trial system)

### What's Broken / Missing
- No WhatsApp conversation history stored or displayed
- No chat UI in CRM
- AI replies indistinguishable from user messages on WhatsApp
- ConnectWhatsApp page shows QR even when already connected
- No session status persistence in backend
- `/api/leads/agents` returns only current user, not all team members
- No manual lead assignment UI
- WhatsApp audit logging commented out (lines 38, 51, 117 in processor)
- No conversation context — agent is stateless per message
- Missing backend endpoints: `/auth/whatsapp/status/:phone`, `/auth/whatsapp/disconnect/:phone`
- AI responses too verbose (Gemma model limitation)

---

## Implementation Phases

### PHASE 1: WhatsApp Session & Connection Robustness (Backend)
**Goal:** Make WhatsApp connection reliable, persistent, and properly tracked.

#### 1.1 Add Missing Backend Endpoints
**Files:** `agency-app/api/routes/auth.js`, `agency-app/api/bailey.js`

- `GET /api/auth/whatsapp/status/:phone` — Check if WhatsApp session is connected
  - Calls baileys-service `GET /v1/pairing/status/:phone`
  - Returns `{ connected, state, qrCode, sessionId }`
  - Already implemented in `bailey.js` (`getConnectionStatus`) but no route exposes it

- `POST /api/auth/whatsapp/disconnect/:phone` — Disconnect WhatsApp session
  - Calls baileys-service `POST /v1/pairing/logout`
  - Already implemented in `bailey.js` (`disconnectWhatsApp`) but no route exposes it

- `GET /api/auth/whatsapp/sessions` — List all WhatsApp sessions for tenant
  - Returns all connected numbers for the agency
  - Used by UI to show connection status in sidebar

#### 1.2 Fix ConnectWhatsApp UI Logic
**File:** `agency-app/web/src/pages/onboarding/ConnectWhatsApp.tsx`

Current bug: Always shows QR pairing flow even when already connected.

Fix:
- On mount, call `GET /auth/whatsapp/status/:phone` FIRST
- If `connected === true`, show "Connected" state immediately (no QR)
- Only show QR flow if status is `disconnected` or `connecting`
- Add "Refresh connection" button that re-checks status
- If session was lost (status returns disconnected), show QR again
- Persist connected phone in localStorage for quick check on next visit

#### 1.3 Add WhatsApp Session Status to CRM Dashboard
**File:** `agency-app/web/src/pages/crm/CRMDashboard.tsx`

- Replace the "Connect WhatsApp" button with a status indicator:
  - Green dot + "WhatsApp Connected" (if connected)
  - Red dot + "Connect WhatsApp" (if not connected)
  - Clicking opens the ConnectWhatsApp page
- Poll status every 30 seconds when on dashboard

---

### PHASE 2: WhatsApp Conversation History (Backend + Storage)
**Goal:** Store and retrieve all WhatsApp messages for UI display.

#### 2.1 Create WhatsApp Conversation Service
**File:** `agency-app/api/whatsappConversationService.js` (NEW)

DynamoDB schema (in existing CRM table `cloudberry-dev-real-estate-crm`):
```
PK: TENANT#{tenantId}#WHATSAPP#{contactPhone}
SK: MESSAGE#{timestamp}#{messageId}
Fields: direction (inbound/outbound), text, fromMe, aiGenerated, 
        toolCalls, creditsCharged, status, createdAt
```

Functions:
- `logMessage(tenantId, contactPhone, message)` — Store inbound/outbound message
- `getConversation(tenantId, contactPhone, { limit, cursor })` — Paginated message history
- `listConversations(tenantId, { limit, cursor })` — List all conversations for tenant
- `getConversationSummary(tenantId, contactPhone)` — Last message + unread count

#### 2.2 Enable WhatsApp Audit Logging
**File:** `agency-app/api/scripts/whatsapp-message-processor.js`

- Uncomment lines 38, 51, 117 (logMessage, logOutcome calls)
- Replace with new `whatsappConversationService.logMessage()` calls
- Add `aiGenerated: true` flag to outbound AI replies
- Include `toolCalls` array in outcome logging

#### 2.3 Add Conversation API Routes
**File:** `agency-app/api/routes/whatsappConversations.js` (NEW)

```
GET  /api/whatsapp/conversations              — List all conversations
GET  /api/whatsapp/conversations/:phone       — Get message history for contact
GET  /api/whatsapp/conversations/:phone/summary — Last message + unread count
PATCH /api/whatsapp/conversations/:phone/read  — Mark conversation as read
```

Auth: JWT + tenant extraction (all roles can view)

#### 2.4 Add AI Reply Prefix/Symbol
**File:** `agency-app/api/scripts/whatsapp-message-processor.js`

- Prefix all AI replies with `🤖 ` (robot emoji) so user can distinguish AI from human
- This makes it clear in WhatsApp which messages are AI-generated
- Also store `aiGenerated: true` in conversation log for UI filtering

---

### PHASE 3: WhatsApp Chat UI (Frontend)
**Goal:** Show WhatsApp conversations in the CRM with a chat interface.

#### 3.1 Create WhatsApp Inbox Page
**File:** `agency-app/web/src/pages/crm/WhatsAppInbox.tsx` (NEW)

Layout (WhatsApp Web style):
```
┌──────────────────┬──────────────────────────┐
│ Conversation List │  Chat Thread             │
│                  │                          │
│ 📱 Danish +91... │  ┌─────────────────────┐ │
│    "create lead" │  │ User: create lead.. │ │
│                  │  │ 🤖 AI: Done! Lead.. │ │
│ 📱 Priya +91...  │  │ User: search buyers │ │
│    "search..."   │  │ 🤖 AI: 3 buyers...  │ │
│                  │  └─────────────────────┘ │
│                  │  [Message input - readonly]│
└──────────────────┴──────────────────────────┘
```

Features:
- Left panel: List of conversations (contact phone, last message, timestamp, unread badge)
- Right panel: Chat thread with message bubbles
  - User messages: right-aligned, blue background
  - AI messages: left-aligned, gray background, 🤖 icon
  - Tool calls shown as collapsible cards ("Created lead: Danish")
- Search bar to filter conversations
- Read-only (no sending from UI in MVP — just monitoring)
- Auto-refresh every 10 seconds
- Empty state: "No WhatsApp conversations yet"

#### 3.2 Add Navigation
**File:** `agency-app/web/src/pages/crm/CRMDashboard.tsx`

- Add "WhatsApp Inbox" button with MessageCircle icon
- Show unread count badge if there are unread conversations
- Route: `/crm/whatsapp-inbox`

**File:** `agency-app/web/src/App.tsx`
- Add route: `<Route path="/crm/whatsapp-inbox" element={<WhatsAppInbox />} />`

#### 3.3 Add API Service Methods
**File:** `agency-app/web/src/services/api.ts`

```typescript
async getWhatsAppConversations(): Promise<Conversation[]>
async getWhatsAppConversation(phone: string): Promise<Message[]>
async getWhatsAppConversationSummary(phone: string): Promise<Summary>
async markWhatsAppConversationRead(phone: string): Promise<void>
```

---

### PHASE 4: AI Employee UI Completion (Frontend)
**Goal:** Polish the AI Employee management and monitoring UI.

#### 4.1 Redesign AI Employee Page
**File:** `agency-app/web/src/pages/crm/AiEmployee.tsx`

Current: Basic Settings + Activity Log tabs
New: 3 tabs with richer UI:

**Tab 1: Dashboard**
- Status card: "AI Employee is ACTIVE" / "DISABLED" with toggle
- WhatsApp connection status (connected/disconnected)
- Today's stats: Messages processed, leads created, credits used
- Quick actions: Enable/disable, Test message

**Tab 2: Activity Log** (enhanced)
- Current: Basic list of agent actions
- Add: Filter by date range, agent type, status
- Add: Click to expand and see full tool call details
- Add: Export to CSV
- Show conversation link (jump to WhatsApp Inbox for that contact)

**Tab 3: Settings** (enhanced)
- Current: enable/disable, follow-up mode, channels
- Add: AI personality selector (Professional, Friendly, Direct)
- Add: Auto-reply toggle (when AI should/shouldn't respond)
- Add: Whitelist/blacklist phone numbers
- Add: Business hours (AI only responds during set hours)

#### 4.2 Fix AI Response Verbosity
**File:** `agency-app/api/agents/prompts.js`

Current issue: Gemma model produces verbose responses despite prompt instructions.

Options (implement in order):
1. **Switch to `gemini-2.5-flash`** — Better instruction following than Gemma
   - Update `GEMINI_MODEL` in `.env`
   - More capable of following "max 2 sentences" constraint
2. **Add response post-processing** — Truncate AI responses to 200 chars
   - In `whatsapp-message-processor.js`, after getting agent result
   - If text > 200 chars, truncate at last sentence boundary
3. **Add few-shot examples** — Show the model exact input→output pairs
   - Add 3-4 examples in the system prompt showing concise responses

#### 4.3 Add Agent Activity to Lead Detail
**File:** `agency-app/web/src/components/ContactActivityTimeline.tsx`

- Add WhatsApp messages to the activity timeline
- Show: "AI created this lead via WhatsApp" with timestamp
- Show: "AI sent follow-up message" with message preview
- Link to full conversation in WhatsApp Inbox

---

### PHASE 5: Multi-User Lead Assignment (Backend + Frontend)
**Goal:** Properly handle lead assignment to team members with UI.

#### 5.1 Fix `/api/leads/agents` Endpoint
**File:** `agency-app/api/routes/leads.js`

Current bug: Returns only current user.
```javascript
router.get('/agents', validateToken, extractTenantId, async (req, res) => {
  const username = req.user?.username || 'Admin';
  res.json([{ username, label: username }]);
});
```

Fix: Fetch all team members from auth service.
```javascript
router.get('/agents', validateToken, extractTenantId, async (req, res) => {
  const authServiceUrl = process.env.AUTH_SERVICE_URL;
  const response = await fetch(`${authServiceUrl}/users`, {
    headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY }
  });
  const users = await response.json();
  const members = users
    .filter(u => u.status === 'ACTIVE')
    .map(u => ({ 
      userId: u.userId, 
      username: u.displayName, 
      label: u.displayName,
      role: u.role 
    }));
  res.json(members);
});
```

#### 5.2 Add Lead Assignment UI
**File:** `agency-app/web/src/components/LeadDrawer.tsx` (or equivalent)

- Add "Assigned To" dropdown in lead detail view
- Dropdown shows all team members (fetched from `/api/leads/agents`)
- On change, call `PATCH /api/crm/leads/:id` with `assignedTo` field
- Show assignment badge in lead list view
- Color code: Green (assigned to me), Blue (assigned to others), Gray (unassigned)

#### 5.3 Add "My Leads" Filter
**File:** `agency-app/web/src/pages/crm/LeadsList.tsx` (or equivalent)

- Add filter dropdown: "All Leads" / "My Leads" / "Unassigned"
- "My Leads" filters by `assignedTo === currentUserId`
- Show assignment column in lead table
- Add bulk assignment: Select multiple leads → assign to member

#### 5.4 Add Assignment Activity Logging
**File:** `agency-app/api/crmDynamodbService.js`

- When `assignedTo` changes, log an activity entry:
  ```
  PK: TENANT#{tenantId}#LEAD#{leadId}
  SK: ACTIVITY#{timestamp}
  type: 'assignment'
  from: previousAssignee
  to: newAssignee
  assignedBy: currentUserId
  ```
- Show in lead activity timeline

---

### PHASE 6: Credits & Payments Polish (Frontend)
**Goal:** Make credits UI clear and actionable.

#### 6.1 Enhance Credit Balance Card
**File:** `agency-app/web/src/components/CreditBalanceCard.tsx`

- Show breakdown: "AI Employee: 45 credits | WhatsApp: 12 credits | Lead Creation: 30 credits"
- Add "This month" vs "Last month" comparison
- Show estimated days until credits run out (based on usage rate)
- Add low-credit alert banner when < 20% remaining

#### 6.2 Add AI Employee Cost Tracking
**File:** `agency-app/web/src/components/AgentActivityLog.tsx`

- Show total credits spent on AI Employee this month
- Show per-agent breakdown (WhatsApp Bot: 45 credits, Qualifier: 15 credits, etc.)
- Show cost per conversation (average credits per WhatsApp exchange)

#### 6.3 Fix Billing Settings Page
**File:** `agency-app/web/src/pages/crm/BillingSettings.tsx`

- Ensure credit balance, ledger, and plan info all load correctly
- Add "AI Employee" section showing:
  - Provisioning status (pending/live/suspended)
  - Monthly cost (₹7,999)
  - Next billing date
  - Cancel button (with confirmation)
- Add credit usage graph (simple bar chart, last 7 days)

---

### PHASE 7: Robustness & Edge Cases (Backend)

#### 7.1 Fix Baileys Service Stability
**File:** `baileys-service/src/baileysClient.js`

- Add `sentMessageIds` cleanup (LRU with max 10000 entries)
- Add connection state persistence (write to file on connect/disconnect)
- Add heartbeat: Log connection status every 60 seconds
- Handle `MessageCounterError` gracefully (skip message, don't crash)
- Add max reconnection attempts (5) before giving up

#### 7.2 Fix Webhook Signature Verification
**File:** `agency-app/api/bailey.js`

- In production, reject webhooks if `BAILEY_WEBHOOK_SECRET` is not set
- Currently returns `true` (accepts all) if secret is missing — security risk

#### 7.3 Add Health Check for Baileys Service
**File:** `baileys-service/src/routes/health.js`

- Enhanced health check: `/health/deep`
  - Check if any sessions are connected
  - Check WebSocket connection to WhatsApp
  - Check CRM webhook URL is reachable
  - Return session count and states

#### 7.4 Remove Hardcoded Dev Values
**File:** `agency-app/api/routes/webhooks.js`

- Move `HARDCODED_TENANT_BY_PHONE` to env var `DEV_TENANT_MAPPING`
- Guard all dev-only code with `IS_LOCAL_DEV` check
- Remove AWS credentials from `.env` (use IAM role in production)

---

## Implementation Order & Priority

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| 1. WhatsApp Session Robustness | P0 | Small | None |
| 2. Conversation History Backend | P0 | Medium | None |
| 3. WhatsApp Chat UI | P0 | Medium | Phase 2 |
| 4. AI Employee UI | P1 | Medium | Phase 2 |
| 5. Multi-User Lead Assignment | P1 | Medium | None |
| 6. Credits & Payments Polish | P2 | Small | None |
| 7. Robustness & Edge Cases | P2 | Small | None |

## File Change Summary

### New Files (8)
- `agency-app/api/whatsappConversationService.js`
- `agency-app/api/routes/whatsappConversations.js`
- `agency-app/web/src/pages/crm/WhatsAppInbox.tsx`
- `agency-app/web/src/components/WhatsAppChatThread.tsx`
- `agency-app/web/src/components/WhatsAppConversationList.tsx`
- `agency-app/web/src/components/LeadAssignmentDropdown.tsx`
- `agency-app/web/src/components/AiEmployeeDashboard.tsx`
- `agency-app/web/src/types/whatsapp.ts`

### Modified Files (12)
- `agency-app/api/routes/auth.js` — Add status/disconnect/sessions endpoints
- `agency-app/api/routes/webhooks.js` — Fix auth logic, remove hardcoded values
- `agency-app/api/scripts/whatsapp-message-processor.js` — Enable audit, add AI prefix
- `agency-app/api/routes/leads.js` — Fix `/agents` endpoint
- `agency-app/api/agents/prompts.js` — Improve conciseness, add few-shot examples
- `agency-app/api/bailey.js` — Fix signature verification
- `baileys-service/src/baileysClient.js` — Stability fixes
- `agency-app/web/src/pages/onboarding/ConnectWhatsApp.tsx` — Fix QR logic
- `agency-app/web/src/pages/crm/CRMDashboard.tsx` — Add nav + status
- `agency-app/web/src/pages/crm/AiEmployee.tsx` — Redesign with 3 tabs
- `agency-app/web/src/services/api.ts` — Add conversation APIs
- `agency-app/web/src/App.tsx` — Add routes

## Key Design Decisions

1. **WhatsApp chat is read-only in MVP** — Users monitor AI conversations but don't send from CRM UI. Sending from CRM adds complexity (typing indicators, delivery status) that can come later.

2. **AI replies prefixed with 🤖** — Simple, universally understood. No need for WhatsApp formatting tricks that may not render on all devices.

3. **Conversations stored in existing CRM table** — No new DynamoDB table needed. Uses `TENANT#{tenantId}#WHATSAPP#{phone}` PK pattern consistent with existing schema.

4. **Lead assignment uses existing auth service** — No new user table. Fetches team members from auth microservice `/users` endpoint.

5. **AI verbosity fixed by model switch** — `gemini-2.5-flash` follows instructions better than `gemma-4-26b-a4b-it`. Post-processing truncation as fallback.

6. **Dev mode bypass for self-chat** — In development, all `fromMe` messages are processed. In production, only true self-chat or AI-trigger-prefixed messages.
