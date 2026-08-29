---
name: contact-management
description: Manage unified contacts — create, update, delete, roles (owner/buyer/seller/tenant), notes, lookup.
metadata: { "openclaw": { "requires": { "env": ["CRM_API_BASE", "CRM_TOKEN"] }, "primaryEnv": "CRM_TOKEN" } }
user-invocable: true
---

# Contact Management

Scripts at `{baseDir}/scripts/`. Contacts can hold multiple roles. Never ask for API URLs.

---

## Get Contacts
Triggers: list contacts, contacts by role, filter by area  
Command: `npx tsx {baseDir}/scripts/get-contacts.ts '{}'` — pass `{}` for all.

Role values: `owner` | `buyer` | `seller` | `tenant`

```json
{"role":"owner","area":"Bandra"}
```

---

## Create Contact
Triggers: add contact, register contact  
Required: `name`  
Command: `npx tsx {baseDir}/scripts/create-contact.ts '<json>'`

```json
{"name":"Aisha Patel","phone":"9876543210","roles":{"owner":true}}
```

---

## Update Contact
Triggers: update contact details  
Command: `npx tsx {baseDir}/scripts/update-contact.ts '<json>'` — include `contactId`.

```json
{"contactId":"c1","address":"Bandra, Mumbai"}
```

---

## Update Contact Role
Triggers: add/remove role, assign as owner/buyer/seller/tenant  
Command: `npx tsx {baseDir}/scripts/update-contact-role.ts '<json>'`

```json
{"contactId":"c1","role":"owner","enabled":true}
{"contactId":"c1","role":"buyer","enabled":false}
```

---

## Delete Contact
Triggers: delete contact  
Confirm before executing.  
Command: `npx tsx {baseDir}/scripts/delete-contact.ts '<contactId>'`

---

## Contact Notes
Triggers: add/view/update/delete contact note  
Command: `npx tsx {baseDir}/scripts/contact-notes.ts '<json>'`

action: `list` | `add` | `update` | `delete`

```json
{"action":"add","contactId":"c1","content":"Met at property expo"}
{"action":"list","contactId":"c1"}
```

---

## Search / Lookup Contact
Triggers: find contact by phone, search by name  
Command: `npx tsx {baseDir}/scripts/search-contacts.ts 'query'`

---

## Field Reference
**Required:** `name`  
**Optional:** `phone`, `email`, `address`, `status` (active|inactive), `roles` (object with owner/buyer/seller/tenant booleans)  
**Delete:** allowed

## Rules
- Contacts can hold multiple roles simultaneously
- Lookup by phone before creating to avoid duplicates
- Confirm before delete — permanent
- Role changes do not delete contact data

## References
`{baseDir}/references/api.md` | `{baseDir}/references/examples.md` | `{baseDir}/references/edge-cases.md`
