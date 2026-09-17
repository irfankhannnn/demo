# RealtyFlow MCP Server — REMAINING IMPLEMENTATION PLAN (Phases 3-9)

**Status:** Planning Document  
**Date:** June 28, 2026  
**Scope:** Phases 3 through 9 (everything remaining after Phase 1 & 2 completion)

---

## CURRENT STATE (After Phase 1 & 2)

### What's DONE ✅
- `agency-app/api/shared/toolDefinitions.js` — 54 tools, single source of truth
- `agency-app/api/skillInvoker.js` — Dynamic handler lookup (switch/case removed)
- `agency-app/api/mcp-server/tools.js` — Imports from shared definitions (13 lines)
- `agency-app/api/oauth/tokenGenerator.js` — JWT access/refresh token generation
- `agency-app/api/oauth/tokenValidator.js` — Token validation, tenantId extraction
- `agency-app/api/routes/oauth.js` — OAuth endpoints (authorize, token, revoke)
- `server/views/oauth-authorize.ejs` — Authorization page UI
- `server/authorizers/jwtAuthorizer.js` — API Gateway JWT authorizer Lambda
- `tools/mcp-oauth-debug/.env.oauth.example` — Environment variable template

### What's NOT DONE ❌
- MCP server still uses **stdio transport** (needs HTTP transport for Lambda)
- MCP server has **no Resources** (leads, meetings, profile)
- MCP server has **no Prompts** (qualify-lead, draft-followup, daily-summary)
- OAuth routes are **NOT registered** in `agency-app/api/server.js`
- `agentTools.js` imports `ALLOWED_TOOLS` (old name) — needs `ALLOWED_TOOL_NAMES`
- **No CloudFormation template** for MCP Lambda + API Gateway
- **No deployment script** for MCP Lambda
- **No dashboard UI** for "AI Integrations" page
- **No monitoring** (CloudWatch dashboards, alerts)
- **No rate limiting** for MCP requests
- **No documentation** (agency guide, dev docs)
- **No tests** for the new code
- **WhatsApp SyncBot not tested** after refactor

### Key Architecture Constraints
- **MCP SDK version:** `@modelcontextprotocol/sdk` v1.29.0 (supports StreamableHTTP)
- **Existing CRM Lambda:** Uses `@vendia/serverless-express` to adapt Express → Lambda
- **Existing CFN:** `agency-app/api/infra/cfn-backend.yaml` (1500+ lines, full CRM stack)
- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Auth:** Cognito for user auth, custom JWT for MCP OAuth
- **Database:** DynamoDB single-table design with `TENANT#` prefix

---

# PHASE 3: MCP SERVER REWRITE

**Duration:** 2-3 weeks  
**High-Level Technical Purpose:** Rewrite MCP server to use StreamableHTTP transport, add Resources and Prompts, make it Lambda-compatible  
**Simple Business Purpose:** Make the MCP server actually work with Claude/ChatGPT over the internet (not just local stdio)

---

## PHASE 3 — TASK 1: Rewrite MCP Server for HTTP Transport

**Technical Purpose:** Replace stdio transport with StreamableHTTP transport so the MCP server can be hosted on AWS Lambda and accessed by Claude/ChatGPT over the internet.

**Business Purpose:** Agency owners can connect from anywhere, not just local machine.

### SUB-TASK 3.1.1: Create New MCP Server Entry Point

**What:** Create `agency-app/api/mcp-server/httpServer.js` that uses `StreamableHTTPServerTransport` instead of `StdioServerTransport`.

**Implementation:**
1. Import `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js`
2. Create Express app with `/mcp` POST endpoint
3. On each POST request:
   - Extract `tenantId` from `x-tenant-id` header (set by API Gateway authorizer)
   - Create new `Server` instance per session (or per request for stateless)
   - Connect `StreamableHTTPServerTransport`
   - Handle `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get`
4. Return MCP JSON-RPC response

**Key Decision: Stateless vs Stateful**
- **Stateless (Recommended):** New server instance per request. Simpler, works with Lambda cold starts. MCP protocol is designed for this (client sends full context each time).
- **Stateful:** Maintain session via `Mcp-Session-Id` header. More complex, requires session storage.

**Acceptance Criteria:**
- [ ] `httpServer.js` created with StreamableHTTP transport
- [ ] Express app with `/mcp` POST endpoint
- [ ] tenantId extracted from header
- [ ] Returns valid MCP JSON-RPC responses
- [ ] Works with `curl` test

**Estimated Effort:** 4-6 hours

---

### SUB-TASK 3.1.2: Implement Tool List Handler

**What:** Handle `tools/list` requests by returning all 54 tools from shared definitions.

**Implementation:**
1. Import `TOOLS` from `../shared/toolDefinitions.js`
2. Set `ListToolsRequestSchema` handler to return `{ tools: TOOLS }`
3. Test with `curl` — should return all 54 tools

**Acceptance Criteria:**
- [ ] `tools/list` returns 54 tools
- [ ] Each tool has `name`, `description`, `inputSchema`
- [ ] Response matches MCP protocol format

**Estimated Effort:** 1 hour

---

### SUB-TASK 3.1.3: Implement Tool Call Handler

**What:** Handle `tools/call` requests by invoking the CRM skill via `invokeSkill()`.

**Implementation:**
1. Import `invokeSkill` from `../skillInvoker.js`
2. Set `CallToolRequestSchema` handler:
   ```javascript
   const { name, arguments: args } = request.params;
   const result = await invokeSkill(tenantId, name, args || {}, { userId: 'mcp-agent', source: 'mcp' });
   return {
     content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
     isError: !result.ok
   };
   ```
3. **Direct invocation** (not HTTP call to `/api/crm/agent/tool`) — since MCP Lambda imports skillInvoker directly

