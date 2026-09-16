# Documentation

Everything that is documentation lives here. The one exception is each service's own `README.md`,
which stays next to the code it describes.

| Folder | What's in it |
|---|---|
| `services/<service>/` | Design notes, runbooks and guides for one service (`server`, `real-estate-crm-app`, `ai-calling-service`, `followup-agent-service`, `reality-flow-authentication`, `whatsapp-platform`) |
| `insta-sol-ms-docs/` | Instagram lead service: plan, architecture, API, deployment, Meta app review |
| `property-pages/` | Public property pages: architecture, ManyChat setup, pricing, security |
| `proposals/` | Design proposals (agent channel architecture, agency config, config-only deploy, …) |
| `pending-items/` | Open work: deploys, branches, follow-ups (`low-priority/` for the backlog) |
| `current_design/` | Current AI agent design: system prompt, tools, response shapes, runtime flow |
| `interaction-design/` | Sync bot interaction design |
| `ai-response-design/` | AI response DTO contracts and view builders per entity |
| `ai_context_management_plan/` | AI context/memory plan, architecture and analysis reports (start at `AI_CONTEXT_REFERENCE.md`) |
| `ai-agent/` | AI agent intent-resolution refactor summary |
| `mcp/` | MCP server + OAuth implementation: plan, phase summaries, quick reference |
| `whatsapp/` | WhatsApp connection edge cases and fixes: summaries, verification, deployment readiness |
| `launch/`, `launch-audit/` | Launch tasks (mobile store listing) and the pre-launch audit |
| `testing/` | Test guides and manual checklists |
| `working-context/` | Session notes: architecture decisions, current issues, timeline |
| `epics/` | Epic completion reports |
| `archive/` | Superseded one-off reports |
| `company-assets/` | Company documents and images (GST certificate, logos, marketing graphics) |

Top-level files cover cross-cutting topics: call intelligence, MCP agency/developer guides, the lead
adapter, security key rotation and store privacy disclosures.
