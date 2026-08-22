# Slice 2 — GSI + Query for Tenant Lookup

**Status: ✅ Code done, tested. Deploy pending (user-owned step).** The CFN change and the code switch from Scan to Query are both written and unit-tested against a mocked DynamoDB client. Actually deploying the CFN change, waiting for the index to report `ACTIVE`, and rolling the Lambdas out is the one remaining step, owned by the user per the original plan.

## What was found beyond the original plan

The original plan verified that `realestateflow-whatsapp-processor-role` (the WhatsApp processor Lambda's IAM role) already grants `Query`/`Scan` on `.../AgencyConfigTable/*`, covering the new GSI with no IAM change. **That check missed the other caller.** After Slice 1, `server/routes/webhooks.js` (served by the *main* API Lambda, under `ApiLambdaExecutionRole`) also calls the same shared `getTenantIdByConnectedWhatsAppPhone()` helper — and that role's DynamoDB policy grants `Query`/`Scan` on `/index/*` only for tables listed in a specific statement (mirroring `CrmTable`, `PropertiesTable`, etc.), and `AgencyConfigTable` was never in that list, since it never had an index before. Without this fix, switching to `QueryCommand` would have thrown `AccessDeniedException` for any call routed through the main API Lambda — a partial regression that only Slice 1's own dedup work made possible to hit (before Slice 1, `webhooks.js` had its own duplicate Scan-based resolver, now consolidated onto the shared helper).

**Fixed:** added `!Sub "${AgencyConfigTable.Arn}/index/*"` to `ApiLambdaExecutionRole`'s existing `Query`/`Scan`-on-index statement in `server/infra/cfn-backend.yaml`, alongside the already-present entries for the other tables.

## Why

After Slice 1, tenant resolution is down to one call site (`agencyConfigService.getTenantIdByConnectedWhatsAppPhone`), but it's still a full `ScanCommand` on `AgencyConfigTable` with a `FilterExpression` on `connectedWhatsAppPhone`:

```js
const result = await docClient.send(new ScanCommand({
  TableName: AGENCY_CONFIG_TABLE,
  ProjectionExpression: 'TenantId, connectedWhatsAppPhone',
  FilterExpression: 'connectedWhatsAppPhone = :phone',
  ExpressionAttributeValues: { ':phone': normalized },
}));
```

A Scan reads **every item in the table** and discards non-matches after reading — cost and latency grow with total tenant count, not with the size of the answer (one row). This runs on *every inbound WhatsApp message* that doesn't already carry a `tenantId` in its event payload, which today is most of them (the WhatsApp Platform integration doesn't send `tenantId`). As the number of agencies on the platform grows, this gets slower for everyone, not just the tenant being looked up.

Verified against `server/infra/cfn-backend.yaml`: **`AgencyConfigTable` has no GSI at all today** — only its `TenantId` hash key. So "switch to a Query" isn't a same-file code change; it requires adding an index first.

## What will change

### 1. Add a GSI in `server/infra/cfn-backend.yaml`

