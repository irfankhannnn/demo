# Bugs Found During Slices 2–5 Implementation

While implementing the GSI swap, the 8 archive tools, and the delete-tool removal, verification work surfaced several **pre-existing, currently-live bugs** unrelated to what any single slice set out to build. This doc consolidates them in one place — some were fixed inline because they were directly in the way of shipping a working archive tool; others are flagged for a deliberate follow-up rather than patched under time pressure.

## Fixed inline (were blocking or directly relevant to Slices 2–5)

### 1. `create_meeting` failed on every well-formed call — 100% reproduction rate
`server/skillInvoker.js`'s `invokeSkill()` ran `normalizeToolInput()` (which maps `scheduledDate` → `meetingDate`/`meetingTime` and **deletes** `scheduledDate`) *before* `validateInput()` checked required fields — and `scheduledDate` is a required field. Every call using the tool's own documented contract failed with `"required parameter 'scheduledDate' is missing"`.
**Fix:** split validation into `validateRequiredFields()` (runs on raw input, before normalization) and `validateInputTypes()` (runs after). Verified via direct reproduction against the real `crmDynamodbService` before and after.

### 2. `update_contact_role` was completely broken
`updateContactRole(tenantId, contactId, role, enabled, profileData)` has a unique 5-arg positional signature. The generic `isUpdateTool` dispatch branch called it as `handler(tenantId, id, {...input, updatedBy})` — passing an object where `role` (a string) was expected. Every real call failed with `"Invalid role. Must be owner, seller, buyer, or tenant"`.
**Fix:** added an explicit dispatch branch for this one tool name.

### 3. Phone-lookup tools never matched a real phone number
`find_contact_by_phone`, `get_owner_by_phone`, `get_tenant_by_phone` all take `(tenantId, phone: string)`, but fell into the generic `handler.length === 2` branch, which passed `{phone: '...'}` (the whole input object) instead of the string. Depending on what the underlying comparison did with a non-string, this either silently returned "not found" for every real number or threw.
**Fix:** added a `PHONE_LOOKUP_TOOLS` dispatch branch.

### 4. `delete_property_document` (now `archive_property_document`) never got its second ID
`create_property_document` / `delete_property_document` take **two** id-shaped fields (`propertyId` and `documentId`). The generic dispatch's `extractEntityId()` only ever picks the *first* field ending in `Id`, so `documentId` was silently `undefined` — a DynamoDB `DeleteCommand` on a key with `documentId: undefined` just silently no-ops instead of erroring, meaning **`delete_property_document` likely never deleted anything, ever**, with no visible failure.
**Fix:** added a `PROPERTY_DOCUMENT_TOOLS` dispatch branch that passes both ids positionally. Same fix carried into the new `archive_property_document`.

### 5. Meeting's status state machine had no path to any new terminal state
`updateMeeting`'s `validTransitions` table only allowed `scheduled/rescheduled → completed/cancelled/rescheduled`, with `completed` and `cancelled` as fully terminal (no transitions out, ever). Adding `'archived'` as a value without changing this table meant `archive_meeting` would throw `Invalid meeting status transition` unconditionally, for every meeting regardless of current status.
**Fix:** added `archived` as a reachable target from every status, and `scheduled` as the one reactivation path out of `archived`. Also fixed a related gap: the reminder-cancellation logic only fired for `cancelled`/`completed`, so archiving a still-`scheduled` meeting directly would have left its reminder job live — added `archived` to that condition too.

### 6. `~360 lines of dead code` in `server/skillInvoker.js`
A variable literally named `const _TOOL_SCHEMAS_REMOVED = {...}` — a duplicate, stale copy of every tool's validation schema, explicitly marked as superseded by the canonical `TOOL_SCHEMAS` import — was still sitting in the file, never referenced anywhere. Deleted.

### 7. `USER_CATEGORIES` (`server/userCategoryService.js`) allowlists referenced tools that no longer exist, and never granted the new archive tools
The `admin` and `whatsapp_bot` category allowlists still listed `delete_lead`, `delete_property`, etc. (now-removed tool names — dead references) and had no entry at all for any `archive_*` tool, meaning any code path that *does* check `userId`-based permissions (unlike the primary WhatsApp flow today — see finding #8) would have been unable to grant archive access to anyone.
**Fix:** replaced the stale `delete_*` references with the matching `archive_*` names in `admin`, and added `archive_*` entries to `whatsapp_bot`. Left the also-stale `delete_*_note`/`update_*_note` references alone — those reference tools that were *already* missing from the canonical registry before this work started, an unrelated pre-existing drift issue (see Not Fixed, below).

## Not fixed — flagged for deliberate follow-up

### 8. The `USER_CATEGORIES` permission gate does not actually run for the primary WhatsApp flow
`invokeSkill()` only checks `canUserAccessTool()` when `userId` is present (`if (userId) {...}`). `whatsapp-message-processor.js` calls `invokeAgent()` without ever setting `context.userId`, so **the entire category-based permission system is currently bypassed for real WhatsApp messages** — every tool in the canonical registry is reachable regardless of category. This isn't something this phase should silently patch (it may be intentional pending a real user-identity model — see the proposal's Phase 2 "principal" work), but it means today's `USER_CATEGORIES` allowlists are largely aspirational for the one channel that matters most right now. Worth an explicit decision before Phase 2 builds on top of it.

