# API Gateway Structure Documentation

## Overview

This document describes the API Gateway configuration for the Real Estate application, including all endpoints used by both the public website and CRM application.

## Architecture Decision

**Approach**: Greedy Proxy Pattern with CORS Support

We use AWS API Gateway's `{proxy+}` resource with `ANY` method for both APIs. This approach is:
- **Practical**: Handles 100+ CRM endpoints without hitting CloudFormation resource limits
- **Maintainable**: Backend route changes don't require CloudFormation updates
- **Performant**: Single Lambda integration point with minimal latency
- **Secure**: CORS properly configured with `PassthroughBehavior: WHEN_NO_MATCH`

## API Gateways

### 1. Public API Gateway (RealEstatePublicRestApi)

**Purpose**: Serves public-facing website endpoints (no authentication required)

**Domain**: `https://services-api.cloudberrysolutions.in/realestateagency`

**Base Path**: `/api`

**Full URL Pattern**: `https://services-api.cloudberrysolutions.in/realestateagency/api/*`

**CORS Configuration**:
- **Allowed Origins**: `*` (all domains including localhost)
- **Allowed Headers**: `Content-Type, Authorization, X-Requested-With, x-tenant-id`
- **Allowed Methods**: `GET, POST, PUT, DELETE, OPTIONS, PATCH`
- **PassthroughBehavior**: `WHEN_NO_MATCH` (fixes OPTIONS preflight issues)

**Endpoints Used by Public Website**:

| Method | Endpoint | Purpose | Headers Required |
|--------|----------|---------|------------------|
| GET | `/api/health` | Health check | `x-tenant-id` |
| GET | `/api/crm/properties/public/list` | List public properties | `x-tenant-id`, `Content-Type` |
| GET | `/api/crm/properties/public/{id}` | Get property details | `x-tenant-id`, `Content-Type` |
| POST | `/api/enquiries/contact` | Submit contact form | `x-tenant-id`, `Content-Type` |
| POST | `/api/enquiries/consultation` | Submit consultation form | `x-tenant-id`, `Content-Type` |
| POST | `/api/b2b-leads` | Submit B2B lead (Ten BKC) | `x-tenant-id`, `Content-Type` |

### 2. CRM API Gateway (RealEstateCrmRestApi)

**Purpose**: Serves CRM/Admin application endpoints (authentication required)

**Domain**: `https://services-api.cloudberrysolutions.in/realestatecrm`

**Base Path**: `/api`

**Full URL Pattern**: `https://services-api.cloudberrysolutions.in/realestatecrm/api/*`

**CORS Configuration**:
- **Allowed Origins**: `*` (all domains including localhost)
- **Allowed Headers**: `Content-Type, Authorization, X-Requested-With, x-tenant-id`
- **Allowed Methods**: `GET, POST, PUT, DELETE, OPTIONS, PATCH`
- **PassthroughBehavior**: `WHEN_NO_MATCH` (fixes OPTIONS preflight issues)

