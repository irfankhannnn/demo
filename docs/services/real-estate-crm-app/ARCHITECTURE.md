# Architecture Documentation

## System Overview

The Real Estate CRM Mobile App is a **standalone frontend application** that connects to the existing backend server. It's built with React + TypeScript + Vite and uses Capacitor for mobile deployment.

## Multi-Tenancy Architecture

### How It Works

1. **Tenant ID Assignment**
   - Each organization/user gets a unique tenant ID
   - Set via `VITE_TENANT_ID` environment variable
   - Included in ALL API requests via `x-tenant-id` header

2. **Data Isolation**
   - Backend filters all queries by tenant ID
   - Each tenant can ONLY access their own data
   - No cross-tenant data leakage possible

3. **Request Flow**
   ```
   Mobile App → API Service → Add x-tenant-id header → Backend
   Backend → Check tenant ID → Filter DB query → Return data
   ```

### Implementation

**Frontend (config/tenant.ts):**
```typescript
const TENANT_ID = import.meta.env.VITE_TENANT_ID;

export function getTenantHeaders() {
  return {
    'x-tenant-id': TENANT_ID,
  };
}
```

**API Service (services/api.ts):**
```typescript
private getHeaders() {
  return {
    ...getTenantHeaders(), // Automatically adds tenant ID
    'Authorization': `Bearer ${this.token}`,
    'Content-Type': 'application/json'
  };
}
```

**Backend (tenantMiddleware.js):**
```javascript
export function extractTenantId(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  req.tenantId = tenantId;
  next();
}
```

## Application Structure

### Pages Layer
- **Dashboard** - Overview of areas, buildings, metrics
- **RentalList** - Comprehensive rental tracking
- **BuildingDetail** - Individual building management
- **AdminSettings** - User settings and password change

### CRM Module
- **CRMDashboard** - CRM metrics overview
- **CustomerList/Details** - Customer management
- **OwnerList/Details** - Property owner management
- **PropertyList/Details** - Property CRUD operations

### Service Layer
**API Service** (`services/api.ts`)
- Single source of truth for all API calls
- Handles authentication (JWT tokens)
- Automatically includes tenant headers
- Error handling and response parsing

### Type System
**Type Definitions** (`types/`)
- `admin.ts` - Admin-related types (Area, Building, etc.)
- `crm.ts` - CRM types (Customer, Owner, Property)
- `property.ts` - Property-specific types

### Utilities
- `dateFormat.ts` - Indian date formatting (DD/MM/YYYY)

## Authentication Flow

1. **Login**
   ```
   User enters credentials → API.login() → Backend validates
   → JWT token returned → Stored in localStorage → Navigate to dashboard
   ```

2. **Protected Routes**
   ```
   User navigates → App checks localStorage for token
   → Token exists? → Allow access : Redirect to login
   ```

3. **API Requests**
   ```
   Every request → Add Authorization header with token
   → Backend validates token → Grant/deny access
   ```

## Mobile Build Process

### Capacitor Integration

1. **Web Build**
   ```bash
   npm run build → Creates optimized dist/ folder
   ```

2. **Sync to Native**
   ```bash
   cap sync → Copies dist/ to android/ios apps
   → Updates native dependencies
   ```

3. **Native Build**
   ```
   Android Studio/Xcode → Build native app
   → Wraps web app in WebView
   ```

### Platform-Specific Considerations

**Android:**
- Minimum SDK: 22 (Android 5.1)
- Target SDK: 34
- Permissions: Internet, Network State
- WebView: Chrome-based

**iOS:**
- Minimum iOS: 13.0
- WebView: WKWebView
- Requires Apple Developer Account for deployment

## Data Flow Examples

### Creating a New Property

1. User fills form in `PropertyDetails.tsx`
2. Form data validated on frontend
3. `api.createCRMProperty(data)` called
4. API service adds:
   - `x-tenant-id` header
   - `Authorization` header
   - JSON payload
5. Backend receives request:
   - Validates token
   - Extracts tenant ID
   - Creates property with tenant ID
   - Returns saved property
6. Frontend receives response:
   - Updates local state
   - Navigates to property list

### Fetching Rental List

