# SyncBot Interaction Design v1.0

**Status:** Active source of truth  
**Audience:** Product + engineering implementing WhatsApp SyncBot replies  
**Supersedes:** `docs/current_design/09-design-goals.md` (target outline)

---

## Purpose

Every SyncBot reply helps an Indian real estate agent **act in under 10 seconds**.

Detail pages are **not** creative. Users expect a consistent WhatsApp mini-profile card.

### Five questions every detail response must answer

1. Who is this? — Name + type  
2. What's their current status? — Qualified, New, Hot, etc.  
3. What do I need to know right now? — Budget, area, property, phone  
4. What happened recently? — Last contact, latest note, next follow-up  
5. What should I do next? — One actionable insight  

### What NOT to do

- Dump DynamoDB / internal IDs (`pk`, `sk`, `tenantId`, UUIDs)
- Write paragraphs ("Sakina Shaikh is a buyer lead who was created on…")
- Hide important info ("Sakina Shaikh is a buyer. Anything else?")
- Let the LLM invent a different layout for every detail view

---

## Three layers (keep separate)

```
CRM Service → Normalizer → ViewBuilder → AI DTO
                                              ↓
                              Formatter (templates) → WhatsApp
                                              ↑
                         LLM (summaries / chat / notes only)
```

| Layer | Responsibility | Must not |
|-------|----------------|----------|
| ViewBuilder | Project fields, format money/dates for data | Generate English prose |
| Formatter | WhatsApp layout (cards, lists, confirmations) | Call DynamoDB |
| LLM | Summaries, greetings, clarifications, note warmth | Re-layout detail/list cards |

---

## Interaction modes

| Mode | When | Behavior |
|------|------|----------|
| Conversational | Greetings, empathy | Brief reply; may offer daily brief |
| Concise | Clear list/search intent | Tool → structured list |
| Clarifying | Missing required slot | One targeted question |
| Proactive | High-value insight available | Card/list + recommendation |

**Principle:** Never ask unnecessary follow-ups. Ask only when action cannot proceed safely.

---

## Tool ownership (who formats)

| Category | Tools (examples) | Owner |
|----------|------------------|-------|
| **Details** | `get_lead`, `get_buyer`, `get_owner`, `get_tenant`, `get_property`, `get_contact`, `get_meeting`, `*_by_phone` | Formatter mini-profile |
| **Search / list** | `search_*`, `get_owners`, `get_upcoming_meetings`, `get_*_notes`, `get_property_documents` | Formatter numbered list |
| **Create / update / convert** | `create_*`, `update_*`, `convert_*` | Formatter confirmation + compact card |
| **Delete** | `delete_*` | LLM confirms first; formatter after success |
| **Notes** | `create_*_note`, `update_*_note` | LLM preferred; formatter fallback |
| **Summary / insight** | `get_*_summary`, `get_priority_leads`, `get_daily_brief`, `suggest_next_actions`, `get_dashboard_snapshot`, `get_business_health`, `get_crm_metrics`, `get_recent_activity`, `get_followup_summary`, `get_pipeline_summary` | LLM 3-layer |

---

## Detail card template (canonical)

Section order is fixed:

```
Identity (*Name*)
↓
Current Status (dot + type • status • priority)
↓
Contact Info
↓
Domain block (Looking For / Properties / Rental / Specs)
↓
Assigned / Related (when present)
↓
Timeline
↓
Latest Note
↓
Quick Stats (when present)
↓
Insight / Recommendation
```

### Buyer lead example

```
*Sakina Shaikh*

🟢 Buyer Lead • Qualified • High Priority

📞 Phone: +91 98765 12345
📧 Email: sakina@email.com

🏠 Looking For
• 2 BHK Apartment
• Andheri, Powai
• Budget: ₹85L – ₹1Cr

👤 Assigned To
• Imran Khan

📅 Timeline
• Created: 12 Jul 2026
• Last Contact: Yesterday
• Next Follow-up: Tomorrow (11:00 AM)

📝 Latest Note
"Interested in ready-to-move properties. Wants site visit this weekend."

📊 Quick Stats
• Lead Score: 91/100
• Source: MagicBricks
• Interactions: 7

💡 Recommendation
Follow up tomorrow as scheduled.

Reason:
• High budget
• Site visit requested
• Lead score: 91
```

### Owner example