**Endpoints Used by CRM Application** (100+ endpoints):

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/change-password` - Change password

#### Dashboard
- `GET /api/dashboard/metrics` - Dashboard metrics
- `GET /api/rentals` - Rental list
- `GET /api/search?query={q}` - Search

#### Areas & Buildings
- `GET /api/areas` - List areas
- `POST /api/areas` - Create area
- `PUT /api/areas/{id}` - Update area
- `DELETE /api/areas/{id}` - Delete area
- `GET /api/buildings` - List buildings
- `GET /api/buildings/{id}` - Get building
- `POST /api/buildings` - Create building
- `PUT /api/buildings/{id}` - Update building
- `DELETE /api/buildings/{id}` - Delete building

#### Flats
- `GET /api/flats/building/{buildingId}` - Get flats by building
- `GET /api/flats/{flatId}` - Get flat details
- `POST /api/flats` - Create flat
- `PUT /api/flats/{flatId}` - Update flat
- `DELETE /api/flats/{flatId}` - Delete flat
- `POST /api/flats/{flatId}/owner` - Save owner (with file upload)
- `POST /api/flats/{flatId}/tenant` - Save tenant (with file upload)
- `POST /api/flats/{flatId}/agreement` - Create agreement (with file upload)
- `PUT /api/flats/{flatId}/agreement/{agreementId}` - Update agreement
- `POST /api/flats/{flatId}/verification` - Create verification (with file upload)
- `PUT /api/flats/{flatId}/verification/{verificationId}` - Update verification
- `POST /api/flats/{flatId}/documents` - Upload document (with file upload)
- `DELETE /api/flats/{flatId}/documents/{documentType}/{documentId}` - Delete document

#### CRM - Customers
- `GET /api/crm/customers` - List customers
- `GET /api/crm/customers/{customerId}` - Get customer
- `POST /api/crm/customers` - Create customer
- `PUT /api/crm/customers/{customerId}` - Update customer
- `DELETE /api/crm/customers/{customerId}` - Delete customer
- `GET /api/crm/customers/{customerId}/notes` - Get customer notes
- `POST /api/crm/customers/{customerId}/notes` - Create customer note
- `PUT /api/crm/customers/{customerId}/notes/{noteId}` - Update customer note
- `DELETE /api/crm/customers/{customerId}/notes/{noteId}` - Delete customer note
- `GET /api/crm/customers/lookup/by-phone?phone={phone}` - Lookup customer by phone

#### CRM - Owners
- `GET /api/crm/owners` - List owners
- `GET /api/crm/owners/{ownerId}` - Get owner
- `POST /api/crm/owners` - Create owner
- `PUT /api/crm/owners/{ownerId}` - Update owner
- `DELETE /api/crm/owners/{ownerId}` - Delete owner
- `GET /api/crm/owners/{ownerId}/properties` - Get owner properties
- `GET /api/crm/owners/{ownerId}/notes` - Get owner notes
- `POST /api/crm/owners/{ownerId}/notes` - Create owner note
- `PUT /api/crm/owners/{ownerId}/notes/{noteId}` - Update owner note
- `DELETE /api/crm/owners/{ownerId}/notes/{noteId}` - Delete owner note
- `POST /api/crm/owners/{ownerId}/documents` - Upload owner documents (with file upload)
- `GET /api/crm/owners/{ownerId}/with-documents` - Get owner with documents
- `GET /api/crm/owners/lookup/by-phone?phone={phone}` - Lookup owner by phone

#### CRM - Properties
- `GET /api/crm/metrics` - CRM metrics
- `GET /api/crm/properties` - List properties
- `GET /api/crm/properties?status={status}` - List properties by status
- `GET /api/crm/properties/{propertyId}` - Get property
- `POST /api/crm/properties` - Create property
- `PUT /api/crm/properties/{propertyId}` - Update property
- `DELETE /api/crm/properties/{propertyId}` - Delete property
- `GET /api/crm/properties/list/detailed` - Get detailed properties list
- `POST /api/crm/properties/{propertyId}/images` - Upload property images (with file upload)
- `POST /api/crm/properties/{propertyId}/videos` - Upload property videos (with file upload)
- `DELETE /api/crm/properties/{propertyId}/images/{imageKey}` - Delete property image
- `DELETE /api/crm/properties/{propertyId}/videos/{videoKey}` - Delete property video
- `GET /api/crm/properties/{propertyId}/agreements` - Get property agreements
- `POST /api/crm/properties/{propertyId}/agreements` - Create property agreement (with file upload)
- `PUT /api/crm/properties/{propertyId}/agreements/{agreementId}` - Update property agreement
- `GET /api/crm/properties/{propertyId}/verifications` - Get property verifications
- `POST /api/crm/properties/{propertyId}/verifications` - Create property verification (with file upload)
- `PUT /api/crm/properties/{propertyId}/verifications/{verificationId}` - Update property verification
- `GET /api/crm/properties/{propertyId}/documents` - Get property documents
- `POST /api/crm/properties/{propertyId}/documents/upload` - Upload property document (with file upload)
- `DELETE /api/crm/properties/{propertyId}/documents/{documentId}` - Delete property document

#### Enquiries
- `GET /api/enquiries` - List enquiries
- `GET /api/enquiries?status={status}` - List enquiries by status
- `GET /api/enquiries/metrics` - Enquiry metrics
- `GET /api/enquiries/{enquiryId}` - Get enquiry
- `POST /api/enquiries` - Create enquiry
- `PUT /api/enquiries/{enquiryId}` - Update enquiry
- `POST /api/enquiries/{enquiryId}/convert` - Convert enquiry to owner/tenant
- `POST /api/enquiries/{enquiryId}/close` - Close enquiry
- `GET /api/enquiries/{enquiryId}/notes` - Get enquiry notes
- `POST /api/enquiries/{enquiryId}/notes` - Create enquiry note
- `PUT /api/enquiries/{enquiryId}/notes/{noteId}` - Update enquiry note
- `DELETE /api/enquiries/{enquiryId}/notes/{noteId}` - Delete enquiry note

#### B2B Leads
- `GET /api/b2b-leads` - List B2B leads
- `GET /api/b2b-leads/{leadId}` - Get B2B lead
- `PUT /api/b2b-leads/{leadId}` - Update B2B lead
- `POST /api/b2b-leads/{leadId}/notes` - Add B2B lead note

## Frontend Configuration

### Public Website (.env)

```env
VITE_API_URL=https://services-api.cloudberrysolutions.in/realestateagency/api
VITE_TENANT_ID=your-tenant-id
```

**For localhost development**:
```env
VITE_API_URL=http://localhost:3001/api
VITE_TENANT_ID=your-tenant-id
```

### CRM Application (.env)

```env
VITE_API_URL=https://services-api.cloudberrysolutions.in/realestatecrm/api
VITE_TENANT_ID=your-tenant-id
```

**For localhost development**:
```env
VITE_API_URL=http://localhost:3001/api
VITE_TENANT_ID=your-tenant-id
```

## Headers Required

### All Requests
- `x-tenant-id`: Required for multi-tenancy (from `VITE_TENANT_ID`)
- `Content-Type`: `application/json` (except for file uploads)

### Authenticated Requests (CRM only)
- `Authorization`: `Bearer {token}` (obtained from `/api/auth/login`)

### File Upload Requests
- `Content-Type`: `multipart/form-data` (automatically set by browser)

## CORS Preflight (OPTIONS)

All endpoints automatically support CORS preflight requests:
- **Method**: OPTIONS
- **Response**: 200 OK
- **Headers**: 
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With,x-tenant-id`
  - `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS,PATCH`

