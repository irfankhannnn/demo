# Phase 2E: Deployment & Monitoring
**Duration:** 1 week | **Focus:** CloudFormation deployment, monitoring setup, documentation

---

## High-Level Goal (Plain English)

**What we're doing:** We're deploying all the new features to the production environment (AWS), setting up monitoring to track how well the system is performing, and writing documentation so the team knows how to operate and troubleshoot the system.

**Why it matters:** All the code we've written so far is just on our local machines or test environments. We need to deploy it to AWS so real users can actually use it. We also need to set up monitoring so we know if something goes wrong (like the AI taking too long to respond, or conversation state not saving properly). Finally, we need documentation so the operations team knows how to fix common issues and what to monitor.

**In simple terms:** Think of this like "going live" - we're moving from a test environment to the real production environment, setting up cameras (monitoring) to watch how things are going, and writing an instruction manual (documentation) so the team knows what to do if something breaks. This ensures the system is reliable and the team can operate it confidently.

---

## Overview

Phase 2E handles the production deployment of all Phase 2 features, including CloudFormation updates, monitoring and alerting configuration, and comprehensive documentation.

### Success Criteria
- ✅ CloudFormation templates updated
- ✅ Monitoring and alerts working
- ✅ Documentation complete
- ✅ Team trained on new system

---

## Task 2E.1: Update CloudFormation Templates
**Effort:** 2-3 days | **Priority:** CRITICAL

### Subtask 2E.1.1: Add ConversationStateTable to Main CFN
**File:** `apps/crm/server/infra/cfn-backend.yaml`

**Changes:**
```yaml
ConversationStateTable:
  Type: AWS::DynamoDB::Table
  Condition: CreateConversationStateTable
  Properties:
    TableName: !Sub '${EnvironmentName}-conversation-state'
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: PK
        AttributeType: S
      - AttributeName: SK
        AttributeType: S
    KeySchema:
      - AttributeName: PK
        KeyType: HASH
      - AttributeName: SK
        KeyType: RANGE
    TimeToLiveSpecification:
      AttributeName: expiresAt
      Enabled: true
    Tags:
      - Key: Environment
        Value: !Ref EnvironmentName
      - Key: Service
        Value: !Ref ServiceName

# Add condition to control table creation
CreateConversationStateTable: !Equals [!Ref CreateConversationState, 'true']
```

**Validation:**
- [ ] Table added with condition
- [ ] TTL enabled
- [ ] Tags added
- [ ] Condition parameter added
- [ ] CloudFormation validates

---

### Subtask 2E.1.2: Add Environment Variables to CFN Parameters
**File:** `apps/crm/server/infra/cfn-backend.yaml`

**Changes:**
```yaml
ConversationStateTableName:
  Type: String
  Default: conversation-state
  Description: Name of the conversation state table

CreateConversationState:
  Type: String
  Default: 'true'
  Description: Whether to create the conversation state table
  AllowedValues:
    - 'true'
    - 'false'
```

**Validation:**
- [ ] Parameters added
- [ ] Default values set
- [ ] Descriptions added
- [ ] Allowed values defined

---

### Subtask 2E.1.3: Update Lambda IAM Permissions
**File:** `apps/crm/server/infra/cfn-backend.yaml`

**Changes:**
```yaml
LambdaExecutionRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: lambda.amazonaws.com
          Action: sts:AssumeRole
    ManagedPolicyArns:
      - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    Policies:
      - PolicyName: DynamoDBAccess
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - dynamodb:Query
                - dynamodb:GetItem
                - dynamodb:PutItem
                - dynamodb:UpdateItem
                - dynamodb:DeleteItem
              Resource:
                - !GetAtt CrmDynamoDbTable.Arn
                - !GetAtt ConversationStateTable.Arn
                - !Sub '${CrmDynamoDbTable.Arn}/index/*'
                - !Sub '${ConversationStateTable.Arn}/index/*'
```