**Key Decision: Direct vs HTTP**
- **Direct (Recommended):** MCP Lambda imports `skillInvoker.js` directly. Faster (no HTTP hop), simpler, fewer failure points.
- **HTTP:** MCP Lambda calls `/api/crm/agent/tool` on CRM Lambda. More decoupled but slower and requires network call.

**Acceptance Criteria:**
- [ ] `tools/call` invokes `invokeSkill()` directly
- [ ] tenantId passed correctly
- [ ] Result formatted as MCP content array
- [ ] Errors handled gracefully

**Estimated Effort:** 2-3 hours

---

### SUB-TASK 3.1.4: Create Lambda Handler Wrapper

**What:** Create `agency-app/api/mcp-server/lambdaHandler.js` that adapts the Express app to Lambda via `@vendia/serverless-express`.

**Implementation:**
1. Import `@vendia/serverless-express`
2. Import the Express app from `httpServer.js`
3. Export `handler = serverlessExpress({ app })`
4. Handle API Gateway events (REST API or HTTP API)

**Acceptance Criteria:**
- [ ] Lambda handler created
- [ ] Works with API Gateway events
- [ ] Returns proper HTTP responses

**Estimated Effort:** 1-2 hours

---

### SUB-TASK 3.1.5: Create Local Dev Server

**What:** Create `agency-app/api/mcp-server/localServer.js` for local development and testing.

**Implementation:**
1. Load `.env` from `agency-app/api/.env`
2. Start Express app on port 4001 (or configurable)
3. Log: `MCP server running on http://localhost:4001/mcp`
4. Support `MCP_TENANT_ID` env var for local testing (simulates API Gateway header)

**Acceptance Criteria:**
- [ ] Local server starts and listens
- [ ] Can test with `curl -X POST http://localhost:4001/mcp`
- [ ] tenantId from env var used for local testing

**Estimated Effort:** 1 hour

---

## PHASE 3 — TASK 2: Implement MCP Resources

**Technical Purpose:** Expose CRM data as MCP Resources that AI assistants can read for context (without calling tools).

**Business Purpose:** AI assistants can auto-load recent leads, upcoming meetings, and agency profile for richer conversations.

### SUB-TASK 3.2.1: Define Resource Templates

**What:** Define MCP Resource URIs that the server will expose.

**Resources to implement:**
| URI | Description | Handler |
|-----|-------------|---------|
| `crm://recent-leads` | Last 10 leads (summary) | `getLeads(tenantId, { limit: 10, responseMode: 'summary' })` |
| `crm://upcoming-meetings` | Meetings in next 7 days | `getUpcomingMeetings(tenantId, { days: 7 })` |
| `crm://agency-profile` | Agency metrics and stats | `getCRMMetrics(tenantId)` |
| `crm://hot-leads` | High priority leads | `searchLeads(tenantId, 'high priority')` or `getLeads({ priority: 'high' })` |
| `crm://active-properties` | Active properties (summary) | `searchProperties(tenantId, { status: 'active', responseMode: 'summary' })` |

**Implementation:**
1. Create `agency-app/api/mcp-server/resources.js`
2. Define resource templates with URI, name, description, mimeType
3. Create handler functions that call `crmDynamodbService` directly

**Acceptance Criteria:**
- [ ] 5 resource templates defined
- [ ] Each resource has URI, name, description, mimeType
- [ ] Handler functions implemented

**Estimated Effort:** 2-3 hours

---

### SUB-TASK 3.2.2: Implement Resources/List Handler

**What:** Handle `resources/list` requests by returning all available resources.

**Implementation:**
1. Import `ListResourcesRequestSchema` from MCP SDK
2. Set handler to return array of resource definitions
3. Test with `curl`

**Acceptance Criteria:**
- [ ] `resources/list` returns 5 resources
- [ ] Each resource has correct URI and metadata

**Estimated Effort:** 1 hour

---

### SUB-TASK 3.2.3: Implement Resources/Read Handler

**What:** Handle `resources/read` requests by fetching data from DynamoDB.

**Implementation:**
1. Import `ReadResourceRequestSchema` from MCP SDK
2. Set handler:
   ```javascript
   const { uri } = request.params;
   const handler = resourceHandlers[uri];
   if (!handler) throw new McpError(ErrorCode.InvalidRequest, 'Unknown resource');
   const data = await handler(tenantId);
   return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
   ```
3. Test each resource URI

**Acceptance Criteria:**
- [ ] `resources/read` returns data for each URI
- [ ] Data is fetched from DynamoDB
- [ ] Response formatted as MCP contents array
- [ ] Unknown URIs return error

**Estimated Effort:** 2-3 hours

---

## PHASE 3 — TASK 3: Implement MCP Prompts

**Technical Purpose:** Expose pre-built prompt templates that AI assistants can use for common workflows.

**Business Purpose:** Agency owners get instant value from pre-built prompts like "qualify this lead" or "draft followup message."

### SUB-TASK 3.3.1: Define Prompt Templates

**What:** Define MCP Prompts that the server will expose.

**Prompts to implement:**
| Name | Description | Arguments | Template |
|------|-------------|-----------|----------|
| `qualify-lead` | Qualify a lead based on criteria | `leadId` | "Analyze lead {leadId} and determine if they're qualified. Check budget, timeline, requirements..." |
| `draft-followup` | Draft a followup message | `leadId`, `channel` (whatsapp/email) | "Draft a {channel} followup message for lead {leadId}. Keep it professional but warm..." |
| `daily-summary` | Generate daily CRM summary | (none) | "Generate a daily summary of CRM activity. Include new leads, meetings, status changes..." |
| `property-match` | Find properties matching a buyer | `buyerId` | "Find properties that match buyer {buyerId}'s requirements. Compare budget, area, BHK..." |
| `meeting-prep` | Prepare for an upcoming meeting | `meetingId` | "Prepare a briefing for meeting {meetingId}. Include attendee info, related leads/properties..." |

**Implementation:**
1. Create `agency-app/api/mcp-server/prompts.js`
2. Define prompt templates with name, description, arguments, messages
3. Each prompt returns a list of messages (role + content)

