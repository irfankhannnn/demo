# CORS Fix for Production API Testing

**Goal**: Use deployed API at `https://services-api.cloudberrysolutions.in/devrealestatecrm/api` with CORS support for:
- ✅ `http://localhost:8086` (local dev)
- ✅ `https://realestateflow.in` (production domain)

---

## Problem Analysis

Your CloudFormation deployment is correct, BUT there's a **critical CORS configuration gap** in the method responses.

### What's Configured ✅
- Express CORS middleware: `origin: '*'`
- Lambda handler adds CORS headers to responses
- API Gateway Gateway Responses: CORS headers for 4XX/5XX
- OPTIONS methods: Preflight handling configured

### What's Missing ❌
- **Method Responses** on actual POST/GET/PUT/DELETE methods don't include CORS header mappings
- API Gateway doesn't know to pass through Lambda's CORS headers to the client
- The AWS_PROXY integration needs explicit response configuration

---

## Root Cause

In `server/cfn/nested/apigw-explicit-routes.yaml`, the POST methods like `AuthLoginMethod` are missing `MethodResponses` with CORS header declarations:

**Currently:**
```yaml
AuthLoginMethod:
  Type: AWS::ApiGateway::Method
  Properties:
    HttpMethod: POST
    Integration:
      Type: AWS_PROXY  # Lambda handles response
    # ❌ NO MethodResponses defined
```

**Should be:**
```yaml
AuthLoginMethod:
  Type: AWS::ApiGateway::Method
  Properties:
    HttpMethod: POST
    Integration:
      Type: AWS_PROXY
    MethodResponses:  # ✅ ADD THIS
      - StatusCode: 200
        ResponseParameters:
          method.response.header.Access-Control-Allow-Headers: true
          method.response.header.Access-Control-Allow-Methods: true
          method.response.header.Access-Control-Allow-Origin: true
```

**Why**: Without `MethodResponses`, API Gateway doesn't know that your Lambda response includes CORS headers, so it strips them out or doesn't pass them through.

---

## Solution: Update CloudFormation Template

You need to add `MethodResponses` to ALL POST/GET/PUT/DELETE methods in the nested template.

### Step 1: Backup Current Template
```bash
cd server/cfn/nested
cp apigw-explicit-routes.yaml apigw-explicit-routes.yaml.backup
```

### Step 2: Add CORS Response Configuration

The nested template needs modification in ALL HTTP method definitions (POST, GET, PUT, DELETE). Here's the pattern to add after each method's Integration block:

```yaml
MethodResponses:
  - StatusCode: 200
    ResponseParameters:
      method.response.header.Access-Control-Allow-Origin: true
      method.response.header.Access-Control-Allow-Headers: true
      method.response.header.Access-Control-Allow-Methods: true
  - StatusCode: 201
    ResponseParameters:
      method.response.header.Access-Control-Allow-Origin: true
      method.response.header.Access-Control-Allow-Headers: true
      method.response.header.Access-Control-Allow-Methods: true
  - StatusCode: 400
    ResponseParameters:
      method.response.header.Access-Control-Allow-Origin: true
      method.response.header.Access-Control-Allow-Headers: true
      method.response.header.Access-Control-Allow-Methods: true
  - StatusCode: 401
    ResponseParameters:
      method.response.header.Access-Control-Allow-Origin: true
      method.response.header.Access-Control-Allow-Headers: true
      method.response.header.Access-Control-Allow-Methods: true
  - StatusCode: 403
    ResponseParameters:
      method.response.header.Access-Control-Allow-Origin: true
      method.response.header.Access-Control-Allow-Headers: true
      method.response.header.Access-Control-Allow-Methods: true
  - StatusCode: 404
    ResponseParameters:
      method.response.header.Access-Control-Allow-Origin: true
      method.response.header.Access-Control-Allow-Headers: true
      method.response.header.Access-Control-Allow-Methods: true
  - StatusCode: 500
    ResponseParameters:
      method.response.header.Access-Control-Allow-Origin: true
      method.response.header.Access-Control-Allow-Headers: true
      method.response.header.Access-Control-Allow-Methods: true
```

