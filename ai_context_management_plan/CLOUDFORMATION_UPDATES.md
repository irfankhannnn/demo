# Phase 2 CloudFormation Updates

## Overview
This document outlines the CloudFormation changes required for Phase 2 implementation. The existing template already includes most required tables; this document clarifies the schema and configuration for new features.

## DynamoDB Tables

> **Note**: No new DynamoDB table creation is required for Phase 2. Both the
> Conversation State and User Category records use the existing
> `cloudberry-real-estate-crm` table with different PK/SK patterns (single-table
> design). No CloudFormation changes to the table resource are needed — only the
> TTL attribute (already enabled) and IAM permissions (already granted) apply.

### 1. Conversation State Table (Embedded in CRM Table)
**Location**: `cloudberry-real-estate-crm` table
**Purpose**: Store multi-turn conversation state for WhatsApp interactions

**Key Schema**:
```
PK: TENANT#{tenantId}#WHATSAPP#STATE#{contactPhone}
SK: STATE#CURRENT
```

**Attributes**:
- `tenantId` (String) - Tenant identifier
- `contactPhone` (String) - Contact phone number
- `status` (String) - Conversation status: active, paused, resolved
- `intent` (String) - User intent: inquiry, complaint, booking, follow_up
- `topic` (String) - Current discussion topic
- `messageCount` (Number) - Total messages in conversation
- `lastMessageAt` (String) - ISO timestamp of last message
- `createdAt` (String) - Conversation creation time
- `updatedAt` (String) - Last update time
- `context` (Map) - Conversation context (leadId, userId, etc.)
- `metadata` (Map) - Platform metadata
- `expiresAt` (Number) - TTL for automatic cleanup (24 hours)

**TTL Configuration**:
- Attribute: `expiresAt`
- Duration: 24 hours (86400 seconds)
- Purpose: Auto-cleanup of resolved conversations

### 2. User Category Table (Embedded in CRM Table)
**Location**: `cloudberry-real-estate-crm` table
**Purpose**: Store user category and tool access permissions

**Key Schema**:
```
PK: TENANT#{tenantId}#USER#{userId}
SK: CATEGORY#USER
```

**Attributes**:
- `tenantId` (String) - Tenant identifier
- `userId` (String) - User identifier
- `category` (String) - Category: admin, agent, team_lead, viewer, whatsapp_bot
- `categoryName` (String) - Human-readable category name
- `categoryDescription` (String) - Category description
- `allowedTools` (List) - Array of tool names user can access
- `permissions` (Map) - Permission flags:
  - `canAssignLeads` (Boolean)
  - `canDeleteLeads` (Boolean)
  - `canViewAnalytics` (Boolean)
  - `canManageUsers` (Boolean)
- `createdAt` (String) - Creation timestamp
- `updatedAt` (String) - Last update timestamp

**User Categories**:
1. **admin**: Full access to all tools and permissions
2. **agent**: Sales agent with limited tool access
3. **team_lead**: Team lead with assignment permissions
4. **viewer**: Read-only access to leads and properties
5. **whatsapp_bot**: Limited tools for WhatsApp conversations

## Environment Variables

### Bailey Configuration
```bash
BAILEY_ENABLED=true
BAILEY_MODE=selfhosted
BAILEY_API_ENDPOINT=http://localhost:3003
BAILEY_API_KEY=<optional-api-key>
BAILEY_ADMIN_API_KEY=<admin-key>
BAILEY_WEBHOOK_SECRET=<webhook-secret>
BAILEY_API_PREFIX=
```

### AI Employee Configuration
```bash
AGENTS_ENABLED=true
AI_EMPLOYEE_ROLLOUT_PERCENTAGE=100
AI_EMPLOYEE_BYPASS_PROVISIONING=false
AI_EMPLOYEE_PROVISIONING_TABLE_NAME=cloudberry-real-estate-ai-provisioning
AI_EMPLOYEE_AUDIT_TABLE_NAME=cloudberry-real-estate-agent-audit
```

### LLM Configuration
```bash
LLM_PROVIDER=bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
GEMINI_API_KEY=<optional-gemini-key>
GEMINI_MODEL=gemma-4-26b-a4b-it
```

### WhatsApp Configuration
```bash
CONNECTED_WHATSAPP_PHONE=<your-whatsapp-number>
AI_ADMIN_WHATSAPP_NUMBERS=<comma-separated-numbers>
```

## Lambda IAM Permissions

