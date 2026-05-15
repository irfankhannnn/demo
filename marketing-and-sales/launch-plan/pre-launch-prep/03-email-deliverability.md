# Pre-Launch Prep — 03: Email Deliverability & Domain Warm-Up

## Objective
Configure SPF/DKIM/DMARC and warm up your sending domain so that the 50+ cold emails sent in Week 3 (Days 17-19) actually reach the inbox instead of the spam folder.

## Why This Matters for RealtyFlow
**This is the single most under-appreciated item in your 30-day plan.** Cold outreach reply rate without warm-up: ~0-1%. With proper warm-up: 8-15%. The math: 100 cold emails → 0 vs 10 replies. Domain warm-up takes 2-3 weeks of gradually increasing volume. You MUST start this BEFORE Day 1 of the 30-day plan, or Week 3 outreach will silently fail.

## User Story
As a founder, I want my sending domain to be technically authenticated and warmed up to send 50-100 emails/day by Day 17, so that my cold outreach lands in prospect inboxes and not their spam folders.

## Acceptance Criteria
- [ ] SPF record published in DNS (TXT record on root domain)
- [ ] DKIM keys generated and published in DNS (for both Google Workspace and your cold outreach tool)
- [ ] DMARC policy published in DNS (start with `p=none`, monitor, escalate to `p=quarantine` later)
- [ ] Google Workspace (or M365) configured for `support@`, `founder@`, `noreply@`
- [ ] Cold outreach tool selected and connected (Instantly.ai OR Smartlead OR Lemlist)
- [ ] Secondary domain registered for cold outreach (e.g., `getrealtyflow.in` OR `tryrealtyflow.in`) — NEVER cold-email from your primary domain
- [ ] Warm-up running for 2-3 weeks before Day 17
- [ ] Inbox placement test passed (Mail-Tester score 9+/10, Inbox in Gmail/Outlook)
- [ ] Email signature configured with photo, role, company link

## Implementation Steps

### Step 1: Understand the threat model
- ISPs (Gmail, Outlook, Yahoo) score every sending domain on reputation.
- Brand new domain + sudden burst of cold emails = guaranteed spam folder.
- Fix: technical authentication + gradual volume ramp + low complaint rate.

### Step 2: Buy a secondary domain for cold outreach
**Do NOT cold-email from `@realtyflow.in`.** A spam complaint there will tank your customer-facing email deliverability (transactional, support, billing).

Buy a sister domain on Day -21 (3 weeks before Day 1):
- `getrealtyflow.in`
- `tryrealtyflow.in`
- `realtyflowhq.in`

Set it up as a 301 redirect to your main site so prospects who click feel safe.

### Step 3: Configure DNS records
For **both** your primary and secondary domains:

