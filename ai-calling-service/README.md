# AI Calling Service

Multi-tenant AI voice calling agent for Real Estate CRM. Integrates with Exotel (India telephony) and ElevenLabs (AI voice).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CRM Frontend                             │
│                  (AI Calling Module)                        │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│  CRM Lambda (Existing)   │◄───►│  AI Calling Lambda (NEW) │
│  - Lead/Property Data    │     │  - Call Orchestration    │
│  - Site Visit Scheduling │     │  - Intent Detection      │
└──────────────────────────┘     └──────────────────────────┘
                                              │
              ┌───────────────────────────────┤
              ▼                   ▼           ▼
       ┌────────────┐      ┌──────────┐  ┌────────────┐
       │  Bedrock   │      │ Exotel   │  │ ElevenLabs │
       │ Knowledge  │      │  (Voice) │  │   (AI)     │
       │    Base    │      └──────────┘  └────────────┘
       └────────────┘
```

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Deploy Infrastructure

```bash
# Package Lambda
npm run package

# Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file cfn-template.yaml \
  --stack-name ai-calling-service \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    EnvironmentName=dev \
    AICallingKnowledgeBucket=your-unique-bucket-name \
    LambdaCodeS3Bucket=your-deployment-bucket \
    LambdaCodeS3Key=ai-calling-service.zip \
    CrmInternalApiUrl=https://your-crm-api.execute-api.ap-south-1.amazonaws.com/prod \
    CrmInternalApiKey=your-api-key \
    ExotelApiKey=your-exotel-key \
    ExotelApiToken=your-exotel-token \
    ExotelSid=your-exotel-sid \
    ElevenLabsApiKey=your-elevenlabs-key
```

## API Endpoints

### Calls

- `POST /api/ai-calling/calls/start` - Start AI call
- `GET /api/ai-calling/calls/:id/status` - Get call status
- `GET /api/ai-calling/calls/:id/transcript` - Get call transcript
- `POST /api/ai-calling/calls/:id/end` - End call
- `GET /api/ai-calling/calls` - List calls
- `GET /api/ai-calling/calls/metrics/summary` - Get metrics

### Knowledge

- `POST /api/ai-calling/knowledge/upload-url` - Get presigned upload URL
- `POST /api/ai-calling/knowledge/:id/confirm` - Confirm upload
- `GET /api/ai-calling/knowledge` - List documents
- `DELETE /api/ai-calling/knowledge/:id` - Delete document

### Config

- `GET /api/ai-calling/config/agent` - Get agent config
- `PUT /api/ai-calling/config/agent` - Save agent config

### Webhooks

- `POST /webhooks/exotel/status` - Exotel call status webhook
- `POST /webhooks/elevenlabs/intent` - ElevenLabs intent webhook

## Call Flow

1. **CRM triggers call** → `POST /api/ai-calling/calls/start`
2. **System creates session** → DynamoDB record created
3. **Exotel initiates call** → Customer phone rings
4. **Call connects** → ElevenLabs AI speaks greeting
5. **Customer speaks** → ElevenLabs transcribes
6. **Intent detected** → Lambda fetches data from CRM
7. **AI responds** → Data injected into conversation
8. **Call ends** → Transcript stored, CRM updated

## Multi-Tenant Isolation

- All data isolated by `tenant_id`
- S3 paths: `/{tenant_id}/{category}/`
- DynamoDB: `TENANT#{tenant_id}#...` prefix
- Vector DB: Metadata filtering by `tenant_id`
