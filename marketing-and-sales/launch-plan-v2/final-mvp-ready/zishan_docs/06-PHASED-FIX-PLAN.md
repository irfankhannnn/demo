# Phased Fix Plan — Step-by-Step Implementation
## Modular Chunks for Easy Development and Testing

> **NOTE:** This document reflects the state before cron jobs were merged into cfn-backend.yaml. For current deployment, see 08-FINAL-IMPLEMENTATION-PLAN.md. All 10 cron jobs are now deployed as part of the single cfn-backend.yaml template via one-click deployment (./deploy.sh).

**Based on:** Code Audit Report (`02-CODE-AUDIT-REPORT.md`)
**Config Guide:** `07-CONFIG-UPDATE-GUIDE.md`
**Status:** Ready for implementation

---

## Overview

This plan divides all fixes into **9 core phases** plus **2 new sub-phases (1A and 1B)**, each with clear:
- **Goal** — What you achieve
- **Files** — What you change
- **Steps** — Exact commands/edits
- **Verification** — How to test
- **Estimated Time** — For planning

**Prerequisites:**
- `agency-app/api/.env` exists (copy from `agency-app/api/.env.example`)
- AWS CLI configured with credentials
- Node.js 18+ installed locally

---

## Phase 1: Fix Deployment Script (Critical Blocker #1)

**Goal:** Add 8 missing parameters to `deploy.sh` so CloudFormation receives all config

**Why First:** Without this, deployment fails immediately with parameter errors. The `cfn-backend.yaml` already defines these parameters and the Lambda environment variables already use them — only the deployment script is missing them.

**Files:**
- `agency-app/api/infra/deploy.sh` (primary)
- `agency-app/api/infra/deploy-fixed.sh` (untracked backup/alternative — also needs the same parameters if you decide to use it)

**Current State of deploy.sh:**
- Already has `set -euo pipefail` at line 2 (strict error handling is done)
- Now has deployment toggles: `DEPLOY_LAMBDA`, `DEPLOY_INSTALL`, `DEPLOY_ZIP`, `DEPLOY_CFN`
- Generates `cfn-params.json` from `.env` and passes `PARAM_OVERRIDES` to CloudFormation
- The 8 parameters are **missing** from both the generated `cfn-params.json` and `PARAM_OVERRIDES`

**Steps:**

### 1.1 Add parameters to cfn-params.json heredoc

Open `agency-app/api/infra/deploy.sh` around line 164 (the `cat > "$SCRIPT_DIR/cfn-params.json" <<EOF` section). Add these 8 parameters before the closing `]`:

```bash
  { "ParameterKey": "CreditsTableName", "ParameterValue": "${CREDITS_TABLE_NAME}" },
  { "ParameterKey": "CreditConfigTableName", "ParameterValue": "${CREDIT_CONFIG_TABLE_NAME}" },
  { "ParameterKey": "SesFromEmail", "ParameterValue": "${AWS_SES_FROM_EMAIL}" },
  { "ParameterKey": "EmailProviderPrimary", "ParameterValue": "${EMAIL_PROVIDER_PRIMARY}" },
  { "ParameterKey": "BaileyEnabled", "ParameterValue": "${BAILEY_ENABLED}" },
  { "ParameterKey": "BaileyApiKey", "ParameterValue": "${BAILEY_API_KEY}" },
  { "ParameterKey": "BaileyWebhookSecret", "ParameterValue": "${BAILEY_WEBHOOK_SECRET}" },
  { "ParameterKey": "AgentsEnabled", "ParameterValue": "${AGENTS_ENABLED}" },
```

**Where exactly:** After the existing parameters like `BrevoFromName`, before the closing `]` of the JSON array.

### 1.2 Add parameters to PARAM_OVERRIDES array

Around line 207, find the `PARAM_OVERRIDES=(` array. Add these 8 lines:

```bash
  "CreditsTableName=${CREDITS_TABLE_NAME}"
  "CreditConfigTableName=${CREDIT_CONFIG_TABLE_NAME}"
  "SesFromEmail=${AWS_SES_FROM_EMAIL}"
  "EmailProviderPrimary=${EMAIL_PROVIDER_PRIMARY}"
  "BaileyEnabled=${BAILEY_ENABLED}"
  "BaileyApiKey=${BAILEY_API_KEY}"
  "BaileyWebhookSecret=${BAILEY_WEBHOOK_SECRET}"
  "AgentsEnabled=${AGENTS_ENABLED}"
```

**Where exactly:** After existing overrides like `BrevoFromName`, before the closing `)` of the array.

### 1.3 Add environment variables to .env

Ensure these 8 variables are present in `agency-app/api/.env` (copy from `agency-app/api/.env.example` if needed):

