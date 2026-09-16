# Phase 3 — Scale: Automation, Marketing, Voice, & Analytics

> **Status:** Vision completion · **Duration:** Weeks 13–20 (5-week sprint) · **Prerequisites:** Phases 0–2 complete · **Scope:** Breadth — multi-channel, outbound voice, marketing automation, browser automation, advanced analytics.

---

## Overview

Phase 3 is where the "AI Agency Operating System" vision truly takes shape. By Phase 2's end, you have:
- ✅ WhatsApp inbound lead capture + qualification
- ✅ Agent audit, analytics, and credits
- ✅ Foundation secure (secrets rotated, RBAC enforced, CI passing)

Phase 3 adds the remaining engines:
- **Follow-up automation** (multi-touch journeys, email/WhatsApp sequences)
- **Outbound voice** (inbound call answering, follow-up reminders, scheduling)
- **Marketing automation** (campaign generation, content creation, closed-loop attribution)
- **Portal automation** (lead retrieval, gated listing posting)
- **Advanced analytics** (cohort analysis, agent performance, ROI by channel)

**Timeline: Weeks 13–20 (overlaps slightly with post-Phase 2 polish).**

---

## 1. Follow-Up & Nurture Automation (Weeks 13–15)

### Architecture

Implemented via **AWS Step Functions** (long-running workflows) + **EventBridge** (event choreography):

```
Lead qualifies (event: LeadQualified)
  ↓
  EventBridge rule → Step Function "nurture_journey_2bhk_buyer"
  ↓
  [Day 0] Send intro WhatsApp + project brochure (Chatwoot API)
  [Day 1] Send floor plan + pricing (Chatwoot API)
  [Day 3] Send nearby projects + video tour (Chatwoot API)
  [Day 7] Send limited-time offer + schedule call (Chatwoot API)
  [Day 14] Final follow-up: "Ready to visit?" (Chatwoot API)
  ↓
  [If visit scheduled] → Create Task, stop journey
  [If no response by Day 14] → Move to "warm" segment, retry in 30 days
  ↓
  Log outcomes → `credit_ledger` (cost per journey)
```

### Deliverables

1. **Step Functions state machine:** Define nurture journeys per persona (2BHK buyer, seller, owner, tenant).
   - Conditional logic: if `lead.timeline_months < 3`, shorten gaps (urgent buyer). If `lead.score = warm`, extend delays (long-cycle).
   - Human-in-the-loop: approval-queue on Day 7 offer message (requires ADMIN approval before sending).

2. **Journey definitions (JSON config):**
   ```json
   {
     "id": "journey_2bhk_buyer",
     "trigger": "LeadQualified",
     "filter": { "config": "2bhk", "budget_min": 5000000 },
     "steps": [
       { "day": 0, "action": "send_whatsapp", "template": "intro_brochure", "requiresApproval": false },
       { "day": 1, "action": "send_whatsapp", "template": "floor_plans", "requiresApproval": false },
       { "day": 7, "action": "send_whatsapp", "template": "limited_offer", "requiresApproval": true },
       { "day": 14, "action": "close_or_retry", "nextRetry": 30 }
     ]
   }
   ```

3. **Task creation service:** On visit scheduled, auto-create task in CRM (`task_type: "follow_up_visit_scheduled"`).

4. **Outbound message templates** (Chatwoot-compatible):
   - Intro: "Hi {{contact.name}}, we have 3 projects matching your 2BHK requirement. See details: [link]"
   - Floor plan: "Here's the floor plan you asked for. 3 BHK, 1,650 sqft, ₹1.2Cr. Interested in a tour?"
   - Offer: "Special 48-hour offer: ₹5Lac cashback on registration this week. Book now: [calendar link]"
   - Reminder: "Haven't heard from you in a week. Still interested? Let's schedule a site visit: [link]"

5. **Attribution tracking:** Each message includes UTM (`utm_source: "nurture_journey_2bhk_buyer", utm_medium: "whatsapp"`) to track conversion ROI.

### Wiring

