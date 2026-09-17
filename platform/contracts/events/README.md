# events/

One JSON Schema (draft 2020-12) per EventBridge event. File name:
`<source>/<detail-type>.v<n>.json`. Each schema describes the `detail`
object; the envelope is EventBridge's own (`source`, `detail-type`, `time`).

Metadata every schema carries (checked by `npm test`):

| Key | Meaning |
|---|---|
| `$id` | `https://contracts.realestateflow.in/events/<source>/<detail-type>.v<n>.json` |
| `x-source` | the `source` producers set (`crm.leads`, `aicalling.calls`, …) |
| `x-detail-type` | the `detail-type` (or a list, when one schema covers several) |
| `x-producer` | the unit and file that publishes it |
| `x-consumers` | units with a rule on it (empty list when none yet) |

Conventions:

- `tenantId` is always present, or the schema's `x-tenant-resolution` says how
  the consumer derives it (only `whatsapp.incoming` needs this today). Consumers
  never act on an event without a tenant.
- v1 schemas describe today's payloads exactly, so nothing has to change to
  adopt them. New events also carry `eventId`, `version` and `occurredAt`;
  consumers dedupe on `eventId` and ignore versions older than what they hold.
- Public-facing events (`agency.listings/*`) carry only fields a consumer is
  allowed to see: no owner phone numbers, no internal notes.
- Additive changes edit the `v<n>` file; breaking changes add `v<n+1>`.