```
*Sakina Shaikh*

🟢 Property Owner • Active

📞 Phone: +91 98765 12345

🏠 Properties
• 2 Apartments
• 1 Commercial Shop

📍 Primary Area
• Andheri West

📑 Verification
✅ Documents Verified

📝 Latest Note
"Ready to negotiate if offer above ₹1.8Cr."

💡 Two of Sakina's properties are available for matching with buyer leads.
```

### Per-entity domain blocks

| Entity | Domain sections |
|--------|-----------------|
| Lead (buyer/tenant) | Looking For |
| Lead (seller/owner) | Property |
| Buyer | Looking For |
| Owner | Properties, Primary Area, Verification |
| Tenant | Current Rental **or** Looking For, Verification |
| Property | Specs, Pricing, Location, Owner name |
| Contact | Role, Related context |
| Meeting | When, Location, Related entity name, Attendees |

### UUID policy

Never show `leadId`, `propertyId`, `ownerId`, etc. unless the user explicitly asks for the ID.

### Insight policy (hybrid)

1. If DTO `metadata.recommendation` is present → render it (tool/service-driven).  
2. Else → deterministic rule-based insight in the formatter.  
3. Never invent long prose insights in the LLM for detail tools.

Priority for tool-driven recommendations: **lead → buyer → owner** first; then tenant/property.

---

## List template

```
*Buyer Leads (3)*

1. *Sakina Shaikh* (Buyer | Qualified | High)
   ₹90L | Andheri | 2 BHK
2. ...
```

Rules:
- Max **5** rows when `hasMore`; otherwise up to `RESPONSE_MAX_LIST_ITEMS`
- Show `+N more` when truncated
- No UUIDs in rows
- Optional short LLM intro **may** be prepended by the formatter (search only)

---

## Confirmation templates

**Create:** `✅ Buyer lead *Name* created.` + 2–3 key fields  
**Update:** `✅ Updated *Name* — status: New → Qualified` (use `metadata.updatedFields` when present)  
**Delete:** `✅ Lead *Name* deleted.`  
**Convert:** `✅ *Name* converted to Buyer.`  
**Note:** LLM warm line preferred; fallback `✅ Note added on *Name*.`

---

## Summary / insight (LLM)

3-layer structure (max ~600 chars):

1. Direct answer (bold headline fact)  
2. 2–4 context bullets  
3. One follow-up CTA  

Never dump every metric field.

---

## Conversation rules

- Exactly **one** search result → auto-open detail (`get_*`) preferred  
- Multiple results → numbered disambiguation; never auto-pick  
- Delete always two-step: confirm → execute on yes/haan  
- Money: compact Indian format (`₹80L`, `₹1.2Cr`)  
- Relative dates for timeline: Today / Yesterday / Tomorrow (time) when within ±1 day  
- Memory must support: "open second one", "call him", "add note" via `lastListResults` + `currentEntity`

---

## Edge cases

| Case | Behavior |
|------|----------|
| No results | Warm empty + suggested next search |
| Ambiguous name | List matches with area/type |
| Permission denied | Explain + suggest admin |
| Stale session (>2h) | Soft welcome back |
| Error DTO (`metadata.error`) | Friendly line, never JSON |

---

## Implementation map

| Concern | Code |
|---------|------|
| Templates | `apps/crm/server/agents/formatting/` |
| Orchestrator | `apps/crm/server/agents/responseFormatter.js` |
| Prompt rules | `apps/crm/server/agents/prompts.js` |
| Routing registry | `apps/crm/server/agents/formatting/routing.js` |
| AI DTOs | `apps/crm/server/aiViewBuilders/`, `apps/crm/server/aiDtoMiddleware.js` |
| Memory | `apps/crm/server/conversationStateService.js` |

---

## Acceptance criteria

- [ ] Detail of buyer lead matches section order above  
- [ ] Detail of owner matches owner example structure  
- [ ] Property / contact / meeting use mini-profile cards (not flat ID dumps)  
- [ ] No UUID leakage on detail/list cards  
- [ ] Summary tools remain LLM-owned  
- [ ] Search lists use consistent numbered rows  
- [ ] Golden conversations pass (see appendix)

---

## Appendix — Golden conversations (minimum)

1. Show complete details of Sakina Shaikh (buyer lead)  
2. Show Sakina Shaikh (owner)  
3. Search buyers Andheri → open second one  
4. How many leads? → summary tool, not search  
5. Who should I call? → priority leads  
6. Good morning → daily brief  
7. Delete lead → confirm → delete  
8. Add note on current entity  
9. Update budget → requirement object, not note  
10. Empty search → warm empty state  

---

## Version

v1.0 — 2026-07-19
