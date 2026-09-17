# Priority 4 — Response Formatter Architecture

Source: `agency-app/api/agents/responseFormatter.js` + `agency-app/api/agents/formatting/`

Product templates: [`docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md`](../interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md)

---

## Role in the pipeline

```
Gemini returns { thinking, reply }
        ↓
formatAgentReply(reply, toolResults)   ← LLM vs deterministic
        ↓
sanitizeAndFormatReply()
        ↓
🤖 prefix (whatsapp processor)
        ↓
WhatsApp
```

Detail / list / CRUD tools: formatter **owns** the layout.  
Summary / insight tools: LLM owns the reply (3-layer).

---

## Module layout

```
agency-app/api/agents/formatting/
  utils.js        # money, dates, relative dates, phone, capitalize
  sections.js     # contact / timeline / note / recommendation blocks
  insight.js      # rule-based fallback insights
  routing.js      # SUMMARY / DETAIL / LIST tool sets, preferLlmReply
  entityCards.js  # mini-profile cards per entity
  listItems.js    # numbered list rows
```

---

## Deterministic vs LLM

| Concern | Owner |
|---------|-------|
| Detail mini-profile cards | Formatter |
| Search / list rows | Formatter |
| Create / update / delete confirmations | Formatter |
| Summary / insight tools | LLM |
| Note mutations | LLM preferred; formatter fallback |
| Money / relative dates / phone display | Formatter utils |

### Routing sets

- `SUMMARY_INSIGHT_TOOLS` — always LLM when reply valid  
- `DETAIL_ENTITY_TOOLS` — always formatter card  
- `LIST_TOOLS` — always formatter list (`search_*`, `get_owners`, `get_upcoming_meetings`, `get_*_notes`, …)  
- Mutations `create_|update_|delete_|convert_` — formatter  

---

## Detail card (example — lead)

```
*Sakina Shaikh*

🟢 Buyer Lead • Qualified • High Priority

📞 Phone: +91 98765 12345
📧 Email: sakina@email.com

🏠 Looking For
• 2 BHK Apartment
• Andheri, Powai
• Budget: ₹90L

👤 Assigned To
• Imran Khan

📅 Timeline
• Created: 12 Jul 2026
• Last Contact: Yesterday
• Next Follow-up: Tomorrow (11:00 AM)

📝 Latest Note
"…"

📊 Quick Stats
• Lead Score: 91/100
• Source: MagicBricks

💡 Recommendation
…
```

UUIDs are **not** shown. Insight uses `metadata.recommendation` when present, else rule-based `insight.js`.

---

## Environment variables

| Variable | Default | Effect |
|----------|---------|--------|
| `RESPONSE_MAX_LIST_ITEMS` | 10 | Max rows |
| `RESPONSE_MAX_LIST_ITEMS_WITH_MORE` | 5 | When hasMore |

---

## Known gaps (tracked in Interaction Design)

See Interaction Design v1 acceptance criteria and working-context `current-issues-and-pending.md`.