```javascript
// server/services/nurtureBotService.js
export async function startJourney(tenantId, leadId, journeyId) {
  const lead = await getLeadFromCRM(tenantId, leadId);
  const journey = await loadJourneyDefinition(journeyId);
  
  // Validate lead matches journey filter
  if (!journey.filter.every(k => lead[k] === journey.filter[k])) return null;
  
  // Start Step Function execution
  const sfnInput = { tenantId, leadId, journeyId, startedAt: new Date() };
  const execution = await stepFunctions.startExecution({
    stateMachineArn: `arn:aws:states:...journey_${journeyId}`,
    input: JSON.stringify(sfnInput),
  });
  
  // Log to audit
  await auditLog(tenantId, 'journey_started', { leadId, journeyId, executionArn: execution.executionArn });
  
  return execution;
}
```

### Cost

- Step Functions: ~₹0.0001 per transition → ~₹5-10/month per journey (thousands of journeys)
- Chatwoot API calls: included in Chatwoot subscription
- Credits: log each message as "nurture_message" (0.1 credits each, e.g., 5-step journey = 0.5 credits)

---

## 2. Outbound Voice (Weeks 15–17)

### Extend the disabled AI Calling service

The codebase already has a fully-built but disabled AI Calling microservice (`ai-calling-service/`). Phase 3 re-enables and expands it:

1. **Inbound call handling:**
   - Customer calls the RealestateFlow number (DLT-registered, TRAI-compliant).
   - Exotel routes to ElevenLabs Conversational AI.
   - System prompt: "Hi, this is RealestateFlow. Are you looking to buy, sell, or rent a property?"
   - Capture intent + key details (budget, timeline, location) via natural conversation.
   - Route to Sales Assistant agent (Phase 1 logic) for qualification.
   - If qualified, create lead; if not, offer callback from sales team.

2. **Outbound follow-up calls:**
   - Triggered by nurture journey: `action: "schedule_call"`
   - Agent proposes times via WhatsApp, customer picks 1, call is auto-scheduled.
   - At scheduled time, Exotel initiates call → ElevenLabs agent → conversational follow-up.
   - Agent asks: "Hi {{name}}, following up on your interest in 2BHK properties near {{location}}. Ready to schedule a site visit?"
   - Capture response → update Lead status + create Visit.

3. **Outbound reminders:**
   - Visit scheduled for tomorrow? → Call reminder 2h before.
   - Document received? → Call to walk through doc + answer questions.
   - Days since last contact? → Automated check-in call.

### Deliverables

1. **Uncomment & re-enable** `aiCallingInternal.js` routes in `server/server.js`.
2. **Update prompts** in `ai-calling-service/src/prompts/` for Phase 3 use cases (multi-purpose, not just KB-lookup).
3. **Expose Voice Agent via MCP** (if using AgentCore Gateway in Phase 2+).
4. **Add call recording** → S3 (for compliance, QA, training).
5. **DLT registration** (India-specific; partner with Exotel for compliance approval).
6. **Integration test:** simulate inbound call → lead creation → follow-up call scheduled.

### Cost

- Exotel: ~₹0.50-1.00 per minute (inbound); ~₹1.50-2.00 per minute (outbound).
- ElevenLabs conversational AI: ~₹0.10 per minute.
- **Per call:** ~₹2-3 (inbound) to ₹3-5 (outbound). Log as "voice_call_{duration_minutes}" in `credit_ledger`.

---

## 3. Marketing Automation (Weeks 16–20)

### Engine: Marketing Agent + Higgsfield + Meta + Blotato

Architecture:

```
Marketing Agent (Strands, Sonnet)
  ↓
  Tools:
    - Higgsfield (image gen via Nano Banana Pro, video via Veo/Kling)
    - Meta-Ads MCP (campaign creation, audience targeting, budget)
    - Blotato MCP (social publishing: IG, FB, LinkedIn, TikTok, X)
    - Knowledge MCP (property brochures, testimonials, market data)
  ↓
  Workflow:
    1. Input: "Create campaign for Lodha Park 2BHK launch, target budget buyers, 30-day timeline"
    2. Agent plans: content (image + reel + ad copy), channels (IG story + FB feed), budget allocation
    3. Agent generates: image via Higgsfield, video via Remotion+Higgsfield
    4. Agent creates: Meta Ad campaigns, lookalike audiences, Conversion API wiring
    5. Agent publishes: content to IG, FB, LinkedIn
    6. Agent monitors: CTR, CPC, lead-form fills, conversion
    7. Agent reports: "2,000 impressions, 50 leads captured, ₹5/lead CAC"
  ↓
  Loop: daily optimization (pause low-performers, increase high-performers)
```

### Deliverables