```bash
CREDITS_TABLE_NAME=cloudberry-real-estate-credits
CREDIT_CONFIG_TABLE_NAME=cloudberry-real-estate-credit-config
AWS_SES_FROM_EMAIL=noreply@realestateflow.in
EMAIL_PROVIDER_PRIMARY=ses
BAILEY_ENABLED=false
BAILEY_API_KEY=
BAILEY_WEBHOOK_SECRET=
AGENTS_ENABLED=false
```

**Verification:**

```bash
cd agency-app/api/infra
bash -n deploy.sh  # Syntax check (should output nothing)
```

Or manually inspect: Search for the 8 parameter names in the file. You should find each one in both the `cfn-params.json` section and the `PARAM_OVERRIDES` array.

**Important deployment note:** The current `deploy.sh` has `DEPLOY_CFN=false` by default. This means it will update the Lambda function directly (`aws lambda update-function-code`) but **not** run CloudFormation. To pass the 8 new parameters to CloudFormation, you must set `DEPLOY_CFN=true` for at least one deployment.

```bash
# Set these before running
DEPLOY_LAMBDA=true
DEPLOY_CFN=true
./deploy.sh
```

After the first successful CloudFormation deployment, you can switch back to `DEPLOY_CFN=false` for faster Lambda-only updates.

**Note:** Phase 1.3 of the original plan (adding `set -e`) is already done. The current script uses `set -euo pipefail`, which is even stricter.

**Estimated Time:** 15 minutes

---

## Phase 1A: Dependency Strategy for Dynamic Imports (New)

**Goal:** Ensure the removed dependencies are still available at Lambda runtime

**Why:** You removed several dependencies from `agency-app/api/package.json` to reduce bundle size:
- `@aws-sdk/client-bedrock-runtime`
- `@aws-sdk/client-eventbridge`
- `@aws-sdk/client-sesv2`
- `xlsx`
- `@modelcontextprotocol/sdk`

The code now uses dynamic imports (`await import(...)`). This is fine, but the packages must still be available at runtime.

**Options:**

### Option A: Use Lambda layers (Recommended)
1. Create a Lambda layer containing the removed packages
2. Attach the layer to the Lambda in `cfn-backend.yaml`
3. Update the layer ARN in `agency-app/api/.env` and pass it to CloudFormation

### Option B: Add them back to package.json for now
```bash
cd server
npm add @aws-sdk/client-bedrock-runtime @aws-sdk/client-eventbridge @aws-sdk/client-sesv2 xlsx @modelcontextprotocol/sdk
```

### Option C: Bundle them separately into the zip
Modify `deploy.sh` to copy these packages from a separate `node_modules/` directory into the function zip before upload.

**Impact on the plan:**
- Phase 2 (cron templates) still needs to be done, but cron Lambda handlers that send email will also need SESv2 available
- Phase 7 (agent features) cannot work if `bedrock-runtime` and `@modelcontextprotocol/sdk` are missing at runtime

**Recommendation:** Use Option A (Lambda layers) for production, or Option B (add back) for quick launch.

**Verification:**
After deploying, test the affected endpoints:
1. Send email via API (uses SESv2)
2. Export team analytics Excel (uses xlsx)
3. Receive WhatsApp webhook (uses EventBridge)
4. Test agent skill (uses Bedrock + MCP SDK)

**Estimated Time:** 30-60 minutes (depending on option chosen)

---

## Phase 1B: Cleanup (New)

**Goal:** Remove temporary files that should not be committed

**Files to delete:**
- `crmDynamodbService_nobom.js` (untracked)
- `function-26mb.zip` (untracked)
- `function-33mb.zip` (untracked)
- `function-41mb.zip` (untracked)
- `server/temp_folder_to_be_deleted_after_fixing/` (untracked)

**Command:**
```bash
cd "d:\reality_flow_crm\nabi-app-git-bkp"
rm -f crmDynamodbService_nobom.js
rm -f function-26mb.zip function-33mb.zip function-41mb.zip
rm -rf server/temp_folder_to_be_deleted_after_fixing/
```

**Note:** `agency-app/api/infra/deploy-fixed.sh` is also untracked. If it's a backup, either delete it or move it to a `backups/` directory outside git.

**Estimated Time:** 5 minutes

---

## Phase 2: Fix Critical Cron Template Issues (Critical Blockers #3, #4, #5)

**Goal:** Fix syntax error in escalation-cron.js, add SES config to existing crons, fix lead-qualifier.yaml

**Why Second:** Crons are essential for lead management; they must deploy correctly

**Files:**
- `server/crons/escalation-cron.js`
- `cron/trial-reminder.yaml`
- `cron/escalate-openclaw.yaml`
- `cron/lead-qualifier.yaml`

### 2.1 Fix syntax error in escalation-cron.js

Open `server/crons/escalation-cron.js`. Find line ~30 where you likely have:

