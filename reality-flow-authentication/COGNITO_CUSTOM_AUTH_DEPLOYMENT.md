# Cognito Custom Auth Phone OTP Deployment Guide

## Overview

This deployment migrates phone authentication from a flawed password-based approach to **Cognito Custom Authentication Flow** with native passwordless OTP via SMS.

## What Changed

### Infrastructure (CloudFormation)

1. **New DynamoDB Table**: `OtpTable` with TTL for secure OTP storage
2. **3 Lambda Trigger Functions**:
   - `DefineAuthChallengeLambda` - Determines auth flow logic
   - `CreateAuthChallengeLambda` - Generates & sends OTP via SNS, auto-creates users
   - `VerifyAuthChallengeResponseLambda` - Validates OTP with attempt limits
3. **IAM Role**: `CognitoTriggerLambdaRole` with SNS, DynamoDB, and Cognito permissions
4. **Cognito UserPoolV2 Updates**:
   - Added `LambdaConfig` with 3 trigger ARNs
   - Added `ALLOW_CUSTOM_AUTH` to ExplicitAuthFlows
5. **Lambda Permissions**: Cognito can invoke all 3 trigger Lambdas
6. **Environment Variables**: Added `COGNITO_USER_POOL_ID_V2` and `COGNITO_CLIENT_ID_V2` to main Lambda

### Backend Code

1. **New Controller**: `phoneAuthCustomController.ts`
   - `startPhoneAuthHandler` - Initiates Custom Auth (sends OTP)
   - `confirmPhoneAuthHandler` - Verifies OTP and returns tokens
2. **New Routes**:
   - `POST /auth/phone/start` - Replaces `/send-otp`
   - `POST /auth/phone/confirm` - Replaces `/verify-otp`
3. **Config Updates**:
   - Added `COGNITO_USER_POOL_ID_V2`, `COGNITO_CLIENT_ID_V2`, `OTP_TABLE` to env schema
4. **Local Dev**: Added new endpoints to public paths (no JWT required)

### Legacy Endpoints (Kept for Backward Compatibility)

- `/auth/phone/send-otp` - Still works but deprecated
- `/auth/phone/verify-otp` - Still works but deprecated
- `/auth/phone/resend-otp` - Still works but deprecated

---

## Pre-Deployment Checklist

### 1. Verify Environment Variables

Ensure your `.env` has these values:

```bash
# V1 Cognito (legacy)
COGNITO_USER_POOL_ID=ap-south-1_aMI3glrMg
COGNITO_CLIENT_ID=5frivo4vjmo0hrbu4s0rvpmlhu

# V2 Cognito (with Phone Custom Auth)
COGNITO_USER_POOL_ID_V2=ap-south-1_1i4etdXbU
COGNITO_CLIENT_ID_V2=68j3na27viclhk1r44sgj20uv

# DynamoDB
USERS_TABLE=dev-reality-flow-auth-users
AGENCY_CONFIG_TABLE=dev-reality-flow-auth-agency-config
OTP_TABLE=dev-reality-flow-auth-otp
```

### 2. Verify AWS Permissions

Ensure your AWS credentials have permissions for:
- CloudFormation stack updates
- Lambda function creation/updates
- Cognito User Pool updates
- DynamoDB table creation
- IAM role creation
- SNS publish (for SMS sending)

### 3. SNS SMS Spending Limit

⚠️ **IMPORTANT**: AWS SNS has SMS spending limits. Check:

```bash
aws sns get-sms-attributes --region ap-south-1
```

If needed, request limit increase or move to production tier.

---

## Deployment Steps

### Step 1: Build TypeScript

```bash
cd reality-flow-authentication
npm install
npm run build
```

**Expected**: Exit code 0, no TypeScript errors

### Step 2: Deploy CloudFormation Stack

```bash
cd infra
bash deploy.sh
```

This will:
1. Build and package your Lambda
2. Upload to S3
3. Deploy CloudFormation with all new resources
4. Wire Cognito triggers

**Expected Duration**: 5-10 minutes

### Step 3: Verify Deployment

Check CloudFormation outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name dev-reality-flow-auth \
  --region ap-south-1 \
  --query 'Stacks[0].Outputs'
```

Verify these new outputs exist:
- `OtpTableName`
- `OtpTableArn`

### Step 4: Verify Cognito Triggers

```bash
aws cognito-idp describe-user-pool \
  --user-pool-id ap-south-1_1i4etdXbU \
  --region ap-south-1 \
  --query 'UserPool.LambdaConfig'
```

**Expected**: Should show 3 Lambda ARNs for:
- `DefineAuthChallenge`
- `CreateAuthChallenge`
- `VerifyAuthChallengeResponse`

---

## Testing

### Local Testing (Recommended First)

1. **Start local server**:

```bash
npm run dev
```

2. **Test /start endpoint** (sends OTP):

```bash
curl -X POST http://localhost:3002/auth/phone/start \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+919876543210"
  }'
