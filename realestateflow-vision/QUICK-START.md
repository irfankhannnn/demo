# Quick Start: RealEstateFlow Vision & Implementation Roadmap

> **Last updated:** June 2026 · **Status:** Revised post-codebase-audit · **For:** CTO / Tech Lead

---

## What is this?

A complete architectural vision + phased implementation plan to evolve RealEstateFlow from a multi-tenant CRM into an **AI-powered real estate agency operating system**.

The plan is grounded in a thorough audit of the existing codebase (DynamoDB structure, auth/RBAC, security posture, test coverage) and corrects several risks identified in the earlier design.

---

## The Vision in One Sentence

RealEstateFlow captures conversations across every channel (WhatsApp, Instagram, web, voice), auto-qualifies them with AI agents, routes to the right person, nurtures with multi-channel campaigns, and automates the daily ops (follow-ups, site visits, listings, marketing) — all transparent to the agent, with humans-in-the-loop for governance.

---

## The Four Phases (20 weeks total)

### Phase 0: Prerequisites (Weeks 1–3) — **Must do first**
**Documents:** `00-phase-0-prerequisites.md`

Foundational security & infrastructure work that gates everything else:
- 🔴 **Rotate hardcoded secrets** (Exotel, ElevenLabs, CRM API key, Bedrock KB id are in `ai-calling-service/deploy-lambda.ps1`)
- 🔴 **Fix billing webhook gaps** (`subscription.cancelled` never updates DB; `gracePeriodActive` never set; grace period never enforced — see `29-payment-system-implementation.md`)
- Fix CI so tests actually run (path glob mismatch in `playwright.yml`)
- Enforce RBAC uniformly (binary roles today, no agent scoping, DELETE endpoints unprotected)
- Add pagination to all list operations (scale blocker; scans entire partition today)
- Consolidate IaC (CloudFormation only — add EventBridge rules, crons, GSIs to `server/infra/cfn-backend.yaml`)
- Implement immutable audit log (compliance requirement)

**Team:** 1–2 engineers, 2–3 weeks. **Gate:** Complete all above before Phase 1 starts.

> **Infra rule:** All new AWS resources (EventBridge rules, Lambda crons, DynamoDB GSIs, Aurora cluster) go into CloudFormation templates under `server/infra/`. No Terraform, CDK, or SAM.

---

### Phase 1: WhatsApp Wedge (Weeks 4–9) — **The product MVP**
**Documents:** `24-implementation-plan.md`, `08-social-lead-acquisition-engine.md`, `09-lead-qualification-engine.md`, `04-agent-architecture.md`

Deliver a complete inbound → qualification → assignment loop on WhatsApp:

**Week 4–6:**
- Provision Chatwoot (omnichannel inbox) + wire WhatsApp (via AiSensy or Embedded Signup)
- Build conversation backbone (EventBridge + SQS + Orchestrator)
- Deploy Conversation Router agent (Haiku, <1s classify inbound intent)

**Week 7–9:**
- Deploy Sales Assistant agent (Sonnet, T1 tool-use loop; answers budget/price/specs grounded in Property MCP)
- Deploy Lead Qualifier agent (Haiku, progressive profiling)
- Deploy Lead Scorer (Haiku, deterministic + LLM signals)
- Add approval-queue autonomy (agents draft, human approves for Phase 1)
- Add billing UI polish: in-app cancellation, payment failed banner, credits balance display

**Outcome:** Inbound WhatsApp → Lead created + qualified + scored + assigned, all within 60s, no lead dropped.

**Pilot:** 3–5 friendly agencies. Cost: mostly integration (Chatwoot, Bedrock, Exotel already in repo).

---

### Phase 2: PostgreSQL for Analytics, Agent Data & Credits (Weeks 7–10, parallel to Phase 1 end)
**Documents:** `27-phase-2-postgres-analytics-agent-tables.md`, `25-postgres-database-architecture.md` (REVISED), `30-credits-metering-implementation.md`

**KEY INSIGHT from codebase audit:** Do NOT migrate the entire CRM from DynamoDB. Instead:
- Keep the CRM (leads, contacts, properties, khata, etc.) on DynamoDB (fix access patterns in Phase 0)
- Add PostgreSQL for net-new workloads: agent audit, conversation metadata, credits, analytics

**Week 7–8:**
- Provision Aurora Serverless v2 + RDS Proxy (2–3k/mo for analytics volume)
- Write Knex migrations (12 new tables: `agent_actions`, `conversations_meta`, `credits`, `credit_ledger`, `agent_usage`, analytics views)
- Implement service layer (AgentActionService, ConversationMetaService, CreditService, ModelRouter)

