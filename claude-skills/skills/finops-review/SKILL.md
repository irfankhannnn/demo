---
name: finops-review
description: >
  Review infrastructure changes for cost impact. Estimates monthly cost delta,
  identifies overprovisioning and optimization opportunities.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# FinOps Review

Review cost implications in: $ARGUMENTS

## Cost Heuristics (us-east-1 monthly)

| Resource | Approximate Cost |
|----------|-----------------|
| NAT Gateway | ~$32 + $0.045/GB |
| Lambda 512MB | ~$0.0000083/invocation |
| DynamoDB on-demand | $1.25/million WRU, $0.25/million RRU |
| RDS db.t3.micro | ~$15/month |
| ALB | ~$16 + LCU charges |
| CloudFront | $0.085/GB first 10TB |

## Checklist

- [ ] New resources cost-estimated
- [ ] Removed resources cost savings noted
- [ ] Overprovisioning flagged
- [ ] Spot/reserved capacity opportunities
- [ ] NAT Gateway alternatives (VPC endpoints)
- [ ] S3 lifecycle policies for cost

## Output

Save to `<output_dir>/finops.md` with estimated monthly delta.
