# API Tests Explained — What Are The 74 API Tests?

## Overview

Your test suite has **74 API tests** that validate backend logic via HTTP requests (no browser).

---

## API Tests vs UI Tests

### **API Tests** (74 tests)
- **No browser** — Just HTTP requests to your backend
- **Fast** — No page loads, no clicks, no waiting
- **Direct** — Hit `/api/crm/leads`, `/api/crm/properties`, etc.
- **Purpose:** Validate backend logic, security, data integrity

### **UI Tests** (115 tests)
- **With browser** — Click buttons, fill forms, navigate pages
- **Slower** — Page loads, animations, network calls
- **User-facing** — Simulates real user actions
- **Purpose:** Validate user flows, UI functionality

---

## The 74 API Tests — Breakdown

### 1. `cors-public-endpoints.spec.ts` (11 tests)

**Purpose:** Ensures your API has proper CORS, auth, and tenant protection.

**Tests:**
- ✅ OPTIONS preflight returns CORS headers
- ✅ GET request includes CORS headers
- ✅ B2B lead with invalid tenantId → 400
- ✅ B2B lead with SQL injection-like tenantId → 400
- ✅ Enquiry contact without tenantId → 400/401/403
- ✅ GET /api/crm/customers without token → 401
- ✅ POST /api/crm/leads without token → 401
- ✅ GET /api/khata/entries without token → 401
- ✅ POST /api/khata/entries without token → 401
- ✅ GET /api/grievance without admin token → 403
- ✅ PUT /api/grievance/:id without admin token → 403

**What it validates:**
- CORS headers are properly configured
- Public endpoints require tenant IDs
- Protected endpoints require authentication
- Admin endpoints require admin role

---

### 2. `cross-tenant-pentest.spec.ts` (7 tests)

**Purpose:** Ensures tenants can't access each other's data.

**Tests:**
- ✅ Tenant A GET /api/crm/buyers/{B_buyer_id} → 404
- ✅ Tenant A PUT /api/crm/buyers/{B_buyer_id} → 404
- ✅ Tenant A DELETE cross-tenant resources → 404 each
- ✅ Tenant A GET /api/khata/entries?tenantId=TENANT_B → only A data
- ✅ Tenant A GET /api/ai-employee/status → scoped to A
- ✅ POST /api/grievance x6 from same IP → 6th returns 429
- ✅ POST /api/billing/webhook with invalid signature → 401

**What it validates:**
- Multi-tenant isolation works correctly
- Rate limiting prevents abuse
- Webhook signatures are validated

---

### 3. `data-integrity.spec.ts` (8 tests)

**Purpose:** Ensures data is consistent, deletions work, timestamps exist, conversions preserve data.

**Tests:**
- ✅ Create property with non-existent ownerId → handled
- ✅ Create meeting with non-existent related entity → handled
- ✅ Add note to non-existent customer → 404
- ✅ Delete owner with properties → properties still exist or handled
- ✅ Delete lead then GET → 404 (verify deletion)
- ✅ Delete property then check owner properties list → property gone
- ✅ Update property status → searchable by new status
- ✅ Settle entry → settlement status reflected in summary
- ✅ Create entity → has createdAt timestamp
- ✅ Update entity → has updatedAt timestamp
- ✅ Seller lead conversion: all property details preserved
- ✅ Owner lead conversion: rental property details preserved
- ✅ Buyer lead conversion: purchase details recorded
- ✅ Tenant lead conversion: lease details recorded
- ✅ Lead conversion: notes transferred to converted entity

