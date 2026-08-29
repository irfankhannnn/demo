# Tenant Management — Edge Cases & Business Rules

## Terminology
- Tenants are stored as "customers" in the CRM API. All commands use `customerId`, not `tenantId`.
- Be careful not to confuse with leads or contacts.

## Deduplication
- Always search by phone before creating. If match exists, show existing tenant and ask for confirmation.

## Missing Fields
- `name` is the only required field. If not provided, ask for it.

## No Delete
- Tenant delete is disabled by CRM policy.
- If user asks to delete, explain: "Tenants cannot be deleted. Set `status=inactive` to deactivate."

## Status Values
- `active` — current or potential tenant
- `inactive` — no longer active
- `past` — has moved out, kept for history

## Rental History
- `archive` action moves `currentRental` into `rentalHistory` and clears `currentRental`.
- Confirm with user before archiving — they may lose current rental data context.

## Update Current Rental
- Will overwrite the existing `currentRental` object completely (PUT semantics).
- If tenant already has a rental and user wants to change property, archive first then update.

## Phone Format
- Backend normalizes to last 10 digits. `+91-9876543210` → `9876543210`.

## Multiple Matches
- If search returns >1 result, list all and ask user to pick by ID.

## Money
- `monthlyRent` and `securityDeposit` stored as integers (rupees).
- Normalize: 45k → 45000, 1.2L → 120000.
