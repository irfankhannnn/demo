# Contact Management — Edge Cases & Business Rules

## Deduplication
- Contacts are deduplicated by phone. Always lookup by phone before creating.
- If a match exists, show the existing contact and ask user whether to use it or create a new one.

## Missing Fields
- `name` is the only required field. If not provided, ask for it.
- `phone` strongly recommended for dedup. Warn if missing.

## Multiple Roles
- A single contact can hold multiple roles simultaneously (e.g. owner + buyer).
- Adding a role does not remove existing roles.
- Removing a role (`enabled=false`) does not delete the contact or its data.

## Delete
- Contact delete IS allowed (unlike owners, tenants, buyers).
- Always confirm before deleting: "This will permanently delete contact [name]. Are you sure?"
- Deleting a contact does not delete linked properties, rentals, or purchases — those remain tied by ID.

## Status Values
- `active` (default) — contact is engaged
- `inactive` — no longer active but kept for history

## Phone Format
- Backend normalizes to last 10 digits. `+91-9876543210` → `9876543210`.

## Multiple Matches
- If search returns >1 result, list all and ask user to pick by ID.

## Role Update
- `profileData` optional in role update — can include role-specific data (e.g. buyer budget, owner property count).
- If `enabled=true` and role already exists, no-op (safe to retry).

## Notes
- Notes are per-contact. CRUD operations available.
- Confirm before deleting a note.

## Lookup by Phone
- `GET /contacts/lookup/by-phone?phone=` returns exact match (normalized).
- If no match, backend returns 404.
