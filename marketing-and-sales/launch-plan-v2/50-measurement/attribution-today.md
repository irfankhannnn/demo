# Attribution today

What we can actually trace from a piece of content to a paying customer, as of 17 Sep 2026 — and what we cannot.

Merged from `archive/content-os/growth-platform/attribution/attribution-architecture.md` and `.../content-attribution.md`. Both were written around a claim that is now false: that CRM leads carry no source, no score and no attribution. They do.

---

## 1. What is captured

| Signal | Where | Evidence |
|---|---|---|
| UTM on signup | `utm_source`, `utm_medium`, `utm_campaign` read from the signup URL into PostHog user traits | `agency-app/web/src/pages/PhoneLogin.tsx:36-47`, `RegisterAdmin.tsx:38`, `src/types/analytics.ts` (`UserTraits`) |
| UTM on a landing-page view | `utm_source` on every `page_view` | `agency-app/landing-pages/_partials/head-analytics.hbs` |
| Lead source, on every lead | `source` (display value) and `sourceAdapter` (`instagram`, `manychat`, …), set at the single ingest point | `agency-app/api/leadIngestion.js` |
| Originating reel, on Instagram leads | `reelRef { postId, permalink }` and `externalRef { igUsername, … }` | `agency-app/instagram-api/services/crmBridge.js`; `agency-app/web/src/types/crm.ts` |
| Lead temperature and why | `score` (HOT/WARM/COLD), `scoreValue`, `scoreReasons`, `scoreSource` | `agency-app/api/utils/leadRubric.js`; shown in `src/pages/crm/LeadDetails.tsx` |
| Per-reel enquiry, hot-lead and DM counts | for a connected Instagram account | `agency-app/instagram-api/routes/media.js`, `routes/insights.js` |
| Revenue events | Razorpay webhooks, mirrored to PostHog | `agency-app/api/routes/billing.js` |

**But**: everything in the lead and reel rows above is a **tenant product feature**. It attributes *our customers'* buyer leads to *their* reels. It does not attribute *our* broker prospects to *our* content, because RealEstateFlow's own Instagram account is not connected to our own Instagram service — Meta App Review is pending (`docs/pending-items/instagram-service-status.md`, `docs/pending-items/instagram-app-review-actions.md`).

## 2. What is missing

- **No UTM, campaign id or content reference on a lead.** The lead record has `source` and `sourceAdapter`, not `utm_*`, `campaignId` or a `contentRef` pointing at an `OPP-*` row.
- **No publish event.** Nothing writes "this `OPP-*` went live as this Instagram media id at this time". Blotato is configured as an MCP (`.mcp.json`) but there is no Blotato webhook and no publish log in code.
- **No join from content to revenue.** Without the two above, "which reel produced a paying customer" has no automated answer.
- **No marketing event store.** `MKT_EVENT`, `POST /api/marketing/events` and `marketingEventsService` do not exist. **Design only — not built.**
- **No Meta Lead Ads capture.** Also irrelevant in M1: there is no paid spend before the PMF gate.

## 3. So how do we attribute in M1? By asking.

At 30-50 trials, the highest-fidelity attribution instrument is a question in the demo and a column in the sheet.

1. **Publish log.** When a post goes out, add a row: date · `OPP-*` id · channel · permalink. One line. This is the denominator the automated version would have built for you.
2. **Ask on first contact.** "Aapne kahan dekha?" / "Where did you come across us?" — record the answer verbatim next to the prospect.
3. **Ask again at demo.** People remember a specific reel more often than a channel. If they name one, write the permalink.
4. **Link UTMs on every deliberate link.** Any link you place yourself — bio, DM, email signature, LinkedIn post — carries `?utm_source=...&utm_medium=...&utm_campaign=...`. That reaches PostHog on the signup, so the channel half is automatic even when the content half is not.
5. **Weekly roll-up.** Row 10 of the [`weekly-scorecard.md`](./weekly-scorecard.md): which posts produced a conversation this week.

That covers M-CR1, M-CR2 and M-CR3 in [`metric-dictionary.md`](./metric-dictionary.md) §7 well enough to decide what to make more of, which is the only decision the data has to support right now.

## 4. What would change this, and when

The smallest real improvement, in order of cost:

| Step | What | Trigger to do it |
|---|---|---|
| 1 | Fire `lead_added` with `source` and `sourceAdapter` from `leadIngestion.js` | any time; it is one call and makes channel mix queryable |
| 2 | Connect `@realestateflow` to our own Instagram service and run ourselves as a tenant | after Meta App Review passes |
| 3 | Store the `OPP-*` id against the Instagram media id at publish time | once step 2 lands — that is where the media id becomes available |
| 4 | A custom event store to join `OPP-*` ↔ media id ↔ revenue | only if PostHog demonstrably cannot do the join after steps 1-3 |

Step 4 is the whole June attribution design compressed into one conditional line. Its full specification is archived and indexed in [`design-only-backlog.md`](./design-only-backlog.md).

> Open decision D29 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md — the analytics backbone (D29a) decides whether step 4 ever happens. Nothing above assumes it does.

## 5. One correction to carry forward

The June documents repeatedly described a "confirmed gap: leads carry status, priority, leadType and assignedTo but no source or score". Every lead has carried `source`, `sourceAdapter`, `externalRef`, `dedupeKey` and an AI-assigned temperature since the lead-adapter work landed (`docs/lead-adapter-architecture.md`). If you find that sentence anywhere else in this playbook, it is stale — the real remaining gap is `utm_*` / `campaignId` / `contentRef` on the lead, and nothing more.
