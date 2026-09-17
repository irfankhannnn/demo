# ContactAIViewBuilder

Location: `agency-app/api/aiViewBuilders/contactAIViewBuilder.js`

## API

- `buildSearchResults(contacts, pagination)`
- `buildContactDetails(contact, options)`
- `buildCreateConfirmation(contact)`
- `buildUpdateConfirmation(contact, updatedFields)`
- `buildDeleteConfirmation(contact)`
- `buildNoteCreateConfirmation(contact, note)`
- `buildNotesList(notes, pagination)`
- `buildEmptySearchResults()`
- `buildContactNotFoundError(contactId)`

## Rules

- Format dates via shared `utils.formatDate`
- Expose `latestNote` string on details
- Do not generate WhatsApp English
