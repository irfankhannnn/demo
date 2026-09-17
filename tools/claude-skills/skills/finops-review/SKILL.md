---
name: finops-review
description: >
  Review infrastructure and code changes for cost impact on this stack.
  Estimates a monthly delta in ap-south-1 across Lambda, API Gateway, DynamoDB
  on-demand, Fargate, NAT gateways, CloudFront, CloudWatch and vendor APIs.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# FinOps Review

Review cost implications in: $ARGUMENTS

## Cost heuristics — ap-south-1, approximate, reconfirm before quoting

| Resource | Approximate cost |
|---|---|
| NAT Gateway | ~$0.056/hour, about $41/month each, plus ~$0.056/GB processed. Three exist in `infra/cicd/common-infra/vpc-networking.yaml` |
| Lambda | ~$0.0000166667 per GB-second, plus ~$0.20 per million requests. A 512 MB function costs about $0.0000083 per **second** of execution, not per invocation |
| API Gateway (REST) | ~$3.50 per million requests, plus data out |
| DynamoDB on-demand | ~$1.25 per million write request units, ~$0.25 per million read request units, ~$0.25/GB-month storage. A GSI duplicates the writes it receives |
| ECS Fargate | ~$0.04656 per vCPU-hour and ~$0.00511 per GB-hour, multiplied by `DesiredCount` and hours |
| ALB | ~$16-20/month plus LCU charges. Used only by `services/whatsapp-platform` |
| CloudFront | ~$0.109/GB out for the India price class, plus request charges |
| CloudWatch Logs | ~$0.57/GB ingested, ~$0.03/GB-month stored. No `RetentionInDays` means stored forever |
| Vendor APIs | Bedrock/Gemini tokens, ElevenLabs TTS minutes, Exotel call minutes, WhatsApp template messages. Usually the dominant variable cost |

No RDS, OpenSearch, Kubernetes, EC2, spot or reserved capacity exists in this repo.

## Checklist

- [ ] New resources cost-estimated, with the volume assumption stated
- [ ] Removed resources credited
- [ ] Lambda `MemorySize`, `Timeout`, reserved or provisioned concurrency change priced
- [ ] Fargate `Cpu`, `Memory`, `DesiredCount` and scaling floor change priced
- [ ] New NAT gateway flagged; VPC endpoints for S3 and DynamoDB considered
- [ ] New GSI or `ProjectionType: ALL` write amplification noted
- [ ] Every new log group has `RetentionInDays`
- [ ] New per-request LLM, TTS, call or WhatsApp spend flagged with its per-lead or per-message unit cost
- [ ] A fixed cost turned into a variable cost that scales with usage, called out even at today's near-zero volume

## Output

Save to `<output_dir>/finops.md` with the estimated monthly delta, the resource table, and the assumption behind each number.