1. **Marketing Agent definition** (Strands agent, pre-prompt cache with brand guidelines, product catalog).
2. **Content generation pipeline:**
   - Image: "2BHK floor plan, luxury finishes, natural light" → Higgsfield Nano Banana → S3
   - Reel: "30-second Lodha Park walkthrough, ambient music, captions" → Remotion render → upload to IG via Blotato
   - Copy: "Discover luxury living at Lodha Park. Spacious 2BHK, ₹1.2Cr. Book your tour today!" (Hinglish, per brand guide)

3. **Campaign creation:** Agent calls Meta-Ads MCP to:
   - Create campaign with objective "Lead Generation"
   - Create audience: "Lookalike of past converters (buyers) in Mumbai, 25–45, interested in real estate"
   - Allocate budget: ₹10k/day for 7 days
   - Enable Conversion API to track lead-form fills

4. **Closed-loop wiring:**
   - Meta lead-ad form submission → webhook → Conversation Orchestrator (Phase 1)
   - Lead qualifies → captured as `source: "meta_lead_ad"`, tagged with `campaign_id`
   - At conversion, Meta event pixel fires: `Purchase` with `value: ₹5, revenue_currency: INR` (CAPI)
   - Next day, agent sees ROI: "₹5/lead CAC, 30% qualify rate, 10% conversion" → optimization recommendations

5. **Approval-queue:** Before publishing any campaign to IG/FB, mark as "pending_approval" in `agent_actions`. Admin approves in dashboard. Once approved, auto-publish via Blotato.

### Wiring

```javascript
// server/routes/marketing.js
router.post('/agents/marketing/create-campaign', validateToken, extractTenantId, async (req, res) => {
  const { campaignBrief, budget, timeline } = req.body;
  
  // Log planning phase
  await logAgentAction(req.tenantId, {
    agentType: 'marketing_agent',
    action: 'planning_campaign',
    input: { campaignBrief, budget, timeline },
    creditsUsed: 1, // planning = 1 credit
  });
  
  // Run marketing agent
  const campaignPlan = await marketingAgent.run({
    tenantId: req.tenantId,
    goal: `Create and launch a ${budget}₹ campaign: ${campaignBrief}`,
    tools: [higgsfield, metaAdsMCP, blotato, knowledgeMCP],
  });
  
  // Mark as pending approval
  await logAgentAction(req.tenantId, {
    agentType: 'marketing_agent',
    action: 'campaign_created_pending_approval',
    output: campaignPlan,
    approval_status: 'pending',
  });
  
  res.json({
    campaignId: campaignPlan.id,
    status: 'pending_approval',
    estimatedReach: campaignPlan.estimatedReach,
    estimatedCPA: campaignPlan.estimatedCPA,
    approvalUrl: `${process.env.DASHBOARD_URL}/approvals/${campaignPlan.id}`,
  });
});

router.post('/approvals/:actionId/approve', validateToken, requireAdmin, async (req, res) => {
  const actionId = req.params.actionId;
  const action = await db.agent_actions.findOne({ id: actionId });
  
  // Publish campaign
  const publishResult = await blotato.publish({
    campaign: action.output,
    platforms: ['instagram', 'facebook'],
  });
  
  // Mark as approved & published
  await db.agent_actions.update(actionId, {
    approval_status: 'approved',
    approved_by: req.user.id,
  });
  
  res.json({ ok: true, publishedAt: new Date() });
});
```

### Cost

- Higgsfield image generation: ~₹50–100 per image (Nano Banana Pro)
- Remotion video rendering: ~₹200–500 per reel (depends on complexity)
- Meta Ads: your choice of budget (₹100–10,000+/campaign)
- Blotato: included in subscription or per-post fee
- **Per campaign:** ~₹300–1,000 (generation + ads budget separate). Log as "marketing_campaign_created" = 5 credits.

---

## 4. Portal Automation (Weeks 18–20)

### Browser automation for 99acres, MagicBricks, Housing.com

Implemented via AgentCore Browser Tool (or Playwright Workers):

```
Automation Agent (Strands, Sonnet)
  ↓
  Trigger: PropertyListed event (property.status = "for_sale" or "for_rent")
  ↓
  Agent task: "Post this property to 99acres and MagicBricks"
  ↓
  Browser Tool steps:
    1. Login to 99acres (credentials from Secrets Manager, isolated per tenant)
    2. Click "Post Property"
    3. Fill form: title, config, price, location, images, amenities
    4. Upload photos from S3
    5. Review & submit
    6. Capture listing ID → write back to Property.`external_listings`
  ↓
  Repeat for MagicBricks, Housing.com
  ↓
  Log outcome → `agent_actions` with approval status
```

