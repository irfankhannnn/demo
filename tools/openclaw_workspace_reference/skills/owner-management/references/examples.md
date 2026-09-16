# Owner Management — Conversational Examples

## Create Owner

**"Add an owner named Rajesh Mehta, phone 9876543210, from Bandra Mumbai"**
```json
{"name":"Rajesh Mehta","phone":"9876543210","address":"Bandra, Mumbai"}
```
→ `create-owner.ts`

**"Register new owner Sarah Khan, email sarah@gmail.com, referred by Amit"**
```json
{"name":"Sarah Khan","email":"sarah@gmail.com","source":"Referral - Amit"}
```

**"Create owner with PAN ABCDE1234F, address Andheri West"**
```json
{"name":"...","address":"Andheri West","panNumber":"ABCDE1234F"}
```

---

## Get / List Owners

**"Show me all owners"** → `get-owners.ts`

**"How many owners do we have?"** → `get-owners.ts`

**"Get details of owner abc123"** → `get-owner.ts 'abc123'`

**"Show me info for owner ID xyz456"** → `get-owner.ts 'xyz456'`

---

## Search Owners

**"Find owner named Rajesh"** → `search-owners.ts 'Rajesh'`

**"Search for owner with phone 9876543210"** → `search-owners.ts '9876543210'`

**"Is there an owner called Mehta?"** → `search-owners.ts 'Mehta'`

---

## Update Owner

**"Mark owner abc123 as inactive"**
```json
{"ownerId":"abc123","status":"inactive"}
```
→ `update-owner.ts`

**"Update owner abc123's address to Juhu, Mumbai"**
```json
{"ownerId":"abc123","address":"Juhu, Mumbai"}
```

**"Add PAN number ABCDE1234F to owner abc123"**
```json
{"ownerId":"abc123","panNumber":"ABCDE1234F"}
```

---

## Owner Notes

**"Add a note to owner abc123: met at expo, interested in selling"**
```json
{"action":"add","ownerId":"abc123","content":"Met at expo, interested in selling"}
```

**"Show notes for owner abc123"**
```json
{"action":"list","ownerId":"abc123"}
```

**"Delete note n1 from owner abc123"**
```json
{"action":"delete","ownerId":"abc123","noteId":"n1"}
```

---

## Owner Properties

**"Show properties owned by owner abc123"** → `get-owner-properties.ts 'abc123'`

**"What properties does Rajesh Mehta have?"** → search first, then get-owner-properties