```javascript
if (leadStatus === 'open' && daysSinceLastActivity > 7) {
```

Change to:

```javascript
if (lead.status === 'open' && daysSinceLastActivity > 7) {
```

**What's wrong:** The code references `leadStatus` but should reference `lead.status` (the property of the lead object).

**Important:** Verify this is the actual syntax error in your file before applying. The audit report suggests this issue, but the actual variable name may differ. Open the file and confirm the error message from `node -c` first.

**Verification:**

```bash
cd server/crons
node -c escalation-cron.js  # Should output nothing if syntax is correct
```

### 2.2 Add SES config to trial-reminder.yaml

Open `cron/trial-reminder.yaml`. Add to `Parameters` section:

```yaml
SesFromEmail:
  Type: String
  Default: 'noreply@realestateflow.in'
EmailProviderPrimary:
  Type: String
  Default: 'ses'
```

Add to `TrialReminderFunction.Environment.Variables`:

```yaml
AWS_SES_FROM_EMAIL: !Ref SesFromEmail
EMAIL_PROVIDER_PRIMARY: !Ref EmailProviderPrimary
```

Add to `TrialReminderRole.Policies[0].PolicyDocument.Statement`:

```yaml
- Effect: Allow
  Action:
    - ses:SendEmail
    - ses:SendRawEmail
  Resource: !Sub 'arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/${SesFromEmail}'
```

**Security note:** Scope SES permissions to your verified identity instead of `Resource: '*'`.

**Verification:**

```bash
cd cron
aws cloudformation validate-template --template-body file://trial-reminder.yaml
```

### 2.3 Add SES config to escalate-openclaw.yaml

Same changes as 2.2, but in `cron/escalate-openclaw.yaml`:
- Add parameters `SesFromEmail` and `EmailProviderPrimary`
- Add env vars to `EscalateOpenclawFunction`
- Add SES IAM permissions to the role

**Security note:** Use `Resource: !Sub 'arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/${SesFromEmail}'` instead of `Resource: '*'`, matching Phase 2.2.

**Verification:** Same as 2.2

### 2.4 Fix lead-qualifier.yaml (Critical Blocker #4)

Open `cron/lead-qualifier.yaml`. This template is incomplete. Add:

**Parameters:**

```yaml
LambdaCodeS3Bucket:
  Type: String
LambdaCodeS3Key:
  Type: String
CrmTableName:
  Type: String
  Default: 'cloudberry-real-estate-crm'
CreditConfigTableName:
  Type: String
  Default: 'cloudberry-real-estate-credit-config'
AgentsEnabled:
  Type: String
  Default: 'false'
```

**IAM Role (add after Parameters section):**

```yaml
LeadQualifierRole:
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
      - PolicyName: LeadQualifierPolicy
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - dynamodb:GetItem
                - dynamodb:PutItem
                - dynamodb:UpdateItem
                - dynamodb:Query
                - dynamodb:Scan
              Resource:
                - !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${CrmTableName}'
                - !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${CrmTableName}/*'
                - !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${CreditConfigTableName}'
                - !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${CreditConfigTableName}/*'
            - Effect: Allow
              Action:
                - bedrock:InvokeModel
              Resource: '*'
```

**Update Lambda Function (add these properties):**

```yaml
Role: !GetAtt LeadQualifierRole.Arn
Code:
  S3Bucket: !Ref LambdaCodeS3Bucket
  S3Key: !Ref LambdaCodeS3Key
Environment:
  Variables:
    CRM_TABLE_NAME: !Ref CrmTableName
    CREDIT_CONFIG_TABLE_NAME: !Ref CreditConfigTableName
    AGENTS_ENABLED: !Ref AgentsEnabled
    AWS_REGION_OVERRIDE: 'ap-south-1'
```

**Verification:**

```bash
cd cron
aws cloudformation validate-template --template-body file://lead-qualifier.yaml
```

**Estimated Time:** 45 minutes

---

## Phase 3: Create Missing Cron Templates (Critical Blocker #5)

**Goal:** Create 3 completely missing cron templates

**Why Third:** These are placeholders; they won't be deployed immediately but need to exist

**Files:**
- `cron/lead-followup.yaml` (NEW)
- `cron/lead-router.yaml` (NEW)
- `cron/whatsapp-processor.yaml` (NEW)

### 3.1 Create lead-followup.yaml

Create new file `cron/lead-followup.yaml` with minimal scaffolding:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Lead Followup Cron (Placeholder for v2)

Parameters:
  LambdaCodeS3Bucket:
    Type: String
  LambdaCodeS3Key:
    Type: String
  CrmTableName:
    Type: String
    Default: 'cloudberry-real-estate-crm'
  SesFromEmail:
    Type: String
    Default: 'noreply@realestateflow.in'

