# 39 — Going official on WhatsApp (Cloud API), and where AiSensy fits

> **Status (17 Sep 2026):** Proposed plan, awaiting founder approval. Founder decision D9 set the direction: self-hosted Baileys stays only as the staff command channel, customer messaging moves to the official WhatsApp Business Platform, Chatwoot is dropped. Everything under "As built" was checked against the code on this branch; everything under "Meta rules" was read from Meta's docs on 17 Sep 2026 and carries a source link.

**Who this is for:** the founder (what to do, what it costs, what to decide) and whoever builds the adapter.

---

## 1. The short version

| Question | Answer |
|---|---|
| What is live today? | One self-hosted Baileys gateway (`platform/whatsapp-platform`). It powers the **owner's self-chat command channel** — the owner messages their own number and the AI Employee runs CRM tools. Customer messages are **dropped** (`agency-app/api/routes/webhooks.js:162-176`). |
| Is the landing-page claim true? | Not yet. `agency-app/landing-pages/main/index.html:28,217` says RealEstateFlow "connects to the WhatsApp Business API". Fix the copy or ship the adapter. |
| What should we build? | Become a Meta **Tech Provider** with our own Meta app, onboard each agency through **Embedded Signup v4** with **coexistence**, and put every send behind a `WhatsAppTransport` interface so Baileys and Cloud API are swappable. |
| Should we use AiSensy? | **Yes for RealEstateFlow's own marketing number, now. No for the product feature.** AiSensy adds roughly 26% on every template and a per-agency plan, and our AI needs raw inbound events. |
| What does it cost per agency? | About **₹715/month** in Meta fees for an agency doing 300 new leads/month, versus roughly ₹2,200–4,000 through AiSensy. Detail in §5. |
| How long? | Realistically **6–10 weeks** from starting the Meta paperwork to the first agency live, and that assumes Business Verification and the HTTPS legal pages get done first. |
| Biggest risk | Baileys is a reverse-engineered client. A ban hits **the agency's own business number**, which is the number their customers use. See §7. |

---

## 2. As built

### 2.1 The Baileys gateway

| Fact | Evidence |
|---|---|
| Multi-tenant self-hosted service on `@whiskeysockets/baileys` 6.7.23, ECS Fargate (Spot with on-demand fallback), up to 100 sessions per task | `platform/whatsapp-platform/README.md:1-4`, `package.json:21`, `infra/cfn-platform.yaml:504-577` |
| Session auth state in S3 (KMS-encrypted) + DynamoDB metadata, PITR on, `DeletionPolicy: Retain` | `infra/cfn-platform.yaml:206-337` |
| API: `POST /v1/pairing/qr`, `GET /v1/pairing/status/:phone`, `GET/DELETE /v1/sessions/:tenantId`, `POST /v1/pairing/logout`, `POST /v1/messages/send` | `src/routes/pairing.js:14-79`, `src/routes/messages.js:11-21` |
| If a send omits `from`, it goes out from the platform-wide `DEFAULT_SESSION_PHONE` | `src/baileysClient.js:756-758`, `src/config.js:66` |
| Inbound is forwarded to EventBridge (`whatsapp.incoming` / `message.received`) and, locally, to `CRM_WEBHOOK_URL` signed with HMAC | `src/events/index.js:54-79`, `README.md:95-113` |
| dev runs at DesiredCount 0 (stopped by default) | `README.md:153-161` |

### 2.2 The CRM side

