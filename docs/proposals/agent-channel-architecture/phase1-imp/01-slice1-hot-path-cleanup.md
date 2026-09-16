# Slice 1 — Hot-Path Cleanup

**Status: ✅ Done.** Branch `auth_rbac_feature`.

## Why

Every inbound WhatsApp message runs through `apps/crm/server/scripts/whatsapp-message-processor.js` before a reply goes out. Two things on that path were pure overhead:

1. **Two "debug connectivity" fetches** ran on every single reply, right before sending it: a request to `https://www.google.com` and a request to the Bailey ALB's `/health` endpoint, each with a 5-second abort timeout. Both were fire-and-forget — wrapped in try/catch, their results only ever `console.log`ged, never read by any other code. Worst case (both time out): **up to ~10 seconds of added latency per message**, for zero functional value. This is exactly the kind of thing a user feels as "the WhatsApp bot is slow to reply" without any visible cause.
2. **Tenant resolution ran its own inline DynamoDB `Scan`**, duplicating a helper that already existed. `apps/crm/server/agencyConfigService.js` already exports `getTenantIdByConnectedWhatsAppPhone(phone)` — same table, same filter, same Scan — and its own docstring even (incorrectly) claimed the processor already used it. Two copies of the same query is how logic drifts: a fix applied to one stops covering the other. `apps/crm/server/routes/webhooks.js` was already calling the shared helper; the processor was the odd one out.

Both were verified against the live code (not just the design doc) before touching anything — see the verification notes in [`../README.md`](../README.md) and [`../01-diagnosis.md`](../01-diagnosis.md).

This slice fixes both, with **zero change to what a user sees** and **zero infrastructure or schema changes** — it's pure deletion plus a refactor to an existing function. That's what makes it safe to build first: nothing downstream (the tool loop, channel-aware compose, web chat) is worth building on top of a hot path that's still carrying dead weight.

## What changed

File: `apps/crm/server/scripts/whatsapp-message-processor.js`

### 1. Removed the two debug fetches

**Before** (inside the Bailey-enabled reply branch, immediately before sending the reply):

```js
// Connectivity test: try fetching google.com with 5s timeout
try {
  const testController = new AbortController();
  const testTimeoutId = setTimeout(() => testController.abort(), 5000);
  const testResp = await fetch('https://www.google.com', { signal: testController.signal });
  clearTimeout(testTimeoutId);
  console.log('whatsapp.processor.connectivity_test', JSON.stringify({ status: testResp.status, ok: testResp.ok }));
} catch (testErr) {
  console.log('whatsapp.processor.connectivity_test_failed', JSON.stringify({ error: testErr.message, name: testErr.name }));
}

// Connectivity test: try fetching ALB health with 5s timeout
try {
  const albController = new AbortController();
  const albTimeoutId = setTimeout(() => albController.abort(), 5000);
  const albResp = await fetch(`${process.env.BAILEY_API_ENDPOINT}/health`, { signal: albController.signal });
  clearTimeout(albTimeoutId);
  console.log('whatsapp.processor.alb_health_check', JSON.stringify({ status: albResp.status, ok: albResp.ok }));
} catch (albErr) {
  console.log('whatsapp.processor.alb_health_check_failed', JSON.stringify({ error: albErr.message, name: albErr.name }));
}

const chunkResult = await sendWhatsAppMessageChunks(replyTo, replyText, null, to);
```

**After:**

```js
const chunkResult = await sendWhatsAppMessageChunks(replyTo, replyText, null, to);
```

Nothing replaces this — it was dead weight, not a guard protecting anything. `BAILEY_API_ENDPOINT` is still read elsewhere (in `apps/crm/server/bailey.js`, where the actual send happens), so nothing else references the removed usage.

### 2. Deduplicated tenant resolution

**Before** — the processor built its own DynamoDB client and ran its own Scan:

```js
const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = await import('@aws-sdk/lib-dynamodb');
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' }));
const AGENCY_CONFIG_TABLE = process.env.AGENCY_CONFIG_DYNAMODB_TABLE_NAME || 'cloudberry-dev-real-estate-agencies';

async function resolveTenantByWhatsAppNumber(toNumber) {
  if (!toNumber) return null;
  const normalized = normalizeWhatsAppPhone(toNumber);
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: AGENCY_CONFIG_TABLE,
      ProjectionExpression: 'TenantId, connectedWhatsAppPhone',
      FilterExpression: 'connectedWhatsAppPhone = :phone',
      ExpressionAttributeValues: { ':phone': normalized },
    }));
    return result.Items?.[0]?.TenantId || null;
  } catch (err) {
    logger.warn('whatsapp.processor.tenant_lookup.failed', { error: err.message, toNumber: normalized });
    return null;
  }
}

// ...later...
if (!tenantId && to) {
  tenantId = await resolveTenantByWhatsAppNumber(to);
}
```

**After** — delegates to the existing shared helper, wrapped in the same graceful-degradation try/catch the inline version had (so a lookup failure still skips just that one message instead of throwing and forcing an EventBridge retry of the whole record):