1. `RentalList.tsx` component mounts
2. `api.getRentalList()` called
3. Request sent with headers:
   ```javascript
   {
     'x-tenant-id': 'tenant-123',
     'Authorization': 'Bearer jwt_token'
   }
   ```
4. Backend query:
   ```sql
   SELECT * FROM flats WHERE tenant_id = 'tenant-123'
   ```
5. Data returned, filtered by tenant
6. Component renders list

## Security Considerations

### Frontend
- No sensitive data in source code
- Environment variables for configuration
- JWT tokens in localStorage (consider httpOnly cookies for production)
- Input validation before API calls

### Backend Integration
- All requests authenticated
- Tenant isolation enforced at DB level
- CORS properly configured
- Rate limiting recommended

### Mobile Specific
- App transport security (HTTPS in production)
- Certificate pinning recommended
- Secure storage for sensitive data
- Obfuscation for production builds

## Extending the Application

### Adding a New Page

1. Create component in `src/pages/`
2. Add route in `App.tsx`
3. Add navigation link in Dashboard/CRM components

### Adding a New API Endpoint

1. Add method in `services/api.ts`:
   ```typescript
   async getNewData() {
     const response = await fetch(`${API_BASE_URL}/new-endpoint`, {
       headers: this.getHeaders(),
     });
     return this.handleResponse(response);
   }
   ```

2. Use in component:
   ```typescript
   const data = await api.getNewData();
   ```

### Adding a New Feature

1. Design UI in React components
2. Add types in `types/`
3. Add API methods in `services/api.ts`
4. Implement backend endpoint (in main project)
5. Test in web browser
6. Build and test on mobile

## Performance Optimizations

### Current Optimizations
- Code splitting via React Router
- Image lazy loading
- API response caching in component state
- Optimized Vite build

### Future Considerations
- React Query for advanced caching
- Virtual scrolling for large lists
- Service Worker for offline support
- Image optimization/compression

## Deployment Strategy

### Development
```
Local Network:
- Backend: http://192.168.1.X:3000
- Frontend: http://localhost:5174
- Mobile: Connects to local backend
```

### Staging
```
Cloud Server:
- Backend: https://staging-api.domain.com
- Frontend Web: https://staging.domain.com
- Mobile: Points to staging API
```

### Production
```
Production Servers:
- Backend: https://api.domain.com
- Frontend Web: https://app.domain.com
- Mobile Apps: Use production API
- CDN for assets
```

## Monitoring & Analytics

### Recommended Additions
- Error tracking (Sentry)
- Analytics (Google Analytics, Mixpanel)
- Performance monitoring (New Relic)
- Crash reporting (Crashlytics for mobile)

## Testing Strategy

### Unit Tests
- Component rendering
- Utility functions
- API service methods

### Integration Tests
- API integration
- Navigation flows
- Form submissions

### E2E Tests
- Critical user journeys
- Mobile-specific interactions
- Cross-platform testing

## Troubleshooting Guide

### Common Issues

**1. Cannot connect to backend**
- Verify API URL in .env
- Check network connectivity
- Verify backend is running
- Check CORS configuration

**2. Tenant data not showing**
- Verify tenant ID matches backend
- Check backend database has data for tenant
- Verify tenant middleware is working

**3. Authentication failures**
- Clear localStorage and re-login
- Verify credentials are correct
- Check token expiration
- Verify backend auth routes

**4. Mobile build fails**
- Clean build: `cap sync --clean`
- Reinstall dependencies
- Check native IDE configurations
- Update Capacitor: `npm update @capacitor/*`

## Future Enhancements

### Planned Features
- Push notifications for new leads
- Offline mode with local storage
- Document scanning with camera
- Geolocation for properties
- Dark mode support
- Multi-language support

### Infrastructure
- GraphQL API option
- Real-time updates (WebSocket)
- Microservices architecture
- Kubernetes deployment

## Contributing Guidelines

1. Follow existing code structure
2. Add types for new features
3. Test on both web and mobile
4. Document API changes
5. Update this documentation

## Support

For issues or questions:
- Check SETUP.md for installation help
- Review troubleshooting section above
- Contact development team
