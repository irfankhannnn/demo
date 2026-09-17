# 07 — Portal Lead Ingestion & Browser Automation

> **Status (17 Sep 2026):** Design only. Checked against the code on main — nothing in this document is built. Two things changed since June: portal **lead ingestion** now has a home (the lead-adapter pipeline that already carries ManyChat and Instagram), and listing **posting** by browser automation is **dropped** for account-block and ToS risk. The browser-runtime comparison is kept as the record of what was evaluated.

> **Scope:** automated interaction with the external systems agencies depend on — mainly the Indian listing portals (99acres, MagicBricks, Housing.com) and builder/CP portals. **Read the legal section first: this was a business decision before it was a technical one.** Portal research verified June 2026 (`20`).

---

## 1. The legal and ToS reality (this is what settled it)

Stated plainly:

- **No Indian statute clearly permits or bars** scraping and automation; courts have not ruled definitively on portal scraping.
- **99acres, MagicBricks and Housing.com actively bot-block** — ToS, robots.txt and 403s to automated clients. That is a clear signal that automation is unwelcome.
- **Automated posting under a client's credentials likely breaches portal ToS**, with untested exposure under breach of contract, IT Act 2000 §43 (unauthorised access), and the Copyright Act 1957 (listing data and images).
- **No public listing-*upload* API exists** for these portals. The "99acres / MagicBricks push integrations" other CRMs advertise are **inbound lead distribution, not listing posting**. Premium broker/builder feeds, where they exist, need a direct partnership conversation.

**Decision taken (Sep 2026):** we do **not** post listings to portals by driving a browser under the agency's credentials. The exposure is not the fine — it is the agency's portal account being suspended because of something our software did on their behalf. That is the same reason Instagram is Graph API only and never browser-driven (`08`).

**What we do instead:** the official, low-risk half of the original plan — **pull leads in**, on the pipeline that already exists.

## 2. Use cases, re-scoped

| Use case | Risk | Status |
|---|---|---|
| Pull portal leads into the CRM (official push, feed, or email parse) | Low | **P1 — on the roadmap**, builds on §3 |
| Sync listing *status* (sold/rented) back to portals | Medium | Parked — only if a portal offers a sanctioned API |
| Post or refresh listings on portals by browser | High (ToS, account block) | **Dropped** |
| Builder / CP portal inventory sync | Medium | Parked — partnership-dependent |
| Misc web tasks (CP registration forms, document portals) | Varies | Dropped; not a product problem |

## 3. Portal lead ingestion rides the pipeline that already exists

This is the part worth building, and most of it is already built — for other channels.

Every lead, whatever channel it came from, lands as one row in one table and gets identical downstream treatment. The channel-specific part is an **adapter**, whose only job is to turn a native payload into the canonical `LeadInput` and call `ingestLead()`.

```
  ManyChat        Instagram        Property pages      (portal adapter)
  webhook         service          booking             — not built
     │               │                 │                     │
     └───────────────┴─────────────────┴─────────────────────┘
                              │
              POST /api/internal/adapters/leads   (x-api-key, batch or single)
                              │
        agency-app/api/leadIngestion.js → ingestLead()
        dedupe → createLead() → notifyNewLead() → lead.created
                              │
     EventBridge lead.created → lead-qualifier-handler (Hot/Warm/Cold)
        → lead.qualified → lead-router-handler (assignment)
        → follow-up call jobs (agency-app/followup-agent)
```

Reference: `docs/lead-adapter-architecture.md`. Code: `agency-app/api/routes/adapterIngestionInternal.js`, `agency-app/api/leadIngestion.js`, `agency-app/api/scripts/lead-qualifier-handler.js`, `agency-app/api/scripts/lead-router-handler.js`.

**What a portal adapter has to supply, and nothing more:**

| Field | Why |
|---|---|
| `source: 'Portal'`, `sourceAdapter: '99acres' \| 'magicbricks' \| …` | Provenance and attribution |
| `externalRef` | The portal's own lead id, so a re-delivery is recognisable |
| `dedupeKey` | Stable per-source id. `ingestLead()` runs it through `logEventIfNotProcessed`, so retries cost nothing |
| Name, phone, enquiry text, listing reference | The canonical `LeadInput` fields |

**The one prerequisite before a high-volume source is wired in.** A single ingest does one phone-lookup Query over the tenant's lead partition. That is fine at ManyChat and Instagram volumes. Before any source that fires per inbound message, add a real phone GSI (`normalizedPhone` as partition key) so the lookup is a point query — the same prerequisite `docs/lead-adapter-architecture.md` records for the WhatsApp adapter.

