# The full-page assistant

**Status: ✅ Built, unproven against a live backend.** Typechecks clean, `vite build` passes, and every interaction below was driven in a real browser against a dev server. No turn has run against the deployed API yet — the backend is not up.

Phase 5 shipped the assistant as a floating launcher and a 420px side sheet. This adds the surface it was always going to need: a page, in the navigation, with room to work.

---

## What was asked for

A page modelled on Claude's desktop home — greeting, a large composer, a `+` menu of flows, and a row of predefined actions under the box — plus **a tab in the top middle that switches between the chat and the CRM homepage**.

## Where each piece landed

| | File |
|---|---|
| The page | `pages/crm/Assistant.tsx` |
| Assistant ↔ CRM switch | `components/ai/WorkspaceSwitch.tsx` |
| `+` menu (flows) | `components/ai/AssistantPlusMenu.tsx` |
| Quick-action chips (prompts) | `components/ai/QuickActions.tsx` |
| Anchored menu primitive | `components/ai/Popover.tsx` |
| Thread persistence | `components/ai/assistantThreads.ts` |
| Shared audio-upload rules | `utils/audioUpload.ts` |

Route: `/crm/assistant`, behind the same `ProtectedRoute` as every other CRM screen.

`MarkdownLite`, `EntityCards` and `agentChatApi` are reused unchanged. The floating launcher and side sheet are untouched and still work everywhere — except on this page, where a button that opens a sheet over the same conversation would be nonsense, so it hides itself.

---

## The switch is a router, not a tab

It navigates between two routes rather than toggling a panel. The CRM dashboard is 900 lines with its own polling, modals and data fetching; mounting it inside the assistant page to satisfy the tab metaphor would run all of that twice and break the back button. Two routes with one shared control reads identically and costs nothing.

**It sits on its own centred row, on both pages** — not inside the header line. Centring it *within* the header worked on the assistant, whose header is sparse, and collided badly on the dashboard: that header's right-hand cluster (date, bell, Members, Analytics, Profile, Logout) runs far enough left that an absolutely-centred element lands on top of it even on a wide desktop. A control meant to feel like one fixed thing the page changes behind cannot sit in two different places, so both pages use the row.

---

## `+` versus the chips

The split is deliberate, because "put everything in both" is the failure mode:

- **`+` launches flows** — things with a screen, a file picker or a form behind them: upload a call recording, open the WhatsApp inbox, start a lead form.
- **Chips send prompts** — things the agent answers in the chat.

**Every chip prompt maps to a tool that actually exists.** The list was written against the live registry in `agency-app/api/shared/toolDefinitions.js`. That check earned its keep immediately: there is no "add a khata entry" chip, because khatabook is deliberately **read-only** to the agent. Offering it would have taught a capability that then refuses. Creating a khata entry sits in the `+` menu instead, where it opens the real form.

Prompts come in two kinds. `send` fires immediately, for phrasings that are complete. `prefill` drops the text in the composer with the caret at the end, for the ones where the user has to supply a name or an area — sending `"2BHK in "` on its own would just make the agent ask.

---

## Security

**Nothing in this UI decides what the user may do.** Every turn goes to `POST /api/crm/agent-chat`, which runs `validateToken` → `extractTenantId` → `requireCrmMemberOrAbove`, then the same classify → plan → execute → compose pipeline over the same 73-tool registry as WhatsApp. Tenant scoping and per-tool RBAC — derived from the JWT role by `categoryForCrmRole` — are enforced on the server, per tool call.

So a viewer who taps "Create a lead" gets exactly the refusal they would get by typing it. Client-side gating would hide capability from people who have it and grant nothing to people who don't, so there is none.

The pieces that *are* this file's responsibility:

**Transcripts are scoped and disposable.** Threads live in `localStorage` under `assistant_threads_v1:<userId>` — never on a server. A server-side store means another table, a retention policy and a fresh PII surface for a feature whose value is "still here after I refresh". Two consequences follow, and both are wired:

- Every key carries the signed-in `userId`, so colleagues sharing a machine never read each other's threads.
- **Logout wipes every namespaced key**, not just the current user's (`clearAuth` / `clearAuthSilently` in `utils/authStorage.ts`). Signing out must not leave a readable transcript behind on a shared device. The sidebar also carries "Clear all chats".