- **There is no provider abstraction and no Cloud API code.** `agency-app/api/bailey.js` is a direct HTTP client, imported by name in 10 places (`leadNotifications.js:275`, `routes/auth.js:6`, `routes/whatsappConversations.js:13`, `routes/webhooks.js:4`, and the crons `expiring-agreements`, `incomplete-data`, `lead-followup`, `team-summary`, `whatsapp-message-processor`). A `WhatsAppTransport` interface has to be introduced; nothing existing can be reused except the call sites.
- Transport-neutral helpers worth keeping: `agency-app/api/utils/whatsapp.js:12-52` (`normalizeWhatsAppPhone`, `buildWhatsAppPrincipal` → `wa:<phone>`, `classifyWhatsAppId`) and `chunkWhatsAppText` (`bailey.js:66-73`).
- Message log: `PK = TENANT#<t>#WHATSAPP#<contactPhone>`, `SK = MESSAGE#<ts>#<messageId>` with GSI3 and dedupe rows (`whatsappConversationService.js:9-53,170-202`). Agent memory keyed `wa:<phone>`, 24 h TTL (`conversationStateService.js:22-23`). All of this is transport-neutral and survives the move.
- Tenant ↔ number: exactly one `AgencyConfig.connectedWhatsAppPhone` per tenant, GSI-indexed (`cfn-backend.yaml:1072-1095`), linked by QR scan (`agency-app/web/src/pages/onboarding/ConnectWhatsApp.tsx:49-208`). There are **no** `wabaId`, `phoneNumberId`, token, template or opt-in fields.
- **No per-contact consent record exists.** Access control is blacklist / whitelist / category only (`whatsappAccessControl.js:43-167`). The official platform requires opt-in.

### 2.3 What WhatsApp actually does today

| Use | Direction | Evidence | What the official API changes |
|---|---|---|---|
| Staff command channel (owner self-chat → AI Employee) | owner → own number | `routes/webhooks.js:162-176`, `scripts/whatsapp-message-processor.js:60-68` | **Self-chat does not exist on the Cloud API.** Needs a redesign: staff message a RealEstateFlow platform number from their own phones, authorised by a staff-phone allowlist (`AI_ADMIN_WHATSAPP_NUMBERS`, `cfn-backend.yaml:598-601`) |
| Manual send from the CRM WhatsApp inbox | tenant number → contact | `routes/whatsappConversations.js:94-126` | Must respect the 24 h window, else send a template |
| Lead follow-up autosend (04:00 IST cron, `autosend` mode) | → **leads** | `scripts/lead-followup-cron.js:45-50,113-117` | Business-initiated outside the window needs an approved template **and** opt-in. It also passes no `from`, so today it would go out from the platform default number — a real bug, and a reason to force `draft` mode now |
| Escalations to staff, daily digests to the owner | → staff / self | `leadNotifications.js:272-285`, `team-summary-cron.js:113` | Self-send is impossible; move to a platform number as utility templates, or to email/push |
| AiSensy campaign send after an AI Employee purchase | RealEstateFlow → its own customer | `routes/billing.js:81-97,230-235` | Already official. Note the code calls `/campaign/t1/api` while AiSensy documents `/campaign/t1/api/v2` — verify it still works |
| WhatsApp as a lead adapter | not built | `docs/lead-adapter-architecture.md:249-254` | The Cloud API webhook is the natural adapter |

### 2.4 What the Instagram service already solved (and we reuse)

`agency-app/instagram-api` gives us, unchanged: AES-256-GCM per-tenant token encryption (`services/metaSecurity.js:1-57`), the webhook verify-token handshake and `X-Hub-Signature-256` check over the raw body (`routes/webhooks.js:21-47`), deauthorize/data-deletion callbacks (`routes/meta.js:27-49`), a 24 h window policy module (`services/windowPolicy.js`), the cross-tenant registry pattern for routing a Meta id to a tenant, and dry-run sends. The connect flow does **not** carry over: Instagram uses Instagram Login, WhatsApp uses Facebook Login for Business on a Business-type app.

### 2.5 Shared blockers (these gate Instagram App Review too)

1. `realestateflow.in` legal pages must load over HTTPS — privacy, terms, data deletion (`docs/pending-items/instagram-app-review-actions.md:13-21`).
2. **Business Verification for Cloudberry IT Solutions is not done** (`docs/agency-app/instagram/10-APP-REVIEW.md:24,50-54`).
3. App Review with a reviewer login.

Doing these once unblocks both channels.

---

## 3. The rules we have to build to

Sources: Meta's business-messaging docs, read 17 Sep 2026.