**Acceptance Criteria:**
- [ ] 5 prompt templates defined
- [ ] Each prompt has name, description, arguments
- [ ] Template generates appropriate messages

**Estimated Effort:** 2-3 hours

---

### SUB-TASK 3.3.2: Implement Prompts/List Handler

**What:** Handle `prompts/list` requests by returning all available prompts.

**Implementation:**
1. Import `ListPromptsRequestSchema` from MCP SDK
2. Set handler to return array of prompt definitions
3. Test with `curl`

**Acceptance Criteria:**
- [ ] `prompts/list` returns 5 prompts
- [ ] Each prompt has correct name and arguments

**Estimated Effort:** 1 hour

---

### SUB-TASK 3.3.3: Implement Prompts/Get Handler

**What:** Handle `prompts/get` requests by generating prompt messages with arguments filled in.

**Implementation:**
1. Import `GetPromptRequestSchema` from MCP SDK
2. Set handler:
   ```javascript
   const { name, arguments: args } = request.params;
   const prompt = promptDefinitions[name];
   if (!prompt) throw new McpError(ErrorCode.InvalidRequest, 'Unknown prompt');
   const messages = prompt.generate(args);
   return { messages };
   ```
3. Test each prompt with arguments

**Acceptance Criteria:**
- [ ] `prompts/get` returns messages for each prompt
- [ ] Arguments are substituted into templates
- [ ] Unknown prompts return error

**Estimated Effort:** 2-3 hours

---

## PHASE 3 — TASK 4: Fix agentTools.js Import

**Technical Purpose:** Fix the import in `agentTools.js` which still uses `ALLOWED_TOOLS` (old name) instead of `ALLOWED_TOOL_NAMES`.

**Implementation:**
1. In `agency-app/api/routes/agentTools.js`, change:
   ```javascript
   // OLD: import { invokeSkill, ALLOWED_TOOLS } from '../skillInvoker.js';
   // NEW:
   import { invokeSkill } from '../skillInvoker.js';
   import { ALLOWED_TOOL_NAMES } from '../shared/toolDefinitions.js';
   ```
2. Replace all `ALLOWED_TOOLS` references with `ALLOWED_TOOL_NAMES`

**Acceptance Criteria:**
- [ ] Import updated
- [ ] All references updated
- [ ] No syntax errors

**Estimated Effort:** 30 minutes

---

## PHASE 3 — TASK 5: Add MCP Logging and Error Handling

**Technical Purpose:** Add comprehensive logging for all MCP requests (tool calls, resource reads, prompt gets) with tenantId, toolName, latency, success/failure.

**Business Purpose:** Track MCP usage per tenant, debug issues, monitor performance.

### SUB-TASK 3.5.1: Add Request Logging Middleware

**What:** Log every MCP request with tenantId, method, params, latency.

**Implementation:**
1. Create logging middleware in `httpServer.js`
2. Log: `{ timestamp, tenantId, method, params, latencyMs, success }`
3. Use existing `logger` from `agency-app/api/logger.js`
4. Add `agentId: 'mcp'` to all audit logs

**Acceptance Criteria:**
- [ ] Every MCP request logged
- [ ] Log includes tenantId, method, params, latency
- [ ] Logs go to CloudWatch

**Estimated Effort:** 1-2 hours

---

### SUB-TASK 3.5.2: Add Error Handling

**What:** Catch and format errors consistently for MCP responses.

**Implementation:**
1. Wrap all handlers in try/catch
2. Return MCP-formatted error responses
3. Log errors with full context
4. Don't expose internal errors to client

**Acceptance Criteria:**
- [ ] All errors caught
- [ ] Errors formatted as MCP error responses
- [ ] Internal errors logged but not exposed

**Estimated Effort:** 1-2 hours

---

## PHASE 3 COMPLETION CHECKLIST

- [ ] MCP server uses StreamableHTTP transport
- [ ] `/mcp` endpoint handles all MCP methods
- [ ] 54 tools available via `tools/list` and `tools/call`
- [ ] 5 resources available via `resources/list` and `resources/read`
- [ ] 5 prompts available via `prompts/list` and `prompts/get`
- [ ] tenantId extracted from `x-tenant-id` header
- [ ] Lambda handler created
- [ ] Local dev server created
- [ ] `agentTools.js` import fixed
- [ ] Logging and error handling added
- [ ] Tested with `curl` end-to-end

---

# PHASE 4: CLOUDFORMATION DEPLOYMENT

**Duration:** 1-2 weeks  
**High-Level Technical Purpose:** Create separate CloudFormation stack for MCP Lambda + API Gateway with JWT authorizer  
**Simple Business Purpose:** Deploy the MCP server to AWS so it's accessible from the internet

---

## PHASE 4 — TASK 1: Create MCP CloudFormation Template

**Technical Purpose:** Create `infra/cfn-mcp.yaml` with separate Lambda, API Gateway, and JWT authorizer.

**Business Purpose:** MCP server deployed independently, can scale and update without affecting CRM.

### SUB-TASK 4.1.1: Define CFN Parameters

**Parameters to include (following global_rules.md):**
1. ServiceName (default: `realtyflow-mcp`)
2. Env (dev, prod, test)
3. LambdaMemorySize (default: 512MB)
4. LambdaTimeout (default: 30s)
5. LogRetentionInDays (default: 30)
6. SubnetIds
7. SecurityGroupIds
8. CognitoUserPoolId (for user auth on OAuth page)
9. CognitoClientId
10. LambdaPackagesBucketName
11. CRM_DYNAMODB_TABLE_NAME (existing CRM table)
12. JWT_SECRET (for token validation)
13. DomainName (for custom domain)
14. OAuthCodesTableName (for OAuth authorization codes)

**Acceptance Criteria:**
- [ ] All parameters defined
- [ ] Defaults sensible
- [ ] Descriptions clear