### Step 3: Update Methods That Need CORS Headers

For each method (POST, GET, PUT, DELETE), add the above `MethodResponses` block.

**Example for `/auth/login` POST:**
```yaml
AuthLoginMethod:
  Type: AWS::ApiGateway::Method
  Properties:
    RestApiId: !Ref RestApiId
    ResourceId: !Ref AuthLoginResource
    HttpMethod: POST
    AuthorizationType: NONE
    Integration:
      Type: AWS_PROXY
      IntegrationHttpMethod: POST
      Uri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${LambdaFunctionArn}/invocations"
    MethodResponses:  # ✅ ADD THIS BLOCK
      - StatusCode: 200
        ResponseParameters:
          method.response.header.Access-Control-Allow-Origin: true
          method.response.header.Access-Control-Allow-Headers: true
          method.response.header.Access-Control-Allow-Methods: true
      - StatusCode: 201
        ResponseParameters:
          method.response.header.Access-Control-Allow-Origin: true
          method.response.header.Access-Control-Allow-Headers: true
          method.response.header.Access-Control-Allow-Methods: true
      - StatusCode: 400
        ResponseParameters:
          method.response.header.Access-Control-Allow-Origin: true
          method.response.header.Access-Control-Allow-Headers: true
          method.response.header.Access-Control-Allow-Methods: true
      - StatusCode: 401
        ResponseParameters:
          method.response.header.Access-Control-Allow-Origin: true
          method.response.header.Access-Control-Allow-Headers: true
          method.response.header.Access-Control-Allow-Methods: true
      - StatusCode: 403
        ResponseParameters:
          method.response.header.Access-Control-Allow-Origin: true
          method.response.header.Access-Control-Allow-Headers: true
          method.response.header.Access-Control-Allow-Methods: true
      - StatusCode: 404
        ResponseParameters:
          method.response.header.Access-Control-Allow-Origin: true
          method.response.header.Access-Control-Allow-Headers: true
          method.response.header.Access-Control-Allow-Methods: true
      - StatusCode: 500
        ResponseParameters:
          method.response.header.Access-Control-Allow-Origin: true
          method.response.header.Access-Control-Allow-Headers: true
          method.response.header.Access-Control-Allow-Methods: true
```

### Step 4: (Optional) Add IntegrationResponses for AWS_PROXY

For better control, you can also add IntegrationResponses mapping:

```yaml
IntegrationResponses:
  - StatusCode: 200
    ResponseParameters:
      method.response.header.Access-Control-Allow-Origin: "'*'"
      method.response.header.Access-Control-Allow-Headers: "'Content-Type,Authorization,X-Requested-With,x-tenant-id'"
      method.response.header.Access-Control-Allow-Methods: "'GET,POST,PUT,DELETE,OPTIONS,PATCH'"
  - StatusCode: 201
    ResponseParameters:
      method.response.header.Access-Control-Allow-Origin: "'*'"
      method.response.header.Access-Control-Allow-Headers: "'Content-Type,Authorization,X-Requested-With,x-tenant-id'"
      method.response.header.Access-Control-Allow-Methods: "'GET,POST,PUT,DELETE,OPTIONS,PATCH'"
```

---

## Step 5: Update Frontend to Use Production API

Update `/real-estate-crm-app/.env`:

```env
# Point to production API
VITE_API_URL=https://services-api.cloudberrysolutions.in/devrealestatecrm/api
VITE_API_BASE_URL=https://services-api.cloudberrysolutions.in/devrealestatecrm/api

# Frontend still runs locally
VITE_PORT=8086
```

### Frontend Code Check

Verify `real-estate-crm-app/src/services/api.ts` includes credentials handling (Lines 42-43):

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
// No credentials needed since backend allows origin: '*'
```

The `credentials: false` in the backend CORS config (server.js line 43) means cookies are NOT sent, which is correct for `origin: '*'`.

---

## Step 6: Redeploy with Updated CFN

```powershell
# From server directory
./deploy-lambda.ps1

