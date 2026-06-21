# Obsolete Infrastructure Files

This folder contains infrastructure files that are no longer used for the one-click deployment of RealEstateFlow.

## Files

| File | Original Purpose | Why Obsolete |
|------|-----------------|--------------|
| `deploy-crons.sh` | Deployed the 9 separate cron CloudFormation stacks | All 10 cron jobs are now merged into `cfn-backend.yaml` and deployed by `../deploy.sh` |
| `missing-routes-cfn.yaml` | Documented 24 missing API Gateway routes | Routes have been added to `../apigw-explicit-routes.yaml` |
| `missing-routes-patch.yaml` | Auto-generated patch resources for the 24 missing routes | Patch was never applied; routes now exist in `../apigw-explicit-routes.yaml` |

## When to Delete

> **Safe to delete after:** production deployment, all 10 cron Lambdas verified working, and no rollback needed for 7+ days.

These files are kept temporarily as a safety net in case the new unified deployment needs to be reverted or compared. Once the system is stable, this entire `obsolete/` folder can be removed.

## Current Deployment

```bash
cd server/infra
./deploy.sh
```

This single command deploys:
- Main API Lambda + 2 API Gateways
- All 10 cron Lambdas with EventBridge rules
- All DynamoDB tables
- All IAM roles with scoped permissions
- S3 document bucket

For details, see `../deploy.sh` and `../cfn-backend.yaml`.