**Week 9–10:**
- Wire every agent action → `agent_actions` table (logs what agent did, cost, approval status)
- Wire every conversation → `conversations_meta` (index for conversation history + lead linking)
- Wire metering → `credit_ledger` (balance, transactions, caps per tenant)
- Wire multi-model router: Haiku for classify/score, Sonnet for conversation, Opus only when needed
- Credit purchase flow: Razorpay Orders API for credit pack top-up
- Low-balance alerts via SNS + Brevo; `/billing/credits` frontend page
- Test end-to-end; deploy to staging behind feature flags

**Outcome:** Agent actions auditable + billable. Postgres dashboard queries <500ms. Zero DynamoDB migration risk. Every Bedrock/ElevenLabs call costs tracked.

---

### Phase 3: Scale with Automation, Voice, Marketing (Weeks 13–20)
**Documents:** `28-phase-3-scale-automation-marketing.md`

Expand the system to full multi-channel, outbound, marketing-driven agency OS:

**Follow-up Automation (Weeks 13–15):**
- Step Functions journeys (5–7 step workflows per persona: buyer, seller, owner, tenant)
- Conditional logic: shorten gaps for urgent timelines, extend for long-cycle leads
- Approval gate on Day 7 offer message
- Track outcomes → update lead score

**Voice (Weeks 15–17):**
- Re-enable AI Calling service (already built, just unmounted)
- Inbound: answer calls, capture intent, create lead
- Outbound: follow-up reminders, scheduling calls, check-ins
- DLT-compliant (India TRAI rules baked in)

**Marketing Automation (Weeks 16–20):**
- Marketing Agent (Strands, Sonnet) + Higgsfield (image/video gen) + Meta-Ads + Blotato (publishing)
- Workflow: brief → agent generates content + campaign + publishes
- Approval gate before publishing to IG/FB
- Closed-loop: Meta lead-form → conversation → lead → tracks ROI

**Portal Automation (Weeks 18–20):**
- Automation Agent + AgentCore Browser Tool
- Post new listings to 99acres, MagicBricks, Housing.com
- Retrieve leads from portals daily
- Approval gate (legal risk)

**Advanced Analytics (Weeks 19–20):**
- Dashboards: agent leaderboard, conversion funnel, ROI by channel, cohort retention
- Postgres views + frontend components
- Real-time funnel tracking

**Outcome:** Full AI Agency OS live. Multi-channel (WhatsApp, web, voice, IG, FB). Automated nurture, marketing, and operations. Agents trust the system to not drop leads.

---

## The Big Wins