**Estimated Effort:** 1 hour

---

### SUB-TASK 4.1.2: Define API Gateway Resources

**Resources to create:**
1. `McpApiGateway` — REST API or HTTP API
2. `McpApiResource` — `/mcp` resource
3. `McpApiMethod` — POST method with JWT authorizer
4. `McpApiDeployment` — Deployment
5. `McpApiStage` — Stage (prod)
6. `McpApiLogGroup` — CloudWatch log group for API Gateway
7. `McpApiAuthorizer` — Lambda authorizer (references jwtAuthorizer.js)
8. `McpApiInvokePermission` — Lambda invoke permission

**Key Decision: REST API vs HTTP API**
- **REST API (Recommended):** Supports Lambda authorizers natively, more features
- **HTTP API:** Cheaper, faster, but limited authorizer support

**Acceptance Criteria:**
- [ ] API Gateway created
- [ ] `/mcp` POST method with authorizer
- [ ] Deployment and stage configured
- [ ] Logging enabled

**Estimated Effort:** 2-3 hours

---

### SUB-TASK 4.1.3: Define MCP Lambda Function

**Resources to create:**
1. `McpLambdaRole` — IAM role with DynamoDB access
2. `McpLambdaFunction` — Lambda function
3. `McpLambdaLogGroup` — CloudWatch log group
4. `McpLambdaInvokePermission` — API Gateway invoke permission

**Lambda configuration:**
- Runtime: `nodejs20.x`
- Handler: `lambdaHandler.handler`
- Memory: 512MB (configurable)
- Timeout: 30s (configurable)
- Environment variables: JWT_SECRET, CRM_DYNAMODB_TABLE_NAME, etc.

**IAM permissions:**
- DynamoDB: Read/Write to CRM table
- DynamoDB: Read/Write to OAuth codes table
- CloudWatch Logs: Create log streams

**Acceptance Criteria:**
- [ ] Lambda function defined
- [ ] IAM role with correct permissions
- [ ] Environment variables configured
- [ ] Log group created

**Estimated Effort:** 2-3 hours

---

### SUB-TASK 4.1.4: Define JWT Authorizer Lambda

**Resources to create:**
1. `JwtAuthorizerLambdaRole` — IAM role
2. `JwtAuthorizerLambdaFunction` — Lambda function (references `jwtAuthorizer.js`)
3. `JwtAuthorizerLogGroup` — CloudWatch log group
4. `JwtAuthorizerInvokePermission` — API Gateway invoke permission

**Acceptance Criteria:**
- [ ] Authorizer Lambda defined
- [ ] IAM role created
- [ ] Linked to API Gateway authorizer

**Estimated Effort:** 1-2 hours

---

### SUB-TASK 4.1.5: Define OAuth Codes DynamoDB Table

**Resources to create:**
1. `OAuthCodesTable` — DynamoDB table for authorization codes
2. TTL on `expiresAt` attribute (10 minute expiry)

**Table schema:**
- PK: `code` (String)
- TTL: `expiresAt` (Number, Unix timestamp)

**Acceptance Criteria:**
- [ ] Table created
- [ ] TTL enabled on `expiresAt`
- [ ] PAY_PER_REQUEST billing

**Estimated Effort:** 30 minutes

---

### SUB-TASK 4.1.6: Define Outputs

**Outputs:**
1. `McpApiUrl` — API Gateway URL (e.g., `https://abc123.execute-api.ap-south-1.amazonaws.com/prod/mcp`)
2. `McpLambdaArn` — MCP Lambda ARN
3. `JwtAuthorizerArn` — Authorizer Lambda ARN
4. `OAuthCodesTableName` — DynamoDB table name

**Acceptance Criteria:**
- [ ] All outputs defined
- [ ] Outputs exported for cross-stack references

**Estimated Effort:** 30 minutes

---

## PHASE 4 — TASK 2: Create Deployment Script

**Technical Purpose:** Create `infra/deploy-mcp.sh` to package and deploy the MCP Lambda.

**Implementation:**
1. Validate environment variables
2. Install dependencies: `cd server && npm install`
3. Package MCP Lambda code:
   ```bash
   zip -r mcp-function.zip agency-app/api/mcp-server/ agency-app/api/shared/ agency-app/api/oauth/ agency-app/api/crmDynamodbService.js agency-app/api/skillInvoker.js agency-app/api/logger.js agency-app/api/agents/ agency-app/api/userCategoryService.js agency-app/api/aiDtoMiddleware.js node_modules package.json
   ```
4. Upload to S3
5. Generate `cfn-params-mcp.json` from `.env`
6. Deploy: `aws cloudformation deploy --template-file infra/cfn-mcp.yaml --parameter-overrides file://infra/cfn-params-mcp.json --capabilities CAPABILITY_NAMED_IAM`

**Acceptance Criteria:**
- [ ] Script created
- [ ] Packages correct files
- [ ] Uploads to S3
- [ ] Deploys CloudFormation stack

**Estimated Effort:** 2-3 hours

---

## PHASE 4 — TASK 3: Create Parameter Template

**What:** Create `infra/cfn-params-mcp.sample.json` with all parameters and placeholders.

**Acceptance Criteria:**
- [ ] All parameters listed
- [ ] Placeholders for secrets
- [ ] Documentation comments

**Estimated Effort:** 30 minutes

---

## PHASE 4 COMPLETION CHECKLIST

- [ ] `infra/cfn-mcp.yaml` created (Lambda, API Gateway, Authorizer, DynamoDB)
- [ ] `infra/deploy-mcp.sh` created
- [ ] `infra/cfn-params-mcp.sample.json` created
- [ ] Stack deploys successfully
- [ ] MCP API URL accessible
- [ ] JWT authorizer validates tokens
- [ ] Unauthorized requests rejected

---

# PHASE 5: OAUTH INTEGRATION

