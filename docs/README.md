# Documentation

Everything that is documentation lives here. The one exception is each service's own `README.md`,
which stays next to the code it describes.

| Folder | What's in it |
|---|---|
| `realestateflow-vision/` | Product vision, architecture and roadmap (docs 00–39). Start at `README.md`; doc 38 is the pricing proposal and doc 39 the plan for moving WhatsApp to the official API. `internal-operations/` holds the internal GTM ops docs |
| `platform/auth/`, `platform/mcp/`, `platform/whatsapp-platform/` | Design notes, runbooks, phase summaries and fixes for the shared services |
| `public-app/property-pages/` | Public property pages: architecture, ManyChat setup, pricing, security |
| `public-app/api/`, `public-app/web/`, `public-app/auth/` | Consumer marketplace: design notes; `public-app/api/API-CONTRACT.md` is the contract for every call that crosses a marketplace service boundary |
| `agency-app/api/`, `agency-app/web/` | CRM backend and frontend: deployment guide, API Gateway structure, hardening, setup |
| `agency-app/instagram/` | Instagram lead service: plan, architecture, API, deployment, Meta app review |
| `agency-app/ai-calling/`, `agency-app/followup-agent/` | Go-live runbooks, setup briefs, approval plans |
| `proposals/` | Design proposals (agent channel architecture, agency config, config-only deploy, …) |
| `pending-items/` | Open work: deploys, branches, follow-ups (`low-priority/` for the backlog) |
| `current_design/` | Current AI agent design: system prompt, tools, response shapes, runtime flow |
| `interaction-design/` | Sync bot interaction design |
| `ai-response-design/` | AI response DTO contracts and view builders per entity |
| `ai_context_management_plan/` | AI context/memory plan, architecture and analysis reports (start at `AI_CONTEXT_REFERENCE.md`) |
| `ai-agent/` | AI agent intent-resolution refactor summary |
| `launch/`, `launch-audit/` | Launch tasks (mobile store listing) and the pre-launch audit |
| `testing/` | Test guides and manual checklists |
| `working-context/` | Session notes: architecture decisions, current issues, timeline |
| `epics/` | Epic completion reports |
| `archive/` | Superseded one-off reports |
| `company-assets/` | Company documents and images (GST certificate, logos, marketing graphics) |

Top-level files cover cross-cutting topics: call intelligence, MCP agency/developer guides, the lead
adapter, security key rotation and store privacy disclosures.
