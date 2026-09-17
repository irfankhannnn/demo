# Quick Start: RealEstateFlow Vision & Roadmap

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Rewritten: the June "Phase 0–3, 20 weeks" plan (Chatwoot, Postgres credits, Strands/AgentCore, `make deploy`) is replaced by what was built and by Phase A/B/C without dates.

**For:** founder, contractors, and AI agents working on the product.

---

## What is this?

An architecture and roadmap for growing RealEstateFlow from a multi-tenant CRM into an **AI-powered operating system for Indian real estate agencies**, plus the internal GTM operations system used to sell it (`internal-operations/`, starts after the M1 PMF gate).

RealEstateFlow is **pre-launch with zero customers**. Nothing here should be read as traction.

## The vision in one sentence

RealEstateFlow captures conversations across channels (WhatsApp, Instagram, web, voice), qualifies them with AI, routes them to the right person, follows up, and automates daily agency work, with humans in the loop and every answer grounded in CRM data.

---

## Where we are (Sep 2026)

Most of what the June plan called "Phase 1–3" is already in code. Full detail with paths: `01-current-state-analysis.md`.

| Area | Built today | Path |
|---|---|---|
| CRM (leads, contacts, properties, meetings, khata, billing) | Yes, ~270 mounted endpoints in 42 route files | `agency-app/api/`, `agency-app/web/` |
| Agent runtime (WhatsApp command channel + web chat) | Yes: in-house classify → plan → execute → compose pipeline, model gateway with Gemini as the one adapter, optional bounded tool loop. Off by default (`AGENTS_ENABLED`) | `agency-app/api/agents/` |
| Lead qualification (Hot/Warm/Cold) and routing | Yes, EventBridge `lead.created` / `lead.qualified` handlers | `agency-app/api/scripts/lead-qualifier-handler.js`, `lead-router-handler.js` |
| Lead ingestion pipeline | Yes: ManyChat + Instagram adapters → `ingestLead()` | `agency-app/api/leadIngestion.js`, `docs/lead-adapter-architecture.md` |
| Instagram (DMs, comments, private reply, insights, CRM hand-off) | Yes, on dev; prod not deployed; Meta App Review pending | `agency-app/instagram-api/` |
| WhatsApp | Self-hosted Baileys, agency's own command channel only (non-self messages are dropped). Customer-facing WhatsApp not built | `platform/whatsapp-platform/`, `agency-app/api/routes/webhooks.js` |
| AI voice | Outbound calls (ElevenLabs + Exotel) and scheduled follow-up calls | `agency-app/ai-calling/`, `agency-app/followup-agent/` |
| MCP for Claude/ChatGPT | One server, 72 tools, own OAuth 2.1 | `platform/mcp/` |
| Knowledge / RAG | DynamoDB vector search + Titan v2 embeddings (Bedrock, working in dev) | `agency-app/api/services/embeddings/`, `services/knowledge/` |
| Credits | Ledger, metering on CRM writes and agent actions, Razorpay credit packs, monthly reset | `agency-app/api/creditService.js`, `middleware/meterCredits.js` |
| Public property pages + visit booking | Yes | `public-app/property-pages/` |
| Mobile app | Capacitor app, store launch in prep | `agency-app/web/capacitor.config.ts`, `docs/launch/MOBILE_LAUNCH_YOUR_TASKS.md` |

---

## The three phases (no dates)

### Phase A — M1 launch
Launch what is built to the first agencies. Must be done **before taking payment**:
- **Grace period:** `payment.failed` already sets grace and `subscription.cancelled`/`halted` already update the DB. Still open: `subscription.charged` does not clear grace; the expiry script `agency-app/api/scripts/grace-period-expiry-cron.js` is not wired into CFN; no server-enforced read-only mode after grace. See `29`.
- **API protection:** API Gateway throttling, access logs, and a CORS fix (gateway responses still return `*`). The app's rate limiter is in-memory per Lambda instance.
- **Keys:** Exotel, ElevenLabs, Gemini, Baileys and CRM API keys are in git history; rotation status is **unconfirmed**. Rotate them; no history rewrite (never force-push); add gitleaks to CI. See `docs/security-key-rotation.md`.
- **Roles:** ADMIN/MEMBER is enough for M1.
- **Voice:** outbound only; capture call consent at lead intake.
- **Pricing:** current pre-launch pricing is in `marketing-and-sales/launch-plan-v2/pricing.json` and CRM `agency-app/web/src/lib/plans.ts`, which disagree on Team+. It is being replaced by the proposal in `38-pricing-plan-contacts-and-credits.md` (Proposed).

> **Open question:** does M1 launch include the Instagram service in prod (it needs Meta App Review first), or only the CRM + WhatsApp command channel?

