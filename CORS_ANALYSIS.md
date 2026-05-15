# CORS Issue Analysis - Cloudberry Real Estate CRM

**Issue**: Login fails with CORS error at http://localhost:8086/

**Root Cause**: Frontend API URL points to production cloud API while frontend runs locally

---

## 1. THE PROBLEM

Your frontend at `http://localhost:8086/` is configured to make API requests to:
```
https://services-api.cloudberrysolutions.in/devrealestatecrm/api
```

This is a **cross-origin request**:
- **Frontend Origin**: `http://localhost:8086` (local dev)
- **API Origin**: `https://services-api.cloudberrysolutions.in` (production cloud)
- **Protocol Difference**: `http://` vs `https://` (different schemes)
- **Domain Difference**: `localhost` vs `cloudberrysolutions.in`

### Browser Error Flow
1. Frontend sends `POST http://localhost:8086/login`
2. JavaScript makes `POST https://services-api.cloudberrysolutions.in/devrealestatecrm/api/auth/login`
3. Browser sends **OPTIONS preflight request** first
4. API Gateway CORS headers returned, but there may be a mismatch in how they're configured
5. Login POST fails because preflight validation issues or because the cloud API isn't properly CORS-configured for `localhost`

---

## 2. CONFIGURATION ANALYSIS

### ✅ Backend CORS Configuration (Correct)

**File**: `server/server.js` (Lines 38-45)
```javascript
app.use(cors({
  origin: '*',                    // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-tenant-id'],
  credentials: false,
  maxAge: 86400
}));
```

**File**: `server/lambda-handler.js` (Lines 6-11)
```javascript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
  'Access-Control-Max-Age': '86400'
};
```

✅ **Status**: Backend allows all origins with `origin: '*'`

### ✅ API Gateway CORS Configuration (Correct)

**File**: `server/cfn-template.yaml` (Lines 798-810)
```yaml
PublicApiGatewayResponseDefault4XX:
  Type: AWS::ApiGateway::GatewayResponse
  Properties:
    ResponseParameters:
      gatewayresponse.header.Access-Control-Allow-Origin: "'*'"
      gatewayresponse.header.Access-Control-Allow-Headers: "'Content-Type,Authorization,X-Requested-With,x-tenant-id'"
      gatewayresponse.header.Access-Control-Allow-Methods: "'GET,POST,PUT,DELETE,OPTIONS,PATCH'"
```

**File**: `server/cfn/nested/apigw-explicit-routes.yaml` (Lines 41-64)
- OPTIONS methods explicitly configured on `/auth` endpoint for CORS preflight
- Response parameters properly set for all CORS headers

✅ **Status**: API Gateway properly configured for CORS

### ❌ Frontend API Configuration (WRONG)

**File**: `real-estate-crm-app/.env` (Lines 5-6)
```env
VITE_API_URL=https://services-api.cloudberrysolutions.in/devrealestatecrm/api
VITE_API_BASE_URL=https://services-api.cloudberrysolutions.in/devrealestatecrm/api
```

**Commented Options** (Lines 7-8):
```env
#VITE_API_URL=http://localhost:3001/api
#VITE_API_BASE_URL=http://localhost:3001/api
```

❌ **Status**: Frontend points to production API instead of local backend

**File**: `real-estate-crm-app/src/services/api.ts` (Line 11)
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
```

---

## 3. WHY CORS FAILS IN THIS SCENARIO

1. **Same-Origin Policy**: Browsers block scripts from one origin accessing another origin's APIs unless CORS headers are present
2. **Preflight Check**: Browser sends OPTIONS before POST to `/auth/login`
3. **Potential Issues**:
   - ✅ Backend allows `*` origin (correct)
   - ✅ API Gateway configured with CORS headers (correct)
   - ❌ **BUT**: The `services-api.cloudberrysolutions.in` might not recognize `localhost:8086` as a trusted client if it has additional restrictions
   - ❌ **OR**: Network/firewall issues blocking localhost from reaching production domain
   - ❌ **OR**: The production API might have stricter CORS than dev environment

---

## 4. ROOT CAUSE SUMMARY

| Component | Status | Issue |
|-----------|--------|-------|
| Local Frontend | Running on `http://localhost:8086` | ✅ OK |
| Backend CORS Headers | `origin: '*'` | ✅ Correct |
| API Gateway CORS | Explicit OPTIONS methods | ✅ Correct |
| Frontend API URL | Points to `https://services-api.cloudberrysolutions.in` | ❌ **WRONG FOR LOCAL DEV** |
| Network Path | localhost → production cloud | ❌ Cross-origin + HTTPS/HTTP mix |

---

## 5. SOLUTIONS

### **OPTION A: Use Local Backend (RECOMMENDED FOR LOCAL DEV)**

**Steps**:
1. Start your backend locally:
   ```bash
   cd server
   npm install
   npm start  # Runs on http://localhost:3001
   ```

2. Update `.env` in `real-estate-crm-app/`:
   ```env
   # Change these lines:
   VITE_API_URL=http://localhost:3001/api
   VITE_API_BASE_URL=http://localhost:3001/api
   ```

