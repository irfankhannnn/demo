# RealtyFlow MCP — Agency Owner Guide

**Last Updated:** June 28, 2026  
**Version:** 1.0.0

---

## What is MCP?

MCP (Model Context Protocol) is an open standard that lets AI applications like Claude and ChatGPT access your RealtyFlow data and perform actions.

Think of it like giving Claude or ChatGPT a "window" into your CRM. They can see your leads, properties, meetings, and more — and help you with tasks like qualifying leads, drafting messages, and analyzing data.

---

## Quick Start

### 1. Connect Claude

1. Go to **CRM Dashboard** → **AI Integrations**
2. Click **"Connect to Claude"**
3. You'll be redirected to Claude to authorize RealtyFlow
4. Review the permissions and click **"Allow"**
5. You're done! Claude now has access to your RealtyFlow data

### 2. Connect ChatGPT

Same process as Claude:

1. Go to **CRM Dashboard** → **AI Integrations**
2. Click **"Connect to ChatGPT"**
3. Authorize and allow permissions
4. Start using ChatGPT with your RealtyFlow data

### 3. Start Using

Once connected, you can ask Claude or ChatGPT questions like:

- "Show me my recent leads"
- "Create a new lead for Raj Kumar with phone 9876543210"
- "What properties match a buyer with budget 50 lakhs?"
- "Generate a daily summary of my CRM activity"
- "Draft a WhatsApp message to follow up with this lead"

---

## Available Tools (54 Total)

Claude and ChatGPT can use any of your RealtyFlow tools:

### Lead Management
- Create, read, update, delete leads
- Search and filter leads
- Convert leads to buyers
- Add notes to leads

### Buyer Management
- Create, read, update, delete buyers
- Search and filter buyers
- Match properties to buyers
- Add notes to buyers

### Property Management
- Create, read, update, delete properties
- Search and filter properties
- Update property status
- Add documents and verifications

### Owner Management
- Create, read, update, delete owners
- Search and filter owners
- View owner properties
- Add notes to owners

### Tenant Management
- Create, read, update, delete tenants
- Search and filter tenants
- Add notes to tenants

### Meeting Management
- Create, read, update, delete meetings
- Get upcoming meetings
- Add meeting events

### Contact Management
- Create, read, update, delete contacts
- Search and filter contacts
- Manage contact roles

---

## Available Resources

Resources are read-only data that Claude/ChatGPT can access for context:

### Recent Leads
Last 10 leads with summary information (name, phone, status, budget)

### Upcoming Meetings
Meetings scheduled in the next 7 days

### Agency Profile
Your agency metrics and statistics (total leads, conversion rate, average budget, etc.)

### Hot Leads
High-priority, qualified leads ready for followup

### Active Properties
Properties currently available for sale or rent

---

## Available Prompts

Prompts are pre-built templates that guide Claude/ChatGPT on specific tasks:

### Qualify Lead
Analyzes a lead and provides:
- Qualification score (0-100)
- Key strengths
- Red flags
- Recommended next steps

**Usage:** "Qualify the lead with ID lead-123"

### Draft Followup
Drafts a followup message in your chosen channel:
- WhatsApp (casual, Hinglish)
- Email (professional)
- SMS (concise)

**Usage:** "Draft a WhatsApp followup for lead-123"

### Daily Summary
Generates an executive summary of your CRM activity:
- New leads
- Meetings today/tomorrow
- Hot leads
- Key metrics
- Recommended actions

**Usage:** "Generate a daily summary"

### Property Match
Finds properties matching a buyer's requirements:
- Identifies key criteria
- Suggests matching properties
- Highlights why each is a good fit
- Recommends next steps

**Usage:** "Find properties for buyer-456"

### Meeting Prep
Prepares a briefing for an upcoming meeting:
- Meeting overview
- Attendee profiles
- Key talking points
- Potential objections
- Success metrics

**Usage:** "Prepare a briefing for meeting-789"

---

## Permissions

When you connect Claude or ChatGPT, you grant them access to:

- **Read Leads:** View all your leads
- **Write Leads:** Create, update, delete leads
- **Read Properties:** View all your properties
- **Write Properties:** Create, update, delete properties
- **Read Buyers:** View all your buyers
- **Write Buyers:** Create, update, delete buyers
- **Read Owners:** View all your owners
- **Write Owners:** Create, update, delete owners
- **Read Meetings:** View all your meetings
- **Write Meetings:** Create, update, delete meetings

You can revoke access at any time by clicking **"Disconnect"** on the AI Integrations page.

---

## Security & Privacy

### Your Data is Safe

- **Encrypted:** All data is encrypted in transit (HTTPS)
- **Authenticated:** Only authorized AI apps can access your data
- **Isolated:** Each tenant's data is completely isolated
- **Audited:** All access is logged for compliance