### 9. ✅ FIXED — `toTitleCase()` mangled building/area names typed in caps

**Resolved.** The heuristic `/^[A-Z]{4,6}$/` preserved *any* 4–6 letter all-caps word as if it were an acronym, so `"SEA BREEZE TOWERS"` → `"Sea BREEZE TOWERS"` (SEA is 3 letters so it was corrected; BREEZE/TOWERS are 6, so they were "protected"). Since pasting names in caps is common, this was corrupting real data.

Replaced with an explicit `PRESERVED_ACRONYMS` allowlist (RERA, AADHAR, PAN, KYC, BHK, MHADA, CIDCO, IFSC, …). That is the right shape here: the set of acronyms that matter in Indian real estate is small, known and closed — the set of 4–6 letter English words is not. Verified against both directions (caps names now correct; `RERA registered flat` → `RERA Registered Flat`, `3 BHK in andheri` → `3 BHK In Andheri` still preserved).

The earlier note said this needed a product decision. Reading the rule showed it didn't: the *digit*-bearing case (`GPJH4`) is handled by a separate rule one line above, so the length heuristic was protecting nothing that the allowlist doesn't.

<details><summary>Original finding (for history)</summary>

### 9. `toTitleCase()` (`server/utils/titleCase.js`) mangles common building/area names typed in caps
The acronym-preservation heuristic — `if (/^[A-Z]{4,6}$/.test(core)) return word;` — is meant to leave real acronyms (RERA, OTP, NRI) alone, but it matches *any* 4–6 letter all-caps word, including ordinary English words. `toTitleCase('SEA BREEZE TOWERS')` returns `'Sea BREEZE TOWERS'` — `SEA` (3 letters) gets corrected, `BREEZE`/`TOWERS` (6 letters each) don't. Given how often building/area names get typed or pasted in all-caps, this likely garbles real data today. **Not fixed**: the correct acronym allowlist isn't known without checking what real values this rule was written to protect (RERA numbers? NRI status?) — a blind narrowing risks reintroducing the bug this rule originally fixed. Confirmed via the pre-existing failing test `normalizers/leadTextNormalizer.test.js` (`titleCase › title-cases multi-word strings`), which predates this session (verified via `git stash`).

</details>

### 10. ✅ RESOLVED — two stale assertions in `agents/responseFormatter.test.js`

**Resolved as stale tests, not code bugs**, once the reason was actually provable rather than inferred:

- **`formats create_lead as compact confirmation`** expected `'Andheri West'`. `formatCompactConfirmation` builds `[type, status, phone, budget, area]` and then `.slice(0, 4)` — area is 5th, so it is dropped *by design* ("2–3 key fields" per that file's own docstring). The test predates the cap.
- **`formats a note`** expected a `'*Note*'` header, a formatted date and the author. The note confirmation was simplified to a short ack plus the note text — and `working-context/current-issues-and-pending.md` lists *"compact create confirmations"* as **completed** work, which is exactly this change.

Both tests updated to assert the intended behavior (and the create_lead one now asserts area is *absent*, pinning the cap). Earlier I flagged these as needing a product decision; reading `confirmations.js` and the prior session's context made the intent unambiguous.

**This mattered beyond tidiness:** these 3 failures (with #9) were the only thing keeping the suite red, and a permanently-red CI is one people learn to ignore. With them fixed, **586/586 pass**, which is what makes the new `server-tests.yml` CI job trustworthy.

<details><summary>Original finding (for history)</summary>

### 10. Two likely-stale assertions in `agents/responseFormatter.test.js`
`formats create_lead as compact confirmation` expects `'Andheri West'` (the lead's `preferredArea`) in the compact confirmation text, and `formats a note` expects the literal string `'*Note*'` — neither appears in the actual current output. Both read as intentional product-copy simplifications (shorter confirmations) that the tests weren't updated for, but that's an inference, not a verified fact — flagging rather than guessing at a fix for user-facing copy. Also pre-existing (confirmed via `git stash`).

</details>

### 11a. Leftovers found by a later audit of Slice 5 (both fixed)

A verification pass after Phase 3 found two references the Slice 5 removal missed. Both were dead rather than harmful, but both implied the delete subsystem still existed:

- **`server/agents/llm/plannerPrompt.js`** still injected a *"Pending delete confirmation for tool X — only proceed if user said yes/haan"* line into the planner's system prompt, gated on `ctx.pendingConfirmation`. Since Slice 5 removed the field from conversation state entirely, the branch could never fire — but it was the last place in the codebase still telling the model that a delete-confirmation flow existed. Removed, with a comment pointing at Slice 5.
- **`server/skillInvoker.js`'s `PROPERTY_DOCUMENT_TOOLS`** still listed `delete_property_document`. Inert (the tool is no longer in `ALLOWED_TOOL_NAMES`, so dispatch is never reached), but misleading. Removed.

Lesson worth recording: when Slice 5 removed the delete tools, the search was for the *tool names* and the *subsystem function names*. Neither pattern caught a **prompt string** describing the behavior, or a **dispatch-shape set** that merely mentioned a tool name. A removal pass should grep for the concept in prose/prompts too, not just identifiers.

### 11b. …and the lesson in 11a was not enough either — four MORE leftovers, in live prompts

A second audit (during Phase 3 Slice 3d) found four further Slice 5 leftovers that **11a's own lesson did not catch**, because the greps still searched for *quoted* identifiers (`'delete_lead'`) while these were unquoted prose:

- **`server/agents/prompts.js` (the live WhatsApp system prompt)** — three separate instructions telling the model that delete tools exist and to gate them behind confirmation:
  - *"Delete: ALWAYS ask for confirmation first. Wait for 'yes'/'haan' before calling delete tools."*
  - a worked example: *`User: "Delete lead L123" → reply: "Pakka delete karu? Reply 'haan' to confirm." (do NOT call delete yet)`*
  - the MCP role prompt's *"Always confirm before making destructive changes."*
  - plus `delete_` listed in the DATA/LIST tool enumeration.
- **`server/agents/llm/plannerPrompt.js`** — *"Delete: if user has not confirmed after you asked, do NOT call delete_* — reply asking them to confirm (haan/yes)."*

These were the **worst** of the set: not dead code, but **live instructions actively steering the model** toward a tool family that no longer exists, and toward a confirmation handshake whose implementation was deleted. A user saying "delete this lead" would get "Pakka delete karu?" and then… nothing that could act on "haan". All four replaced with `archive_*` guidance.

**The real lesson, restated:** identifier greps cannot audit prompt files. Prompts are prose instructions to a model — they must be **read** when the capability they describe changes. Any future tool removal should include a deliberate read-through of `agents/prompts.js` and `agents/llm/plannerPrompt.js`, not a grep of them.

### 11c. Known-remaining dead branches from the same removal (not fixed)

Lower-severity, left alone deliberately:

- **`server/agents/responseFormatter.js:104`** — `if (toolName.startsWith('delete_')) return 'note deleted';` inside note handling. Unreachable (no `delete_*` tool can be dispatched), and it concerns the phantom note tools from #11.
- **`server/agents/responseFormatter.js:349`** — still branches on `mode === 'confirm' || mode === 'cancelled'`, two `decideInteraction` modes removed in Slice 5. Unreachable.
- **`server/agents/responseFormatter.test.js:281`** — a `formats delete confirmation` test calling `formatToolResult('delete_lead', …)`. It passes (the formatter doesn't check tool existence) but tests a tool that no longer exists.

All three are inert. Grouped here rather than fixed piecemeal because they belong with a formatter-layer cleanup pass, and touching user-facing formatting logic to delete unreachable branches is not worth doing immediately before a launch.

### 12. `server/agents/toolContextBuilder.js` is entirely dead code

Verified twice (once during Phase 2 research, once during the post-Phase-3 audit): nothing in the repo imports it. Its exports (`buildToolContext`/`buildContextForTool`/etc.) are never called by any route, agent, or script. It also still calls `getConversationState(tenantId, context.contactPhone)` with a **raw phone**, which is now the wrong key shape after the Phase 2a principal re-key — so if anything ever did start importing it, it would silently miss conversation state.

**Not deleted** — flagged here for an explicit confirm first, since "no importers" is strong evidence but deleting a file is worth a human nod. If confirmed dead, deleting it removes the stale phone-keyed call site along with it.

### 11. Note-level tools are referenced in TWO places but don't exist in the canonical registry at all
**Verified:** all eight of `delete_lead_note`, `update_lead_note`, `delete_owner_note`, `update_owner_note`, `delete_tenant_note`, `update_tenant_note`, `delete_buyer_note`, `update_buyer_note` are absent from `server/shared/toolDefinitions.js` — *none* of them exist. They are nonetheless referenced in two files:

- **`server/userCategoryService.js`** — listed in `USER_CATEGORIES.admin.allowedTools`. Harmless (granting permission to a tool that can't be called is a no-op).
- **`server/aiDtoMiddleware.js`** — listed in the `LEAD_TOOLS`/`OWNER_TOOLS`/`TENANT_TOOLS` sets (~lines 50/55/60) **and** given dedicated handling branches (`if (toolName === 'delete_lead_note')` ~141, `delete_owner_note` ~199, `delete_tenant_note` ~258). Those branches are unreachable dead code.

Pre-existing drift, unrelated to this session's changes (these tools never existed), left untouched: fixing it means deciding whether these tools should be *built* or the references *removed* — a product decision, not a cleanup. Recorded at full scope here because an earlier version of this note mentioned only `userCategoryService.js` and understated it.

## Verification

Every fix above has a corresponding test — see `server/skillInvoker.test.js` (dispatch-level regression tests for findings #1–4), `server/crmDynamodbService.js`'s inline comments at the `archiveMeeting`/`updateMeeting` changes (#5), and the full-suite run in each slice doc. Findings #8–11 have no code changes and therefore no new tests; they're documented here so they aren't lost.
