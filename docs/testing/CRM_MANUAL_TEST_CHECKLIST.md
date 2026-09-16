# Simple CRM Testing Checklist

This is for normal users testing the CRM. Ignore MCP, onboarding, WhatsApp, AI, credits, billing, and admin settings.

**How to use it:** test one section at a time. Tick a box if it works. If something does not work, write it in the notes at the bottom and take a screenshot.

- Tester: ____________________
- Date: ____________________
- Website / environment: ____________________

## 1. Dashboard

- [ ] Dashboard opens correctly.
- [ ] Main numbers (leads, buyers, owners, properties, tenants) look correct.
- [ ] Clicking a number opens the correct list.
- [ ] After creating a new record, the dashboard count changes.

## 2. Leads

- [ ] Leads list opens.
- [ ] Search finds a lead by name or phone number.
- [ ] Filters work and can be cleared.
- [ ] Open a lead and check that the correct details appear.
- [ ] Create a buyer lead and save it.
- [ ] Create a tenant lead and save it.
- [ ] Create a seller lead and save it.
- [ ] Create an owner lead and save it.
- [ ] Edit one lead, save it, refresh the page, and check that the change is still there.
- [ ] Add a note to a lead and check that it is saved.
- [ ] Create a meeting from a lead and check that it appears in the Calendar.
- [ ] Try to save a lead without required details; a helpful message should appear.

## 3. Lead conversion

This is the most important part. After conversion, refresh the page and check the new record.

### Buyer lead → buyer

- [ ] Create or choose a property that is **for sale**.
- [ ] Convert a buyer lead and select that property.
- [ ] A buyer is created with the correct name and phone number.
- [ ] The property becomes **sold**.
- [ ] The buyer and sold property are linked to each other.

### Tenant lead → tenant

- [ ] Create or choose a property that is **for rent**.
- [ ] Convert a tenant lead and select that property.
- [ ] A tenant is created with the correct name and phone number.
- [ ] The property becomes **rented**.
- [ ] The tenant and rented property are linked to each other.
- [ ] The tenant also appears in Rented Properties.

### Seller lead → owner + sale property

- [ ] Convert a seller lead.
- [ ] An owner/seller is created with the correct name and phone number.
- [ ] A property is created and shown as **for sale**.

### Owner lead → owner + rental property

- [ ] Convert an owner lead.
- [ ] An owner is created with the correct name and phone number.
- [ ] A property is created and shown as **for rent**.

### Basic safety checks

- [ ] Clicking Cancel during conversion does not change anything.
- [ ] A lead that is already converted cannot be converted again.

## 4. Buyers, owners, tenants, and contacts

For each of these pages, do the same simple check:

- [ ] Buyers: list opens, search works, create one buyer, edit it, and refresh to check the changes.
- [ ] Owners: list opens, search works, create one owner, edit it, and refresh to check the changes.
- [ ] Tenants: list opens, search works, create one tenant, edit it, and refresh to check the changes.
- [ ] Contacts: list opens and search works.
- [ ] Converted people show the correct linked buyer, owner, or tenant record.

## 5. Properties

- [ ] Properties list opens.
- [ ] Search finds a property by title or location.
- [ ] Create one property **for sale**.
- [ ] Create one property **for rent**.
- [ ] Choose the correct owner when creating a property.
- [ ] Open each property and check that its owner is correct.
- [ ] Edit one property, save it, refresh, and check the change is still there.
- [ ] Check that property status is correct: for sale, for rent, sold, or rented.

## 6. Developers, areas, projects, and enquiries

- [ ] Developers page opens; create and edit one developer.
- [ ] Areas page opens; create and edit one area.
- [ ] Projects page opens; create and edit one project.
- [ ] A project shows the correct developer and area.
- [ ] Enquiries page opens and shows enquiry details.
- [ ] Converting an enquiry to a lead fills in the lead details correctly.

## 7. Meetings and Calendar

- [ ] Create a meeting for a lead, buyer, tenant, or owner.
- [ ] The meeting appears in the Calendar.
- [ ] Check Month, Week, Day, and List Calendar views.
- [ ] Mark a meeting as completed or canceled and check the change is saved.
- [ ] Notes and activity history appear on the related record.

## 8. Khata Book (only if you use it)

- [ ] Khata Book opens.
- [ ] Create a credit entry.
- [ ] Create a debit entry.
- [ ] Totals update correctly.
- [ ] Settle an entry and check that its status and total update.

## 9. Final quick check

- [ ] Refresh important pages; saved data is still there.
- [ ] Check that linked records open correctly (owner → property → tenant/buyer).
- [ ] Dashboard numbers match the records you created.
- [ ] Analytics and Hierarchy pages open without errors.
- [ ] No unrelated record was changed by mistake.

## Problems found

| What did not work? | What did you do? | Screenshot / link |
|---|---|---|
| | | |
| | | |
| | | |
