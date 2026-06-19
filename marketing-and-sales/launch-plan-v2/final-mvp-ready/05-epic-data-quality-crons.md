# EPIC 5 — Data-Quality & Expiry Crons

**Outcome:** Daily automated checks surface half-filled records and soon-expiring agreements to the right people (admin + assigned member) via WhatsApp/email.

**Architecture anchors:**
- CRM single-table `cloudberry-real-estate-crm`; entities and completeness fields confirmed in `server/crmDynamodbService.js`:
  - **Lead**: required `name`, `leadType`; often missing `phone`/`email`/type-specific block (`buyerRequirement` etc.).
  - **Owner**: required `name`,`phone`; KYC `panNumber`,`aadharNumber` often missing.
  - **Customer (tenant)**: required `name`,`phone`; KYC docs (`aadharNumber`,`aadharDocS3Key`,`photoS3Key`) often missing.
  - **Property**: `title`,`area` required; missing `ownerId`, rental/sale info; `agreementStatus`/`verificationStatus` = `pending`.
  - **Agreements**: `PROPERTY_AGREEMENT` (SK `AGREEMENT#`) with `endDate`; also `customer.currentRental.leaseEndDate`. There is **already** a `leaseEndingWithinDays` customer filter — reuse it.
- Cron pattern: individual CFN templates in `/cron/` (see `cron/trial-reminder.yaml`), handlers in `server/scripts/*-cron.js`, deployed separately.
- Messaging: `server/bailey.js` (`sendWhatsAppMessage`, flagged) + `emailService.js` (EPIC 3) for fallback.

---

## E5-T1 — Shared incomplete-record detector

**Goal:** One reusable module classifies records as complete/incomplete per entity, so cron + (future) UI badges share logic.

**Files**
- NEW `server/dataQualityService.js`

**API**
```js
findIncomplete(tenantId) // -> { leads:[{id,name,phone,type:'lead'}], owners:[...], tenants:[...], properties:[{id,name,details}] }
findExpiringAgreements(tenantId, withinDays=30) // -> [{ propertyId, propertyName, endDate, assignedTo }]
```

**Detail**
- Reuse existing CRM list functions (don't re-scan raw). For each entity apply completeness rules:
  - lead incomplete: missing `phone` OR missing the type-specific block for its `leadType`.
  - owner incomplete: missing `panNumber` OR `aadharNumber`.
  - tenant incomplete: missing `aadharNumber` OR `aadharDocS3Key` OR `photoS3Key`.
  - property incomplete: missing `ownerId` OR (`status` rental/sale but no `rentalInfo`/`saleInfo`) OR `verificationStatus!=='done'`.
- Expiring: union of `PROPERTY_AGREEMENT.endDate` and `customer.currentRental.leaseEndDate` within `withinDays`. Reuse the existing `leaseEndingWithinDays` filter for customers.
- Return the **summary fields the owner asked for**: name, mobile, type for leads/owners/tenants; name + area/details for properties.

**Security**
- Tenant-scoped reads only.

**Tests**
- Unit (mocked CRM data): each rule flags the right records; complete records excluded; expiry window boundary correct.

**Acceptance**
- Given mixed data, returns accurate incomplete + expiring sets.

**Depends on:** none.

---

## E5-T2 — Incomplete-data daily cron

**Goal:** Daily digest of half-filled records to the admin.

**Files**
- NEW `server/scripts/incomplete-data-cron.js` (handler)
- NEW CFN `cron/incomplete-data.yaml` (clone trial-reminder; `cron(30 3 * * ? *)` = 09:00 IST; env: CRM table, AUTH_SERVICE_URL, BAILEY, SES)

**Detail**
- For each tenant: `findIncomplete` → build digest:
  ```
  Data quality (today):
  • Half-filled leads: N (e.g., Rahul 98xxxx, ...)
  • Incomplete owners: N
  • Incomplete tenants: N
  • Incomplete properties: N (e.g., "2BHK Kurla")
  ```
- Send to admin via WhatsApp (if `BAILEY_ENABLED` + admin number) else email via `emailService`.
- Cap list length in message (e.g., first 10), with totals.

**Security**
- Admin recipient only; tenant-scoped.

**Tests**
- Unit: builds digest; chooses WhatsApp vs email by flag; one message per tenant-admin.

**Acceptance**
- Admin receives a daily incomplete-records digest.

**Depends on:** E5-T1, E3 (email), E1-T4 (Bailey optional).

---

## E5-T3 — Expiring-agreements daily cron

**Goal:** Alert assigned member (+admin) about agreements expiring within 30 days (window configurable).

**Files**
- NEW `server/scripts/expiring-agreements-cron.js` (handler)
- NEW CFN `cron/expiring-agreements.yaml` (clone trial-reminder; `cron(0 3 * * ? *)` = 08:30 IST; env as E5-T2)

**Detail**
- For each tenant: `findExpiringAgreements(tenantId, withinDays)` (default 30; read from credit-config or a small `OPS_CONFIG` key for configurability).
- Group by `assignedTo`; message each member: "Agreement expiring: {property} on {endDate}"; also send admin a roll-up.
- WhatsApp if enabled (member must have `whatsAppPhoneNumber`), else email.

**Security**
- Member receives only their assigned items; admin gets tenant roll-up; tenant-scoped.

**Tests**
- Unit: groups by member; window boundary; admin roll-up correct.

**Acceptance**
- Assigned members + admin get expiry alerts on schedule.

**Depends on:** E5-T1, E3, E1-T4 (optional).

---

## E5-T4 — (Optional) UI badges for incomplete records

**Goal:** Surface incompleteness in the CRM lists (not just crons).

**Files**
- MODIFY relevant list pages (leads/owners/tenants/properties) to show an "Incomplete" badge using the same rules (expose a lightweight `GET /api/crm/data-quality/summary` from `dataQualityService`).

**Detail**
- Low priority for MVP; include only if time permits. Reuse `dataQualityService` via a new read endpoint.

**Tests/Acceptance**
- Badge appears on incomplete rows.

**Depends on:** E5-T1.

---

## EPIC 5 acceptance (whole)
- Daily crons reliably detect and route half-filled leads/owners/tenants/properties and expiring agreements to the correct recipients, tenant-scoped, with WhatsApp-or-email delivery and configurable windows.
