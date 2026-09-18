# platform/events — EventBridge bus

Design note; the bus and rules are still declared inside each unit's own
CloudFormation template. This records what is wired today and the target.

## Today: default bus, six event types

| `source` / `detail-type` | Producer | Consumers |
|---|---|---|
| `crm.leads` / `lead.created` | `agency-app/api` (`leadIngestion.js`, `routes/leads.js`, `routes/aiCallingInternal.js`) | `agency-app/api` LeadQualifier; `agency-app/followup-agent` worker |
| `crm.leads` / `lead.qualified` | `agency-app/api` (`scripts/lead-qualifier-handler.js`) | `agency-app/api` LeadRouter |
| `crm.meetings` / `meeting.completed`, `meeting.cancelled` | `agency-app/api` (`services/meetingEvents.js`) | `agency-app/followup-agent` worker |
| `aicalling.calls` / `call.ended` | `agency-app/ai-calling` (`services/eventPublisher.js`) | `agency-app/followup-agent` worker |
| `whatsapp.incoming` / `message.received` | `platform/whatsapp-platform` (`events/index.js`) | `agency-app/api` WhatsAppProcessor |
| `whatsapp.outbound` / `message.sent`, `message.failed`; `whatsapp.session` / `session.*` | `platform/whatsapp-platform` | none yet |

No custom bus, no schema registry, no DLQ on most rules. Schemas for these
payloads now live in `platform/contracts/events/`.

## Target

- One named bus per environment: `realestateflow-<env>`. Producers set
  `EventBusName`; rules move off `default`.
- Every rule gets a DLQ and a retry policy.
- Every event carries `eventId`, `tenantId`, `version`, `occurredAt`; consumers
  are idempotent on `eventId` and ignore versions older than what they hold.
- New cross-product events: `agency.listings` / `listing.published`,
  `listing.unpublished`; `public.enquiries` / `enquiry.created`;
  `crm.tenants` / `tenant.updated`; `crm.subscriptions` / `subscription.changed`.
- Schemas are validated in CI (`platform/contracts`: `npm test`).
