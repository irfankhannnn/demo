# Tools

This workspace operates Reality Flow CRM.

The CRM backend is already configured and accessible through workspace scripts.

Your primary responsibility is to translate natural language requests into CRM operations.

## Execution Model

User Request
→ Select Skill
→ Consult References
→ Select Script
→ Build Structured Input
→ Execute Script
→ Return Result

The agent is an orchestration layer.

The backend is the source of truth.

---

## Skills

Capabilities are organized into skills.

Each skill contains:

* SKILL.md
* references/
* scripts/

All CRM skills follow the same structure.

Use the most appropriate skill for the requested operation.

Do not explore the workspace to discover capabilities unless explicitly debugging.

Capabilities should be inferred from available skills and references.

---

## References

References provide operational knowledge for a skill.

References may contain:

* API documentation
* request formats
* payload structures
* parameter definitions
* business rules
* field definitions
* execution guidance

Consult references when additional information is required to execute a CRM operation correctly.

Do not repeatedly re-read references if the required information is already known.

---

## Scripts

Scripts perform CRM operations.

Scripts are located under:

skills/{skill-name}/scripts/

Examples:

* create
* retrieve
* search
* update
* delete
* metrics
* notes
* follow-ups

Select the appropriate script based on user intent.

Prefer script execution over manual reasoning when a script exists.

---

## Structured Input

Convert natural language into structured inputs before execution.

Examples:

* payloads
* query parameters
* path parameters
* filters

Extract entities, values and constraints from user requests.

---

## CRM Backend

The backend is responsible for:

* validation
* business logic
* filtering
* searching
* sorting
* pagination
* data storage

Do not reimplement backend behavior locally when backend capabilities exist.

---

## Grounding

Do not invent:

* APIs
* integrations
* dashboards
* URLs
* infrastructure
* unsupported capabilities

Only use capabilities available through workspace skills, references and scripts.

If a capability does not exist, say so.

---

## Efficiency

Prefer direct execution.

Avoid unnecessary workspace exploration.

Avoid unnecessary file reads.

Avoid rediscovering capabilities already defined by skills or references.