```js
const { getAgencyConfig, getTenantIdByConnectedWhatsAppPhone } = await import('../agencyConfigService.js');

// ...later...
if (!tenantId && to) {
  try {
    tenantId = await getTenantIdByConnectedWhatsAppPhone(to);
  } catch (err) {
    logger.warn('whatsapp.processor.tenant_lookup.failed', { error: err.message, to });
    tenantId = null;
  }
}
```

This is **not yet a performance fix** — `getTenantIdByConnectedWhatsAppPhone` still runs a Scan under the hood today, same as before. What it fixes is duplication: there is now exactly one place that resolves a tenant from a WhatsApp number, which is what makes Slice 2 (swap that one call site to a Query, once a GSI exists) a small, isolated change instead of a two-places-at-once change.

### One subtlety worth calling out

The shared helper (`agencyConfigService.js`) does not itself catch errors — it lets DynamoDB failures propagate. The inline version the processor used to have caught its own errors and returned `null`, letting the message get skipped gracefully (`skip_missing_tenant`) rather than throwing. To keep that same "degrade gracefully" behavior, the call site got its own try/catch (shown above) rather than assuming the shared helper's error behavior matched. This was caught by writing the test in the next section *before* assuming "swap the call and done" — worth flagging because it's the kind of small mismatch that a design doc reasonably doesn't capture but a real implementation has to.

## How it was tested

New file: `apps/crm/server/scripts/whatsapp-message-processor.test.js` (this file had **zero** test coverage before this slice). All collaborators (`bailey.js`, `whatsappConversationService.js`, `agencyConfigService.js`, `whatsappAccessControl.js`, `userCategoryService.js`, `conversationStateService.js`, `agents/agentRuntime.js`) are mocked via `jest.unstable_mockModule` — the test never touches DynamoDB, WhatsApp, or the network.

Four tests:

1. **`never calls fetch ... when sending a reply`** — runs a full happy-path message through `handler()` with a real reply send, and asserts `global.fetch` (replaced with a `jest.fn()` for the test) is never called at all. This is the direct regression guard for the debug-fetch removal — if either probe were reintroduced, this fails.
2. **`resolves tenantId via agencyConfigService.getTenantIdByConnectedWhatsAppPhone, not an inline Scan`** — sends an event with no `tenantId` (only a `to` number), asserts the mocked shared helper is called with that number, and that its return value flows through to `getAgencyConfig`, `claimMessageProcessing`, and the final result — proving the resolved tenant is actually used, not just looked up and discarded.
3. **`degrades gracefully ... if tenant lookup throws`** — makes the mocked helper reject, and asserts the handler still resolves (doesn't throw/crash the Lambda invocation) and logs a `tenant_lookup.failed` warning — the behavior-preservation check for the subtlety above.
4. **`source no longer contains the removed debug-fetch / inline-Scan code`** — reads the actual source file as text and asserts it no longer contains `google.com`, `/health`, `ScanCommand`, or `connectivity_test`. A blunt but cheap guard against silent reintroduction (e.g. a bad merge) that doesn't depend on the behavioral tests catching it.

Run just this file:

```bash
cd server
node --experimental-vm-modules node_modules/jest/bin/jest.js scripts/whatsapp-message-processor.test.js
```

## Verification result

| Check | Result |
|---|---|
| New test file (4 tests) | ✅ All pass |
| `agents/agentRuntime.test.js` (36 tests, closest existing coverage to this pipeline) | ✅ All pass, no regression |
| `agents/goldenConversations.test.js` (reply-formatting regression suite) | ✅ All pass, no regression |
| Full server suite (`npm test`) | 511/523 pass. **12 pre-existing failures** in `skillInvoker.test.js`, `agents/responseFormatter.test.js`, `normalizers/leadTextNormalizer.test.js` — confirmed via `git stash` that these fail identically with this slice's change removed, so they predate this work and are out of scope for this slice. |
| Manual check: `BAILEY_API_ENDPOINT` still referenced correctly elsewhere | ✅ Only used in `apps/crm/server/bailey.js`, unaffected by this change |

The 12 pre-existing failures are `toHaveBeenCalledWith` argument-shape mismatches (e.g. `skillInvoker.test.js` expecting `deleteProperty(tenantId, propertyId)` but the mock recording zero calls, and `getCRMMetrics` being called with an extra `{}` argument the test doesn't expect) — they look like test/implementation drift unrelated to anything touched here, and are worth a separate, dedicated look rather than folding a fix into this slice.

## Explicitly out of scope for this slice

- **No GSI, no CFN change, no deploy.** Tenant resolution is still a Scan today — just one Scan instead of two. See Slice 2.
- **No archive/delete tool changes.** See Slices 3–5.
- **No eval set.** See Slice 6 — sourcing real Hinglish utterances needs its own decision before that work starts.
- **No fix to the 12 pre-existing test failures** found during full-suite verification — flagged, not fixed, since they're unrelated to this slice's change.