# Parameters to use (modify as needed):
# -EnvironmentName dev
# -PublicApiDomainName services-api.cloudberrysolutions.in
# -PublicApiBasePath devrealestatecrm
# -CrmApiDomainName services-api.cloudberrysolutions.in
# -CrmApiBasePath devrealestatecrm
```

---

## Step 7: Test CORS from Multiple Origins

### Test 1: From localhost:8086
```bash
# Start frontend
cd real-estate-crm-app
npm run dev

# Browser: http://localhost:8086
# Try login with admin/admin123098
# Open DevTools → Network tab → Check login POST request
# Should see CORS headers in response
```

### Test 2: From realestateflow.in (production)
```bash
# After deploying frontend to realestateflow.in
# Test login from https://realestateflow.in
# Should work without CORS errors
```

### Test 3: Manual CORS Check
```bash
# Test OPTIONS preflight
curl -X OPTIONS https://services-api.cloudberrysolutions.in/devrealestatecrm/api/auth/login \
  -H "Origin: http://localhost:8086" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v

# Should return 200 with CORS headers:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS,PATCH
# Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With,x-tenant-id
```

### Test 4: Actual Login Request
```bash
curl -X POST https://services-api.cloudberrysolutions.in/devrealestatecrm/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8086" \
  -d '{"username":"admin","password":"admin123098"}' \
  -v

# Should return 200 with token AND CORS headers
```

---

## Why This Works

1. **OPTIONS Preflight** → MOCK integration returns CORS headers immediately ✅
2. **POST/GET/PUT/DELETE** → AWS_PROXY Lambda runs your code
3. **Lambda Response** → lambda-handler.js adds CORS headers to response body
4. **API Gateway** → With `MethodResponses` configured, API Gateway allows these headers through
5. **Browser** → Receives CORS headers, allows request from `localhost` or `realestateflow.in`

---

## Additional Configuration: Restrict Origins (Optional)

If you want to restrict CORS to specific origins instead of `*`:

**In `server.js`:**
```javascript
app.use(cors({
  origin: ['http://localhost:8086', 'https://realestateflow.in', 'https://www.realestateflow.in'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-tenant-id'],
  credentials: false,
  maxAge: 86400
}));
```

**In `lambda-handler.js`:**
```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:8086',
  'https://realestateflow.in',
  'https://www.realestateflow.in'
];

const origin = event.headers.Origin || event.headers.origin || '*';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
  'Access-Control-Max-Age': '86400'
};
```

---

## Verification Checklist

- [ ] Updated `apigw-explicit-routes.yaml` with `MethodResponses` on all POST/GET/PUT/DELETE methods
- [ ] Deployed CloudFormation with `deploy-lambda.ps1`
- [ ] Updated frontend `.env` to use `https://services-api.cloudberrysolutions.in/devrealestatecrm/api`
- [ ] Tested OPTIONS preflight request returns CORS headers
- [ ] Tested POST login from localhost returns CORS headers
- [ ] Tested login works on localhost:8086
- [ ] Tested login works on realestateflow.in (after frontend deployment)
- [ ] DevTools Network tab shows `Access-Control-Allow-Origin` in response headers

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Still getting CORS error | Check browser console for exact error. Run curl test above. Verify `MethodResponses` added to ALL methods. |
| Login works but says "Invalid credentials" | Check backend JWT_SECRET env var. Check DynamoDB admin user exists. |
| API returns 403 Forbidden | Check IAM role has DynamoDB permissions. Check Lambda has permission to invoke. |
| Preflight returns 404 | Verify OPTIONS methods are deployed. Run `aws apigateway get-resources`. |
| CORS headers in OPTIONS but not POST | This means `MethodResponses` aren't configured on POST method. |

---

## Quick Reference: File Changes

| File | Change | Status |
|------|--------|--------|
| `server/cfn/nested/apigw-explicit-routes.yaml` | Add `MethodResponses` to all methods | ❌ TODO |
| `real-estate-crm-app/.env` | Change to production API URL | ✅ Ready |
| `server/deploy-lambda.ps1` | No changes needed | ✅ OK |
| `server/cfn-template.yaml` | No changes needed | ✅ OK |
| `server/server.js` | Already has correct CORS | ✅ OK |
| `server/lambda-handler.js` | Already adds CORS headers | ✅ OK |
