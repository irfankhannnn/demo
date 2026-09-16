# 12 — AI Voice Architecture

> **Scope:** inbound + outbound AI voice for lead qualification, follow-up, and appointment scheduling in English/Hindi/Hinglish, on compliant Indian telephony. Evolves the existing (built, disabled) `ai-calling-service/`. Research verified June 2026 (`20`); **AWS/ElevenLabs pricing pages were 403-blocked to automated fetch — reconfirm exact rates before budgeting.**

---

## 1. What Exists Today (reuse)
`ai-calling-service/` already implements the hard plumbing: Exotel outbound (`connect.json`, tenant in `CustomField`), ElevenLabs Conversational AI sessions, status + intent webhooks, Bedrock KB grounding, per-tenant DynamoDB call/transcript store, S3 recordings, Secrets Manager. It is **disabled before launch** and its intent detection is **regex-based**. We keep the telephony/session/recording/grounding scaffolding and **replace the brittle regex brain with the agent stack** (`04`).

## 2. India Telephony & Compliance (decide first — non-negotiable)
- **VoIP→PSTN termination is prohibited by DoT in India.** You **cannot** bridge an AI voice stack directly to the phone network yourself; you **must** route through a **licensed cloud-telephony provider** — **Exotel** (already integrated), Knowlarity, Ozonetel, Plivo.
- **DLT / TRAI / TCCCPR (amendment notified 12 Feb 2025):** promotional voice on **140-series**, transactional/service on **1600-series**; 10-digit numbers banned for telemarketing; **explicit digital consent can override DND/DNC**; heavier penalties. **Implication:** outbound promotional calling requires DLT registration, the right number series, consent capture, DND scrubbing, and call-time/abandonment compliance. We treat outbound promotional voice as a **consented, rate-limited, human-supervised** capability.
- **Recording consent** and language/disclosure norms apply; the existing recording pipeline must capture consent state.

## 3. Two Viable Stacks (recommendation: start managed, keep self-host option)

| | **A. ElevenLabs Agents + Exotel SIP (managed)** | **B. Pipecat/LiveKit + Bedrock + Exotel (self-host)** |
|---|---|---|
| Telephony | Exotel SIP trunk (compliant PSTN) | Exotel vSIP / **AgentStream** streaming |
| Brain | ElevenLabs Agent + LLM passthrough (our tools via MCP/server tools) | Bedrock (Claude / **Nova 2 Sonic** Hindi speech-to-speech) |
| Hindi/Hinglish | Native (Hindi STT ~5% WER, TTS, `hinglish_mode`) | Nova 2 Sonic (adds Hindi, Dec 2025) or Claude+TTS |
| Cost (approx) | ~**$0.08/min platform + LLM passthrough ≈ $0.10–0.13/min (~₹9–11/min)** + telephony | Lower per-minute at scale; more engineering |
| Effort | Low — fastest to GA | Higher — but reuses `ai-calling-service` + Exotel |
| Control | Vendor-managed | Full control, AWS-native, data stays in our cloud |

**Recommendation:**
- **Phase-2/3 GA: Stack A (ElevenLabs Agents + Exotel SIP).** Fastest path, native Hindi/Hinglish, batch outbound, tool calling, post-call webhooks — and we already use ElevenLabs + Exotel. Bridge ElevenLabs tools to our **MCP layer** (`05`) so the voice agent is grounded in the same CRM/Property/Knowledge tools as the chat agent.
- **Evaluate Stack B in parallel** for cost control at scale and tighter AWS-native data residency: **Pipecat or LiveKit Agents** (both support Exotel + Bedrock) with **Nova 2 Sonic** for Hindi speech-to-speech. This reuses the existing `ai-calling-service` footprint and keeps audio/PII in our AWS.
- Decision gate: pick B over A when monthly voice minutes make the per-minute delta exceed the engineering+ops cost of self-hosting (model it in `17`).

## 4. Target Architecture

```
 Inbound call → Exotel (licensed PSTN) ─┐
 Outbound (consented, DLT) ─────────────┤→ Voice runtime (ElevenLabs Agent  OR
                                         │   Pipecat/LiveKit on Fargate/AgentCore)
                                         │
                          STT ↔ LLM ↔ TTS (Hindi/Hinglish)
                                         │ tool calls
                                         ▼
                        Voice agent (04) ── MCP tools (05):
                        Lead · Property · Visit · Knowledge · Task
                                         │
                        grounded answers + actions (book visit, update lead)
                                         ▼
              transcripts + recording + consent → DynamoDB/S3 (existing)
              outcome events → CRM, scoring (10), follow-up (09)
```

## 5. Capabilities
- **Inbound:** answer 24/7, identify caller (CRM/Contact MCP), answer grounded questions, qualify, book visits, escalate to human (warm transfer via Exotel) on request/low-confidence.
- **Outbound (consented):** qualification calls on fresh leads, follow-up/nurture calls (triggered by journeys `09`), site-visit reminders/confirmations, re-engagement of cold leads. **Batch outbound** via the voice platform with per-row variables.
- **Grounding & HITL:** identical principles to chat (`04 §5–6`) — never invent prices; offer human handoff; outbound promotional calls pinned to consented, supervised mode.

## 6. Multi-Tenancy & Cost
- Per-tenant Exotel numbers/credentials and agent config (greeting, voice, language, persona) — pattern already in the calling service.
- Per-tenant **voice-minute metering** → billable (`17`); concurrency caps per tenant; budget guards.
- Recordings/transcripts tenant-isolated in S3/DynamoDB with retention + consent.

## 7. KPIs
Connect rate, average handle time, qualification rate on calls, visit-booking rate, human-escalation rate, transcript groundedness, cost-per-call-minute, compliance exceptions (should be zero), CSAT/sentiment.

## 8. Phasing
- **P2:** re-enable calling service behind MCP; inbound answering + outbound follow-up reminders (transactional/service, 1600-series) with Stack A; human transfer.
- **P3:** consented outbound qualification at scale (DLT/140-series), batch campaigns, Nova-Sonic/self-host cost evaluation, voice as a step inside cross-channel journeys (`09`).
