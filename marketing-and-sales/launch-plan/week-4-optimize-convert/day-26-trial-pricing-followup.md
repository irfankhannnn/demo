# Day 26 — Trial-To-Paid Conversion Push

## Objective
Send a personal trial-ending notification to every trial user whose 14-day window ends within the next 7 days — offering a limited-time launch discount (e.g., 20% off first 3 months) — and convert 30-50% of qualified trials into paying customers by Day 30.

## Why This Matters for RealtyFlow
This is THE revenue moment for Month 1. Every fix, every demo, every cold message — they all converge here. Trial users have the most context they'll ever have about RealtyFlow's value. If they're going to convert, it's now. A personal email + discount + clear path to upgrade recovers customers who would otherwise expire silently. This day alone produces 50%+ of your Month 1 paid customers.

## User Story
As a founder, I want to identify every trial user whose 14-day window ends within 7 days, segment them by engagement level, and send personalized trial-ending messages — offering a launch incentive (20% off 3 months) to active users and a direct "what would help you decide?" to fence-sitters — so that 2-4 trial users convert to paying customers between Day 26-30.

## Acceptance Criteria
- [ ] List of trial-ending-soon users built (next 7 days)
- [ ] Each user segmented: Active engaged / Light user / Stalled
- [ ] Personalized message sent to each (founder-signed)
- [ ] Launch discount documented (e.g., "20% off first 3 months for founding customers")
- [ ] Discount code created in Razorpay
- [ ] At least 30% of Active engaged convert to paid by Day 30
- [ ] At least 1 paying customer secured
- [ ] All conversions logged: customer name, tier, MRR, payment date
- [ ] Updated tracker: MRR Month 1 total
- [ ] Founder thanks message sent to each new paid customer

## Implementation Steps

### Step 1: Build the trial-ending list
PostHog filter:
- `signup_completed` event 7-14 days ago
- Trial status not yet converted (no `trial_to_paid` event)
- Sort by activation level (high → low)

Or in your billing system:
- Razorpay → Subscriptions filter: Trial ending within 7 days

Likely 10-25 users.

### Step 2: Segment by engagement
| Segment | Definition | Conversion Likelihood |
|---------|-----------|----------------------|
| Active engaged | Added 5+ buyers, made 1+ AI call, sent 1+ WhatsApp | 30-50% |
| Light user | Logged in 2-3 times, added some data, no wedge feature use | 10-20% |
| Stalled (already messaged Day 24) | Few/no logins, contacted Day 24 | 0-5% |

Different messages per segment.

### Step 3: Set up launch discount
Decide on a discount that creates urgency without commoditizing:

**Option A: 20% off first 3 months**
- Founding member pricing
- Lock-in for 3 months → reduces immediate churn risk
- Easy to communicate

**Option B: 1 month free if 6-month commitment**
- Bigger upfront discount but commits user
- Better for cash flow + retention

**Option C: Founding member badge (no discount, but exclusivity)**
- "First 50 customers" badge in their dashboard
- Lifetime pricing lock

**Recommended:** Option A. Most common, easiest to deliver.

Configure in Razorpay:
- Create coupon: `FOUNDING20`
- 20% off, valid until Day 35 (gives buffer)
- Applicable to all tiers
- Auto-applies at checkout via URL param

### Step 4: Draft messages per segment

**Active Engaged segment — email + WhatsApp:**
> Subject: Your RealtyFlow trial — last 4 days
>
> Hey Rohit,
>
> Your free trial ends Friday. Wanted to reach out personally — you've been one of our most active users (47 buyers added, 18 site visits scheduled, 1 deal closed). Crazy stats for 11 days.
>
> Quick numbers on what RealtyFlow's done for you:
> - Site visits scheduled via AI calling: 14
> - WhatsApp follow-ups sent: 86
> - Hours saved (estimated): ~28
>
> If you'd like to continue, I'm offering founding-member pricing:
> **20% off first 3 months** with code FOUNDING20.
>
> Professional tier with the discount: ₹1,999/month for 3 months (saves ₹1,500).
>
> Renew here: realtyflow.in/upgrade?code=FOUNDING20
>
> Either way — would love to hear what's worked and what hasn't. 1-line reply is enough.
>
> Cheers,
> Kalim
> Founder

**Light User segment — slightly more questioning:**
> Subject: Trial ending soon — quick question
>
> Hey Priya,
>
> Your trial ends Friday. Saw you added 8 buyers last week — what's blocked you from going deeper?
>
> If it's something I can help with (10-min screen share, missing feature, pricing question), let me know.
>
> If you want to continue regardless:
> **20% off first 3 months** with FOUNDING20.
>
> Or extend trial by 14 more days — happy to do that if you want more time. Just reply.
>
> Cheers,
> Kalim

