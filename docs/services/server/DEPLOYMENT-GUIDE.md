# API Gateway Deployment Guide

> **Security / tenant isolation:** see [`BACKEND_HARDENING.md`](BACKEND_HARDENING.md).
>
> **Call recording pipeline (SQS queue + worker Lambda):** see
> [`docs/CALL_INTELLIGENCE.md`](../../CALL_INTELLIGENCE.md). The worker ships
> in the same deployment package as the API Lambda, so a code-only deploy must
> update both — `deploy.sh` already does.

## Current Status

✅ **CloudFormation template is production-ready** with the following configurations:

### CORS Configuration
- Express + Lambda echo origins from `ALLOWED_ORIGINS` (never `*` with credentials)
- See `BACKEND_HARDENING.md` for the single source of truth (`utils/corsOrigins.js`)
- API Gateway MOCK OPTIONS use the nested stack `AllowOrigin` parameter

### API Gateway Structure
- **Public API** and **CRM API** both use `apigw-explicit-routes.yaml`
- Catch-all `/api/{proxy+}` plus explicit children where parents would block the proxy
  (`/api/health/deep`, `/api/admin/{proxy+}`)
- Auth is enforced in Express (JWT / API key / platform operator)
### Security
- IAM roles with least privilege
- Multi-tenancy via **server-derived tenantId** (JWT or API key) — see `BACKEND_HARDENING.md`
- JWT authentication for CRM endpoints
- Binary media types for file uploads (API Gateway REST body limit: 10 MB)

## Prerequisites

Before deploying, ensure you have:

1. **AWS CLI configured** with appropriate credentials
2. **S3 bucket** for Lambda deployment artifacts (specified in deploy script)
3. **Custom domain names** configured in AWS:
   - Public API: `services-api.cloudberrysolutions.in`
   - CRM API: `services-api.cloudberrysolutions.in`
4. **ACM certificates** for the custom domains
5. **API Gateway base path mappings** configured

## Deployment Steps

### 1. Review Configuration

Check the deployment script parameters in `deploy-lambda.ps1`:

```powershell
# Default parameters (lines 1-30)
$Region = "ap-south-1"
$StackName = "cloudberry-real-estate-agency"
$ArtifactBucket = "rewaro-cicd-artifacts"
$PublicApiDomainName = "services-api.cloudberrysolutions.in"
$PublicApiBasePath = "realestateagency"
$CrmApiDomainName = "services-api.cloudberrysolutions.in"
$CrmApiBasePath = "realestatecrm"
```

### 2. Deploy the Stack

From the `server` directory:

```powershell
cd c:\Users\qures\Downloads\nabi-app-git\happy-properties-bolt\server
.\deploy-lambda.ps1
```

The script will:
1. ✅ Create build directory
2. ✅ Copy backend source files
3. ✅ Install production dependencies
4. ✅ Create deployment ZIP
5. ✅ Upload to S3
6. ✅ Deploy CloudFormation stack
7. ✅ Force API Gateway redeployment

**Expected output**:
```
==> Preparing Lambda build directory
==> Copying backend source into build directory
==> Installing production dependencies
==> Creating deployment zip
==> Uploading artifact to s3://rewaro-cicd-artifacts/...
==> Deploying CloudFormation stack: cloudberry-real-estate-agency
Waiting for changeset to be created..
Waiting for stack create/update to complete
Successfully created/updated stack - cloudberry-real-estate-agency
==> Forcing API Gateway deployments
==> Package complete
```

### 3. Verify Deployment

After deployment, verify the APIs are working:

#### Test Public API

```bash
# Health check
curl -H "x-tenant-id: your-tenant-id" \
  https://services-api.cloudberrysolutions.in/realestateagency/api/health

# Expected response: {"status":"ok","message":"Server is running"}
```

#### Test CRM API (requires auth)