**Everything read back out of storage is untrusted.** It can be hand-edited or left by an older build, so each turn is revived through a coercion that narrows `role` to the two the UI renders and drops anything malformed.

**Rendering stays inert.** `MarkdownLite` uses no `dangerouslySetInnerHTML`, so a reply containing `<script>` renders as literal text. That matters more here than anywhere else in the app: this surface renders model output.

**One allowlist for uploads.** The `+` menu's recording upload reuses the presigned-URL flow, and the MIME allowlist and size cap moved to `utils/audioUpload.ts` so the Call Recordings page and this menu enforce the *same* list. Two copies of a security-relevant allowlist drift, and one of them ends up permissive. The client checks are a courtesy — the server re-validates before signing — but they stop a 200 MB upload before it starts.

**Storage is best-effort throughout.** A private window, a full quota, or a browser blocking site data all surface as "no persistence", never as a crash.

---

## Four bugs the browser found

None of these would have shown up in a typecheck or a build. All were caught by driving the real UI.

### The `+` menu opened off the top of the screen

Nine rows tall, anchored to a composer sitting low on the page, opening upward — the first two groups were above the viewport with no way to scroll to them.

`Popover` now measures on open and **flips to the side with more room**, capping its height and scrolling inside when neither side fits. It runs in a layout effect so the corrected position is committed before paint; in a plain effect the menu visibly jumps.

### The open menu rendered behind the chips

It read as the menu being transparent. It was not. The composer carried `backdrop-blur-sm`, and **a `backdrop-filter` creates a stacking context** — which trapped the menu's `z-50` inside the composer's box, so the quick-action chips, later in DOM order, painted straight over it.

Dropped the blur (it bought almost nothing over `bg-white/90`) and gave the composer an explicit `relative z-20`, which is what keeps the menu above its siblings for good.

### Prefill set the text but lost the caret and focus

The obvious `requestAnimationFrame` version does not work: the frame can run before React has committed the new value, so `setSelectionRange` acts on the *old* text and the re-render drops the caret back to 0 — and focus never lands. Measured live: `{value: "Naya lead banao: ", selStart: 0, focused: false}`.

Fixed by bumping a counter and moving the caret in an effect keyed on it, which is guaranteed to run after the DOM holds the new value. Now: `{value: "2BHK in ", selStart: 8, focused: true}`.

### The switch overlapped the dashboard's own header controls

Covered above. Found by rendering the dashboard with a stubbed API and looking at it.

---

## Two things written to avoid a classic

**`Composer` is declared at module scope**, not inside the page component. A component defined inside another is a new type on every render, so React unmounts and remounts it — the textarea would lose focus and its caret on every keystroke.

**`send` reads `threads` and `activeId` through refs.** It is handed to child components and to the keyboard handler; reading them from the closure would replay whatever the transcript was when the callback was created.

---

## Also fixed along the way

The header's "New chat" button hides its label below `sm:`, which left an **unnamed icon button on exactly the surface most brokers use**. It now carries an `aria-label`.

---

## What was verified, and what was not

Driven in a browser against `vite dev`, with a seeded profile and no backend:

- the page renders, the greeting resolves from the profile, all six chips fit one row
- the `+` menu opens, flips, scrolls and paints above its siblings
- a chip popover flips the other way when the room is below instead of above
- prefill lands the text with focus and the caret at the end
- sending creates a thread, renders the user turn, shows tool activity, and renders the failure as an error turn without wedging the busy state
- a full reload restores the thread from storage
- the switch navigates to `/crm` and the launcher reappears there

**Not verified:** a successful turn. That needs the backend, so entity cards, markdown replies and the tool-activity labels have rendered only against a failure path so far.

---

## Not done

- **Voice input.** A mic using the browser `SpeechRecognition` API is a natural fit for Hinglish dictation, but it is Chromium-only and was not asked for.
- **Inline confirmation for writes.** The agent creates and updates records directly. A "here is what I am about to change — confirm?" card would tighten the trust story on a surface that can write to the CRM.
- **Cross-device threads.** Deliberate, per the storage decision above.
- **Page context.** On a lead's page, "schedule a meeting" could default to that lead. The turn does not carry the current route today.
