# Current Issues & Pending

## Active: SyncBot Interaction Design (2026-07-19)

See [`syncbot-interaction-design.md`](./syncbot-interaction-design.md) and  
[`docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md`](../docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md).

### Open

- [ ] Live WhatsApp verification after CRM Lambda deploy (cards + recommendations end-to-end)
- [ ] Optional: `npm install` in `server/` so Jest suite runs in CI (`goldenConversations.test.js`)

### Done (this workstream)

- [x] Mini-profile cards: lead, buyer, owner, tenant, property, contact, meeting
- [x] Formatter modules under `server/agents/formatting/` (+ compact create confirmations, warm empty/error states)
- [x] Relative dates + Phone/Email labels; UUID hiding on detail cards
- [x] Buyer / property / contact AI DTO pipeline + flags enabled in local `.env`
- [x] Hybrid `metadata.recommendation` for lead, buyer, owner, tenant, property, contact, meeting (`aiViewBuilders/recommendations.js`)
- [x] Conversation memory: `lastListResults`, `currentEntity` (+ prompt injection)
- [x] Prompt: detail-by-name + UUID policy
- [x] Golden check: `node agents/run-golden-check.mjs` (+ Jest file `goldenConversations.test.js`)
- [x] Buyer COMPLETE / PHASED docs
- [x] Interaction Design v1 + doc redirects; obsolete 09-design-goals redirected


---

## Historical: Baileys robustness (still relevant)

### Known limitations

1. **Duplicate message risk on retry** — accepted trade-off vs silent loss.
2. **Pending delivery queue** is backup; primary retry is server-side.
3. **Tool schema simplicity** — nested requirement objects may confuse LLMs.
4. **Baileys patch maintenance** — regenerate patches on Baileys upgrade.
5. **Health probe false negatives** — unknown half-open symptoms may need investigation.

### Baileys next steps

1. Manual retest after network disconnect / half-open.
2. Soft reset path on high-severity crypto errors.
3. Budget update flow: verify `buyerRequirement` not notes.
4. Consider pending-delivery queue removal if server retry is solid.
