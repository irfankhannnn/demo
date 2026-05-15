# Setup

## Prerequisites
- Node.js 20.x (backend), 18+ (frontend)
- npm 9+
- AWS CLI configured with profile `cloudberry` (for deployment)
- PowerShell (for Windows deployment scripts)

## Frontend Setup (real-estate-crm-app/)

1. Install dependencies:
   ```bash
   cd real-estate-crm-app
   npm install
   ```

2. Create `.env`:
   ```
   VITE_API_BASE_URL=https://services-api.cloudberrysolutions.in
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
   VITE_TENANT_ID=your_tenant_id
   ```

3. Run development server:
   ```bash
   npm run dev
   ```
   Serves on http://localhost:5173

4. Build for production:
   ```bash
   npm run build
   ```
   Output goes to `dist/`. Deploy `dist/` to static hosting (Netlify, CloudFront, etc.).

## Backend Setup (server/)

1. Install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Create `.env`:
   ```
   JWT_SECRET=your_jwt_secret
   AWS_REGION=ap-south-1
   DYNAMODB_TABLE_NAME=cloudberry-real-estate-core
   CRM_DYNAMODB_TABLE_NAME=cloudberry-real-estate-crm
   AGENCY_CONFIG_TABLE_NAME=cloudberry-real-estate-agencies
   AREAS_TABLE_NAME=cloudberry-real-estate-areas
   ENQUIRIES_TABLE_NAME_CLOUDBERRY=cloudberry-real-estate-enquiries
   B2B_LEADS_TABLE_NAME=cloudberry-real-estate-b2b-details
   KHATA_TABLE_NAME=cloudberry-real-estate-khata
   NOTIFICATIONS_TABLE_NAME=cloudberry-real-estate-notifications
   DEVELOPERS_TABLE_NAME=cloudberry-real-estate-developers
   REAL_ESTATE_AREAS_TABLE_NAME=cloudberry-real-estate-communities
   PROJECTS_TABLE_NAME=cloudberry-real-estate-projects
   S3_BUCKET_NAME=your-s3-bucket
   DEFAULT_ADMIN_USERNAME=admin
   DEFAULT_ADMIN_PASSWORD=admin123
   ```

3. Run local development server:
   ```bash
   node server.js
   ```
   Serves on http://localhost:3001

4. The server auto-creates a default admin on first run if none exists.

## AWS Deployment

### CloudFormation Stack (First Time)
1. Ensure AWS CLI is configured with the `cloudberry` profile.
2. Run the deployment script:
   ```powershell
   cd server
   .\deploy-lambda.ps1
   ```
   This packages the backend, uploads to S3, and creates/updates the CloudFormation stack.

### Manual Lambda Update (Code Only)
- Use `deploy-lambda.ps1` for full stack updates.
- For quick code-only updates, zip the server code and upload via AWS Console or CLI to the Lambda function.

### API Gateway
- Custom domain: `services-api.cloudberrysolutions.in`
- All routes are explicitly mapped (no proxy+).
- CORS is handled in `lambda-handler.js` with path normalization for API Gateway events.

## Capacitor Mobile Build

1. Add platforms (first time):
   ```bash
   cd real-estate-crm-app
   npx cap add ios
   npx cap add android
   ```

2. Build and sync:
   ```bash
   npm run build
   npx cap sync
   ```

3. Open in Xcode/Android Studio:
   ```bash
   npx cap open ios
   npx cap open android
   ```

## Environment-Specific Notes

- **Tenant ID**: Each tenant gets a separate frontend build with their `VITE_TENANT_ID`. The backend reads `x-tenant-id` from headers for data isolation.
- **S3 Bucket**: Must exist before first deployment. Bucket is used for media uploads and Lambda deployment artifacts.
- **DynamoDB**: Tables are created by CloudFormation. Billing mode is `PAY_PER_REQUEST`.
- **Google Maps**: Required for property map views and area autocomplete. Key must have Maps JavaScript API and Places API enabled.