Resources:
  LeadFollowupRole:
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
        - PolicyName: LeadFollowupPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:Query
                  - dynamodb:UpdateItem
                Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${CrmTableName}'

  LeadFollowupFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: lead-followup
      Handler: lead-followup.handler
      Role: !GetAtt LeadFollowupRole.Arn
      Runtime: nodejs18.x
      Timeout: 300
      Code:
        S3Bucket: !Ref LambdaCodeS3Bucket
        S3Key: !Ref LambdaCodeS3Key
      Environment:
        Variables:
          CRM_TABLE_NAME: !Ref CrmTableName
          AWS_SES_FROM_EMAIL: !Ref SesFromEmail

  LeadFollowupRule:
    Type: AWS::Events::Rule
    Properties:
      ScheduleExpression: 'rate(1 hour)'
      State: ENABLED
      Targets:
        - Arn: !GetAtt LeadFollowupFunction.Arn
          Id: LeadFollowupTarget

  LeadFollowupPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref LeadFollowupFunction
      Action: lambda:InvokeFunction
      Principal: events.amazonaws.com
      SourceArn: !GetAtt LeadFollowupRule.Arn
```

### 3.2 Create lead-router.yaml

Create new file `cron/lead-router.yaml` with minimal scaffolding (similar to 3.1 but for routing):

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Lead Router Cron (Placeholder for v2)

Parameters:
  LambdaCodeS3Bucket:
    Type: String
  LambdaCodeS3Key:
    Type: String
  CrmTableName:
    Type: String
    Default: 'cloudberry-real-estate-crm'

Resources:
  LeadRouterRole:
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
        - PolicyName: LeadRouterPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:Query
                  - dynamodb:UpdateItem
                Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${CrmTableName}'

  LeadRouterFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: lead-router
      Handler: lead-router.handler
      Role: !GetAtt LeadRouterRole.Arn
      Runtime: nodejs18.x
      Timeout: 300
      Code:
        S3Bucket: !Ref LambdaCodeS3Bucket
        S3Key: !Ref LambdaCodeS3Key
      Environment:
        Variables:
          CRM_TABLE_NAME: !Ref CrmTableName

  LeadRouterRule:
    Type: AWS::Events::Rule
    Properties:
      ScheduleExpression: 'rate(30 minutes)'
      State: ENABLED
      Targets:
        - Arn: !GetAtt LeadRouterFunction.Arn
          Id: LeadRouterTarget

  LeadRouterPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref LeadRouterFunction
      Action: lambda:InvokeFunction
      Principal: events.amazonaws.com
      SourceArn: !GetAtt LeadRouterRule.Arn
```

### 3.3 Create whatsapp-processor.yaml

Create new file `cron/whatsapp-processor.yaml` with minimal scaffolding:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: WhatsApp Processor Cron (Placeholder for v2)

Parameters:
  LambdaCodeS3Bucket:
    Type: String
  LambdaCodeS3Key:
    Type: String
  CrmTableName:
    Type: String
    Default: 'cloudberry-real-estate-crm'

Resources:
  WhatsAppProcessorRole:
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
        - PolicyName: WhatsAppProcessorPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:Query
                  - dynamodb:UpdateItem
                Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${CrmTableName}'

  WhatsAppProcessorFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: whatsapp-processor
      Handler: whatsapp-processor.handler
      Role: !GetAtt WhatsAppProcessorRole.Arn
      Runtime: nodejs18.x
      Timeout: 300
      Code:
        S3Bucket: !Ref LambdaCodeS3Bucket
        S3Key: !Ref LambdaCodeS3Key
      Environment:
        Variables:
          CRM_TABLE_NAME: !Ref CrmTableName

  WhatsAppProcessorRule:
    Type: AWS::Events::Rule
    Properties:
      ScheduleExpression: 'rate(5 minutes)'
      State: DISABLED  # Disabled until Bailey is configured
      Targets:
        - Arn: !GetAtt WhatsAppProcessorFunction.Arn
          Id: WhatsAppProcessorTarget

  WhatsAppProcessorPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref WhatsAppProcessorFunction
      Action: lambda:InvokeFunction
      Principal: events.amazonaws.com
      SourceArn: !GetAtt WhatsAppProcessorRule.Arn
```

**Verification:**

```bash
cd cron
aws cloudformation validate-template --template-body file://lead-followup.yaml
aws cloudformation validate-template --template-body file://lead-router.yaml
aws cloudformation validate-template --template-body file://whatsapp-processor.yaml
```

**Estimated Time:** 30 minutes

---

## Phase 4: Fix Expiring Agreements Cron (High-Severity Gap #3)

**Goal:** Fix grouping logic in expiring-agreements-cron.js to group by member

**Why Fourth:** This is a data quality issue; not blocking but important

**Files:**
- `server/crons/expiring-agreements-cron.js`

### 4.1 Update grouping logic

Open `server/crons/expiring-agreements-cron.js`. Find the section where agreements are processed. Look for something like:

```javascript
const expiringAgreements = await scanDynamoDb(agreementsTable, expiringFilter);
// Send individual notifications
for (const agreement of expiringAgreements) {
  await sendNotification(agreement);
}
```

Change to group by member:

```javascript
const expiringAgreements = await scanDynamoDb(agreementsTable, expiringFilter);