**Validation:**
- [ ] IAM permissions updated
- [ ] ConversationStateTable access added
- [ ] Index access included
- [ ] Least privilege principle followed

---

### Subtask 2E.1.4: Add CloudWatch Alarms
**File:** `apps/crm/server/infra/cfn-backend.yaml`

**Changes:**
```yaml
ContextLoadingTimeAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: 'Alert when context loading takes too long'
    AlarmName: !Sub '${EnvironmentName}-context-loading-time'
    MetricName: contextLoadingTime
    Namespace: RealEstateFlow/AI
    Statistic: Average
    Period: 300
    EvaluationPeriods: 1
    Threshold: 5
    ComparisonOperator: GreaterThanThreshold
    TreatMissingData: notBreaching

AgentResponseTimeAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: 'Alert when agent response time is too high'
    AlarmName: !Sub '${EnvironmentName}-agent-response-time'
    MetricName: agentResponseTime
    Namespace: RealEstateFlow/AI
    Statistic: Average
    Period: 300
    EvaluationPeriods: 1
    Threshold: 10
    ComparisonOperator: GreaterThanThreshold
    TreatMissingData: notBreaching

StateUpdateFailureAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: 'Alert when conversation state update failures are high'
    AlarmName: !Sub '${EnvironmentName}-state-update-failure'
    MetricName: conversationStateUpdateFailure
    Namespace: RealEstateFlow/AI
    Statistic: Sum
    Period: 60
    EvaluationPeriods: 1
    Threshold: 5
    ComparisonOperator: GreaterThanThreshold
    TreatMissingData: notBreaching
```

**Validation:**
- [ ] Context loading alarm added
- [ ] Agent response time alarm added
- [ ] State update failure alarm added
- [ ] Thresholds appropriate
- [ ] TreatMissingData set correctly

---

### Subtask 2E.1.5: Deploy CloudFormation Stack
**File:** `apps/crm/server/infra/deploy.sh`

**Action:**
```bash
# Update cfn-params.json with new parameters
# Add ConversationStateTableName and CreateConversationState

# Deploy stack
aws cloudformation deploy \
  --template-file infra/cfn-backend.yaml \
  --stack-name ${STACK_NAME} \
  --parameter-overrides file://infra/cfn-params.json \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ${AWS_REGION}
```

**Validation:**
- [ ] cfn-params.json updated
- [ ] Stack deploys successfully
- [ ] ConversationStateTable created
- [ ] IAM permissions updated
- [ ] CloudWatch alarms created
- [ ] No rollback errors

---

## Task 2E.2: Add Monitoring and Observability
**Effort:** 2-3 days | **Priority:** HIGH

### Subtask 2E.2.1: Add CloudWatch Metrics
**File:** `apps/crm/server/observability/cloudwatch.js`

