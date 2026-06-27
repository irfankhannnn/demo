# Buyer Management — Edge Cases & Business Rules

## Deduplication
- Always lookup by phone before creating. If a match exists, show existing buyer and ask user to confirm.
- Cross-role linking: if phone matches an existing owner or tenant, `linkedRoles` is automatically populated with a message like "This person is also a registered owner/tenant."

## Missing Fields
- `name` is the only required field. If not provided, ask for it.
- `budget` optional but strongly recommended for filtering.

## No Delete
- Buyer delete is disabled by CRM policy.
- If user asks to delete, explain: "Buyers cannot be deleted. Set `status=closed` or `on-hold` to archive."

## Status Values
- `active` — currently searching
- `closed` — purchased or no longer searching
- `on-hold` — paused search

## Priority Values
- `low`, `medium` (default), `high`

## Budget Normalization
| Input | Value |
|-------|-------|
| 80 lakh / 80L | 8000000 |
| 1.5 crore / 1.5Cr | 15000000 |
| 50k / 50,000 | 50000 |

## Phone Format
- Backend normalizes to last 10 digits. `+91-9876543210` → `9876543210`.

## Property Type Values
`apartment`, `house`, `villa`, `commercial`, `land`, `office`, `shop`

## Purchase History
- `purchaseHistory` array is read-only, populated when a property is marked as sold to this buyer.
- Do not manually add entries to `purchaseHistory`.