**Duration:** 1 week  
**High-Level Technical Purpose:** Wire OAuth routes into Express server, register with Anthropic/OpenAI, test end-to-end  
**Simple Business Purpose:** Agency owners can actually connect RealtyFlow to Claude/ChatGPT

---

## PHASE 5 — TASK 1: Register OAuth Routes in server.js

**What:** Add OAuth routes to the main Express server.

**Implementation:**
1. In `agency-app/api/server.js`, add:
   ```javascript
   import oauthRoutes from './routes/oauth.js';
   app.use('/oauth', oauthRoutes);
   ```
2. Configure EJS as view engine (for authorization page):
   ```javascript
   app.set('view engine', 'ejs');
   app.set('views', path.join(__dirname, 'views'));
   ```
3. Install EJS: `npm install ejs`

**Acceptance Criteria:**
- [ ] OAuth routes registered
- [ ] EJS view engine configured
- [ ] Authorization page renders at `/oauth/authorize`

**Estimated Effort:** 1 hour

---

## PHASE 5 — TASK 2: Register with Anthropic

**What:** Register RealtyFlow as an OAuth application with Anthropic.

**Implementation:**
1. Go to https://console.anthropic.com/
2. Create new Custom Connector / MCP Connector
3. Set redirect URI: `https://app.realtyflow.com/oauth/callback`
4. Get Client ID and Client Secret
5. Save to `.env`:
   ```
   OAUTH_ANTHROPIC_CLIENT_ID=xxx
   OAUTH_ANTHROPIC_CLIENT_SECRET=xxx
   ```

**Acceptance Criteria:**
- [ ] Anthropic OAuth app created
- [ ] Credentials saved to `.env`
- [ ] Redirect URI configured

**Estimated Effort:** 30 minutes (manual)

---

## PHASE 5 — TASK 3: Register with OpenAI

**What:** Register RealtyFlow as an OAuth application with OpenAI.

**Implementation:**
1. Go to https://platform.openai.com/
2. Create new Custom App / MCP Integration
3. Set redirect URI: `https://app.realtyflow.com/oauth/callback`
4. Get Client ID and Client Secret
5. Save to `.env`:
   ```
   OAUTH_OPENAI_CLIENT_ID=xxx
   OAUTH_OPENAI_CLIENT_SECRET=xxx
   ```

**Acceptance Criteria:**
- [ ] OpenAI OAuth app created
- [ ] Credentials saved to `.env`
- [ ] Redirect URI configured

**Estimated Effort:** 30 minutes (manual)

---

## PHASE 5 — TASK 4: Create OAuth Codes DynamoDB Table

**What:** Create the DynamoDB table for storing authorization codes.

**Implementation:**
```bash
aws dynamodb create-table \
  --table-name realtyflow-oauth-codes \
  --attribute-definitions AttributeName=code,AttributeType=S \
  --key-schema AttributeName=code,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

aws dynamodb update-time-to-live \
  --table-name realtyflow-oauth-codes \
  --time-to-live-specification AttributeName=expiresAt,Enabled=true \
  --region ap-south-1
```

**Acceptance Criteria:**
- [ ] Table created
- [ ] TTL enabled

**Estimated Effort:** 15 minutes

---

## PHASE 5 — TASK 5: Test OAuth Flow End-to-End

**What:** Test the complete OAuth flow from authorization to token to MCP call.

**Test Steps:**
1. Visit `/oauth/authorize?client_id=anthropic&redirect_uri=...&state=test123`
2. Verify authorization page renders
3. Click [Allow]
4. Verify redirect with authorization code
5. POST to `/oauth/token` with code
6. Verify access token returned
7. Use access token to call MCP endpoint
8. Verify MCP response

**Acceptance Criteria:**
- [ ] Authorization page renders
- [ ] Approval generates code
- [ ] Code exchanges for token
- [ ] Token works with MCP endpoint
- [ ] Token refresh works

**Estimated Effort:** 2-3 hours

---

## PHASE 5 COMPLETION CHECKLIST

- [ ] OAuth routes registered in server.js
- [ ] EJS view engine configured
- [ ] Registered with Anthropic
- [ ] Registered with OpenAI
- [ ] OAuth codes table created
- [ ] End-to-end OAuth flow tested
- [ ] Token refresh works

---

# PHASE 6: DASHBOARD PAGE

**Duration:** 1-2 weeks  
**High-Level Technical Purpose:** Create "AI Integrations" page in RealtyFlow dashboard for connecting Claude/ChatGPT  
**Simple Business Purpose:** Agency owners can connect AI apps with one click

---

## PHASE 6 — TASK 1: Create AI Integrations Page

**What:** Create `agency-app/web/src/pages/crm/AiIntegrations.tsx`

**Features:**
- Header: "AI Integrations"
- Cards for Claude and ChatGPT
- Each card shows:
  - Logo + name
  - Status: "Connected" or "Not Connected"
  - "Connect" button (if not connected)
  - "Disconnect" button (if connected)
  - Last connected date
- Instructions section: "How to connect"

**Implementation:**
1. Create new page component
2. Add to router in `App.tsx`
3. Add to sidebar navigation in `CRMDashboard.tsx`
4. Use TailwindCSS for styling
5. Use `api` service for backend calls

**Acceptance Criteria:**
- [ ] Page created
- [ ] Shows Claude and ChatGPT cards
- [ ] Connect/Disconnect buttons work
- [ ] Responsive design
- [ ] Added to router and sidebar

**Estimated Effort:** 4-6 hours

---

## PHASE 6 — TASK 2: Create Backend API for Connected Apps

**What:** Create `agency-app/api/routes/aiIntegrations.js` with endpoints for managing connected apps.

**Endpoints:**
- `GET /api/ai-integrations` — List connected apps for current tenant
- `POST /api/ai-integrations/connect` — Initiate OAuth flow (returns redirect URL)
- `DELETE /api/ai-integrations/:clientId` — Disconnect an app (revoke token)