**Changes:**
```javascript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

export function contextLoadingTime(tenantId, agentId, duration) {
  const params = {
    Namespace: 'RealEstateFlow/AI',
    MetricData: [
      {
        MetricName: 'contextLoadingTime',
        Dimensions: [
          { Name: 'TenantId', Value: tenantId },
          { Name: 'AgentId', Value: agentId }
        ],
        Unit: 'Milliseconds',
        Value: duration
      }
    ]
  };

  cloudwatch.send(new PutMetricDataCommand(params)).catch(err => {
    logger.error('Failed to send contextLoadingTime metric:', err);
  });
}

export function agentResponseTime(tenantId, agentId, duration) {
  const params = {
    Namespace: 'RealEstateFlow/AI',
    MetricData: [
      {
        MetricName: 'agentResponseTime',
        Dimensions: [
          { Name: 'TenantId', Value: tenantId },
          { Name: 'AgentId', Value: agentId }
        ],
        Unit: 'Milliseconds',
        Value: duration
      }
    ]
  };

  cloudwatch.send(new PutMetricDataCommand(params)).catch(err => {
    logger.error('Failed to send agentResponseTime metric:', err);
  });
}

export function conversationStateUpdateFailure(tenantId, reason) {
  const params = {
    Namespace: 'RealEstateFlow/AI',
    MetricData: [
      {
        MetricName: 'conversationStateUpdateFailure',
        Dimensions: [
          { Name: 'TenantId', Value: tenantId },
          { Name: 'Reason', Value: reason }
        ],
        Unit: 'Count',
        Value: 1
      }
    ]
  };

  cloudwatch.send(new PutMetricDataCommand(params)).catch(err => {
    logger.error('Failed to send conversationStateUpdateFailure metric:', err);
  });
}

export function contextCacheHitRate(tenantId, hits, misses) {
  const total = hits + misses;
  const hitRate = total > 0 ? (hits / total) * 100 : 0;

  const params = {
    Namespace: 'RealEstateFlow/AI',
    MetricData: [
      {
        MetricName: 'contextCacheHitRate',
        Dimensions: [
          { Name: 'TenantId', Value: tenantId }
        ],
        Unit: 'Percent',
        Value: hitRate
      }
    ]
  };

  cloudwatch.send(new PutMetricDataCommand(params)).catch(err => {
    logger.error('Failed to send contextCacheHitRate metric:', err);
  });
}
```

**Validation:**
- [ ] All metrics implemented
- [ ] Error handling for metric failures
- [ ] Dimensions include tenant and agent
- [ ] Units specified correctly
- [ ] Non-blocking metric calls

---

### Subtask 2E.2.2: Integrate Metrics into Agent Runtime
**File:** `apps/crm/server/agents/agentRuntime.js`

**Changes:**
```javascript
import { contextLoadingTime, agentResponseTime } from '../observability/cloudwatch.js';

// Around line 210 (before building system prompt)
const contextStart = Date.now();
const conversationHistory = await getConversationContext(tenantId, context.contactPhone, 5);
const contextDuration = Date.now() - contextStart;
contextLoadingTime(tenantId, agentId, contextDuration);

// Around line 220 (after agent invocation)
const agentStart = Date.now();
const agentResponse = await runBedrockLoop(systemPrompt, tools);
const agentDuration = Date.now() - agentStart;
agentResponseTime(tenantId, agentId, agentDuration);
```

**Validation:**
- [ ] Context loading time tracked
- [ ] Agent response time tracked
- [ ] Metrics sent to CloudWatch
- [ ] No performance impact
- [ ] Metrics visible in CloudWatch console

---

### Subtask 2E.2.3: Create CloudWatch Dashboard
**File:** `apps/crm/server/infra/cloudwatch-dashboard.json` (new file)

**Changes:**
```json
{
  "DashboardName": "RealEstateFlow-AI-Monitoring",
  "DashboardBody": {
    "widgets": [
      {
        "type": "metric",
        "x": 0,
        "y": 0,
        "width": 12,
        "height": 6,
        "properties": {
          "metrics": [
            ["RealEstateFlow/AI", "contextLoadingTime", "TenantId", "${tenantId}"],
            [".", "agentResponseTime", ".", "."]
          ],
          "period": 300,
          "stat": "Average",
          "region": "ap-south-1",
          "title": "Context & Response Times"
        }
      },
      {
        "type": "metric",
        "x": 12,
        "y": 0,
        "width": 12,
        "height": 6,
        "properties": {
          "metrics": [
            ["RealEstateFlow/AI", "conversationStateUpdateFailure", "TenantId", "${tenantId}"]
          ],
          "period": 60,
          "stat": "Sum",
          "region": "ap-south-1",
          "title": "State Update Failures"
        }
      },
      {
        "type": "metric",
        "x": 0,
        "y": 6,
        "width": 12,
        "height": 6,
        "properties": {
          "metrics": [
            ["RealEstateFlow/AI", "contextCacheHitRate", "TenantId", "${tenantId}"]
          ],
          "period": 300,
          "stat": "Average",
          "region": "ap-south-1",
          "title": "Cache Hit Rate"
        }
      }
    ]
  }
}
```

