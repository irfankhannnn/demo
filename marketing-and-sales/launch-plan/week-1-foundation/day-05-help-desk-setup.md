# Day 5 — Help Desk + Status Page + Support SLA

## Objective
Set up support@yourdomain email, an in-app chat widget, a public status page, and a documented support SLA so that the moment a beta tester (Day 10) hits a bug, they have an obvious, fast way to reach you and confidence the issue is being handled.

## Why This Matters for RealtyFlow
Early-stage SaaS lives or dies on support responsiveness. A beta tester who emails support@ at 9pm and waits 3 days for a reply will churn silently. The fix isn't perfect product — it's a 2-hour response guarantee, in-app chat, and visible "we're aware" signals when something breaks. Status pages also pre-empt 80% of "is RealtyFlow down?" emails.

## User Story
As a founder, I want a support@ inbox, an in-app chat widget connected to my phone, a public status page, and a documented response-time SLA, so that beta testers and early customers experience fast, responsive support and trust that issues will be handled.

## Acceptance Criteria
- [ ] `support@realtyflow.in` email created (or alias on Google Workspace)
- [ ] Support email visible in app footer + landing page footer + ToS
- [ ] In-app chat widget installed (Crisp / Tawk.to / Intercom free tier)
- [ ] Chat widget routes to your phone (mobile app or push notifications)
- [ ] Public status page created (BetterStack / Instatus / Atlassian Statuspage)
- [ ] Status page monitors at least: landing page, app, API, payment webhook
- [ ] Uptime monitor configured (UptimeRobot / BetterStack)
- [ ] Status page linked in app footer + email signature
- [ ] Support SLA documented and published ("Respond within 4 business hours, resolve within 24")
- [ ] Auto-reply on support@ email confirms receipt and sets expectations
- [ ] At least 3 FAQ articles drafted (covers most common questions)
- [ ] Internal triage process documented (you-only, but written down)

## Implementation Steps

### Step 1: Create support email
Use Google Workspace (or Zoho Mail):
- Primary: `support@realtyflow.in`
- Aliases: `help@`, `hello@`, `feedback@` all forward to support@

If you have Google Workspace, this is a 2-min config.

Auto-reply template:
> Hey, thanks for reaching out to RealtyFlow!
>
> We've received your message and someone (probably me, the founder) will reply within 4 business hours (Mon-Fri 9am-7pm IST).
>
> For urgent issues, ping us via in-app chat or WhatsApp +91-XXXXX-XXXXX.
>
> Quick links:
> — Status page: status.realtyflow.in
> — FAQs: realtyflow.in/help
>
> Kalim
> Founder, RealtyFlow

### Step 2: Install in-app chat widget
Three solid free/cheap options:

**Crisp (recommended for Month 1):**
- Free tier: unlimited conversations, 2 agents
- Web + mobile (iOS/Android) — replies from your phone
- Auto-detects user info if you pass it
- ~10 lines of JS install

**Tawk.to:** Forever free, less polished, basic features
**Intercom:** Best UX, but ₹3-8k/mo — not Month 1 worth

Install Crisp:
1. crisp.chat → sign up → get Website ID
2. Add `<script>` snippet to in-app `<head>` (not landing — focus chat on logged-in users)
3. Pass user identity: `$crisp.push(["set", "user:email", [user.email]])`
4. Pass user plan: `$crisp.push(["set", "session:data", [["plan", user.plan]]])`
5. Install Crisp mobile app on your phone

### Step 3: Configure chat triggers
Crisp lets you trigger proactive messages:
- "Need help getting started?" — after 60s on dashboard with no actions
- "Stuck adding your first buyer?" — after 2min on buyer add page without submitting
- "Your trial ends in 3 days — questions?" — Day 11 of trial

Set up 3-5 triggers. Don't overdo it (annoying).

### Step 4: Set up public status page
Use BetterStack (formerly Better Uptime) or Instatus:
1. Create account → New status page → name "RealtyFlow Status"
2. Custom domain: `status.realtyflow.in` (CNAME to provider)
3. Add components:
   - "Landing Page" (HTTP check on realtyflow.in)
   - "Application" (HTTP check on app.realtyflow.in)
   - "API" (HTTP check on api.realtyflow.in or your endpoint)
   - "Payment Webhook" (HTTP check on webhook URL — return 200 if alive)
   - "AI Calling Service" (HTTP check on ai-calling endpoint)
4. Add a subscribe form so users can opt into outage notifications

