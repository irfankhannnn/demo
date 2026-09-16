# Reality Flow Authentication Microservice

Authentication microservice for Reality Flow Real Estate CRM. Handles user onboarding, agency registration, member invites, and Cognito-based authentication (Google + Phone).

## Architecture

- **Runtime:** Node.js 18 + TypeScript + Express
- **Auth:** Amazon Cognito (Google IdP + Custom Auth for Phone OTP)
- **Database:** DynamoDB (UsersTable + AgencyConfigTable + OTP Table for Cognito triggers)
- **Deployment:** AWS Lambda via `@vendia/serverless-express` + API Gateway
- **IaC:** CloudFormation (`infra/cfn-backend.yaml`)

## Directory Structure

```
services/reality-flow-authentication/
├── infra/
│   ├── cfn-backend.yaml             # CloudFormation template
│   ├── deploy.sh                    # One-command deployment script
│   ├── cfn-params.sample.json       # Parameter template
│   └── cfn-params.json              # Generated (gitignored)
├── src/
│   ├── config/config.ts             # Zod-validated env config
│   ├── controllers/
│   │   ├── authController.ts        # Google auth + bootstrap logic
│   │   ├── inviteController.ts      # Invite management logic
│   │   └── phoneAuthCustomController.ts  # Phone auth (Custom Auth)
│   ├── middleware/
│   │   └── authMiddleware.ts        # Local dev JWT verification
│   ├── models/
│   │   ├── agencyConfigModel.ts     # AgencyConfig DynamoDB ops
│   │   ├── invitesModel.ts          # Invite DynamoDB ops
│   │   └── usersModel.ts           # User DynamoDB ops
│   ├── routes/
│   │   ├── auth.ts                  # Auth routes
│   │   ├── invites.ts               # Invite routes
│   │   └── phoneAuth.ts            # Phone auth routes
│   ├── utils/
│   │   ├── cognito.ts               # Cognito claims extraction
│   │   ├── http.ts                  # HTTP response helpers
│   │   └── phoneValidation.ts      # Indian phone number validation
│   ├── app.ts                       # Express app factory
│   ├── index.ts                     # Lambda entry point
│   └── local-server.ts             # Local dev server
├── .env                             # Environment config (gitignored)
├── sample.env                       # Environment template
├── package.json
├── tsconfig.json
└── .gitignore
```

## API Endpoints

### Phone Auth (Cognito Custom Auth — passwordless OTP)

| Method | Path                   | Auth     | Description                                           |
|--------|------------------------|----------|-------------------------------------------------------|
| POST   | `/auth/phone/start`    | Public   | Initiate OTP (Cognito sends SMS via trigger)          |
| POST   | `/auth/phone/confirm`  | Public   | Verify OTP → tokens + `existingUser`/`needsOnboarding`|
| POST   | `/auth/phone/onboard`  | Bearer   | Register new user (admin or invited member)           |

#### Phone Auth Flow

```
1. Client → POST /auth/phone/start   { phoneNumber }
   ← { session, expiresIn: 300 }

2. Client → POST /auth/phone/confirm  { phoneNumber, otp, session }
   ← existingUser: true  → go to dashboard
   ← needsOnboarding: true → show onboarding UI

3. (If needsOnboarding)
   Client → POST /auth/phone/onboard  { displayName, role, agencyName? }
   Authorization: Bearer <accessToken>
   ← user + agency info
```

### Auth (Google + general — behind Cognito authorizer in prod)

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

## `/auth/phone/confirm` Response Contract

```json
// Existing user (go to dashboard)
{
  "message": "Login successful",
  "tokens": { "idToken": "...", "accessToken": "...", "refreshToken": "..." },
  "user": {
    "sub": "abc-123",
    "phoneNumber": "+919876543210",
    "displayName": "John",
    "role": "ADMIN",
    "tenantId": "abc-123",
    "status": "ACTIVE"
  },
  "agency": { "agencyName": "My Agency", "status": "ACTIVE" },
  "existingUser": true,
  "newUser": false,
  "needsOnboarding": false
}

// New user (show onboarding UI)
{
  "message": "Phone verified successfully",
  "tokens": { "idToken": "...", "accessToken": "...", "refreshToken": "..." },
  "user": { "sub": "xyz-789", "phoneNumber": "+919876543210" },
  "existingUser": false,
  "newUser": true,
  "needsOnboarding": true
}
```

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

### OTP Table (PK: PhoneNumber, SK: SK) — managed by Cognito triggers

- Used by CreateAuthChallenge and VerifyAuthChallenge Lambda triggers
- Express app does NOT access this table directly

## Key Design Decisions

- **Single phone auth flow:** Cognito Custom Auth only (no legacy OTP)
- **TenantId = Cognito Sub** of the admin — no extra lookup needed
- **Separate tables** for agency config vs users/invites
- **GSIs** for efficient cross-tenant lookups (find user by sub, find invites by email)
- **RBAC-ready** — user records carry `role` field, expandable later
- **OTP managed by Cognito:** OTP generation, storage, and verification are handled by Cognito Lambda triggers — not by the Express app
