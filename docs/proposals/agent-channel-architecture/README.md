# Two-Channel Agent Architecture — Proposal

**Status:** Proposed
**Branch:** `kalim-work-ai`
**Author context:** Kalim (product/architecture), captured via architecture review session on `auth_rbac_feature`

## Goal

Users should be able to run a **complete task end-to-end from WhatsApp** (multi-step: create + schedule + update in one exchange), but WhatsApp replies must stay short — well under the platform's hard limits, ideally a few hundred characters. Separately, the **in-CRM web AI** should behave like a ChatGPT/Claude-style assistant: full-length streamed responses, visible reasoning/tool activity, rich entity cards — powered by AI performing the same actions.

The core design decision this proposal makes: **these are not two agents.** They are one agent core with two channel adapters that differ only in how the final answer is rendered and delivered. Building them as two separate implementations would duplicate the tool registry, the conversation logic, and the CRM access layer, and the two would drift apart the same way the MCP tool registry already has (see `01-diagnosis.md`).

## Files in this proposal

| File | Contents |
|---|---|
| [01-diagnosis.md](./01-diagnosis.md) | Current state of the WhatsApp (Bailey) agent, the voice (Exotel) agent, and the MCP server — what's built, what pattern each follows, where they fall short |
| [02-target-architecture.md](./02-target-architecture.md) | The channel-agnostic agent core: bounded tool loop, channel-aware compose step, session model, MCP boundary |
| [03-implementation-plan.md](./03-implementation-plan.md) | Sequenced, independently-shippable phases with file-level task breakdown |

## Non-goals

- This proposal does not change the Exotel/ElevenLabs voice pipeline. That pipeline solves a different problem (live phone conversation, regex intent routing) and is out of scope here — noted in the diagnosis for completeness only.
- This proposal does not pick a specific alternate LLM provider. Model pluggability (Bedrock, OpenAI-compatible, etc.) is a later, independent phase and is only sketched at the architecture level.
- This proposal does not change delete semantics, billing/credit metering, or infra beyond what's needed to support two channels. Those are called out as related follow-ups, not bundled in.

## Relationship to existing docs

- `docs/current_design/08-agent-runtime-flow.md` documents the *current* single-shot pipeline this proposal replaces.
- `docs/current_design/` stays as the runtime snapshot; update it once a phase here actually ships, rather than treating this proposal as documentation of shipped behavior.
