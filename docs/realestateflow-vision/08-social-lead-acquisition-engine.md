# 08 — Social Lead Acquisition & Conversion Engine

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Instagram DMs, comments and private replies are **built** (`agency-app/instagram-api`, running on dev, Meta App Review pending). WhatsApp is self-hosted Baileys carrying the **agency's own command channel**, not customer conversations; the official Cloud API move has its own plan in `39-whatsapp-official-api-plan.md`. Chatwoot was never adopted. Telegram and Facebook Messenger are dropped.

> **Scope:** turning conversations on public and private channels into leads, appointments, site visits and revenue. This is the revenue front door, not a chatbot feature. Channel-rule and India-compliance research verified June 2026 (`20`); channel decisions re-taken September 2026.

---

## 1. What this engine does today

The pipeline is real and source-agnostic. Every channel adapter normalises to one shape and everything after that point is shared:

```
  Instagram service      ManyChat webhook     Property-page booking
  (DM / comment)         (per-tenant token)   (site visit)
        │                       │                     │
        └───────────────────────┴─────────────────────┘
                                │
              POST /api/internal/adapters/leads
                                │
        agency-app/api/leadIngestion.js → ingestLead()
        dedupe → createLead() → notifyNewLead() → lead.created
                                │
   EventBridge lead.created  → lead-qualifier-handler   (Hot / Warm / Cold)
        → lead.qualified     → lead-router-handler      (assignment, 11)
        → follow-up call job  (agency-app/followup-agent
                               → agency-app/ai-calling → Exotel/ElevenLabs)
        → call outcome → score + per-minute credit billing → convertLead()
```

> Qualification, scoring and assignment are built as above. The founder is building a next-generation lead engine separately; these docs will be updated when it lands.

Every conversation still has to **end in a CRM outcome** — lead created or updated, score, task, visit, or closed with a reason. The qualification pipeline never inspects `lead.source`; it operates on `{tenantId, leadId}`. That is why adding a channel means writing an adapter, not an engine (`docs/lead-adapter-architecture.md`).

## 2. Channels: built vs not built

| Channel | Status | How |
|---|---|---|
| **Instagram DMs** | **Built** (dev; App Review pending) | Instagram Login Graph API, hosted service `agency-app/instagram-api`. See §3. |
| **Instagram comments** | **Built** (dev) | Comment read + public reply + one private reply per comment. See §3. |
| **ManyChat (Instagram flows)** | **Built** | `POST /instagram/:webhookToken` on the CRM (`agency-app/api/routes/webhooks.js`), per-tenant token from `AgencyConfig.instagramWebhookToken`. No HMAC — ManyChat does not offer it — so the token is the only secret. Dedupe key `manychat:<tenant>:<subscriber>:<post>`. |
| **Property pages** | **Built** | `public-app/property-pages` renders a tenant-branded listing page; "Schedule a visit" becomes a CRM lead plus a meeting. |
| **WhatsApp (agency command channel)** | **Built** | Self-hosted Baileys on ECS Fargate (`platform/whatsapp-platform`). Agency links its own number by QR. **Owner-only:** the CRM webhook drops anything that is not self-chat or `fromMe` as `unauthorized_sender` (`agency-app/api/routes/webhooks.js`). |
| **WhatsApp (customer conversations)** | **Not built** | Plan only. Direction is the official Cloud API — `39-whatsapp-official-api-plan.md`. See §4. |
| **Website chat widget** | **Not built** | The CRM has an internal web chat for the agent runtime (`agency-app/api/agents/channels/webChannel.js`); there is no embeddable public widget. |
| **Meta Lead Ads** | **Not built** | No lead-form retrieval anywhere in code. |
| **Portal leads** | **Not built** | Adapter design in `07 §3`. |
| **Facebook Messages / comments** | **Dropped** | No code, no demand from the ICP. |
| **Telegram** | **Dropped** | No code. Remove from marketing copy — `agency-app/landing-pages/main/index.html:28` still claims it. |

## 3. Instagram, as built

This is the channel that actually works, so it is worth describing precisely.

**Shape.** One Meta app serves every agency. An agency connects its own Instagram professional account through Connect Instagram (OAuth), and the service reads DMs, comments, posts, reels and insights, scores enquiries, hands leads to the CRM, and sends replies that a person writes or a keyword rule fires. The console lives at `/insta/*` on the CRM CloudFront distribution (`agency-app/instagram-web`).

**Graph API only.** The service never browses or scrapes instagram.com. Browser automation against Instagram risks the agency's account, which is the same reasoning that dropped portal posting (`07 §1`).

**Messaging windows are enforced in code**, not left to the next feature (`agency-app/instagram-api/services/windowPolicy.js`):