## Lambda Integration

Both API Gateways use `AWS_PROXY` integration with a single Lambda function:
- **Function**: `${EnvironmentName}-real-estate-api`
- **Runtime**: Node.js 20.x
- **Handler**: `lambda-handler.handler`
- **Integration**: `serverless-express` wrapping Express.js application

## Binary Media Types

Both APIs support binary content for file uploads:
- `image/*`
- `video/*`
- `audio/*`
- `application/pdf`
- `application/octet-stream`
- `multipart/form-data`
- And more...

## Deployment

To deploy changes to the API Gateway configuration:

```powershell
cd server
.\deploy-lambda.ps1
```

This script:
1. Packages the Lambda code
2. Uploads to S3
3. Deploys the CloudFormation stack
4. Forces API Gateway redeployment

## Testing

### Test CORS from Browser Console

```javascript
// Test public API
fetch('https://services-api.cloudberrysolutions.in/realestateagency/api/health', {
  headers: {
    'x-tenant-id': 'your-tenant-id'
  }
}).then(r => r.json()).then(console.log);

// Test CRM API (requires auth token)
fetch('https://services-api.cloudberrysolutions.in/realestatecrm/api/crm/metrics', {
  headers: {
    'x-tenant-id': 'your-tenant-id',
    'Authorization': 'Bearer your-token-here'
  }
}).then(r => r.json()).then(console.log);
```

### Test from localhost

Both APIs work from localhost without any additional configuration due to CORS `*` origin policy.

## Troubleshooting

### OPTIONS returns 500 "Unable to transform request"

**Solution**: Ensure `PassthroughBehavior: WHEN_NO_MATCH` is present in all OPTIONS method integrations. This is already configured in the current template.

### CORS errors in browser

**Check**:
1. Verify `x-tenant-id` header is being sent
2. Check browser DevTools Network tab for preflight (OPTIONS) request
3. Verify the request URL matches the expected pattern
4. Ensure `VITE_API_URL` environment variable is correctly set

### 401 Unauthorized on CRM endpoints

**Solution**: Ensure you're logged in and the `Authorization: Bearer {token}` header is being sent with the request.

## Best Practices

1. **Always include `x-tenant-id` header** in all requests
2. **Use environment variables** for API URLs (never hardcode)
3. **Handle CORS errors gracefully** in the frontend
4. **Test on localhost** before deploying to production
5. **Monitor CloudWatch logs** for Lambda errors
6. **Use proper HTTP methods** (GET for reads, POST for creates, PUT for updates, DELETE for deletes)
7. **Validate input** on both frontend and backend
8. **Use HTTPS** in production (never HTTP)

## Security Considerations

1. **Public API**: No authentication required, but rate limiting should be considered
2. **CRM API**: JWT authentication required for all endpoints except `/auth/login`
3. **CORS**: Currently allows all origins (`*`). Consider restricting in production.
4. **Headers**: `x-tenant-id` provides basic multi-tenancy isolation
5. **File Uploads**: Validated on backend, size limits enforced
6. **S3**: Pre-signed URLs used for secure file access

## Future Improvements

1. **API Gateway Authorizers**: Add custom authorizer for JWT validation at API Gateway level
2. **Rate Limiting**: Implement usage plans and API keys
3. **Request Validation**: Add request/response models for validation
4. **Caching**: Enable API Gateway caching for GET endpoints
5. **WAF**: Add AWS WAF for additional security
6. **Monitoring**: Enhanced CloudWatch dashboards and alarms
7. **Documentation**: Auto-generate OpenAPI/Swagger documentation