**Three ways a portal lead can arrive**, in order of preference: a sanctioned webhook or push from the portal; a periodic feed pull; an email-parse adapter reading the lead-notification mails the agency already receives. The third needs no portal cooperation at all and is the realistic starting point.

> **Marketing mismatch to fix.** `agency-app/landing-pages/main/index.html` already tells prospects we "connect with 99acres, MagicBricks, and Housing.com" (`:95`, `:225`) and that "Telegram is supported too" (`:28`). No portal adapter exists and Telegram is dropped (`08`). Either the copy comes down or the adapter ships first.

## 4. Considered, not adopted: the browser-automation platform

Kept as the record of what was evaluated, in case the posting decision is ever revisited. **None of this is being built.**

### 4.1 Browser runtime options compared (June 2026)

| Option | Cost | Multi-tenant isolation | Verdict then |
|---|---|---|---|
| **Playwright self-hosted** (Fargate) | Compute only | DIY — `newContext` per tenant, you build persistence and scaling | Most control, most engineering |
| **Browserbase** | Free → $20 → $99/mo | Sandboxed sessions, per-tenant Contexts API | Fast start, managed |
| **Steel.dev** (OSS core) | Free → $29 → $99 → $499 | Session persistence, isolated browsers | Reasonable middle ground |
| **AgentCore Browser Tool** | Consumption, no minimum | Strongest: per-session dedicated microVM, sanitised on completion | Best isolation, AWS-native |

The June recommendation was AgentCore Browser Tool, with Playwright on Fargate as the interim runtime. AgentCore is not used anywhere in the product (`03`, `05`).

### 4.2 The design, for the record

```
 Automation agent → SQS job queue (per-tenant fairness, DLQ, backoff)
       → Fargate worker → isolated browser session
             ├── Secrets Manager: per-tenant portal credentials, KMS-encrypted,
             │   resolved inside the session, never logged, never in agent context
             ├── 2FA/OTP human-in-the-loop: pause → ask the tenant → resume
             └── Audit log per run (screenshots, actions, outcome, cost)
                 + credit metering (17) + kill switch per portal
```

The properties that mattered — queue-based pacing, per-tenant credential isolation, a human in the loop for OTP and first posts, a full audit trail, a per-portal kill switch — are the right properties for *any* automation that acts as a customer. They are recorded here because the next risky integration should start from them rather than reinvent them.

### 4.3 Why it was still dropped

Even done perfectly, the failure mode is the agency's portal account, not ours. An account suspension costs a small agency more than our subscription is worth, and they would be right to blame us. Anti-bot systems also change faster than we could maintain selectors — the June draft already called this the highest-maintenance subsystem in the platform. For a pre-launch, one-founder product that is the wrong thing to own.

## 5. Multi-tenancy, RBAC, audit (applies to the ingestion path)

- **Credentials.** Any portal or feed credential lives in Secrets Manager or SSM, namespaced per tenant. An adapter resolves only the calling tenant's secret. Today the ingestion endpoint itself is protected by a shared internal `x-api-key` (`adapterIngestionInternal.js`), which is fine for first-party adapters and not fine for anything a customer configures.
- **RBAC.** Today's real roles are `ADMIN` / `MEMBER` in the auth model (`platform/auth/src/models/usersModel.ts`), with the CRM server additionally accepting `FOUNDER` / `OWNER` / `MANAGER` (`agency-app/api/middleware/requireRole.js`). Configuring a lead source is an **admin action** — `requireAdmin` (`ADMIN`, `FOUNDER`, `OWNER`). There is no Owner-vs-Manager distinction to rely on; `MANAGER` is planned but not sold yet (`15`).
- **Audit.** Every ingest already writes an idempotency record and a lead row. A general CRM mutation audit log does not exist yet (`00 §7`) — a portal adapter is one of the sources that will make it necessary.

## 6. Recommendation summary

1. **Build portal lead ingestion as an adapter** on `POST /api/internal/adapters/leads`. Start with email-parse, because it needs nobody's permission.
2. **Add the phone GSI first** if the source is high-volume.
3. **Do not build listing-posting automation.** The decision is taken; revisit only with a sanctioned API.
4. **Pursue official portal feeds and partnerships** as the route to status sync and inventory sync.
5. **Fix the landing-page claims** until an adapter actually ships.
6. **Keep the risk framing** in `19-risk-analysis.md` current — this is a business risk decision, not an engineering preference.
