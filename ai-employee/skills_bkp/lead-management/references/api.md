# Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/crm/leads | Create lead |
| GET | /api/crm/leads | List leads (with filters/sort/pagination) |
| GET | /api/crm/leads/:id | Get single lead |
| PUT | /api/crm/leads/:id | Update lead |
| DELETE | /api/crm/leads/:id | Delete lead |
| POST | /api/crm/leads/:id/convert | Convert lead |
| GET | /api/crm/leads/search?q= | Search by name/phone/email |
| GET | /api/crm/leads/metrics | Lead metrics |
| GET | /api/crm/leads/:id/notes | List notes |
| POST | /api/crm/leads/:id/notes | Add note |
| PUT | /api/crm/leads/:id/notes/:noteId | Update note |
| DELETE | /api/crm/leads/:id/notes/:noteId | Delete note |

---

# Lead Schema

**Required:** `name` (string), `leadType` (buyer|seller|tenant|owner)

**Optional core fields:**
- `phone` — normalized automatically
- `email`
- `source` — Website | Referral | Walk-in | Google Ads | Social Media | Property Portal | Broker Network | Other
- `status` — new | contacted | qualified | negotiating | lost (default: new)
- `priority` — low | medium | high (default: medium)
- `assignedTo` — username string
- `notes` — free text
- `lostReason` — required when status=lost: Price too high | Found another property | Not interested anymore | Couldn't reach | Other

**Auto-managed:** `leadId`, `createdAt`, `updatedAt`, `createdBy`, `convertedAt`, `convertedTo`, `history`

---

# Type-Specific Fields

## buyerRequirement (leadType=buyer)
| Field | Type | Notes |
|-------|------|-------|
| requirement | string | free text description |
| budget | number | normalized integer |
| preferredArea | string | |
| propertyType | string | residential \| commercial \| land |
| propertySubType | string | apartment \| house \| villa \| penthouse \| studio (residential); office \| shop \| warehouse \| coworking \| restaurant (commercial); residential-plot \| commercial-plot \| agricultural \| industrial (land) |
| bhk | number | 1–5 for residential; 1–4 for commercial/land size category |
| timeline | string | |

## sellerProperty (leadType=seller)
| Field | Type | Notes |
|-------|------|-------|
| propertyType | string | apartment \| house \| villa \| office \| land |
| bhk | number | |
| buildingName | string | |
| flatNumber | string | |
| floor | string | |
| furnishing | string | |
| carpetArea | string | |
| city | string | |
| address | string | |
| area | string | locality/neighbourhood |
| expectedPrice | number | normalized integer |
| timelineValue | number | |
| timelineUnit | string | days \| months |

## tenantRequirement (leadType=tenant)
| Field | Type | Notes |
|-------|------|-------|
| requirement | string | |
| budget | number | monthly rent budget, normalized |
| preferredArea | string | |
| moveInDate | string | date or "Immediate" |

## ownerProperty (leadType=owner)
| Field | Type | Notes |
|-------|------|-------|
| propertyType | string | |
| bhk | number | |
| buildingName | string | |
| flatNumber | string | |
| floor | string | |
| furnishing | string | |
| carpetArea | string | |
| city | string | |
| address | string | |
| area | string | |
| rentExpected | number | normalized integer |
| securityDeposit | number | normalized integer |

---

# Get Leads — Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| leadType | string | buyer \| seller \| tenant \| owner |
| status | string | new \| contacted \| qualified \| negotiating \| lost |
| priority | string | low \| medium \| high |
| excludeConverted | boolean | true to hide converted leads |
| fromDate | string | YYYY-MM-DD, filters by createdAt >= |
| toDate | string | YYYY-MM-DD, filters by createdAt <= |
| sortBy | string | createdAt \| priority \| budget \| name \| status \| updatedAt |
| sortOrder | string | asc \| desc (default: desc) |
| limit | number | max results to return |
| offset | number | skip N results (for pagination) |
| minBudget | number | min budget/price across all lead types |
| maxBudget | number | max budget/price across all lead types |

---

# Conversion Payloads

## Buyer Conversion
Converts lead → buyer entity. Requires phone + propertyId.
```json
{
  "leadId": "...",
  "purchaseDetails": {
    "propertyId": "...",
    "saleAmount": 8000000,
    "purchaseDate": "2026-06-01",
    "registrationDate": "2026-06-10",
    "registrationNumber": "REG123",
    "stampDutyPaid": 400000,
    "brokeragePaid": 80000
  },
  "kycDetails": { "panNumber": "ABCDE1234F", "aadharNumber": "1234..." },
  "existingContactId": "..."
}
```

## Tenant Conversion
Converts lead → tenant entity. Requires phone + propertyId.
```json
{
  "leadId": "...",
  "leaseDetails": {
    "propertyId": "...",
    "leaseStartDate": "2026-06-01",
    "leaseEndDate": "2027-05-31",
    "monthlyRent": 45000,
    "securityDeposit": 90000,
    "brokeragePaid": 45000
  },
  "kycDetails": { "panNumber": "ABCDE1234F", "aadharNumber": "1234..." }
}
```

## Seller Conversion
Converts lead → owner entity + property listing for sale.
```json
{
  "leadId": "...",
  "createPropertyListing": true,
  "brokeragePaid": 100000
}
```

## Owner Conversion
Converts lead → owner entity + optional rental listing.
```json
{
  "leadId": "...",
  "createPropertyListing": true,
  "brokeragePaid": 0
}
```

---

# Money Normalization

| Input | Output |
|-------|--------|
| 80 lakh | 8000000 |
| 1.5 crore | 15000000 |
| 12 crore | 120000000 |
| 45k | 45000 |
| 2 lakh | 200000 |
| 50 thousand | 50000 |