// Group by member
const byMember = {};
for (const agreement of expiringAgreements) {
  const memberId = agreement.memberId || agreement.userId;
  if (!memberId) {
    console.warn('Agreement missing memberId:', agreement.id);
    continue; // Skip this agreement
  }
  if (!byMember[memberId]) {
    byMember[memberId] = [];
  }
  byMember[memberId].push(agreement);
}

// Send one notification per member with all their expiring agreements
for (const [memberId, agreements] of Object.entries(byMember)) {
  await sendMemberNotification(memberId, agreements);
}
```

**Note:** You may need to add the `sendMemberNotification` function or adapt it based on your existing notification logic. The `agreementsTable` variable must also be defined in scope (import or as parameter).

**Verification:**

```bash
cd server/crons
node -c expiring-agreements-cron.js  # Syntax check
```

Then manually review the logic to ensure it groups correctly.

**Estimated Time:** 20 minutes

---

## Phase 5: Fix SkillInvoker Missing Tools (High-Severity Gap #4)

**Goal:** Add 10 missing tools to skillInvoker.js

**Why Fifth:** This affects agent capabilities; not blocking for launch since agents are disabled

**Files:**
- `server/mcp/skillInvoker.js`

### 5.1 Identify missing tools

First, compare `skillInvoker.js` with the tools registered in your MCP server config. The audit report indicates 10 of 22 tools are missing.

### 5.2 Add missing tool handlers

Open `server/mcp/skillInvoker.js`. For each missing tool, add a handler. For example, if `createLead` is missing, add:

```javascript
async function createLead(params) {
  const { leadData } = params;
  // Implementation
  await putDynamoDbItem(process.env.CRM_TABLE_NAME, leadData);
  return { success: true, leadId: leadData.id };
}
```

Add the tool to the `tools` object:

```javascript
const tools = {
  // ... existing tools
  createLead: {
    handler: createLead,
    description: 'Create a new lead in CRM',
    parameters: {
      type: 'object',
      properties: {
        leadData: { type: 'object' }
      },
      required: ['leadData']
    }
  },
  // ... add other missing tools
};
```

**Note:** This is a placeholder. The exact implementation depends on which tools are missing. You'll need to:

1. List all tools in your MCP server config
2. List all tools in `skillInvoker.js`
3. Identify the 10 missing ones
4. Implement each handler

**Verification:**

```bash
cd server/mcp
node -c skillInvoker.js  # Syntax check
```

Then count tools in `skillInvoker.js` vs MCP config. They should match.

**Estimated Time:** 60 minutes (depends on which tools are missing)

---

## Phase 6: Add Input Validation to SkillInvoker (High-Severity Gap #5)

**Goal:** Add input validation to prevent injection/invalid data

**Why Sixth:** Security and stability improvement

**Files:**
- `server/mcp/skillInvoker.js`

### 6.1 Add validation function

Add a validation utility at the top of `skillInvoker.js`:

```javascript
function validateToolInput(toolName, params, schema) {
  if (!schema || !schema.properties) return true;

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (schema.required?.includes(key) && params[key] === undefined) {
      throw new Error(`Missing required parameter: ${key}`);
    }

    if (params[key] !== undefined) {
      if (propSchema.type === 'string' && typeof params[key] !== 'string') {
        throw new Error(`Parameter ${key} must be a string`);
      }
      if (propSchema.type === 'number' && typeof params[key] !== 'number') {
        throw new Error(`Parameter ${key} must be a number`);
      }
      if (propSchema.type === 'array' && !Array.isArray(params[key])) {
        throw new Error(`Parameter ${key} must be an array`);
      }
      if (propSchema.type === 'boolean' && typeof params[key] !== 'boolean') {
        throw new Error(`Parameter ${key} must be a boolean`);
      }
    }
  }

  return true;
}

