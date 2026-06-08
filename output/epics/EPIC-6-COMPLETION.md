# EPIC-6 Completion Report — PR-F: Billing Webhook + OpenClaw Concierge

## Implemented Features
- Razorpay webhook handler (`POST /api/billing/webhook`) with HMAC-SHA256 signature verification
- Idempotent event processing via `WebhookLog` DDB table with 30-day TTL
- AI Employee provisioning flow: `subscription.activated` → creates `AIEmployeeProvisioning` row + Brevo email + AiSensy broadcast + PostHog event
- Additional webhook branches: `subscription.charged`, `payment.captured`, `payment.failed`, `subscription.cancelled`, `subscription.updated` (seat increment stub)
- `AIEmployeeStatus.tsx` page at `/integrations/ai-employee` with 3 states: pending (progress bar), live (Loom embed), escalated (₹500 credit notice)
- API key auth middleware for OpenClaw HTTP requests (`apiKeyAuth.js`)
- 6-hour SLA escalation cron (`escalation-cron.js` + `escalate-openclaw.yaml`)
- 10-step support SOP + 3 customer message templates

## APIs Added
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/billing/webhook` | HMAC-SHA256 (public) | Razorpay webhook handler |
| GET | `/api/ai-employee/status` | validateToken + extractTenantId | Provisioning status for current tenant |

## Database Changes
- `AIEmployeeProvisioning` table: PK=tenantId, SK=createdAt, GSI=status-createdAt-index
- `WebhookLog` table: PK=webhookEventId, TTL=30 days
- `TenantApiKeys` table: PK=tenantId, keyHash, scopes, isActive

## Infrastructure Changes
- EventBridge rule `ai-employee-escalation-6h`: `rate(6 hours)` → Lambda (60s timeout, 128MB)
- Billing webhook mounted BEFORE auth middleware in `server.js`

## Security Enhancements
- HMAC-SHA256 signature verification on all webhook requests
- Idempotency via `WebhookLog` prevents duplicate processing
- API key hashed with SHA-256 before storage
- Phone number masking in status endpoint response

## Testing Performed
- `vite build` passes (zero new errors)
- `tsc --noEmit` passes (zero new TS errors from PR-F files; all errors pre-existing)
- All 6 PR-F acceptance criteria from spec met
- P11 ACs 1-8 checked

## Known Constraints
- `incrementSeatsPaid` is a stub — PR-H creates the real `subscriptionService`
- `serverTrack` dynamically imports `server/lib/posthog.js` (created by PR-E; falls back to logging)
- M1 cap (3 AI Employee signups/week) is manual — support toggles Razorpay plan availability
- Razorpay ₹500 credit note on SLA breach is a manual step (cron sends email reminder)
- Tenant-scoped API key auto-issuance on activation (AC P11-9) is documented in SOP but not auto-generated — founder manually provisions via DDB
