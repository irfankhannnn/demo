---
name: database-review
description: >
  Review DynamoDB table and index changes in CloudFormation and the
  *DynamodbService* access-pattern code: replacement risk, the one-GSI-per-update
  limit, TENANT# isolation, and scan/query cost. This repo has no SQL database.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# Database Review

Review data-layer changes in: $ARGUMENTS

Data layer: DynamoDB only. About 35 tables, all `PAY_PER_REQUEST`, defined in CloudFormation (for example `agency-app/api/infra/launch-tables-cfn.yaml`) and accessed through `*DynamodbService*.js`. Partition keys carry a `TENANT#<tenantId>` prefix. No SQL, no ORM, no migration framework. CRM data is never deleted; archive instead.

## Schema checklist (CloudFormation)

- [ ] **Replacement:** any change to `TableName`, `KeySchema` or a key `AttributeDefinition` replaces the table. Critical unless `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain` are both set **and** a backfill is documented
- [ ] **One GSI per stack update** — two GSIs added to one table in a single diff will fail the update
- [ ] A new GSI backfills asynchronously; a reader shipped in the same release sees partial data
- [ ] Projection type justified (`ALL` duplicates the whole item into the index)
- [ ] `BillingMode` unchanged, or a switch to `PROVISIONED` paired with auto-scaling
- [ ] `PointInTimeRecoverySpecification` not removed
- [ ] A new `TimeToLiveSpecification` on a CRM table conflicts with the never-delete rule
- [ ] `StreamSpecification` change has a matching consumer

## Access-pattern checklist (code)

- [ ] `TENANT#` prefix preserved in every key built, parsed or queried; dropping it is cross-tenant access
- [ ] No new `ScanCommand`, and no `QueryCommand` whose `FilterExpression` does the real filtering
- [ ] Pagination handles `LastEvaluatedKey` with a page cap
- [ ] `BatchWriteItem` (25 items) and `BatchGetItem` (100 items) limits respected, unprocessed items retried
- [ ] No `ConsistentRead: true` against a GSI
- [ ] Conditional writes used where a blind `PutItem` would drop fields
- [ ] Reserved words handled with `ExpressionAttributeNames`

## Output

Save to `<output_dir>/database.md` with the schema-change table, the replacement and rollback assessment, and the findings.
