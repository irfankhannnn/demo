# Architecture & Approach

## Components

```
┌─────────────────────────────────────────────────────────────┐
│  WhatsApp (user phone)                                      │
└────────────────┬────────────────────────────────────────────┘
                 │ Baileys protocol
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  whatsapp-platform (Node, port 3003)                          │
│  - Owns the Baileys socket                                    │
│  - Forwards incoming messages to CRM webhook                  │
│  - Exposes HTTP API for sending messages                      │
│  - Has ConnectionController, watchdog, pending-delivery queue   │
│  - Health probe and init-query timeout handler for half-open sockets │
│  - Atomic auth-state backup + soft reset (auth-state-utils)    │
│  - Proactive pre-key rotation (via ConnectionController)        │
│  - Patched Baileys (pre-key grace period, USync null check)     │
└────────────────┬─────────────────────────────────────────────┘
                 │ Webhook (local dev) or EventBridge (prod)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  server (Express, port 4000)                                  │
│  - Receives webhook                                           │
│  - Invokes AI agent                                           │
│  - Calls back to whatsapp-platform to send replies              │
│  - Logs messages to DynamoDB                                  │
└─────────────────────────────────────────────────────────────┘
```

## Key data flow

1. Incoming message arrives at Baileys socket.
2. `baileysClient.js` deduplicates, debounces, and forwards to CRM webhook.
3. `apps/crm/server/routes/webhooks.js` receives the webhook.
   - In local dev, calls `whatsapp-message-processor.js` directly.
   - In production, publishes to EventBridge; Lambda invokes the processor.
4. Processor:
   - Claims the message via DynamoDB conditional write.
   - Loads agency config and conversation state.
   - Invokes the WhatsApp agent (Bedrock Claude / Gemini).
   - Sends the reply via `apps/crm/server/bailey.js`.
   - Logs inbound and outbound messages.
   - Marks the claim complete.

## Idempotency / deduplication layers

1. **Baileys service outbound cache** (`outboundMessageIds`) — prevents echo loops by skipping messages the service itself sent.
2. **Processed message IDs cache** (`processedMessageIds`) — prevents forwarding the same incoming message ID twice.
3. **DynamoDB dedup claim** (`claimMessageProcessing`) — atomic conditional write; ensures only one Lambda/invocation processes a message.
4. **In-memory `seenMessageIds`** in the processor — dedups within one batch.

## Retry philosophy

- Baileys service has its own retry/backoff for transient send errors.
- Server relies on Lambda/EventBridge retries and now also on Baileys webhook forwarder retries (503 in local dev).
- When a reply cannot be delivered, the processor releases the DynamoDB claim and throws so the invocation is retried.

## New robustness layers (third pass)

1. **Baileys patches** (`patches/@whiskeysockets+baileys+6.7.18.patch` via `patch-package`)
   - Pre-key grace period in `lib/Signal/libsignal.js`.
   - Null check in `lib/WAUSync/USyncQuery.js`.

2. **Health probe** (`baileysClient.js`)
   - Sends `sendPresenceUpdate('available', ownJid)` every `HEALTH_PROBE_INTERVAL_MS`.
   - Times out after `HEALTH_PROBE_TIMEOUT_MS`.
   - Ends the socket on known crypto/half-open failures.

3. **Init-query timeout handler** (`baileysClient.js`)
   - Proxies the Baileys logger to detect `init queries timed out` / 408 internal logs.
   - Ends the socket immediately when detected.

4. **Atomic auth-state backup + soft reset** (`auth-state-utils.js`)
   - `backupCredsJsonAtomically` writes a `creds.json.bak` using temp-file + rename.
   - `softResetSession` deletes resettable Signal files while preserving `creds.json`.
   - `restoreCredsFromBackup` restores from backup if the live file is empty/missing.

5. **Proactive pre-key rotation** (`connection-controller.js`)
   - Rotates pre-keys every `PREKEY_ROTATION_INTERVAL_MS` while connected.
   - Prevents `Invalid PreKey ID` exhaustion over long-running sessions.

## Configuration

- `baileys-service/src/config.js` — central config including:
  - `MESSAGE_DEBOUNCE_MS` (validated 0–60000)
  - `HEALTH_PROBE_INTERVAL_MS` (default 30000)
  - `HEALTH_PROBE_TIMEOUT_MS` (default 10000)
  - `DEFAULT_QUERY_TIMEOUT_MS` (default 30000)
  - `PREKEY_ROTATION_INTERVAL_MS` (default 21600000)
  - `SOFT_RESET_MAX_RETRIES` (default 2)
- `apps/crm/server/bailey.js` — lazy config for Bailey API endpoint/mode/key.