**Account structure** ([get-started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started), [phone numbers](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers))
- Business portfolio → WABA(s) → business phone numbers. A new portfolio may register **2** numbers, raised to **20** once verified.
- A number must be one you own, able to receive an OTP, and **not active on WhatsApp** unless you use coexistence. Two-step PIN is mandatory.
- Messaging limits are tiers of **250 / 2,000 / 10,000 / 100,000 / unlimited** unique users per rolling 24 h, counted only for messages delivered **outside** an open service window, and they are now set **per business portfolio**, shared by all numbers ([messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)).
- The green tick (Official Business Account) needs 30 days on the platform, a verified portfolio, two-step verification and an approved display name ([OBA](https://developers.facebook.com/documentation/business-messaging/whatsapp/official-business-accounts)).

**Partner types** ([solution providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview))
- **Solution Partner (BSP)** — has a credit line, bills the client (AiSensy, Gupshup, Wati, Interakt, 360dialog, Twilio).
- **Tech Provider** — full platform access, no credit line; **each client adds its own payment method and Meta bills them directly**. This is what we would become.
- Becoming one needs: a Meta app with the WhatsApp use case, Business Verification, and App Review for Advanced access to `whatsapp_business_messaging` + `whatsapp_business_management`, including two screencasts (sending a message, creating a template).

**Embedded Signup** ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview))
- A Facebook-Login popup where the agency picks/creates its portfolio, WABA and number, verifies by OTP and grants our app access. It returns WABA id, phone number id and a code.
- We must exchange that code for a business-integration system-user token **within 30 seconds**, then `POST /<WABA_ID>/subscribed_apps` and `POST /<PHONE_NUMBER_ID>/register` with a 6-digit PIN.
- Onboarding cap: **10 new businesses per rolling 7 days**, rising to **200** after App Review + Business Verification.
- **Build on v4 — v2 is deprecated on 15 Oct 2026.**

**Coexistence** ([business-app onboarding](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)) — the feature that makes this sellable to Indian brokers: the owner keeps using the WhatsApp Business app on their phone (2.24.17+) on the same number while the API also sends and receives. Contacts and the last 6 months of chat sync. Messages the owner sends from the app stay **free**. Costs: throughput fixed at 20 mps (irrelevant at agency scale), broadcast lists disabled in the app, no groups sync. Meta's page lists no country restriction; vendors report India works — **verify on a real Indian number before promising it**.

**Pricing** ([pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), INR rate cards)
- Since 1 Jul 2025: per delivered **template**, priced by category and recipient country. Volume tiers apply to utility and authentication.
- **Free entry point:** a lead arriving from a Click-to-WhatsApp ad or a Page CTA makes everything free for **72 hours**.
- **From 1 Oct 2026 free-form service messages become billable** at the utility rate, after **1,000 free service messages per number per month**, and utility templates inside the window become billable again.
- **INR billing** for India Sold-To businesses since 1 Jan 2026; all WABAs must be migrated to INR by 31 Dec 2026.

India list rates, INR per delivered message, before GST:

| Category | Rate |
|---|---|
| Marketing | 0.8631 |
| Utility | 0.1150 |
| Authentication | 0.1150 |
| Authentication-international | 2.4971 |
| Service (free-form in window) | free until 30 Sep 2026; then 0.1150 after 1,000/number/month |

**Templates** ([templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)) — three categories, automatic review "up to 24 hours", 250 templates per WABA unverified and up to 6,000 verified, max 100 creations per hour. Outside the 24 h window, a template is the only thing that can be sent. For us: site-visit confirmations and reminders are **utility**; new-listing and price-drop nudges are **marketing**.

