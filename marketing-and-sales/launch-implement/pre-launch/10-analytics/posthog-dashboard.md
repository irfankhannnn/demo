# PostHog Dashboard Configuration — RealEstateFlow

**Project:** RealEstateFlow (single project, LP + CRM + server)  
**Region:** EU (disclose in Privacy Policy)  
**Last updated:** 2026-06-11

---

## Dashboard: Mumbai Launch Overview

**Purpose:** Founder Day-21 metrics review and Week-4 CRO input.

### Row 1 — Funnel (primary)

**Insight type:** Funnel  
**Name:** Mumbai launch funnel  
**Window:** 14 days (rolling)

| Step | Event | Filters |
|------|-------|---------|
| 1 | `page_view` | path contains realestateflow.in |
| 2 | `cta_click` | cta_id = primary-trial-cta |
| 3 | `form_submit` OR `signup_started` | — |
| 4 | `signup_completed` | — |
| 5 | `agency_registered` | — |
| 6 | `subscription_started` | — |
| 7 | `ai_employee_connected` | — |
| 8 | `ai_employee_lead_handled` | activation (≥1 within 7d of step 6) |

**Breakdown:** `utm_source`, `utm_campaign`  
**Goal:** Identify drop-off between steps 3→4 (signup friction) and 6→7 (AI attach)

---

### Row 2 — Weekly signups

| Insight | Type | Event | Display |
|---------|------|-------|---------|
| Trial signups | Trends | `signup_completed` | Weekly count |
| Paid conversions | Trends | `subscription_started` | Weekly count |
| Trial → paid rate | Formula | paid / signups | Percentage |

---

### Row 3 — Activation

| Insight | Type | Definition |
|---------|------|------------|
| Activation rate | Trends | `ai_employee_lead_handled` within 7d of `signup_completed` OR `buyer_added` + `property_added` within 7d |
| Feature first-use heatmap | Trends | `feature_first_use` broken down by `feature_name` |
| Time to first buyer | Trends | median days from `signup_completed` to `buyer_added` |

---

### Row 4 — LP performance

| Insight | Type | Event | Breakdown |
|---------|------|-------|-----------|
| Page views by LP | Trends | `page_view` | `path` |
| CTA click rate | Funnel | `page_view` → `cta_click` | `page` |
| Form submit rate | Funnel | `page_view` → `form_submit` | `form_name` |
| Pricing annual toggle | Trends | `pricing_toggle_annual` | `to_billing` |

---

### Row 5 — Revenue signals

| Insight | Type | Event |
|---------|------|-------|
| Subscriptions by tier | Trends | `subscription_started` → breakdown `tier` |
| AI Employee attach | Trends | `ai_employee_connected` |
| Churn | Trends | `subscription_cancelled` |
| Payment failures | Trends | `razorpay_payment_failed` (server) |

---

## Cohorts

| Cohort name | Definition |
|-------------|------------|
| Mumbai trial users | `utm_source` contains `lp-` OR properties `$geoip_city` = Mumbai |
| AI Employee adopters | performed `ai_employee_connected` |
| Activated users | performed `ai_employee_lead_handled` OR (`buyer_added` AND `property_added` within 7d of signup) |
| Paywall exposed | performed `trial_paywall_shown` |
| Stalled trials | `signup_completed` >7d ago AND NOT `subscription_started` AND NOT `buyer_added` |

---

## Alerts

| Alert | Condition | Notify |
|-------|-----------|--------|
| Signup drop | `signup_completed` weekly count drops >30% WoW | founder@realestateflow.in |
| Payment failure spike | `razorpay_payment_failed` >5 in 24h | founder@realestateflow.in |
| API errors | Sentry (separate) — link in dashboard | founder@realestateflow.in |
| Grievance received | `grievance_received` any | info@realestateflow.in |

---

## Session Replay Settings

- **LP:** Enabled when analytics consent granted
- **CRM:** Enabled when analytics consent granted
- **Sample rate:** 100% M1 (reduce to 50% if quota pressure)
- **Mask inputs:** Yes (phone, email, GSTIN fields)

---

## Identity & Cross-Domain

1. LP: anonymous PostHog distinct_id
2. Signup: `posthog.identify(userId, { tenantId, role, utm_source, utm_campaign, utm_medium })`
3. Server events: use `userId` or `tenantId` as distinct_id
4. Logout: `posthog.reset()`

---

## Key Properties (identify)

| Property | Source |
|----------|--------|
| `tenantId` | Auth context |
| `role` | admin / agent / member |
| `plan` | solo / team / teamplus |
| `trialEndsAt` | Billing service |
| `agencyName` | Agency profile |
| `utm_source` | sessionStorage from LP CTA |

**Never in event properties:** email, phone, GSTIN (identify only, set_once)

---

## GA4 / Meta / LinkedIn (LP only — founder configures)

| PostHog event | GA4 conversion | Meta Pixel | LinkedIn |
|---------------|----------------|------------|----------|
| `signup_completed` | `sign_up` | `Subscribe` | `signup_completed` |
| `form_submit` (lead-capture) | `generate_lead` | `Lead` | — |
| `subscription_started` | `purchase` | `Purchase` | `subscription_started` |

Configured in respective ad platform dashboards — not in CRM.

---

## Dashboard Share

- Founder: Admin
- Future hire: Viewer (M2+)
- Export: Weekly PNG to `marketing-and-sales/reports/`
