# RealtyFlow MCP — Developer Guide

**Last Updated:** June 28, 2026  
**Version:** 1.0.0

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude / ChatGPT / Other AI                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS + JWT
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway (REST)                         │
│                   + JWT Authorizer Lambda                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ Lambda Event
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Lambda Function                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Express App (httpServer.js)                             │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  MCP Server (StreamableHTTPServerTransport)        │  │  │
│  │  │  ┌──────────────────────────────────────────────┐  │  │  │
│  │  │  │  Handlers:                                   │  │  │  │
│  │  │  │  - tools/list, tools/call                    │  │  │  │
│  │  │  │  - resources/list, resources/read            │  │  │  │
│  │  │  │  - prompts/list, prompts/get                 │  │  │  │
│  │  │  └──────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
        ┌─────────────────┐      ┌──────────────────┐
        │  skillInvoker   │      │  crmDynamodb     │
        │  (tool handlers)│      │  Service         │
        └────────┬────────┘      └────────┬─────────┘
                 │                        │
                 └────────────┬───────────┘
                              ▼
                      ┌──────────────────┐
                      │   DynamoDB       │
                      │   (CRM Data)     │
                      └──────────────────┘
```

---

## How to Add a New Tool

### Step 1: Define the Tool

Add the tool to `apps/crm/server/shared/toolDefinitions.js`:

```javascript
{
  name: 'my_new_tool',
  description: 'What this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Parameter 1'
      },
      param2: {
        type: 'number',
        description: 'Parameter 2'
      }
    },
    required: ['param1']
  }
}
```

### Step 2: Implement the Handler

Add the handler to `apps/crm/server/crmDynamodbService.js`:

```javascript
export async function myNewTool(tenantId, param1, param2) {
  // Validate inputs
  if (!param1) throw new Error('param1 is required');
  
  // Perform operation
  const result = await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: {
      PK: `TENANT#${tenantId}#ITEM#${id}`,
      SK: 'PROFILE',
      param1,
      param2,
      createdAt: new Date().toISOString()
    }
  }));
  
  return { ok: true, data: result };
}
```

### Step 3: Test the Tool

Test with curl:

```bash
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-agency" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"my_new_tool",
      "arguments":{"param1":"value1","param2":123}
    },
    "id":1
  }'
```

---

## How to Add a New Resource

### Step 1: Define the Resource

Add to `apps/crm/server/mcp-server/resources.js`:

```javascript
{
  uri: 'crm://my-resource',
  name: 'My Resource',
  description: 'What this resource provides',
  mimeType: 'application/json'
}
```

### Step 2: Implement the Handler

Add handler function:

```javascript
async function handleMyResource(tenantId) {
  try {
    const data = await getMyData(tenantId);
    return {
      uri: 'crm://my-resource',
      mimeType: 'application/json',
      text: JSON.stringify(data, null, 2)
    };
  } catch (err) {
    logger.error('mcp.resource.my_resource.error', {
      tenantId,
      error: err.message
    });
    throw err;
  }
}
```

### Step 3: Register the Handler

Add to `RESOURCE_HANDLERS`:

```javascript
export const RESOURCE_HANDLERS = {
  'crm://my-resource': handleMyResource,
  // ... other handlers
};
```

---

## How to Add a New Prompt

### Step 1: Define the Prompt

Add to `apps/crm/server/mcp-server/prompts.js`:

```javascript
{
  name: 'my-prompt',
  description: 'What this prompt helps with',
  arguments: [
    {
      name: 'arg1',
      description: 'First argument',
      required: true
    }
  ]
}
```

### Step 2: Implement the Generator

Add generator function:

```javascript
async function generateMyPrompt(tenantId, args) {
  const { arg1 } = args;
  
  if (!arg1) throw new Error('arg1 is required');
  
  const data = await getData(tenantId, arg1);
  
  const systemPrompt = `You are an expert. Do this task...`;
  const userPrompt = `Here's the data: ${JSON.stringify(data)}`;
  
  return [
    {
      role: 'user',
      content: systemPrompt + '\n\n' + userPrompt
    }
  ];
}
```

### Step 3: Register the Generator

Add to `PROMPT_GENERATORS`:

```javascript
const PROMPT_GENERATORS = {
  'my-prompt': generateMyPrompt,
  // ... other generators
};
```

---

## Local Development

### Start Local MCP Server

```bash
cd server
MCP_TENANT_ID=test-agency node mcp-server/localServer.js
```

Server runs on `http://localhost:4001/mcp`

### Test with curl

```bash
# List tools
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-agency" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# List resources
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-agency" \
  -d '{"jsonrpc":"2.0","method":"resources/list","id":2}'

# List prompts
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-agency" \
  -d '{"jsonrpc":"2.0","method":"prompts/list","id":3}'
```

