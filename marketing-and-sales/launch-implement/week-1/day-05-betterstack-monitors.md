# BetterStack Uptime Monitors — RealEstateFlow

**Dashboard:** https://uptime.betterstack.com  
**Status page:** https://status.realestateflow.in  
**Last updated:** 2026-06-11

---

## Monitor 1 — Marketing Homepage

| Field | Value |
|-------|-------|
| **Name** | realestateflow.in homepage |
| **URL** | `https://realestateflow.in/` |
| **Method** | GET |
| **Expected status** | 200 |
| **Check interval** | 60 seconds |
| **Regions** | Mumbai, Bangalore, Singapore |
| **Timeout** | 10 seconds |
| **Incident threshold** | 2 consecutive failures |
| **Response SLA** | < 2 seconds |
| **Group** | Website |

---

## Monitor 2 — Pricing Page

| Field | Value |
|-------|-------|
| **Name** | realestateflow.in/pricing |
| **URL** | `https://realestateflow.in/pricing/` |
| **Method** | GET |
| **Expected status** | 200 |
| **Check interval** | 60 seconds |
| **Regions** | Mumbai, Bangalore, Singapore |
| **Timeout** | 10 seconds |
| **Incident threshold** | 2 consecutive failures |
| **Response SLA** | < 2 seconds |
| **Group** | Website |

---

## Monitor 3 — Demo Page

| Field | Value |
|-------|-------|
| **Name** | realestateflow.in/demo |
| **URL** | `https://realestateflow.in/demo/` |
| **Method** | GET |
| **Expected status** | 200 |
| **Check interval** | 60 seconds |
| **Regions** | Mumbai, Bangalore, Singapore |
| **Timeout** | 10 seconds |
| **Incident threshold** | 2 consecutive failures |
| **Response SLA** | < 2 seconds |
| **Group** | Website |

---

## Monitor 4 — API Health

| Field | Value |
|-------|-------|
| **Name** | api.realestateflow.in health |
| **URL** | `https://api.realestateflow.in/health` |
| **Method** | GET |
| **Expected status** | 200 |
| **Expected body** | Contains `"status":"ok"` or `"healthy":true` |
| **Check interval** | **30 seconds** |
| **Regions** | Mumbai, Bangalore, Singapore |
| **Timeout** | 5 seconds |
| **Incident threshold** | 2 consecutive failures |
| **Response SLA** | < 500 ms |
| **Group** | API |
| **Severity** | P0 |

---

## Monitor 5 — CRM Application

| Field | Value |
|-------|-------|
| **Name** | app.realestateflow.in |
| **URL** | `https://app.realestateflow.in/` |
| **Method** | GET |
| **Expected status** | 200 |
| **Check interval** | 60 seconds |
| **Regions** | Mumbai, Bangalore, Singapore |
| **Timeout** | 10 seconds |
| **Incident threshold** | 2 consecutive failures |
| **Response SLA** | < 3 seconds |
| **Group** | CRM Application |
| **Severity** | P0 |

---

## Monitor 6 — Razorpay Webhook Endpoint

| Field | Value |
|-------|-------|
| **Name** | api billing webhook |
| **URL** | `https://api.realestateflow.in/api/billing/webhook` |
| **Method** | **HEAD** (or GET if HEAD not supported — expect 405) |
| **Expected status** | 200 or 405 (endpoint reachable, not 5xx) |
| **Check interval** | 60 seconds |
| **Regions** | Mumbai, Singapore |
| **Timeout** | 5 seconds |
| **Incident threshold** | 2 consecutive failures |
| **Group** | Billing |
| **Severity** | P1 |
| **Notes** | 405 acceptable — confirms route exists; 502/503 = incident |

---

## Incident Notifications

| Channel | Recipient | Events |
|---------|-----------|--------|
| Email | founder@realestateflow.in | All incidents |
| Push (BetterStack app) | Founder mobile | P0, P1 |
| Crisp pinned message | Manual on P0 | Status page link |
| Slack (optional) | #incidents webhook | P0 |

---

## Escalation

| Severity | Definition | Response SLA |
|----------|------------|--------------|
| P0 | API down, CRM down, data loss risk | < 15 min ack |
| P1 | LP down, webhook unreachable, degraded API | < 2h ack |
| P2 | Single region latency spike, non-critical page | < 24h |

**If founder unreachable >2h:** {{CONTRACTOR_NAME}} {{CONTRACTOR_PHONE}} (M2+)

---

## Custom Domain (Cloudflare)

| Type | Host | Value |
|------|------|-------|
| CNAME | `status` | BetterStack-provided target |

---

## Validation Checklist

- [ ] All 6 monitors green for 1 hour continuous
- [ ] Deliberate 5-min API stop → incident created → auto-resolved on recovery
- [ ] Founder receives push within 60 seconds of test incident
- [ ] Status page footer linked from CRM SPA
