# 09 — Lead Qualification Engine (+ AI Sales Assistant & Follow-Up)

> **Scope:** turning a raw conversation into a qualified, profiled lead — and the grounded Sales Assistant and Follow-Up Automation that surround it. Builds on `04` (agents), `05` (MCP), `08` (channels), `14` (knowledge).

---

## 1. What "Qualified" Means

A lead is **qualified** when the engine has captured, with confidence, the buying frame:

| Slot | Examples | Source |
|---|---|---|
| **Budget** | "80L–1Cr" | conversational + enrichment |
| **Timeline** | "in 3 months", "just browsing" | conversational |
| **Location** | "Andheri West", "near a metro" | conversational |
| **Configuration** | 2BHK, 3BHK, plot, commercial | conversational |
| **Purpose** | end-use vs investment, rent vs buy | conversational + intent |
| **Financing** | loan needed? pre-approved? | conversational |
| **Contact completeness** | phone/email/name | progressive |

Qualification is **progressive** — collected across messages and sessions without interrogating. The Lead record (existing model already has requirement sub-objects) is the durable store; the agent fills slots over time.

## 2. Qualification as Progressive Profiling (not a form)

**Lead Qualifier agent (`04`, T0→T1, Haiku):** on each turn it (1) extracts any slots present in the user's message, (2) updates the Lead via Lead MCP, (3) computes the **next best question** given what's missing and conversation tone, and hands a suggested question to the Sales Assistant to weave in naturally. Principles:
- **One question at a time**, contextual, never a wall of fields.
- **Infer, don't ask**, where possible (location from the property they asked about; configuration from the listing they clicked).
- **Enrichment**: fill gaps from prior conversations, the originating ad/portal, and any provided data before asking.
- **Intent detection**: distinguish "ready buyer" from "tyre-kicker" from "broker/competitor" to set effort.

## 3. AI Sales Assistant (grounded)

The customer-facing conversational agent (`04`, T1→T2, Sonnet). It answers about **projects, brochures, floor plans, pricing, payment plans** and **schedules site visits and calls** — always grounded:

- **Sources:** Property/Inventory MCP (live inventory, pricing, payment plans, availability), Knowledge MCP (project/sales/agency knowledge via RAG, `14`), Document MCP (brochures/floor plans). **Never hallucinated** (`04 §5`): if a fact isn't in a tool result, it says so and creates a task.
- **Catalog caching:** the tenant's stable catalog + system prompt are prompt-cached (1-hr TTL) → cached reads ~0.1× input, the main cost lever.
- **Actions:** `schedule_visit` / `schedule_callback` (Visit/Voice MCP), `get_brochure`/`get_floor_plan` (Document MCP), hand-off to human (Task MCP) on request or low confidence.
- **Language:** English/Hindi/Hinglish to match the lead (consistent with brand tone and voice system `12`).

## 4. Follow-Up Automation Engine

Most real-estate leads convert on the **5th–8th touch**, not the first. The Follow-Up/Nurture agent (`04`, T2) drives **journeys** as **Step Functions** state machines (per lead), branching on engagement:

| Trigger | Example automated action |
|---|---|
| New qualified lead | Send brochure + floor plan (Utility template, in-window) |
| Viewed but no reply | Gentle nudge + matching alternatives |
| Price interest | Send payment plan + offer |
| Site visit booked | Reminders (T-1day, T-2h), directions |
| Post-visit | Feedback ask + next-step proposal |
| Inventory match | "New 3BHK in your area" alert |
| Going cold | Re-engagement; optionally an AI voice call (`12`) |

Design notes: **channel-aware** (prefer free in-window WhatsApp; respect template categories/cost, `08 §4`); **grounded** (offers/inventory from MCP); **rate-limited & consent-aware** (no spam; DPDP/Meta policy); **autonomy-graduated** (draft→approve→auto per `04 §6`); **stops on human takeover or conversion.**

## 5. Data & Flow

```
Conversation (08) → Qualifier extracts slots → Lead MCP updates Lead
   → Scorer (10) → Assignment (11)
   → Sales Assistant answers grounded (Property/Knowledge/Document MCP)
   → Visit booked (Visit MCP) OR Follow-Up journey started (Step Functions)
   → events: LeadQualified, VisitBooked, JourneyStarted → analytics (10,/dashboards)
```

## 6. Reuse of Existing Assets
- The disabled `aiCallingInternal.js` already defines lead-context, property-availability, property-details, and site-visit endpoints — exactly the Sales Assistant's tool surface. Re-enable behind MCP.
- The calling service's intent set (`PROPERTY_AVAILABILITY`, `SCHEDULE_SITE_VISIT`, `PRICING_INFO`, `FAQ_POLICY`…) is a ready taxonomy — but replace its **regex** classifier with the Haiku-based Qualifier/Router for robustness.
- SyncBot's `convert-lead` and business rules inform the qualification→conversion logic.

## 7. KPIs
Qualification rate, slot-completeness, qualified-lead→visit conversion, follow-up SLA compliance, touches-to-conversion, groundedness/eval scores, cost-per-qualified-lead.

## 8. Phasing
- **P1:** Qualifier (slot extraction + next-best-question) + Sales Assistant (grounded answers, visit booking) on WhatsApp/web; approval-queue.
- **P2:** Follow-Up journeys (Step Functions) with WhatsApp; RAG-grounded knowledge.
- **P3:** Voice follow-up integration; cross-channel journeys; autonomy graduation.