function sanitizeToolInput(params) {
  const sanitized = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
```

**Security note:** Do NOT use naive string replacement for "SQL injection prevention." Use parameterized queries for SQL, or use DynamoDB's ExpressionAttributeValues. The `trim()` only removes accidental whitespace.

### 6.2 Use validation in tool invocation

In your `invokeTool` function, add validation before calling the handler:

```javascript
async function invokeTool(toolName, params) {
  const tool = tools[toolName];
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Validate and sanitize input
  validateToolInput(toolName, params, tool.parameters);
  const sanitizedParams = sanitizeToolInput(params);

  // Call handler
  return await tool.handler(sanitizedParams);
}
```

**Note:** `validateToolInput` throws on invalid input; `sanitizeToolInput` returns a new object with trimmed strings. This prevents mutation of the original params object.

**Verification:**

```bash
cd server/mcp
node -c skillInvoker.js  # Syntax check
```

Then write a quick test to verify validation works (e.g., passing wrong type should throw error).

**Estimated Time:** 30 minutes

---

## Phase 7: Implement Missing Agent Features (High-Severity Gap #1)

**Goal:** Implement E6-T5 (Lead Qualification) and E6-T6 (Agreement Expiry) agent features

**Why Last:** These are v2 features; not blocking for launch since agents are disabled

**Files:**
- `server/mcp/skills/` (or wherever skills are defined)
- `agency-app/api/agents/` (agent runtime)

### 7.1 Implement Lead Qualification Skill (E6-T5)

Create or update the lead qualification skill. This should:

1. Read lead data from CRM
2. Apply qualification rules (score based on budget, timeline, source)
3. Update lead with qualification score
4. Trigger routing if qualified

Example skill implementation:

```javascript
// server/mcp/skills/lead-qualification.js
const { getDynamoDbItem, updateDynamoDbItem } = require('../utils/dynamoDb'); // Adjust path as needed

module.exports = {
  name: 'lead-qualification',
  description: 'Qualify leads based on criteria',
  parameters: {
    type: 'object',
    properties: {
      leadId: { type: 'string' }
    },
    required: ['leadId']
  },
  async execute({ leadId }) {
    const lead = await getDynamoDbItem(process.env.CRM_TABLE_NAME, { id: leadId });
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }
    const score = calculateQualificationScore(lead);
    await updateDynamoDbItem(process.env.CRM_TABLE_NAME, { id: leadId }, {
      qualificationScore: score,
      qualified: score > 70
    });
    return { leadId, score, qualified: score > 70 };
  }
};

function calculateQualificationScore(lead) {
  let score = 0;
  if (lead.budget > 5000000) score += 30;
  if (lead.timeline === 'immediate') score += 40;
  if (lead.source === 'referral') score += 20;
  if (lead.phone) score += 10;
  return score;
}
```

**Note:** This is a placeholder implementation. Replace `getDynamoDbItem`, `updateDynamoDbItem`, and the scoring logic with your actual DynamoDB helpers and business rules. The scoring thresholds (e.g., 5000000) should ideally be configurable via environment variables or a config table.

### 7.2 Implement Agreement Expiry Skill (E6-T6)

Create or update the agreement expiry skill. This should:

1. Find agreements expiring soon
2. Group by member (reuse logic from Phase 4)
3. Send notifications
4. Update agreement status

Example skill implementation:

```javascript
// server/mcp/skills/agreement-expiry.js
const { scanDynamoDb } = require('../utils/dynamoDb'); // Adjust path as needed
const AGREEMENTS_TABLE_NAME = process.env.AGREEMENTS_TABLE_NAME || 'cloudberry-real-estate-agreements';

module.exports = {
  name: 'agreement-expiry',
  description: 'Check for expiring agreements and notify members',
  parameters: {
    type: 'object',
    properties: {
      daysThreshold: { type: 'number', default: 30 }
    }
  },
  async execute({ daysThreshold = 30 }) {
    const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000).toISOString();
    const expiringFilter = {
      FilterExpression: 'expiryDate <= :threshold AND status = :active',
      ExpressionAttributeValues: {
        ':threshold': thresholdDate,
        ':active': 'active'
      }
    };
    const expiringAgreements = await scanDynamoDb(AGREEMENTS_TABLE_NAME, expiringFilter);

    // Group by member
    const byMember = {};
    for (const agreement of expiringAgreements) {
      const memberId = agreement.memberId || agreement.userId;
      if (!memberId) {
        console.warn('Agreement missing memberId:', agreement.id);
        continue;
      }
      if (!byMember[memberId]) byMember[memberId] = [];
      byMember[memberId].push(agreement);
    }

    // Notify each member
    const results = [];
    for (const [memberId, agreements] of Object.entries(byMember)) {
      await sendMemberNotification(memberId, agreements);
      results.push({ memberId, count: agreements.length });
    }

    return { processed: results.length, details: results };
  }
};
```

**Note:** This is a placeholder. Replace `scanDynamoDb` and `sendMemberNotification` with your actual implementations. The `AGREEMENTS_TABLE_NAME` should come from environment variables.

### 7.3 Register skills in agent runtime

Ensure these skills are registered in your agent runtime or MCP server config.

**Verification:**

```bash
cd server/mcp/skills
node -c lead-qualification.js
node -c agreement-expiry.js
```

Then test by invoking the skills through the agent runtime (if agents are enabled).

**Estimated Time:** 90 minutes

---

## Phase 8: End-to-End Testing & Deployment

**Goal:** Deploy all changes and verify the system works

**Why Last:** Test after all fixes are in place

**Steps:**

### 8.1 Validate all CloudFormation templates

```bash
cd agency-app/api/infra
aws cloudformation validate-template --template-body file://cfn-backend.yaml

