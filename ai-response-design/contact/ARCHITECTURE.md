# Contact AI Architecture

Same pipeline as leads:

```
crmDynamodbService (contact handlers)
    → ContactNormalizer
    → ContactAIViewBuilder
    → { metadata, data }
```

## Boundaries

- Normalizer removes `PK`, `SK`, `GSI*`, `tenantId`, `normalizedPhone`
- ViewBuilder exposes role, phone, email, status, notes — no WhatsApp prose
- Formatter owns the mini-profile card (Interaction Design)

## Tools

`create_contact`, `get_contact`, `search_contacts`, `update_contact`, `delete_contact`,
`update_contact_role`, `create_contact_note`, `get_contact_notes`, `find_contact_by_phone`