**Deployment Command:**
```bash
aws cloudwatch put-dashboard --dashboard-body file://server/infra/cloudwatch-dashboard.json
```

**Validation:**
- [ ] Dashboard JSON created
- [ ] All metrics included
- [ ] Dashboard deployed
- [ ] Widgets display correctly
- [ ] Auto-refresh configured

---

### Subtask 2E.2.4: Configure Alert Notifications
**File:** `apps/crm/server/infra/sns-topic.yaml` (new file)

**Changes:**
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  AlertSNSTopic:
    Type: AWS::SNS::Topic
    Properties:
      DisplayName: RealEstateFlow-AI-Alerts
      Tags:
        - Key: Environment
          Value: !Ref EnvironmentName

  AlertSubscription:
    Type: AWS::SNS::Subscription
    Properties:
      Protocol: email
      TopicArn: !Ref AlertSNSTopic
      Endpoint: !Ref AlertEmail

  AlarmSubscription:
    Type: AWS::SNS::Subscription
    Properties:
      Protocol: email
      TopicArn: !Ref AlertSNSTopic
      Endpoint: !Ref AlertEmail

Parameters:
  EnvironmentName:
    Type: String
  AlertEmail:
    Type: String
    Description: Email address for alert notifications
```

**Validation:**
- [ ] SNS topic created
- [ ] Email subscription added
- [ ] Topic connected to alarms
- [ ] Test notification sent
- [ ] Alerts received via email

---

## Task 2E.3: Documentation and Runbooks
**Effort:** 3-4 days | **Priority:** HIGH

### Subtask 2E.3.1: Create Context Management Guide
**File:** `docs/CONTEXT_MANAGEMENT_GUIDE.md` (new file)

**Content:**
```markdown
# Context Management Guide

## Overview
The AI Employee system uses a layered context management approach to provide agents with relevant information for each conversation.

## Context Layers

### 1. Personality Context
- **Source:** AgencyConfig.aiPersonality
- **Purpose:** Determines tone and style of responses
- **Options:** professional, friendly, direct

### 2. Tenant Knowledge Base
- **Source:** `.devin/ai-employee/tenant-templates/{tenantId}/`
- **Purpose:** Tenant-specific business context and team information
- **Files:** business-context.md, team-members.md, custom-rules.md

### 3. Conversation History
- **Source:** WhatsApp conversation messages (last 5)
- **Storage:** DynamoDB CRM table
- **TTL:** 90 days
- **Cache:** 30-second in-memory cache

### 4. Lead/Contact Context
- **Source:** CRM lead records
- **Purpose:** Provides lead details, score, source, notes
- **Fields:** name, phone, email, type, score, source, lastInteraction

### 5. Conversation State
- **Source:** ConversationState table
- **Purpose:** Tracks multi-turn conversation goals and extracted info
- **TTL:** 7 days
- **Fields:** goal, goalProgress, extractedInfo

## Context Assembly Order
1. Personality (base tone)
2. Tenant knowledge base (business context)
3. Agent-specific prompt (role definition)
4. Conversation history (recent messages)
5. Lead context (if available)
6. Conversation state (if available)

## Troubleshooting

### Issue: Agent not using personality
**Solution:** Check AgencyConfig.aiPersonality is set correctly

### Issue: Conversation history not loading
**Solution:** Verify WhatsApp messages are stored in DynamoDB

### Issue: State not persisting across turns
**Solution:** Check ConversationState table is created and accessible

### Issue: Context too large
**Solution:** Reduce conversation history limit (default: 5 messages)
```

**Validation:**
- [ ] Guide created
- [ ] All context layers documented
- [ ] Assembly order explained
- [ ] Troubleshooting section included
- [ ] Examples provided

---

### Subtask 2E.3.2: Create Personality Configuration Guide
**File:** `docs/PERSONALITY_CONFIGURATION.md` (new file)

**Content:**
```markdown
# Personality Configuration Guide

