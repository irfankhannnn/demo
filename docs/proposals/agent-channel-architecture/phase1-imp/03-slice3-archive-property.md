# Slice 3 — `archive_property` (Proof of Concept)

**Status: ✅ Done, tested.** Independent of Slice 2 (no infra dependency). This slice validated the archive-tool pattern on the one entity that was cheapest to convert, before repeating it 7 more times in Slice 4 and removing `delete_property` in Slice 5.

## Why

The proposal's target architecture ([`../02-target-architecture.md`](../02-target-architecture.md) §"Deletes stay out of AI reach") wants the 8 `delete_*` tools gone from what the AI agent can call, replaced with reversible `archive_*` tools — because an LLM-driven agent hard-deleting a CRM record on a misread instruction is unrecoverable, while an agent flipping a status field is a one-line undo.

Verified against the actual entity schemas (`agency-app/api/crmDynamodbService.js`): of the 8 delete-able entities, **only `property` already had an `archived` value in its status enum** (`PROPERTY_STATUS_ENUM` in `agency-app/api/shared/toolDefinitions.js`: `['not-listed', 'for-sale', 'for-rent', 'rented', 'sold', 'archived']`), and `update_property` already exposed that enum to the tool layer. Every other entity needed either a new enum value or, for `contact` and `property_document`, a new stored field entirely (see Slice 4).

That made `property` the correct one to build **first**: it proved the pattern with zero schema-design risk, so Slice 4's 7 remaining entities repeated a proven shape rather than inventing one under time pressure.

## What changed

### 1. `archive_property` in `agency-app/api/shared/toolDefinitions.js`

The actual tool definitions in this file use a flat `parameters: [{name, type, required, enum, description}, ...]` array, not a JSON-schema `input: {type:'object', properties:...}` shape (an earlier draft of this doc guessed the wrong shape before the file was actually read — corrected here). Modeled directly on the existing `update_property` tool:

```js
{
  name: 'archive_property',
  category: 'property',
  readOnly: false,
  descriptions: {
    internal: 'Archive a property (soft-remove, reversible). Sets status to archived; does not delete the record. Triggers: "archive property", "stop showing this property", "hide this property", "delete property" (there is no delete tool -- archive is the correct action for stopping tracking of a listing).',
    mcp: 'Archive a property by setting its status to archived. Reversible via update_property.',
  },
  handler: 'archiveProperty',
  parameters: [
    { name: 'propertyId', type: 'string', required: true, description: 'The unique ID of the property to archive.' },
  ],
},
```

Note the `"delete property"` trigger phrase deliberately added to the description: once Slice 5 removed `delete_property` entirely, the model needed to be told explicitly that a user saying "delete" should map to `archive_property`, not fail to find a matching tool.

### 2. `archiveProperty` in `agency-app/api/crmDynamodbService.js`

```js
export async function archiveProperty(tenantId, propertyId) {
  return updateProperty(tenantId, propertyId, { status: 'archived' });
}
```

Verified `updateProperty`'s internal status-transition guard (`isValidPropertyStatusTransition` in `agency-app/api/domain/crmDomainModel.js`) before writing this: it only rejects transitions to *unknown* statuses, and `'archived'` was already a member of `ALL_PROPERTY_STATUSES` — so this one-line delegation works correctly from any current property status with no further changes needed. This reuses `updateProperty`'s existing validation, GSI2 bookkeeping, and area/timeline sync rather than duplicating any of it.

### 3. `delete_property`

Kept alongside `archive_property` in this slice, as planned — removed in Slice 5 once all 8 entities had their archive replacement.

### 4. `reality-flow-mcp` awareness

Also as planned: not edited in this slice. It was edited as part of Slice 5's interim fix (see that doc) rather than waiting for the full Phase 6 registry-generation work.

## How it was tested

1. **`validateToolDefinitions()` startup guard** — passes; confirms `archiveProperty` resolves to a real exported function on `crmDynamodbService`.
2. **Tool dispatch test** in `skillInvoker.test.js`: `archive_property calls archiveProperty` — asserts `invokeSkill(tenantId, 'archive_property', {propertyId})` calls `crm.archiveProperty(tenantId, propertyId)` with the id unpacked correctly (not the whole input object — this required a corresponding fix to `isEntityIdLookupTool()` in `skillInvoker.js` to recognize the `archive_` prefix the same way it already recognized `get_`/`delete_`, since without it every archive tool would have hit the wrong dispatch branch; see [`05-slice5-remove-delete-tools.md`](05-slice5-remove-delete-tools.md) for the full story).
3. **Full test suite** — green, no regression (see the cross-slice verification summary in [`05-slice5-remove-delete-tools.md`](05-slice5-remove-delete-tools.md), since Slices 3–5 were verified together as one continuous pass).

An agent-level golden-conversation test and a real, non-mocked "does `archiveProperty` actually flip the DynamoDB status field" integration test were both considered and deliberately **not** added — see the reasoning in the retrospective note below.

### Testing-scope retrospective (why no full DynamoDB-mocked integration test)

`updateProperty` (which `archiveProperty` delegates to) is a large function with real side effects beyond the status field — it calls `getOrCreateArea()`, conditionally `incrementAreaPropertyCount()`, and unconditionally `syncPropertyContactTimeline()`. Building a faithful integration test would mean mocking all of those transitively, for a one-line delegating wrapper that has effectively zero independent logic of its own. Since ES module internals can't be spied on the way CommonJS sometimes allows (calling `updateProperty` from inside `archiveProperty` binds directly, not through an interceptable export), the only way to verify "archiveProperty calls updateProperty with exactly `{status:'archived'}`" *at the DynamoDB level* is the full transitive mock. Given `updateProperty` itself has no existing dedicated unit test in this codebase either, holding a one-line wrapper to a stricter standard than the function it wraps didn't seem proportionate. The dispatch-level test plus code review is the right amount of verification here.

## Explicitly out of scope for this slice

- **`delete_property` removal** — done in Slice 5, not here.
- **The other 7 entities** — Slice 4, which reused this pattern (with real per-entity deviations — see that doc).
- **`reality-flow-mcp` edits** — done as part of Slice 5's interim fix, not here.
