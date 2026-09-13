# Test brief — lead adapters + billing

Short handover brief. Paste this to a test agent. Full detail:
`lead-adapter-test-plan.md`; design rationale: `lead-adapter-architecture.md`.

## What changed, in one paragraph

Every lead from every source now goes through one function (`server/leadIngestion.js`)
into one table (`CrmTable`, `EntityType: 'LEAD'`) and gets the same downstream
pipeline (notification → `lead.created` → AI qualification call → score → closure).
Instagram enquiries captured by the laptop agent are now promoted into real CRM
leads via a new internal API. A lead arriving for a phone number that already
exists **updates** that lead instead of creating a second one. Billing flipped:
manual work is free, AI work costs credits.

## Setup

Both `server/.env` and `backend_insta_sol_ms/.env` need the **same**
`ADAPTER_INTERNAL_API_KEY` (`openssl rand -hex 32`). Also set
`CRM_INTERNAL_API_URL` (microservice), `AGENTS_ENABLED=true` (server), and a
tenant's `instagramWebhookToken`.

Run automated first — all must pass:
```bash
cd backend_insta_sol_ms && npm test                                   # 91
cd server && NODE_OPTIONS=--experimental-vm-modules npx jest \
  leadIngestion.test.js aiCallBilling.test.js                         # 38
```

## The 12 things that actually matter

**Billing**
1. Creating a lead/contact/property by hand costs **0 credits** *(this was the reported bug — it used to cost 10)*.
2. A 90-second AI call costs **30 credits** (15 per started minute); a 10-second call costs **15**.
3. The same call outcome delivered twice charges **once** *(Exotel and ElevenLabs both report a duration)*.
4. An unanswered call (`duration: 0`) costs **nothing**.
5. Starting a call with a balance under 15 returns **402** and places no call.

**Adapters**
6. ManyChat webhook still works; `requirement: "sell"` now creates a **seller** lead *(it silently became a buyer before)*; `rent` and `heavy_deposit_ok` create **tenant** leads.
7. `POST /api/internal/adapters/leads` rejects a wrong key with **401** and a missing `x-tenant-id` with **400**. The AI-calling key must **not** work here.
8. A laptop-agent enquiry becomes a CRM lead. If the CRM is down the microservice returns **502** and **still stores the enquiry**; retrying creates **no duplicate**.

**Dedupe — one person is one lead**
9. Same phone via two different adapters → **one** lead. Its status/score/assignee are **never** overwritten, and an already-recorded budget is **not** revised.
10. Five identical repeat enquiries → **no** writes, **no** extra note lines *(protects against WhatsApp-volume bloat)*.
11. A repeat enquiry must **not** re-notify or re-run AI qualification *(otherwise every repeat DM re-bills a call)*.

**The point of all of it**
12. A lead from ManyChat and a lead from the Instagram agent behave **identically** downstream — same notification, same `lead.created`, same qualification call, same scoring, same conversion. Any difference in behaviour based on which adapter created the lead is a bug.

## Known-good baselines (don't report these as regressions)

- `real-estate-crm-app` has **98 pre-existing type errors**, 3 in touched files. `frontend_insta_sol_ms` is clean.
- Jest is not installed in `server/node_modules` — use `npx` as shown.
- `insta-data` still stores enquiries; that's intended. The **lead** lives only in `CrmTable`.

## Rollback

Set `INSTA_PROMOTE_ENQUIRIES_TO_LEADS=false` on the microservice. Promotion stops
at once, the Instagram feature keeps working, the CRM is untouched, no redeploy.