cd ../cron
aws cloudformation validate-template --template-body file://trial-reminder.yaml
aws cloudformation validate-template --template-body file://escalate-openclaw.yaml
aws cloudformation validate-template --template-body file://lead-qualifier.yaml
aws cloudformation validate-template --template-body file://lead-followup.yaml
aws cloudformation validate-template --template-body file://lead-router.yaml
aws cloudformation validate-template --template-body file://whatsapp-processor.yaml
```

All should return without errors.

### 8.2 Deploy main stack

```bash
cd agency-app/api/infra
./deploy.sh
```

**Verify:**
- CloudFormation stack creates successfully
- All 8 parameters are passed (check CloudFormation console)
- No parameter errors

### 8.3 Deploy crons

```bash
cd cron
aws cloudformation deploy \
  --stack-name trial-reminder \
  --template-file trial-reminder.yaml \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    LambdaCodeS3Bucket=your-bucket \
    LambdaCodeS3Key=crons/trial-reminder.zip \
    CrmTableName=cloudberry-real-estate-crm \
    SesFromEmail=noreply@realestateflow.in \
    EmailProviderPrimary=ses

# Repeat for other crons, using the same --no-fail-on-empty-changeset flag
```

### 8.4 Test critical functionality

**Before testing:** Ensure test data exists in DynamoDB (or create it via API endpoints). For example:
- At least one test user with known credentials
- At least one test lead with `status: 'open'` and `lastActivity` more than 7 days ago
- At least one active agreement with `expiryDate` within 30 days

1. **Credits system:**
   - Create a test user
   - Add credits via API
   - Consume credits via API
   - Verify atomic deduction (no race conditions)

2. **Email system:**
   - Trigger trial reminder (manually invoke Lambda)
   - Verify email is sent via SES
   - Check SES console for delivery

3. **Webhooks:**
   - Send test Razorpay webhook
   - Verify HMAC validation passes
   - Check credit addition works

4. **Lead management:**
   - Create lead via API
   - Verify lead appears in CRM
   - Update lead status
   - Verify update persists

5. **Escalation cron:**
   - Manually invoke escalation Lambda
   - Verify it processes open leads >7 days
   - Check email is sent

**Estimated Time:** 2 hours

---

## Phase 9: External Configuration (Manual)

**Goal:** Configure external services (SES, Razorpay, Bailey)

**Why Last:** These are vendor-specific and cannot be automated via code

**Steps:**

### 9.1 SES Configuration

1. Go to AWS Console → SES → Verified Identities
2. Add domain: `realestateflow.in`
3. Enable "Easy DKIM" (recommended) or provide a custom MAIL FROM domain
4. Add these DNS records to your DNS provider (Route 53 / Cloudflare):
   - **TXT record for domain verification** (Value shown in SES console, e.g., `_amazonses.example.com`):
     Name: `_amazonses.realestateflow.in`
     Value: `<token-from-ses-console>`
   - **CNAME records for DKIM** (3 records shown in SES console, e.g., `token1._domainkey.example.com`):
     Name: `token1._domainkey.realestateflow.in`
     Value: `token1.dkim.amazonses.com`
     Name: `token2._domainkey.realestateflow.in`
     Value: `token2.dkim.amazonses.com`
     Name: `token3._domainkey.realestateflow.in`
     Value: `token3.dkim.amazonses.com`
   - **MX record for custom MAIL FROM** (if enabled):
     Name: `mail.realestateflow.in`
     Value: `10 feedback-smtp.ap-south-1.amazonses.com`
   - **TXT record for SPF** (if custom MAIL FROM enabled):
     Name: `mail.realestateflow.in`
     Value: `"v=spf1 include:amazonses.com ~all"`
5. Wait 24-48 hours for verification
6. Request production access:
   - Use case: Transactional emails
   - Website URL: your actual site
   - Sample email: test@realestateflow.in
7. Wait for approval (usually 24 hours)

**Note:** AWS SES will show the exact record values in the console. Use those values, not the generic examples above.

### 9.2 Razorpay Configuration

1. Go to Razorpay Dashboard → Settings → API Keys
2. Generate webhook secret
3. Go to Settings → Webhooks
4. Add webhook URL: `https://api.realestateflow.in/api/billing/webhook`
5. Select events:
   - `payment.captured`
   - `subscription.activated`
   - `subscription.charged`