## Overview
The AI Employee system supports three personality types that determine the tone and style of agent responses.

## Personality Types

### Professional
- **Tone:** Formal, concise, business-focused
- **Language:** Proper English, minimal casual language
- **Use Case:** Corporate clients, formal business interactions
- **Example:** "Property details: 2BHK, 50L, Bandra West. Available for viewing."

### Friendly
- **Tone:** Warm, conversational, approachable
- **Language:** Hinglish (70% English, 30% Hindi romanised)
- **Use Case:** Individual buyers, casual interactions
- **Example:** "Hey! Found a nice 2BHK in Bandra for 50L. Interested in seeing it?"

### Direct
- **Tone:** Straightforward, action-oriented
- **Language:** Concise, minimal details
- **Use Case:** Quick information requests, time-sensitive situations
- **Example:** "2BHK, 50L, Bandra. View tomorrow?"

## Configuration

### Via API
```bash
PATCH /api/crm/config/ai-employee
{
  "aiPersonality": "friendly"
}
```

### Via UI
1. Navigate to AI Employee Settings
2. Select personality from dropdown
3. Save configuration

## Testing
1. Set personality to desired type
2. Invoke agent with test prompt
3. Verify response tone matches personality
4. Test all three personalities

## Troubleshooting
- **Personality not changing:** Check AgencyConfig is updated
- **Tone incorrect:** Verify personality templates in prompts.js
- **Hinglish not working:** Check friendly personality template
```

**Validation:**
- [ ] Guide created
- [ ] All personalities documented
- [ ] Configuration steps included
- [ ] Testing steps included
- [ ] Troubleshooting section added

---

### Subtask 2E.3.3: Create Conversation State Guide
**File:** `docs/CONVERSATION_STATE_GUIDE.md` (new file)

**Content:**
```markdown
# Conversation State Guide

## Overview
Conversation state tracks multi-turn conversations, allowing the AI to maintain context across message exchanges.

## State Schema

### Fields
- **conversationId:** Unique identifier for the conversation
- **state:** active | completed | escalated
- **goal:** Current conversation goal (e.g., "qualify_lead")
- **goalProgress:** Progress percentage (0-100)
- **extractedInfo:** Key information extracted from conversation
- **messageCount:** Number of messages in conversation
- **startedAt:** Conversation start timestamp
- **lastMessageAt:** Last message timestamp
- **updatedAt:** Last update timestamp
- **expiresAt:** TTL (7 days)

## State Lifecycle

### Active
- Conversation is ongoing
- Agent is working toward goal
- Extracted info being accumulated

### Completed
- Goal achieved
- Lead converted
- Meeting scheduled

### Escalated
- Requires human intervention
- Complex query
- Error condition

## Extracted Info Fields

Common extracted fields:
- budget: "50L", "1Cr"
- timeline: "2 months", "immediate"
- propertyType: "2BHK", "3BHK"
- location: "Bandra", "Andheri"
- preferences: "parking", "gym"

## API Endpoints

### Get State
```bash
GET /api/crm/conversation-state/{phone}
```

### Update State
```bash
POST /api/crm/conversation-state/{phone}
{
  "goal": "qualify_lead",
  "extractedInfo": { "budget": "50L" }
}
```

### Complete State
```bash
POST /api/crm/conversation-state/{phone}/complete
{
  "outcome": "lead_converted"
}
```

## Troubleshooting

### Issue: State not persisting
**Solution:** Check ConversationState table is accessible

### Issue: Extracted info not updating
**Solution:** Verify agent is calling updateConversationState

### Issue: State not expiring
**Solution:** Check TTL is set correctly (7 days)
```

**Validation:**
- [ ] Guide created
- [ ] Schema documented
- [ ] Lifecycle explained
- [ ] API endpoints documented
- [ ] Troubleshooting included

---

### Subtask 2E.3.4: Create Troubleshooting Guide
**File:** `docs/TROUBLESHOOTING_GUIDE.md` (new file)

**Content:**
```markdown
# Troubleshooting Guide

