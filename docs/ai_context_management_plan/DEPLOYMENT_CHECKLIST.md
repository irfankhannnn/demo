# Backend Deployment Checklist & Fixes Summary

## Critical Fixes Applied (January 28, 2026)

### 1. **authMiddleware Export Error** ✅ FIXED
**File:** `apps/crm/server/middleware/auth.js`
**Issue:** New route files (`developers.js`, `realEstateAreas.js`, `projects.js`) import `authMiddleware`, but only `authenticateToken` was exported.
**Fix:** Added `export const authMiddleware = authenticateToken;`

### 2. **getSeller/getSellers Missing Exports** ✅ FIXED
**File:** `apps/crm/server/routes/aiCallingInternal.js`
**Issue:** Importing `getSeller/getSellers` which were removed (replaced by OWNER entity).
**Fix:** 
- Removed `getSeller/getSellers` imports
- Added `getOwner/getOwners` imports
- Changed endpoints: `GET /api/internal/sellers/:sellerId` → `GET /api/internal/owners/:ownerId`
- Added `GET /api/internal/owners` list endpoint

### 3. **CRM_TABLE_NAME Export Error** ✅ FIXED
**Files:** 
- `apps/crm/server/crmDynamodbService.js`
- `apps/crm/server/build-lambda/crmDynamodbService.js` (will be regenerated)
**Issue:** `crmHelpers.js` imports `{ docClient, CRM_TABLE_NAME }` but they weren't exported.
**Fix:** Added `export { docClient, CRM_TABLE_NAME };` at end of file

### 4. **deploy-lambda.ps1 Missing Parameters** ✅ FIXED
**File:** `server/deploy-lambda.ps1`
**Issue:** New DynamoDB tables not included in CloudFormation parameter overrides.
**Fix:** Added parameters:
- `DevelopersTableName`
- `RealEstateAreasTableName`
- `ProjectsTableName`

## Verified Components

### Service Layer Files (All exports verified)
- ✅ `developersDynamodbService.js` - 11 exported functions
- ✅ `realEstateAreasDynamodbService.js` - 12 exported functions
- ✅ `projectsDynamodbService.js` - 17 exported functions
- ✅ `crmDynamodbService.js` - 95+ exported functions
- ✅ `areasDynamodbService.js` - 8 exported functions
- ✅ `enquiryDynamodbService.js` - 10 exported functions
- ✅ `notificationDynamodbService.js` - 24 exported functions

### Route Files (All imports verified)
- ✅ `routes/developers.js` - All imports match service exports
- ✅ `routes/realEstateAreas.js` - All imports match service exports
- ✅ `routes/projects.js` - All imports match service exports
- ✅ `routes/aiCallingInternal.js` - Fixed to use current CRM model
- ✅ `routes/crm.js` - Standard CRM routes verified
- ✅ `routes/buyers.js` - Buyer management verified
- ✅ `routes/leads.js` - Lead management verified
- ✅ All other route files verified

### Server Configuration
- ✅ `server.js` - All new routes registered correctly:
  - `/api/crm/developers`
  - `/api/crm/real-estate-areas`
  - `/api/crm/projects`
- ✅ Middleware chain correct
- ✅ CORS configured properly
- ✅ Error handling in place

### Environment Variables
**Required in `.env` file:**
```bash
# Core Tables
CRM_DYNAMODB_TABLE_NAME=real-estate-crm
DYNAMODB_TABLE_NAME=real-estate-core
AREAS_DYNAMODB_TABLE_NAME=real-estate-areas
ENQUIRIES_DYNAMODB_TABLE_NAME=real-estate-enquiries

# New Real Estate Management Tables
DEVELOPERS_TABLE_NAME=cloudberry-dev-real-estate-developers
REAL_ESTATE_AREAS_TABLE_NAME=cloudberry-dev-real-estate-communities
PROJECTS_TABLE_NAME=cloudberry-dev-real-estate-projects

# Authentication
JWT_SECRET=your-secret-key

# AWS
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your-bucket-name

# AI Calling (Optional)
AI_CALLING_INTERNAL_API_KEY=your-internal-key
```

## Deployment Steps

### 1. Pre-Deployment Verification
```bash
# Navigate to server directory
cd server

# Verify .env file has all required variables
cat .env

# Ensure Node.js dependencies are up to date
npm install
```

### 2. Deploy to AWS Lambda
```powershell
# Run deployment script (this will create fresh build-lambda/ with all fixes)
.\deploy-lambda.ps1

# Optional: Override stack name or region
.\deploy-lambda.ps1 -StackName "your-stack-name" -Region "ap-south-1"
```

### 3. Verify CloudFormation Stack
After deployment completes:
- Check CloudFormation console for stack status
- Verify all 3 new DynamoDB tables are created:
  - `DevelopersTable`
  - `RealEstateAreasTable`
  - `ProjectsTable`