### Deliverables

1. **Automation Agent definition** (Strands agent, browser tool access, portal credentials isolated per tenant in Secrets Manager).
2. **Portal adapters** (Playwright scripts or AgentCore browser tool):
   - 99acres: login → post-property form → photo upload → submit
   - MagicBricks: similar flow
   - Housing.com: similar flow
3. **Lead retrieval automation:**
   - 99acres/MagicBricks daily feed pull → Conversation Orchestrator
   - Merge with existing CRM leads (dedupe by phone)
   - Auto-route to assigned agent
4. **Human-in-the-loop:** Before posting to any portal, require admin approval in dashboard (gated due to legal risk).
5. **Audit logging:** Every login, form fill, submission logged to `audit_log` (compliance, troubleshooting).

### Wiring

```javascript
// server/services/automationBotService.js
export async function postPropertyToPortals(tenantId, propertyId, portalList = ['99acres', 'magicbricks']) {
  const property = await getPropertyFromCRM(tenantId, propertyId);
  
  for (const portal of portalList) {
    const actionId = await logAgentAction(tenantId, {
      agentType: 'automation_agent',
      action: `posting_to_${portal}`,
      entityType: 'property',
      entityId: propertyId,
      approval_status: 'pending',
      creditsUsed: 2, // portal posting = 2 credits
    });
    
    // Mark as pending approval
    await publishApprovalRequest({
      actionId,
      title: `Post "${property.title}" to ${portal}?`,
      approvalUrl: `${process.env.DASHBOARD_URL}/approvals/${actionId}`,
    });
  }
  
  return { status: 'pending_approval' };
}

// On admin approval:
export async function executePortalPosting(tenantId, actionId) {
  const action = await db.agent_actions.findOne({ id: actionId });
  const propertyId = action.entity_id;
  const portal = action.action.replace('posting_to_', '');
  
  // Get portal credentials (isolated per tenant)
  const credentials = await getPortalCredentials(tenantId, portal);
  
  // Run automation in isolated browser
  const browserSession = await agentCoreBrowserTool.startSession({
    tenantId,
    credentialsId: credentials.secretsManagerKey, // never passes plaintext
  });
  
  const listingId = await browserSession.runScript(`
    login('${portal}');
    fillPropertyForm(${JSON.stringify(property)});
    uploadPhotos(${JSON.stringify(property.photos)});
    return submitAndGetListingId();
  `);
  
  // Write listing ID back
  await updatePropertyExternalListings(propertyId, { [portal]: listingId });
  
  // Mark approved
  await db.agent_actions.update(actionId, {
    approval_status: 'approved',
    output: { listingId, portal, listedAt: new Date() },
  });
}
```

### Cost

- AgentCore Browser Tool: ~₹0.50 per minute of browser time. Typical posting: 3–5 min = ₹1.50–2.50 per property.
- Log as "portal_posting_2_sites" = 4 credits.

---

## 5. Advanced Analytics (Weeks 19–20)

### Dashboards powered by Postgres (from Phase 2)

Built on the analytics tables created in Phase 2, now enhanced:

1. **Agent Performance Dashboard:**
   - Per-agent metrics: actions/day, approval rate, average credits/action, quality score
   - Trends: week-over-week efficiency
   - Alerts: agent error rate > 5%, response time > 1min

2. **Conversion Funnel Dashboard:**
   - Daily: inbound conversations → leads → qualified → visits → conversions
   - Channel breakdown (WhatsApp, web, portal, etc.)
   - Time-to-conversion per lead source

3. **ROI by Channel:**
   - Cost per lead (credit cost + marketing spend)
   - Cost per qualified lead
   - Cost per conversion
   - Lifetime value per customer

4. **Cohort Analysis:**
   - Retention: % of leads from Week 1 still active in Week 4
   - Churn signals: leads not contacted in 7+ days
   - Win-back targets: cold leads with high historical budget

### Deliverables

