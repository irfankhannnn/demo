# Complete Tool Inventory

Grouped by category. No implementation — names only.

Total: **65** tools

## Buyer (7)

- create_buyer
- create_buyer_note
- delete_buyer
- get_buyer
- get_buyer_notes
- search_buyers
- update_buyer

## Contact (9)

- create_contact
- create_contact_note
- delete_contact
- find_contact_by_phone
- get_contact
- get_contact_notes
- search_contacts
- update_contact
- update_contact_role

## Lead (8)

- convert_lead
- create_lead
- create_lead_note
- delete_lead
- get_lead
- get_lead_notes
- search_leads
- update_lead

## Meeting (5)

- create_meeting
- delete_meeting
- get_meeting
- get_upcoming_meetings
- update_meeting

## Metrics (12)

- get_business_health
- get_buyers_summary
- get_crm_metrics
- get_daily_brief
- get_dashboard_snapshot
- get_followup_summary
- get_leads_summary
- get_pipeline_summary
- get_priority_leads
- get_properties_summary
- get_recent_activity
- suggest_next_actions

## Owner (8)

- create_owner
- create_owner_note
- delete_owner
- get_owner
- get_owner_by_phone
- get_owner_notes
- get_owners
- update_owner

## Property (8)

- create_property
- create_property_document
- delete_property
- delete_property_document
- get_property
- get_property_documents
- search_properties
- update_property

## Tenant (8)

- create_tenant
- create_tenant_note
- delete_tenant
- get_tenant
- get_tenant_by_phone
- get_tenant_notes
- search_tenants
- update_tenant

## CRUD pattern (repeated per entity)

Most entities follow: `create_*`, `get_*` or `search_*`, `update_*`, `delete_*`, `create_*_note`, `get_*_notes`

Exceptions:
- Leads: `convert_lead`, `search_leads` (not get_leads list)
- Owners: `get_owners` (list) not search_owners
- Contacts: unified model + `update_contact_role`, `find_contact_by_phone`
- Properties: document sub-tools
- Metrics: read-only insight tools only

## Potential Overlaps (for redesign review)

| Intent | Competing tools | Notes |
|--------|-----------------|-------|
| How many leads? | get_leads_summary, get_crm_metrics, search_leads | Prompt prefers *_summary |
| Show all leads | get_leads_summary, search_leads | Summary vs list — prompt uses summary |
| Who to call? | get_priority_leads, get_followup_summary, suggest_next_actions | Different ranking logic |
| Dashboard | get_dashboard_snapshot, get_crm_metrics, get_business_health | Layered vs raw |
| Find by phone | find_contact_by_phone, get_owner_by_phone, get_tenant_by_phone, search_leads | Entity-specific vs generic |
| Hot leads | get_priority_leads, search_leads (priority filter) | Insight vs filtered search |
| Buyer vs buyer lead | search_buyers, search_leads {leadType:buyer} | Parallel entity models |
| Tenant vs tenant lead | search_tenants, search_leads {leadType:tenant} | Parallel entity models |
