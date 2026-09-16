# Property Management — Conversational Examples

## Create Property

**"Add a 2BHK apartment in Andheri West for owner o1, rent 45k/month"**
```json
{"ownerId":"o1","propertyType":"apartment","bhk":2,"area":"Andheri West","city":"Mumbai","monthlyRent":45000}
```

**"Create a fully furnished villa in Juhu for owner o2, sale price 3.5 crore"**
```json
{"ownerId":"o2","propertyType":"villa","area":"Juhu","city":"Mumbai","furnishing":"fully-furnished","salePrice":35000000}
```

**"Register a commercial shop in Bandra for owner o3, carpet area 500 sqft"**
```json
{"ownerId":"o3","propertyType":"shop","area":"Bandra","city":"Mumbai","carpetArea":"500 sqft"}
```

---

## Get Properties

**"Show all properties"** → `get-properties.ts '{}'`

**"List all rented properties"** → `get-properties.ts '{"status":"rented"}'`

**"Show properties for sale"** → `get-properties.ts '{"status":"for-sale"}'`

**"Show available properties"** → `get-properties.ts '{"status":"available"}'`

---

## Search Properties

**"Find 2BHK apartments for rent in Andheri under 50k"**
```json
{"status":"for-rent","bhk":"2","propertyType":"apartment","q":"Andheri","maxRent":"50000"}
```

**"Search for fully furnished properties in Bandra"**
```json
{"q":"Bandra","furnishing":"fully-furnished"}
```

**"Show all villas for sale"**
```json
{"propertyType":"villa","status":"for-sale"}
```

---

## Update Property

**"Update rent for property p1 to 50,000"**
```json
{"propertyId":"p1","monthlyRent":50000}
```

**"Change property p1 to fully furnished"**
```json
{"propertyId":"p1","furnishing":"fully-furnished"}
```

---

## Status Actions

**"List property p1 for sale at 85 lakh"**
```json
{"action":"list-for-sale","propertyId":"p1","listedPrice":8500000}
```

**"List property p1 for rent at 45k, deposit 90k"**
```json
{"action":"list-for-rent","propertyId":"p1","expectedRent":45000,"securityDeposit":90000}
```

**"Mark property p1 as sold to buyer b1 at 85 lakh"**
```json
{"action":"mark-sold","propertyId":"p1","soldPrice":8500000,"buyerId":"b1","saleType":"direct"}
```

**"Mark property p1 as rented to tenant c1 starting June 1"**
```json
{"action":"mark-rented","propertyId":"p1","customerId":"c1","rentalDetails":{"leaseStartDate":"2026-06-01","leaseEndDate":"2027-05-31","monthlyRent":45000,"securityDeposit":90000}}
```

**"Vacate property p1"**
```json
{"action":"vacate","propertyId":"p1"}
```

---

## Documents

**"Show documents for property p1"** → `get-property-documents.ts 'p1'`

**"List files attached to property p1"** → `get-property-documents.ts 'p1'`
