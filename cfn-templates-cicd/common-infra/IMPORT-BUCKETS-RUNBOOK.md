# Importing the shared S3 buckets into `prod-realestateflow-networking-common`

Run these yourself — my Bash access to AWS write/mutating calls is blocked by
the auto-mode classifier in this session (confirmed: `Bash(aws s3api *)` is
already allowed in `.claude/settings.local.json`, so this isn't a permissions
file issue — the classifier blocks state-changing cloud calls independent of
that file). All commands assume you're in the repo root with AWS CLI v2 and
`--profile cloudberry-prod-new --region ap-south-1`.

## Why two phases

`realestate-flow-lambda-packages-prod` and `realestate-flow-cfn-templates`
already exist (created out-of-band, already hold real objects from earlier
deploy attempts). CloudFormation Import requires the properties in the
template to match the resource's *current* live state at import time — you
can't import and change properties in the same operation. So:

- **Phase 1** imports both buckets as-is (their properties today: no
  versioning, default SSE, public access blocked) using a stripped-down
  template — no versioning/lifecycle/bucket-policy in it yet.
- **Phase 2** is a normal stack update using the real, final
  `vpc-networking.yaml` (already written, includes versioning, a 90-day
  noncurrent-version expiration, and a deny-insecure-transport bucket
  policy) — normal updates aren't subject to the "must match current state"
  restriction.

Every parameter below is passed explicitly (not `UsePreviousValue`, to make
the exact values visible for review) — pulled from
`aws cloudformation describe-stacks` on the live stack on 2026-08-27. Double
check `NatGatewayStrategy=SingleShared` and `AzCount=2` in particular before
running — getting either wrong here would provision (or tear down) real NAT
gateways.

## Phase 1 — import

```bash
aws cloudformation create-change-set \
  --profile cloudberry-prod-new --region ap-south-1 \
  --stack-name prod-realestateflow-networking-common \
  --change-set-name import-shared-buckets \
  --change-set-type IMPORT \
  --template-body file://cfn-templates-cicd/common-infra/vpc-networking-IMPORT-PHASE.yaml \
  --resources-to-import '[
    {"ResourceType":"AWS::S3::Bucket","LogicalResourceId":"ArtifactBucket","ResourceIdentifier":{"BucketName":"realestate-flow-lambda-packages-prod"}},
    {"ResourceType":"AWS::S3::Bucket","LogicalResourceId":"CfnTemplatesBucket","ResourceIdentifier":{"BucketName":"realestate-flow-cfn-templates"}}
  ]' \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=prod \
    ParameterKey=VpcCidr,ParameterValue=10.0.0.0/16 \
    ParameterKey=AzCount,ParameterValue=2 \
    ParameterKey=NatGatewayStrategy,ParameterValue=SingleShared \
    ParameterKey=PublicSubnet1Cidr,ParameterValue=10.0.0.0/24 \
    ParameterKey=PublicSubnet2Cidr,ParameterValue=10.0.1.0/24 \
    ParameterKey=PublicSubnet3Cidr,ParameterValue=10.0.2.0/24 \
    ParameterKey=PrivateAppSubnet1Cidr,ParameterValue=10.0.10.0/23 \
    ParameterKey=PrivateAppSubnet2Cidr,ParameterValue=10.0.12.0/23 \
    ParameterKey=PrivateAppSubnet3Cidr,ParameterValue=10.0.14.0/23 \
    ParameterKey=PrivateDbSubnet1Cidr,ParameterValue=10.0.20.0/24 \
    ParameterKey=PrivateDbSubnet2Cidr,ParameterValue=10.0.21.0/24 \
    ParameterKey=PrivateDbSubnet3Cidr,ParameterValue=10.0.22.0/24 \
    ParameterKey=AppIngressPort,ParameterValue=3000 \
    ParameterKey=DatabasePort,ParameterValue=5432 \
    ParameterKey=CachePort,ParameterValue=6379 \
    ParameterKey=FlowLogRetentionDays,ParameterValue=90 \
    ParameterKey=ArtifactBucketName,ParameterValue=realestate-flow-lambda-packages-prod \
    ParameterKey=CfnTemplatesBucketName,ParameterValue=realestate-flow-cfn-templates

# Review before executing — Action should show "Import" for both buckets
# and NOTHING else changing:
aws cloudformation describe-change-set \
  --profile cloudberry-prod-new --region ap-south-1 \
  --stack-name prod-realestateflow-networking-common \
  --change-set-name import-shared-buckets \
  --query "Changes[].ResourceChange.{Action:Action,Logical:LogicalResourceId,Type:ResourceType}" \
  --output table

# Only if that looks right:
aws cloudformation execute-change-set \
  --profile cloudberry-prod-new --region ap-south-1 \
  --stack-name prod-realestateflow-networking-common \
  --change-set-name import-shared-buckets

aws cloudformation wait stack-import-complete \
  --profile cloudberry-prod-new --region ap-south-1 \
  --stack-name prod-realestateflow-networking-common
```

