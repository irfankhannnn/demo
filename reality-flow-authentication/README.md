# Reality Flow Authentication Microservice

Authentication microservice for Reality Flow Real Estate CRM. Handles user onboarding, agency registration, member invites, and Cognito-based authentication (Google + Phone).

## Architecture

- **Runtime:** Node.js 18 + TypeScript + Express
- **Auth:** Amazon Cognito (Google IdP + Phone OTP)
- **Database:** DynamoDB (UsersTable + AgencyConfigTable)
- **Deployment:** AWS Lambda via `@vendia/serverless-express` + API Gateway
- **IaC:** CloudFormation (`infra/cfn-backend.yaml`)

## Directory Structure

```
reality-flow-authentication/
├── infra/
│   ├── cfn-backend.yaml          # CloudFormation template
│   ├── deploy.sh                 # One-command deployment script
│   ├── cfn-params.sample.json    # Parameter template
│   └── cfn-params.json           # Generated (gitignored)
├── src/
│   ├── config/config.ts          # Zod-validated env config
│   ├── controllers/
│   │   ├── authController.ts     # Auth endpoint logic
│   │   └── inviteController.ts   # Invite management logic
│   ├── middleware/
│   │   └── authMiddleware.ts     # Local dev JWT verification
│   ├── models/
│   │   ├── agencyConfigModel.ts  # AgencyConfig DynamoDB ops
│   │   ├── invitesModel.ts       # Invite DynamoDB ops
│   │   └── usersModel.ts         # User DynamoDB ops
│   ├── routes/
│   │   ├── auth.ts               # Auth routes
│   │   └── invites.ts            # Invite routes
│   ├── utils/
│   │   ├── cognito.ts            # Cognito claims extraction
│   │   └── http.ts               # HTTP response helpers
│   ├── app.ts                    # Express app factory
│   ├── index.ts                  # Lambda entry point
│   └── local-server.ts           # Local dev server
├── .env                          # Environment config (gitignored)
├── sample.env                    # Environment template
├── package.json
├── tsconfig.json
└── .gitignore
```

## API Endpoints

### Auth (all behind Cognito authorizer in prod)

| Method | Path                  | Description                          |
|--------|-----------------------|--------------------------------------|
| POST   | `/auth/bootstrap`     | Check if user exists, return status  |
| POST   | `/auth/register-admin`| Register as admin + create agency    |
| GET    | `/auth/check-invite`  | Check pending invites by email       |
| POST   | `/auth/accept-invite` | Accept invite, register as member    |
| GET    | `/auth/me`            | Get current user profile + agency    |

### Invites (admin only)

| Method | Path                            | Description          |
|--------|---------------------------------|----------------------|
| POST   | `/invites`                      | Create a new invite  |
| GET    | `/invites`                      | List all invites     |
| POST   | `/invites/:inviteCode/revoke`   | Revoke a pending invite |

### Health

| Method | Path      | Description       |
|--------|-----------|-------------------|
| GET    | `/health` | Health check (no auth) |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp sample.env .env
# Edit .env with your values

# 3. Build
npm run build

# 4. Run locally
npm run dev
```

## Deployment

```bash
# One-command deploy (requires AWS CLI configured)
chmod +x infra/deploy.sh
./infra/deploy.sh
```

The deploy script will:
1. Validate `.env` variables
2. Install dependencies and build TypeScript
3. Package `function.zip`
4. Upload to S3
5. Generate CloudFormation parameters
6. Deploy the CloudFormation stack
7. Print stack outputs

## DynamoDB Data Model

### UsersTable (PK: TenantId, SK: SK)

- **User items:** `SK = USER#<cognitoSub>`
- **Invite items:** `SK = INVITE#<inviteCode>`
- **GSIs:** SubIndex (lookup by Cognito sub), EmailIndex (lookup by email)

### AgencyConfigTable (PK: TenantId)

- One item per agency/tenant
- TenantId = Admin's Cognito `sub`

## Key Design Decisions

- **TenantId = Cognito Sub** of the admin — no extra lookup needed
- **Separate tables** for agency config vs users/invites
- **GSIs** for efficient cross-tenant lookups (find user by sub, find invites by email)
- **RBAC-ready** — user records carry `role` field, expandable later