## Common Issues

### WhatsApp Integration

#### Issue: Webhook signature verification failed
**Symptoms:** Webhook returns 401
**Causes:**
- BAILEY_WEBHOOK_SECRET mismatch
- Timestamp drift
- Signature calculation error
**Solutions:**
1. Verify BAILEY_WEBHOOK_SECRET matches Bailey configuration
2. Check system time is synchronized
3. Review signature calculation logic

#### Issue: Messages not storing in DynamoDB
**Symptoms:** Messages sent but not retrieved
**Causes:**
- DynamoDB table not accessible
- IAM permissions missing
- TTL configuration error
**Solutions:**
1. Check DynamoDB table exists
2. Verify Lambda IAM permissions
3. Review TTL configuration

### AI Agent System

#### Issue: Agent returns empty response
**Symptoms:** Agent invoked but no response
**Causes:**
- AGENTS_ENABLED=false
- Insufficient credits
- LLM API error
**Solutions:**
1. Check AGENTS_ENABLED=true
2. Verify credit balance > 15
3. Check Bedrock/Gemini API credentials

#### Issue: Personality not changing response tone
**Symptoms:** All responses have same tone
**Causes:**
- Personality not loaded from config
- Personality templates not defined
- buildSystemPrompt not using personality
**Solutions:**
1. Check AgencyConfig.aiPersonality
2. Verify personality templates in prompts.js
3. Check buildSystemPrompt signature

### Context Management

#### Issue: Conversation history not loading
**Symptoms:** Agent can't reference previous messages
**Causes:**
- WhatsApp messages not stored
- getConversationContext not called
- Phone number validation failing
**Solutions:**
1. Verify messages in DynamoDB
2. Check agent runtime calls getConversationContext
3. Review phone number validation logic

#### Issue: Conversation state not persisting
**Symptoms:** State resets on each message
**Causes:**
- ConversationState table not created
- updateConversationState not called
- TTL too short
**Solutions:**
1. Verify ConversationState table exists
2. Check agent runtime calls updateConversationState
3. Review TTL configuration (7 days)

### Tool System

#### Issue: Tool access denied
**Symptoms:** Agent can't use tools
**Causes:**
- User category set to blocked/spam
- Tool not in allowed list
- Permission check failing
**Solutions:**
1. Check user category
2. Verify TOOL_CATEGORY_PERMISSIONS
3. Review permission check logic

#### Issue: Tools not receiving context
**Symptoms:** Tools can't access lead/conversation data
**Causes:**
- Context enrichment not implemented
- invokeSkill not passing context
- Tool handlers not using context
**Solutions:**
1. Check invokeSkill enriches context
2. Verify executeToolWithContext passes context
3. Review tool handler implementations

## Monitoring

### CloudWatch Metrics
- contextLoadingTime: Should be < 5 seconds
- agentResponseTime: Should be < 10 seconds
- conversationStateUpdateFailure: Should be 0
- contextCacheHitRate: Should be > 80%

### Alarms
- Context loading time > 5 seconds
- Agent response time > 10 seconds
- State update failures > 5/min

## Logs

### Lambda Logs
- Check CloudWatch Logs for Lambda function
- Look for errors in agent runtime
- Review context loading logs

### Agent Audit Logs
- Query AgentAuditTable for agent actions
- Check for access denials
- Review tool invocation logs

## Support Escalation

### Level 1: Common Issues
- Use this guide
- Check CloudWatch metrics
- Review logs

### Level 2: Complex Issues
- Escalate to engineering team
- Provide CloudWatch logs
- Include reproduction steps