### What you're NOT doing (mitigating risk)
- ❌ No rewrite of the CRM (it works; 284 endpoints functional)
- ❌ No full DynamoDB → PostgreSQL migration (one of the riskiest refactors; audit found it's not the bottleneck)
- ❌ No new frameworks (Strands agents, MCP tools already chosen; proven)
- ❌ No TypeScript migration of `server/` (it's JS; stick with Knex, not Drizzle)

### What you're doing (high-ROI)
- ✅ **Secure the foundation** (Phase 0): rotate secrets, enforce RBAC, fix CI
- ✅ **Deliver revenue fast** (Phase 1): WhatsApp inbound in 6 weeks, pilot with agencies
- ✅ **Add analytics & audit** (Phase 2): PostgreSQL for new relational needs, not rewriting CRM
- ✅ **Scale with zero downtime** (Phase 3): follow-up journeys, voice, marketing, portal automation behind feature flags

---

## Critical Prerequisites (Phase 0 Blockers)

| Item | Risk | Status |
|---|---|---|
| **Hardcoded secrets** | Anyone with repo access has live Exotel/ElevenLabs/Bedrock keys | 🔴 Critical, Week 1 |
| **Billing webhook gaps** | `subscription.cancelled` doesn't update DB; grace period never activates; tenants locked or leaked | 🔴 Critical, Week 1 |
| **CI tests don't run** | Can't refactor data layer without test coverage | 🟠 High, Week 2 |
| **RBAC unenforced** | DELETE endpoints have no role check; agents have no data scoping | 🟠 High, Week 2–3 |
| **No pagination** | Scans entire partition; breaks at 100k leads scale | 🟠 High, Week 3 |
| **IaC scattered** | Can't safely deploy Phase 1 without unified CFN; all infra changes must go through `server/infra/cfn-backend.yaml` | 🟡 Medium, Week 3 |

**All must be done before Phase 1 work begins.** They're not nice-to-haves; they're gates.

---

## Budget & Team

### Timeline
- **Phase 0:** 2–3 weeks (1–2 FTE)
- **Phase 1:** 6 weeks (3–4 FTE)
- **Phase 2:** 4 weeks, parallel to Phase 1 end (1 FTE)
- **Phase 3:** 8 weeks (4–5 FTE)
- **Total:** 20 weeks (3–6 person team, some overlap)

### Cost (AWS + 3rd parties)
- **Phase 0:** $0 (internal work)
- **Phase 1:** ~$500–1k/mo (Chatwoot, Bedrock tokens, Lambda, DynamoDB)
- **Phase 2:** +$500–600/mo (Aurora + RDS Proxy)
- **Phase 3:** +$1-2k/mo (voice: Exotel + ElevenLabs; marketing: Meta budget + Higgsfield)
- **Total run rate by Phase 3:** ~$3–5k/mo (excludes marketing/ads budget, which scales with volume)

---

## Reading Order (Start Here)

1. **This file** (you're reading it now)
2. **`00-phase-0-prerequisites.md`** (understand what must be done first)
3. **`29-payment-system-implementation.md`** (billing gaps — must fix in Phase 0)
4. **`02-product-vision.md`** (what you're building and why)
5. **`01-current-state-analysis.md`** (what you have today, honestly)
6. **`03-future-state-architecture.md`** (system blueprint)
7. **`21-roadmap.md`** (phases at a glance)
8. **Phase-specific docs:**
   - Phase 0: `00-phase-0-prerequisites.md`, `29-payment-system-implementation.md`
   - Phase 1: `24-implementation-plan.md`
   - Phase 2: `27-phase-2-postgres-analytics-agent-tables.md`, `30-credits-metering-implementation.md`
   - Phase 3: `28-phase-3-scale-automation-marketing.md`

---

## Key Decisions (Why This Plan Works)

| Decision | Why |
|---|---|
| **Fix DynamoDB, don't migrate** | Audit found problems are from improper access patterns (Scan + FilterExpression, no pagination), not DynamoDB limits. Fix those. Keep CRM on DDB. |
| **PostgreSQL for net-new only** | No migration risk. Postgres is for genuinely relational workloads (agent audit, analytics) that DynamoDB doesn't suit. |
| **Knex, not Drizzle** | Server is JavaScript, not TypeScript. Drizzle requires either a TS migration (huge effort) or losing type safety. Knex is JS-native. |
| **RLS as defense-in-depth, not primary** | Your current pattern (explicit `WHERE tenant_id = $1`) is safer than session-level RLS on pooled connections. Add RLS later if needed. |
| **Approval-queue for all new agents** | Humans approve before agents auto-reply. Graduate to autonomy per workflow with eval evidence. Safest path. |
| **No rewrite** | The CRM works. 284 endpoints, multi-tenant, billing, auth, KYC — all functioning. Wrap it, don't rewrite it. |

---

## Success Metrics per Phase

### Phase 0 ✅
- No secrets in version control; all in Secrets Manager
- CI tests run and pass; blocking PR merge on failure
- All DELETE routes enforce role checks
- List endpoints paginated; <2s latency at 100k records
- IaC deployable via `make deploy`

### Phase 1 ✅
- <60s first response on WhatsApp
- 90%+ leads reach "qualified" status
- Zero cross-tenant data leaks
- 3–5 pilot agencies live
- Cost per conversation <₹5 (target)

### Phase 2 ✅
- Agent actions logged; audit trail complete
- Credit balance enforced; no overspend
- Analytics dashboards <500ms latency
- Conversation metadata enables "find all convos for contact X" in <1s
- Postgres running stably; zero data integrity issues

### Phase 3 ✅
- Follow-up journeys reach 90% of leads
- Voice answers 80% of inbound calls
- Marketing campaigns launch 1/week; ROI tracked
- Portal posting <2h after listing created
- Multi-channel mix: WhatsApp 50%, voice 20%, web 15%, portal 15%

---

## What This Enables Long-Term

Once Phase 3 is live, RealEstateFlow becomes:
- A **go-to-market platform** for Indian real estate agencies (the wedge: WhatsApp lead capture + qualification)
- A **product company** (not just consulting); agencies adopt it as their operating system
- A **revenue machine** (credits-based pricing; Redditscales with usage; margin improves with agent efficiency)
- A **moat** (proprietary agent playbooks, brand switching cost, data advantage in agent quality)

The path from here to €10M ARR is clear:
1. **Product-market fit** (Phase 1: WhatsApp wedge with 10 agencies, 1k leads/mo)
2. **Scale the wedge** (Phase 1 + 2: 100 agencies, 50k leads/mo, metering in place)
3. **Build the full OS** (Phase 3: multi-channel, voice, marketing, automation — agencies can't imagine life without it)
4. **Expand to Dubai & 3D** (Phase 4: open to secondary markets; premium 3D property tours drive upsell)

But first: Phase 0. Secure the foundation.

---

## Next Action (This Week)

1. **Share this roadmap** with the team.
2. **Kick off Phase 0:** Assign owners to each item in `00-phase-0-prerequisites.md`.
3. **Spin up a branch** (`phase-0-hardening`) and start the 3-week sprint.
4. **Unblock Phase 1** behind Phase 0 completion gate.

Phase 0 is 2–3 weeks of focused, high-return work. After that, you'll have a secure, testable, scalable foundation to build the AI vision on.

Good luck. This is going to be great.
