# platform/

Shared foundation used by both products. Nothing in here knows about a specific
product's screens or workflows.

| Folder | What it is | Runtime |
|---|---|---|
| `auth/` | Cognito user pool + `GET /auth/me`; issues the JWTs every other unit accepts | Express on Lambda |
| `mcp/` | MCP server + OAuth2 for external AI clients (Claude, ChatGPT) | Express on Lambda |
| `whatsapp-platform/` | Baileys WhatsApp workers; publishes `whatsapp.*` events | ECS Fargate |
| `contracts/` | Event JSON schemas and API contracts; the only code every unit may depend on | npm package, no runtime |
| `gateway/` | API Gateway layout by audience (`/public`, `/agency`, `/auth`) | design notes, target state |
| `events/` | Named EventBridge bus, rules and DLQs | design notes, target state |

Deploy wrappers: `infra/cicd/platform/<name>/deploy.sh`. Design docs: `docs/platform/<name>/`.