#### SPF (Sender Policy Framework)
```
TXT record on root:
v=spf1 include:_spf.google.com include:spf.mailgun.org include:spf.instantly.ai -all
```
(Replace `instantly.ai` with your actual cold outreach tool's recommended record.)

Only ONE SPF record per domain allowed. Combine all senders into one.

#### DKIM (DomainKeys Identified Mail)
- Google Workspace: Admin Console → Apps → Google Workspace → Gmail → Authenticate email → Generate new record → publish to DNS
- Cold outreach tool: each tool generates its own DKIM. Add as separate selector (e.g., `instantly._domainkey.yourdomain.in`)

#### DMARC (Domain-based Message Authentication)
```
TXT record on _dmarc.yourdomain.in:
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.in; fo=1
```
Start with `p=none` (monitor mode). After 2 weeks of clean reports, escalate to `p=quarantine`, then `p=reject` over 4-6 weeks.

#### MX records
Pointed to Google Workspace (`aspmx.l.google.com` etc.) for inbound.

### Step 4: Choose a cold outreach tool
Top options for Indian B2B:
- **Instantly.ai** — best UX, built-in warm-up network, unlimited mailbox connections on Hypergrowth plan
- **Smartlead.ai** — Indian-friendly pricing, multi-mailbox rotation
- **Lemlist** — premium, great for personalization
- **Reply.io** — solid for B2B sequences

**Recommendation:** Instantly.ai if budget allows, Smartlead if cost-sensitive.

### Step 5: Set up 2-3 sending inboxes for rotation
Cold outreach tools rotate sends across multiple inboxes to stay under per-mailbox daily limits.

Create on the **secondary** domain (`getrealtyflow.in`):
- `kalim@getrealtyflow.in`
- `kalim.q@getrealtyflow.in`
- `team@getrealtyflow.in`

Connect all 3 to your cold outreach tool.

### Step 6: Start automated warm-up (Day -21 to Day 17)
Most tools have built-in warm-up. Enable it on each inbox.

**Warm-up trajectory:**
- Days 1-7: 5-10 emails/day per inbox (warm-up only, no real cold emails)
- Days 8-14: 15-25 emails/day per inbox
- Days 15-21: 30-40 emails/day per inbox
- Days 22+: 40-60 emails/day per inbox (your Week 3 cold outreach starts here)

Warm-up emails are auto-generated conversations between participating mailboxes — they look like real emails, get opened/replied/marked-as-not-spam, building reputation.

### Step 7: Inbox placement testing
Before sending real cold emails, run a placement test:
- Send a draft cold email through your tool to your free test addresses on **Gmail, Outlook, Yahoo, Zoho**
- Check: did it land in Inbox / Promotions / Spam?
- Use **Mail-Tester.com** — paste a test email, get a score out of 10. Target 9+/10.
- Use **GlockApps** for deeper testing across 60+ inbox providers.

If score is below 8, do not start cold outreach yet — diagnose:
- Missing/broken auth records?
- Spammy subject line?
- Too many links?
- Sending from a domain less than 21 days old?

### Step 8: Email signature + sender profile
Each sending inbox needs:
- Full name + role ("Kalim Q., Founder at RealtyFlow")
- Photo (real, smiling)
- Company link
- LinkedIn link
- Phone (optional but boosts reply rate in India)
- NO marketing banner — looks spammy

### Step 9: Define cold outreach guardrails
- Daily volume cap per inbox: 40 emails/day even after warm-up
- Open tracking: ON for analytics, OFF for high-deliverability sends (use a tool toggle)
- Link tracking: OFF unless absolutely needed (custom domain helps)
- Spammy words to avoid: "free", "guarantee", "click here", "act now", "limited time"
- Add 1-2 personalized lines per email
- Always include physical mailing address (CAN-SPAM equivalent in India)

## Tools / Stack Required
- Domain registrar (GoDaddy, Namecheap, BigRock) — buy secondary domain
- Google Workspace (or Zoho Mail) for inbox hosting
- Cold outreach tool: Instantly.ai / Smartlead.ai / Lemlist
- Mail-Tester.com for inbox placement scoring
- GlockApps for deep deliverability testing
- DMARC report parser: DMARC Analyzer, EasyDMARC, or Postmark's free tool

## Time Estimate
- DNS + inbox setup: 4-6 hours one-time
- Warm-up: 2-3 weeks running automatically
- Daily check: 5 min/day during warm-up phase

## Deliverables
- DNS records published and verified
- 2-3 sending inboxes warmed up
- Mail-Tester score 9+/10
- Inbox placement test passing on Gmail + Outlook
- Cold outreach tool ready with templates uploaded

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Warm-up not done by Day 17 | Start 3 weeks before Day 1. Non-negotiable. |
| First cold campaign tanks domain reputation | Strict daily caps + personalization + monitoring open/bounce rates |
| Razorpay/Stripe payment emails getting flagged | Use separate primary domain — that's why we use sister domain for cold |
| DKIM signature breaks after DNS edit | Test with Mail-Tester before each campaign starts |
| Beta testers reporting "didn't get welcome email" | Test transactional email separately via Brevo / Mailgun (different from cold outreach domain) |

## India-Specific Notes
- `.in` domain has no deliverability disadvantage but some US prospects might trust `.com` slightly more (irrelevant for India-only)
- Indian Gmail accounts dominant — calibrate Mail-Tester score for Gmail Inbox placement specifically
- Avoid sending between 12am-6am IST (algorithmic spam flag risk)
- Best send times: Tuesday-Thursday 10am-12pm IST for B2B

## Connected Days / Dependencies
- **Blocks:** Days 17, 18, 19 (cold outreach execution)
- **Depends on:** Secondary domain registered, Google Workspace active

## Success Metric
- Mail-Tester score 9+/10 by Day -1
- Inbox placement in Gmail/Outlook on test sends
- Day 17-19 actual cold campaign: 25%+ open rate, <5% bounce rate
