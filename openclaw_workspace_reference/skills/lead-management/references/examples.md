# Conversational Extraction Examples

---

## CREATE LEAD

User: "Create buyer lead Faizan"
```json
{"name":"Faizan","leadType":"buyer"}
```

User: "High priority buyer lead Faizan, phone 9876543210, from Referral"
```json
{"name":"Faizan","leadType":"buyer","phone":"9876543210","priority":"high","source":"Referral"}
```

User: "Buyer lead Ahmed wants 3BHK apartment in Powai budget 2 crore"
```json
{"name":"Ahmed","leadType":"buyer","buyerRequirement":{"requirement":"Looking for 3BHK apartment","bhk":3,"preferredArea":"Powai","budget":20000000,"propertyType":"residential","propertySubType":"apartment"}}
```

User: "Create buyer lead Faizan looking for 2BHK flat in Andheri West under 80 lakh, phone 9876543210"
```json
{"name":"Faizan","leadType":"buyer","phone":"9876543210","buyerRequirement":{"requirement":"Looking for 2BHK flat","bhk":2,"preferredArea":"Andheri West","budget":8000000,"propertyType":"residential","propertySubType":"apartment"}}
```

User: "Seller lead Raj selling 3BHK in Bandra for 1.5 crore"
```json
{"name":"Raj","leadType":"seller","sellerProperty":{"propertyType":"apartment","bhk":3,"area":"Bandra","expectedPrice":15000000}}
```

User: "Seller lead Imran has villa in Juhu asking 12 crore"
```json
{"name":"Imran","leadType":"seller","sellerProperty":{"propertyType":"villa","area":"Juhu","expectedPrice":120000000}}
```

User: "Add tenant lead Sarah looking for furnished 2BHK in Powai, rent budget 45k, move in next month"
```json
{"name":"Sarah","leadType":"tenant","tenantRequirement":{"requirement":"Furnished 2BHK apartment","preferredArea":"Powai","budget":45000,"moveInDate":"Immediate"}}
```

User: "Owner lead Imran, 2BHK flat in Sea Breeze building Goregaon, rent 35k, deposit 70k"
```json
{"name":"Imran","leadType":"owner","ownerProperty":{"propertyType":"apartment","bhk":2,"buildingName":"Sea Breeze","area":"Goregaon","rentExpected":35000,"securityDeposit":70000}}
```

User: "Add seller lead Riya from Property Portal, she has a 1500sqft office in BKC for sale, price 3.5 crore"
```json
{"name":"Riya","leadType":"seller","source":"Property Portal","sellerProperty":{"propertyType":"office","carpetArea":"1500","area":"BKC","expectedPrice":35000000}}
```

---

## GET LEADS

User: "Show me all leads"
Script: `get-leads.ts '{}'`

User: "Show all buyer leads"
Script: `get-leads.ts '{"leadType":"buyer"}'`

User: "List all new tenant leads"
Script: `get-leads.ts '{"leadType":"tenant","status":"new"}'`

User: "Top 5 leads by priority"
Script: `get-leads.ts '{"sortBy":"priority","sortOrder":"desc","limit":5}'`

User: "Show me leads from the last 3 days"
→ Compute fromDate = today minus 3 days in YYYY-MM-DD format
Script: `get-leads.ts '{"fromDate":"2026-05-29","sortBy":"createdAt","sortOrder":"desc"}'`

User: "Show me top 5 leads by priority added in last 3 days"
Script: `get-leads.ts '{"fromDate":"2026-05-29","sortBy":"priority","sortOrder":"desc","limit":5}'`

User: "Show buyer leads with low priority but highest budget"
Script: `get-leads.ts '{"leadType":"buyer","priority":"low","sortBy":"budget","sortOrder":"desc"}'`

User: "High priority buyer leads above 1 crore budget"
Script: `get-leads.ts '{"leadType":"buyer","priority":"high","minBudget":10000000,"sortBy":"budget","sortOrder":"desc"}'`

User: "Show active (not converted) seller leads"
Script: `get-leads.ts '{"leadType":"seller","excludeConverted":"true"}'`

User: "Show leads sorted by name A to Z"
Script: `get-leads.ts '{"sortBy":"name","sortOrder":"asc"}'`

User: "Tenant leads with budget under 40k"
Script: `get-leads.ts '{"leadType":"tenant","maxBudget":40000,"sortBy":"budget","sortOrder":"desc"}'`

---

## UPDATE LEAD

User: "Mark Faizan's lead as contacted" (after getting leadId from search)
```json
{"leadId":"abc123","status":"contacted"}
```

User: "Change Ahmed's lead priority to high"
```json
{"leadId":"abc123","priority":"high"}
```

User: "Mark Raj's lead as lost — price too high"
```json
{"leadId":"abc123","status":"lost","lostReason":"Price too high"}
```

User: "Update Faizan's lead — he now wants 3BHK in Bandra, budget 1.2 crore"
```json
{"leadId":"abc123","buyerRequirement":{"bhk":3,"preferredArea":"Bandra","budget":12000000,"propertyType":"residential"}}
```

User: "Assign Imran's lead to agent Salim"
```json
{"leadId":"abc123","assignedTo":"salim"}
```

---

## SEARCH LEADS

User: "Find Faizan's lead"
Script: `search-leads.ts 'Faizan'`

User: "Search lead with phone 9876543210"
Script: `search-leads.ts '9876543210'`

User: "Find lead for sarah@gmail.com"
Script: `search-leads.ts 'sarah@gmail.com'`

---

## DELETE LEAD

User: "Delete Faizan's lead"
→ First search to get leadId, confirm with user, then:
Script: `delete-lead.ts 'abc123'`

---

## LEAD NOTES

User: "Add a note to Faizan's lead: called him, visit scheduled Saturday"
```json
{"action":"add","leadId":"abc123","content":"Called him — visit scheduled Saturday"}
```

User: "Show notes for Faizan's lead"
```json
{"action":"list","leadId":"abc123"}
```

User: "Delete note n1 from Faizan's lead"
```json
{"action":"delete","leadId":"abc123","noteId":"n1"}
```

---

## LEAD METRICS

User: "Show me lead metrics"
Script: `get-lead-metrics.ts '{}'`

User: "Lead stats for May 2026"
Script: `get-lead-metrics.ts '{"from":"2026-05-01","to":"2026-05-31"}'`

---

## CONVERT LEAD

User: "Convert Faizan's buyer lead — he bought property p1 for 80 lakh"
```json
{"leadId":"abc123","purchaseDetails":{"propertyId":"p1","saleAmount":8000000,"purchaseDate":"2026-06-01"}}
```

User: "Convert Sarah's tenant lead — she's taking property p2, rent 45k, deposit 90k, starting June 1"
```json
{"leadId":"abc123","leaseDetails":{"propertyId":"p2","leaseStartDate":"2026-06-01","monthlyRent":45000,"securityDeposit":90000}}
```

User: "Convert Raj's seller lead to owner"
```json
{"leadId":"abc123","createPropertyListing":true}
```
