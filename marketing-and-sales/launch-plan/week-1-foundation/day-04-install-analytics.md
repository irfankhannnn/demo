# Day 4 — Install Analytics + Define Activation Event

## Objective
Wire PostHog (or Mixpanel) + GA4 + Meta Pixel + LinkedIn Insight Tag into RealtyFlow, define the single "activation event" that marks a user as truly engaged, and verify all events fire correctly so Week 3 traffic is measurable and retargetable.

## Why This Matters for RealtyFlow
You cannot improve what you cannot measure. By Day 21 you'll review Week 3 metrics and ask: "How many signups? Where did they drop off? What's converting?" Without analytics installed Day 4, you'll be guessing. And the "activation event" definition (which is unique to your product) determines the entire Week 2-4 experience design.

## User Story
As a founder, I want PostHog for product analytics, GA4 for marketing analytics, Meta Pixel + LinkedIn Insight Tag for retargeting, and a clear definition of "activation event" wired into every key page and action of RealtyFlow, so that by Day 21 I have accurate funnel, retention, and conversion data to drive decisions.

## Acceptance Criteria
- [ ] PostHog account created, project initialized, JS snippet deployed
- [ ] GA4 property created, gtag installed on landing + app
- [ ] Meta Pixel installed and Pixel events firing (PageView, Lead, Subscribe)
- [ ] LinkedIn Insight Tag installed on landing page
- [ ] Activation event defined and documented
- [ ] At least 8 product events implemented (signup, onboarding step, add buyer, etc.)
- [ ] Funnel built in PostHog: Landing → Signup → Onboarding Complete → Activation
- [ ] All events tested in production with real user actions
- [ ] No PII (raw phone numbers, addresses) sent to analytics tools (DPDP compliance)
- [ ] Cookie consent banner gates non-essential analytics for new visitors
- [ ] Analytics dashboard accessible to founder and saved as bookmark

## Implementation Steps

### Step 1: Pick your stack
Recommended for Indian B2B SaaS:
- **Product analytics:** PostHog (free tier generous, self-hostable if needed) OR Mixpanel
- **Web analytics:** GA4 (free, dominant)
- **Ad attribution / retargeting:**
  - Meta Pixel (for Facebook + Instagram retargeting later)
  - LinkedIn Insight Tag (for LinkedIn cold outreach retargeting)
- **Error tracking:** Sentry (free for solo founders)

Skip for now: Heap, Amplitude (overkill), Hotjar (Month 2 — useful but not Month 1 critical)

### Step 2: Install PostHog
1. Sign up at posthog.com → create project "RealtyFlow"
2. Get the JS snippet (1 line of HTML)
3. Add to landing page + in-app (both `<head>` tag, before `</head>`)
4. Identify users post-login: `posthog.identify(user.id, { plan: user.plan, email: user.email })`
5. Test: visit your site → check PostHog "Live events" — you should see your visit

### Step 3: Define product events
Implement these custom events (use `posthog.capture('event_name', { properties })`):

| Event Name | When To Fire | Properties |
|-----------|--------------|------------|
| `signup_started` | Signup form viewed | `referrer`, `utm_source` |
| `signup_completed` | Account created | `email_domain`, `signup_method` |
| `onboarding_step_completed` | Each onboarding step done | `step_name`, `step_index` |
| `onboarding_completed` | Final onboarding step | `total_time_sec` |
| `buyer_added` | First buyer added (and subsequent) | `buyer_count_after` |
| `project_created` | First project added (and subsequent) | `project_count_after` |
| `call_started` | AI call initiated | `call_type`, `duration` |
| `call_completed` | AI call ended | `duration_sec`, `outcome` |
| `whatsapp_sent` | Message sent via integration | `message_count_after` |
| `feature_clicked` | Major feature first-use | `feature_name` |
| `pricing_viewed` | Pricing page view | `tier_focused` |
| `trial_to_paid` | Trial converted to paid | `tier`, `days_in_trial` |
| `subscription_cancelled` | User cancels | `reason`, `days_active` |

### Step 4: Define the "activation event"
This is the single most important definition you'll make this month. It answers: "When does a new user become someone who actually gets value?"

For RealtyFlow, candidates:
- **Option A:** First buyer added (low bar)
- **Option B:** First AI call completed (demonstrates wedge)
- **Option C:** 5 buyers + 1 call + 1 WhatsApp sent within 7 days (engaged behavior)

**Recommendation:** Option C — engaged behavior over single action. Captures real usage.

Document the definition:
> **Activation Event = User has added 5+ buyers AND completed 1+ AI call AND sent 1+ WhatsApp message within 7 days of signup.**

Set up PostHog cohort: "Activated Users" using this filter.

