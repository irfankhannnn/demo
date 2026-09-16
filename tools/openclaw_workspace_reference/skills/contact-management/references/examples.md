# Contact Management — Conversational Examples

## Create Contact

**"Add a contact named Aisha Patel, phone 9876543210, make her an owner"**
```json
{"name":"Aisha Patel","phone":"9876543210","roles":{"owner":true}}
```
→ `create-contact.ts`

**"Create a buyer contact Rajesh, email raj@gmail.com"**
```json
{"name":"Rajesh","email":"raj@gmail.com","roles":{"buyer":true}}
```

**"Register new contact Sarah, address Juhu, no role assigned yet"**
```json
{"name":"Sarah","address":"Juhu, Mumbai"}
```

---

## Get / List Contacts

**"Show all contacts"** → `get-contacts.ts '{}'`

**"List all owner contacts"** → `get-contacts.ts '{"role":"owner"}'`

**"Show active tenants"** → `get-contacts.ts '{"role":"tenant","status":"active"}'`

---

## Update Contact

**"Change contact c1 address to Bandra"**
```json
{"contactId":"c1","address":"Bandra, Mumbai"}
```
→ `update-contact.ts`

Contact activity is calculated from current owner, seller, buyer, and tenant relationships and cannot be updated directly.

---

## Update Role

**"Add owner role to contact c1"**
```json
{"contactId":"c1","role":"owner","enabled":true}
```
→ `update-contact-role.ts`

**"Remove buyer role from contact c1"**
```json
{"contactId":"c1","role":"buyer","enabled":false}
```

**"Assign tenant role to contact c1"**
```json
{"contactId":"c1","role":"tenant","enabled":true}
```

---

## Delete Contact

**"Delete contact c1"** → `delete-contact.ts 'c1'`
- Confirm before executing.

---

## Contact Notes

**"Add note to contact c1: met at property expo"**
```json
{"action":"add","contactId":"c1","content":"Met at property expo"}
```
→ `contact-notes.ts`

**"Show notes for contact c1"**
```json
{"action":"list","contactId":"c1"}
```

**"Delete note n1 from contact c1"**
```json
{"action":"delete","contactId":"c1","noteId":"n1"}
```

---

## Search / Lookup

**"Find contact by phone 9876543210"** → `search-contacts.ts '9876543210'`

**"Search for contact named Aisha"** → `search-contacts.ts 'Aisha'`

**"Lookup contact with phone +91-9876543210"** → `search-contacts.ts '+91-9876543210'`