If `create-change-set` fails with a property-mismatch error, paste it back to
me — it means one of the two buckets has a live setting `vpc-networking-IMPORT-PHASE.yaml`
doesn't account for (e.g. a lifecycle rule already present) and the minimal
template needs adjusting.

## Phase 2 — apply versioning, lifecycle, and the bucket policy

```bash
aws cloudformation create-change-set \
  --profile cloudberry-prod-new --region ap-south-1 \
  --stack-name prod-realestateflow-networking-common \
  --change-set-name add-bucket-hardening \
  --template-body file://cfn-templates-cicd/common-infra/vpc-networking.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=prod \
    ParameterKey=VpcCidr,ParameterValue=10.0.0.0/16 \
    ParameterKey=AzCount,ParameterValue=2 \
    ParameterKey=NatGatewayStrategy,ParameterValue=SingleShared \
    ParameterKey=PublicSubnet1Cidr,ParameterValue=10.0.0.0/24 \
    ParameterKey=PublicSubnet2Cidr,ParameterValue=10.0.1.0/24 \
    ParameterKey=PublicSubnet3Cidr,ParameterValue=10.0.2.0/24 \
    ParameterKey=PrivateAppSubnet1Cidr,ParameterValue=10.0.10.0/23 \
    ParameterKey=PrivateAppSubnet2Cidr,ParameterValue=10.0.12.0/23 \
    ParameterKey=PrivateAppSubnet3Cidr,ParameterValue=10.0.14.0/23 \
    ParameterKey=PrivateDbSubnet1Cidr,ParameterValue=10.0.20.0/24 \
    ParameterKey=PrivateDbSubnet2Cidr,ParameterValue=10.0.21.0/24 \
    ParameterKey=PrivateDbSubnet3Cidr,ParameterValue=10.0.22.0/24 \
    ParameterKey=AppIngressPort,ParameterValue=3000 \
    ParameterKey=DatabasePort,ParameterValue=5432 \
    ParameterKey=CachePort,ParameterValue=6379 \
    ParameterKey=FlowLogRetentionDays,ParameterValue=90 \
    ParameterKey=ArtifactBucketName,ParameterValue=realestate-flow-lambda-packages-prod \
    ParameterKey=CfnTemplatesBucketName,ParameterValue=realestate-flow-cfn-templates

# Review — expect Modify on ArtifactBucket/CfnTemplatesBucket (adding
# versioning/lifecycle) and Add on the two *BucketPolicy resources. Nothing
# else (VPC/subnets/SGs/NAT) should show as changing:
aws cloudformation describe-change-set \
  --profile cloudberry-prod-new --region ap-south-1 \
  --stack-name prod-realestateflow-networking-common \
  --change-set-name add-bucket-hardening \
  --query "Changes[].ResourceChange.{Action:Action,Logical:LogicalResourceId,Type:ResourceType,Replacement:Replacement}" \
  --output table

# Only if nothing unexpected shows Replacement=True:
aws cloudformation execute-change-set \
  --profile cloudberry-prod-new --region ap-south-1 \
  --stack-name prod-realestateflow-networking-common \
  --change-set-name add-bucket-hardening
```

## After both phases

```bash
aws s3api get-bucket-versioning --profile cloudberry-prod-new --bucket realestate-flow-lambda-packages-prod
aws s3api get-bucket-versioning --profile cloudberry-prod-new --bucket realestate-flow-cfn-templates
```
Both should now report `"Status": "Enabled"`.