**Stalled (already Day 24 messaged) — final, low-pressure:**
> Hey Vikram — last note from me. Your trial ends Friday.
>
> If you didn't get a chance to really explore RealtyFlow, no judgment — real estate is busy.
>
> Two options:
> 1. Want a 14-day extension? Reply "yes" and I'll add it.
> 2. Want to subscribe at founding rate? FOUNDING20 = 20% off 3 months.
> 3. Not the right fit? Totally fine — would just love to know why for my notes.
>
> Either way, thanks for trying it.

### Step 5: Send messages
- Send 7-10 days BEFORE trial expires (gives them time to decide)
- Channel by user preference
- Personal: from your founder email + WhatsApp number, NOT no-reply@

### Step 6: Convert via personal session if needed
For high-value or fence-sitter prospects:
- Offer a 15-min "trial wrap-up call"
- Use the call to:
  - Show their stats (concrete value)
  - Answer last-minute questions
  - Send pricing link with discount code while on the call
  - Close: "Want me to send the upgrade link now? You'll have it locked in"

### Step 7: Handle objections
**"It's too expensive."**
- Show their stats: "You closed 1 deal in 11 days. ₹2,499/month is 0.3% of that commission. The math is on your side."
- Offer Tier 1 if Tier 2 was too high: "Honestly, given your volume, Starter at ₹999 might be a better fit. Want to lock that in?"

**"Let me think for a few days."**
- Offer extension: "I can extend your trial by 14 days — just reply 'extend'. Discount still applies."

**"I need to check with my partner / accountant."**
- "Sure — happy to send a 1-page PDF you can share with them. Send their email and I'll cc them."

### Step 8: Process the payment
When they say YES:
- Send Razorpay checkout link with discount pre-applied
- Walk them through it if needed (on call or async)
- Confirm payment in Razorpay dashboard
- Verify subscription activates + invoice fires (per Day 3 testing)
- Send personal welcome:

> "Welcome to founding members! Your invoice + receipt are in your email. I'll personally check in next Friday to see how the first paid week goes. Genuinely thrilled — thanks for trusting RealtyFlow."

### Step 9: Update tracker
- Customer name + agency + city
- Tier signed up
- MRR contribution (after discount)
- Payment date
- Conversion path (cold outreach? referral? direct?)
- Founding member badge applied

Update Day 29 revenue audit with running MRR total.

### Step 10: Block calendar for Days 27-30 conversions
Some trial-ending users will need 2-3 days to decide. Set follow-up reminders:
- Day 28: Reply to non-responders
- Day 29: Final 1-line WhatsApp ("Trial expires tomorrow — quick decision?")
- Day 30: Accept results and move on

## Tools / Stack Required
- PostHog / Razorpay (trial-ending lookup)
- Razorpay (discount code config + subscription upgrades)
- Email + WhatsApp Business
- Calendar (15-min wrap-up sessions)
- Your tracker spreadsheet

## Time Estimate
- Trial-ending list build: 30 min
- Segmentation + messaging: 2-3 hours
- Sending: 1-2 hours
- Reply handling + wrap-up calls: 3-4 hours
- Payment processing: 1 hour per conversion
- **Total: full day + ongoing through Days 27-30**

## Deliverables
- All trial-ending users contacted
- 2-4 conversions to paid (target)
- Founding member discount code live
- Payment confirmations + welcomes sent
- Tracker updated with MRR

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Conversion rate <10% | Diagnose: pricing? value clarity? trial too short? Reflect in Day 30 strategy. |
| Discount becomes default — no one pays full price | Set hard end date for FOUNDING20 (e.g., June 15 only); future users pay full |
| Trial users request indefinite extensions | One 14-day extension max; after that, convert or close |
| Payment fails during conversion | Day 3 testing should have caught this. If new issue, escalate to Razorpay support |
| You over-discount in panic | Stay at 20%. Lower discounts (10-15%) work too. Never give >30% in Month 1. |

## India-Specific Notes
- Annual prepay rare in Indian B2B Month 1 — most pick monthly
- ₹999 Tier 1 is psychological floor — discounting below this hurts perceived value
- "Founding member" framing works well in Indian SaaS (rewards trust)
- WhatsApp delivery of payment links converts higher than email
- Mobile checkout via Razorpay UPI auto-pay works smoothly for sub-₹10k Tier 1
- For larger plans (Tier 3 at ₹6,499), prefer card or bank transfer

## Connected Days / Dependencies
- **Blocks:** Day 29 (revenue audit needs conversions counted)
- **Depends on:** Day 3 (payment infra), Day 14 (testimonials for proof), Days 18-24 (trial signups sourced)

## Success Metric
- 2-4 paid customers secured by Day 30
- ₹3,000-₹20,000 MRR added
- 30%+ Active-Engaged-segment conversion rate
- First customer welcome message sent
- Zero payment failures
