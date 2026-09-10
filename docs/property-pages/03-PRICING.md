# Pricing

ManyChat pricing fetched live on 2026-09-10. All figures USD, annual
billing, tax excluded. ManyChat bills by country — Indian GST handling on
top of these prices is **unverified**; confirm at checkout before quoting a
number to an agency.

## Plan tiers

| Plan | Price/mo (annual billing) | Contacts included | Instagram included |
|---|---|---|---|
| Free | $0 | 25 | Yes |
| Essential | $14 | 250 | Yes |
| Pro | $29 | 2,500 | Yes |
| Business | $69 | 7,500 | Yes |
| Advanced | $139 | 25,000 | Yes |

Instagram is available on every tier including Free — no Instagram-specific
upgrade requirement.

## Overage, per contact beyond the plan's included count

| Plan | Annual billing | Monthly billing |
|---|---|---|
| Essential | $0.082 | $0.10 |
| Pro | $0.038 | $0.05 |
| Business | $0.018 | $0.025 |
| Advanced | $0.0028 | $0.004 |

## Cost at three contact volumes

| Contacts | Cheapest fitting plan | Monthly cost |
|---|---|---|
| 1,000 | Pro | $29 flat — cheaper than Essential + overage (750 over × $0.082–$0.10 ≈ $61–75, plus $14 base ≈ $75–89 total) |
| 5,000 | Business | $69 flat — cheaper than Pro + 2,500 overage (≈ $95 + $29 = $124) |
| 25,000 | Advanced | $139 flat |

At 1,000 contacts, Pro's flat $29 beats Essential-plus-overage
(~$75–89) — worth remembering when an agency asks why not start on
Essential. Pro wins the moment a contact list crosses a few hundred past
Essential's 250 included.

Third-party blogs quoting "$39/mo Pro" are citing a stale price point —
verify against ManyChat's own pricing page before quoting a number.

## Our own AWS costs for this feature

Rough order-of-magnitude estimates for `property-pages-ms`, not vendor
quotes. Actual cost depends heavily on traffic (a listing going viral on
Instagram looks very different from steady organic traffic) — re-measure
against real CloudWatch billing once a few agencies are live rather than
trusting this table as a forecast.

| Component | Driver | Order of magnitude |
|---|---|---|
| Lambda | Invocations × duration (512MB, ~100–400ms/render incl. CRM round-trip) | Low tens of USD/month at moderate traffic; scales roughly linearly. |
| DynamoDB (GuardTable) | On-demand, tiny items, high write rate (every view/session-mint increments a counter) | Single-digit USD/month; TTL keeps the table from growing. |
| CloudFront | Data transfer + requests (images proxy via S3 redirect, not through CF transfer) | Single-digit to low tens of USD/month. |
| S3 | Existing CRM bucket; this feature adds no storage, only presigned-GET requests | Negligible incremental cost. |
| API Gateway | Per-request, REGIONAL REST API | Comparable order of magnitude to Lambda. |

Total at a handful of agencies with moderate traffic: plausibly low tens to
around a hundred USD/month. Not a budget commitment — re-estimate against
real usage.

## What we do NOT need to build

- No Meta App Review or Business Verification for our own app.
- No comment-polling infrastructure to detect new Instagram comments.
- No direct Instagram Send API integration.
- No 24-hour-messaging-window bookkeeping — ManyChat enforces Meta's rules
  on its side.

## What ManyChat cannot do for us

- **Reliable phone/email prefill** — usually absent for an Instagram-origin
  contact unless collected in-flow.
- **The scheduling backend** — no concept of our availability, slots, or
  business hours; that's `server/siteVisitBooking.js`.
- **The CRM record** — ManyChat gets a visitor to a link, nothing more.
- **The booking confirmation** — confirming and durably storing a specific
  date/time is our flow's job end to end.