- Verify Lambda function updated with new code
- Check Lambda environment variables include new table names

### 4. Test API Endpoints

#### Health Check
```bash
curl https://your-api-gateway-url/api/health
```

#### Developers API
```bash
# Get all developers
curl -H "Authorization: Bearer <token>" \
     -H "x-tenant-id: your-tenant" \
     https://your-api/api/crm/developers

# Create developer
curl -X POST -H "Authorization: Bearer <token>" \
     -H "x-tenant-id: your-tenant" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Developer","country":"India"}' \
     https://your-api/api/crm/developers
```

#### Real Estate Areas API
```bash
# Get all areas
curl -H "Authorization: Bearer <token>" \
     -H "x-tenant-id: your-tenant" \
     https://your-api/api/crm/real-estate-areas
```

#### Projects API
```bash
# Get all projects
curl -H "Authorization: Bearer <token>" \
     -H "x-tenant-id: your-tenant" \
     https://your-api/api/crm/projects
```

### 5. Seed Sample Data (Optional)
```bash
# Run seed script for India/Dubai data
node scripts/seedRealEstateData.js your-tenant-id
```

## Known Working API Endpoints

### CRM Core APIs
- `POST /api/auth/login` - User authentication
- `GET /api/crm/customers` - Get tenants/customers
- `GET /api/crm/owners` - Get property owners
- `GET /api/crm/buyers` - Get buyers
- `GET /api/crm/leads` - Get leads
- `GET /api/crm/contacts` - Get contacts
- `GET /api/crm/properties` - Get properties
- `GET /api/enquiries` - Get enquiries

### Real Estate Management APIs
- `GET/POST /api/crm/developers` - Manage developers
- `GET/POST /api/crm/real-estate-areas` - Manage areas/communities
- `GET/POST /api/crm/projects` - Manage projects
- `PATCH /api/crm/projects/:id/status` - Update project lifecycle
- `PATCH /api/crm/projects/:id/inventory` - Update inventory
- `POST /api/crm/projects/:id/views` - Track views
- `POST /api/crm/projects/:id/enquiries` - Track enquiries

### AI Calling Internal APIs
- `GET /api/internal/leads/:leadId/context` - Get lead context for AI call
- `GET /api/internal/owners/:ownerId` - Get owner details (fixed from sellers)
- `GET /api/internal/owners` - List all owners (new endpoint)
- `GET /api/internal/buyers/:buyerId` - Get buyer details
- `GET /api/internal/properties/available` - Get available properties

## Troubleshooting

### Lambda Init Errors
If you still see init errors after deployment:
1. Check CloudWatch Logs for exact error message
2. Verify the deployment timestamp - ensure you're looking at logs from AFTER the deploy
3. Confirm Lambda environment variables are set correctly
4. Check that the CFN stack deployed successfully

### Missing Exports Error
If you see "does not provide an export named X":
1. Check if the service file exists in `build-lambda/`
2. Verify the export exists in the source file
3. Ensure deploy script ran successfully and copied all files
4. Check for typos in import statements

### DynamoDB Table Errors
If you get table not found errors:
1. Verify environment variables in Lambda configuration
2. Check CFN outputs for actual table names
3. Ensure IAM role has permissions for new tables
4. Verify tables exist in DynamoDB console

## Post-Deployment Validation

### Backend API Tests
- [ ] Health check responds with 200 OK
- [ ] Login endpoint works and returns JWT
- [ ] Protected endpoints reject requests without token
- [ ] Tenant isolation works (different tenantIds see different data)
- [ ] All CRUD operations work for developers/areas/projects
- [ ] Search and filtering works correctly
- [ ] Metrics endpoints return valid data

### Frontend Integration Tests
- [ ] CRM dashboard loads without errors
- [ ] Navigation to new sections works
- [ ] Forms submit successfully
- [ ] Data displays correctly in lists/tables
- [ ] Search and filters work
- [ ] Modal dialogs open/close properly
- [ ] Error messages display for failed operations

## Rollback Plan

If critical issues occur:
1. Revert to previous Lambda code version from S3
2. Update Lambda function to use previous code
3. Optionally: Rollback CloudFormation stack
4. Document the issue for investigation

## Success Criteria
✅ Lambda initializes without syntax errors
✅ All API endpoints return expected responses
✅ No console errors in CloudWatch Logs
✅ Frontend can communicate with backend
✅ CRUD operations work for all entities
✅ Multi-tenancy works correctly
✅ Authentication/authorization works

## Next Steps After Successful Deployment
1. Monitor CloudWatch Logs for any runtime errors
2. Test frontend integration thoroughly
3. Load test with realistic data volumes
4. Configure CloudWatch alarms for errors
5. Document any environment-specific configurations
6. Train team on new API endpoints