```sql
-- server/db/migrations/phase3_analytics.sql
CREATE VIEW agent_leaderboard_today AS
  SELECT
    agent_type,
    COUNT(*) AS actions_today,
    ROUND(100 * SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END) / COUNT(*), 2) AS approval_rate,
    ROUND(AVG(credits_used), 2) AS avg_cost_per_action
  FROM agent_actions
  WHERE tenant_id = current_setting('app.tenant_id')::uuid
    AND created_at::DATE = TODAY()
  GROUP BY agent_type
  ORDER BY actions_today DESC;

CREATE VIEW conversion_funnel_mtd AS
  SELECT
    DATE_TRUNC('day', date) AS day,
    inbound_conversations,
    leads_created,
    qualified,
    visits_scheduled,
    conversions,
    ROUND(100 * conversions::DECIMAL / inbound_conversations, 2) AS conversion_rate
  FROM conversion_funnel_daily
  WHERE tenant_id = current_setting('app.tenant_id')::uuid
    AND date >= DATE_TRUNC('month', TODAY())
  ORDER BY day DESC;
```

### Frontend dashboard components

```typescript
// real-estate-crm-app/src/pages/AnalyticsBoard.tsx
export function AgentPerformanceCard() {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    fetch('/api/analytics/agent-leaderboard-today')
      .then(r => r.json())
      .then(setData);
  }, []);
  
  return (
    <Card title="Agent Performance (Today)">
      <table>
        <thead><tr><th>Agent</th><th>Actions</th><th>Approval %</th><th>Avg Cost</th></tr></thead>
        <tbody>
          {data.map(row => (
            <tr key={row.agent_type}>
              <td>{row.agent_type}</td>
              <td>{row.actions_today}</td>
              <td>{row.approval_rate}%</td>
              <td>₹{row.avg_cost_per_action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
```

---

## 6. Phase 3 Timeline & Team

| Week | Item | Owner |
|---|---|---|
| 13–15 | Follow-up journeys (Step Functions, Chatwoot) | Backend (1 eng) + AI (0.5 eng) |
| 15–17 | Voice automation (re-enable AI Calling, Exotel) | Backend (1 eng) + Voice (0.5 eng) |
| 16–20 | Marketing automation (agent + Higgsfield + Meta) | AI/Agents (1.5 eng) + Marketing (shared) |
| 18–20 | Portal automation (Playwright/AgentCore Browser) | Automation (1 eng) |
| 19–20 | Analytics dashboards (Postgres views + frontend) | Frontend (0.5 eng) + Backend (0.5 eng) |

**Total: ~5 weeks, ~4–5 engineers working in parallel.**

---

## 7. Phase 3 Success Criteria

| Milestone | Target | Status |
|---|---|---|
| Follow-up journeys live | 90% leads get ≥2 nurture touches | ✅ Phase 3 |
| Voice inbound | Answer 80% of calls within 10s | ✅ Phase 3 |
| Marketing campaigns | Launch 1 campaign/week, >100 leads CAC | ✅ Phase 3 |
| Portal posting | Post new listings within 2h to 3 portals | ✅ Phase 3 |
| Analytics dashboard | View real-time funnel + agent metrics | ✅ Phase 3 |
| Multi-channel | Capture leads from 4+ channels simultaneously | ✅ Phase 3 |
| Cost control | Cap spend per tenant; pause at budget | ✅ Phase 3 |

---

## After Phase 3: The Future

Once Phase 3 is live, you have:
- ✅ WhatsApp inbound + qualification (Phase 1)
- ✅ Agent audit, analytics, credits (Phase 2)
- ✅ Multi-channel outbound, marketing, voice, automation (Phase 3)

The next evolution (out of scope for this roadmap):
- **Phase 4:** Mobile app (agent-on-the-go), 3D property tours, advanced LLM eval + autonomy graduation
- **Phase 5:** International expansion (Dubai calls, multi-language support), advanced AI features (predictive lead scoring, churn prevention)

But by the end of Phase 3, you have a **fully operational AI Agency Operating System** that can acquire, qualify, nurture, and track leads across multiple channels — with humans-in-the-loop for approvals and exceptions.

---

## What Did NOT Happen in Phase 3

- **No CRM migration.** Leads/contacts/properties stay on DynamoDB (fixed access patterns in Phase 0 made them fast).
- **No new build from scratch.** Everything integrated existing tools (Bedrock agents, Exotel, Higgsfield, Meta, Blotato).
- **No technical debt.** All work is behind feature flags and approval gates; rollback is always possible.

**Pragmatism, not perfection. Get to revenue, then iterate.**