### Phase B — Hardening
- **Team plans:** add a MANAGER role and "members see only their own leads" before selling Team plans. Today the auth model has only ADMIN/MEMBER, the server also accepts FOUNDER/OWNER/MANAGER, and `assignedTo` is only a filter. Two mounted DELETE routes are unguarded (`routes/aiIntegrations.js`, `routes/notifications.js` device-token unregister).
- **Pagination:** leads/customers have limit/offset (in-memory slice); contacts, owners, properties and meetings are unpaginated scans (`TODO(MED-1)` in `crmDynamodbService.js`). Add cursor pagination.
- **Audit:** agent actions go to `AgentAuditTable`; there is no CRM mutation audit. Add one, and archive old rows instead of TTL delete (the agent audit table uses a 90-day TTL today).
- **CI:** server jest and MCP drift checks run in `server-tests.yml`; the Playwright E2E suite (`tests/playwright`) is not run in CI.
- **Deploys:** stay manual via `infra/cicd/<service>/deploy.sh`; add a GitHub Actions deploy to dev.
- **WAF** after the first customers. **DLT registration** before any bulk calls.

### Phase C — Growth
- **WhatsApp official:** WhatsApp Business Cloud API for customer messaging (possibly via AiSensy as BSP), plan in `39-whatsapp-official-api-plan.md` (Proposed). Chatwoot is dropped.
- WhatsApp nurture journeys (on the official API).
- Instagram DM assistant: drafts first, auto-send later.
- Inbound AI voice.
- Portal lead ingestion (new adapters on the existing pipeline).
- Brochure and floor-plan tools for the agent.
- Tenant social publishing, after Meta App Review.
- Internal operations system, after the M1 PMF gate.
- Postgres: parked as a possible future reporting store fed from DynamoDB (`27`), no date.

**Dropped:** posting listings to portals via browser automation (account-block risk), a tenant marketing agent, Telegram.

**Lead scoring and assignment** are built; the founder is building a next-generation lead engine separately, and these docs will be updated when it lands.

---

## What we are not doing
- No CRM rewrite and no DynamoDB → Postgres migration.
- No Strands/AgentCore migration: the in-house runtime behind the model gateway is the direction (Strands, AgentCore and Bedrock Knowledge Bases were considered, not adopted; see `04`).
- No 11-server MCP split unless clients struggle with one server (`05`).
- No deletion of CRM data in any design (archive instead).

---

## Team and cost
- **Team:** solo founder + AI agents + contractors. Hire after a revenue trigger.
- **Cost:** the June per-phase AWS/vendor estimates assumed Chatwoot and Aurora, which are not used. No current estimate is in this folder.

> **Open question:** re-estimate monthly run cost (Lambda, DynamoDB, Gemini, ElevenLabs/Exotel minutes, ECS Fargate for Baileys) for M1.

---

## Reading order
1. This file.
2. `01-current-state-analysis.md` — what exists, with paths.
3. `00-phase-0-prerequisites.md` — hardening checklist with status.
4. `29-payment-system-implementation.md` — billing gaps for Phase A.
5. `02-product-vision.md` — what and why.
6. `03-future-state-architecture.md` — blueprint, as built + target.
7. `21-roadmap.md` — phases in detail.
8. Proposals: `38-pricing-plan-contacts-and-credits.md`, `39-whatsapp-official-api-plan.md`.

Archived (history only): `24`, `25`, `26`, `internal-operations/32`.

---

## Key decisions

| Decision | Why |
|---|---|
| **Fix DynamoDB access patterns, don't migrate** | The problems are scans and missing pagination, not DynamoDB limits. Credits, agent audit and vector search already run on DynamoDB. |
| **In-house agent runtime + model gateway** | Already built and tested; keeps models swappable to control cost. |
| **One MCP server** | 72 tools generated from one registry (`agency-app/api/shared/toolDefinitions.js`) shared by the WhatsApp agent, CRM backend and MCP server. |
| **Official WhatsApp API for customers** | Baileys uses the unofficial WhatsApp Web protocol; fine for the agency's own command channel, not for customer messaging. |
| **Human approval first** | Agents draft, humans approve; graduate to auto per workflow. The follow-up cron already has `draft`/`autosend` modes. |
| **Manual, tracked deploys** | `infra/cicd/<service>/deploy.sh` wrappers with build tracking; CI deploy to dev later. |

---

## Success checks per phase

### Phase A
- Failed payment → grace → read-only after expiry, enforced on the server and tested with Razorpay test events.
- Keys rotated; gitleaks passing in CI.
- API Gateway throttling and access logs on; CORS restricted.

### Phase B
- A MEMBER sees only their own leads; a MEMBER cannot delete.
- All list endpoints paginated with a cursor.
- Every CRM mutation audited; old rows archived, not deleted.
- Playwright E2E runs in CI.

### Phase C
- Customer WhatsApp conversations on the official API, inside Meta's 24h window and template rules.
- Portal leads arrive through the adapter pipeline with dedupe.
- Instagram DM assistant drafts accepted by agents at a measured rate before auto-send is allowed.

---

## Next actions
1. Confirm key rotation status and add gitleaks (Phase A).
2. Wire the grace-period expiry Lambda + rule into `agency-app/api/infra/cfn-backend.yaml`, clear grace on `subscription.charged`, add server-side read-only.
3. Add API Gateway throttling, access logs and the CORS fix.
4. Founder review of `38` (pricing) and `39` (WhatsApp official API).
