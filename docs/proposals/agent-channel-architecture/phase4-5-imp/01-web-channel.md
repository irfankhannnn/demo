# Phases 4 & 5 — Channel-aware compose, and the in-CRM web chat

**Status: ✅ Both complete.** WhatsApp behaviour is unchanged by default; the web channel is new.

These shipped together because they are one idea split across two phases: Phase 4 gives the composer a per-channel length budget, and Phase 5 is the channel that needed one.

---

## Phase 4 — Channel-aware compose

`buildComposerSystemPrompt(personality, channel)` now selects a length budget and a formatting vocabulary. **What it does not change is the grounding**: "use only facts present in the JSON", "never invent names, numbers, IDs or statuses", "no internal IDs", "no chain-of-thought" are identical on every channel and are asserted so by test.

That symmetry is the whole safety property. A channel that gets more room to write must not also get more room to embellish — so the rules that constrain *truth* are shared and only the rules that constrain *shape* vary.

| | WhatsApp | Web |
|---|---|---|
| Budget | 400–700 chars, ~900 ceiling | 800–2000 chars |
| Markup | Plain text, `*bold*` only | Markdown: bullets, `**bold**`, `##` |
| Long lists | Top few + "aur 10 hain, dikhau?" | Top ~10 + remaining count |

**Why a prompt-level budget, not truncation.** Cutting a composed reply at N characters yields a sentence that stops mid-word, and on WhatsApp `chunkWhatsAppText` would then split that again at an arbitrary point. Asking for the right length up front is the only approach that produces a reply which reads as finished. The 4000-char chunker stays exactly as it was — a safety net for a model that ignores the budget, not a formatting step.

**An unknown channel degrades to WhatsApp**, not to "no limit". A typo in a channel name should fail toward the stricter format.

`channel` defaults to `'whatsapp'` at every layer, so every pre-Phase-4 call site produces a byte-identical prompt.

---

## Phase 5 — The web channel

### The core needed almost nothing

`CONVERSATIONAL_AGENTS` went from `['whatsapp']` to `['whatsapp', 'web']`. That one-line change is the return on the Phase 2 extraction: the web channel runs the *same* classify → plan → execute → compose pipeline against the *same* tool registry. There is no second agent, and no tool exists on one channel but not the other.

Two small additions were genuinely needed:

- **Caller-supplied history.** `getConversationContext` is keyed by phone number. The web channel has no phone, so it passes `conversationHistory` directly and the phone lookup is skipped. History is client-supplied and therefore treated as untrusted: capped at 20 turns, each truncated, and **every role coerced to `user` or `assistant`** — a forged `role: 'system'` entry must not become a system instruction.
- **Progress hooks.** `onToolStart` / `onToolEnd` fire around each tool call so the UI can say "Searching leads…" instead of showing a spinner. Both are wrapped in try/catch: a UI hook must never be able to abort a turn.

### What the web channel deliberately does NOT reuse

`prepareConversationalTurn()` applies business-hours pausing, phone-based access control and phone-based category resolution. Every one is wrong here, and reusing it "for consistency" would have been the easy mistake:

- **Business hours** exist so the bot does not answer a *customer* at 2am. The web user is the broker, inside their own CRM. Refusing to answer them out of hours would be a bug.
- **Phone allowlists** answer "is this stranger allowed to message us?". A web turn has already passed JWT auth and tenant scoping.
- **`resolveCategory(phone)`** classifies an outside contact as lead/customer/spam. A logged-in colleague is none of those.

### Identity — better than WhatsApp's, and it exposed a gap

The web channel has a real per-user id, so RBAC is per-person rather than per-number.

But **`setUserCategory` is never called anywhere in this codebase**. No user has a `CATEGORY#USER` row, and the permission check is fail-closed — so passing a real `userId` would have denied every tool call. The identity model that *is* populated is the JWT role, so `categoryForCrmRole()` maps it:

| Role | Category |
|---|---|
| FOUNDER / OWNER / ADMIN | `admin` |
| MANAGER | `team_lead` |
| MEMBER | `agent` |
| anything else | `viewer` (read-only) |

An unrecognised role falls to read-only rather than to a write-capable default: a role nobody has decided the privileges for should not be able to write.

### Streaming, honestly

