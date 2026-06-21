# Obsolete Cron CloudFormation Templates

**Status:** DEPRECATED - Moved to unified `cfn-backend.yaml`

## What These Files Are

These are the old individual CloudFormation templates for each cron job. They were used when each cron was deployed as a separate stack.

## New Approach

All cron jobs are now consolidated into a single CloudFormation stack:
- **File:** `../../cfn-backend.yaml`
- **Benefit:** One-click deployment of all backend resources including all 10 cron Lambdas
- **Handler paths fixed:** All cron handlers now use `scripts/` prefix (e.g., `scripts/credit-reset-cron.handler`)

## Cron Jobs Migrated

1. `credit-reset.yaml` → CreditResetFunction in cfn-backend.yaml
2. `expiring-agreements.yaml` → ExpiringAgreementsFunction in cfn-backend.yaml
3. `team-summary.yaml` → TeamSummaryFunction in cfn-backend.yaml
4. `incomplete-data.yaml` → IncompleteDataFunction in cfn-backend.yaml
5. `trial-reminder.yaml` → TrialReminderFunction in cfn-backend.yaml
6. `escalate-openclaw.yaml` → EscalationFunction in cfn-backend.yaml
7. `lead-qualifier.yaml` → LeadQualifierFunction in cfn-backend.yaml
8. `lead-followup.yaml` → LeadFollowupFunction in cfn-backend.yaml
9. `lead-router.yaml` → LeadRouterFunction in cfn-backend.yaml
10. `whatsapp-processor.yaml` → WhatsAppProcessorFunction in cfn-backend.yaml

## Migration Date

June 21, 2026 - Migrated to unified deployment strategy as part of production readiness cleanup.
