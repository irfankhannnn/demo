# 21 — Roadmap

> **Scope:** phased delivery from today's CRM to the AI Agency OS, sized for a **3–6 engineer** team. Each phase is independently valuable and flag-gated. Durations are indicative (calendar quarters), not commitments.

---

## Phase 0 — Stabilize & Expose (≈4–6 weeks)
**Theme:** make the core safe and agent-ready.
- 🔴 Rotate hardcoded secrets → Secrets Manager; secret scanning (`15`,`R1`).
- Fine-grained RBAC + region/team scoping (extends `auth_rbac_feature`) (`15`).
- Add `tenant-index` GSI (MED-1); conversation tables; feature-flag framework.
- Wrap core domain endpoints as MCP tools via AgentCore Gateway (`05`).
- CI/CD pipeline + consolidated IaC; WAF + API GW logs + throttling; DynamoDB PITR + S3 versioning (`16`).
- Re-enable disabled routes behind flags (projects/developers/buildings; aiCallingInternal).
**Outcome:** secure, observable, wrapped core; foundation for everything else.

## Phase 1 — Lead Acquisition + Qualification (≈Q1)
**Theme:** the revenue front door on WhatsApp.
- Conversation backbone: EventBridge + SQS + Redis + Orchestrator (`03`,`16`).
- Chatwoot channel layer; **WhatsApp** (AiSensy/Embedded Signup) + **Website chat** + **Meta Lead Ads** (`08`).
- Agents (T0/T1): Router, Sales Assistant (grounded), Qualifier, Scorer, Assignment (`04`,`09`,`10`,`11`).
- Approval-queue autonomy; metering (Lago) + budget caps (`17`).
**Outcome:** inbound WhatsApp/web conversations auto-captured, answered, qualified, scored, assigned — zero leads dropped. **This is the wedge.**

## Phase 2 — Follow-Up, Voice & Knowledge (≈Q2)
**Theme:** nurture and reach.
- Follow-Up journeys (Step Functions), channel-aware, grounded (`09`).
- Knowledge/RAG: Bedrock KB + S3 Vectors; Knowledge MCP; ground Sales/Voice (`14`).
- Re-enable & evolve **Voice** (ElevenLabs+Exotel, MCP-grounded): inbound + follow-up reminders + human transfer (`12`).
- Instagram DMs + comment-to-DM; Facebook (`08`).
- Strands introduced for Follow-Up/Nurture + Agency-Command; Evaluations in CI (`04`).
**Outcome:** multi-touch nurture across chat + voice; grounded knowledge; broader channels; the "AI Employee" becomes a real agent (retire human SLA).

## Phase 3 — Scale, Marketing & Automation (≈Q3)
**Theme:** breadth and managed scale.
- AgentCore Runtime/Gateway/Browser adoption for stateful agents (`04`,`16`).
- **Marketing engine** (Marketing MCP: Higgsfield/Meta/Blotato + Remotion) with approval gate + closed-loop CAPI (`13`).
- **Portal automation** (lead-retrieval GA; gated posting beta) with isolation/HITL/audit (`07`).
- **Aurora reporting projection** (RLS) + Analytics MCP + dashboards (`16`,`05`).
- Consented outbound voice qualification at scale (DLT) (`12`).
- Credit model fully live (voice/marketing/automation add-on packs) (`17`).
- Graduate trusted workflows to higher autonomy (`04 §6`).
**Outcome:** all eight engines live; agencies operate substantially through AI; analytics + billing mature.

## Phase 4 — Agency OS at Scale (≈Q4+)
**Theme:** depth, mobile, premium.
- Multi-agent orchestration at scale; LangGraph for audited sub-flows (`04`).
- **Mobile app** (agent-on-the-go; Capacitor base exists) (`02`).
- Telegram + additional channels; advanced attribution/ROI suite.
- **Future property experience** pilots (3D/Gaussian-splatting) (`03 §9`).
- Marketing-copilot tier; MCP as partner/product surface (`05 §6`).
- Continuous eval-driven optimization; autonomy expansion.
**Outcome:** the full vision — an AI-powered real estate agency operating system.

---

## Sequencing Logic
1. **Secure & wrap before building** (Phase 0) — non-negotiable.
2. **Acquisition + qualification first** (Phase 1) — fastest ROI, the product wedge, validates the agent+MCP+backbone pattern end-to-end.
3. **Nurture + voice + knowledge** (Phase 2) — deepen conversion on the captured pipeline.
4. **Marketing/automation/analytics + managed scale** (Phase 3) — breadth once the core loop works.
5. **Polish, mobile, premium, partner surface** (Phase 4).

## Guardrails Across All Phases
- One engine reaches **GA at a time**; others in flag-gated beta with pilot tenants.
- **T0/T1 before T2**; managed services (AgentCore/Aurora) adopted lazily.
- Every agent capability launches at **approval-queue autonomy**; graduate on eval evidence.
- Compliance (DPDP, DLT, Meta policy) and **cost guards** baked in per phase, never retrofitted.
