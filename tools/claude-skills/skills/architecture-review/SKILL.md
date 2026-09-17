---
name: architecture-review
description: >
  Review CloudFormation infrastructure changes against the AWS Well-Architected
  pillars and this repo's CFN conventions. CloudFormation is the only IaC here:
  no Terraform, CDK, Pulumi, SAM or Serverless Framework.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# Architecture Review

Review infrastructure changes in: $ARGUMENTS

Stack: AWS `ap-south-1`, Lambda + API Gateway + DynamoDB + S3/CloudFront, one ECS Fargate service (`services/whatsapp-platform`). Templates live at `<app-or-service>/infra/*.yaml`, the shared VPC at `infra/cicd/common-infra/vpc-networking.yaml`. Deploys are manual: `infra/cicd/<service>/deploy.sh <dev|prod>`.

## Checklist

- [ ] New / modified / removed resources listed, with `old -> new` for each changed property
- [ ] **No replacement-forcing change on a stateful resource** — `TableName`, `KeySchema`, `BucketName`, `UserPoolName`, `RestApi` `Name`. If one is unavoidable, both `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain` are set and a backfill is documented
- [ ] Env-first physical naming: `${EnvironmentName}-realestateflow-...`, no hardcoded `dev-` or `prod-`
- [ ] `AWS::ApiGateway::BasePathMapping` onto the shared custom domain (`services-api.realestateflow.in` for prod, `services-api.cloudberrysolutions.in` for dev), parameter-driven and condition-gated; no raw `execute-api` URL published to callers
- [ ] IAM policies least-privilege; no `Action: "*"`, `Resource: "*"` or wildcard `iam:PassRole`
- [ ] Encryption at rest and in transit; S3 public-access block and versioning; DynamoDB PITR
- [ ] Deprecated or invalid CloudFormation properties; `!Ref` and `!GetAtt` targets resolve
- [ ] Cost-allocation tags present
- [ ] Cross-stack dependency introduced? Name the required deploy order, since each service deploys separately
- [ ] Not present in this repo, so flag as a new platform decision rather than a routine change: Terraform, CDK, Pulumi, SAM, Serverless Framework, Kubernetes, Helm

Defer the full pre-deploy gate to `.claude/agents/cfn-readiness-auditor.md` and cite it. Review the delta only.

## Output

Save findings to `<output_dir>/architecture.md` with Finding / Resource / File:line / Pillar / Risk / Recommendation.