### Level 3: Critical Issues
- Escalate to founder
- Page on-call engineer
- Create incident ticket
```

**Validation:**
- [ ] Guide created
- [ ] Common issues documented
- [ ] Solutions provided
- [ ] Monitoring section added
- [ ] Escalation path defined

---

### Subtask 2E.3.5: Create Monitoring Guide
**File:** `docs/MONITORING_GUIDE.md` (new file)

**Content:**
```markdown
# Monitoring Guide

## Overview
The AI Employee system uses CloudWatch for monitoring and alerting.

## Metrics

### Context Loading Time
- **Metric:** contextLoadingTime
- **Unit:** Milliseconds
- **Threshold:** < 5000ms
- **Alarm:** ContextLoadingTimeAlarm

### Agent Response Time
- **Metric:** agentResponseTime
- **Unit:** Milliseconds
- **Threshold:** < 10000ms
- **Alarm:** AgentResponseTimeAlarm

### State Update Failures
- **Metric:** conversationStateUpdateFailure
- **Unit:** Count
- **Threshold:** < 5/min
- **Alarm:** StateUpdateFailureAlarm

### Cache Hit Rate
- **Metric:** contextCacheHitRate
- **Unit:** Percent
- **Target:** > 80%
- **Alarm:** None (informational)

## Dashboard

### Access
1. Open CloudWatch console
2. Navigate to Dashboards
3. Select "RealEstateFlow-AI-Monitoring"

### Widgets
- Context & Response Times
- State Update Failures
- Cache Hit Rate

## Alarms

### Viewing Alarms
1. Open CloudWatch console
2. Navigate to Alarms
3. Filter by "RealEstateFlow"

### Configuring Notifications
1. Edit alarm
2. Add SNS topic
3. Configure email endpoint

### Alarm States
- OK: Metric within threshold
- ALARM: Metric exceeded threshold
- INSUFFICIENT_DATA: No data available

## Log Groups

### Lambda Logs
- **Log Group:** /aws/lambda/${EnvironmentName}-lambda
- **Retention:** 14 days
- **Format:** JSON

### Agent Audit Logs
- **Log Source:** AgentAuditTable
- **Retention:** 90 days
- **Format:** DynamoDB stream

## Troubleshooting Monitoring

### Issue: Metrics not appearing
**Solution:** Check IAM permissions for CloudWatch

### Issue: Alarms not triggering
**Solution:** Verify threshold and period settings

### Issue: Dashboard not updating
**Solution:** Check auto-refresh is enabled
```

**Validation:**
- [ ] Guide created
- [ ] All metrics documented
- [ ] Dashboard access explained
- [ ] Alarm configuration documented
- [ ] Log groups documented

---

## Phase 2E Completion Checklist

### CloudFormation
- [ ] ConversationStateTable added to CFN
- [ ] Environment variables added
- [ ] IAM permissions updated
- [ ] CloudWatch alarms added
- [ ] Stack deployed successfully
- [ ] No rollback errors

### Monitoring
- [ ] CloudWatch metrics implemented
- [ ] Metrics integrated into agent runtime
- [ ] Dashboard created and deployed
- [ ] SNS topic for alerts created
- [ ] Email subscription configured
- [ ] Test notifications sent

### Documentation
- [ ] Context Management Guide created
- [ ] Personality Configuration Guide created
- [ ] Conversation State Guide created
- [ ] Troubleshooting Guide created
- [ ] Monitoring Guide created
- [ ] All guides reviewed and approved

### Training
- [ ] Team trained on new features
- [ ] Runbooks distributed
- [ ] Support escalation path defined
- [ ] On-call rotation updated

### Validation
- [ ] All Phase 2A-2D features tested in production
- [ ] Monitoring working correctly
- [ ] Alerts triggering as expected
- [ ] Documentation accessible
- [ ] Team confident in operations

---

## Next Steps

After completing Phase 2E:
1. Update `progress-tracker.md` with completed tasks
2. Mark entire Phase 2 as complete
3. Conduct post-implementation review
4. Plan Phase 3 (if applicable)

---

**Phase Status:** 📋 Planned
**Last Updated:** June 2026
