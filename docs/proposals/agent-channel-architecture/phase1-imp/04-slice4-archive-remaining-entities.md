# Slice 4 — `archive_*` for the Remaining 7 Entities

**Status: ✅ Done, tested.** Depends on Slice 3 (pattern proven on `property`). Shipped as one pass across all 7 entities rather than incrementally, once the pattern was validated — but each entity's schema decision was made independently, and several deviated meaningfully from the original plan once the actual code was read (see below).

## Why

Slice 3 proved the tool-definition shape and dispatch pattern for `archive_*` using `property`. The other 7 entities didn't have that shortcut — each needed its own schema decision. Final summary, updated from the original plan to reflect what verification actually found:

| Entity | Decision made | Matched original plan? |
|---|---|---|
| `lead` | New `'archived'` enum value on `status` | ✅ Yes |
| `contact` | New `archivedAt` timestamp field + early-return in `deriveContactStatus()` | ✅ Yes |
| `tenant`/customer | Reuse existing `'inactive'` status | ✅ Yes |
| `owner` | Reuse existing `'inactive'` status | ✅ Yes |
| `buyer` | Mirror `deleteBuyer`'s dual-path branching (contact-derived vs. legacy) | ✅ Yes, and this branching turned out to be **load-bearing**, not just a nice-to-have — see below |
| `meeting` | New `'archived'` enum value on `status` | ⚠️ Plan didn't anticipate the existing status **state machine** would reject it outright — real fix needed, see below |
| `property_document` | New `archivedAt` field + a **new** `updatePropertyDocument()` function | ✅ Matched plan, but the dispatch layer needed a real fix too (documented in Slice 5) |

## What changed, per entity — including what verification corrected

### `lead`

```js
// update_lead's status enum, server/shared/toolDefinitions.js
['new', 'contacted', 'qualified', 'negotiating', 'lost', 'archived']
```
```js
export async function archiveLead(tenantId, leadId) {
  return updateLead(tenantId, leadId, { status: 'archived' });
}
```

**Correction to the original plan:** the plan speculated about whether `archiveLead` should carry forward `deleteLead`'s guard against archiving a converted lead, framing it as a design choice ("should NOT carry that guard forward silently"). Reading `updateLead`'s actual code settled this without a choice being needed: `updateLead` already throws `"Cannot update a converted lead"` for **any** field except `notes`, as a pre-existing, unrelated rule. Since `archiveLead` delegates to `updateLead`, this guard applies automatically — a converted lead cannot be archived either, which is a reasonable outcome (the buyer/seller/tenant/owner record is the live entity at that point) but was inherited, not designed.

### `contact`

```js
if (contact.archivedAt) return 'archived';
// ...rest of deriveContactStatus() unchanged
```
```js
export async function archiveContact(tenantId, contactId) {
  return updateContact(tenantId, contactId, { archivedAt: new Date().toISOString() });
}
```
`getContacts()`'s default (unfiltered) list now excludes `status === 'archived'` unless the caller explicitly filters for it — added `search_contacts`' `status` param enum: `['active', 'inactive', 'archived']`.

Matched the plan closely. One thing confirmed during implementation: `updateContact()` already unconditionally strips any `status` field from its input (`delete data.status`, since status is derived, never stored) but does **not** have a similar allowlist rejecting unknown fields — so `archivedAt` passes through cleanly with no changes needed to `updateContact` itself.

### `tenant`/customer and `owner`

```js
export async function archiveCustomer(tenantId, customerId) {
  return updateCustomer(tenantId, customerId, { status: 'inactive' });
}
export async function archiveOwner(tenantId, ownerId) {
  return updateOwner(tenantId, ownerId, { status: 'inactive' });
}
```
Both `updateCustomer`/`updateOwner` are simple, side-effect-free field setters — matched the plan exactly, no surprises.

### `buyer`

```js
export async function archiveBuyer(tenantId, buyerId) {
  const existing = await getBuyer(tenantId, buyerId);
  if (!existing) throw new Error('Buyer not found');
  if (existing.isFromContact && existing.contactId) {
    await updateContactRole(tenantId, existing.contactId, 'buyer', false);
    return await getBuyer(tenantId, buyerId);
  }
  return updateBuyer(tenantId, buyerId, { status: 'inactive' });
}
```

**The plan's reasoning was validated, and turned out to matter more than expected.** Reading `updateBuyer`'s actual code revealed it *already* has its own internal branching: for a contact-derived buyer, it forwards `data` (including any `status` field) to `updateContact()` — which, as noted above, unconditionally **strips `status`** before writing. That means the naive approach (`archiveBuyer = (t,id) => updateBuyer(t, id, {status:'inactive'})`) would have silently no-op'd for every contact-derived buyer — no error, no effect, just a status change that never happened. Mirroring `deleteBuyer`'s explicit branching (turn the buyer *role* off via `updateContactRole` instead) was the only correct option, not just the safer-looking one.

