# Priority 6 — Current Prompt Examples

Source: `apps/crm/server/agents/prompts.js` (whatsapp block) + runtime classifier examples

These examples are **embedded in the system prompt** and strongly influence Gemini behavior.

---

## In-prompt examples (current)

### Count / summary

**User:** "How many leads i have?"

**Tool:** `get_leads_summary {}`

**Expected reply:**
```
Sir, aapke paas total *15 leads* hain.

📊 Breakdown:
• Buyer: 5 | Owner: 3
• Seller: 2 | Tenant: 5

Buyer leads ya sirf new leads ki list dikhau?
```

---

### Ambiguous "show all" (summary vs list tension)

**User:** "Show all leads"

**Tool:** `get_leads_summary {}` ← **note: does not call search_leads**

**Expected reply:**
```
Total *15 leads* hain — categories:
• Buyer (5) • Owner (3)
• Seller (2) • Tenant (5)

Kaunsi category dekhni hai? Reply: Buyer / Owner / Seller / Tenant.
```

**Design tension:** User said "show all" but prompt routes to summary, not row list.

---

### Filtered list

**User:** "Show buyer leads"

**Tool:** `search_leads {"leadType":"buyer"}`

**Expected reply:** `Yeh rahi aapki buyer leads:`

*(Formatter renders the actual rows — LLM intro may be discarded by formatter)*

---

### Priority / who to call

**User:** "Who should I call today?"

**Tool:** `get_priority_leads {}`

**Expected reply:**
```
Aaj sabse pehle *Rahul Shah* ko call karein.

• ₹2Cr buyer, 6 din se contact nahi
• Priya (₹1.2Cr) bhi qualified hai

Rahul ka number bhej du ya lead kholu?
```

---

### Area search

**User:** "Kurla ke leads dikhao"

**Tool:** `search_leads {"query":"Kurla"}`

**Expected reply:** `Yeh rahi Kurla ki leads:`

---

### Create lead

**User:** "Create buyer lead Faizan, phone 9876543210, budget 80 lakh"

**Tool:** `create_lead {"name":"Faizan","leadType":"buyer","phone":"9876543210","buyerRequirement":{"budget":8000000}}`

**Expected:** Tool called; formatter shows create confirmation card.

---

### Greeting

**User:** "Hello"

**Tool:** none

**Expected reply:** `Hello! Main SyncBot. Aaj kaise help karu?`

---

### Delete confirmation (two-step)

**User:** "Delete lead L123"

**Tool:** none yet

**Expected reply:** `Pakka delete karu? Reply 'haan' to confirm.`

---

## Classifier examples (retry loop)

From `classifyIntentWithLLM` system instruction:

| User message | needsRetry | tool |
|--------------|------------|------|
| "leads dikhao" | true | search_leads |
| "owners batao" | true | get_owners |
| "kurla ke leads" | true | search_leads |
| "mat dikhao" | false | null |
| "hello" | false | null |
| "meeting dikhao" | true | get_upcoming_meetings |

---

## Examples NOT in prompt (gaps)

These common flows have **no worked example** today:

| User flow | Ideal behavior | Current gap |
|-----------|----------------|-------------|
| "Show Rahul" → one match → auto open detail | search → if count=1 → get_lead | No auto-open rule |
| "Only hot ones" after a list | Filter prior context | No memory examples |
| "Open second one" | Resolve list index from context | Not documented |
| "Add note: called tomorrow" | Resolve entity from context | Partial (note tool exists) |
| "Kitne buyers?" vs "buyers dikhao" | summary vs search | Only partially distinguished |
| Mixed Hindi script | Devanagari input | No examples |
| Empty search results | Warm empty state + suggestion | Only generic rule in STYLE |
| Partial name match (2 Rahuls) | Disambiguation | No example |

---

## Suggested example additions for v1.0 spec

### Single-result auto-open

```
User: "Show Rahul"
→ search_leads {"query":"Rahul"} → 1 result
→ get_lead {"leadId":"..."}
→ LLM: "Yeh hai Rahul Shah ki lead:" + formatter card
```

### Multi-result disambiguation

```
User: "Show Rahul"
→ search_leads → 3 results
→ LLM: "3 Rahul mil gaye — kaunsa? 1) Rahul Shah Andheri 2) Rahul Kumar Kurla 3) ..."
```

### Context carry

```
User: "Show buyer leads"
→ search_leads
User: "Only hot ones"
→ search_leads {"leadType":"buyer","priority":"high"}
User: "Open second one"
→ get_lead {leadId from prior list index 1}
```

### Note on open lead

```
User: "Add note — site visit Saturday"
→ create_lead_note {leadId from context, note: "..."}
→ LLM: "Ji, Rahul ki lead pe note add kar diya."
```

---

## Influence ranking

For redesign, treat prompt examples as **higher priority than prose rules**:

1. Examples define actual routing (e.g. "Show all leads" → summary not search)
2. Formatter behavior may contradict intro examples (list tools)
3. Classifier examples only cover list-intent retry — not summary routing

Recommend: align examples, tool routing table, and formatter behavior in one v1.0 doc.