**Implementation:**
1. Create route file
2. Use `validateToken` middleware for auth
3. Store connected apps in DynamoDB (new table or existing)
4. Return list of connected apps with status

**DynamoDB schema for connected apps:**
- PK: `TENANT#{tenantId}#OAUTH_CLIENT#{clientId}`
- SK: `PROFILE`
- Fields: `tenantId`, `clientId`, `connectedAt`, `lastUsedAt`, `scopes`

**Acceptance Criteria:**
- [ ] Route file created
- [ ] Registered in server.js
- [ ] List endpoint works
- [ ] Connect endpoint returns redirect URL
- [ ] Disconnect endpoint revokes token

**Estimated Effort:** 3-4 hours

---

## PHASE 6 — TASK 3: Create Connected Apps DynamoDB Table

**What:** Create DynamoDB table for tracking connected apps per tenant.

**Implementation:**
- Table: `realtyflow-oauth-connections`
- PK: `PK` (String) — `TENANT#{tenantId}#OAUTH_CLIENT#{clientId}`
- SK: `SK` (String) — `PROFILE`
- TTL: None (connections persist until disconnected)

**Acceptance Criteria:**
- [ ] Table created
- [ ] Schema documented

**Estimated Effort:** 30 minutes

---

## PHASE 6 — TASK 4: Add "Connect" Button Logic

**What:** When user clicks "Connect to Claude", redirect to OAuth authorization URL.

**Implementation:**
1. Frontend calls `POST /api/ai-integrations/connect` with `{ clientId: 'anthropic' }`
2. Backend returns `{ redirectUrl: 'https://claude.ai/oauth/authorize?client_id=...&redirect_uri=...&state=...' }`
3. Frontend redirects to `redirectUrl`
4. User authorizes on Claude's side
5. Claude redirects back to `/oauth/callback`
6. Backend handles callback, stores connection, redirects to dashboard

**Acceptance Criteria:**
- [ ] Connect button triggers OAuth flow
- [ ] User redirected to Claude/ChatGPT
- [ ] Callback handled correctly
- [ ] Connection stored in DynamoDB
- [ ] Dashboard shows "Connected" status

**Estimated Effort:** 3-4 hours

---

## PHASE 6 — TASK 5: Add OAuth Callback Handler

**What:** Handle the redirect back from Claude/ChatGPT after authorization.

**Implementation:**
1. Add `GET /oauth/callback` route in `agency-app/api/routes/oauth.js`
2. Handle both success (with `code`) and error (with `error`) cases
3. On success: show "Successfully connected!" page
4. On error: show error message
5. Redirect to dashboard after 3 seconds

**Acceptance Criteria:**
- [ ] Callback route created
- [ ] Success page shows
- [ ] Error page shows
- [ ] Redirects to dashboard

**Estimated Effort:** 2-3 hours

---

## PHASE 6 COMPLETION CHECKLIST

- [ ] AI Integrations page created
- [ ] Claude and ChatGPT cards shown
- [ ] Connect button triggers OAuth flow
- [ ] OAuth callback handled
- [ ] Connection status persisted
- [ ] Disconnect button works
- [ ] Page added to router and sidebar
- [ ] Backend API created
- [ ] DynamoDB table created

---

# PHASE 7: TOOL ENHANCEMENTS

**Duration:** 2-3 weeks  
**High-Level Technical Purpose:** Enhance tools with better parameters, response modes, sorting, rate limiting  
**Simple Business Purpose:** AI assistants get richer, more useful responses

---

## PHASE 7 — TASK 1: Implement responseMode

**What:** Ensure all search/list tools support `responseMode` parameter (summary, compact, details, full).

**Implementation:**
1. Verify `responseMode` is in all search tool definitions (already done in Phase 1)
2. Implement response formatting in `crmDynamodbService.js`:
   - `summary`: Return only IDs and names (e.g., `[{ id: 'lead-123', name: 'Raj' }]`)
   - `compact`: Return key fields (id, name, phone, status, budget)
   - `details`: Return all fields except internal metadata
   - `full`: Return everything (for admin/debugging)
3. Default to `summary` for all list operations

**Acceptance Criteria:**
- [ ] All search tools support responseMode
- [ ] Summary mode returns minimal data
- [ ] Compact mode returns key fields
- [ ] Details mode returns all fields
- [ ] Default is summary

**Estimated Effort:** 4-6 hours

---

## PHASE 7 — TASK 2: Add Sorting Support

**What:** Add `sortBy` parameter to all search tools.

**Sort options:**
- `recent_first` — Sort by createdAt DESC
- `recent_last` — Sort by createdAt ASC
- `name_asc` — Sort by name A-Z
- `name_desc` — Sort by name Z-A
- `budget_desc` — Sort by budget high to low
- `budget_asc` — Sort by budget low to high