The route speaks SSE. **In the current deployment the events do not arrive incrementally**: the Lambda entry point is `@vendia/serverless-express`, which buffers, and the plan's assumed API Gateway REST `ResponseTransferMode: STREAM` is still recorded as unverified. The client receives the full event sequence at once, at the end.

That is a deliberate choice rather than a compromise. The wire format is SSE either way, so the client is written once; moving this route behind a Lambda Function URL with `awslambda.streamifyResponse` — the fallback the plan itself names — makes it stream for real with **no client change and no server change**. Under plain Express locally, it already streams. The alternative, shipping buffered JSON now and rewriting both sides later, means building the client twice.

`EventSource` is not used on the client because it cannot send an `Authorization` header or a POST body. The stream is read off `fetch` and the frames parsed by hand, which is what every authenticated chat client does.

### The deadline problem

The tool loop's budget is 25s and the API Lambda's timeout is 30s — classify and compose sit on top of that. A long multi-step web turn could be killed by the platform and return **nothing at all**, which is strictly worse than stopping early and answering with what it has. The web adapter therefore passes `toolLoopBudgetMs` (default 18s, `AgentWebToolLoopBudgetMs` in CFN).

The plan's dedicated longer-timeout Lambda for this route remains the right answer, and is what would make a larger budget safe. This bound is what makes the route correct *without* it.

### Frontend

- `MarkdownLite.tsx` — a deliberately tiny renderer for the exact subset the composer prompt asks for. **No `dangerouslySetInnerHTML` anywhere**, so a reply containing `<script>` renders as literal text and can never execute. Chosen over `react-markdown` for that reason more than the dependency: every general-purpose Markdown renderer ultimately emits HTML, and raw-HTML passthrough is one config flag away from being an XSS hole in a surface that renders *model output*.
- `EntityCards.tsx` — turns tool results into clickable rows. This is what makes it a CRM assistant rather than a chatbot. Defensive throughout: payload shapes vary (some tools use the AI-DTO envelope, some do not), so an unidentifiable record is skipped rather than rendered blank.
- `AiChatPanel.tsx` — full-screen on a phone, side sheet from `sm:`. Enter sends, Shift+Enter breaks; Esc closes; an in-flight turn can be stopped.
- `AiAssistantLauncher.tsx` — hidden on the same routes as `BottomTabBar`, and positioned to clear both the tab bar and the NPS card.

The transcript lives in component state only. It is replayed as prompt context but never persisted — persisting it means another table, a retention policy and a PII surface, none of which are needed to make the feature useful.

---

## A bug this work introduced, and how it was caught

Moving the permission identity onto the `invokeSkill` calls put the derivation in `invokeAgent` but the *use* in `runConversationalPipeline` — a different function. Every WhatsApp tool call would have thrown `ReferenceError: permissionIdentity is not defined`.

**The full 614-test suite stayed green.** `invokeAgent` catches everything and returns a graceful *"Sorry, I could not process that right now"* for conversational agents, so a hard crash presented as a polite degradation. Nothing in the suite drove the tool-execution branch with the module actually loaded.

The fix is one moved block. The lesson is the test that now exists: `agentRuntime.pipeline.test.js` runs the real pipeline body end-to-end with mocked collaborators, and was **verified to fail with the exact ReferenceError** before the fix was restored. A suite that never executes a code path cannot regress it, and a broad catch turns that blind spot into a silent one.

---

## Verification

- **654 server tests green**, up from 614 — 40 added across `composerPrompt`, `webChannel` and `agentRuntime.pipeline`.
- `vite build` passes; `tsc --noEmit` reports nothing new in the added files.
- CFN parses: 115 parameters, 93 resources.

## Follow-up shipped

The assistant now also exists as a **full page** at `/crm/assistant`, with an Assistant/CRM switch, conversation threads, a `+` menu of CRM flows and quick-action chips. See [`02-assistant-page.md`](./02-assistant-page.md). The floating launcher and side sheet described above are unchanged.

## Not done

- **Token-by-token streaming of the composed reply.** The events stream, but compose is a single `generateContent` call, so the reply arrives whole. `generateContentStream` plus a `token` event is the natural follow-up, and needs the real streaming entry point above to be worth anything.
- **Cross-channel session continuity.** The plan lists a WhatsApp conversation being visible on the web as optional. Both channels key the same store, so the plumbing exists, but nothing joins `wa:<phone>` to `web:<userId>` — that needs a deliberate identity link, not a guess.
