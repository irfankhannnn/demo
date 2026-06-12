# Owner Management — Edge Cases & Business Rules

## Deduplication
- Always search by phone before creating. If a match exists, show the existing owner and ask user to confirm before creating a new one.
- `GET /owners/lookup/by-phone` returns `{ found: true, owner: {...} }` or `{ found: false }`.

## Missing Fields
- `name` is the only required field. If not provided, ask for it before running.
- `phone` is strongly recommended. Warn if missing but proceed if user insists.

## No Delete
- Owner delete is disabled by CRM policy.
- If user asks to delete, explain: "Owners cannot be deleted. You can set `status=inactive` to deactivate."

## Status Values
- `active` — default, owner is managing properties
- `inactive` — no longer active, still visible in history

## Phone Format
- Backend normalizes phone to last 10 digits. `+91-9876543210` → `9876543210`.
- Use raw phone numbers in search; normalization is server-side.

## Multiple Matches
- If search returns >1 result, list them all and ask the user to pick the correct one by ID.

## Property Count
- `propertyCount` in list response is derived from linked properties. It is read-only.
- To see actual property details, use `get-owner-properties.ts`.

## KYC Documents (Photo, PAN, Aadhar)
- Document uploads (photo, PAN, Aadhar) require file upload via the web UI — not supported via chat.
- PAN/Aadhar **numbers** can be saved via update: `{"ownerId":"...","panNumber":"ABCDE1234F"}`.

## Seller Count
- `sellerCount` in the list response = owners who have at least one `for-sale` or `sold` property.

## Notes
- Notes are append-only in practice. Delete is available if user explicitly requests it.
- Confirm before deleting a note.