**Implementation:**
1. Add `sortBy` parameter to search tool definitions
2. Implement sorting in `crmDynamodbService.js` (post-query sort since DynamoDB doesn't support arbitrary sorting)
3. Default: `recent_first`

**Acceptance Criteria:**
- [ ] sortBy parameter added to all search tools
- [ ] Sorting implemented in service layer
- [ ] Default sort is recent_first

**Estimated Effort:** 3-4 hours

---

## PHASE 7 — TASK 3: Add Rate Limiting for MCP

**What:** Add per-tenant rate limiting for MCP requests.

**Implementation:**
1. Use `express-rate-limit` (already in dependencies)
2. Create rate limiter middleware:
   ```javascript
   const mcpRateLimit = rateLimit({
     windowMs: 60 * 1000, // 1 minute
     max: 60, // 60 requests per minute per tenant
     keyGenerator: (req) => req.headers['x-tenant-id'] || 'anonymous',
     message: { error: 'Rate limit exceeded' }
   });
   ```
3. Apply to `/mcp` endpoint

**Acceptance Criteria:**
- [ ] Rate limiting middleware created
- [ ] 60 requests/minute per tenant
- [ ] 429 response when exceeded
- [ ] tenantId used as key

**Estimated Effort:** 1-2 hours

---

## PHASE 7 — TASK 4: Add Caching for Frequently Accessed Data

**What:** Cache CRM metrics and resource data to reduce DynamoDB reads.

**Implementation:**
1. Use in-memory cache (Map with TTL) or Redis if available
2. Cache `getCRMMetrics` for 5 minutes
3. Cache resource reads for 2 minutes
4. Cache key: `${tenantId}:${resource}`

**Acceptance Criteria:**
- [ ] Cache implemented
- [ ] TTL configured (5 min for metrics, 2 min for resources)
- [ ] Cache invalidation on writes

**Estimated Effort:** 2-3 hours

---

## PHASE 7 — TASK 5: Add Input Validation with Zod

**What:** Use Zod (already in dependencies) for schema validation of tool inputs.

**Implementation:**
1. Create Zod schemas for each tool in `agency-app/api/shared/toolSchemas.js`
2. Validate input before calling `invokeSkill`
3. Return clear validation errors

**Acceptance Criteria:**
- [ ] Zod schemas created for all 54 tools
- [ ] Input validated before execution
- [ ] Clear error messages

**Estimated Effort:** 4-6 hours

---

## PHASE 7 COMPLETION CHECKLIST

- [ ] responseMode implemented for all search tools
- [ ] sortBy implemented for all search tools
- [ ] Rate limiting added (60 req/min per tenant)
- [ ] Caching added for metrics and resources
- [ ] Zod validation added for all tools

---

# PHASE 8: MONITORING & OPERATIONS

**Duration:** 1-2 weeks  
**High-Level Technical Purpose:** Add CloudWatch dashboards, metrics, alerts, and cost tracking  
**Simple Business Purpose:** Know when things break, track usage, optimize costs

---

## PHASE 8 — TASK 1: Create CloudWatch Dashboard

**What:** Create CloudWatch dashboard for MCP server metrics.

**Widgets:**
- MCP Request Count (per tenant)
- MCP Error Rate
- MCP Latency (p50, p90, p99)
- Lambda Cold Start Count
- Lambda Duration
- Lambda Errors
- DynamoDB Read/Write Capacity
- API Gateway 4xx/5xx Errors

**Implementation:**
1. Create dashboard JSON
2. Add to CloudFormation template or create separately
3. Use `aws cloudwatch put-dashboard`

**Acceptance Criteria:**
- [ ] Dashboard created
- [ ] All widgets visible
- [ ] Data updating in real-time

**Estimated Effort:** 2-3 hours

---

## PHASE 8 — TASK 2: Add Custom Metrics

**What:** Emit custom CloudWatch metrics from MCP Lambda.

**Metrics to emit:**
- `McpToolCalls` — Count of tool calls (dimensions: tenantId, toolName)
- `McpToolErrors` — Count of tool errors (dimensions: tenantId, toolName)
- `McpResourceReads` — Count of resource reads (dimensions: tenantId, resource)
- `McpPromptGets` — Count of prompt gets (dimensions: tenantId, prompt)
- `McpTokenValidations` — Count of token validations (dimension: clientId)

**Implementation:**
1. Use `@aws-sdk/client-cloudwatch` (already in dependencies)
2. Create `agency-app/api/mcp-server/metrics.js`
3. Emit metrics after each operation
4. Use `EmbeddedMetricFormat` for efficient metric emission

**Acceptance Criteria:**
- [ ] Metrics module created
- [ ] Metrics emitted for all operations
- [ ] Metrics visible in CloudWatch

**Estimated Effort:** 3-4 hours

---

## PHASE 8 — TASK 3: Create CloudWatch Alarms

**What:** Create alarms for critical metrics.

**Alarms:**
- MCP Error Rate > 5% → SNS notification
- MCP Latency p90 > 2s → SNS notification
- Lambda Errors > 10 in 5 min → SNS notification
- API Gateway 5xx > 5 in 5 min → SNS notification

**Implementation:**
1. Add alarms to CloudFormation template
2. Create SNS topic for notifications
3. Subscribe email/SMS to SNS topic

**Acceptance Criteria:**
- [ ] Alarms created
- [ ] SNS topic configured
- [ ] Email subscriptions added

**Estimated Effort:** 2-3 hours

---

## PHASE 8 — TASK 4: Add Audit Logging for MCP

**What:** Log all MCP operations to `agentAuditService` for compliance and debugging.

**Implementation:**
1. Import `agentAuditService` in MCP server
2. Log each tool call with:
   - `tenantId`
   - `userId` (from token)
   - `toolName`
   - `input` (sanitized)
   - `output` (summary)
   - `latencyMs`
   - `success`
   - `agentId: 'mcp'`
   - `clientId` (from token)
3. Use existing `agentAuditService.logAuditEvent()`

**Acceptance Criteria:**
- [ ] All MCP operations logged to audit table
- [ ] Logs include tenantId, toolName, latency
- [ ] Logs searchable in DynamoDB

**Estimated Effort:** 2-3 hours

---

## PHASE 8 — TASK 5: Add Cost Tracking

**What:** Track DynamoDB read/write costs per tenant.

**Implementation:**
1. Log DynamoDB operation count per request
2. Calculate estimated cost per request
3. Store in audit log
4. Create monthly cost report

**Acceptance Criteria:**
- [ ] DynamoDB operations tracked
- [ ] Cost estimated per request
- [ ] Monthly report available

**Estimated Effort:** 2-3 hours

---

## PHASE 8 COMPLETION CHECKLIST

- [ ] CloudWatch dashboard created
- [ ] Custom metrics emitted
- [ ] Alarms configured
- [ ] Audit logging added
- [ ] Cost tracking implemented

---

# PHASE 9: DOCUMENTATION

**Duration:** 1 week  
**High-Level Technical Purpose:** Create comprehensive documentation for agency owners, developers, and API consumers  
**Simple Business Purpose:** Everyone knows how to use and maintain the MCP server

---

## PHASE 9 — TASK 1: Agency Owner Guide

**What:** Create `docs/mcp-agency-guide.md` — user-facing documentation.

**Sections:**
1. What is MCP? (simple explanation)
2. How to connect Claude
3. How to connect ChatGPT
4. Available tools (what you can ask the AI)
5. Available resources (what the AI can see)
6. Available prompts (pre-built workflows)
7. Troubleshooting
8. FAQ

**Acceptance Criteria:**
- [ ] Guide created
- [ ] Screenshots included
- [ ] Step-by-step instructions
- [ ] FAQ section

**Estimated Effort:** 3-4 hours

---

## PHASE 9 — TASK 2: Developer Documentation

**What:** Create `docs/mcp-developer-guide.md` — technical documentation.

**Sections:**
1. Architecture overview
2. How to add a new tool
3. How to add a new resource
4. How to add a new prompt
5. How to deploy
6. How to debug
7. Environment variables
8. Testing

**Acceptance Criteria:**
- [ ] Guide created
- [ ] Code examples included
- [ ] Architecture diagram
- [ ] Deployment instructions

**Estimated Effort:** 3-4 hours

---

## PHASE 9 — TASK 3: API Reference

**What:** Create `docs/mcp-api-reference.md` — reference for all 54 tools, 5 resources, 5 prompts.

**Format:**
- Tool name
- Description
- Parameters (name, type, required, description, enum)
- Example request
- Example response

**Acceptance Criteria:**
- [ ] All 54 tools documented
- [ ] All 5 resources documented
- [ ] All 5 prompts documented
- [ ] Examples included

**Estimated Effort:** 4-6 hours

---

## PHASE 9 — TASK 4: Update CLAUDE.md

**What:** Update `CLAUDE.md` with MCP server information.

**Sections to add:**
- MCP server architecture
- How to run locally
- How to deploy
- Key files

**Acceptance Criteria:**
- [ ] CLAUDE.md updated
- [ ] MCP section added

**Estimated Effort:** 1 hour

---

## PHASE 9 — TASK 5: Create Test Suite

**What:** Create tests for the MCP server.

**Tests:**
1. Tool definitions test (all 54 tools have valid handlers)
2. OAuth flow test (authorization → token → validation)
3. MCP protocol test (initialize, tools/list, tools/call)
4. Resources test (list, read)
5. Prompts test (list, get)

**Implementation:**
1. Create `server/__tests__/mcp/` directory
2. Use Jest (already in devDependencies)
3. Test each component

**Acceptance Criteria:**
- [ ] Test suite created
- [ ] All tests pass
- [ ] Coverage > 80%

**Estimated Effort:** 4-6 hours

---

## PHASE 9 COMPLETION CHECKLIST

- [ ] Agency owner guide created
- [ ] Developer documentation created
- [ ] API reference created
- [ ] CLAUDE.md updated
- [ ] Test suite created
- [ ] All tests passing

---

# SUMMARY: REMAINING WORK

| Phase | Title | Duration | Tasks | Sub-tasks |
|-------|-------|----------|-------|-----------|
| 3 | MCP Server Rewrite | 2-3 weeks | 5 | 15 |
| 4 | CloudFormation Deployment | 1-2 weeks | 3 | 6 |
| 5 | OAuth Integration | 1 week | 5 | 5 |
| 6 | Dashboard Page | 1-2 weeks | 5 | 5 |
| 7 | Tool Enhancements | 2-3 weeks | 5 | 5 |
| 8 | Monitoring & Operations | 1-2 weeks | 5 | 5 |
| 9 | Documentation | 1 week | 5 | 5 |
| **TOTAL** | | **9-14 weeks** | **33** | **46** |

---

# CRITICAL PATH

The critical path (longest dependency chain) is:

```
Phase 3 (MCP Server Rewrite)
    ↓
Phase 4 (CloudFormation Deployment)
    ↓
Phase 5 (OAuth Integration) ← requires Phase 4 for deployment
    ↓
Phase 6 (Dashboard Page) ← requires Phase 5 for OAuth flow
    ↓
Phase 7 (Tool Enhancements) ← can run in parallel with Phase 6
    ↓
Phase 8 (Monitoring) ← requires Phase 4 for deployed resources
    ↓
Phase 9 (Documentation) ← can run in parallel with Phase 8
```

**Parallelizable:**
- Phase 7 (Tool Enhancements) can run alongside Phase 6
- Phase 9 (Documentation) can run alongside Phase 8

---

# RISK MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| MCP SDK StreamableHTTP not stable | Medium | High | Test locally first, have stdio fallback |
| API Gateway JWT authorizer misconfigured | Medium | High | Test with curl, have Lambda fallback validation |
| OAuth provider changes API | Low | High | Use standard OAuth 2.0, monitor changelogs |
| DynamoDB costs spike from MCP | Medium | Medium | Use responseMode:summary, add caching |
| Lambda cold starts too slow | Low | Low | Provision concurrency if needed |
| WhatsApp SyncBot breaks | Low | High | Test after each phase, keep changes additive |

---

# EDGE CASES TO HANDLE

1. **Token expiry mid-conversation** — ChatGPT/Claude auto-refreshes via refresh token
2. **Tenant ID mismatch** — Validate header matches token claims
3. **Tool not found** — Return MCP MethodNotFound error
4. **DynamoDB throttling** — Implement exponential backoff
5. **Large result sets** — Enforce limit (default 20, max 100)
6. **Concurrent requests from same tenant** — Rate limiting (60 req/min)
7. **Invalid OAuth state** — Reject with error
8. **Expired authorization code** — Return invalid_code error
9. **Multiple agencies, same user** — Each agency gets separate token
10. **MCP SDK version upgrade** — Test thoroughly before upgrading

---

*End of Remaining Implementation Plan*
