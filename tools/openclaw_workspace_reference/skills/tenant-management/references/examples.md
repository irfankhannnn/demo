# Tenant Management — Conversational Examples

## Create Tenant

**"Add a tenant named Sarah Gupta, phone 9876543210"**
```json
{"name":"Sarah Gupta","phone":"9876543210"}
```
→ `create-tenant.ts`

**"Register new tenant Rahul Mehta, email rahul@gmail.com, from Andheri"**
```json
{"name":"Rahul Mehta","email":"rahul@gmail.com","address":"Andheri, Mumbai"}
```

---

## Get / List Tenants

**"Show all tenants"** → `get-tenants.ts`

**"List all active tenants"** → `get-tenants.ts` (scan and filter)

**"Show tenant c1 details"** → Search is not available for single; use API knowledge.

---

## Search Tenants

**"Find tenant named Sarah"** → `search-tenants.ts 'Sarah'`

**"Search for tenant with phone 9876543210"** → `search-tenants.ts '9876543210'`

**"Is there a tenant called Gupta?"** → `search-tenants.ts 'Gupta'`

---

## Update Tenant

**"Mark tenant c1 as inactive"**
```json
{"customerId":"c1","status":"inactive"}
```
→ `update-tenant.ts`

**"Update tenant c1's address to Juhu"**
```json
{"customerId":"c1","address":"Juhu, Mumbai"}
```

---

## Tenant Notes

**"Add a note to tenant c1: prefers quiet building"**
```json
{"action":"add","customerId":"c1","content":"Prefers quiet building"}
```
→ `tenant-notes.ts`

**"Show notes for tenant c1"**
```json
{"action":"list","customerId":"c1"}
```

**"Delete note n1 from tenant c1"**
```json
{"action":"delete","customerId":"c1","noteId":"n1"}
```

---

## Rental Operations

**"Show rental history for tenant c1"**
```json
{"action":"history","customerId":"c1"}
```
→ `tenant-rental.ts`

**"Update tenant c1's current rental: rent 50k, deposit 100k, property p1"**
```json
{"action":"update","customerId":"c1","propertyId":"p1","monthlyRent":50000,"securityDeposit":100000}
```

**"Archive tenant c1's current rental"**
```json
{"action":"archive","customerId":"c1"}
```
