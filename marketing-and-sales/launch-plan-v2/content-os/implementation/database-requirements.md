# Implementation — Database Requirements

DynamoDB single-table (`PK/SK`, `EntityType`, `TENANT#`). Additive only.

## Lead — new attributes
`leadSource` (enum), `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `campaignId`, `contentRef` (OPP-*/reel id), `consent` ({whatsapp,email,bool,ts}), `leadScore`, `activationScore`, `firstTouchAt`, `lastTouchAt`. Backfill existing leads with `leadSource='unknown'`.

## New entities
| EntityType | PK | SK | Notes |
|---|---|---|---|
| `MKT_EVENT` | TENANT#<t> | EVENT#<ISOts>#<uuid> | type, channel, leadRef, contentRef, payload, dedupeKey |
| `SEQUENCE_ENROLLMENT` | TENANT#<t> | SEQ#<leadId>#<seqId> | step, nextAt, status |
| `SCORE` | TENANT#<t> | SCORE#<entityId> | leadScore, activationScore, healthScore, computedAt |
| `REFERRAL` | TENANT#<t> | REF#<code> | referrerId, refereeLeadId, status, reward |
| `CAMPAIGN` | TENANT#<t> | CAMPAIGN#<id> | channel, name, spend, utm |

## GSIs (new)
- `GSI-EventType`: PK=`TENANT#<t>#TYPE#<type>`, SK=`<ISOts>` → funnel/time rollups.
- `GSI-LeadSource`: PK=`TENANT#<t>#SOURCE#<source>`, SK=`<ISOts>` → source reports.
- `GSI-LeadScore`: PK=`TENANT#<t>#STAGE#<stage>`, SK=`<score>` → hottest-first.
- `GSI-ReferralStatus`: PK=`TENANT#<t>#REFSTATUS#<status>`, SK=`<ts>`.
- `GSI-SeqDue`: PK=`TENANT#<t>#SEQDUE`, SK=`<nextAt>` (reuse scheduled-notification pattern) → due-sequence worker.

## Retention/consent
Event payload PII minimized; consent + opt-out stored on Lead; TTL on raw events if needed for cost.