```bash
# Login first
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: your-tenant-id" \
  -d '{"username":"admin","password":"your-password"}' \
  https://services-api.cloudberrysolutions.in/realestatecrm/api/auth/login

# Use the returned token for authenticated requests
curl -H "x-tenant-id: your-tenant-id" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  https://services-api.cloudberrysolutions.in/realestatecrm/api/crm/metrics
```

### 4. Test CORS from Browser

Open browser console on your website and run:

```javascript
// Test OPTIONS preflight
fetch('https://services-api.cloudberrysolutions.in/realestateagency/api/health', {
  method: 'OPTIONS'
}).then(r => {
  console.log('Status:', r.status); // Should be 200
  console.log('CORS headers:', r.headers.get('access-control-allow-origin')); // Allowlisted origin, never *
});

// Test actual GET request
fetch('https://services-api.cloudberrysolutions.in/realestateagency/api/health', {
  headers: {
    'x-tenant-id': 'your-tenant-id'
  }
}).then(r => r.json()).then(console.log);
```

## Frontend Configuration

### Update Public Website .env

```env
VITE_API_URL=https://services-api.cloudberrysolutions.in/realestateagency/api
VITE_TENANT_ID=your-tenant-id
```

### Update CRM App .env

```env
VITE_API_URL=https://services-api.cloudberrysolutions.in/realestatecrm/api
VITE_TENANT_ID=your-tenant-id
```

### For Localhost Development

Both apps can use localhost during development:

```env
VITE_API_URL=http://localhost:3001/api
VITE_TENANT_ID=your-tenant-id
```

## Troubleshooting

### Issue: OPTIONS returns 500 "Unable to transform request"

**Cause**: Missing `PassthroughBehavior: WHEN_NO_MATCH` in OPTIONS integration

**Solution**: ✅ Already fixed in current template (lines 508, 545, 648, 685)

**Verify**: Check CloudFormation template has:
```yaml
Integration:
  Type: MOCK
  PassthroughBehavior: WHEN_NO_MATCH  # ← This line is critical
  RequestTemplates:
    application/json: '{"statusCode": 200}'
```

### Issue: CORS errors in browser

**Symptoms**:
- `Access-Control-Allow-Origin` header missing
- Preflight OPTIONS request fails
- Browser console shows CORS error

**Solutions**:

1. **Verify headers are being sent**:
   ```javascript
   // Check in browser DevTools Network tab
   // Request Headers should include:
   // - x-tenant-id: your-tenant-id
   // - Content-Type: application/json
   ```

2. **Check API Gateway deployment**:
   - Ensure the stack was deployed successfully
   - Verify API Gateway stage is deployed
   - Check CloudWatch logs for errors

3. **Verify base path mapping**:
   ```bash
   aws apigateway get-base-path-mappings \
     --domain-name services-api.cloudberrysolutions.in \
     --region ap-south-1
   ```

### Issue: 401 Unauthorized on CRM endpoints

**Cause**: Missing or invalid JWT token

**Solution**:
1. Login via `/api/auth/login` to get token
2. Include `Authorization: Bearer {token}` header in requests
3. Check token hasn't expired (tokens expire after session)

### Issue: Custom domain not resolving

**Cause**: DNS or API Gateway base path mapping issue

**Solution**:
1. Verify DNS points to API Gateway
2. Check ACM certificate is valid
3. Verify base path mappings exist:
   ```bash
   aws apigateway get-base-path-mappings \
     --domain-name services-api.cloudberrysolutions.in
   ```

### Issue: Lambda timeout or errors

**Check CloudWatch Logs**:
```bash
aws logs tail /aws/lambda/prod-real-estate-api --follow
```

**Common causes**:
- DynamoDB table doesn't exist
- IAM permissions missing
- S3 bucket not accessible
- Environment variables not set

## Monitoring

### CloudWatch Metrics to Monitor

1. **API Gateway**:
   - 4XXError count
   - 5XXError count
   - Latency (p50, p90, p99)
   - Request count

2. **Lambda**:
   - Invocation count
   - Error count
   - Duration
   - Throttles