### What Claude/ChatGPT Can See

- Your leads, buyers, owners, properties, meetings
- Your agency metrics and statistics
- Your contacts and notes

### What Claude/ChatGPT Cannot See

- Your passwords or authentication tokens
- Other agencies' data
- Internal system data
- Deleted records

### Disconnect Anytime

You can disconnect Claude or ChatGPT at any time:

1. Go to **CRM Dashboard** → **AI Integrations**
2. Click **"Disconnect"** next to the app
3. Access is immediately revoked

---

## Common Workflows

### Workflow 1: Qualify a Lead

```
You: "Qualify the lead with ID lead-123"

Claude:
"Qualification Score: 85/100

Key Strengths:
- High budget (₹75 lakhs)
- Clear timeline (next 3 months)
- Specific requirements (3 BHK in Bandra)

Red Flags:
- First-time buyer (may need education)
- No previous property experience

Recommended Next Steps:
1. Schedule a property viewing
2. Provide market analysis
3. Discuss financing options"
```

### Workflow 2: Daily Summary

```
You: "Generate a daily summary"

Claude:
"Daily CRM Summary - June 28, 2026

📊 New Activity:
- 5 new leads (avg budget ₹60L)
- 3 meetings scheduled
- 2 properties added

🔥 Hot Leads:
- Raj Kumar (₹75L budget, qualified)
- Priya Sharma (₹50L budget, ready to buy)

📈 Key Metrics:
- Conversion rate: 12%
- Avg deal value: ₹45L
- Response time: 2 hours

✅ Recommended Actions:
1. Follow up with Raj Kumar (no contact in 2 days)
2. Schedule site visit for Priya Sharma
3. Add 3 new properties to matching buyers"
```

### Workflow 3: Find Properties for Buyer

```
You: "Find properties for buyer-456"

Claude:
"Matching Properties for Priya Sharma

Budget: ₹50-60 lakhs
Location: Andheri, Bandra
Type: 3 BHK Apartment

Matches:
1. Andheri Apartment (₹55L) - 95% match
   - 3 BHK, 1200 sqft
   - 5 min to metro
   - Gym, pool, parking

2. Bandra Flat (₹58L) - 90% match
   - 3 BHK, 1300 sqft
   - Sea view
   - 24/7 security

3. Andheri Duplex (₹52L) - 85% match
   - 3 BHK, 1400 sqft
   - Garden
   - Slightly over budget but great value"
```

---

## Troubleshooting

### "Connection Failed"

**Problem:** Can't connect to Claude or ChatGPT

**Solutions:**
1. Check your internet connection
2. Make sure you're logged into RealtyFlow
3. Try again in a few minutes
4. Clear browser cache and cookies

### "Permission Denied"

**Problem:** Claude/ChatGPT says "Permission Denied"

**Solutions:**
1. Check that the app is connected (AI Integrations page)
2. Reconnect the app (disconnect and reconnect)
3. Make sure you authorized all permissions

### "Data Not Showing"

**Problem:** Claude/ChatGPT can't see your leads/properties

**Solutions:**
1. Make sure the app is connected
2. Wait a few minutes (data may be syncing)
3. Try asking again
4. Disconnect and reconnect the app

### "Rate Limit Exceeded"

**Problem:** "Too many requests" error

**Solutions:**
1. Wait a few minutes before making more requests
2. Limit to 60 requests per minute per AI app
3. Contact support if you need higher limits

---

## FAQ

### Q: Is my data secure?

**A:** Yes. All data is encrypted, authenticated, and isolated per tenant. You can revoke access anytime.

### Q: Can Claude/ChatGPT delete my data?

**A:** Only if you explicitly ask them to. They can't delete data without your permission.

### Q: Can I use multiple AI apps at once?

**A:** Yes! You can connect Claude, ChatGPT, and other AI apps simultaneously. Each has access to your data.

### Q: What if I disconnect an app?

**A:** Access is immediately revoked. The app can no longer see or modify your data.

### Q: Can I limit what Claude/ChatGPT can access?

**A:** Currently, all connected apps have the same permissions. We're working on granular permissions.

### Q: How much does it cost?

**A:** MCP is included with your RealtyFlow subscription. No additional cost.

### Q: Can I use MCP with other CRM systems?

**A:** MCP is specific to RealtyFlow. Other CRMs may have their own integrations.

### Q: How do I report a bug or issue?

**A:** Contact support at support@realtyflow.com with details about the issue.

---

## Support

Need help? Contact us:

- **Email:** support@realtyflow.com
- **Chat:** In-app chat support
- **Phone:** +91-XXXX-XXXX-XXX

---

*For developers, see [MCP_DEVELOPER_GUIDE.md](MCP_DEVELOPER_GUIDE.md)*