| Window | Means | What may be sent |
|---|---|---|
| `STANDARD` | They messaged us within 24 hours | A free-form reply |
| `COMMENT_REPLY` | They commented within 7 days | Exactly one private reply |
| `CLOSED` | Anything older | Nothing |

The `HUMAN_AGENT` tag is deliberately **not** offered: it needs its own Meta permission and is restricted to a human resolving a support issue. (The June draft's claim that `human_agent` extends the DM window to 7 days for us is wrong — that is the comment window, and it is one message.) Other limits handled in the product: 1000 characters per DM, the 20 most recent messages per conversation, request-folder threads idle for 30 days.

**Enquiry → lead.** `services/leadAnalyst.js` turns a DM thread into a decision a salesperson can act on: who this is, what they want, how hot they are, the next action, and a Hinglish reply draft. Providers are pluggable (`rules` — deterministic, free, offline; `gemini` when a key is set), and whatever a model returns is checked against the conversation before it is kept — a phone number is only accepted if it appears in the lead's own messages, so a model can neither invent one nor store our own number as theirs. Any model failure falls back to the rules result rather than dropping the lead. The result goes to the CRM through `services/crmBridge.js` → `POST /api/internal/adapters/leads` with `source: 'Instagram'`, `sourceAdapter: 'instagram'`.

**Autonomy: draft first, auto later.** Replies are written by a person or fired by an explicit keyword rule (`services/ruleMatcher.js`: exact, starts-with, contains, regex). On dev `INSTA_DRY_RUN_SENDS=true`, so replies are recorded rather than sent. Autonomous DM replies come after App Review and after the draft mode has been watched in production, not before.

**What is blocking.** The app is in Development Mode, so Meta only returns messages and comments from accounts with a role on the app — which is why DM and comment counts read zero on dev with a real account connected. Prod is not deployed; the `prod-realestateflow-insta-*` stacks still hold the old device-pairing build. Current state and actions: `docs/pending-items/instagram-service-status.md` and `docs/pending-items/instagram-app-review-actions.md`.

## 4. WhatsApp: what it is today, and where it is going

**Today — the agency's own command line.** Baileys (an unofficial WhatsApp Web client) runs self-hosted on ECS Fargate. A tenant links its own number by scanning a QR; one session per number; inbound messages fan out over EventBridge to the CRM's WhatsApp processor, which runs the agent (`03 §4`). The CRM webhook accepts **only self-chat or `fromMe`** messages and logs everything else as `unauthorized_sender`. So the agency owner can message their own number to ask "which leads came in today" and get an answer from the CRM. Customers cannot reach it, by design.

**WhatsApp is not a lead adapter.** The Baileys webhook never calls `createLead`; it publishes to EventBridge for the conversation processor. Making it one is new work, not a rewire (`docs/lead-adapter-architecture.md` Phase 5), and it needs the phone GSI first.

**Where it is going — official.** Baileys is an unofficial protocol with real ban and ToS risk, which is acceptable for the agency's own number and not acceptable for customer messaging at scale. The direction is the **WhatsApp Business Cloud API**, possibly through a BSP; **AiSensy is being evaluated** for that move. The plan, including the Tech Provider vs BSP choice and the migration path off Baileys, lives in **`39-whatsapp-official-api-plan.md`**. Do not re-litigate it here.

Two things worth carrying into that plan:

- **Economics.** Since 1 July 2025, WhatsApp charges per delivered **template**, by category and country. Service conversations are free, all free-form replies inside an open 24-hour window are free, and Utility templates are free inside that window. Only Marketing and Authentication templates — and Utility outside the window — cost money. India indicative rates were Marketing ~₹0.78–0.86 and Utility/Auth ~₹0.13 per message in June 2026; verify against the live rate card. The design implication is simple: answer fast enough to stay inside the 24-hour window, and prefer Utility over Marketing templates.
- **AiSensy today is not the WhatsApp channel.** It is used for exactly one thing: the AI-Employee onboarding broadcast after a successful payment (`agency-app/api/routes/billing.js`). Any claim that the product "connects to the WhatsApp Business API" — including `agency-app/landing-pages/main/index.html:28` — is ahead of the code and needs fixing.

## 5. Considered, not adopted: Chatwoot as the omnichannel inbox

The June design adopted Chatwoot Community Edition, self-hosted, as the ingestion and human-agent inbox layer. It was never built and is **not the path**.

Why it was attractive: one deployment speaking WhatsApp, Messenger, Instagram, Telegram, website chat and email, with a unified conversation model, agent assignment, webhooks and bot APIs; MIT-licensed and self-hostable, so PII stays in our AWS account.

Why it was dropped:

- The channel list it bought us is mostly channels we have now **dropped** (Telegram, Messenger) or already built directly (Instagram).
- Chatwoot CE shares one deployment and database across accounts, so tenant isolation would have been logical rather than hard — and the workaround (per-tenant instances) is an operations burden a solo founder should not take on.
- SLA management, audit logs and custom dashboards are Enterprise-only, so we would have built our own anyway.
- It does not bypass a single Meta approval or window rule. The hard part of Instagram was `windowPolicy.js`, and Chatwoot would not have written it.

The L2 adapter boundary (`03`) is what actually delivered the benefit: channels are swappable without touching agents. That boundary exists today as `ingestLead()`.

## 6. Conversation → CRM outcome, in code

1. **Ingest and dedupe.** `dedupeKey` through `logEventIfNotProcessed` in `agency-app/api/leadIngestion.js`, plus `WebhookLog`. No Redis anywhere in the stack — the June draft's "Redis idempotency" was never built and is not needed.
2. **Resolve the contact.** Phone lookup over the tenant's lead partition; a batch does one `buildLeadPhoneIndex()` query for the whole upload, so two enquiries from the same person in one batch collapse onto one lead. **Known race:** two adapters ingesting the same phone concurrently can both create; rare at current volumes, recoverable by merging, and properly fixed by a conditional write on a phone-uniqueness item.
3. **Create or update the lead.** One row in `CrmTable`, `EntityType: 'LEAD'`, `PK TENANT#<t>#LEAD#<id>`. Source and `sourceAdapter` are stamped for attribution.
4. **Notify and emit.** `notifyNewLead()` then `lead.created` on the EventBridge default bus.
5. **Qualify.** `lead-qualifier-handler.js` scores Hot / Warm / Cold and emits `lead.qualified` (`09`, `10`).
6. **Assign.** `lead-router-handler.js` routes through the agent runtime (`11`).
7. **Follow up.** `agency-app/followup-agent` schedules `site_visit_confirmation` and `post_visit_feedback` calls, up to 2 attempts 45 minutes apart inside business hours, escalating to the assignee and admins when the customer asks for a human or attempts run out. Conversation state and per-minute call billing are written back.
8. **Convert.** `convertLead()` to Buyer / Owner / Customer, or closed with a reason. Nothing is deleted — archive instead.

**Conversation storage.** WhatsApp messages and conversation state are rows in the CRM table under `TENANT#…#WHATSAPP#…` (`agency-app/api/whatsappConversationService.js`, `conversationStateService.js`); Instagram threads live in the Instagram service's own table and are bridged as leads. There are no separate `Conversations` / `Messages` tables — that June design was not built.

## 7. Compliance

- **DPDP Act 2023.** Capture consent at intake, record purpose, support access and deletion requests. The grievance flow exists, and the App Review pack shipped `agency-app/landing-pages/legal/data-deletion/` plus the Instagram section of the privacy policy, which names the agency as controller of the people who message it. Data stays in `ap-south-1`.
- **Meta platform policy.** Respect the windows in §3, template approval and quality ratings; do not spam comments. A Green/Yellow/Red quality rating governs messaging limits — protect it. Instagram access is Graph API only.
- **Consent for calls.** Outbound voice is consent-at-intake, and DLT registration is required before any bulk calling (`12`).
- **WhatsApp opt-in** is required for proactive outreach and must be recorded per contact — a requirement for `39`, not something Baileys gives us.

## 8. KPIs

Time to first response (target under 60 seconds, 24/7), capture rate (conversations → leads), qualification rate, conversation → site-visit rate, channel-level CAC and ROI via source attribution, WhatsApp quality rating once official, cost per conversation against the credit meter (`17`).

Note these are **targets**, not measurements. The product is pre-launch with no customers, so there is no baseline yet.

## 9. Roadmap

Phases, not dates. These are this engine's slice of the Phase A → B → C plan in `21`.

**Phase A — M1 launch.** Pass Meta App Review and deploy the Instagram service to prod. Instagram DMs and comments in **draft-first** mode with keyword rules. ManyChat and property-page booking adapters stay as they are. WhatsApp remains the agency command channel only.

**Phase B — hardening.** Instagram auto-reply for narrow, safe intents once draft mode has been watched in production. The official WhatsApp Cloud API channel per `39`, including opt-in capture, templates and the Baileys migration. Website chat widget. Attribution reporting on `source` / `sourceAdapter`.

**Phase C — growth.** Portal lead ingestion (`07 §3`), Meta Lead Ads, graduated autonomy per tenant, full channel-level ROI analytics, tenant social publishing through the Instagram service.

**Not on the roadmap:** Telegram, Facebook Messenger, Chatwoot, browser automation against any platform.