3. **DynamoDB**:
   - ConsumedReadCapacityUnits
   - ConsumedWriteCapacityUnits
   - UserErrors
   - SystemErrors

### Set Up Alarms

```bash
# Example: Alert on 5XX errors
aws cloudwatch put-metric-alarm \
  --alarm-name api-gateway-5xx-errors \
  --alarm-description "Alert on API Gateway 5XX errors" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

## Rollback Procedure

If deployment fails or causes issues:

### 1. Rollback CloudFormation Stack

```bash
aws cloudformation cancel-update-stack \
  --stack-name cloudberry-real-estate-agency \
  --region ap-south-1
```

### 2. Redeploy Previous Version

```bash
# Find previous successful deployment
aws s3 ls s3://rewaro-cicd-artifacts/cloudberry-real-estate-agency/

# Update stack with previous artifact
aws cloudformation update-stack \
  --stack-name cloudberry-real-estate-agency \
  --template-body file://cfn-template.yaml \
  --parameters ParameterKey=LambdaCodeS3Key,ParameterValue=previous-version.zip \
  --capabilities CAPABILITY_NAMED_IAM
```

## Best Practices

### 1. Test Locally First

Always test changes locally before deploying:

```bash
cd server
npm start  # Runs on http://localhost:3001
```

### 2. Use Staging Environment

Consider creating a staging stack:

```powershell
.\deploy-lambda.ps1 `
  -StackName cloudberry-real-estate-agency-staging `
  -EnvironmentName staging `
  -PublicApiDomainName staging-api.cloudberrysolutions.in
```

### 3. Version Your Deployments

The deployment script automatically versions artifacts with timestamps:
```
build-lambda-20251228084003.zip
```

Keep track of successful versions for easy rollback.

### 4. Monitor After Deployment

Watch CloudWatch logs for 15-30 minutes after deployment:

```bash
aws logs tail /aws/lambda/prod-real-estate-api --follow
```

### 5. Update Frontend After Backend

1. Deploy backend (API Gateway + Lambda)
2. Verify APIs work
3. Deploy frontend with updated `VITE_API_URL`

## Security Checklist

Before going to production:

- [ ] Change default admin password
- [ ] Rotate JWT secret
- [ ] Enable CloudTrail for API Gateway
- [ ] Enable AWS WAF (optional but recommended)
- [ ] Restrict CORS origins (change from `*` to specific domains)
- [ ] Enable API Gateway access logging
- [ ] Set up CloudWatch alarms
- [ ] Enable DynamoDB point-in-time recovery
- [ ] Enable S3 versioning for documents bucket
- [ ] Review IAM policies for least privilege
- [ ] Enable MFA for AWS account
- [ ] Set up backup strategy for DynamoDB

## Performance Optimization

### 1. Enable API Gateway Caching

```bash
aws apigateway update-stage \
  --rest-api-id YOUR_API_ID \
  --stage-name prod \
  --patch-operations op=replace,path=/cacheClusterEnabled,value=true
```

### 2. Optimize Lambda Memory

Monitor Lambda duration and adjust memory:
- Current: 512 MB
- Recommended: Test with 1024 MB for better performance

### 3. Use DynamoDB Auto Scaling

Already configured with `PAY_PER_REQUEST` billing mode (auto-scales).

## Support

For issues or questions:

1. Check CloudWatch logs
2. Review this deployment guide
3. Check `API-GATEWAY-STRUCTURE.md` for endpoint details
4. Contact DevOps team

## Changelog

### 2024-12-28
- ✅ Added `PassthroughBehavior: WHEN_NO_MATCH` to fix OPTIONS CORS issues
- ✅ Verified all 100+ CRM endpoints work with proxy+ pattern
- ✅ Documented complete API structure
- ✅ Created deployment and troubleshooting guide

---

**Last Updated**: December 28, 2024
**Template Version**: cfn-template.yaml (with PassthroughBehavior fix)
**Deployment Script**: deploy-lambda.ps1
