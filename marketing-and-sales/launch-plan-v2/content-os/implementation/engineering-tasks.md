# Implementation — Engineering Tasks

Each task: id · description · acceptance · epic · size (S/M/L).

## Backend (BE)
| ID | Task | Acceptance | Epic | Size |
|---|---|---|---|---|
| BE-1 | Lead attribution fields + create-path persist (`crmDynamodbService`, `routes/leads.js`) | create accepts/stores source/utm/campaignId/contentRef/consent | EP-1 | M |
| BE-2 | `MKT_EVENT` entity + `marketingEventsService.js` (write/query) | events written w/ TENANT#, dedupe by idempotencyKey | EP-2 | M |
| BE-3 | `POST/GET /api/marketing/events` (auth+tenant+HMAC verify) | 200 + stored; bad signature 401 | EP-2 | M |
| BE-4 | Rules engine (extend SCHEDULED_NOTIFICATION worker) | rule eval on event; idempotent actions | EP-2 | L |
| BE-5 | Sequence orchestration (enroll/advance/cancel) | due-sequence worker sends; cancel on reply | EP-4 | L |
| BE-6 | AI-calling auto-qualify trigger → `ai-calling-service` | qualified lead → call placed + transcript stored | EP-3 | M |
| BE-7 | `scoringService` (lead/activation/health) + nightly job | scores on all leads/customers nightly | EP-5 | M |
| BE-8 | Referral entity + code gen + conversion attribution + reward ledger | referee linked; reward on paid | EP-6 | M |
| BE-9 | Dashboard read-model/query API (funnel/attribution/cohorts via GSIs) | endpoints return correct rollups | EP-7 | L |

## Frontend (FE)
| FE-1 | Capture UTM/source on web signup → lead create | UTM persisted | EP-1 | S |
| FE-2 | Lead detail/list: source chip, contentRef, score badge, filters | visible + filterable | EP-1/5 | M |
| FE-3 | Marketing Dashboard page (`pages/crm/MarketingDashboard.tsx`) | funnel + attribution + CAC/LTV + cohorts | EP-7 | L |
| FE-4 | Referral UI (customer link + admin list) | link copy + report | EP-6 | M |
| FE-5 | Automation/sequences admin (rules, enrollments) — admin RBAC | admin-only CRUD | EP-4 | M |
| FE-6 | Demo scheduling hook into `Calendar.tsx` | book + reminders surface | EP-4 | S |

## Integrations (INT)
| INT-1 | IG Graph API app + webhooks (comments/DMs) + auto-reply | events ingested; auto-reply sent | EP-3 | L |
| INT-2 | WhatsApp Business API + templates + opt-in store | consented sends only | EP-4 | L |
| INT-3 | Meta Lead Ads ingest + CAPI | lead-ad → attributed lead | EP-3 | M |
| INT-4 | Blotato publish webhook → `content_published` | event on publish | EP-1 | S |
| INT-5 | SES email sequences | send + bounce suppress | EP-4 | M |
| INT-6 | Calendar (Cal.com/Google) for demo booking | event create/cancel | EP-4 | M |

## Infra (INF) & QA
| INF-1 | Marketing routes on existing handler or new Lambda | deployed | EP-2 | M |
| INF-2 | SQS + DLQ for event routing | at-least-once + DLQ | EP-2 | M |
| INF-3 | Per-tenant secrets (SSM/Secrets Manager) | tokens isolated | EP-3/4 | S |
| INF-4 | New GSIs (event/source/score/referral/seq-due) | access patterns served | EP-1/7 | M |
| INF-5 | Webhook HMAC verify + rate limit + DLQ | invalid rejected | EP-2 | S |
| INF-6 | Observability (CloudWatch metrics/alarms) | funnel + failure alarms | all | M |
| QA-1 | Multi-tenant isolation, consent/opt-out, idempotency, attribution accuracy | tests pass | all | M |
