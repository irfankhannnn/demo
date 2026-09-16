# Testing Notes

## Commands

```bash
# Baileys service
cd "D:\reality_flow_crm\nabi-app-git-bkp\whatsapp-platform"
npm test
npm run dev

# Server
cd "D:\reality_flow_crm\nabi-app-git-bkp\server"
npm test
npm run dev
```

> **Note:** The `auth-state-utils` tests now use explicit temp directories and do not mutate `process.env.AUTH_STATE_DIR`. The `connection-controller.test.js` mocks the `auth-state-utils` module entirely. Running `npm test` should not touch the real `auth_state` directory.

> **Note:** `DEFAULT_QUERY_TIMEOUT_MS` defaults to `60000` so fresh QR links have time to complete initial sync.
>
> **Note:** WhatsApp agent responses are now post-processed by `responseFormatter.js`. CRM tool results (leads, buyers, properties, etc.) are rendered as structured bullets / numbered lists, not paragraphs.

## Test results

- `whatsapp-platform`: run `npm test` in that directory.
- `server`: all suites passed

## Manual testing scenarios

### Scenario 1: Normal conversation
1. Send message to WhatsApp number.
2. Verify reply arrives.
3. Verify inbound and outbound messages are logged.

### Scenario 2: Stale / half-open connection recovery
1. Start both services.
2. Send a few messages.
3. Either wait 10+ minutes without activity OR simulate a half-open socket (e.g., block WhatsApp traffic briefly).
4. Watch for one of:
   - `watchdog.inactivity_timeout` and `connection_controller.stale_connection`
   - `baileys.health_probe.half_open`
   - `baileys.init_queries.timeout.half_open`
5. Expect `connection_controller.socket.end.stale` or `baileys.health_probe.end_failed` / `baileys.init_queries.end_failed` followed by a reconnect.
6. Send another message.
7. The reply should be delivered after reconnect.

### Scenario 3: Crypto-error soft reset (if safe to trigger)
1. Start both services and connect a session.
2. Trigger or wait for a high-severity crypto error (`Bad MAC`, `No matching session`, `Invalid PreKey ID`).
3. Watch for:
   - `connection_controller.soft_reset.attempt`
   - `auth_state_utils.soft_reset.success` (deleted resettable files, preserved `creds.json`)
   - `connection_state.transition` from `connected` to `reconnecting` with reason `soft_reset_after_crypto_error`
4. The session should reconnect without requiring a new QR scan.

### Scenario 4: Budget update
1. Ask agent about a lead.
2. Ask to update budget (e.g., "budget 2.8 crore update kardo").
3. Verify `buyerRequirement.budget` is updated in DynamoDB.
4. Verify no new note is created for the budget change.

### Scenario 5: Structured response formatting
1. Ask agent to "show all buyer leads" or "list properties in Andheri".
2. Verify the WhatsApp reply is a numbered list or bullet list, not a long paragraph.
3. Verify money is formatted as `₹80L`, `₹1.5Cr`, `₹45k`.
4. Verify empty results show a concise message like "No leads found. Try a different filter...".

### Scenario 6: Delete via chat
1. Ask agent to "delete lead lead-123".
2. Verify agent asks for confirmation before calling `delete_lead`.
3. After confirmation, verify the lead is removed from DynamoDB.

### Scenario 7: Notes via chat
1. Ask agent to "add note to lead lead-123: met at site visit".
2. Verify `create_lead_note` is called and the note appears.
3. Ask agent to "show notes for lead lead-123".
4. Verify `get_lead_notes` returns the note list.

### Scenario 8: Phone lookup before creation
1. Ask agent to "create owner Rajesh 9876543210".
2. Verify agent calls `get_owner_by_phone` first.
3. If owner exists, agent should not duplicate.
4. If not found, agent calls `create_owner`.

### Scenario 9: Meeting management
1. Ask agent to "schedule site visit for lead lead-123 on 2026-07-01 at 10am".
2. Verify `create_meeting` is called with correct entity and date.
3. Ask agent to "show my upcoming meetings".
4. Verify `get_upcoming_meetings` is called and formatted as a list.

## What to look for in logs

- `whatsapp.processor.partial_chunk_delivery` — indicates a queued/dropped chunk; should now be followed by a retry.
- `connection_controller.stale_connection` — should now be followed by `connection_controller.socket.end.stale` and a reconnect.
- `baileys.health_probe.half_open` — health probe detected a half-open socket; socket should be ended.
- `baileys.init_queries.timeout.half_open` — init-query timeout detected; socket should be ended.
- `connection_controller.soft_reset.attempt` — soft reset triggered after a high-severity crypto error.
- `auth_state_utils.soft_reset.success` — soft reset completed without deleting `creds.json`.
- `whatsapp.processor.reply_failed` — should now be followed by `whatsappConversationService.markMessageProcessingFailed`.
- `webhooks.whatsapp.local_process.failed` with status 503 — Baileys webhook forwarder should retry.

## Common issues

- If the IDE still shows `baileys-service/__test_config.mjs` as open, it is a stale tab; the file does not exist.
- After code changes, restart both services to pick up changes.
- `patch-package` patches are applied on `npm install`. If the patch is missing, run `npx patch-package` or `npm install` again.