### Step 5: Configure uptime monitoring
Same provider can run uptime checks:
- Check every 1 minute
- Alert via email + Slack + SMS when down
- Auto-update status page on outage
- Add response-time threshold alerts (e.g., >2s = warning)

For India, add monitors from multiple regions (Mumbai, Singapore, Frankfurt) if your tool supports it.

### Step 6: Document support SLA
Public SLA (visible at `realtyflow.in/sla` and in your ToS):

> **Support SLA**
> | Severity | First Response | Resolution Target |
> |----------|----------------|-------------------|
> | Critical (service down) | 1 hour | 4 hours |
> | High (key feature broken) | 4 business hours | 1 business day |
> | Medium (UX issue) | 1 business day | 3 business days |
> | Low (feature request, cosmetic) | 2 business days | best-effort |
>
> Business hours: Mon-Fri 9am-7pm IST (excluding Indian public holidays).
> Premium support (1-hour SLA all-day) available on Tier 3 / Enterprise.

Document this for yourself too — review monthly to ensure you're meeting it.

### Step 7: Draft FAQ / help articles
Start with 3-5 articles covering top questions:
1. "How to add my first buyer"
2. "How to set up AI calling"
3. "How to connect WhatsApp Business"
4. "Pricing & billing FAQ"
5. "How to cancel my subscription"

Host on a simple page (e.g., `realtyflow.in/help`) — can use Notion public pages, GitBook, or your own CMS.

### Step 8: Wire help links throughout app
- Footer link: "Help" → /help
- In-app menu: "Support" → opens Crisp chat
- Empty states: "Need help? Chat with us" link
- Error pages: "If this persists, contact support@realtyflow.in"
- Email signature: status, help, support links

### Step 9: Internal triage process
For you alone (until you hire support):
- Check support@ inbox 4x/day: 9am, 12pm, 3pm, 7pm IST
- Crisp app push notifications ON for fast response
- Triage rules:
  - Critical → reply within 1 hour, even if just "we're on it"
  - All else → reply within 4 business hours
  - Log every issue in your friction-backlog / month-2 backlog
  - Reply with the answer, not "thanks for reaching out — we'll get back"

Document this in `assets/support-process.md` for future-hire onboarding.

### Step 10: Test the help desk
- Send a test email from a non-test address to support@
- Verify auto-reply works
- Open the app in incognito → click chat widget → send a message
- Verify push notification reaches your phone
- Trigger a planned downtime on staging → verify uptime monitor catches it and updates status page

## Tools / Stack Required
- Google Workspace for support@ email
- Crisp (free tier) for chat — OR Tawk.to / Intercom
- BetterStack OR Instatus for status page + uptime monitoring
- Custom CNAME (status.realtyflow.in)
- Notion / GitBook for FAQ hosting (optional — can be markdown pages on your site)

## Time Estimate
- Email + auto-reply: 30 min
- Chat widget install + triggers: 2 hours
- Status page setup: 2-3 hours
- FAQ drafts: 2 hours
- SLA documentation: 1 hour
- Testing: 1 hour
- **Total: full day**

## Deliverables
- support@realtyflow.in working with auto-reply
- Crisp chat live in-app and on your phone
- Status page at status.realtyflow.in
- Uptime monitor running 24/7
- SLA documented at /sla
- 3-5 FAQ articles published
- Support process doc

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| You miss support emails | Crisp push to phone + email forwarding + 4x daily inbox check |
| Status page becomes "no incidents" forever — users don't trust it | Honest: post small incidents too (deploy outages, brief API hiccups). Builds trust. |
| Chat widget eats your time | Set "office hours" message after 7pm IST. Auto-reply directs to email. |
| FAQ is too thin to deflect questions | Add 2-3 articles per week based on actual support patterns from beta |

## India-Specific Notes
- WhatsApp support number is hugely valued by Indian customers — add a public WhatsApp Business number alongside email
- IST business hours: 9am-7pm is the norm; 10am-6pm is acceptable
- Indian customers often prefer phone over chat — list a phone number for Tier 2/3 customers
- Hinglish support is fine for chat — don't force formal English

## Connected Days / Dependencies
- **Blocks:** Day 10 (onboarding calls — testers need a way to reach you), Day 14 (testimonials — happy customers cite good support)
- **Depends on:** None

## Success Metric
- Test support ticket: response within 30 minutes
- Status page accessible at status.realtyflow.in
- Beta testers in Week 2 know how to reach you (Day 9 invitation includes support links)
- First real support ticket in Week 2 resolved within stated SLA