### DynamoDB Permissions Required
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:Query",
    "dynamodb:Scan",
    "dynamodb:DeleteItem"
  ],
  "Resource": [
    "arn:aws:dynamodb:*:*:table/cloudberry-real-estate-crm",
    "arn:aws:dynamodb:*:*:table/cloudberry-real-estate-crm/index/*"
  ]
}
```

### CloudWatch Permissions Required
```json
{
  "Effect": "Allow",
  "Action": [
    "cloudwatch:PutMetricData",
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents"
  ],
  "Resource": "*"
}
```

### Bedrock Permissions Required
```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel"
  ],
  "Resource": "arn:aws:bedrock:*:*:foundation-model/*"
}
```

## CloudWatch Monitoring

### Metrics to Track
1. **Agent Invocations**
   - `agent.action.invoked` - Total agent invocations
   - `agent.action.failed` - Failed invocations
   - `agent.action.credits_used` - Credits consumed

2. **Tool Execution**
   - `tool.execution.success` - Successful tool calls
   - `tool.execution.failed` - Failed tool calls
   - `tool.execution.denied` - Access denied (permission)

3. **Conversation State**
   - `conversation.state.created` - New conversations
   - `conversation.state.resolved` - Resolved conversations
   - `conversation.intent.detected` - Intent detection events

4. **WhatsApp Integration**
   - `whatsapp.message.received` - Incoming messages
   - `whatsapp.message.sent` - Outgoing messages
   - `whatsapp.webhook.received` - Webhook events

### CloudWatch Alarms
```yaml
AgentActionFailureAlarm:
  MetricName: agent.action.failed
  Threshold: 10
  EvaluationPeriods: 5
  ComparisonOperator: GreaterThanThreshold
  AlarmActions:
    - !Ref SNSTopicArn

ToolAccessDeniedAlarm:
  MetricName: tool.execution.denied
  Threshold: 20
  EvaluationPeriods: 5
  ComparisonOperator: GreaterThanThreshold
  AlarmActions:
    - !Ref SNSTopicArn
```

## Deployment Steps

1. **Update Environment Variables**
   ```bash
   # Update .env with Phase 2 configuration
   BAILEY_MODE=selfhosted
   AGENTS_ENABLED=true
   ```

2. **Deploy Lambda Function**
   ```bash
   npm run build
   zip -r function.zip node_modules dist package.json
   aws s3 cp function.zip s3://<bucket>/phase-2-lambda.zip
   ```

3. **Update CloudFormation Stack**
   ```bash
   aws cloudformation update-stack \
     --stack-name cloudberry-real-estate \
     --template-body file://server/infra/cfn-backend.yaml \
     --parameters file://cfn-params.json \
     --capabilities CAPABILITY_NAMED_IAM
   ```

4. **Verify Deployment**
   ```bash
   # Check DynamoDB tables
   aws dynamodb describe-table --table-name cloudberry-real-estate-crm
   
   # Check Lambda function
   aws lambda get-function --function-name cloudberry-real-estate-backend
   
   # Check CloudWatch logs
   aws logs tail /aws/lambda/cloudberry-real-estate-backend --follow
   ```

## Rollback Procedure

If issues occur during Phase 2 deployment:

1. **Revert Lambda Function**
   ```bash
   aws lambda update-function-code \
     --function-name cloudberry-real-estate-backend \
     --s3-bucket <bucket> \
     --s3-key phase-1-lambda.zip
   ```

2. **Revert Environment Variables**
   ```bash
   # Set AGENTS_ENABLED=false
   # Set BAILEY_MODE=hosted (if needed)
   ```

3. **Monitor Metrics**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace RealEstateFlow \
     --metric-name agent.action.failed \
     --start-time 2024-01-01T00:00:00Z \
     --end-time 2024-01-01T23:59:59Z \
     --period 300 \
     --statistics Sum
   ```

## Testing Checklist

- [ ] DynamoDB tables created successfully
- [ ] Conversation state can be created and updated
- [ ] User categories can be assigned and retrieved
- [ ] Tool filtering works based on user category
- [ ] CloudWatch metrics are being published
- [ ] CloudWatch alarms are configured
- [ ] WhatsApp integration works with new context
- [ ] Agent invocations include personality injection
- [ ] Conversation history is loaded correctly
- [ ] Lead context is enriched properly

## Monitoring Dashboard

Create a CloudWatch dashboard with:
1. Agent invocation success rate
2. Tool execution success rate
3. Conversation state distribution
4. WhatsApp message throughput
5. Lambda duration and errors
6. DynamoDB read/write capacity usage

## Security Considerations

1. **Data Encryption**
   - Enable DynamoDB encryption at rest
   - Use HTTPS for all API calls

2. **Access Control**
   - Use IAM roles for Lambda execution
   - Implement tool-level access control via user categories
   - Validate user permissions before tool invocation

3. **Audit Logging**
   - Log all agent actions to CloudWatch
   - Store audit trail in DynamoDB
   - Monitor for suspicious patterns

4. **Rate Limiting**
   - Implement rate limiting on WhatsApp webhook
   - Limit agent invocations per tenant
   - Monitor for abuse patterns

## Post-Deployment Tasks

1. **Update Documentation**
   - Update API documentation with new endpoints
   - Document user category system
   - Create runbooks for common issues

2. **Team Training**
   - Train team on new personality system
   - Explain user category permissions
   - Document troubleshooting procedures

3. **Monitoring Setup**
   - Configure CloudWatch dashboards
   - Set up alert notifications
   - Create incident response procedures

4. **Performance Optimization**
   - Monitor DynamoDB capacity usage
   - Optimize Lambda memory allocation
   - Analyze agent invocation patterns
