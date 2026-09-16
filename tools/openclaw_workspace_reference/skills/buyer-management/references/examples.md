# Buyer Management — Conversational Examples

## Create Buyer

**"Add a buyer named Rahul Sharma, budget 80 lakh, looking for 3BHK in Andheri"**
```json
{"name":"Rahul Sharma","budget":8000000,"propertyType":"apartment","bhk":3,"preferredArea":"Andheri"}
```
→ `create-buyer.ts`

**"Register buyer Priya Patel, high priority, email priya@gmail.com"**
```json
{"name":"Priya Patel","email":"priya@gmail.com","priority":"high"}
```

**"Create buyer with phone 9876543210, budget 1.2 crore, looking for villa"**
```json
{"name":"...","phone":"9876543210","budget":12000000,"propertyType":"villa"}
```

---

## Get / List Buyers

**"Show all buyers"** → `get-buyers.ts '{}'`

**"List high priority buyers"** → `get-buyers.ts '{"priority":"high"}'`

**"Show active buyers looking for apartments"** → `get-buyers.ts '{"status":"active","propertyType":"apartment"}'`

---

## Update Buyer

**"Mark buyer b1 as closed"**
```json
{"buyerId":"b1","status":"closed"}
```
→ `update-buyer.ts`

**"Update buyer b1 budget to 95 lakh"**
```json
{"buyerId":"b1","budget":9500000}
```

**"Change buyer b1 priority to medium"**
```json
{"buyerId":"b1","priority":"medium"}
```

---

## Buyer Notes

**"Add note to buyer b1: wants sea-facing property"**
```json
{"action":"add","buyerId":"b1","content":"Wants sea-facing property"}
```
→ `buyer-notes.ts`

**"Show notes for buyer b1"**
```json
{"action":"list","buyerId":"b1"}
```

---

## Buyer Metrics

**"How many buyers do we have?"** → `buyer-metrics.ts`

**"Show buyer summary"** → `buyer-metrics.ts`

**"What's the average budget of our buyers?"** → `buyer-metrics.ts`
