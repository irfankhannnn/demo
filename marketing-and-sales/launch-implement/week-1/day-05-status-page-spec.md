# Status Page Spec — RealEstateFlow

**URL:** https://status.realestateflow.in  
**Provider:** BetterStack Uptime  
**Last updated:** 2026-06-11

---

## Page Configuration

| Field | Value |
|-------|-------|
| **Title** | RealEstateFlow Status |
| **Subtitle (all operational)** | All systems operational |
| **Subtitle (degraded)** | Some systems experiencing issues |
| **Subtitle (major outage)** | Major outage — we're working on it |
| **Logo** | https://realestateflow.in/assets/logos/final/logo.png |
| **Favicon** | Same as LP |
| **Custom domain** | status.realestateflow.in |
| **Timezone** | Asia/Kolkata (IST) |
| **Subscribe CTA** | Email + RSS (BetterStack native) |

---

## Components (Service Groups)

| Component | Monitors included | Description shown to users |
|-----------|-------------------|---------------------------|
| **Website** | Homepage, Pricing, Demo | Marketing pages at realestateflow.in |
| **CRM Application** | app.realestateflow.in | Broker CRM at app.realestateflow.in |
| **API** | /health | Core API for CRM and integrations |
| **Billing** | Razorpay webhook | Subscription and payment processing |
| **Email Delivery** | Manual updates | Transactional email via Brevo |

**Note:** Email Delivery has no automated monitor in M1 — update manually during Brevo incidents.

---

## Uptime Display

- **Past 90 days** uptime percentage per component
- **Overall uptime** badge in header
- **Incident history** — last 90 days visible
- **Scheduled maintenance** — post 24h in advance when possible

---

## Incident Templates

### New Incident (Manual or Auto)

**Title format:** `[Component] — Brief description`  
**Examples:**
- `API — Elevated error rates`
- `CRM Application — Login failures`
- `Website — Pricing page unreachable`

**Severity levels:**
| Level | Label | Customer-facing? |
|-------|-------|------------------|
| Major | 🔴 Major outage | Yes — banner on CRM |
| Minor | 🟡 Degraded performance | Yes |
| Maintenance | 🔵 Scheduled maintenance | Yes |

**Customer-facing description template:**

```
We are currently investigating [issue description] affecting [component].

Impact: [What users cannot do — e.g., "You may be unable to log in to the CRM"]

Started: [TIMESTAMP IST]

We will post updates every 30 minutes until resolved.

Questions: info@realestateflow.in
```

**Internal fields (BetterStack only):**
- Root cause (initial hypothesis)
- ETA to resolution
- Assigned: Founder
- Linked Sentry issue (if applicable)

---

### Update Template

```
Update [N] — [TIMESTAMP IST]

Status: [Investigating / Identified / Monitoring / Resolved]

[2-3 sentences on progress]

Next update by [TIME IST] or sooner if status changes.
```

---

### Resolved Template

```
Resolved — [TIMESTAMP IST]

The issue affecting [component] has been resolved.

Duration: [START] – [END] IST ([X] minutes)

Cause: [Brief, customer-appropriate explanation]

All systems are operational. Thank you for your patience.

If you continue to experience issues, contact info@realestateflow.in.
```

---

## Communication Playbook

| Severity | Status page | Crisp | Email customers |
|----------|-------------|-------|-----------------|
| P0 (API/CRM down) | Auto + manual updates | Pin status link | All paying customers from founder@ |
| P1 (LP/degraded) | Auto + manual updates | Reply with link | No mass email unless >1h |
| P2 (minor) | Status page only | On request | No |
| Maintenance | Scheduled post 24h ahead | Off-hours auto-reply note | Optional heads-up |

---

## CRM & LP Integration

**CRM SPA footer:**
```html
<a href="https://status.realestateflow.in" target="_blank" rel="noopener">
  System status
</a>
```

**LP footer:** Same link, text "Status"

**During P0:** Optional banner in CRM:
```
⚠️ We're experiencing an issue. Check status.realestateflow.in for updates.
```

---

## Postmortem Template

Save completed postmortems to `marketing-and-sales/launch-implement/incidents/YYYY-MM-DD-slug.md`

```markdown
# Incident Postmortem — [TITLE]

**Date:** YYYY-MM-DD  
**Duration:** X minutes  
**Severity:** P0/P1/P2  
**Author:** {{FOUNDER_NAME}}

## Summary
[One paragraph]

## Timeline (IST)
| Time | Event |
|------|-------|
| HH:MM | Alert fired |
| HH:MM | Acknowledged |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Resolved |

## Root Cause
[Technical explanation]

## Impact
- Users affected: [estimate]
- Revenue impact: [if any]

## Resolution
[What fixed it]

## Action Items
| Action | Owner | Due |
|--------|-------|-----|
| | | |

## Lessons Learned
[What we'll do differently]
```

---

## Launch Checklist

- [ ] BetterStack status page created
- [ ] CNAME `status.realestateflow.in` → BetterStack
- [ ] All 5 components mapped to monitors
- [ ] Subscribe button tested (founder email received)
- [ ] Test incident created and resolved
- [ ] Footer links live on CRM + LPs
- [ ] 90-day uptime widget visible