**What it validates:**
- Referential integrity (can't link to non-existent entities)
- Cascade delete behavior (or lack thereof)
- Deletion actually removes data
- GSI (Global Secondary Index) consistency
- Khata transaction consistency
- Audit trail (createdAt/updatedAt timestamps)
- Lead conversion data integrity

---

### 4. `concurrent-race.spec.ts` (4 tests)

**Purpose:** Ensures your backend handles concurrent requests correctly.

**Tests:**
- ✅ Simultaneous settlement of same entry → only one succeeds
- ✅ Two simultaneous updates to same lead → last write wins or conflict
- ✅ Concurrent property status updates → deterministic result
- ✅ Rapid-fire API requests → rate limited eventually

**What it validates:**
- Race conditions don't corrupt data
- Concurrent updates are handled safely
- Rate limiting works under load

---

### 5. `edge-cases-boundary.spec.ts` (14 tests)

**Purpose:** Ensures your backend handles weird inputs correctly.

**Tests:**
- ✅ Create customer with empty name → 400
- ✅ Create customer with null name → 400
- ✅ Create customer without phone → 400
- ✅ Update customer with empty body → handled
- ✅ Customer name at max 100 chars → accepted
- ✅ Customer name at 101 chars → rejected or truncated
- ✅ Phone at 10 digits → accepted
- ✅ Phone at 9 digits → rejected
- ✅ Property title at max 200 chars → accepted
- ✅ Special characters (Unicode, emojis) → stored safely
- ✅ Property price = 0 → handled
- ✅ Property price = negative → rejected
- ✅ Property price = very large → handled
- ✅ Khata amount = 0 → handled
- ✅ Khata amount = negative → rejected
- ✅ Meeting in past → handled
- ✅ Meeting with end before start → rejected
- ✅ Meeting with far future date → handled

**What it validates:**
- Empty/null handling
- String length boundaries
- Special character & Unicode handling
- Numeric boundary cases (0, negative, very large)
- Date/time boundary cases (past, future, invalid ranges)

---

### 6. `penetration-security.spec.ts` (12 tests)

**Purpose:** Ensures your backend is secure against common attacks.

**Tests:**
- ✅ SQL injection in customer name → 400
- ✅ SQL injection in owner search → no crash
- ✅ XSS in customer name → stored safely
- ✅ PK/SK key injection in create customer → 400
- ✅ GSI key manipulation in create property → 400
- ✅ File upload with path traversal filename → blocked
- ✅ Document upload with null byte → blocked
- ✅ Property title with shell metacharacters → handled safely
- ✅ x-tenant-id with newline → sanitized
- ✅ Cannot set internal fields via customer creation → 400
- ✅ Access lead from different tenant → 404
- ✅ Access property from different tenant → 404
- ✅ Upload JSON as image/png → blocked
- ✅ Expired/invalid token → 401
- ✅ Missing Authorization header → 401
- ✅ Token with SQL injection → 401

**What it validates:**
- SQL injection prevention
- XSS prevention
- NoSQL injection prevention
- Path traversal prevention
- Command injection prevention
- Header injection prevention
- Mass assignment prevention
- IDOR (Insecure Direct Object Reference) prevention
- Content-Type spoofing prevention
- Broken authentication prevention

---

### 7. `seat-cap.spec.ts` (1 test)

**Purpose:** Ensures subscription seat limits work.

**Tests:**
- ✅ Seat capacity enforcement

**What it validates:**
- Users can't exceed subscription seat limits

---

### 8. `state-transitions.spec.ts` (8 tests)

**Purpose:** Ensures leads/properties/meetings follow valid state transitions.

**Tests:**
- ✅ Valid transition: new → contacted → qualified → negotiating
- ✅ Invalid: negotiating → new (backward) → 400
- ✅ Invalid: lost → contacted (reopening) → 400
- ✅ Converted lead: cannot delete → 400
- ✅ Converted lead: cannot update fields other than notes → 400
- ✅ Valid: for-sale → sold
- ✅ Invalid: sold → for-rent → 400
- ✅ Cannot delete property with sold status
- ✅ Valid: scheduled → completed
- ✅ Invalid: completed → cancelled → 400

**What it validates:**
- Lead state machine (new → contacted → qualified → negotiating → converted/lost)
- Property state machine (available → for-sale/for-rent → sold/rented)
- Meeting state machine (scheduled → completed/cancelled/rescheduled)
- Invalid transitions are blocked
- Converted leads/properties are protected from deletion/modification

---

### 9. `validation-security.spec.ts` (9 tests)

**Purpose:** Ensures input validation and file upload security.

**Tests:**
- ✅ Create customer with unknown field → 400
- ✅ Create owner with PK/SK injection → 400
- ✅ Phone with country code 91 creates correct normalized value
- ✅ Invalid phone (less than 10 digits) → rejected
- ✅ Settlement without notes → 200
- ✅ Settlement with extra field → 400 (strict)
- ✅ Settlement with notes only → 200
- ✅ Unsettle entry → 200 (no admin check)
- ✅ Upload .exe file → blocked by MIME filter
- ✅ Upload valid PNG → allowed

**What it validates:**
- Zod `.strict()` schema validation (rejects unknown fields)
- Phone normalization (strips +91, validates 10 digits)
- Khata settlement validation
- File upload security (MIME type filtering)

---

## Summary Table

| File | Tests | Purpose |
|------|-------|---------|
| `cors-public-endpoints.spec.ts` | 11 | CORS, auth, tenant protection |
| `cross-tenant-pentest.spec.ts` | 7 | Multi-tenant isolation, rate limiting |
| `data-integrity.spec.ts` | 8 | Data consistency, conversions, timestamps |
| `concurrent-race.spec.ts` | 4 | Race conditions, concurrent access |
| `edge-cases-boundary.spec.ts` | 14 | Edge cases, boundary conditions |
| `penetration-security.spec.ts` | 12 | SQL injection, XSS, security attacks |
| `seat-cap.spec.ts` | 1 | Subscription seat limits |
| `state-transitions.spec.ts` | 8 | State machine logic |
| `validation-security.spec.ts` | 9 | Input validation, file upload security |
| **Total** | **74** | **Backend validation via HTTP** |

---

## Example: API Test vs UI Test

### **API Test** (Fast, no browser)

```typescript
// Hit the API directly
const response = await request.post(`${API_URL}/crm/leads`, {
  headers: { Authorization: `Bearer ${token}` },
  data: { name: 'Test', phone: '9876543210', leadType: 'buyer' }
});
assert.strictEqual(response.status(), 201);
```

**Pros:**
- Fast (milliseconds)
- No browser overhead
- Direct backend validation
- Easy to debug HTTP responses

**Cons:**
- Doesn't test UI
- Doesn't test user flows
- Doesn't validate frontend-backend integration

---

### **UI Test** (Slow, with browser)

```typescript
// Click through the UI
await page.goto('/crm/leads');
await page.click('button[data-testid="create-lead"]');
await page.fill('input[name="name"]', 'Test');
await page.fill('input[name="phone"]', '9876543210');
await page.selectOption('select[name="leadType"]', 'buyer');
await page.click('button[type="submit"]');
await expect(page.locator('.lead-list')).toContainText('Test');
```

**Pros:**
- Tests actual user flows
- Validates UI functionality
- Tests frontend-backend integration
- Catches UI bugs

**Cons:**
- Slow (seconds to minutes)
- Browser overhead
- Flaky due to timing/animation
- Harder to debug

---

## Why Both?

- **API tests** validate backend logic quickly (74 tests)
- **UI tests** validate user flows end-to-end (115 tests)
- Together they give complete coverage of your CRM

---

## How to Run API Tests

```bash
cd tests/playwright

# All API tests (74)
npm run test:api

# Specific API test files
npx playwright test api/cors-public-endpoints.spec.ts
npx playwright test api/data-integrity.spec.ts
npx playwright test api/state-transitions.spec.ts

# With detailed output
npx playwright test api/ --reporter=list
```

---

## Test Categories Breakdown

### **Security Tests** (38 tests)
- CORS configuration
- Authentication enforcement
- Admin RBAC
- SQL injection prevention
- XSS prevention
- NoSQL injection prevention
- Path traversal prevention
- Command injection prevention
- Header injection prevention
- Mass assignment prevention
- IDOR prevention
- Content-Type spoofing prevention
- Broken authentication prevention
- File upload security
- Multi-tenant isolation

### **Data Integrity Tests** (18 tests)
- Referential integrity
- Cascade delete behavior
- Delete behavior verification
- GSI consistency
- Khata transaction consistency
- Audit trail verification
- Lead conversion data integrity

### **Validation Tests** (12 tests)
- Empty/null/undefined handling
- String length boundaries
- Special character & Unicode handling
- Numeric boundary cases
- Date/time boundary cases
- Phone normalization
- Schema validation (strict mode)

### **State Machine Tests** (8 tests)
- Lead state transitions
- Property state transitions
- Meeting state transitions
- Invalid transition blocking

### **Concurrency Tests** (4 tests)
- Race conditions
- Concurrent updates
- Rate limiting

### **Business Logic Tests** (4 tests)
- Seat capacity enforcement
- Khata settlement validation

---

## Key Insights

1. **API tests are fast** — 74 tests run in ~2-3 minutes
2. **API tests are comprehensive** — Cover security, data integrity, validation, state machines
3. **API tests are direct** — No browser, just HTTP requests
4. **API tests complement UI tests** — Together give full coverage

---

## Questions?

See the test files in `tests/playwright/api/` for actual test implementations.
