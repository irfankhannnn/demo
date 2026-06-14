# 07 — Browser & Portal Automation Platform

> **Scope:** automated interaction with external systems agencies depend on — primarily Indian listing portals (99acres, MagicBricks, Housing.com), builder/CP portals, and other web tools — for listing posting and lead retrieval. **Read the legal section first: this is as much a business/legal decision as a technical one.** Research verified June 2026 (`20`).

---

## 1. The Honest Legal & ToS Reality (decide before you build)

Research finding, stated plainly:

- **No Indian statute clearly permits or bars** scraping/automation; courts have not definitively ruled on portal scraping.
- **99acres / MagicBricks / Housing.com actively bot-block** (their ToS, robots.txt, and endpoints return 403 to automation) — a clear signal that automation is unwelcome.
- **Automated posting under a client's credentials likely breaches portal ToS**, with untested exposure under **breach of contract, IT Act 2000 §43 (unauthorized access), and Copyright Act 1957** (listing data/images).
- **No public official listing-*upload* API exists** for these portals. The "99acres/MagicBricks push integrations" offered via CRMs like Anarock are **inbound lead distribution, not listing posting**. Premium broker/builder feeds, if any, require a direct partnership conversation.

**Therefore:** programmatic *listing posting* realistically requires browser automation that collides with portal ToS. We treat it as **opt-in, per-tenant, human-supervised, and credential-owner-consented**, and we **prioritize the official, lower-risk path first**:

1. **Lead *retrieval* via official channels** (portal→CRM lead push, email-parse, Meta Lead Ads) — low risk, high value. **Build this first.**
2. **Listing *posting* automation** — gated premium feature, explicit tenant consent that they authorize automation under their own portal account, human-in-the-loop, conservative rate limits. Pursue official portal partnerships in parallel to replace automation where possible.

This document designs the *platform* to do (2) safely if/when the business chooses to; it does not assume (2) is risk-free.

## 2. Use Cases & Priority

| Use case | Risk | Priority |
|---|---|---|
| Pull portal leads into CRM (official push/email) | Low | **P1** |
| Sync listing *status* (sold/rented) to reduce stale listings | Medium | P2 |
| Post/refresh listings to portals (browser) | High (ToS) | P3, gated |
| Builder/CP portal inventory sync | Medium | P2 |
| Misc web tasks (CP registration forms, document portals) | Varies | P3 |

## 3. Browser Runtime — Options & Recommendation

| Option | Cost | Multi-tenant isolation | Verdict |
|---|---|---|---|
| **Playwright self-host** (Fargate/containers) | Free + compute | DIY (`newContext` per tenant; you build persistence/scaling) | Good for control/cost; most eng effort |
| **Browserbase** | Free→$20→$99/mo tiers | Sandboxed sessions; per-tenant **Contexts API** | Fast start, managed |
| **Steel.dev** (OSS core) | Free→$29→$99→$499 | Built-in session persistence, isolated browsers | OSS option, good middle ground |
| **AgentCore Browser Tool** | Consumption, no minimum | **Strongest:** per-session dedicated **microVM**, sanitized on completion, up to 500 concurrent | Best isolation; AWS-native |

**Recommendation:** **AgentCore Browser Tool** as the primary runtime once on AgentCore — its per-session microVM isolation is exactly what multi-tenant credential handling demands, it's consumption-priced (no idle floor), AWS-native (IAM/Secrets/VPC), and integrates with the Automation agent (`04`). **Playwright self-hosted on Fargate** as the Phase-1/fallback runtime before AgentCore adoption and for cost-sensitive bulk jobs. Steel/Browserbase are viable if we want a managed option sooner than AgentCore Browser is adopted.

## 4. Platform Architecture

```
 Automation Agent (04, T2, Sonnet, human-in-loop)
        │  plan steps
        ▼
 Automation MCP (05)  ── enqueue_portal_post / get_run / request_2fa
        │
        ▼
 SQS job queue (per-tenant fairness, DLQ, retries, backoff)
        │
        ▼
 Worker (Fargate) ──► Browser runtime (AgentCore Browser microVM / Playwright)
        │                     │ uses
        │                     ▼
        │            Secrets Manager (per-tenant portal credentials, KMS-encrypted)
        │
        ├──► 2FA/OTP human-in-the-loop:  request_2fa → notify tenant (WhatsApp/dashboard)
        │      → human supplies OTP → resume run
        │
        └──► Audit log (every run: tenant, portal, action, screenshots, status, cost)
              + Cost meter (17) + Outcome events (ListingPosted/Failed)
```

### Key properties
- **Queue-based execution (SQS):** decouples bursty agent intent from rate-limited portal interaction; enforces **conservative per-portal, per-tenant rate limits** (mimic human cadence; never hammer).
- **Credential isolation:** portal logins live in **Secrets Manager namespaced per tenant**, encrypted with per-tenant KMS keys; resolved at run time inside the isolated browser session; never logged, never in agent context. (At scale, a per-tenant JSON secret or KMS+DynamoDB pattern controls the $0.40/secret cost — `15`/`17`.)
- **Human-in-the-loop for 2FA/OTP & first posts:** portals use OTP; runs **pause and request the OTP from the tenant** via WhatsApp/dashboard, then resume. First N posts per tenant are Level-0/1 (human approves) regardless of autonomy setting.
- **Audit & evidence:** every run stores step screenshots, action log, and outcome — both for the tenant's trust and for dispute/compliance.
- **Cost tracking:** browser-minutes and run counts metered per tenant → billable (`17`).
- **Kill switch:** per-portal global disable (if a portal changes terms or blocks us, we stop cleanly).

## 5. Anti-Fragility & Maintenance

Portal DOMs change and anti-bot evolves. Mitigations: keep automations **declarative and small** (one task = one short script the Automation agent can re-plan), prefer **agent-driven navigation** (the agent reads the page and decides, rather than brittle hardcoded selectors) using the Browser Tool, monitor success rates, and **fail safe to human** on any uncertainty. Budget ongoing maintenance — this is the highest-maintenance subsystem in the platform.

## 6. Multi-Tenancy, RBAC, Audit (requirements recap)
- Per-tenant credential vaults; an agent/worker can only resolve the calling tenant's secrets.
- RBAC: only Owner/Manager roles can configure portal automation; agents act within that scope.
- Full audit log + cost tracking per run (explicit vision requirements — satisfied above).

## 7. Recommendation Summary

1. **Build official lead-retrieval first** (P1) — most value, least risk.
2. **Design the posting platform now, ship it gated** (P3): AgentCore Browser microVM runtime + SQS + Secrets Manager isolation + human-in-loop 2FA + audit + cost meter + kill switch.
3. **Require explicit per-tenant authorization** that they consent to automation under their own portal account; pin first posts to human approval; rate-limit conservatively.
4. **Pursue official portal partnerships** in parallel; replace browser automation with sanctioned APIs wherever obtainable.
5. **Keep legal in the loop** — this is a business risk decision, documented in `19-risk-analysis.md`.
