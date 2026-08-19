# Flow Architectures

One document per flow. Each states its trigger, its orchestration mode (per `../04-orchestration-patterns.md`), its current architecture, its target architecture, the tools it needs, and its failure modes.

| # | Flow | Mode | Trigger | Status today |
|---|---|---|---|---|
| [01](./01-whatsapp-agent.md) | WhatsApp agent | **A** — bounded tool loop | Inbound WhatsApp message | Built, single-shot (no loop) |
| [02](./02-web-crm-chat.md) | In-CRM web chat | **A** — bounded tool loop | Browser, synchronous | Not built |
| [03](./03-call-intelligence.md) | Call Intelligence | **B** — extraction + rules | Recording upload | Built, correct shape |
| [04](./04-background-automation.md) | Lead qualifier / router / follow-up | **B** — extraction + rules | EventBridge + cron | Built, uses Mode A machinery (wrong) |
| [05](./05-voice-exotel.md) | Exotel voice | **C** — classifier per turn | Live phone call | Built, regex (no LLM) |
| [06](./06-mcp-external.md) | MCP for external AI apps | **D** — tool surface only | External MCP client | Built, tool registry drifted |

## Shared conventions

Every flow, without exception:

- Calls tools through `server/skillInvoker.js` — never a bespoke data path.
- Uses tool definitions from `server/shared/toolDefinitions.js` — the single registry.
- Passes `tenantId` explicitly; tenant scoping is never implicit.
- Writes an audit entry with a before-image on every mutation.
- Uses the deterministic formatter for lists and entity cards; the LLM writes prose only.

## Reading order

If you are reviewing this proposal end to end:

1. `../01-diagnosis.md` — what exists now
2. `../04-orchestration-patterns.md` — why each flow gets the mode it gets
3. This directory — the flows themselves
4. `../05-retrieval-and-vector-search.md` — the retrieval layer several flows depend on
5. `../03-implementation-plan.md` — sequencing across all of it
