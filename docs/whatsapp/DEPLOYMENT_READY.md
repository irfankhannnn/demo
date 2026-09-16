# WhatsApp Platform — Deployment Ready

## Status: ✅ READY FOR FRESH DEPLOYMENT

All CloudFormation issues have been fixed and the environment is clean.

## What Was Fixed

### CloudFormation Template Issues (cfn-platform.yaml)
1. **ELB Account ID Mappings** — Added region-specific mappings for all AWS regions
2. **Circular Dependency** — Removed role ARN references from KMS key policy
3. **DynamoDB TTL** — Removed TTL from AttributeDefinitions (not a key attribute)
4. **Security Groups** — Added HTTPS (port 443) support to ALB security group
5. **DeletionPolicy** — Added proper deletion policies to all resources
6. **Dependencies** — Added explicit DependsOn for ALB Listener and ECS Service
7. **ALB Access Logs** — Disabled for now (can be enabled later with proper bucket policy)
8. **S3 Bucket Policy** — Added SessionStateBucket policy for secure access

### Deploy Script Fixes (deploy.sh)
1. **Unbound Variables** — Handle AWS_VPC_ID, AWS_VPC_CIDR, AWS_PRIVATE_SUBNET_IDS gracefully
2. **Error Handling** — Prevent script failure when optional variables are not set

### Environment Configuration (.env)
1. **AWS Infrastructure** — Added VPC ID, CIDR, and subnet IDs
2. **ECS Configuration** — Added task CPU, memory, and desired count
3. **CloudWatch** — Added log retention settings
4. **API Keys** — All required secrets configured

## Deployment Command

```bash
cd services/whatsapp-platform/infra
bash deploy.sh dev
```

## What Gets Created

- **ECS Cluster** — dev-whatsapp-platform
- **ECS Service** — 1 task (2 vCPU, 4GB RAM) with auto-scaling
- **ALB** — Internal load balancer on port 80
- **DynamoDB Table** — dev-devrealestate-flow-whatsapp-sessions (with TTL)
- **S3 Bucket** — devrealestate-flow-whatsapp-session-state (KMS encrypted)
- **KMS Key** — For S3 encryption
- **CloudWatch Logs** — 30-day retention
- **IAM Roles** — Task role and execution role with proper permissions
- **Security Groups** — ALB and ECS task security groups

## Expected Deployment Time

~5-10 minutes for CloudFormation stack creation

## Post-Deployment

1. Check ECS service status: `aws ecs describe-services --cluster dev-whatsapp-platform --services dev-whatsapp-platform --region ap-south-1`
2. Check ALB health: `aws elbv2 describe-target-health --target-group-arn <arn> --region ap-south-1`
3. View logs: `aws logs tail /aws/ecs/dev-whatsapp-platform --follow --region ap-south-1`

## Notes

- ALB access logs are disabled (can be enabled later)
- All resources use DeletionPolicy: Delete for dev environment (safe for cleanup)
- KMS key uses 7-day scheduled deletion (safe for dev)
- DynamoDB uses on-demand billing (no reserved capacity)
- Auto-scaling configured: 1-4 tasks based on CPU/memory

---

**Last Updated:** 2026-06-28
**Status:** Ready for deployment