3. Restart frontend dev server (Vite):
   ```bash
   cd real-estate-crm-app
   npm run dev  # Runs on http://localhost:8086
   ```

4. Try login with `admin` / `admin123098`

**Why this works**:
- Same origin: `http://localhost` (frontend) → `http://localhost` (backend)
- No cross-origin request = no CORS needed
- Fastest local development cycle

### **OPTION B: Keep Production API URL (Current Setup)**

If you must use the production API:

1. **Verify the cloud API is accessible**:
   ```bash
   curl -X OPTIONS https://services-api.cloudberrysolutions.in/devrealestatecrm/api/auth/login \
     -H "Origin: http://localhost:8086" \
     -H "Access-Control-Request-Method: POST" \
     -v
   ```

2. **Check for errors**:
   - Look for `Access-Control-Allow-Origin` header in response
   - Should return `200 OK` with CORS headers
   - If `403 Forbidden` or timeout, the production API isn't reachable from your network

3. **Potential issues**:
   - Network/firewall blocking localhost
   - Production API has restricted CORS (more specific than `*`)
   - API Gateway deployment hasn't been pushed to prod
   - SSL/TLS certificate issues with `https://`

---

## 6. DEPLOYMENT SCRIPT ANALYSIS

**File**: `server/deploy-lambda.ps1`

### Key Findings:

**Line 26-32** - API Domain Configuration:
```powershell
[string]$PublicApiDomainName = "services-api.cloudberrysolutions.in",
[string]$PublicApiBasePath = "devrealestateagency",
[string]$PublicApiStageName = "dev",

[string]$CrmApiDomainName = "services-api.cloudberrysolutions.in",
[string]$CrmApiBasePath = "devrealestatecrm",
[string]$CrmApiStageName = "dev",
```

✅ **Correct**: Deployment points to correct domain and stage

**Line 116-127** - Explicit Routes Upload:
```powershell
$explicitRoutesTemplatePath = Join-Path -Path $scriptDir -ChildPath "cfn\nested\apigw-explicit-routes.yaml"
aws s3 cp $explicitRoutesTemplatePath "s3://$ArtifactBucket/$routesTemplateKey"
$explicitRoutesTemplateUrl = "https://s3.$Region.amazonaws.com/$ArtifactBucket/$routesTemplateKey"
```

✅ **Correct**: Uploads `apigw-explicit-routes.yaml` with explicit CORS routes

**Line 163-171** - CloudFormation Deploy:
```powershell
aws cloudformation deploy `
  --region $Region `
  --stack-name $StackName `
  --template-file $templateFile `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides $parameterOverrides
```

✅ **Correct**: Deploys full CFN stack with nested templates

---

## 7. VERIFICATION CHECKLIST

- [ ] **Is backend running locally?** `curl http://localhost:3001/api/health`
  - Should return: `{ "status": "ok", "message": "Server is running" }`

- [ ] **Is JWT_SECRET env var set?** `echo $env:JWT_SECRET` (PowerShell)
  - Backend needs this to sign JWT tokens

- [ ] **Is DynamoDB local/AWS accessible?** Backend can read admin user `admin/admin123098`
  - Check CloudFormation DynamoDB table creation logs

- [ ] **Are frontend + backend using same origin?**
  - Frontend: `http://localhost:8086`
  - Backend: `http://localhost:3001`
  - ✅ Same protocol (`http://`), same host (`localhost`)

---

## 8. BROWSER DEVELOPER TOOLS CHECKLIST

When testing, open **Chrome DevTools** → **Network** tab:

1. **Click Login button**
2. **Look for POST request** to `/auth/login`
3. **Check response headers**:
   - Should see `Access-Control-Allow-Origin: *` (or origin-specific value)
   - Should see `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS,PATCH`
   - Should see `Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With,x-tenant-id`

4. **Check for preflight OPTIONS**:
   - Before POST, there should be OPTIONS request
   - It should return `200 OK` with CORS headers
   - If OPTIONS fails, the login POST won't even be sent

---

## RECOMMENDED IMMEDIATE ACTION

1. **Enable local backend in `.env`:**
   ```env
   VITE_API_URL=http://localhost:3001/api
   VITE_API_BASE_URL=http://localhost:3001/api
   ```

2. **Start backend:**
   ```bash
   cd server && npm run dev
   ```

3. **Restart frontend dev server:**
   ```bash
   cd real-estate-crm-app && npm run dev
   ```

4. **Test login:**
   - Username: `admin`
   - Password: `admin123098`

This should resolve CORS issues immediately since both run on `http://localhost` origin.

---

## NOTES FOR PRODUCTION

The CloudFormation and deployment scripts are correctly configured for production deployment to AWS. The CORS headers are properly set in:
- ✅ `server.js` - Express CORS middleware
- ✅ `lambda-handler.js` - Lambda-specific CORS headers
- ✅ `cfn-template.yaml` - API Gateway Gateway Responses
- ✅ `apigw-explicit-routes.yaml` - Explicit route CORS OPTIONS methods

No changes needed for production deployment. The issue is purely a **local development configuration issue**.
