# RealtyFlow MCP Microservice

Isolated MCP (Model Context Protocol) server for the RealtyFlow CRM platform. Exposes 54 CRM tools, 5 resources, and 5 prompts to AI assistants like Claude and ChatGPT via the StreamableHTTP transport.

## Architecture

```
AI Client (Claude/ChatGPT)
    ↓ (OAuth Bearer token)
API Gateway (JWT Authorizer Lambda)
    ↓ (x-tenant-id header)
MCP Lambda (Express + MCP SDK)
    ↓ (HTTP — service JWT)
CRM Backend (/api/crm/agent/tool)
    ↓
DynamoDB
```

The MCP service is a **thin translation layer** — it has no direct DynamoDB access. All tool execution, resource reads, and prompt data fetching go through the CRM backend's HTTP API. This keeps the service fully decoupled.

## Directory Structure

```
platform/mcp/
├── package.json
├── tsconfig.json
├── sample.env
├── README.md
├── infra/
│   ├── cfn-backend.yaml      # CloudFormation template
│   ├── deploy.sh             # Deployment script
│   └── cfn-params.sample.json
└── src/
    ├── app.ts                # Express app factory
    ├── index.ts              # Lambda handler
    ├── local-server.ts       # Local dev server
    ├── config/
    │   └── config.ts         # Env config (zod validation)
    ├── utils/
    │   └── logger.ts         # Structured logger
    ├── services/
    │   ├── toolDefinitions.ts  # 54 CRM tool definitions (MCP format)
    │   ├── crmClient.ts        # HTTP client for CRM backend
    │   ├── tokenService.ts     # JWT generation/validation
    │   ├── oauthProviders.ts   # OAuth provider config
    │   ├── resourceService.ts  # MCP resources (5 resources)
    │   └── promptService.ts    # MCP prompts (5 prompts)
    ├── middleware/
    │   ├── rateLimiter.ts      # 60 req/min per tenant
    │   ├── validateToken.ts    # Cognito token validation
    │   └── errorHandler.ts     # Centralized error handling
    ├── routes/
    │   ├── mcp.ts             # POST /mcp
    │   ├── oauth.ts           # /oauth/* endpoints
    │   └── health.ts          # GET /health
    ├── controllers/
    │   ├── mcpController.ts   # MCP protocol handler
    │   └── oauthController.ts # OAuth flow handler
    ├── views/
    │   └── oauth-authorize.ejs # Authorization page
    └── authorizers/
        └── jwtAuthorizer.ts   # API Gateway JWT authorizer Lambda
```

## MCP Protocol Support

| Method | Description |
|--------|-------------|
| `initialize` | Returns server info and capabilities |
| `tools/list` | Returns all 54 CRM tools |
| `tools/call` | Invokes a tool via CRM backend HTTP API |
| `resources/list` | Returns 5 resources |
| `resources/read` | Fetches resource data via CRM backend |
| `prompts/list` | Returns 5 prompts |
| `prompts/get` | Generates prompt messages |

## Resources

| URI | Description |
|-----|-------------|
| `crm://recent-leads` | Last 10 leads (summary) |
| `crm://upcoming-meetings` | Meetings in next 7 days |
| `crm://agency-profile` | Agency metrics and stats |
| `crm://hot-leads` | High priority qualified leads |
| `crm://active-properties` | Active properties (summary) |

## Prompts

| Name | Description |
|------|-------------|
| `qualify-lead` | Analyze a lead for qualification |
| `draft-followup` | Draft a followup message |
| `daily-summary` | Generate daily CRM summary |
| `property-match` | Find matching properties for a buyer |
| `meeting-prep` | Prepare meeting briefing |

## OAuth Flow

1. User clicks "Connect to Claude" in RealtyFlow dashboard
2. CRM backend generates a session code and redirects to the MCP service's `/oauth/authorize` endpoint
3. User sees authorization page, clicks "Allow"
4. MCP service generates an authorization code, redirects to Claude
5. Claude exchanges code for access token at the MCP service's `/oauth/token`
6. Claude uses access token for all MCP requests
7. API Gateway JWT authorizer validates token, extracts tenantId

## Local Development

```bash
# Copy sample env
cp sample.env .env
# Fill in the values (especially the *_DOMAIN_NAME/*_BASE_PATH pairs and JWT_SECRET)

# Install dependencies
npm install

# Run locally
npm run dev
# MCP server: http://localhost:4001/mcp
# Health:     http://localhost:4001/health
```

## Deployment

```bash
# From the platform/mcp/ directory
./infra/deploy.sh prod
```

## Environment Variables

See `sample.env` for all required variables. Key ones:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Shared with CRM backend for token signing |
| `JWT_REFRESH_SECRET` | For refresh token signing |
| `CRM_API_DOMAIN_NAME` / `CRM_API_BASE_PATH` | server's CRM API custom domain + base path (`devrealestatecrm`); code appends `/api/crm/agent/tool` |
| `OAUTH_CODES_TABLE_NAME` | DynamoDB table for OAuth codes |
| `OAUTH_CONNECTIONS_TABLE` | DynamoDB table for OAuth connections |
| `AUTH_SERVICE_DOMAIN_NAME` / `AUTH_SERVICE_BASE_PATH` | Auth API custom domain + base path (`devrealestateauth`); code appends `/auth/me` |
| `MCP_API_DOMAIN_NAME` / `MCP_API_BASE_PATH` | This server's public base URL `https://<domain>/<basePath>` (OAuth issuer, well-known metadata). Local dev: `http://localhost:4001` + empty base path. Raw execute-api hosts are rejected at startup |
| `ENABLE_CUSTOM_DOMAIN_MAPPING` / `ENABLE_BASE_PATH_STRIP` | Create the BasePathMapping / strip the base path in the Lambda — keep both `true` |