### Step 5: Build the activation funnel
In PostHog → Funnels → Create:
1. `signup_completed`
2. `onboarding_completed`
3. `buyer_added` (count ≥ 5 within 7d)
4. `call_completed` (count ≥ 1 within 7d)
5. `whatsapp_sent` (count ≥ 1 within 7d)

Save as "Activation Funnel". Bookmark it.

Target Week 4: 40%+ activation rate.

### Step 6: Install GA4
1. analytics.google.com → Create Property → "RealtyFlow"
2. Get Measurement ID (G-XXXXXXXX)
3. Install via gtag JS snippet OR Google Tag Manager
4. Configure conversions:
   - `signup_completed` → Conversion
   - `trial_to_paid` → Conversion
5. Link to Google Ads if you'll run ads (Month 2+)

### Step 7: Install Meta Pixel
1. business.facebook.com → Events Manager → Create Pixel
2. Add Pixel ID to landing page (head tag) + signup confirmation page
3. Standard events:
   - `PageView` (auto)
   - `Lead` (signup completed)
   - `CompleteRegistration` (onboarding done)
   - `Subscribe` (trial-to-paid)
4. Verify in Events Manager → Test Events

### Step 8: Install LinkedIn Insight Tag
1. linkedin.com → Campaign Manager → Account Assets → Insight Tag
2. Copy snippet, add to landing page (head tag)
3. Conversion events:
   - Sign up
   - Demo booked
4. Use in Month 2 for retargeting LinkedIn ad audiences

### Step 9: DPDP compliance — no PII to analytics
Critical: do NOT send these to analytics tools (Indian privacy law):
- Phone numbers (raw)
- Email addresses (raw — use hashes if you must)
- Customer (buyer/seller) PII

Send instead:
- User ID (anonymized internal ID)
- Email domain only ("@gmail.com")
- Aggregated counts, not individual customer data

### Step 10: Cookie consent gate
For visitors who haven't accepted cookies:
- Block PostHog, GA4, Meta Pixel, LinkedIn until consent given
- Use a cookie consent library (Cookiebot, Osano, Klaro) — install on landing page
- After consent: load all scripts

### Step 11: Test in production
- Open incognito → visit landing → check PostHog Live events (should see PageView)
- Sign up → verify `signup_completed` fires
- Complete onboarding → verify `onboarding_completed` fires
- Add a buyer → verify `buyer_added` fires
- Compare PostHog vs GA4 — visit counts should be ballpark equal (within 10%)

### Step 12: Bookmark and document
- Save key dashboards in PostHog (funnel, activation cohort, daily signups)
- Add bookmarks: PostHog, GA4, Meta Events Manager
- Document analytics-setup in `assets/analytics-config.md` for future you / co-founder

## Tools / Stack Required
- PostHog (free tier)
- GA4 (free)
- Meta Business Suite (free)
- LinkedIn Campaign Manager (free)
- Cookiebot / Osano / custom banner
- Sentry for error tracking (optional, Month 1 nice-to-have)
- GTM (Google Tag Manager) — optional, simplifies multi-tag management

## Time Estimate
- PostHog install + events: 3-4 hours
- GA4 install: 1-2 hours
- Meta + LinkedIn pixels: 1 hour
- Activation event definition + funnel: 1-2 hours
- Cookie consent + testing: 2 hours
- **Total: full day**

## Deliverables
- All 4 analytics tools live
- 13+ product events firing
- Activation event definition documented at `assets/activation-event-definition.md`
- Activation funnel bookmarked in PostHog
- Analytics config doc

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Analytics slows down page load | Use async loading; defer non-critical scripts |
| Cookie banner annoys users | Use minimal, non-blocking banner. India isn't as cookie-strict as EU but DPDP requires basic consent |
| Events fire incorrectly (double-counting, missing) | Test each event live, log to console in dev mode, audit in PostHog raw events |
| PII accidentally sent | Audit every `posthog.capture()` call. Hash emails. Never send phone numbers. |
| Activation event definition wrong | Revisit Day 28. Initial definition is a hypothesis — refine with data. |

## India-Specific Notes
- PostHog is GDPR/DPDP friendly out of the box; flip "Anonymize IPs" ON
- GA4 IP anonymization: enable in property settings
- Meta Pixel collects IPs by default — required for retargeting but disclose in privacy policy
- Indian users may have lower JS execution speeds on tier-2/3 city devices — keep analytics lean

## Connected Days / Dependencies
- **Blocks:** Day 21 (Week 3 metrics review), Day 22 (drop-off analysis), Day 29 (revenue audit)
- **Depends on:** Day 6 (landing page final wiring), `pre-launch-prep/01` (cookie consent in legal)

## Success Metric
- Visit your landing page → see your own activity in PostHog within 30 seconds
- Activation event definition fits in 1 sentence and you can explain why each criterion matters
- 13+ events firing without errors in production
- Funnel chart visible and bookmarked