### `meeting`

```js
// updateMeeting's validTransitions, server/crmDynamodbService.js
const validTransitions = {
  scheduled: ['completed', 'cancelled', 'rescheduled', 'archived'],
  rescheduled: ['completed', 'cancelled', 'scheduled', 'archived'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: ['scheduled'],
};
```
```js
export async function archiveMeeting(tenantId, meetingId) {
  return updateMeeting(tenantId, meetingId, { status: 'archived' });
}
```

**This is the biggest deviation from the plan.** The plan assumed adding `'archived'` to the meeting status enum was sufficient, the same as `lead`. It wasn't: `updateMeeting` enforces an explicit state-transition table, and `completed`/`cancelled` were **fully terminal** (empty allowed-transitions array) before this change — meaning `archive_meeting` would have thrown `Invalid meeting status transition` unconditionally, for every meeting, regardless of current status, if the transition table hadn't also been updated. Fixed by adding `archived` as a reachable target from every status and `scheduled` as the one reactivation path back out (matching the "reversible" design intent). Also fixed a related, previously-undiscovered gap while in this code: the reminder-cancellation logic (`cancelMeetingReminder`) only fired for `status === 'cancelled' || 'completed'` — archiving a still-`scheduled` meeting directly would have left its reminder job live to fire after the meeting was archived. Extended that condition to include `'archived'` too. And added an `archived` branch to the contact-activity-logging block so an archived meeting doesn't get mislabelled "Meeting Rescheduled" in the activity feed.

### `property_document`

No `updatePropertyDocument()` existed at all before this slice (documents were create-then-delete only). Added a minimal one:

```js
export async function updatePropertyDocument(tenantId, propertyId, documentId, updates) {
  // ...builds an UpdateCommand via the same buildSetUpdateExpression() helper
  // every other update* function in this file uses, keyed by
  // PK: TENANT#{t}#PROPERTY#{propertyId}, SK: DOCUMENT#{documentId}
}
export async function archivePropertyDocument(tenantId, propertyId, documentId) {
  return updatePropertyDocument(tenantId, propertyId, documentId, { archivedAt: new Date().toISOString() });
}
```
`getPropertyDocuments()` now filters out `archivedAt`-set documents unconditionally (no existing "show archived documents" need identified, so no filter parameter was added — YAGNI).

Matched the plan's schema decision exactly. What the plan under-anticipated was the **dispatch layer**: `create_property_document`/`archive_property_document`/`delete_property_document` all need *two* id-shaped fields (`propertyId` and `documentId`) passed to their handler, and `skillInvoker.js`'s generic dispatch only ever extracts one. This was a real, pre-existing bug (also affecting the now-removed `delete_property_document`) discovered and fixed as part of this work — full details in [`05-slice5-remove-delete-tools.md`](./05-slice5-remove-delete-tools.md) and [`07-bugs-found.md`](./07-bugs-found.md).

## How it was tested

1. **`validateToolDefinitions()` startup guard** — passes for all 8 archive handlers.
2. **Dispatch tests** in `skillInvoker.test.js` for every entity (`archive_lead`, `archive_contact`, `archive_tenant`, `archive_owner`, `archive_buyer`, `archive_meeting`, `archive_property_document`), each asserting the correct handler is called with correctly-unpacked arguments — not the whole input object.
3. **Full test suite** — 535 passing (up from the 511 baseline before this session), zero regressions introduced by any Slice 4 change; the only 3 remaining failures are pre-existing and unrelated (confirmed via `git stash` before this session started — see [`07-bugs-found.md`](./07-bugs-found.md) items #9–10).

Per-entity DB-level integration tests (verifying the real DynamoDB update expression, not just the dispatch layer) were **not** added, for the same proportionality reasoning documented in [`03-slice3-archive-property.md`](./03-slice3-archive-property.md)'s testing-scope retrospective — these are thin wrappers over already-shipped `update*` functions that have no dedicated unit tests of their own in this codebase, with two exceptions where real new logic existed (the `buyer` branching and the `meeting` state-machine change), both of which were verified by direct code reading against the actual guard logic rather than by a mocked integration test, given the same ESM same-module-call-interception limitation described in Slice 3.

## Explicitly out of scope for this slice

- **`delete_*` tools were not removed here** — Slice 5.
- **No general-purpose `updatePropertyDocument`** beyond what `archivePropertyDocument` needs.
- **No retroactive backfill** of `archivedAt`/`archived` status on existing records.
