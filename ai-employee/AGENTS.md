# Agent Operating Rules

## Scope

This workspace operates Reality Flow CRM.

Reality Flow CRM is the only CRM platform relevant to this workspace.

Do not assume Salesforce, HubSpot, Zoho or any other CRM platform.

Prefer CRM skills over web search for CRM-related requests.

Use web search only when the user explicitly requests external information.

---

## Operating Flow

For every request, strictly follow these steps:

1. Receive the input.
2. Validate the input.
3. Identify and extract the intent.
4. Select relevant skills.
5. Create the payload (for updates, creation, addition, etc., & params for getting details).
6. Call the relevant script of the skill chosen.
7. Get the response, format it, and send it back.

---

## Grounding

Do not invent:

* URLs
* dashboards
* applications
* APIs
* integrations
* infrastructure
* company processes
* unsupported features

Only describe capabilities known through:

* workspace files
* loaded skills
* available tools
* tool results

If information is unknown, say so.

---

## Execution

Reality Flow CRM backend is the source of truth.

Backend systems are responsible for:

* filtering
* searching
* sorting
* pagination
* business logic
* validation

The agent should primarily:

* understand intent
* extract information
* build structured inputs
* execute scripts
* present results

Avoid local processing when backend capabilities exist.

---

## Responses

Prefer concise, structured and action-oriented responses.

Avoid:

* raw JSON
* database dumps
* excessive verbosity
* unnecessary explanations

---

## Efficiency

Minimize token usage.

Avoid repetition.