**Webhooks and throughput** — CA-signed TLS, the same handshake and `X-Hub-Signature-256` scheme the Instagram service already implements; non-200 retried for **up to 7 days** (so idempotency on `wamid` is mandatory); per-WABA and per-number callback overrides are available; default throughput 80 mps ([webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview), [throughput](https://developers.facebook.com/documentation/business-messaging/whatsapp/throughput)).

**Policy and law**
- [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/): you need the number **and** opt-in permission; honour every opt-out; automation is allowed but a "prompt, clear, and direct" path to a human must exist. Real estate is not a restricted category.
- Business Solution Terms since 15 Jan 2026 bar **general-purpose** AI assistants. A purpose-specific agent that qualifies leads and books visits is fine — so the AI Employee must stay scoped to the agency's listings, visits and follow-ups.
- **DPDP Act 2023 + 2025 Rules:** each agency is the data fiduciary, RealEstateFlow the processor (DPA template at `marketing-and-sales/launch-implement/pre-launch/01-legal/dpa-template.md`). Store consent (purpose, source, timestamp, text shown), map STOP to withdrawal, and treat erasure as an explicit logged action — never a silent delete.
- TRAI's DLT rules cover SMS and voice, not WhatsApp; they still apply to our AI calling (decision D16).

---

## 4. Recommendation

### 4.1 RealEstateFlow's own marketing number → AiSensy now, our own platform later

Finish the AiSensy onboarding that is already half-done (`marketing-and-sales/launch-plan-v2/00-DAILY-STANDUP-TEMPLATE.md:69`) on a **fresh number** — not a Baileys number, not the founder's personal number. It gives a usable inbox, broadcasts and Click-to-WhatsApp ads without waiting on our engineering, and `routes/billing.js` already calls its campaign API. Top up the wallet before 1 Oct 2026 when service messages start costing money. Once our own adapter is live, migrate that number into our WABA so RealEstateFlow's leads are answered by RealEstateFlow's own AI Employee — the best demo we can give.

Do **not** do cold WhatsApp outreach from it. The policy needs opt-in, and the launch plan's "personal number, ≤15/day" cold channel should be dropped or limited to people who asked to be contacted.

### 4.2 The product feature → Meta direct, as a Tech Provider

| | **Meta direct (Tech Provider + Embedded Signup)** | **AiSensy partner / white-label** | **Hybrid: our app + a BSP credit line** |
|---|---|---|---|
| Who pays Meta | each agency, in its own WABA | AiSensy wallet, we resell | the BSP's credit line; we bill |
| Markup on messages | **0%** | ~26% (₹1.09 vs ₹0.8631 marketing) | 360dialog 0% + €250/month + channel fees |
| Control of inbound/outbound | full — Meta webhooks straight to us | through their APIs; free-form session sending unverified | full with 360dialog |
| Meta paperwork for us | Business Verification + App Review | white-label: none; Direct API: the same as going direct | the same as going direct |
| Friction for the agency | Facebook login, OTP, **add a payment method in Meta Billing Hub** | AiSensy signup + wallet | none — they pay us |
| Lock-in | none | high | medium |

**Go Meta direct**, but build behind a `WhatsAppTransport` interface so a BSP credit line can be added later if "add a payment method in Meta" turns out to lose too many small brokers. 360dialog's Partner plan is the cleanest fallback because it passes Meta's rates through at 0%.

AiSensy white-label does not fit the product: our AI Employee needs raw inbound events and session messages under our own control, and every agency would carry an AiSensy plan plus the markup. Its "Direct API" partnership requires the same Meta Tech Provider approval we'd need anyway, with unpublished fees on top.

---

## 5. What it costs

Illustrative agency, 300 new leads/month, Meta list rates from 1 Oct 2026, before GST:

| Traffic | Volume | Rate | Cost |
|---|---|---|---|
| AI replies inside the 24 h window (~8 per lead) | 2,400 service messages, first 1,000 free | ₹0.115 | ₹161 |
| Site-visit confirmations and reminders (utility) | 300 | ₹0.115 | ₹35 |
| Follow-up nudges outside the window (marketing, 2 per lead) | 600 | ₹0.8631 | ₹518 |
| Leads from Click-to-WhatsApp ads | any | free for 72 h | ₹0 |
| **Total Meta cost** | | | **≈ ₹715/month** |

The same traffic through AiSensy is roughly ₹700 in messages **plus** a ₹1,500–3,200 plan per agency, so ₹2,200–4,000+. Our AWS cost at this volume is tens of rupees.

**Pricing consequence (feeds doc 38):** WhatsApp message fees are real per-message costs that scale with outreach, so they belong in the Contacts unit or passed through — not absorbed in a flat plan. Marketing templates in particular must never be unlimited.

---

## 6. Plan

Phases, no dates (decision D13).

**Phase 0 — unblock Meta (founder, days)**
1. `realestateflow.in` legal pages load over HTTPS.
2. Business Verification for Cloudberry IT Solutions.
3. Finish AiSensy onboarding for the GTM number; verify the campaign API path in `routes/billing.js:89`.
4. Force `followupAgentMode: draft` (no autosend to leads over Baileys), set `PROCESS_EXTERNAL_MESSAGES=false`, and fix the landing-page claim.

**Phase 1 — Cloud API foundation on the Meta test number (dev)**
1. New Business-type Meta app "RealEstateFlow WhatsApp" in the verified portfolio; system-user token in SSM (never in the repo).
2. `agency-app/api/whatsapp/transport/` with `WhatsAppTransport` (`sendText`, `sendTemplate`, `sendInteractive`, `markRead`, `getWindowState`) and two adapters, `baileysTransport` and `cloudApiTransport`. Route all 10 `bailey.js` importers through it.
3. `GET/POST /api/webhooks/whatsapp-cloud`, lifting the signature and handshake code out of the Instagram service into a shared Meta module; idempotency on `wamid` via the existing `WebhookLog`; publish the same EventBridge event so `whatsapp-message-processor` stays the only brain; handle `statuses` to update message rows.
4. `AgencyConfig.whatsappChannel { provider, wabaId, phoneNumberId, displayPhone, tokenCiphertext, coexistence, status }` plus a `phoneNumberId-index` GSI.
5. Shared window/template policy: outside the window, pick an approved template; sync template state from `message_template_status_update`.
6. Consent store on the lead: `whatsappOptIn { status, source, capturedAt, text, withdrawnAt }`, set at every adapter intake, STOP keywords (English and Hinglish) set withdrawal, sends refused without opt-in.
7. `WA_DRY_RUN_SENDS=true` in dev, mirroring Instagram.

**Phase 2 — RealEstateFlow's own official channel + App Review**
1. Register our platform number on our own WABA; INR billing.
2. Staff command channel v2: staff message the platform number from their own phones; sender phone → user/tenant via `GET /internal/users/by-whatsapp` (`platform/auth/src/routes/internal.ts:60-64`); multi-tenant users pick a workspace. Digests become utility templates.
3. Record the two screencasts on this setup and submit App Review.
4. RealEstateFlow's own leads answered by its own AI Employee.

**Phase 3 — tenant numbers (after App Review)**
1. Replace the QR page (`ConnectWhatsApp.tsx`) with Embedded Signup v4, coexistence on; server-side code exchange within 30 s; `subscribed_apps`; `register`; encrypted token storage.
2. Guided payment-method step and status polling; block AI sends until the WABA can pay.
3. Starter template pack per agency, submitted on connect.
4. Customer-facing AI Employee: inbound messages create or attach leads through the lead adapter, draft → approve → auto, with a human escalation path always offered.
5. Migrate Baileys tenants: coexistence onboarding, then unlink the Baileys device and archive the session.

**Phase 4 — retire Baileys**
Set `BAILEY_ENABLED=false`, scale ECS to 0, archive session data (already `Retain`), archive the service folder. Revisit a BSP credit line only if payment-method drop-off in Phase 3 proves material.

---

## 7. Risk: Baileys

Baileys is a reverse-engineered WhatsApp Web client. WhatsApp's terms prohibit auto-messaging and reverse engineering, and bans are reported even at low volume. The ban lands on the **agency's own business number** — the number their customers use — which for a CRM vendor is a trust-ending event, and a banned number must go through appeal before it can ever be registered on the Cloud API.

So: keep Baileys **only** for the owner self-chat command channel, only for owners who explicitly opt in, with a plain "unofficial, may be disconnected" notice, until Phase 2 replaces it. Stop every customer-facing send over Baileys now.

---

## 8. Test plan

| # | Level | Test | Pass |
|---|---|---|---|
| 1 | Unit | Signature verify: valid, tampered body, wrong secret, missing header (reuse the Instagram tests) | only valid passes, timing-safe |
| 2 | Unit | Verify-token handshake | 200 + challenge on match, 403 otherwise |
| 3 | Unit | Webhook parser: text, interactive, media, location, `statuses` including error codes and the `pricing` object | normalised event matches what the processor already consumes |
| 4 | Unit | Window policy at T+23h59, T+24h01, and the 72 h free-entry-point case | correct decision and reason |
| 5 | Unit | Opt-in gate: absent, withdrawn, STOP in English and Hinglish | send refused and logged |
| 6 | Unit | Template choice and variables; marketing never sent as utility | right template, no raw AI text outside the window |
| 7 | Unit | Transport routing for all 10 call sites; `from` can never be missing | a cloud tenant never touches Baileys |
| 8 | Contract | Same `wamid` delivered three times | one message row, one AI turn |
| 9 | Integration (dev test number) | The §9 steps end to end | all events land in the CRM against the right tenant |
| 10 | Integration | Embedded Signup with a tester agency, new number and coexistence number | ids stored encrypted, webhook subscribed, first inbound routed correctly |
| 11 | Integration | Staff channel v2: known staff phone, unknown phone, multi-tenant user | correct authorisation; unknown sender gets a polite non-AI reply and no CRM data |
| 12 | Security | Message to tenant A's `phone_number_id` cannot touch tenant B | proven with two tenants |
| 13 | Load | 3× outbound + 1× inbound burst; webhook median < 250 ms | no 5xx, no duplicate replies |
| 14 | Failure | 130429 throughput, window errors, template paused, quality RED, payment missing after the free tier | graceful backoff, alert, human task |
| 15 | Compliance | Escalation offered in every AI thread; prompts that try to use it as a general assistant | escalation present, off-scope declined |
| 16 | Billing | Sum `pricing.billable` from status webhooks per tenant per month vs the Meta invoice | matches within rounding; feeds metering (doc 38) |
| 17 | Regression | Baileys self-chat still works while `provider=baileys` | `agency-app/api` jest suites green |
| 18 | UAT | One friendly agency on coexistence for two weeks | no lost or duplicated messages; the owner sees AI replies in their app |

---

## 9. Hands-on: the test path on Meta's own test number

1. In the business portfolio, create a **Business-type app** ("RealEstateFlow WhatsApp"), use case **Connect with customers through WhatsApp**. Keep it separate from "Happy Properties-IG" — that app is built on Instagram Login and mixing products complicates App Review.
2. Open **WhatsApp → API Setup**; note the test **phone number id** and **WABA id**.
3. Under **To**, *Manage phone number list*, add your own number and up to four more testers; enter the codes WhatsApp sends.
4. Generate the temporary token for a first send. For anything longer, create a **system user** (Business Settings → Users → System users), assign the app and WABA, and generate a token with `whatsapp_business_messaging` + `whatsapp_business_management`. Store it in SSM SecureString only.
5. Send the sample template:
   ```bash
   curl -s "https://graph.facebook.com/v23.0/$WA_TEST_PHONE_NUMBER_ID/messages" \
     -H "Authorization: Bearer $WA_TOKEN" -H "Content-Type: application/json" \
     -d '{"messaging_product":"whatsapp","to":"91XXXXXXXXXX","type":"template","template":{"name":"hello_world","language":{"code":"en_US"}}}'
   ```
   Expect `{"messages":[{"id":"wamid..."}]}` and the message on the phone.
6. Reply "hi" from that phone — this opens the 24 h window.
7. Send a free-form reply inside the window:
   ```bash
   curl -s "https://graph.facebook.com/v23.0/$WA_TEST_PHONE_NUMBER_ID/messages" \
     -H "Authorization: Bearer $WA_TOKEN" -H "Content-Type: application/json" \
     -d '{"messaging_product":"whatsapp","recipient_type":"individual","to":"91XXXXXXXXXX","type":"text","text":{"body":"Namaste! Site visit kab rakhein?"}}'
   ```
8. Try an interactive reply-buttons message (`"type":"interactive"`).
9. Deploy the dev webhook route behind API Gateway (real TLS), put the verify token and app secret in SSM, and check the handshake yourself first:
   ```bash
   curl -i "https://<dev-host>/api/webhooks/whatsapp-cloud?hub.mode=subscribe&hub.verify_token=$WA_WEBHOOK_VERIFY_TOKEN&hub.challenge=12345"
   ```
   Then in **WhatsApp → Configuration** set the callback URL and verify token, save, and subscribe `messages` (plus `message_template_status_update`, `account_update`, `phone_number_quality_update`). Confirm an inbound event and `statuses` events arrive with a valid signature.
10. Create a real template and watch `message_template_status_update`:
    ```bash
    curl -s "https://graph.facebook.com/v23.0/$WA_WABA_ID/message_templates" \
      -H "Authorization: Bearer $WA_TOKEN" -H "Content-Type: application/json" \
      -d '{"name":"site_visit_reminder","language":"en","category":"UTILITY","components":[{"type":"BODY","text":"Reminder: your site visit at {{1}} is on {{2}}.","example":{"body_text":[["Sunrise Heights","18 Sep, 11 AM"]]}}]}'
    ```
11. Embedded Signup in Development Mode: create a Facebook Login for Business configuration (v4), add a tester agency owner, run the popup on a dev CRM page, then server-side:
    ```bash
    curl -s "https://graph.facebook.com/v23.0/oauth/access_token?client_id=$APP_ID&client_secret=$APP_SECRET&code=$CODE"   # within 30 s
    curl -s -X POST "https://graph.facebook.com/v23.0/$WABA_ID/subscribed_apps" -H "Authorization: Bearer $BIZ_TOKEN"
    curl -s -X POST "https://graph.facebook.com/v23.0/$PHONE_NUMBER_ID/register" -H "Authorization: Bearer $BIZ_TOKEN" \
      -H "Content-Type: application/json" -d '{"messaging_product":"whatsapp","pin":"<6 digits>"}'
    ```

**Going-live checklist:** HTTPS legal pages · Business Verification · app icon, privacy and data-deletion URLs · App Review for both permissions with the two screencasts · a real number with 2FA and an approved display name · payment method with Sold-To India and INR currency · prod webhook with signature check and `wamid` idempotency · opt-in capture live on every lead source · human escalation in every automated thread · monitoring on template status, number quality and limit tier.

---

## 10. Onboarding through AiSensy, if we ever choose it

Steps for one business: sign up and continue with Facebook as a portfolio admin (Embedded Signup under AiSensy's app) → pick or create the WABA, enter the display name, verify a number **not** active on WhatsApp → most reviews finish in ~10 minutes, display name in 3–4 hours → Business Verification in parallel (GST certificate or bank statement, business email on the website domain; 1–3 days; until then the number stays on the 250 tier) → top up the wallet, create templates, set up the API campaign.

What they charge (aisensy.com/pricing and secondary sources, read 17 Sep 2026): prepaid monthly with 5% off quarterly and 10% off yearly; Basic ≈ ₹1,500/month and Pro ≈ ₹3,200/month; chatbot builder ₹2,500/month and AI agent builder ₹1,350/month as add-ons; India messages **marketing ₹1.09, utility ₹0.145, authentication ₹0.145**, service free (their page predates Meta's 1 Oct change). Their partner options are affiliate (20% recurring), white-label (resell under our brand), and "Direct API" (we become a Meta Tech Provider anyway and they supply a partner dashboard and credit line) — the Direct API fees are not published.

Alternatives, for the record: **360dialog** passes Meta's rates through at 0% on a Partner plan from €250/month (the best fallback if agencies balk at adding a payment method); **Gupshup** is API-first with a flat per-message fee; **Twilio** is mature but expensive at chat volume; **Interakt** and **Wati** are single-business tools.

---

## 11. Not verified — check before committing

- Whether `business_management` permission and Access Verification are still required for WhatsApp Tech Providers.
- Coexistence on a real Indian number (Meta's page lists no countries).
- Whether Meta adds 18% GST on INR invoices.
- The current Graph API version (docs sample shows v23.0) and the exact v4 Embedded Signup SDK parameters.
- AiSensy: whether their Project API sends free-form session messages and forwards all inbound to an external webhook, and their Direct API partnership fees.
- App Review turnaround for the WhatsApp permissions — Meta publishes no SLA.
