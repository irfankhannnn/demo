---
name: architecture-review
description: >
  Review CloudFormation, Terraform, CDK, Pulumi, SAM infrastructure changes
  against AWS Well-Architected Framework. Maps findings to OE, Security,
  Reliability, Performance, Cost, Sustainability pillars.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# Architecture Review

Review infrastructure changes in: $ARGUMENTS

## Checklist

- [ ] New/modified/removed AWS resources identified
- [ ] IAM policies reviewed for least privilege
- [ ] Encryption at rest and in transit configured
- [ ] Multi-AZ / backup / failover for stateful resources
- [ ] Deprecated CloudFormation properties flagged
- [ ] Cost allocation tags present
- [ ] Deletion protection on production resources

## Output

Save findings to `<output_dir>/architecture.md` with Finding/Risk/Recommendation format.