---

## Deployment

### 1. Create Parameters File

Copy `infra/cfn-params-mcp.sample.json` to `infra/cfn-params-prod.json` and fill in values:

```json
[
  {"ParameterKey": "Env", "ParameterValue": "prod"},
  {"ParameterKey": "JWTSecret", "ParameterValue": "your-secret-here"},
  // ... other parameters
]
```

### 2. Deploy

```bash
chmod +x infra/deploy-mcp.sh
./infra/deploy-mcp.sh prod
```

### 3. Test Deployment

```bash
# Get the API URL from CloudFormation outputs
curl -X POST https://<api-url>/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

## Environment Variables

### Required

- `CRM_DYNAMODB_TABLE_NAME` — DynamoDB table name
- `JWT_SECRET` — Secret for JWT signing
- `JWT_REFRESH_SECRET` — Secret for refresh tokens

### Optional

- `NODE_ENV` — Environment (dev, test, prod)
- `AWS_REGION` — AWS region (default: ap-south-1)
- `LOG_LEVEL` — Log level (debug, info, warn, error)
- `MCP_TENANT_ID` — Tenant ID for local testing

---

## Error Handling

All errors should return MCP-formatted error responses:

```javascript
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// Tool not found
throw new McpError(ErrorCode.MethodNotFound, 'Tool not found');

// Invalid parameters
throw new McpError(ErrorCode.InvalidRequest, 'Invalid parameters');

// Internal error
throw new McpError(ErrorCode.InternalError, 'Database error');
```

---

## Logging

Use the logger for all logging:

```javascript
import { logger } from '../logger.js';

// Info
logger.info('mcp.tool.success', {
  tenantId,
  toolName: 'create_lead',
  latencyMs: 145
});

// Error
logger.error('mcp.tool.error', {
  tenantId,
  toolName: 'create_lead',
  error: err.message
});

// Warn
logger.warn('mcp.rate_limit.exceeded', {
  tenantId,
  retryAfter: 30
});
```

---

## Testing

### Unit Tests

Create tests in `server/__tests__/mcp/`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { formatItem } from '../../services/responseFormatter.js';

describe('responseFormatter', () => {
  it('should format item in summary mode', () => {
    const item = { leadId: '123', name: 'Raj', phone: '9876543210' };
    const result = formatItem(item, 'summary', 'lead');
    
    expect(result).toEqual({
      id: '123',
      name: 'Raj',
      phone: '9876543210',
      status: undefined
    });
  });
});
```

### Integration Tests

Test end-to-end with local server:

```bash
# Start local server
MCP_TENANT_ID=test-agency node apps/crm/server/mcp-server/localServer.js

# In another terminal, run tests
npm test -- --testPathPattern=mcp
```

---

## Performance Optimization

### Caching

Use response formatter to reduce data size:

```javascript
// Instead of returning full object
const result = await getLeads(tenantId);

// Return summary
const summary = formatItems(result, 'summary', 'lead');
```

### Rate Limiting

MCP server has built-in rate limiting (60 req/min per tenant):

```javascript
// In httpServer.js
app.use('/mcp', mcpRateLimiter);
```

### Metrics

Emit metrics for monitoring:

```javascript
import { recordToolCall } from '../services/mcpMetrics.js';

await recordToolCall(tenantId, 'create_lead', true);
```

---

## Security Best Practices

1. **Always validate tenantId** — Ensure requests are from authorized tenants
2. **Sanitize inputs** — Validate all parameters before using
3. **Log sensitive data carefully** — Don't log passwords or tokens
4. **Use HTTPS** — All communication should be encrypted
5. **Implement rate limiting** — Prevent abuse
6. **Audit all operations** — Log all tool calls and resource reads

---

## Troubleshooting

### "Tool not found"

Check that tool is in `apps/crm/server/shared/toolDefinitions.js` and handler exists in `crmDynamodbService.js`

### "Missing x-tenant-id header"

Ensure API Gateway is setting the header. Check JWT authorizer configuration.

### "Rate limit exceeded"

Tool is being called too frequently. Implement caching or reduce call frequency.

### "DynamoDB error"

Check DynamoDB table name and IAM permissions. Verify table exists and is accessible.

---

## Resources

- [MCP Specification](https://modelcontextprotocol.io/)
- [AWS Lambda Guide](https://docs.aws.amazon.com/lambda/)
- [DynamoDB Guide](https://docs.aws.amazon.com/dynamodb/)
- [RealtyFlow CRM API](./API_REFERENCE.md)

---

*For agency owners, see [MCP_AGENCY_GUIDE.md](MCP_AGENCY_GUIDE.md)*
