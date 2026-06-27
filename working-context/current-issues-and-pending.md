# Current Issues & Pending

## Fixed in this session

- [x] 10 robustness review issues (first pass)
- [x] Silent message loss on stale Baileys connection (second pass)
- [x] Agent creating note instead of updating lead budget/requirement (second pass)
- [x] Baileys issue #1769 / PR #2372 pre-key deletion problem (third pass)
- [x] Half-open socket detection and recovery via health probe (third pass)
- [x] Init-query timeout 408 handling (third pass)
- [x] Atomic credential backup + soft Signal session reset (third pass)
- [x] Proactive pre-key rotation (third pass)
- [x] All 60 `baileys-service` tests passing (third pass)
- [x] Tests no longer rely on global `process.env.AUTH_STATE_DIR` (fixed after auth-state corruption)
- [x] WhatsApp agent responses are structured and scannable (post-processed by responseFormatter.js)
- [x] Complete CRM CRUD exposed to chat agent (delete, notes, lookup, meetings, documents, metrics)
- [x] CRUD audit review fixes applied (`delete_buyer`, `profileData` schema, note detection, document/metrics formatting, test coverage)
- [x] Gemini tool schema `attendees` array items fixed (added `items` schema for array parameters in `create_meeting`)

## Known limitations

1. **Duplicate message risk on retry**
   - When a reply is queued in Baileys and the server/Lambda also retries, the message could be delivered twice.
   - Trade-off accepted: duplicate delivery is better than silent loss.
   - The DynamoDB dedup claim still prevents duplicate AI invocations.

2. **Pending delivery queue is a backup, not primary retry**
   - The Baileys pending-delivery queue drains when the connection opens.
   - Primary retry is now server-side (Lambda / webhook forwarder).

3. **Tool schema simplicity**
   - Requirement objects are passed as `type: 'object'`.
   - If LLMs struggle with nested objects, we may need to flatten requirement fields or add richer JSON schemas.

4. **Local dev vs production parity**
   - Local dev now returns 503 on processing failure.
   - Production relies on Lambda retry.
   - Both should behave similarly, but local dev has a shorter retry loop via Baileys webhook forwarder.

5. **Baileys patch maintenance**
   - `patch-package` patches are applied on `npm install` via `postinstall`.
   - If Baileys is upgraded, the patches must be regenerated or removed.

6. **Health probe false negatives**
   - The probe only ends the socket on a narrow set of known failure patterns (crypto errors + 408).
   - Unknown half-open symptoms may still need manual investigation.

## Next steps / things to watch

1. **Manual retest** after restarting both services:
   - Send a few messages, then disconnect the network or wait for a half-open state.
   - Verify the health probe or socket logger ends the socket and reconnects.
   - Verify the message is delivered after reconnect.

2. **Test the soft reset path** (if safe to trigger):
   - A high-severity crypto error (`Bad MAC`, `No matching session`) should trigger `softResetSession` and reconnect without requiring a new QR scan.

3. **Test the budget update flow**:
   - Ask the agent to update budget, BHK, or location.
   - Verify `buyerRequirement` is updated, not just a note created.

4. **Add automated tests** for:
   - Queued-message handling and retry path
   - Requirement merging in `updateLead`
   - Agent tool selection for structured updates
   - Health probe failure and reconnect flow (integration-level)
   - Soft reset integration with `ConnectionController`

5. **Consider reducing the watchdog inactivity timeout** if 10 minutes feels too long for customer-facing delays. The health probe now provides faster detection, so this is less critical.

6. **Review the `hasMessage` removal** in `whatsapp-message-processor.js` to ensure no legacy duplicates are introduced during migration.

7. **Consider removing the pending-delivery queue** if the server-side retry path proves reliable.

## Questions for next session

- Should the Baileys pending-delivery queue be removed in favor of server-only retries?
- Should the dedup claim TTL be shortened or made configurable?
- Should the agent have a dedicated `update_lead_requirements` tool for better reliability?
- Should the health probe timeout be reduced or made adaptive?
- Should `restoreCredsFromBackup` be called automatically on `createSession` startup if `creds.json` is missing/empty?