6. Save secret in `agency-app/api/.env` as `RAZORPAY_WEBHOOK_SECRET`

### 9.3 Bailey Configuration (Optional — Keep Disabled)

Only if you want to enable WhatsApp:

1. Sign up at Bailey.ai
2. Get API key and webhook secret
3. Configure webhook URL: `https://api.realestateflow.in/api/webhooks/whatsapp`
4. Add DNS records for WhatsApp Business API
5. Update `agency-app/api/.env`:
   - `BAILEY_ENABLED=true`
   - `BAILEY_API_KEY=your_key`
   - `BAILEY_WEBHOOK_SECRET=your_secret`

**Estimated Time:** 48-72 hours (mostly waiting for SES verification)

---

## Summary Checklist

Use this to track progress:

**Phase 1: Deployment Script**
- [x] Add 8 parameters to cfn-params.json heredoc
- [x] Add 8 parameters to PARAM_OVERRIDES array
- [x] Verify 8 env vars exist in `agency-app/api/.env`
- [ ] Set `DEPLOY_CFN=true` for first deployment (you must do this)
- [ ] Run `bash -n deploy.sh` syntax check
- [ ] **Note:** `set -euo pipefail` already present

**Phase 1A: Dependency Strategy**
- [ ] Choose option: Lambda layer, add back to package.json, or bundle separately
- [ ] Implement chosen option
- [ ] Verify dynamic imports work in Lambda

**Phase 1B: Cleanup**
- [ ] Delete `crmDynamodbService_nobom.js`
- [ ] Delete `function-*.zip` artifacts
- [ ] Delete `server/temp_folder_to_be_deleted_after_fixing/`
- [ ] Decide fate of `agency-app/api/infra/deploy-fixed.sh` (already gone)

**Phase 2: Critical Cron Issues**
- [ ] Fix escalation-cron.js syntax error
- [ ] Add SES config to trial-reminder.yaml
- [ ] Add SES config to escalate-openclaw.yaml
- [ ] Fix lead-qualifier.yaml (add Code, Role, Environment)
- [ ] Validate all templates

**Phase 3: Missing Cron Templates**
- [ ] Create lead-followup.yaml
- [ ] Create lead-router.yaml
- [ ] Create whatsapp-processor.yaml
- [ ] Validate all new templates

**Phase 4: Expiring Agreements**
- [ ] Update grouping logic to group by member
- [ ] Syntax check passes

**Phase 5: SkillInvoker Tools**
- [ ] Identify 10 missing tools
- [ ] Implement all 10 tool handlers
- [ ] Verify tool count matches MCP config

**Phase 6: Input Validation**
- [ ] Add validateToolInput function
- [ ] Add validation to invokeTool
- [ ] Test validation with invalid input

**Phase 7: Agent Features**
- [ ] Implement lead-qualification skill
- [ ] Implement agreement-expiry skill
- [ ] Register skills in agent runtime
- [ ] Syntax check passes

**Phase 8: Testing & Deployment**
- [ ] Validate all CFN templates
- [ ] Deploy main stack successfully
- [ ] Deploy all crons successfully
- [ ] Test credits system
- [ ] Test email system
- [ ] Test webhooks
- [ ] Test lead management
- [ ] Test escalation cron

**Phase 9: External Config**
- [ ] SES domain verification started
- [ ] SES production access requested
- [ ] Razorpay webhook configured
- [ ] Bailey configured (optional)

---

## Total Estimated Time

- **Phases 1, 1A, 1B (Deployment + Dependencies + Cleanup):** 1-2 hours
- **Phases 2-3 (Critical Cron Issues):** 1.25 hours
- **Phases 4-6 (High-Severity):** 2 hours
- **Phase 7 (Agent Features):** 1.5 hours
- **Phase 8 (Testing):** 2 hours
- **Phase 9 (External Config):** 48-72 hours (mostly waiting)

**Total Active Work:** ~8 hours  
**Total Calendar Time:** 3-4 days (including SES verification wait)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SES verification takes longer than expected | Start SES config immediately (Phase 9 can run in parallel) |
| CloudFormation deployment fails | Use `--no-fail-on-empty-changeset` for idempotent updates |
| Agent features are complex | Skip Phase 7 for initial launch; agents are disabled anyway |
| Runtime errors in crons | Enable CloudWatch Logs and monitor after deployment |
| Missing dynamic-import dependencies | Add packages back to package.json, use Lambda layers, or bundle separately (Phase 1A) |
| Direct Lambda update doesn't pick up new CFN params | Set `DEPLOY_CFN=true` for the first deployment after adding the 8 parameters |

---

**Generated:** 2026-06-20  
**Status:** Ready for implementation  
**Next Step:** Start Phase 1