```

**Expected Response**:
```json
{
  "message": "OTP sent successfully",
  "session": "AYABe...",
  "challengeName": "CUSTOM_CHALLENGE",
  "expiresIn": 300
}
```

3. **Check your phone** for SMS with 6-digit OTP

4. **Test /confirm endpoint** (verify OTP):

```bash
curl -X POST http://localhost:3002/auth/phone/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+919876543210",
    "otp": "123456",
    "session": "<SESSION_FROM_START>"
  }'
```

**Expected Response**:
```json
{
  "message": "Phone verified successfully",
  "tokens": {
    "idToken": "eyJra...",
    "accessToken": "eyJra...",
    "refreshToken": "eyJra..."
  },
  "user": {
    "sub": "abc123...",
    "phoneNumber": "+919876543210",
    "phoneVerified": true
  }
}
```

### Production Testing

Use the custom-domain base URL from the stack's `AuthApiBaseUrlOutput` output (raw execute-api URLs are not used):

```bash
API_ENDPOINT="https://services-api.cloudberrysolutions.in/devrealestateauth"

# Start
curl -X POST $API_ENDPOINT/auth/phone/start \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210"}'

# Confirm
curl -X POST $API_ENDPOINT/auth/phone/confirm \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210", "otp": "123456", "session": "..."}'
```

---

## Monitoring & Debugging

### Check Lambda Logs

```bash
# DefineAuthChallenge
aws logs tail /aws/lambda/dev-reality-flow-auth-define-auth-challenge --follow

# CreateAuthChallenge
aws logs tail /aws/lambda/dev-reality-flow-auth-create-auth-challenge --follow

# VerifyAuthChallenge
aws logs tail /aws/lambda/dev-reality-flow-auth-verify-auth-challenge --follow
```

### Check DynamoDB OTP Table

```bash
aws dynamodb scan \
  --table-name dev-reality-flow-auth-otp \
  --region ap-south-1
```

**Note**: OTPs are hashed (SHA-256) and auto-expire after 5 minutes (TTL)

### Common Issues

#### 1. OTP not received
- Check SNS CloudWatch logs
- Verify phone number format: `+91XXXXXXXXXX`
- Check SNS spending limits

#### 2. "Invalid or expired OTP"
- OTP expires in 5 minutes
- Max 3 attempts per OTP
- Session expires after multiple failures

#### 3. "User not found" errors
- CreateAuthChallenge Lambda auto-creates users
- Check Lambda execution role has `cognito-idp:AdminCreateUser` permission

---

## Rollback Plan

If deployment fails or issues arise:

### Option 1: Quick Rollback (Keep Triggers, Disable Them)

1. **Temporarily disable triggers**:

```bash
aws cognito-idp update-user-pool \
  --user-pool-id ap-south-1_1i4etdXbU \
  --lambda-config '{}'
```

2. **Frontend continues using legacy endpoints** (`/send-otp`, `/verify-otp`)

### Option 2: Full Stack Rollback

```bash
# Revert to previous CloudFormation version
aws cloudformation update-stack \
  --stack-name dev-reality-flow-auth \
  --use-previous-template \
  --parameters <PREVIOUS_PARAMS>
```

---

## Migration Timeline

### Phase 1: Dual Mode (Current)
- Both old and new endpoints active
- Frontend can use either
- Monitor new endpoints for issues

### Phase 2: Gradual Migration (Next Week)
- Update frontend to use `/start` and `/confirm`
- Monitor error rates

### Phase 3: Deprecation (2 Weeks)
- Remove legacy endpoints
- Clean up old OTP model code

---

## Success Criteria

✅ TypeScript builds without errors  
✅ CloudFormation deployment succeeds  
✅ All 3 Cognito triggers attached  
✅ OTP DynamoDB table created with TTL  
✅ Local testing: OTP received via SMS  
✅ Local testing: OTP verification returns tokens  
✅ Production testing: End-to-end flow works  
✅ Legacy endpoints still functional  

---

## Additional Notes

### Security Improvements

1. **No more passwords**: Phone users never have passwords
2. **Hashed OTPs**: Stored as SHA-256 hashes in DynamoDB
3. **Attempt limiting**: Max 3 incorrect OTP attempts
4. **Auto-expiry**: OTPs deleted after 5 minutes via DynamoDB TTL
5. **Session-based**: Each OTP flow uses unique Cognito session

### Cost Impact

- **DynamoDB OTP Table**: PAY_PER_REQUEST (minimal cost for OTP storage)
- **Lambda Triggers**: 3 invocations per phone login (~0.001 seconds each)
- **SNS SMS**: ~$0.02 per SMS (check your region pricing)

### Next Steps After Deployment

1. Update frontend to call new endpoints
2. Monitor CloudWatch logs for errors
3. Track SMS delivery rates
4. Consider implementing rate limiting (e.g., max 3 OTPs per phone per hour)
5. Add user onboarding check after successful login (query DynamoDB UsersTable by `sub`)

---

## Questions or Issues?

Check CloudWatch Logs → Lambda → Filter by function name  
Review this document: `COGNITO_CUSTOM_AUTH_DEPLOYMENT.md`