Following the existing GSI pattern used elsewhere in the same file (e.g. `CreditsTable`'s `GSI1`, and the `tenant-index`/`status-index` pattern used on other tables):

```yaml
AgencyConfigTable:
  Type: AWS::DynamoDB::Table
  Properties:
    # ...existing config...
    AttributeDefinitions:
      - AttributeName: TenantId
        AttributeType: S
      - AttributeName: connectedWhatsAppPhone   # new
        AttributeType: S                         # new
    KeySchema:
      - AttributeName: TenantId
        KeyType: HASH
    GlobalSecondaryIndexes:
      - IndexName: connectedWhatsAppPhone-index
        KeySchema:
          - AttributeName: connectedWhatsAppPhone
            KeyType: HASH
        Projection:
          ProjectionType: INCLUDE
          NonKeyAttributes:
            - TenantId
```

Notes:
- `connectedWhatsAppPhone` isn't guaranteed unique-and-present on every item (only agencies that have connected WhatsApp have it set), which is fine for a GSI hash key — items missing the attribute simply don't appear in the index.
- `INCLUDE` projection with just `TenantId` keeps the index minimal, matching what the query actually needs (mirrors the `ProjectionExpression: 'TenantId, connectedWhatsAppPhone'` the current Scan already limits itself to).
- IAM: the `WhatsAppProcessorRole` (and whatever role backs `agencyConfigService.js`'s Lambda contexts) already grants generic DynamoDB actions on the table's ARN pattern (`.../AgencyConfigTable*`, which covers `.../index/*`) — verified this covers GSI queries with no separate grant needed, but re-check at implementation time in case the ARN pattern is narrower than expected.

### 2. Wait for the index to backfill

Adding a GSI to an existing table backfills automatically but isn't instant. Query traffic must not be pointed at the new index until AWS reports it `ACTIVE` — querying during backfill silently returns incomplete results (a message from a very recently connected number might not resolve). This needs a deploy → wait → verify step, not a deploy-and-immediately-switch-code step.

### 3. Switch the query in `agencyConfigService.js`

```js
// Before (Scan):
const result = await docClient.send(new ScanCommand({
  TableName: AGENCY_CONFIG_TABLE_NAME,
  ProjectionExpression: 'TenantId, connectedWhatsAppPhone',
  FilterExpression: 'connectedWhatsAppPhone = :phone',
  ExpressionAttributeValues: { ':phone': normalized },
}));

// After (Query against the new GSI):
const result = await docClient.send(new QueryCommand({
  TableName: AGENCY_CONFIG_TABLE_NAME,
  IndexName: 'connectedWhatsAppPhone-index',
  KeyConditionExpression: 'connectedWhatsAppPhone = :phone',
  ExpressionAttributeValues: { ':phone': normalized },
}));
```

Same return shape (`result.Items?.[0]?.TenantId`), so the calling code in `whatsapp-message-processor.js` and `server/routes/webhooks.js` (both of which already go through this one helper after Slice 1) needs no changes at all.

## How it was tested (code-level) / how to finish verifying (deploy-level)

1. **Unit test — done.** New file `server/agencyConfigService.test.js`, mocking `@aws-sdk/lib-dynamodb`'s `DynamoDBDocumentClient.from` directly (no existing test in this repo mocked the AWS SDK this way, so this establishes the pattern). Three tests: asserts a `QueryCommand` (not `ScanCommand`) is issued with `IndexName: 'connectedWhatsAppPhone-index'` and the correct `KeyConditionExpression`; asserts an empty/invalid phone returns `null` without calling DynamoDB at all; asserts no match returns `null`. All pass.
2. **Regression — done.** Re-ran `server/scripts/whatsapp-message-processor.test.js` (Slice 1) — passes unchanged, confirming the processor doesn't care how the helper resolves a tenant internally, exactly as predicted.
3. **Deploy verification (non-prod first) — pending, user-owned:**
   - Deploy the CFN change to a dev/staging stack.
   - Confirm via AWS CLI or console: `IndexStatus: ACTIVE` and backfill complete, e.g. `aws dynamodb describe-table --table-name <table> --query 'Table.GlobalSecondaryIndexes'`.
   - Run a real lookup for a known connected number and confirm it resolves the same `TenantId` the Scan-based version would have.
   - Specifically exercise a request through `server/routes/webhooks.js` (the main API Lambda), not just the WhatsApp processor Lambda — that's the path the IAM gap above would have broken.
4. **Latency sanity check — pending, user-owned:** compare CloudWatch Lambda duration before/after rollout for messages hitting the `!tenantId && to` branch.

## Explicitly out of scope for this slice

- No changes to `whatsapp-message-processor.js` itself (Slice 1 already made it call through the one shared helper — this slice only changes what that helper does internally).
- No archive/delete tool work (Slices 3–5).
- Rollout should happen in staging first, with the "wait for ACTIVE + Backfilling: false" gate treated as non-negotiable — this mirrors the same gate the proposal already requires for the (much larger) DynamoDB Vector Search work in [`../05-retrieval-and-vector-search.md`](../05-retrieval-and-vector-search.md), for the same reason: querying a backfilling index returns wrong answers with no error.
